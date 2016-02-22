"use strict";

var MAX_ATTEMPTS = 20;
var INTERVAL = 1500;
var attempts = 1;

function doInstall () {
  var setupSelendroid, asyncify;
  try {
    setupSelendroid = require('appium-selendroid-installer').setupSelendroid;
    asyncify = require('asyncbox').asyncify;
    // TODO: add --conditional flag for npm install so we don't crash if the build
    // dir doesn't exist
    asyncify(setupSelendroid);
  } catch (err) {
    if (attempts > MAX_ATTEMPTS) {
      console.log("Tried too many times to install selendroid, failing");
      throw err;
    }
    attempts++;
    console.log("Selendroid setup files did not yet exist, waiting...");
    setTimeout(doInstall, INTERVAL);
  }
}

if (require.main === module) {
  doInstall();
}
