import _ from 'lodash';
import { commonCapConstraints } from 'appium-android-driver';

let desiredCapConstraints = _.clone(commonCapConstraints);
desiredCapConstraints.app = {
  presence: true,
  isString: true,
};

export default desiredCapConstraints;
