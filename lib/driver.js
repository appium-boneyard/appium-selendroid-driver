import _ from 'lodash';
import path from 'path';
import ADB from 'appium-adb';
import { BaseDriver } from 'appium-base-driver';
import { SelendroidServer } from './selendroid';
import { fs } from 'appium-support';
import { serverExists } from 'appium-selendroid-installer';
import { retry } from 'asyncbox';
import logger from './logger';
import commands from './commands';
import * as selendroidHelpers from './helpers';
import { androidHelpers } from 'appium-android-driver';
import desiredCapConstraints from './desired-caps';

const helpers = _.merge(selendroidHelpers, androidHelpers);

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
  ['POST', new RegExp('^/session/[^/]+/touch/multi/perform')],
];

const WEBVIEW_BASE = "WEBVIEW_";


class SelendroidDriver extends BaseDriver {
  constructor (opts = {}, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);

    this.desiredCapConstraints = desiredCapConstraints;
    this.selendroid = null;
    this.jwpProxyActive = false;
    this.defaultIME = null;
    this.jwpProxyAvoid = NO_PROXY;
    this.apkStrings = {}; // map of language -> strings obj
  }

  async createSession (caps) {
    if (!(await serverExists())) {
      throw new Error("Can't start a selendroid session because the server " +
                      "apk doesn't exist. Please run 'npm run-script " +
                      "selendroid' in the appium-selendroid-driver package");
    }
    // TODO add validation on caps
    // we need to require an app, it doesn't make sense to run selendroid
    // without an app since we instrument

    // TODO handle otherSessionData for multiple sessions
    let sessionId;
    [sessionId] = await super.createSession(caps);
    // fail very early if the app doesn't actually exist, since selendroid
    // (unlike the android driver) can't run a pre-installed app based
    // only on package name. It has to be an actual apk
    await this.checkAppPresent();
    this.opts.systemPort = this.opts.systemPort || SYSTEM_PORT_RANGE[0];
    await this.startSelendroidSession();
    return [sessionId, caps];
  }

  get driverData () {
    // TODO fille out resource info here
    return {};
  }

  async startSelendroidSession () {
    if (!this.opts.javaVersion) {
      this.opts.javaVersion = await helpers.getJavaVersion();
    }
    // now that we know our java version, we can create our ADB instance
    this.adb = await ADB.createADB(this.opts);
    // fail very early if the user's app doesn't have the appropriate perms
    // for selendroid automation
    await helpers.ensureInternetPermissionForApp(this.adb, this.opts.app);
    // get appPackage et al from manifest if necessary
    let appInfo = await helpers.getLaunchInfoFromManifest(this.adb, this.opts);
    // and get it onto our 'opts' object so we use it from now on
    Object.assign(this.opts, appInfo);
    // set up the modified selendroid server etc
    await this.initSelendroidServer();
    // start an avd, set the language/locale, pick an emulator, etc...
    // TODO with multiple devices we'll need to parameterize this
    await this.initDevice();
    // prepare our actual AUT, get it on the device, etc...
    await this.initAUT();
    // unlock the device to prepare it for testing
    await helpers.unlock(this.adb);
    // launch selendroid and wait till its online and we have a session
    await this.selendroid.startSession();
    // rescue selendroid if it fails to start our AUT
    await this.ensureAppStarts();
    // if we want to immediately get into a webview, set our context
    // appropriately
    if (this.opts.autoWebview) {
      await retry(20, this.opts.autoWebviewTimeout || 2000, async () => {
        await this.setContext(this.defaultWebviewName);
      });
    }
    // now that everything has started successfully, turn on proxying so all
    // subsequent session requests go straight to/from selendroid
    this.jwpProxyActive = true;
  }

  async initDevice () {
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
    await this.adb.forwardPort(this.opts.systemPort, DEVICE_PORT);
    if (this.opts.unicodeKeyboard) {
      this.defaultIME = await helpers.initUnicode(this.adb);
    }
    await helpers.pushSettings(this.adb);
    await helpers.pushUnlock(this.adb);
  }

  async initSelendroidServer () {
    // now that we have package and activity, we can create an instance of
    // selendroid with the appropriate data
    this.selendroid = new SelendroidServer({
      host: this.opts.host,
      systemPort: this.opts.systemPort,
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
  }

  async initAUT () {
    if (this.opts.app) {
      // set the localized strings for the current language from the apk
      // TODO: incorporate changes from appium#5308 which fix a race cond-
      // ition bug in old appium and need to be replicated here
      let stringsTmpDir = path.resolve(this.opts.tmpDir, this.opts.appPackage);
      this.apkStrings[this.opts.language] = await this.adb.extractStringsFromApk(
          this.opts.language, this.opts.app, stringsTmpDir);
      if (!this.opts.skipUninstall) {
        await this.adb.uninstallApk(this.opts.appPackage);
      }
      if (!this.opts.noSign) {
        await this.adb.checkAndSignApk(this.opts.app, this.opts.appPackage);
      }
      await helpers.installApkRemotely(this.adb, this.opts.app,
                                       this.opts.appPackage,
                                       this.opts.fastReset);
    }

  }

  async ensureAppStarts () {
    try {
      // wait for up to 5s for selendroid to have started the app after its
      // online
      await this.adb.waitForActivity(this.opts.appWaitPackage,
                                     this.opts.appWaitActivity, 5000);
    } catch (e) {
      logger.info("Selendroid did not start the activity we're waiting for, " +
                  "starting it ourselves");
      await this.adb.startApp({
        pkg: this.opts.appPackage,
        activity: this.opts.appActivity,
        action: this.opts.intentAction,
        category: this.opts.intentCategory,
        flags: this.opts.intentFlags,
        waitPkg: this.opts.appWaitPackage,
        waitActivity: this.opts.appWaitActivity,
        optionalIntentArguments: this.opts.optionalIntentArguments,
        stopApp: !this.opts.dontStopAppOnReset,
        retry: false
      });
    }
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

  async checkAppPresent () {
    logger.debug("Checking whether app is actually present");
    if (!(await fs.exists(this.opts.app))) {
      logger.errorAndThrow(`Could not find app apk at ${this.opts.app}`);
    }
  }

  get defaultWebviewName () {
    return WEBVIEW_BASE + this.opts.appPackage;
  }

}

for (let [cmd, fn] of _.pairs(commands)) {
  SelendroidDriver.prototype[cmd] = fn;
}

export { SelendroidDriver };
