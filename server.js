var remote = 'https://raw.github.com';

var express = require('express');
var http = require('http');
var path = require('path');

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

app.get('/:user', require('./routes/user'));
app.get('/:user/:repo', require('./routes/repo'));
app.get('/:user/:repo/download', require('./routes/download-listing'));

app.get('/:user/:repo/download/latest.js', require('./routes/latest')(false));
app.get('/:user/:repo/download/latest.min.js', require('./routes/latest')(true));

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
