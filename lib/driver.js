import _ from 'lodash';
import { BaseDriver } from 'appium-base-driver';
import SelendroidServer from './selendroid';
import { fs } from 'appium-support';
import { serverExists } from './installer';
import { retryInterval } from 'asyncbox';
import logger from './logger';
import commands from './commands';
import { DEFAULT_ADB_PORT } from 'appium-adb';
import * as selendroidHelpers from './helpers';
import { androidHelpers, androidCommands, WEBVIEW_BASE } from 'appium-android-driver';
import desiredCapConstraints from './desired-caps';


let helpers = {};
Object.assign(helpers, selendroidHelpers, androidHelpers);

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
  ['GET', new RegExp('^/session/[^/]+/element/[^/]+/rect')],
  ['GET', new RegExp('^/session/[^/]+/network_connection')],
  ['POST', new RegExp('^/session/[^/]+/network_connection')],
  ['POST', new RegExp('^/session/[^/]+/ime')],
  ['GET', new RegExp('^/session/[^/]+/ime')],
  ['POST', new RegExp('^/session/[^/]+/keys')],
  ['POST', new RegExp('^/session/[^/]+/touch/multi/perform')],
];

const APP_EXTENSION = '.apk';


class SelendroidDriver extends BaseDriver {
  constructor (opts = {}, shouldValidateCaps = true) {
    // `shell` overwrites adb.shell, so remove
    delete opts.shell;

    super(opts, shouldValidateCaps);

    this.desiredCapConstraints = desiredCapConstraints;
    this.selendroid = null;
    this.jwpProxyActive = false;
    this.defaultIME = null;
    this.jwpProxyAvoid = NO_PROXY;
    this.apkStrings = {}; // map of language -> strings obj

    // handle webview mechanics from AndroidDriver
    this.chromedriver = null;
    this.sessionChromedrivers = {};

    this.opts.systemPort = opts.selendroidPort || SYSTEM_PORT_RANGE[0];
    this.opts.adbPort = opts.adbPort || DEFAULT_ADB_PORT;
  }

  async createSession (caps) {
    try {
      if (!(await serverExists())) {
        throw new Error('Cannot start a selendroid session because the server ' +
                        'apk does not exist. Please run `npm run-script ' +
                        'selendroid` in the appium-selendroid-driver package');
      }

      // TODO handle otherSessionData for multiple sessions
      let sessionId;
      [sessionId] = await super.createSession(caps);
      this.curContext = this.defaultContextName();
      // fail very early if the app doesn't actually exist, since selendroid
      // (unlike the android driver) can't run a pre-installed app based
      // only on package name. It has to be an actual apk
      this.opts.app = await this.helpers.configureApp(this.opts.app, APP_EXTENSION);
      await this.checkAppPresent();
      this.opts.systemPort = this.opts.selendroidPort || SYSTEM_PORT_RANGE[0];
      this.opts.adbPort = this.opts.adbPort || DEFAULT_ADB_PORT;
      await this.startSelendroidSession();
      return [sessionId, caps];
    } catch (e) {
      await this.deleteSession();
      throw e;
    }
  }

  validateDesiredCaps (caps) {
    // check with the base class, and return if it fails
    let res = super.validateDesiredCaps(caps);
    if (!res) return res; // eslint-disable-line curly

    if (this.opts.reboot) {
      this.setAvdFromCapabilities(caps);
    }
  }

  setAvdFromCapabilities (caps) {
    if (this.opts.avd) {
      logger.info('avd name defined, ignoring device name and platform version');
    } else {
      if (!caps.deviceName) {
        logger.errorAndThrow('avd or deviceName should be specified when reboot option is enabled');
      }
      if (!caps.platformVersion) {
        logger.errorAndThrow('avd or platformVersion should be specified when reboot option is enabled');
      }
      let avdDevice = caps.deviceName.replace(/[^a-zA-Z0-9_.]/g, "-");
      this.opts.avd = `${avdDevice}__${caps.platformVersion}`;
    }
  }

  get driverData () {
    // TODO fille out resource info here
    return {};
  }

  isEmulator () {
    return !!this.opts.avd;
  }

  async startSelendroidSession () {
    if (!this.opts.javaVersion) {
      this.opts.javaVersion = await helpers.getJavaVersion();
    }

    // get device udid for this session
    let {udid, emPort} = await helpers.getDeviceInfoFromCaps(this.opts);
    this.opts.udid = udid;
    this.opts.emPort = emPort;

    // now that we know our java version and device info, we can create our
    // ADB instance
    this.adb = await androidHelpers.createADB(this.opts.javaVersion,
        this.opts.udid, this.opts.emPort, this.opts.adbPort);
    // fail very early if the user's app doesn't have the appropriate perms
    // for selendroid automation
    await helpers.ensureInternetPermissionForApp(this.adb, this.opts.app);
    // get appPackage et al from manifest if necessary
    let appInfo = await helpers.getLaunchInfo(this.adb, this.opts);
    // and get it onto our 'opts' object so we use it from now on
    Object.assign(this.opts, appInfo);
    // set up the modified selendroid server etc
    await this.initSelendroidServer();
    // start an avd, set the language/locale, pick an emulator, etc...
    // TODO with multiple devices we'll need to parameterize this
    await helpers.initDevice(this.adb, this.opts);
    // Further prepare the device by forwarding the Selendroid port
    await this.adb.forwardPort(this.opts.systemPort, DEVICE_PORT);
    // prepare our actual AUT, get it on the device, etc...
    await this.initAUT();
    // unlock the device to prepare it for testing
    await helpers.unlock(this, this.adb, this.caps);
    // launch selendroid and wait till its online and we have a session
    await this.selendroid.startSession(this.caps);
    // rescue selendroid if it fails to start our AUT
    await this.ensureAppStarts();
    // if we want to immediately get into a webview, set our context
    // appropriately
    if (this.opts.autoWebview) {
      await retryInterval(20, this.opts.autoWebviewTimeout || 2000, async () => {
        await this.setContext(this.defaultWebviewName());
      });
    }
    // now that everything has started successfully, turn on proxying so all
    // subsequent session requests go straight to/from selendroid
    this.jwpProxyActive = true;
  }

  async initSelendroidServer () {
    // now that we have package and activity, we can create an instance of
    // selendroid with the appropriate data
    this.selendroid = new SelendroidServer({
      host: this.opts.host || 'localhost',
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
    logger.debug('Initializing application under test');
    // set the localized strings for the current language from the apk
    // TODO: incorporate changes from appium#5308 which fix a race cond-
    // ition bug in old appium and need to be replicated here
    this.apkStrings[this.opts.language] = await helpers.pushStrings(
        this.opts.language, this.adb, this.opts);
    if (!this.opts.skipUninstall) {
      await this.adb.uninstallApk(this.opts.appPackage);
    }
    if (!this.opts.noSign) {
      let signed = await this.adb.checkApkCert(this.opts.app, this.opts.appPackage);
      if (!signed) {
        logger.debug('Application not signed. Signing.');
        await this.adb.sign(this.opts.app, this.opts.appPackage);
      }
    }
    await helpers.installApk(this.adb, this.opts);
    // get Selendroid on the device too
    await this.selendroid.installModifiedServer();
  }

  async ensureAppStarts () {
    // make sure we have an activity and package to wait for
    let appWaitPackage = this.opts.appWaitPackage || this.opts.appPackage;
    let appWaitActivity = this.opts.appWaitActivity || this.opts.appActivity;
    try {
      // wait for up to 5s for selendroid to have started the app after it is
      // online
      await this.adb.waitForActivity(appWaitPackage, appWaitActivity, 5000);
    } catch (e) {
      logger.info(`Selendroid did not start the activity we were waiting for, ` +
                  `'${appWaitPackage}/${appWaitActivity}'. ` +
                  `Starting it ourselves`);
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
    logger.debug('Deleting Selendroid session');
    if (this.selendroid) {
      if (this.jwpProxyActive) {
        await this.selendroid.deleteSession();
      }
      this.selendroid = null;
    }
    this.jwpProxyActive = false;

    if (this.adb) {
      if (this.opts.unicodeKeyboard && this.opts.resetKeyboard &&
          this.defaultIME) {
        logger.debug(`Resetting IME to '${this.defaultIME}'`);
        await this.adb.setIME(this.defaultIME);
      }
      await this.adb.forceStop(this.opts.appPackage);
      await this.adb.stopLogcat();
      if (this.opts.reboot) {
        let avdName = this.opts.avd.replace('@', '');
        logger.debug(`closing emulator '${avdName}'`);
        await this.adb.killEmulator(avdName);
      }
    }
    await super.deleteSession();
  }

  async checkAppPresent () {
    logger.debug('Checking whether app is actually present');
    if (!(await fs.exists(this.opts.app))) {
      logger.errorAndThrow(`Could not find app apk at '${this.opts.app}'`);
    }
  }

  defaultWebviewName () {
    return `${WEBVIEW_BASE}0`;
  }

  proxyActive (sessionId) {
    super.proxyActive(sessionId);

    // we always have an active proxy to the selendroid server
    return true;
  }

  getProxyAvoidList (sessionId) {
    super.getProxyAvoidList(sessionId);

    return this.jwpProxyAvoid;
  }

  canProxy (sessionId) {
    super.canProxy(sessionId);

    // we can always proxy to the selendroid server
    return true;
  }
}

// first add the android-driver commands which we will fall back to
for (let [cmd, fn] of _.toPairs(androidCommands)) {
  // we do some different/special things with these methods
  if (!_.includes(['defaultWebviewName'], cmd)) {
    SelendroidDriver.prototype[cmd] = fn;
  }
}

// then overwrite with any selendroid-specific commands
for (let [cmd, fn] of _.toPairs(commands)) {
  SelendroidDriver.prototype[cmd] = fn;
}

export { SelendroidDriver, DEVICE_PORT };
export default SelendroidDriver;
