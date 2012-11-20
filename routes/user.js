var Q = require('q');
var github = require('../github');

// `/:user`

module.exports = route;
function route(req, res, next) {
  getUserCached(req.params.user)
    .then(function (user) {
      res.render('user', user);
    }).done(null, next);
}

var cachAccessed = {};
var cache = {};

function getUserCached(user) {
  if (cache[user]) {
    cachAccessed[user] = true;
    return cache[user];
  } else {
    updateCache();
    return cache[user] = getUser(user);
  }
  function updateCache() {
    cachAccessed[user] = false;
    setTimeout(function () {
      if (cachAccessed[user]) {
        //refresh cache
        var next = getUser(user);
        next.then(function () {
          cache[user] = next;
        });
        updateCache();
      } else {
        delete cache[user];
      }
    }, 1 * 60 * 1000);
  }
}
function getUser(user) {
  return Q.all([github.getUser(user), github.getUserRepos(user)])
    .spread(function (user, repos) {
      repos = repos.map(function (repo) {
        return {
          name: repo.github.full_name,
          url: '/' + repo.github.full_name,
          description: repo.component.description || repo.github.description || ''
        }
      });
      return {
        title: user.login,
        components: repos,
        user: {
          name: user.name || user.login,
          avatar: user.avatar_url,
          url: user.html_url
        }
      };
    });
}