import request from 'request-promise';
import path from 'path';
import { fs } from 'appium-support';
import { exec } from 'teen_process';
import log from './logger';

const SE_VER = "0.17.0";
const SE_DOWNLOAD = `https://github.com/selendroid/selendroid/releases/` +
                    `download/${SE_VER}/selendroid-standalone-${SE_VER}-with` +
                    `-dependencies.jar`;
const SE_DOWNLOAD_MD5 = "5e1f7de5e4d2eb77b68675d76c5edf6a";
const SE_DIR = path.resolve(__dirname, "..", "..", "selendroid");
const SE_DOWNLOAD_DIR = path.resolve(SE_DIR, "download");
const SE_JAR_PATH = path.resolve(SE_DOWNLOAD_DIR, "selendroid-server.jar");
const SE_APK_PATH = path.resolve(SE_DIR, "selendroid-server.apk");
const SE_MANIFEST_PATH = path.resolve(SE_DIR, "AndroidManifest.xml");

async function setupSelendroid () {
  try {
    await exec('jar');
  } catch (err) {
    if (err.message.indexOf("ENOENT") !== -1) {
      log.error("Could not find Java's 'jar' executable on your PATH. Please " +
                "ensure it is present and try running install again");
      return;
    }
  }
  if (await fs.exists(SE_JAR_PATH) &&
      await fs.md5(SE_JAR_PATH) === SE_DOWNLOAD_MD5) {
    log.info("Standalone jar exists and has correct hash, skipping download");
  } else {
    await downloadSelendroid();
  }
  log.info(`Determining AndroidManifest location`);
  let manifestPath = await getFilePathFromJar(/AndroidManifest.*\.xml$/,
                                              SE_JAR_PATH);
  log.info(`Determining server apk location`);
  let serverPath = await getFilePathFromJar(/selendroid-server.*\.apk$/,
                                            SE_JAR_PATH);
  log.info(`Extracting manifest and apk to ${SE_DOWNLOAD_DIR}`);
  await exec('jar', ['xf', SE_JAR_PATH, manifestPath, serverPath], {
    cwd: SE_DOWNLOAD_DIR
  });
  log.info(`Copying manifest and apk to ${SE_DIR}`);
  let extractedManifestPath = path.resolve(SE_DOWNLOAD_DIR, manifestPath);
  let extractedServerPath = path.resolve(SE_DOWNLOAD_DIR, serverPath);
  await fs.copyFile(extractedManifestPath, SE_MANIFEST_PATH);
  await fs.copyFile(extractedServerPath, SE_APK_PATH);
  log.info("Cleaning up temp files");
  await fs.rimraf(extractedManifestPath);
  await fs.rimraf(extractedServerPath);
  log.info(`Fixing AndroidManifest icon bug`);
  await fixManifestIcons(SE_MANIFEST_PATH);
  if (!(await serverExists())) {
    throw new Error("Something went wrong in setting up selendroid");
  }
}

async function downloadSelendroid () {
  log.info(`Ensuring ${SE_DOWNLOAD_DIR} exists`);
  await fs.mkdir(SE_DIR);
  await fs.mkdir(SE_DOWNLOAD_DIR);
  log.info(`Downloading Selendroid standalone server version ${SE_VER} from ` +
           `${SE_DOWNLOAD} --> ${SE_JAR_PATH}`);
  let body = await request.get({url: SE_DOWNLOAD, encoding: 'binary'});
  log.info(`Writing binary content to ${SE_JAR_PATH}`);
  await fs.writeFile(SE_JAR_PATH, body, {encoding: 'binary'});
  await fs.chmod(SE_JAR_PATH, 0o0644);
  if (await fs.md5(SE_JAR_PATH) === SE_DOWNLOAD_MD5) {
    log.info("Selendroid standalone server downloaded");
  } else {
    log.warn("Selendroid standalone server downloaded, but MD5 hash did not " +
             "match, please be careful");
  }
}

async function getFilePathFromJar (fileRegex, jarPath) {
  let {stdout} = await exec('jar', ['tf', jarPath]);
  for (let line of stdout.split("\n")) {
    if (fileRegex.test(line.trim())) {
      return line.trim();
    }
  }
  throw new Error(`Could not find ${fileRegex} in ${jarPath}`);
}

async function serverExists () {
  try {
    return (await fs.exists(SE_APK_PATH) &&
            await fs.exists(SE_MANIFEST_PATH));
  } catch (e) {
    if (e.code.indexOf("ENOENT") !== -1) {
      return false;
    }
    throw e;
  }
}

async function fixManifestIcons (manifest) {
  let curData = (await fs.readFile(manifest)).toString('utf8');
  let iconRe = /application[\s\S]+android:icon="[^"]+"/;
  let newData = curData.replace(iconRe, "application");
  await fs.writeFile(manifest, newData);
}

export { setupSelendroid, serverExists, SE_APK_PATH, SE_MANIFEST_PATH };
