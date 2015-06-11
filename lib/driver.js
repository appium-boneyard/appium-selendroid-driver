import { BaseDriver } from 'appium-base-driver';

class SelendroidDriver extends BaseDriver {
  constructor () {
    super();
    this.caps = {};
  }

  async createSession (caps, reqCaps) {
    // TODO add validation on caps
    // TODO handle otherSessionData for multiple sessions
    let sessionId;
    [sessionId] = await super.createSession(caps, reqCaps);
    this.caps = caps;
    return [sessionId, caps];
  }
}

export { SelendroidDriver };
