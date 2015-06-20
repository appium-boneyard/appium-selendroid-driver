import { BaseDriver } from 'appium-base-driver';
import { serverExists } from './setup';
import desiredCapConstraints from './desired-caps';

// The range of ports we can use on the system for communicating to the
// Selendroid HTTP server on the device
const SYSTEM_PORT_RANGE = [8200, 8299];

// This is the port that Selendroid listens to on the device. We will forward
// one of the ports above on the system to this port on the device.
const DEVICE_PORT = 8080;

class SelendroidDriver extends BaseDriver {
  constructor (opts = {}) {
    super();
    this.desiredCapConstraints = desiredCapConstraints;
    this.opts = opts;
    this.caps = {};
  }

  async createSession (caps, reqCaps) {
    if (!(await serverExists())) {
      throw new Error("Can't start a selendroid session because the server " +
                      "apk doesn't exist. Please run 'npm run-script " +
                      "selendroid' in the appium-selendroid-driver package");
    }
    // TODO add validation on caps
    // TODO handle otherSessionData for multiple sessions
    let sessionId;
    [sessionId] = await super.createSession(caps, reqCaps);
    this.caps = caps;
    return [sessionId, caps];
  }
}

export { SelendroidDriver };
