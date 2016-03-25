"use strict";

var MAX_ATTEMPTS = 200;
var INTERVAL = 1500;
var attempts = 1;

function doInstall () {
  var setupSelendroid;
  var asyncify = require('asyncbox').asyncify;

  // selendroid needs Java. Fail early if it doesn't exist
  var androidHelpers = require('appium-android-driver').androidHelpers;
  asyncify(androidHelpers.getJavaVersion);

  try {
    setupSelendroid = require('appium-selendroid-installer').setupSelendroid;
    // TODO: add --conditional flag for npm install so we don't crash if the build
    // dir doesn't exist
    asyncify(setupSelendroid);
  } catch (err) {
    if (attempts > MAX_ATTEMPTS) {
      console.log("Tried too many times to install selendroid, failing");
      console.log("Original error: " + err.message);
      console.log("Please re-run `install appium-selendroid-installer` manually.");
      throw new Error("Unable to import and run `appium-selendroid-installer`");
    }
    attempts++;
    console.log("Selendroid setup files did not yet exist, waiting...");
    setTimeout(doInstall, INTERVAL);
  }
}

if (require.main === module) {
  doInstall();
}
