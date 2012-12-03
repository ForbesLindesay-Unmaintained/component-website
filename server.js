var remote = 'https://raw.github.com';

var express = require('express');
var redirect = require('express-redirect');
var http = require('http');
var path = require('path');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon(path.join(__dirname, 'public', 'favicon.ico')));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(app.router);
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

function redirect(target) {
	return function redirection(req, res, next) {

	};
}

app.get('/', require('./routes/index'));
app.get('/:user', require('./routes/user'));
app.get('/:user/:repo', require('./routes/repo'));
app.get('/:user/:repo/download', require('./routes/download-listing'));

app.get('/:user/:repo/download/latest.js', require('./routes/latest')(false));
app.get('/:user/:repo/download/latest.min.js', require('./routes/latest')(true));

app.get('/:user/:repo/download/:file.js', require('./routes/download-standalone'));



http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
