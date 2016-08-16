import _ from 'lodash';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { fs } from 'appium-support';
import { withMocks } from 'appium-test-support';
import { serverExists, SE_APK_PATH, SE_MANIFEST_PATH, setupSelendroid } from '../../lib/installer';
import log from '../../lib/logger';


chai.should();
chai.use(chaiAsPromised);

describe('appium-selendroid-installer', () => {
  describe('setupSelendroid', withMocks({log}, (mocks) => {
    it('should error and stop if jar cannot be found', async () => {
      // unset PATH in env so we can't find 'jar' on path
      // (this turned out to be easier than trying to mock teen_process.exec
      let oldEnv = _.clone(process.env);
      process.env = Object.assign(process.env, {PATH: ""});
      mocks.log.expects("error").once();
      await setupSelendroid();
      mocks.log.verify();
      process.env = oldEnv;
    });
  }));

  describe('serverExists', withMocks({fs}, (mocks) => {
    it('should return true if both apk and manifest exist', async () => {
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_APK_PATH)
        .returns(Promise.resolve(true));
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_MANIFEST_PATH)
        .returns(Promise.resolve(true));
      (await serverExists()).should.be.true;
      mocks.fs.verify();
    });
    it('should return false if apk does not exist', async () => {
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_APK_PATH)
        .returns(Promise.resolve(false));
      (await serverExists()).should.be.false;
      mocks.fs.verify();
    });
    it('should return false if manifest does not exist', async () => {
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_APK_PATH)
        .returns(Promise.resolve(true));
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_MANIFEST_PATH)
        .returns(Promise.resolve(false));
      (await serverExists()).should.be.false;
      mocks.fs.verify();
    });
    it('should return false if neither apk or manifest does not exist', async () => {
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_APK_PATH)
        .returns(Promise.resolve(false));
      (await serverExists()).should.be.false;
      mocks.fs.verify();
    });
    it('should return false if fs.exists throws a ENOENT error', async () => {
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_APK_PATH)
        .throws({code:'ENOENT'});
      (await serverExists()).should.be.false;
      mocks.fs.verify();
    });
    it('should throw an error if fs.exists throws a non-ENOENT error', async () => {
      let error = new Error();
      error.code = 'EACCES';
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_APK_PATH)
        .throws(error);
      await serverExists().should.eventually.be.rejectedWith(error);
      mocks.fs.verify();
    });
  }));
});
