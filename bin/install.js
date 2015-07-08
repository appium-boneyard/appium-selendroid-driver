"use strict";

var setupSelendroid = require('../build/lib/setup').setupSelendroid
  , asyncify = require('asyncbox').asyncify;

// TODO: add --conditional flag for npm install so we don't crash if the build
// dir doesn't exist
asyncify(setupSelendroid);
