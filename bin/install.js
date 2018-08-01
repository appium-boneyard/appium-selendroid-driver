/* eslint-disable no-console */
"use strict";

const exec = require('child_process').exec;
const path = require('path');
const log = require('fancy-log');


const MAX_ATTEMPTS = 200;
const INTERVAL = 1500;
let attempts = 1;
let attemptedToBuild = false;

function doInstall () {
  let setupSelendroid;

  // selendroid needs Java. Fail early if it doesn't exist
  const androidHelpers = require('appium-android-driver').androidHelpers;
  androidHelpers.getJavaVersion(false).then(function (version) { // eslint-disable-line promise/prefer-await-to-then
    log(`Java version ${version} found`);
    let onErr = function (err) {
      let codeNotBuilt = err.message.indexOf('Cannot find module') !== -1;
      if (attempts > MAX_ATTEMPTS) {
        log('Tried too many times to install selendroid, failing');
        log(`Original error: ${err.message}`);
        throw new Error('Unable to import and run the installer. ' +
                        'If you are running from source, run `gulp transpile` ' +
                        'and then re-run `npm install`');
      }
      attempts++;
      if (codeNotBuilt && !attemptedToBuild) {
        attemptedToBuild = true;
        log('Attempting to transpile setup code...');
        exec('npm run transpile', {cwd: path.resolve(__dirname, '..')}, function (err) { // eslint-disable-line promise/prefer-await-to-callbacks
          if (err) {
            log.warn(`Setup code could not be transpiled: ${err.message}`);
          } else {
            log('Setup code successfully transpiled');
          }
          setTimeout(doInstall, INTERVAL);
        });
      } else {
        log('Selendroid setup files did not yet exist, waiting...');
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
    log.error('Could not find JAVA, skipping Selendroid install.');
  });

}

if (require.main === module) {
  doInstall();
}
