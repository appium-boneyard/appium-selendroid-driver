import { JWProxy } from 'appium-base-driver';
import { retryInterval } from 'asyncbox';
import logger from './logger';
import path from 'path';
import { fs } from 'appium-support';
import { SE_APK_PATH, SE_MANIFEST_PATH } from './installer';


const REQD_PARAMS = ['adb', 'appPackage', 'appActivity', 'tmpDir', 'apk',
                     'host', 'systemPort', 'devicePort'];

class SelendroidServer {
  constructor (opts = {}) {
    for (let req of REQD_PARAMS) {
      if (!opts || !opts[req]) {
        throw new Error(`Option '${req}' is required!`);
      }
      this[req] = opts[req];
    }

    // new package name for repackaged selendroid server
    this.modServerPkg = `selendroid.${this.appPackage}`;
    // path to the repackaged selendroid server specific to this app
    this.modServerPath = path.resolve(this.tmpDir, `${this.modServerPkg}.apk`);
    this.jwproxy = new JWProxy({server: this.host, port: this.systemPort});
    this.proxyReqRes = this.jwproxy.proxyReqRes.bind(this.jwproxy);
  }

  async prepareModifiedServer () {
    // TODO might have a race condition if we try building this with multiple
    // sessions at the same time. OTOH we probably want to share the mod
    // server...
    let needsUninstall = false;
    if (!(await fs.exists(this.modServerPath))) {
      await this.buildNewModServer();
      needsUninstall = true;
    }
    needsUninstall = await this.checkAndSignCert(this.modServerPath) || needsUninstall;
    if (needsUninstall) {
      logger.info("New server was built, uninstalling any instances of it");
      await this.adb.uninstallApk(this.modServerPkg);
    }
  }

  async installModifiedServer () {
    let installed = await this.adb.isAppInstalled(this.modServerPkg);
    if (!installed) {
      await this.adb.install(this.modServerPath);
    }
  }

  async buildNewModServer () {
    logger.info(`Repackaging selendroid for: '${this.appPackage}'`);
    let packageTmpDir = path.resolve(this.tmpDir, this.appPackage);
    let newManifestPath = path.resolve(this.tmpDir, 'AndroidManifest.xml');
    logger.info(`Creating new manifest: '${newManifestPath}'`);
    await fs.mkdir(packageTmpDir);
    await fs.copyFile(SE_MANIFEST_PATH, newManifestPath);
    await this.adb.initAapt(); // TODO this should be internal to adb
    await this.adb.compileManifest(newManifestPath, this.modServerPkg,
                                   this.appPackage);
    await this.adb.insertManifest(newManifestPath, SE_APK_PATH,
                                  this.modServerPath);
    logger.info(`Repackaged selendroid ready: '${this.modServerPath}'`);
  }

  async checkAndSignCert (apk) {
    let signed = await this.adb.checkApkCert(apk, this.appPackage);
    if (!signed) {
      await this.adb.sign(apk);
    }

    // return whether the apk was signed
    return !signed;
  }

  async startSession (caps) {
    let instrumentWith = `${this.modServerPkg}/` +
                         `io.selendroid.server.ServerInstrumentation`;
    logger.info(`Starting selendroid server with instrumentation: ` +
             `${instrumentWith}`);
    await this.adb.instrument(this.appPackage, this.appActivity, instrumentWith);

    logger.info('Waiting for Selendroid to be online...');
    // wait 20s for Selendroid to be online
    await retryInterval(20, 1000, async () => {
      await this.jwproxy.command('/status', 'GET');
    });
    await this.jwproxy.command('/session', 'POST', {desiredCapabilities: caps});
  }

  async deleteSession () {
    logger.debug('Deleting Selendroid server session');
    // rely on jwproxy's intelligence to know what we're talking about and
    // delete the current session
    try {
      await this.jwproxy.command('/', 'DELETE');
    } catch (err) {
      logger.warn(`Did not get confirmation Selendroid deleteSession worked; ` +
                  `Error was: ${err}`);
    }
  }
}

export default SelendroidServer;
