var badge = require("component-badge");

// `/component-badge.png`

module.exports = route;
function route(req, res, next) {
 res.send(badge(10));
}