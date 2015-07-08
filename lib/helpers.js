import _ from 'lodash';
import { exec } from 'teen_process';
import { util } from 'appium-support';
import logger from './logger';

let helpers = {};

// TODO most of these will be moved to the android driver or some more common
// repo
helpers.parseJavaVersion = function (stderr) {
  let lines = stderr.split("\n");
  for (let line of lines) {
    if (new RegExp("java version").test(line)) {
      return line.split(" ")[2].replace(/"/g, '');
    }
  }
  return null;
};

helpers.setJavaVersion = async function () {
  if (this.opts.javaVersion) return;
  logger.debug("Getting Java version");

  let {stderr} = await exec('java', ['-version']);
  let javaVer = this.parseJavaVersion(stderr);
  if (javaVer === null) {
    throw new Error("Could not get the Java version. Is Java installed?");
  }
  logger.info(`Java version is: ${javaVer}`);
  this.opts.javaVersion = javaVer;
};

helpers.checkAppPesent = async function () {
  if (this.opts.app === null) {
    logger.debug("Not checking whether app is present since we are assuming " +
                 "it's already on the device");
  } else {
    logger.debug("Checking whether app is actually present");
    if (!(await util.fileExists(this.opts.app))) {
      logger.errorAndThrow(`Could not find app apk at ${this.opts.app}`);
    }
  }
};

helpers.prepareEmulator = async function () {
  if (this.opts.avd !== null) {
    let avdName = this.opts.avd.replace('@', '');
    let runningAVD = await this.adb.getRunningAVD(avdName);
    if (runningAVD !== null) {
      logger.debug("Not launching AVD because it is already running.");
      return;
    }
    await this.adb.launchAVD(this.opts.avd, this.opts.avdArgs,
                             this.opts.language, this.opts.locale,
                             this.opts.avdLaunchTimeout,
                             this.opts.avdReadyTimeout);
    return;
  }
};

helpers.ensureDeviceLocale = async function () {
  let haveLanguage = this.opts.language && typeof this.opts.language === "string";
  let haveCountry = this.opts.locale && typeof this.opts.locale === "string";
  if (!haveLanguage && !haveCountry) {
    return;
  }
  let language = await this.adb.getDeviceLanguage();
  let country = await this.adb.getDeviceCountry();
  let changed = false;
  if (haveLanguage && this.opts.language !== language) {
    await this.adb.setDeviceLanguage(this.opts.language);
    changed = true;
  }
  if (haveCountry && this.opts.locale !== country) {
    await this.adb.setDeviceCountry(this.opts.locale);
    changed = true;
  }
  if (changed) {
    await this.adb.reboot();
  }
};

helpers.prepareActiveDevice = async function () {
  if (this.adb.curDeviceId) {
    // deviceId is already set
    return;
  }
  logger.info('Retrieving device list');
  let devices = await this.adb.getDevicesWithRetry();
  let deviceId = null;
  if (this.opts.udid) {
    if (!_.contains(_.pluck(devices, 'udid'), this.opts.udid)) {
      logger.errorAndThrow(`Device ${this.opts.udid} was not in the list ` +
                           `of connected devices`);
    }
    deviceId = this.opts.udid;
  } else {
    deviceId = devices[0].udid;
    let emPort = this.adb.getPortFromEmulatorString(deviceId);
    this.adb.setEmulatorPort(emPort);
  }
  logger.info(`Found device: ${deviceId}`);
  this.adb.setDeviceId(deviceId);
};

helpers.checkInternetPermissionForApp = async function () {
  let has = await this.adb.hasInternetPermissionFromManifest(this.opts.app);
  if (has) {
    return;
  }
  let msg = "Your apk does not have INTERNET permissions. Selendroid needs " +
            "the internet permission to proceed. Please check if you have " +
            "<uses-permission android:name=\"android.**permission.INTERNET" +
            "\"/> in your AndroidManifest.xml";
  throw new Error(msg);
};

helpers.setLaunchInfoFromManifest = async function () {
  if (!this.opts.app) {
    logger.warn("No app sent in, not parsing package/activity");
    return;
  }
  if (this.opts.appPackage && this.opts.appActivity) {
    return;
  }

  logger.debug("Parsing package and activity from app manifest");
  let {apkPackage, apkActivity} =
    this.adb.packageAndLaunchActivityFromManifest(this.opts.app);
  if (apkPackage && !this.opts.appPackage) {
    this.opts.appPackage = apkPackage;
  }
  if (!this.opts.appWaitPackage) {
    this.opts.appWaitPackage = this.opts.appPackage;
  }
  if (apkActivity && !this.opts.appActivity) {
    this.opts.appActivity = apkActivity;
  }
  if (!this.opts.appWaitActivity) {
    this.opts.appWaitActivity = this.opts.appActivity;
  }
  logger.debug(`Parsed package and activity are: ${apkPackage}/${apkActivity}`);
};

export default helpers;
