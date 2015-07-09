import _ from 'lodash';
import { exec } from 'teen_process';
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
  logger.debug("Getting Java version");

  let {stderr} = await exec('java', ['-version']);
  let javaVer = helpers.parseJavaVersion(stderr);
  if (javaVer === null) {
    throw new Error("Could not get the Java version. Is Java installed?");
  }
  logger.info(`Java version is: ${javaVer}`);
  return javaVer;
};

helpers.prepareEmulator = async function (adb, opts) {
  let {avd, avdArgs, language, locale, avdLaunchTimeout,
       avdReadyTimeout} = opts;
  let avdName = avd.replace('@', '');
  let runningAVD = await adb.getRunningAVD(avdName);
  if (runningAVD !== null) {
    logger.debug("Not launching AVD because it is already running.");
    return;
  }
  await adb.launchAVD(avd, avdArgs, language, locale, avdLaunchTimeout,
                      avdReadyTimeout);
};

helpers.ensureDeviceLocale = async function (adb, language, locale) {
  let haveLanguage = language && typeof language === "string";
  let haveCountry = locale && typeof locale === "string";
  if (!haveLanguage && !haveCountry) {
    return;
  }
  let curLanguage = await adb.getDeviceLanguage();
  let country = await adb.getDeviceCountry();
  let changed = false;
  if (haveLanguage && language !== curLanguage) {
    await adb.setDeviceLanguage(language);
    changed = true;
  }
  if (haveCountry && locale !== country) {
    await adb.setDeviceCountry(locale);
    changed = true;
  }
  if (changed) {
    await adb.reboot();
  }
};

helpers.getActiveDevice = async function (adb, udid) {
  logger.info('Retrieving device list');
  let devices = await adb.getDevicesWithRetry();
  let deviceId = null, emPort = null;
  if (udid) {
    if (!_.contains(_.pluck(devices, 'udid'), udid)) {
      logger.errorAndThrow(`Device ${udid} was not in the list ` +
                           `of connected devices`);
    }
    deviceId = udid;
  } else {
    deviceId = devices[0].udid;
    emPort = adb.getPortFromEmulatorString(deviceId);
  }
  logger.info(`Found device: ${deviceId}`);
  return [deviceId, emPort];
};

helpers.ensureInternetPermissionForApp = async function (adb, app) {
  let has = await adb.hasInternetPermissionFromManifest(app);
  if (has) {
    return;
  }
  let msg = "Your apk does not have INTERNET permissions. Selendroid needs " +
            "the internet permission to proceed. Please check if you have " +
            "<uses-permission android:name=\"android.**permission.INTERNET" +
            "\"/> in your AndroidManifest.xml";
  throw new Error(msg);
};

helpers.getLaunchInfoFromManifest = async function (adb, opts) {
  let {app, appPackage, appActivity, appWaitPackage, appWaitActivity} = opts;
  if (!app) {
    logger.warn("No app sent in, not parsing package/activity");
    return;
  }
  if (appPackage && appActivity) {
    return;
  }

  logger.debug("Parsing package and activity from app manifest");
  let {apkPackage, apkActivity} =
    adb.packageAndLaunchActivityFromManifest(app);
  if (apkPackage && !appPackage) {
    appPackage = apkPackage;
  }
  if (!appWaitPackage) {
    appWaitPackage = appPackage;
  }
  if (apkActivity && !appActivity) {
    appActivity = apkActivity;
  }
  if (!appWaitActivity) {
    appWaitActivity = appActivity;
  }
  logger.debug(`Parsed package and activity are: ${apkPackage}/${apkActivity}`);
  return {appPackage, appWaitPackage, appActivity, appWaitActivity};
};

export default helpers;
