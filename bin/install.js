/* eslint-disable no-console */
"use strict";

var exec = require("child_process").exec;
var path = require("path");

var MAX_ATTEMPTS = 200;
var INTERVAL = 1500;
var attempts = 1;
var attemptedToBuild = false;

function doInstall () {
  var setupSelendroid;
  var asyncify = require('asyncbox').asyncify;

  // selendroid needs Java. Fail early if it doesn't exist
  var androidHelpers = require('appium-android-driver').androidHelpers;
  asyncify(androidHelpers.getJavaVersion);

  try {
    setupSelendroid = require('../build/lib/installer').setupSelendroid;
    // TODO: add --conditional flag for npm install so we don't crash if the build
    // dir doesn't exist
    asyncify(setupSelendroid);
  } catch (err) {
    var codeNotBuilt = err.message.indexOf('Cannot find module') !== -1;
    if (attempts > MAX_ATTEMPTS) {
      console.log("Tried too many times to install selendroid, failing");
      console.log("Original error: " + err.message);
      throw new Error("Unable to import and run the installer. " +
                      "If you're running from source, run `gulp transpile` " +
                      "and then re-run `npm install`");
    }
    attempts++;
    if (codeNotBuilt && !attemptedToBuild) {
      attemptedToBuild = true;
      console.log("Attempting to transpile setup code...");
      exec("gulp transpile", {cwd: path.resolve(__dirname, "..")}, function (err) {
        if (err) {
          console.warn("Setup code could not be transpiled: " + err.message);
          return;
        }
        console.log("Setup code successfully transpiled");
      });
    }
    console.log("Selendroid setup files did not yet exist, waiting...");
    setTimeout(doInstall, INTERVAL);
  }
}

if (require.main === module) {
  doInstall();
}
