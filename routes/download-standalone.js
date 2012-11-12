var Q = require('q');

var github = require('../github');
var componentInstall = require('../component-download');
var componentBuild = require('../component-build');

var UglifyJS = require('uglify-js2');

var fs = require('fs');
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

var path = require('path');
var join = path.join;

function bin(path) {
  return 'node ' + join(__dirname, '..', 'node_modules', 'component', 'bin', path);
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

function readJSON(path) {
  return readFile(path)
    .then(function (content) {
      return JSON.parse(content.toString());
    });
}

function camelCase(name) {
  return name.replace(/\-(\w)/g, function (_, c) { return c.toUpperCase(); });
}


function installComponent(user, repo, version) {
  return componentInstall(user + '/' + repo, version, join(__dirname, '..', 'cache', user, repo, version));
}

function buildComponent(user, repo, version) {
  var dir = join(__dirname, '..', 'cache', user, repo, version);
  return componentBuild(dir, repo)
    .then(function () {
      return readFile(join(dir, 'build', 'build.js'))
    })
    .then(function (built) {
      return writeFile(join(dir, 'build', 'build.min.js'), UglifyJS.minify(built.toString(), {fromString: true}).code);
    });
}

// `/:user/:repo/download/:file.js`

removedir(join(__dirname, '..', 'cache'));
var cache = {};
var clearing = {};
module.exports = route;
function route(req, res, next) {
  var user = req.params.user;
  var repo = req.params.repo;
  var file = req.params.file;

  var min = /\.min$/.test(file);
  if (min) file = file.substring(0, file.length - 4);

  var match = /^(.*)\-([^\-]*)$/.exec(file);
  if (!match) return next();
  file = match[1];

  var version = match[2];

  var ver;
  if (version != 'dev') {
    ver = github.getTags(user, repo)
      .then(function (tags) {
        for (var i = 0; i < tags.length; i++) {
          if (tags[i].version === version) {
            return tags[i].name;
          }
        }
      });
  } else {
    ver = Q.resolve(version);
  }
  if (clearing[user + '/' + repo + '/' + version]) {
    ver = ver.then(function (version) {
      return clearing[user + '/' + repo + '/' + version]
        .then(function () { return version; });
      });
  }
  ver.then(function (version) {
    var dir = join(__dirname, '..', 'cache', user, repo, version);

    var fileBuilt;
    if (cache[user + '/' + repo + '/' + version]) {
      console.log('using cache');
      fileBuilt = cache[user + '/' + repo + '/' + version];
    } else {
      console.log('building cache');
      fileBuilt = cache[user + '/' + repo + '/' + version] = (function () {
        var dirCreated;
        if (version === 'dev') {
          dirCreated = removedir(dir)
            .then(function () {
              return makedir(dir);
            });
        } else {
          dirCreated = makedir(dir);
        }

        return dirCreated
          .then(function (isNew) {
            if (isNew) {
              return installComponent(user, repo, version)
                .then(function () {
                  return buildComponent(user, repo, version);
                });
            }
          });
      }());

      fileBuilt
        .then(function () {
          return Q.delay(30000);
        },
        function () {
          return removedir(dir);
        })
        .then(function () {
          console.log('clearing cache');
          delete cache[user + '/' + repo + '/' + version];
          if (version == 'dev') {
            var remove = clearing[user + '/' + repo + '/' + version] = removedir(dir);
            return remove.then(function () {
              delete clearing[user + '/' + repo + '/' + version];
            })
          }
        })
        .done();
    }

    return fileBuilt
      .then(function () {
        res.sendfile(join(dir, 'build', 'build' + (min?'.min':'')+ '.js'), {maxAge: 0});
      })

  }).done(null, next);
}