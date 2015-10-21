import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
//import ADB from 'appium-adb';
//import { withMocks } from 'appium-test-support';
import { SelendroidDriver } from '../../lib/driver.js';
import sinon from 'sinon';
import path from 'path';
//import { BaseDriver } from 'appium-base-driver';


chai.should();
chai.use(chaiAsPromised);

describe('driver.js', () => {
//  let adb = new ADB();


  describe('constructor', () => {
    it('calls BaseDriver constructor with opts', () => {
      let driver = new SelendroidDriver({foo: 'bar'});
      driver.should.exist;
      driver.opts.foo.should.equal('bar');
    });
  });

  describe('createSession', () => {
    it('should throw an error if app can not be found', async () => {
      let driver = new SelendroidDriver({}, false);
      await driver.createSession({app: 'foo.apk'}).should.be.rejectedWith('app apk');
    });

    it('should set sessionId', async () => {
      let driver = new SelendroidDriver({}, false);
      sinon.mock(driver).expects('checkAppPresent')
                        .once()
                        .returns(Promise.resolve());
      sinon.mock(driver).expects('startSelendroidSession')
                        .once()
                        .returns(Promise.resolve());
      await driver.createSession({cap: 'foo'});

      driver.sessionId.should.exist;
      driver.caps.cap.should.equal('foo');
    });
  });

  describe('checkAppPresent', async () => {
    it('should resolve if app present', async () => {
      let driver = new SelendroidDriver({}, false);
      sinon.mock(driver).expects('startSelendroidSession')
                        .returns(Promise.resolve());

      await driver.createSession({app: path.resolve('.')});

      await driver.checkAppPresent(); // should not error
    });

    it('should reject if app not present', async () => {
      let driver = new SelendroidDriver({}, false);
      sinon.mock(driver).expects('checkAppPresent')
                        .returns(Promise.resolve());
      sinon.mock(driver).expects('startSelendroidSession')
                        .returns(Promise.resolve());

      await driver.createSession({app: path.resolve('asdfasdf')});

      driver.checkAppPresent.restore();
      await driver.checkAppPresent().should.eventually.be.rejectedWith('Could not find');
    });
  });

});
