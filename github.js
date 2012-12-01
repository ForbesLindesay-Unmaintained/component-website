var Q = require('q');
var nbind = Q.nbind;

var path = require('path');
var join = path.join;
var fs = require('./fs');
var makedir = fs.makedir;
function read(user, repo, name) {
  var dir = join(__dirname, 'cache', user);
  if (repo) dir = join(dir, repo);
  var path = join(dir, name + '.json');
  return fs.exists(path)
    .then(function (exists) {
      if (!exists) return null;
      else return fs.readFile(path)
        .then(function (data) {
          data = JSON.parse(data.toString());
          if (data.expires && data.expires > Date.now())
            return data.value;
          else
            return null;
        });
    });
}
function write(user, repo, name, value, expire) {
  var dir = join(__dirname, 'cache', user);
  if (repo) dir = join(dir, repo);
  var path = join(dir, name + '.json');
  return fs.makedir(dir)
    .then(function () {
      return fs.writeFile(path, 
        JSON.stringify({value: value, expires: Date.now() + expire}));
    });
}

function withCache(fn, name, timeInSeconds) {
  return function (user, repo) {
    var self = this;
    var args = arguments;
    return read(user, repo, name)
      .then(function (cached) {
        if (cached) return cached;
        return fn.apply(self, args)
          .then(function (data) {
            return write(user, repo, name, data, timeInSeconds * 1000)
              .then(function () {
                return data;
              });
          });
      });
  };
}

var clientID = process.env.githubID;//set to github client id
var clientSecret = process.env.githubSecret;//set to github client secret

function withTokens(fn) {
  return function (path) {
    if (arguments.length == 1 && typeof path == 'string') {
      return fn(path + (path.indexOf('?') == -1 ? '?' : '&') + 
        'client_id=' + clientID + 
        '&client_secret=' + clientSecret);
    }
  };
}
var request = withTokens(nbind(require('request')));

function getJson(path) {
  return request(path)
    .spread(function (res, body) {
      if (res.statusCode == 404) {
        return null;
      } else if (res.statusCode != 200) {
        throw new Error('Server responded with error code: ' + res.statusCode + '\n' + body);
      } else {
        var result = JSON.parse(body);
        if (res.headers.link) {
          var links = parseLink(res.headers.link);
          if (links.next) {
            return getJson(links.next)
              .then(function (rest) {
                return result.concat(rest);
              });
          }
        }
        return result;
      }
    });
};

function parseLink(link) {
  var regex = /\<([^\>]+)\>\; rel=\"([^\"]+)\"/g;
  var links = {};
  var current;
  while (current = regex.exec(link)) {
    links[current[2]] = current[1];
  }
  return links;
}

module.exports.getComponent = withCache(getComponent, 'component', 240);
function getComponent(user, repo) {
  return getJson('https://raw.github.com/' + user + '/' + repo + '/master/component.json');
}

module.exports.getReadme = withCache(getReadme, 'readme', 240);
function getReadme(user, repo) {
  return getJson('https://api.github.com/repos/' + user + '/' + repo + '/readme').then(function (json) {
      if (!json) return null;
      return new Buffer(json.content, 'base64').toString('ascii');
    });
}

module.exports.getTags = withCache(getTags, 'tags', 240);
function getTags(user, repo) {
  return getJson('https://api.github.com/repos/' + user + '/' + repo + '/git/refs/tags').then(function (json) {
    if (!json) return null;
    return json
        .map(function (tag) {
          return {
            name: tag.ref.substring(tag.ref.lastIndexOf('/') + 1),
            sha: tag.object.sha
          }
        })
        .filter(function (tag) {
          var match = /\d+\.\d+\.\d+/.exec(tag.name);
          if (match) {
            tag.version = match[0];
            return true;
          } else {
            return false;
          }
        })
        .sort(function (b, a) {
          var verA = /^(\d+)\.(\d+)\.(\d+)$/.exec(a.version);
          var verB = /^(\d+)\.(\d+)\.(\d+)$/.exec(b.version);

          if (verA[1] != verB[1]) {
            return (+verA[1]) - (+verB[1]);
          } else if (verA[2] != verB[2]) {
            return (+verA[2]) - (+verB[2]);
          } else {
            return (+verA[3]) - (+verB[3]);
          }
        });
  });
}

module.exports.getUser = withCache(getUser, 'user', 240);
function getUser(user) {
  return getJson('https://api.github.com/users/' + user);
}

module.exports.getUserRepos = withCache(getUserRepos, 'repos', 900);//This is expensive, cache for 15 mins
function getUserRepos(user) {
  return getJson('https://api.github.com/users/' + user + '/repos?per_page=100')
    .then(function (repos) {
      return Q.all(repos.map(attachComponent))
        .then(function (repos) {
          return repos.filter(function (repo) {
            return repo != null;
          });
        });
    });
  function attachComponent(repo) {;
    return getComponent(user, repo.name)
      .then(function (component) {
        if (!component) return null;
        return {github: repo, component: component};
      }, function (err) {
        return null; //treat failure to get & parse component.json like non-existant component.json
      });
  }
}