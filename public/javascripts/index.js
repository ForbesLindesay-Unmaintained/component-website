var subNav = require('booting-sub-nav');

var elements = document.getElementsByClassName('fix-when-top');
for (var i = 0; i < elements.length; i++) {
  subNav(elements[i], 0, 'fixed-top');
}
