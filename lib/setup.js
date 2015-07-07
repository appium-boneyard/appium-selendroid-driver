import request from 'request-promise';
import path from 'path';
import fs from 'fs';
import B from 'bluebird';
import { util } from 'appium-support';
import log from './logger';

const mkdirp = util.mkdirp;
const chmod = B.promisify(fs.chmod);
const writeFile = B.promisify(fs.writeFile);

const SE_VER = "0.15.0";
const SE_DOWNLOAD = `https://github.com/selendroid/selendroid/releases/` +
                    `download/${SE_VER}/selendroid-standalone-${SE_VER}-with` +
                    `-dependencies.jar`;
const SE_DIR = path.resolve(__dirname, "..", "..", "selendroid");
const SE_PATH = path.resolve(SE_DIR, "selendroid-server.jar");

async function downloadSelendroid () {
  await mkdirp(SE_DIR);
  log.info(`Downloading Selendroid version ${SE_VER} from ${SE_DOWNLOAD} ` +
           `--> ${SE_PATH}`);
  let body = await request.get({url: SE_DOWNLOAD, encoding: 'binary'});
  log.info(`Writing binary content to ${SE_PATH}`);
  await writeFile(SE_PATH, body, {encoding: 'binary'});
  await chmod(SE_PATH, 0o0644);
  log.info(`Selendroid downloaded`);
}

async function serverExists () {
  return util.fileExists(SE_PATH);
}

export { downloadSelendroid, serverExists, SE_PATH };
