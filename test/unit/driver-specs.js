import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import SelendroidDriver from '../..';
import sinon from 'sinon';
import path from 'path';
import B from 'bluebird';


chai.should();
chai.use(chaiAsPromised);

describe('driver.js', function () {
  describe('constructor', function () {
    it('calls BaseDriver constructor with opts', function () {
      let driver = new SelendroidDriver({foo: 'bar'});
      driver.should.exist;
      driver.opts.foo.should.equal('bar');
    });
  });

  describe('createSession', function () {
    it('should throw an error if app can not be found', async function () {
      let driver = new SelendroidDriver({}, false);
      await driver.createSession({app: 'foo.apk'}).should.be.rejectedWith('does not exist');
    });

    it('should set sessionId', async function () {
      let driver = new SelendroidDriver({}, false);
      sinon.mock(driver).expects('checkAppPresent')
                        .once()
                        .returns(B.resolve());
      sinon.mock(driver).expects('startSelendroidSession')
                        .once()
                        .returns(B.resolve());
      await driver.createSession({cap: 'foo'});

      driver.sessionId.should.exist;
      driver.caps.cap.should.equal('foo');
    });

    it('should set the default context', async function () {
      let driver = new SelendroidDriver({}, false);
      sinon.mock(driver).expects('checkAppPresent')
                        .returns(B.resolve());
      sinon.mock(driver).expects('startSelendroidSession')
                        .returns(B.resolve());
      await driver.createSession({});
      driver.curContext.should.equal('NATIVE_APP');
    });
  });

  describe('checkAppPresent', async function () {
    it('should resolve if app present', async function () {
      let driver = new SelendroidDriver({}, false);
      let app = path.resolve('.');
      sinon.mock(driver).expects('startSelendroidSession')
                        .returns(B.resolve());
      sinon.mock(driver.helpers).expects('configureApp')
                        .returns(app);

      await driver.createSession({app});

      await driver.checkAppPresent(); // should not error

      // configureApp is shared between the two,
      // so restore mock or the next test will fail
      driver.helpers.configureApp.restore();
    });

    it('should reject if app not present', async function () {
      let driver = new SelendroidDriver({}, false);
      let app = path.resolve('asdfasdf');
      sinon.mock(driver).expects('checkAppPresent')
                        .returns(B.resolve());
      sinon.mock(driver).expects('startSelendroidSession')
                        .returns(B.resolve());
      sinon.mock(driver.helpers).expects('configureApp')
                        .returns(app);

      await driver.createSession({app});

      driver.checkAppPresent.restore();
      await driver.checkAppPresent().should.eventually.be.rejectedWith('Could not find');
    });
  });

  describe('proxying', function () {
    let driver;
    before(function () {
      driver = new SelendroidDriver({}, false);
      driver.sessionId = 'abc';
    });
    describe('#proxyActive', function () {
      it('should exist', function () {
        driver.proxyActive.should.be.an.instanceof(Function);
      });
      it('should return true', function () {
        driver.proxyActive('abc').should.be.true;
      });
      it('should throw an error if session id is wrong', function () {
        (() => { driver.proxyActive('aaa'); }).should.throw;
      });
    });

    describe('#getProxyAvoidList', function () {
      it('should exist', function () {
        driver.getProxyAvoidList.should.be.an.instanceof(Function);
      });
      it('should return jwpProxyAvoid array', function () {
        let avoidList = driver.getProxyAvoidList('abc');
        avoidList.should.be.an.instanceof(Array);
        avoidList.should.eql(driver.jwpProxyAvoid);
      });
      it('should throw an error if session id is wrong', function () {
        (() => { driver.getProxyAvoidList('aaa'); }).should.throw;
      });
    });

    describe('#canProxy', function () {
      it('should exist', function () {
        driver.canProxy.should.be.an.instanceof(Function);
      });
      it('should return true', function () {
        driver.canProxy('abc').should.be.true;
      });
      it('should throw an error if session id is wrong', function () {
        (() => { driver.canProxy('aaa'); }).should.throw;
      });
    });
  });
});
