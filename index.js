// transpile:main

import yargs from 'yargs';
import { asyncify } from 'asyncbox';
import SelendroidDriver from './lib/driver';
import startServer from './lib/server';


const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 4884;

async function main () {
  let port = yargs.argv.port || DEFAULT_PORT;
  let host = yargs.argv.host || DEFAULT_HOST;
  return await startServer(port, host);
}

if (require.main === module) {
  asyncify(main);
}

export { SelendroidDriver, startServer };
export default SelendroidDriver;

