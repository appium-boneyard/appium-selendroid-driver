// transpile:mocha

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';
import B from 'bluebird';
import wd from 'wd';
import { startServer } from '../..';

const TEST_PORT = 4884,
      TEST_HOST = 'localhost';

const shouldStartServer = process.env.USE_RUNNING_SERVER !== "0";

const should = chai.should();
chai.use(chaiAsPromised);

describe('SelendroidDriver', () => {

  let server = null;
  const caps = {platformName: 'Android', deviceName: 'Android Emulator'};
  before(async () => {
    if (shouldStartServer) {
      server = await startServer(TEST_PORT, TEST_HOST);
    }
  });
  after(async () => {
    if (server) {
      await B.promisify(server.close.bind(server))();
    }
  });

  it('should start a session', async () => {
      let driver = wd.promiseChainRemote(TEST_HOST, TEST_PORT);
      let [sessionId] = await driver.init(caps);
      should.exist(sessionId);
      sessionId.should.be.a('string');
      await driver.quit();
      await driver.title().should.eventually.be.rejectedWith(/terminated/);
  });
});

