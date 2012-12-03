var badge = require("component-badge");
var listing = require('../get-components-list');

// `/component-badge.png`

module.exports = route;
function route(req, res, next) {
  listing()
    .then(function (listing) {
      res.type('svg');
      res.send(badge(listing.count, { scale: 0.5 }).replace(/\s+/g, ' '));
    })
    .done(null, next);
}