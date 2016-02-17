// transpile:mocha

import path from 'path';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import wd from 'wd';
import { tempDir, fs } from 'appium-support';
import { startServer } from '../..';


const TEST_PORT = 4884;
const TEST_HOST = 'localhost';
const TEST_APP = path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures',
                              'selendroid-test-app.apk');
const REMOTE_TEST_APP = 'http://appium.github.io/appium/assets/ApiDemos-debug.apk';

const shouldStartServer = process.env.USE_RUNNING_SERVER !== "0";

const should = chai.should();
chai.use(chaiAsPromised);

describe('SelendroidDriver', () => {
  let server = null;

  before(async () => {
    if (shouldStartServer) {
      server = await startServer(TEST_PORT, TEST_HOST);
    }
  });
  after(async () => {
    if (server) {
      server.close();
    }
  });

  describe('local app', () => {
    const caps = {platformName: 'Android', deviceName: 'Android Emulator',
                  app: TEST_APP};
    let tempAppFile;
    before(async () => {
      // make a temporary copy of the apk
      let dir = await tempDir.path();
      tempAppFile = path.resolve(dir, 'selendroid-test-app.apk');
      await fs.copyFile(TEST_APP, tempAppFile);
      caps.app = tempAppFile;
    });
    after(async () => {
      if (tempAppFile) {
        await fs.unlink(tempAppFile);
      }
    });

    it('should start a session', async () => {
      let driver = wd.promiseChainRemote(TEST_HOST, TEST_PORT);
      let [sessionId] = await driver.init(caps);
      should.exist(sessionId);
      sessionId.should.be.a('string');
      await driver.quit();
    });
    it('should fail gracefully when session has ended', async () => {
      let driver = wd.promiseChainRemote(TEST_HOST, TEST_PORT);
      let [sessionId] = await driver.init(caps);
      should.exist(sessionId);
      sessionId.should.be.a('string');
      await driver.quit();
      await driver.title().should.eventually.be.rejectedWith(/terminated/);
    });
  });

  describe('remote app', () => {
    const caps = {platformName: 'Android', deviceName: 'Android Emulator',
                  app: REMOTE_TEST_APP};

    it('should start a session', async () => {
      let driver = wd.promiseChainRemote(TEST_HOST, TEST_PORT);
      let [sessionId] = await driver.init(caps);
      should.exist(sessionId);
      sessionId.should.be.a('string');
      await driver.quit();
    });
  });
});

