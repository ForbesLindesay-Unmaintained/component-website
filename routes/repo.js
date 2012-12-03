var Q = require('q');
var github = require('../github');
var markdown = require('../markdown');

// `/:user/:repo`

module.exports = route;
function route(req, res, next) {
  var user = req.params.user;
  var repo = req.params.repo;

  Q.all([github.getComponent(user, repo), github.getReadme(user, repo)])
    .spread(function (component, readme) {
      if (!component) return next();
      readme = readme || 'no readme found at "readme.md"';

      if (component.dependencies && Object.keys(component.dependencies).length) {

        readme += '\n\n' + (markdown.headingLevels(readme) == 1 ? '#' : '##') + ' Dependencies\n\n' + 
        Object.keys(component.dependencies)
          .map(function (dependency) {
            return ' - [' + dependency + '](/' + dependency + ')';
          })
          .join('\n');
      }

      var parsed = markdown(readme);
      var travis = parsed.travis;
      var headings = parsed.headings;
      var html = parsed.html;

      res.render('component', {
        title: component.name,
        username: user,
        license: component.license || 'unspecified',
        version: component.version,
        github: 'https://github.com/' + user + '/' + repo,
        readme: html,
        travis: travis,
        headings: headings
      });
    }).done(null, next);
}