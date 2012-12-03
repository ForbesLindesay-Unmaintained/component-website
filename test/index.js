require('../server');
var Q = require('q');
var request = Q.nfbind(require('request'));
var expect = require('expect.js');

function get(url, fn) {
  var r = request('http://localhost:3000' + url);
  describe(url, function () {
    it('returns a status code `200`', function (done) {
      r.spread(function (res) {
        expect(res.statusCode).to.be(200);
      })
      .done(done, done);
    });
    if (fn) fn(r);
  });
}
get('/ForbesLindesay/ajax');
get('/ForbesLindesay/ajax/download');
get('/ForbesLindesay/ajax/download/latest.js');
get('/ForbesLindesay/ajax/download/latest.min.js');
get('/ForbesLindesay/ajax/download/ajax-dev.js');
get('/ForbesLindesay/ajax/download/ajax-dev.min.js');
get('/ForbesLindesay');
get('/component-badge.svg');
get('/');