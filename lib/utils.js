import B from 'bluebird';
import fs from 'fs';

const utils = {
  writeFile: B.promisify(fs.writeFile),
  readFile: B.promisify(fs.readFile),
};

export default utils;
