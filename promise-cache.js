var Q = require('q');
var cache = {};
var hold = {};
module.exports = cacheFn;
function cacheFn(name, time, fn, reset) {
  if (cache[name]) {
    return cache[name];
  } else {
    if (hold[name]) {
      return Q.when(hold[name], function () {
        return cacheFn(name, time, fn, reset);
      });
    }
    cache[name] = fn();
    Q.when(cache[name], function () {
      return Q.delay(null, time).then(clear);
    }, function (err) {
      return clear(err);
    }).done();
    return cache[name];
  }
  function clear(err) {
    delete cache[name];
    hold[name] = reset ? reset(err) : null;
    return Q.when(hold[name], function () {
      delete hold[name];
    }, function () {
      delete hold[name];
    });
  }
}