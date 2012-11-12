var Q = require('q');
var listing = require('../get-components-list');

// `/`

module.exports = route;
function route(req, res, next) {
  listing()
    .then(function (listing) {
      var headings = listing.headings;
      var html = listing.html;

      res.render('index', {
        title: 'Component',
        headings: headings,
        components: html
      })
    })
    .done(null, next);
}