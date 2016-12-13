## appium-selendroid-driver

[![NPM version](http://img.shields.io/npm/v/appium-selendroid-driver.svg)](https://npmjs.org/package/appium-selendroid-driver)
[![Downloads](http://img.shields.io/npm/dm/appium-selendroid-driver.svg)](https://npmjs.org/package/appium-selendroid-driver)
[![Dependency Status](https://david-dm.org/appium/appium-selendroid-driver/master.svg)](https://david-dm.org/appium/appium-selendroid-driver/master)
[![devDependency Status](https://david-dm.org/appium/appium-selendroid-driver/master/dev-status.svg)](https://david-dm.org/appium/appium-selendroid-driver/master#info=devDependencies)

[![Build Status](https://api.travis-ci.org/appium/appium-selendroid-driver.png?branch=master)](https://travis-ci.org/appium/appium-selendroid-driver)
[![Coverage Status](https://coveralls.io/repos/appium/appium-selendroid-driver/badge.svg?branch=master)](https://coveralls.io/r/appium/appium-selendroid-driver?branch=master)


This driver is the Appium interface to the [Selendroid](http://selendroid.io/) test automation framework.


### Using with Appium server

From the Appium server it is requested by specifying the desired capability `automationName` of `Selendroid` when starting a session.

Most of the Selenium methods are handled by the Selendroid framework itself. This package simply handles the setting up of the session by instrumenting the application and making sure that both the application and the Selendroid server are signed with the same keys. It then provides a method for proxying through the [appium-jsonwp-proxy](https://github.com/appium/appium-base-driver/blob/master/lib/jsonwp-proxy) to the Selendroid server running on the device.

`proxyReqRes (request, response)`

Some methods, however, are handled locally, if they either don't work in the Selendroid implementation, or they are Appium additions that are not currently supported by Selendroid.

#### Methods not proxied to Selendroid

The following methods are implemented by the `appium-selendroid-driver`, either in full or by appropriately fixing state and then proxying to the Selendroid server.

| Methods                                                                   |
|---------------------------------------------------------------------------|
| `activateIMEEngine (engine)`                                              |
| `availableIMEEngines ()`                                                  |
| `background (seconds)`                                                    |
| `closeApp ()`                                                             |
| `deactivateIMEEngine ()`                                                  |
| `endCoverage (intent, path)`                                              |
| `getActiveIMEEngine ()`                                                   |
| `getContexts ()`                                                          |
| `getCurrentActivity ()`                                                   |
| `getCurrentContext ()`                                                    |
| `getLog (type)`                                                           |
| `getLogTypes ()`                                                          |
| `getNetworkConnection ()`                                                 |
| `getSettings ()`                                                          |
| `getStrings (language, stringFile)`                                       |
| `hideKeyboard (strategy, key, keyCode, keyName)`                          |
| `installApp (appPath)`                                                    |
| `isAppInstalled (bundleId)`                                               |
| `isIMEActivated ()`                                                       |
| `isLocked ()`                                                             |
| `keyevent (keycode, metastate)`                                           |
| `keys (value)`                                                            |
| `launchApp ()`                                                            |
| `lock (seconds)`                                                          |
| `longPressKeyCode (keycode, metastate)`                                   |
| `mobileRotation (x, y, radius, rotation, touchCount, duration, element)`  |
| `mobileShake ()`                                                          |
| `openNotifications ()`                                                    |
| `performMultiAction (actions, elementId)`                                 |
| `pressKeyCode (keycode, metastate)`                                       |
| `pullFile (path)`                                                         |
| `pullFolder (path)`                                                       |
| `pushFile (path, data)`                                                   |
| `receiveAsyncResponse (response)`                                         |
| `removeApp (appId, bundleId)`                                             |
| `replaceValue (value)`                                                    |
| `reset ()`                                                                |
| `setContext (name)`                                                       |
| `setGeoLocation (location)`                                               |
| `setNetworkConnection (type)`                                             |
| `setValue (value)`                                                        |
| `setValueImmediate (value)`                                               |
| `startActivity (appPackage, appActivity)`                                 |
| `toggleData ()`                                                           |
| `toggleFlightMode ()`                                                     |
| `toggleLocationServices ()`                                               |
| `toggleWiFi ()`                                                           |
| `unlock ()`                                                               |
| `updateSettings (settings)`                                               |

### Custom binaries url

To use a mirror of the Selendroid driver binaries use npm config property `selendroid_driver_cdnurl`.
Default is `http://repo1.maven.org/maven2/io/selendroid/selendroid-standalone`.

```bash
npm install appium-selendroid-driver --selendroid_driver_cdnurl=http://repo2.maven.org/maven2/io/selendroid/selendroid-standalone
```

Or add the property into your [`.npmrc`](https://docs.npmjs.com/files/npmrc) file.

```bash
selendroid_driver_cdnurl=http://repo2.maven.org/maven2/io/selendroid/selendroid-standalone
```

Another option is to use PATH variable `SELENDROID_DRIVER_CDNURL`.

```bash
SELENDROID_DRIVER_CDNURL=http://repo2.maven.org/maven2/io/selendroid/selendroid-standalone npm install appium-selendroid-driver
```

### Working on the package

#### Watch

```
gulp watch
```

#### Test

```
gulp once
```
