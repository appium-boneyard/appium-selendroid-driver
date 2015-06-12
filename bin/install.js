"use strict";

var downloadSelendroid = require('../build/lib/setup').downloadSelendroid
  , asyncify = require('asyncbox').asyncify;

asyncify(downloadSelendroid);
