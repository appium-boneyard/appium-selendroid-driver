// transpile:mocha

import path from 'path';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import wd from 'wd';
import { startServer } from '../..';


const TEST_PORT = 4884;
const TEST_HOST = 'localhost';
const TEST_APP = path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures',
                              'selendroid-test-app.apk');

const shouldStartServer = process.env.USE_RUNNING_SERVER !== "0";

chai.should();
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

  describe('set network connection', () => {
    // setting network connection uses android-driver methods that call
    const caps = {
      platformName: 'Android',
      deviceName: 'Android Emulator',
      app: TEST_APP
    };

    it('should start a session', async () => {
      let driver = wd.promiseChainRemote(TEST_HOST, TEST_PORT);
      await driver.init(caps);

      let nc = await driver.setNetworkConnection(4);
      nc.should.eql(4);

      await driver.quit();
    });
  });
});
