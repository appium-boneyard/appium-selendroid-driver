// transpile:mocha

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import SelendroidServer from '../../lib/selendroid';
import { fs } from 'appium-support';
import { SE_APK_PATH, SE_MANIFEST_PATH } from '../../lib/installer';
import ADB from 'appium-adb';
import { withSandbox } from 'appium-test-support';
import B from 'bluebird';


chai.should();
chai.use(chaiAsPromised);

function buildSelendroidOpts (adb = null) {
  if (!adb) {
    adb = new ADB();
  }
  return {
    adb,
    appPackage: 'io.appium.foo',
    appActivity: 'StartActivity',
    tmpDir: '/tmp',
    apk: '/path/to/our.apk',
    host: 'localhost',
    systemPort: 4567,
    devicePort: 8080,
  };
}

const adb = new ADB();

describe('SelendroidServer', withSandbox({mocks: {adb, fs}}, (S) => {
  afterEach(function () {
    S.verify();
  });

  describe('#constructor', function () {
    it('should complain if required options not sent', function () {
      (() => {
        new SelendroidServer();
      }).should.throw(/Option.*adb.*required/);
      (() => {
        new SelendroidServer({});
      }).should.throw(/Option.*adb.*required/);
      (() => {
        new SelendroidServer({adb: 'foo'});
      }).should.throw(/Option.*appPackage.*required/);
    });
  });

  describe('#prepareModifiedServer', function () {
    let selendroid = new SelendroidServer(buildSelendroidOpts(adb));
    it('should build a modified server if one doesnt exist', async function () {
      S.mocks.fs.expects('exists').once()
        .withExactArgs(selendroid.modServerPath)
        .returns(B.resolve(false));
      // should uninstall the apk if it's rebuilt
      S.mocks.adb.expects('uninstallApk').once()
        .withExactArgs(selendroid.modServerPkg)
        .returns(B.resolve());
      S.mocks.selendroid = S.sandbox.mock(selendroid);
      // should call the rebuilding method
      S.mocks.selendroid.expects('buildNewModServer').once()
        .returns(B.resolve());
      // should check certs regardless
      S.mocks.selendroid.expects('checkAndSignCert').once()
        .returns(B.resolve(true));
      await selendroid.prepareModifiedServer();
    });
    it('should not build a modified server if one does exist', async function () {
      S.mocks.fs.expects('exists').once()
        .withExactArgs(selendroid.modServerPath)
        .returns(B.resolve(true));
      // should not uninstall the apk if it's not rebuilt
      S.mocks.adb.expects('uninstallApk').never();
      S.mocks.selendroid = S.sandbox.mock(selendroid);
      // should not call the building method
      S.mocks.selendroid.expects('buildNewModServer').never();
      // should check certs regardless
      S.mocks.selendroid.expects('checkAndSignCert').once()
        .returns(B.resolve());
      await selendroid.prepareModifiedServer();
    });
  });

  describe('#buildNewModServer', function () {
    let selendroid = new SelendroidServer(buildSelendroidOpts(adb));
    it('should go through the steps to compile a server', async function () {
      S.mocks.fs.expects('mkdir').once()
        .withExactArgs(`/tmp/${selendroid.appPackage}`)
        .returns(B.resolve());
      S.mocks.fs.expects('copyFile').once()
        .withExactArgs(SE_MANIFEST_PATH, '/tmp/AndroidManifest.xml')
        .returns(B.resolve());
      S.mocks.adb.expects('initAapt').once()
        .returns(B.resolve());
      S.mocks.adb.expects('compileManifest').once()
        .withExactArgs('/tmp/AndroidManifest.xml', selendroid.modServerPkg,
                       selendroid.appPackage)
        .returns(B.resolve());
      S.mocks.adb.expects('insertManifest').once()
        .withExactArgs('/tmp/AndroidManifest.xml', SE_APK_PATH,
                       selendroid.modServerPath)
        .returns(B.resolve());
      await selendroid.buildNewModServer();
    });
  });

  describe('#checkAndSignCert', function () {
    let selendroid = new SelendroidServer(buildSelendroidOpts(adb));
    it('should check and sign both apks if neither are signed', async function () {
      S.mocks.adb.expects('checkApkCert').once()
        .withExactArgs(selendroid.modServerPath, selendroid.appPackage)
        .returns(B.resolve(false));
      S.mocks.adb.expects('checkApkCert').once()
        .withExactArgs(selendroid.apk, selendroid.appPackage)
        .returns(B.resolve(false));
      S.mocks.adb.expects('sign').once()
        .withExactArgs(selendroid.modServerPath)
        .returns(B.resolve());
      S.mocks.adb.expects('sign').once()
        .withExactArgs(selendroid.apk)
        .returns(B.resolve());
      await selendroid.checkAndSignCert(selendroid.modServerPath);
      await selendroid.checkAndSignCert(selendroid.apk);
    });

    it('should check and sign only one apks if one is signed', async function () {
      S.mocks.adb.expects('checkApkCert').once()
        .withExactArgs(selendroid.modServerPath, selendroid.appPackage)
        .returns(B.resolve(false));
      S.mocks.adb.expects('checkApkCert').once()
        .withExactArgs(selendroid.apk, selendroid.appPackage)
        .returns(B.resolve(true));
      S.mocks.adb.expects('sign').once()
        .withExactArgs(selendroid.modServerPath)
        .returns(B.resolve());
      await selendroid.checkAndSignCert(selendroid.modServerPath);
      await selendroid.checkAndSignCert(selendroid.apk);
    });

    it('should check and sign neither apk if both are signed', async function () {
      S.mocks.adb.expects('checkApkCert').once()
        .withExactArgs(selendroid.modServerPath, selendroid.appPackage)
        .returns(B.resolve(true));
      S.mocks.adb.expects('checkApkCert').once()
        .withExactArgs(selendroid.apk, selendroid.appPackage)
        .returns(B.resolve(true));
      S.mocks.adb.expects('sign').never();
      await selendroid.checkAndSignCert(selendroid.modServerPath);
      await selendroid.checkAndSignCert(selendroid.apk);
    });
  });

  describe('#startSession', function () {
    let selendroid = new SelendroidServer(buildSelendroidOpts(adb));
    it('should start instrumented app, wait for status, and start a session', async function () {
      let caps = {foo: 'bar'};
      S.mocks.jwproxy = S.sandbox.mock(selendroid.jwproxy);
      S.mocks.adb.expects('instrument').once()
        .withArgs(selendroid.appPackage, selendroid.appActivity);
      S.mocks.jwproxy.expects('command').once()
        .withExactArgs('/status', 'GET')
        .returns(B.resolve());
      S.mocks.jwproxy.expects('command').once()
        .withExactArgs('/session', 'POST', {desiredCapabilities: caps})
        .returns(B.resolve());
      await selendroid.startSession(caps);
    });

    it('should wait for selendroid to respond to /status', async function () {
      let caps = {foo: 'bar'};
      S.mocks.jwproxy = S.sandbox.mock(selendroid.jwproxy);
      S.mocks.adb.expects('instrument').once()
        .withArgs(selendroid.appPackage, selendroid.appActivity);
      S.mocks.jwproxy.expects('command').once()
        .withExactArgs('/status', 'GET')
        .returns(B.reject(new Error('nope')));
      S.mocks.jwproxy.expects('command').once()
        .withExactArgs('/status', 'GET')
        .returns(B.resolve());
      S.mocks.jwproxy.expects('command').once()
        .withExactArgs('/session', 'POST', {desiredCapabilities: caps})
        .returns(B.resolve());
      await selendroid.startSession(caps);
    });
  });
}));
