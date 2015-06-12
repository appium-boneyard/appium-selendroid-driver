import { BaseDriver } from 'appium-base-driver';
import { serverExists } from './setup';

class SelendroidDriver extends BaseDriver {
  constructor () {
    super();
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
