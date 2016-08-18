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

  // selendroid needs Java. Fail early if it doesn't exist
  var androidHelpers = require('appium-android-driver').androidHelpers;
  androidHelpers.getJavaVersion().then(function () {
    var onErr = function (err) {
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
        exec("npm run transpile", {cwd: path.resolve(__dirname, "..")}, function (err) {
          if (err) {
            console.warn("Setup code could not be transpiled: " + err.message);
          } else {
            console.log("Setup code successfully transpiled");
          }
          setTimeout(doInstall, INTERVAL);
        });
      } else {
        console.log("Selendroid setup files did not yet exist, waiting...");
        setTimeout(doInstall, INTERVAL);
      }
    };

    try {
      setupSelendroid = require('../build/lib/installer').setupSelendroid;
      setupSelendroid().catch(onErr);
    } catch (err) {
      onErr(err);
    }
  }).catch(function () {
    console.error("Could not find JAVA, skipping Selendroid install.");
  });

}

if (require.main === module) {
  doInstall();
}
