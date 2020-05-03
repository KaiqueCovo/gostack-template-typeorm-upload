import { getRepository, In, getCustomRepository } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';

import Category from '../models/Category';
import Transaction from '../models/Transaction';

import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    /**
     * References the file path
     */
    const readCSVStream = fs.createReadStream(filePath);

    /**
     *
     */
    const parseStream = csvParse({
      from_line: 2 /* Discard first line from archive  */,
      ltrim: true /* Remove spaces */,
      rtrim: true /* Remove spaces */,
    });

    /**
     * Monitor the transmission from datas
     */
    const parseCSV = readCSVStream.pipe(parseStream);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    /**
     * Read lines from archive CSV
     * and check if category already existy in array
     */
    parseCSV.on('data', transaction => {
      const [title, type, value, category] = transaction;

      transactions.push({ title, type, value, category });

      if (categories.indexOf(category) !== 0) categories.push(category);
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    /**
     * Get categories existing with title
     */
    const existingCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    /**
     * Remove categories already existing
     */
    existingCategories.filter(({ title }) => {
      const index = categories.indexOf(title);
      return categories.splice(index, 1);
    });

    /**
     * Create categories instance array
     */
    const createCategories = await categoriesRepository.create(
      categories.map(category => ({ title: category })),
    );

    /**
     * Save new categories
     */
    const newCategories = await categoriesRepository.save(createCategories);

    /**
     * All categories together
     */
    const allCategories = [...existingCategories, ...newCategories];

    /**
     * Create transactions instance array
     */
    const newTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    /**
     * Save new transactions
     */
    await transactionsRepository.save(newTransactions);

    /**
     * Delete archive CSV
     */
    await fs.promises.unlink(filePath);

    return newTransactions;
  }
}

export default ImportTransactionsService;
