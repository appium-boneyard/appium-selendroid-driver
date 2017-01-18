import request from 'request-promise';
import path from 'path';
import { fs } from 'appium-support';
import { exec } from 'teen_process';
import log from './logger';
import crypto from 'crypto';

const SE_VER = "0.17.0";
const SE_DOWNLOAD_CDNURL = process.env.npm_config_selendroid_driver_cdnurl ||
                           process.env.SELENDROID_DRIVER_CDNURL ||
                           "http://repo1.maven.org/maven2/io/selendroid/selendroid-standalone";
const SE_DOWNLOAD = `${SE_DOWNLOAD_CDNURL}/${SE_VER}/selendroid-standalone-${SE_VER}-with-dependencies.jar`;
const SE_DOWNLOAD_SHA256 = "7cf7163ac47f1c46eff95b62f78b58c1dabdec534acc6632da3784739f6e9d82";
const SE_DIR = path.resolve(__dirname, "..", "..", "selendroid");
const SE_DOWNLOAD_DIR = path.resolve(SE_DIR, "download");
// Use of temporary file means that SE_JAR_PATH can only exist if it has
// verified content.
const SE_JAR_PATH_TMP = path.resolve(SE_DOWNLOAD_DIR, "selendroid-server.jar.tmp");
// Putting fingerprint in file name means download triggered if fingerprint changed.
const SE_JAR_PATH = path.resolve(SE_DOWNLOAD_DIR, `selendroid-server-${SE_DOWNLOAD_SHA256}.jar`);
const SE_APK_PATH = path.resolve(SE_DIR, "selendroid-server.apk");
const SE_MANIFEST_PATH = path.resolve(SE_DIR, "AndroidManifest.xml");

async function setupSelendroid () {
  try {
    await exec('jar');
  } catch (err) {
    if (err.message.indexOf("ENOENT") !== -1 ||
        err.message.indexOf("exited with code 2") !== -1 ||
        err.message.indexOf("Command 'jar' not found. Is it installed?") !== -1) {
      log.error("Could not find Java's 'jar' executable on your PATH. Please " +
                "ensure it is present and try running install again");
      return;
    }
  }
  if (await fs.exists(SE_JAR_PATH)) {
    log.info("Standalone jar exists, skipping download: " + SE_JAR_PATH);
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
  let body = await request.get({url: SE_DOWNLOAD, encoding: null});
  if (!body instanceof Buffer) {
    throw new Error(Object.prototype.toString.call(body));
  }
  log.info(`Writing binary content to ${SE_JAR_PATH_TMP}`);
  await fs.writeFile(SE_JAR_PATH_TMP, body);
  await fs.chmod(SE_JAR_PATH_TMP, 0o0644);
  let fingerprint = await sha256(body);
  if (fingerprint === SE_DOWNLOAD_SHA256) {
    await fs.rename(SE_JAR_PATH_TMP, SE_JAR_PATH);
    log.info("Selendroid standalone server downloaded");
  } else {
    log.errorAndThrow("bad SHA256 fingerprint: " + fingerprint + " bytes: " + body.length);
  }
}

async function sha256 (buffer) {
  const hash = crypto.createHash('sha256');
  return hash.update(buffer).digest('hex');
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
