var remote = 'https://raw.github.com';

var express = require('express');
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
  require('express-redirect').apply(app);
});

app.configure('development', function(){
  app.use(express.errorHandler());
});
app.configure('production', function(){
  app.use(function (err, req, res, next) {
    if (err && err.message) {
      res.send(500, err.message);
    } else {
      next(err);
    }
  });
});

//static routes
app.get('/', require('./routes/index'));
app.get('/component-badge.svg', require('./routes/component-badge'));

//static redirects
app.redirect('/refer/:repo/:user', '/:repo/:user'); // should be 301, but may change in the future
app.redirect('/:user/:repo/component-badge.svg', '/component-badge.svg');

//dynamic routes
app.get('/:user', require('./routes/user'));
app.get('/:user/:repo', require('./routes/repo'));

app.get('/:user/:repo/download', require('./routes/download-listing'));

app.get('/:user/:repo/download/latest.js', require('./routes/latest')(false));
app.get('/:user/:repo/download/latest.min.js', require('./routes/latest')(true));

app.get('/:user/:repo/download/:file.js', require('./routes/download-standalone'));


http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
