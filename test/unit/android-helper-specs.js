// TODO these tests should be moved along with the implementation to the
// appium-android-driver package or wherever they should live
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';
import * as helpers from '../../lib/android-helpers';
//import ADB from 'appium-adb';
//import { withMocks } from 'appium-test-support';

chai.should();
chai.use(chaiAsPromised);

describe('Android Helpers', () => {
  //let adb = new ADB();

  describe('parseJavaVersion', () => {
    it('should correctly parseJavaVersion', () => {
      helpers.parseJavaVersion(`java version "1.8.0_40"
        Java(TM) SE Runtime Environment (build 1.8.0_40-b27)`).should
        .be.equal("1.8.0_40");
    });
  });
});
