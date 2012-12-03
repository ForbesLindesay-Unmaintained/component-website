var badge = require("component-badge");

// `/component-badge.png`

module.exports = route;
function route(req, res, next) {
  listing()
    .then(function (listing) {
      res.type('svg');
      res.send(badge(listing.count), { scale: 0.5 });
    })
    .done(null, next);
}