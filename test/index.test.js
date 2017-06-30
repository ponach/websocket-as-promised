'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const W3CWebSocket = require('websocket').w3cwebsocket;
const WebSocketAsPromised = require('../src');
const server = require('./server');

chai.use(chaiAsPromised);
const assert = chai.assert;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createWebSocket(url) {
  return new W3CWebSocket(url);
}

describe('WebSocketAsPromised', function () {

  before(function (done) {
    server.start(url => {
      this.url = url;
      done();
    });
  });

  after(function (done) {
    server.stop(() => done());
  });

  beforeEach(function () {
    this.wsp = new WebSocketAsPromised({createWebSocket});
  });

  afterEach(function () {
    if (this.wsp.ws) {
      return this.wsp.close();
    }
  });

  describe('open', function () {
    it('should open connection', function () {
      const res = this.wsp.open(this.url);
      return assert.eventually.propertyVal(res, 'type', 'open');
    });

    it('should return the same opening promise on several calls', function () {
      const p1 = this.wsp.open(this.url);
      const p2 = this.wsp.open(this.url);
      assert.equal(p1, p2);
      return assert.eventually.propertyVal(p1, 'type', 'open');
    });

    it('should reject for invalid url', function () {
      const res = this.wsp.open('abc');
      return assert.isRejected(res, 'You must specify a full WebSocket URL, including protocol.');
    });
  });

  describe('request', function () {
    it('should send data with generated id', function () {
      const res = this.wsp.open(this.url).then(() => this.wsp.request({foo: 'bar'}));
      return Promise.all([
        assert.eventually.propertyVal(res, 'foo', 'bar'),
        assert.eventually.property(res, 'id')
      ]);
    });

    it('should send data with specified id', function () {
      const res = this.wsp.open(this.url).then(() => this.wsp.request({foo: 'bar', id: 1}));
      return assert.eventually.propertyVal(res, 'id', 1);
    });

    it('should not fulfill for response without ID', function () {
      let a = 0;
      const res = this.wsp.open(this.url)
        .then(() => {
          this.wsp.request({noId: true}).then(() => a = a + 1, () => {
          });
          return sleep(100).then(() => a);
        });
      return assert.eventually.equal(res, 0);
    });
  });

  describe('send', function () {
    it('should not return Promise', function () {
      const p = this.wsp.open(this.url).then(() => {
        const res = this.wsp.send({foo: 'bar', id: 1});
        assert.equal(res, undefined);
      });
      return assert.isFulfilled(p);
    });
  });

  describe('close', function () {
    it('should close connection', function () {
      const CLOSE_NORMAL = 1000;
      const res = this.wsp.open(this.url).then(() => this.wsp.close());
      return assert.eventually.propertyVal(res, 'code', CLOSE_NORMAL);
    });

    it('should return the same closing promise for several calls', function () {
      const CLOSE_NORMAL = 1000;
      const res = this.wsp.open(this.url).then(() => {
        const p1 = this.wsp.close();
        const p2 = this.wsp.close();
        assert.equal(p1, p2);
        return p2;
      });
      return assert.eventually.propertyVal(res, 'code', CLOSE_NORMAL);
    });

    it('should reject all pending requests', function () {
      let a = '';
      const res = this.wsp.open(this.url)
        .then(() => {
          this.wsp.request({noId: true}).catch(e => a = e.message);
          return sleep(10).then(() => this.wsp.close()).then(() => a);
        });
      return assert.eventually.equal(res, 'Connection closed.');
    });
  });

  describe('idProp', function () {
    it('should be customized by options', function () {
      const wsp = new WebSocketAsPromised({createWebSocket, idProp: 'myId'});
      const res = wsp.open(this.url).then(() => wsp.request({foo: 'bar'}));
      return Promise.all([
        assert.eventually.propertyVal(res, 'foo', 'bar'),
        assert.eventually.property(res, 'myId'),
      ]);
    });
  });

  describe('onMessage', function () {
    it('should dispatch data', function () {
      const wsp = new WebSocketAsPromised({createWebSocket});
      const res = new Promise(resolve => {
        wsp.onMessage.addListener(resolve);
        wsp.open(this.url).then(() => wsp.request({foo: 'bar'}));
      });
      return assert.eventually.propertyVal(res, 'foo', 'bar');
    });
  });

  describe('timeout', function () {
    it('should reject request after timeout', function () {
      const wsp = new WebSocketAsPromised({createWebSocket, timeout: 50});
      const res = wsp.open(this.url).then(() => wsp.request({foo: 'bar', delay: 100}));
      return assert.isRejected(res, 'Promise rejected by timeout (50 ms)');
    });

    it('should resolve request before timeout', function () {
      const wsp = new WebSocketAsPromised({createWebSocket, timeout: 100});
      const res = wsp.open(this.url).then(() => wsp.request({foo: 'bar', delay: 50}));
      return assert.eventually.propertyVal(res, 'foo', 'bar');
    });

    it('should reject request after custom timeout', function () {
      const wsp = new WebSocketAsPromised({createWebSocket, timeout: 100});
      const options = {timeout: 50};
      const res = wsp.open(this.url).then(() => wsp.request({foo: 'bar', delay: 70}, options));
      return assert.isRejected(res, 'Promise rejected by timeout (50 ms)');
    });

    it('should return the same opening promise on several open calls', function () {
      const wsp = new WebSocketAsPromised({createWebSocket, timeout: 50});
      const p1 = wsp.open(this.url);
      const p2 = wsp.open(this.url);
      assert.equal(p1, p2);
      return assert.eventually.propertyVal(p1, 'type', 'open');
    });

    it('should return the same closing promise for several close calls', function () {
      const CLOSE_NORMAL = 1000;
      const wsp = new WebSocketAsPromised({createWebSocket, timeout: 50});
      const res = wsp.open(this.url).then(() => {
        const p1 = wsp.close();
        const p2 = wsp.close();
        assert.equal(p1, p2);
        return p2;
      });
      return assert.eventually.propertyVal(res, 'code', CLOSE_NORMAL);
    });
  });

});
