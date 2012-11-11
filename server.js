var remote = 'https://raw.github.com';

var express = require('express');
var http = require('http');
var path = require('path');

var Q = require('q');
var github = require('./github');
var markdown = require('./markdown');
var componentLib = require('component');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(app.router);
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/:user', function (req, res, next) {
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
});
app.get('/:user/:repo', function (req, res, next) {
  var user = req.params.user;
  var repo = req.params.repo;

  Q.all([github.getComponent(user, repo), github.getReadme(user, repo)])
    .spread(function (component, readme) {
      if (!component) return next();
      readme = readme || 'no readme found at "readme.md"';

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
});

app.get('/:user/:repo/download', function (req, res, next) {
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
          return {
            version: tag.version,
            download: '/' + user + '/' + repo + '/download/' + component.name.replace('.js', '') + '-' + tag.version + '.js',
            downloadMin: '/' + user + '/' + repo + '/download/' + component.name.replace('.js', '') + '-' + tag.version + '.min.js'
          }
        }) : []
      })
    })
    .done(null, next);
});
app.get('/:user/:repo/download/latest', function (req, res, next) {
  //todo: redirect to standalone download for latest version
  next();
});

app.get('/:user/:repo/download/:file.js', function (req, res, next) {
  var user = req.params.user;
  var repo = req.params.repo;
  var file = req.params.file;

  var min = /\.min$/.test(file);
  if (min) file = file.substring(0, file.length - 4);

  var match = /^(.*)\-([^\-]*)$/.exec(file);
  if (!match) return next();
  file = match[1];

  var version = match[2];

  //todo: install component user/repo@version
  //todo: output standalone as /user/repo/download/file-version.js
  //todo: minify result to     /user/repo/download/file-version.min.js

  next();
});



http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
