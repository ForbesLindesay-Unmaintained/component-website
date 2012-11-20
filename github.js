var Q = require('q');
var nbind = Q.nbind;

var clientID = process.env.githubID;//set to github client id
var clientSecret = process.env.githubSecret;//set to github client secret

var dataCache = {};
function cache(fn, name) {
  name = name || '_';
  dataCache[name] = dataCache[name] || {};
  var c = dataCache[name];
  return function (path) {
    if (arguments.length == 1 && typeof path == 'string') {
      //if (c[path]) console.log('serve from cache');
      if (!c[path]) {
        setTimeout(function () {
          delete c[path];
        }, 120000);//clear cached results after 2 minutes.
      }
      return c[path] ? c[path] : c[path] = fn(path + (path.indexOf('?') == -1 ? '?' : '&') + 'client_id=' + clientID + '&client_secret=' + clientSecret);
    }
  };
}
var request = cache(nbind(require('request')));

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

module.exports.getComponent = getComponent;
function getComponent(user, repo) {
  return getJson('https://raw.github.com/' + user + '/' + repo + '/master/component.json');
}

module.exports.getReadme = getReadme;
function getReadme(user, repo) {
  return getJson('https://api.github.com/repos/' + user + '/' + repo + '/readme').then(function (json) {
    if (!json) return null;
    return new Buffer(json.content, 'base64').toString('ascii');
  });
}

module.exports.getTags = getTags;
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

module.exports.getUser = getUser;
function getUser(user) {
  return getJson('https://api.github.com/users/' + user);
}

module.exports.getUserRepos = getUserRepos;
function getUserRepos(user) {
  var get = 0;
  var got = 0;
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

function timeout(promise, time) {
  if (typeof promise.then == 'function') {
    var def = Q.defer();
    promise.then(def.resolve, def.reject);
    setTimeout(function () {
      def.reject(new Error('Timeout of ' + time + 'ms exceeded'));
    }, time);
    return def.promise;
  } else {
    return function () {
      timeout(promise.apply(this, arguments), time);
    }
  }
}