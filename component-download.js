var Q = require('q');

var request = require('request');

var fs = require('fs');
var mkdir = Q.nfbind(fs.mkdir);
var exists = function (path) {
  var def = Q.defer();
  fs.exists(path, def.resolve);
  return def.promise;
}

var path = require('path');
var join = path.join;
var dirname = path.dirname;
var basename = path.basename;

var clientID = process.env.githubID;//set to github client id
var clientSecret = process.env.githubSecret;//set to github client secret




function makeDir(path) {
  return exists(path)
    .then(function (exists) {
      if (exists) {
        return false;
      } else {
        return makeDir(join(path, '..'))
          .then(function () {
            return mkdir(path);
          })
          .then(function () {
            return true;
          });
      }
    })
    .fail(function (err) {
      if (err.code === 'EEXIST') return false;
      else return Q.reject(err);
    });
}

function downloadFile(src, destination) {
  var web = request(src + '?client_id=' + clientID + '&client_secret=' + clientSecret);
  return makeDir(dirname(destination))
    .then(function () {
      var def = Q.defer();

      var file = fs.createWriteStream(destination);

      file.on('error', function (exception) {
        def.reject(exception);
      });
      web.on('error', function (exception) {
        def.reject(exception);
      });
      file.on('close', function () {
        def.resolve();
      });

      web.pipe(file);
      web.on('response', function (res) {
        var status = res.statusCode;
        if (status === 404) def.reject(new Error('404 Not Found: ' + src));
        else if (status >= 400 && status < 500) def.reject(new Error(status + ' unknown client error requesting ' + src));
        else if (status >= 500 && status < 600) def.reject(new Error(status + ' unknown server error requesting ' + src));
      });

      return def.promise;
    });
}

function readJSON(file) {
  return Q.nfbind(fs.readFile)(file)
    .then(function (contents) {
      try {
        return JSON.parse(contents);
      } catch (ex) {
        throw new Error('Invalid JSON in ' + basename(file));
      }
    });
}

function downloadRepo(src, dest) {
  src = src.replace(/\/$/, '');
  return downloadFile(src + '/component.json', join(dest, 'component.json'))
    .then(function () {
      return readJSON(join(dest, 'component.json'));
    })
    .then(function (json) {
      var scripts = json.scripts ? json.scripts.map(function (script) {
        return downloadFile(src + '/' + script, join(dest, script));
      }) : [];
      var styles = json.styles ? json.styles.map(function (style) {
        return downloadFile(src + '/' + style, join(dest, style));
      }) : [];
      return Q.all([Q.all(scripts), Q.all(styles)])
        .then(function () {
          return json;
        });
    });
}

function absoluteVersion(version) {
  if (version === 'dev' || version === '*') {
    return Q.resolve('master');
  } else {
    return Q.resolve(version);
  }
}
function url(name, version) {
  return absoluteVersion(version)
    .then(function (version) {
      return 'https://raw.github.com/' + name + '/' + version + '/';
    });
}
function installRepo(name, version, destination) {
  var loaded = {};
  return url(name, version)
    .then(function (url) {
      loaded[name] = url;
      return downloadRepo(url, destination);
    }).then(instalDependencies);
  function installDependency(name, version) {
    return url(name, version)
      .then(function (url) {
        if (loaded[name]) {
          if (loaded[name] === url) {
            return null;
          } else {
            throw new Error('Versions clash: ' + name + '@' + version + ' doesn\'t match ' + url);
          }
        }
        loaded[name] = url;
        return downloadRepo(url, join(destination, 'components', name.replace(/\\|\//g, '-')))
          .then(instalDependencies);
      });
  }
  function instalDependencies(json) {
    if (json.dependencies) {
      return Q.all(Object.keys(json.dependencies)
        .map(function (key) {
          return installDependency(key, json.dependencies[key]);
        }));
    }
  }
}

module.exports = installRepo;