import multer from 'multer';
import crypto from 'crypto';
import { resolve } from 'path';

export const directory = resolve(__dirname, '..', '..', 'tmp');
export default {
  storage: multer.diskStorage({
    destination: directory,
    filename(request, file, callback) {
      const fileHash = crypto.randomBytes(8).toString('HEX');

      const fileName = `${fileHash}-${file.originalname}`;

      return callback(null, fileName);
    },
  }),
};
