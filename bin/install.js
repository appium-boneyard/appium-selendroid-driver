"use strict";

var downloadSelendroid = require('../build/lib/setup').downloadSelendroid
  , asyncify = require('asyncbox').asyncify;

// TODO: add --conditional flag for npm install so we don't crash if the build
// dir doesn't exist
asyncify(downloadSelendroid);
