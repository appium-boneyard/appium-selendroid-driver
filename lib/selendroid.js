import { util } from 'appium-support';
import { JWProxy } from 'appium-jsonwp-proxy';
import { retryInterval } from 'asyncbox';
import logger from './logger';
import path from 'path';
import B from 'bluebird';
import { SE_APK_PATH, SE_MANIFEST_PATH } from './setup';
import { writeFile, readFile } from './utils'; // TODO replace w/ appium-support methods

class SelendroidServer {

  constructor (opts) {
    const reqs = ['adb', 'appPackage', 'appActivity', 'tmpDir', 'apk',
                  'host', 'systemPort', 'devicePort'];
    for (let req of reqs) {
      if (!opts || !opts[req]) {
        throw new Error(`Option '${req}' is required!`);
      }
      this[req] = opts[req];
    }

    // new package name for repackaged selendroid server
    this.modServerPkg = `selendroid.${this.appPackage}`;
    // path to the repackaged selendroid server specific to this app
    this.modServerPath = path.resolve(this.tmpDir, `${this.modServerPkg}.apk`);
    this.jwproxy = new JWProxy({host: this.host, port: this.systemPort});
  }

  async prepareModifiedServer () {
    // TODO might have a race condition if we try building this with multiple
    // sessions at the same time. OTOH we probably want to share the mod
    // server...
    let needsUninstall = false;
    if (!(await util.fileExists(this.modServerPath))) {
      await this.buildNewModServer();
      needsUninstall = true;
    }
    await this.checkCerts();
    if (needsUninstall) {
      logger.info("New server was built, uninstalling any instances of it");
      await this.adb.uninstallApk(this.modServerPkg);
    }
  }

  async buildNewModServer () {
    logger.info(`Repackaging selendroid for ${this.appPackage}`);
    let packageTmpDir = path.resolve(this.tmpDir, this.appPackage);
    let newManifestPath = path.resolve(this.tmpDir, 'AndroidManifest.xml');
    logger.info(`Creating new manifest`);
    await util.mkdirp(packageTmpDir);
    await writeFile(newManifestPath, await readFile(SE_MANIFEST_PATH, "utf8"));
    await this.adb.initAapt(); // TODO this should be internal to adb
    await this.adb.compileManifest(newManifestPath, this.modServerPkg,
                                   this.appPackage);
    await this.adb.insertManifest(newManifestPath, SE_APK_PATH,
                                  this.modServerPath);
    logger.info(`Repackaged selendroid ready at ${this.modServerPath}`);
  }

  async checkCerts () {
    let doCheck = async (apk) => {
      let signed = await this.adb.checkApkCert(apk, this.appPackage);
      if (!signed) {
        await this.adb.sign(apk);
      }
    };

    // run checks in parallel
    await B.all([
      doCheck(this.modServerPath),
      doCheck(this.apk)
    ]);
  }

  async startSession (caps) {
    var instrumentWith = `${this.modServerPkg}/` +
                         `io.selendroid.server.ServerInstrumentation`;
    logger.info(`Starting selendroid server with instrumentation: ` +
             `${instrumentWith}`);
    await this.adb.instrument(this.appPackage, this.appActivity, instrumentWith);
    logger.info("Waiting for Selendroid to be online...");
    // wait 20s for Selendroid to be online
    await retryInterval(20, 1000, async () => {
      await this.jwproxy.command('/status', 'GET');
    });
    await this.jwproxy.command('/session', 'POST', {desiredCapabilities: caps});
  }

  async proxyReq (req, res) {
    return this.jwproxy.proxyReqRes(req, res);
  }
}

export { SelendroidServer };
