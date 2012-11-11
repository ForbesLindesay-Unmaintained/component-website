var Q = require('q');
var github = require('../github');

// `/:user`

module.exports = route;
function route(req, res, next) {
  Q.all([github.getUser(req.params.user), github.getUserRepos(req.params.user)])
    .spread(function (user, repos) {
      repos = repos.map(function (repo) {
        return {
          name: repo.github.full_name,
          url: '/' + repo.github.full_name,
          description: repo.component.description || repo.github.description
        }
      });
      res.render('user', {
        title: user.login,
        components: repos,
        user: {
          name: user.name || user.login,
          avatar: user.avatar_url,
          url: user.html_url
        }
      });
    }).done(null, next);
}