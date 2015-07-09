import _ from 'lodash';
import path from 'path';
import ADB from 'appium-adb';
import { BaseDriver } from 'appium-base-driver';
import { SelendroidServer } from './selendroid';
import { serverExists } from './setup';
import { util } from 'appium-support';
import logger from './logger';
import commands from './commands';
import * as helpers from './helpers';
import desiredCapConstraints from './desired-caps';

// The range of ports we can use on the system for communicating to the
// Selendroid HTTP server on the device
const SYSTEM_PORT_RANGE = [8200, 8299];

// This is the port that Selendroid listens to on the device. We will forward
// one of the ports above on the system to this port on the device.
const DEVICE_PORT = 8080;

// This is a set of methods and paths that we never want to proxy to Selendroid
const NO_PROXY = [
  ['GET', new RegExp('^/session/[^/]+/log/types$')],
  ['POST', new RegExp('^/session/[^/]+/log')],
  ['POST', new RegExp('^/session/[^/]+/location')],
  ['POST', new RegExp('^/session/[^/]+/appium')],
  ['GET', new RegExp('^/session/[^/]+/appium')],
  ['POST', new RegExp('^/session/[^/]+/context')],
  ['GET', new RegExp('^/session/[^/]+/context')],
  ['GET', new RegExp('^/session/[^/]+/contexts')],
  ['POST', new RegExp('^/session/[^/]+/element/[^/]+/value')],
  ['GET', new RegExp('^/session/[^/]+/network_connection')],
  ['POST', new RegExp('^/session/[^/]+/network_connection')],
  ['POST', new RegExp('^/session/[^/]+/ime')],
  ['GET', new RegExp('^/session/[^/]+/ime')],
  ['POST', new RegExp('^/session/[^/]+/keys')],
];


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
    this.jwpProxyActive = false;
    this.jwpProxyAvoid = NO_PROXY;
    this.apkStrings = {}; // map of language -> strings obj
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
    if (!this.opts.javaVersion) {
      this.opts.javaVersion = await helpers.setJavaVersion();
    }
    this.adb = await ADB.createADB(this.opts);
    await this.checkAppPresent();
    await helpers.ensureInternetPermissionForApp(this.adb, this.opts.app);
    // get appPackage et al from manifest if necessary
    Object.assign(this.opts,
                  await helpers.getLaunchInfoFromManifest(this.adb, this.opts));

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
    this.proxyReqRes = this.selendroid.proxyReqRes.bind(this.selendroid);
    // let selendroid repackage itself for our AUT
    await this.selendroid.prepareModifiedServer();

    // go through typical android startup flow stuff
    if (this.opts.avd !== null) {
      await helpers.prepareEmulator(this.adb, this.opts);
    }
    let [deviceId, emPort] = await helpers.getActiveDevice(this.adb,
                                                           this.opts.udid);
    this.adb.setDeviceId(deviceId);
    if (emPort) {
      this.adb.setEmulatorPort(emPort);
    }
    await this.adb.waitForDevice();
    await helpers.ensureDeviceLocale(this.adb, this.opts.language,
                                     this.opts.locale);
    await this.adb.startLogcat();
    // set the localized strings for the current language from the apk
    let stringsTmpDir = path.resolve(this.opts.tmpDir, this.opts.appPackage);
    this.apkStrings[this.opts.language] = await this.adb.extractStringsFromApk(
        this.opts.language, this.opts.app, stringsTmpDir);
    //this.uninstallApp.bind(this),
    //this.installAppForTest.bind(this),
    //this.forwardPort.bind(this),
    //this.defaultIME = await this.initUnicode();
    //this.pushSettingsApp.bind(this),
    //this.pushUnlock.bind(this),
    //this.unlock.bind(this),

    await this.selendroid.startSession();

    //this.waitForActivity
    //this.initAutoWebview.bind(this)

    this.jwpProxyActive = true;
  }

  async deleteSession () {
    this.jwpProxyActive = false;
    if (this.opts.unicodeKeyboard && this.opts.resetKeyboard && this.defaultIME) {
      logger.debug(`Resetting IME to ${this.defaultIME}`);
      await this.adb.setIME(this.defaultIME);
    }
    await this.selendroid.deleteSession();
    await this.adb.forceStop(this.opts.appPackage);
    await this.adb.stopLogcat();
    await super.deleteSession();
  }

  // TODO this should probably be part of BaseDriver
   async checkAppPresent () {
    if (this.opts.app === null) {
      logger.debug("Not checking whether app is present since we are assuming " +
                   "it's already on the device");
    } else {
      logger.debug("Checking whether app is actually present");
      if (!(await util.fileExists(this.opts.app))) {
        logger.errorAndThrow(`Could not find app apk at ${this.opts.app}`);
      }
    }
  }
}

for (let [cmd, fn] of _.pairs(commands)) {
  SelendroidDriver.prototype[cmd] = fn;
}

export { SelendroidDriver };
