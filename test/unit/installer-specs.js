import _ from 'lodash';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { fs } from 'appium-support';
import { withMocks } from 'appium-test-support';
import { serverExists, SE_APK_PATH, SE_MANIFEST_PATH, setupSelendroid } from '../../lib/installer';
import log from '../../lib/logger';
import B from 'bluebird';


chai.should();
chai.use(chaiAsPromised);

describe('installer', withMocks({log, fs}, (mocks) => {
  afterEach(function () {
    mocks.verify();
  });
  describe('setupSelendroid', function () {
    it('should error and stop if jar cannot be found', async function () {
      // unset PATH in env so we can't find 'jar' on path
      // (this turned out to be easier than trying to mock teen_process.exec
      let oldEnv = _.clone(process.env);
      process.env = Object.assign(process.env, {PATH: ""});
      mocks.log.expects("error").once();

      await setupSelendroid();

      process.env = oldEnv;
    });
  });

  describe('serverExists', function () {
    it('should return true if both apk and manifest exist', async function () {
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_APK_PATH)
        .returns(B.resolve(true));
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_MANIFEST_PATH)
        .returns(B.resolve(true));
      (await serverExists()).should.be.true;
    });
    it('should return false if apk does not exist', async function () {
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_APK_PATH)
        .returns(B.resolve(false));
      (await serverExists()).should.be.false;
    });
    it('should return false if manifest does not exist', async function () {
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_APK_PATH)
        .returns(B.resolve(true));
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_MANIFEST_PATH)
        .returns(B.resolve(false));
      (await serverExists()).should.be.false;
    });
    it('should return false if neither apk or manifest does not exist', async function () {
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_APK_PATH)
        .returns(B.resolve(false));
      (await serverExists()).should.be.false;
    });
    it('should return false if fs.exists throws a ENOENT error', async function () {
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_APK_PATH)
        .throws({code:'ENOENT'});
      (await serverExists()).should.be.false;
    });
    it('should throw an error if fs.exists throws a non-ENOENT error', async function () {
      let error = new Error();
      error.code = 'EACCES';
      mocks.fs.expects("exists").once()
        .withExactArgs(SE_APK_PATH)
        .throws(error);
      await serverExists().should.eventually.be.rejectedWith(error);
    });
  });
}));
