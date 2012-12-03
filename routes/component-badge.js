var badge = require("component-badge");

// `/component-badge.png`

module.exports = route;
function route(req, res, next) {
  res.type('svg');
  res.send(badge(10), { scale: 0.5 });
}