"use strict";

var fileExists = require('appium-support').util.fileExists;
var asyncify = require('asyncbox').asyncify;
var gulp = require('gulp');
require('../gulpfile.js');

var setupSelendroid;

var transpile = function (cb) {
  gulp.on('task_stop', function () {
    cb();
  });
  gulp.on('task_err', function () {
    console.error('Warning! Gulp transpilation failed:', e.message);
    throw new Error('Gulp transpile failed.', e);
  });
  gulp.start('transpile')
}

// we need to make sure the 'build' directory has been transpiled
// before we can require something from it
fileExists('../build/lib/setup').then(function (exists) {
  if (!exists) {
    transpile(function () {
      setupSelendroid = require('../build/lib/setup').setupSelendroid
      asyncify(setupSelendroid);
    });
  } else {
    setupSelendroid = require('../build/lib/setup').setupSelendroid
    asyncify(setupSelendroid);
  }
});
