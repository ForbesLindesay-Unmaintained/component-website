var Q = require('q');

var github = require('../github');
var componentInstall = require('../component-download');
var componentBuild = require('../component-build');
var cache = require('../promise-cache');

var UglifyJS = require('uglify-js2');

var fs = require('../fs');
var readFile = fs.readFile;
var writeFile = fs.writeFile;
var exists = fs.exists;
var makedir = fs.makedir;
var removedir = fs.removedir;

var path = require('path');
var join = path.join;



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

//removedir(join(__dirname, '..', 'cache')).done();
module.exports = route;
function route(req, res, next) {
  var user = req.params.user;
  var repo = req.params.repo;
  var file = req.params.file;
  var min = /\.min$/.test(file);
  if (min) file = file.substring(0, file.length - 4);
  var pack = /\.component$/.test(file)
  if (pack) file = file.substring(0, file.length - '.component'.length)

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
  ver.then(function (version) {
    var dir = join(__dirname, '..', 'cache', user, repo, version);

    var build = cache(user + '/' + repo + '/' + version, 30000, function () {
      var ready = (version == 'dev' ? removedir(dir) : Q.resolve(null));

      return ready
        .then(function () {
          return makedir(dir);
        })
        .then(function (isNew) {
          if (true) {
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
      debugger;
      res.sendfile(
        join(
          dir, 
          'build', 
          'build' + ((pack ? '.component' : '') + (min ? '.min' : '')) + '.js'
        ), 
        {maxAge: 0}
      )
    })

  }).done(null, next);
}