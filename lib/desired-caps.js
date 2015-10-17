import { commonCapConstraints } from 'appium-android-driver';

let selendroidCapConstraints = {
  app: {
    presence: true,
    isString: true,
  },
  automationName: {
    presence: true,
    isString: true,
  },
  browserName: {
    isString: true
  },
  launchTimeout: {
    isNumber:true
  }
};

let desiredCapConstraints = {};
Object.assign(desiredCapConstraints, selendroidCapConstraints,
              commonCapConstraints);

export default desiredCapConstraints;
