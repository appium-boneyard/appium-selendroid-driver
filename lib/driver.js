import _ from 'lodash';
import ADB from 'appium-adb';
import { BaseDriver } from 'appium-base-driver';
import { SelendroidServer } from './selendroid';
import { serverExists } from './setup';
//import logger from './logger';
import commands from './commands';
import helpers from './helpers';
import desiredCapConstraints from './desired-caps';

// The range of ports we can use on the system for communicating to the
// Selendroid HTTP server on the device
const SYSTEM_PORT_RANGE = [8200, 8299];

// This is the port that Selendroid listens to on the device. We will forward
// one of the ports above on the system to this port on the device.
const DEVICE_PORT = 8080;

class SelendroidDriver extends BaseDriver {
  constructor (opts = {}) {
    super();
    if (!opts.tmpDir) {
      throw new Error("opts.tmpDir is required");
    }
    this.desiredCapConstraints = desiredCapConstraints;
    this.opts = opts;
    this.selendroid = null;
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
    // merge caps onto opts so we don't need to worry about what's what
    Object.assign(this.opts, this.caps);
    await this.startSelendroidSession();
    return [sessionId, caps];
  }

  get driverData () {
    // TODO fille out resource info here
    return {};
  }

  async startSelendroidSession () {
    await this.setJavaVersion();
    this.adb = await ADB.createADB(this.opts);
    await this.checkAppPresent();
    await this.checkInternetPermissionForApp();
    await this.setLaunchInfoFromManifest();

    // now that we have package and activity, we can create an instance of
    // selendroid with the appropriate data
    let systemPort = SYSTEM_PORT_RANGE[0];
    let host = 'localhost';
    this.selendroid = new SelendroidServer({
      host,
      systemPort,
      devicePort: DEVICE_PORT,
      adb: this.adb,
      apk: this.opts.app,
      tmpDir: this.opts.tmpDir,
      appPackage: this.opts.appPackage,
      appActivity: this.opts.appActivity,
    });
    // let selendroid repackage itself for our AUT
    await this.selendroid.prepareModifiedServer();

    // go through typical android startup flow stuff
    await this.prepareEmulator();
    await this.prepareActiveDevice();
    await this.adb.waitForDevice();
    await this.ensureDeviceLocale();
    await this.adb.startLogcat();

    //this.extractStringsSelendroid.bind(this),
    //this.uninstallApp.bind(this),
    //this.installAppForTest.bind(this),
    //this.forwardPort.bind(this),
    //this.initUnicode.bind(this),
    //this.pushSettingsApp.bind(this),
    //this.pushUnlock.bind(this),
    //this.unlock.bind(this),

    await this.selendroid.startSession();

    //this.waitForActivity
    //this.initAutoWebview.bind(this)
  }
}

for (let [cmd, fn] of _.pairs(commands)) {
  SelendroidDriver.prototype[cmd] = fn;
}

for (let [helper, fn] of _.pairs(helpers)) {
  SelendroidDriver.prototype[helper] = fn;
}

export { SelendroidDriver };
