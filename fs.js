var Q = require('q');
var fs = require('fs');
var path = require('path');
var join = path.join;

var mkdir = Q.nbind(fs.mkdir);
var rmdir = Q.nbind(fs.rmdir);
var unlink = Q.nbind(fs.unlink);
var readdir = Q.nbind(fs.readdir);
var stat = Q.nbind(fs.stat);

var readFile = Q.nbind(fs.readFile);
var writeFile = Q.nbind(fs.writeFile);
var exists = function (path) {
  var def = Q.defer();
  fs.exists(path, def.resolve);
  return def.promise;
}
function makedir(path) {
  return exists(path)
    .then(function (exists) {
      if (exists) {
        return false;
      } else {
        return makedir(join(path, '..'))
          .then(function () {
            return mkdir(path);
          })
          .then(function () {
            return true;
          });
      }
    })
    .fail(function (err) {
      if (err.code === 'EEXIST') return Q.delay(false, 2000); //make sure there's been time for it to be built
      else return Q.reject(err);
    });
}

function removedir(path) {
  return readdir(path)
    .then(function (items) {
      return Q.all(items.map(remove));
    })
    .then(function () {
      return rmdir(path);
    })
    .fail(function (err) {
      if (err.code !== 'ENOENT') return Q.reject(err);
    });
  function remove(file) {
    return stat(join(path, file))
      .then(function (stat) {
        if (stat.isDirectory()) {
          return removedir(join(path, file));
        } else {
          return unlink(join(path, file));
        }
      })
      .fail(function (err) {
        if (err.code !== 'ENOENT') return Q.reject(err);
      });
  }
}

exports.readFile = readFile;
exports.writeFile = writeFile;
exports.exists = exists;

exports.makedir = makedir;
exports.removedir = removedir;