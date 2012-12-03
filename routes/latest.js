var github = require('../github');

// `/:user/:repo/download/latest(.min)?.js`

module.exports = latest;
function latest(min) {
  var extension = min?'.min.js':'.js';
  return function (req, res, next) {
    var user = req.params.user;
    var repo = req.params.repo;
    github.getTags(user, repo)
      .then(function (tags) {
        var version;
        if (tags && tags.length) {
          version = tags[0].version;
        } else {
          version = 'dev';
        }
        res.redirect('/' + user + '/' + repo + '/download/' + repo.replace('.js', '') + '-' + version + extension);
      })
      .done(null, next);
  };
}