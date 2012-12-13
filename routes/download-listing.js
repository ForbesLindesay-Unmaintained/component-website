var Q = require('q');
var github = require('../github');

// `/:user/:repo`

module.exports = route;
function route(req, res, next) {
  var user = req.params.user;
  var repo = req.params.repo;
  //todo: display a list of available versions
  Q.all([github.getComponent(user, repo), github.getTags(user, repo)])
    .spread(function (component, tags) {
      if (!component) return next();
      res.render('download', {
        title: component.name,
        license: component.license || 'unspecified',
        user: user,
        name: repo,
        devRelease: {
          download: '/' + user + '/' + repo + '/download/' + component.name.replace('.js', '') + '-dev.js',
          downloadMin: '/' + user + '/' + repo + '/download/' + component.name.replace('.js', '') + '-dev.min.js'
        },
        versions: tags ? tags.map(function (tag) {
          var name = component.name.replace(/\.js$/, '')
          return {
            version: tag.version,
            download: '/'+user+'/'+repo+'/download/'+name+'-'+tag.version+'.js',
            downloadMin: '/'+ user+'/'+repo+'/download/'+name+'-'+tag.version+'.min.js'
          }
        }) : []
      })
    })
    .done(null, next);
}
