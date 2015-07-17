// TODO these tests should be moved along with the implementation to the
// appium-android-driver package or wherever they should live
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';
//import * as helpers from '../lib/android-helpers';
import ADB from 'appium-adb';
import { withMocks } from 'appium-test-support';

chai.should();
chai.use(chaiAsPromised);

describe('Android Helpers', () => {
  let adb = new ADB();

  describe('parseJavaVersion', withMocks({adb}, (mocks) => {
    it('', async () => {
      console.log(mocks);
      //mocks.adb.expects('')
               //.once()
               //.withExactArgs()
               //.returns(true);
      //mocks.adb.verify();
    });
  }));

  describe.skip('setJavaVersion', withMocks({adb}, (mocks) => {
    console.log(mocks);
  }));
});
