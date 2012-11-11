var remote = 'https://raw.github.com';

var express = require('express');
var http = require('http');
var path = require('path');
var marked = require('marked');
var hljs = require('highlight.js');

var Q = require('q');
var github = require('./github');
var componentLib = require('component');

marked.setOptions({
  gfm: true,
  pedantic: false,
  sanitize: false,
  highlight: function(code, lang) {
    if (lang) {
      try {
        return hljs.highlight(lang.toLowerCase(), code).value;
      } catch (ex) {}
    }
    return code;
  }
});

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

var travisRegex = /^\[\!\[Build Status\]\([^\)]+\)\]\([^\)]+\)\n?$/;
function makeHeadingID(text) {
  return text.toLowerCase().replace(/ /g, '-').replace(/[^\-\w]/g, '');
}

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

      var travis = false;
      var tokens = marked.lexer(readme);
      //todo: build ToC etc.
      tokens = tokens.filter(function (token) {
        if (token.type == 'paragraph' && travisRegex.test(token.text)) {
          travis = marked(token.text).replace(/\<p\>/g, '<div class="travis-status">').replace(/\<\/p\>/g, '</div>');
          return false;
        }
        return token.type != 'heading' || token.depth != 1;
      })
      var newTokens = [];
      var first = true;
      var headings = [];
      tokens.forEach(function (token) {
        if (token.type == 'heading' && token.depth == 2 && !first) {
          newTokens.push({
            type: 'html',
            pre: true,
            text: '</div></section><section class="page"><div class="content">'
          });
        } else if (first && token.type != 'heading') {
          headings.push({id: 'introduction', text: 'Introduction', children: []});
          newTokens.push({
            type: 'html',
            pre: true,
            text: '<a id="introduction" style="margin-bottom:60px; display: block;"></a>'
          });
          newTokens.push({
            type: 'heading',
            depth: 2,
            text: 'Introduction'
          });
        }
        if (token.type == 'heading') {
          if (token.depth == 2) {
            headings.push({id: makeHeadingID(token.text), text: token.text, children: []});
          } else if (token.depth == 3 && headings.length) {
            headings[headings.length - 1].children.push({id: makeHeadingID(token.text), text: token.text});
          }
          if (token.depth == 2 || token.depth == 3) {
            newTokens.push({
              type: 'html',
              pre: true,
              text: '<a id="' + makeHeadingID(token.text) + '" style="margin-bottom:40px; display: block;"></a>'
            });
          }
        }
        first = false;
        newTokens.push(token);
      });
      tokens = newTokens;

      var html = marked.parser(tokens);

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
        readme: '/' + user + '/' + repo,
        devRelease: {
          download: '/' + user + '/' + repo + '/download/' + component.name + '-dev.js',
          downloadMin: '/' + user + '/' + repo + '/download/' + component.name + '-dev.min.js'
        },
        versions: tags.map(function (tag) {
          return {
            version: tag.version,
            download: '/' + user + '/' + repo + '/download/' + component.name + '-' + tag.version + '.js',
            downloadMin: '/' + user + '/' + repo + '/download/' + component.name + '-' + tag.version + '.min.js'
          }
        })
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
