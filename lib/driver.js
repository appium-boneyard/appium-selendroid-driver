import path from 'path';
import _ from 'lodash';
import ADB from 'appium-adb';
import { BaseDriver } from 'appium-base-driver';
import { serverExists } from './setup';
import { util } from 'appium-support';
import logger from './logger';
import commands from './commands';
import helpers from './helpers';
import desiredCapConstraints from './desired-caps';

// The range of ports we can use on the system for communicating to the
// Selendroid HTTP server on the device
//const SYSTEM_PORT_RANGE = [8200, 8299];

// This is the port that Selendroid listens to on the device. We will forward
// one of the ports above on the system to this port on the device.
//const DEVICE_PORT = 8080;

class SelendroidDriver extends BaseDriver {
  constructor (opts = {}) {
    super();
    if (!opts.tmpDir) {
      throw new Error("opts.tmpDir is required");
    }
    this.desiredCapConstraints = desiredCapConstraints;
    this.opts = opts;
    this.modServerPath = null;
    this.caps = {};
  }

  async createSession (caps, reqCaps) {
    if (!(await serverExists())) {
      throw new Error("Can't start a selendroid session because the server " +
                      "apk doesn't exist. Please run 'npm run-script " +
                      "selendroid' in the appium-selendroid-driver package");
    }
    // TODO add validation on caps
    // TODO handle otherSessionData for multiple sessions
    let sessionId;
    [sessionId] = await super.createSession(caps, reqCaps);
    this.caps = caps;
    Object.assign(this.opts, this.caps);
    return [sessionId, caps];
  }

  get driverData () {
    // TODO fille out resource info here
    return {};
  }

  async startServer () {
    await this.setJavaVersion();
    this.adb = await ADB.createADB(this.opts);
    logger.debug(`Using fast reset? ${this.args.fastReset}`);
    logger.debug("Preparing device for session");
    await this.checkAppPresent();
    await this.checkInternetPermissionForApp();
    await this.prepareEmulator();
    await this.prepareActiveDevice();
    await this.adb.waitForDevice();
    await this.ensureDeviceLocale();
    await this.adb.startLogcat();
    await this.setLaunchInfoFromManifest();
    let modServerPath = path.resolve(this.opts.tmpDir,
      `selendroid.${this.opts.appPackage}.apk`);
    if (!(await util.fileExists(modServerPath))) {
      await this.buildNewModServer(modServerPath);
    }
      //.open({prefix: 'my-test-file', suffix: '.zip'})
    //checkModServerExists,
    //conditionalInsertManifest,
    //this.checkSelendroidCerts.bind(this),
    //checkServerResigned,
    //conditionalUninstallSelendroid,
    //conditionalInstallSelendroid,
    //this.extractStringsSelendroid.bind(this),
    //this.uninstallApp.bind(this),
    //this.installAppForTest.bind(this),
    //this.forwardPort.bind(this),
    //this.initUnicode.bind(this),
    //this.pushSettingsApp.bind(this),
    //this.pushUnlock.bind(this),
    //this.unlock.bind(this),
    //this.pushSelendroid.bind(this),
    //this.waitForServer.bind(this)
  //], function (err) {
    //if (err) return cb(err);
    //async.series([
      //this.createSession.bind(this),
      //this.initAutoWebview.bind(this)
    //], function (err, res) {
      //if (err) return cb(err);
      //// `createSession` returns session id, so send that along
      //cb(null, res[0]);
    //});
  //}.bind(this));
  }
}

for (let [cmd, fn] of _.pairs(commands)) {
  SelendroidDriver.prototype[cmd] = fn;
}

for (let [helper, fn] of _.pairs(helpers)) {
  SelendroidDriver.prototype[helper] = fn;
}

export { SelendroidDriver };
