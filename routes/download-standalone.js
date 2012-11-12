var Q = require('q');

var github = require('../github');
var componentInstall = require('../component-download');
var componentBuild = require('../component-build');
var cache = require('../promise-cache');

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


function installComponent(user, repo, version) {
  return componentInstall(user + '/' + repo, version, join(__dirname, '..', 'cache', user, repo, version));
}

function buildComponent(user, repo, version) {
  var dir = join(__dirname, '..', 'cache', user, repo, version);
  return componentBuild(dir, repo);
}

function minifyComponent(user, repo, version) {
  var dir = join(__dirname, '..', 'cache', user, repo, version);
  return readFile(join(dir, 'build', 'build.js'))
    .then(function (built) {
      return writeFile(join(dir, 'build', 'build.min.js'), UglifyJS.minify(built.toString(), {fromString: true}).code);
    });
}

// `/:user/:repo/download/:file.js`

removedir(join(__dirname, '..', 'cache')).done();
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

    var build = cache(user + '/' + repo + '/' + version, 30000, function () {
      var ready = (version == 'dev' ? removedir(dir) : Q.resolve(null));

      return ready
        .then(function () {
          return makedir(dir);
        })
        .then(function (isNew) {
          if (isNew) {
            return installComponent(user, repo, version)
              .then(function () {
                return buildComponent(user, repo, version);
              })
              .then(function () {
                return minifyComponent(user, repo, version);
              });
          }
        });
      }, function reset(err) {
        if (err || version == 'dev')
          return removedir(dir);
      });

    return build.then(function () {
        res.sendfile(join(dir, 'build', 'build' + (min?'.min':'')+ '.js'), {maxAge: 0});
      })

  }).done(null, next);
}