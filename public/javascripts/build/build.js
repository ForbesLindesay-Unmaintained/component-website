;(function(){
/**
 * Require the given path.
 *
 * @param {String} path
 * @return {Object} exports
 * @api public
 */

function require(p, parent, orig){
  var path = require.resolve(p)
    , mod = require.modules[path];

  // lookup failed
  if (null == path) {
    orig = orig || p;
    parent = parent || 'root';
    throw new Error('failed to require "' + orig + '" from "' + parent + '"');
  }

  // perform real require()
  // by invoking the module's
  // registered function
  if (!mod.exports) {
    mod.exports = {};
    mod.client = mod.component = true;
    mod.call(this, mod, mod.exports, require.relative(path));
  }

  return mod.exports;
}

/**
 * Registered modules.
 */

require.modules = {};

/**
 * Registered aliases.
 */

require.aliases = {};

/**
 * Resolve `path`.
 *
 * Lookup:
 *
 *   - PATH/index.js
 *   - PATH.js
 *   - PATH
 *
 * @param {String} path
 * @return {String} path or null
 * @api private
 */

require.resolve = function(path){
  var orig = path
    , reg = path + '.js'
    , regJSON = path + '.json'
    , index = path + '/index.js'
    , indexJSON = path + '/index.json';

  return require.modules[reg] && reg
    || require.modules[regJSON] && regJSON
    || require.modules[index] && index
    || require.modules[indexJSON] && indexJSON
    || require.modules[orig] && orig
    || require.aliases[index];
};

/**
 * Normalize `path` relative to the current path.
 *
 * @param {String} curr
 * @param {String} path
 * @return {String}
 * @api private
 */

require.normalize = function(curr, path) {
  var segs = [];

  if ('.' != path.charAt(0)) return path;

  curr = curr.split('/');
  path = path.split('/');

  for (var i = 0; i < path.length; ++i) {
    if ('..' == path[i]) {
      curr.pop();
    } else if ('.' != path[i] && '' != path[i]) {
      segs.push(path[i]);
    }
  }

  return curr.concat(segs).join('/');
};

/**
 * Register module at `path` with callback `fn`.
 *
 * @param {String} path
 * @param {Function} fn
 * @api private
 */

require.register = function(path, fn){
  require.modules[path] = fn;
};

/**
 * Alias a module definition.
 *
 * @param {String} from
 * @param {String} to
 * @api private
 */

require.alias = function(from, to){
  var fn = require.modules[from];
  if (!fn) throw new Error('failed to alias "' + from + '", it does not exist');
  require.aliases[to] = from;
};

/**
 * Return a require function relative to the `parent` path.
 *
 * @param {String} parent
 * @return {Function}
 * @api private
 */

require.relative = function(parent) {
  var p = require.normalize(parent, '..');

  /**
   * lastIndexOf helper.
   */

  function lastIndexOf(arr, obj){
    var i = arr.length;
    while (i--) {
      if (arr[i] === obj) return i;
    }
    return -1;
  }

  /**
   * The relative require() itself.
   */

  function fn(path){
    var orig = path;
    path = fn.resolve(path);
    return require(path, parent, orig);
  }

  /**
   * Resolve relative to the parent.
   */

  fn.resolve = function(path){
    // resolve deps by returning
    // the dep in the nearest "deps"
    // directory
    if ('.' != path.charAt(0)) {
      var segs = parent.split('/');
      var i = lastIndexOf(segs, 'deps') + 1;
      if (!i) i = 0;
      path = segs.slice(0, i + 1).join('/') + '/deps/' + path;
      return path;
    }
    return require.normalize(p, path);
  };

  /**
   * Check if module is defined at `path`.
   */

  fn.exists = function(path){
    return !! require.modules[fn.resolve(path)];
  };

  return fn;
};require.register("component-indexof/index.js", function(module, exports, require){

var indexOf = [].indexOf;

module.exports = function(arr, obj){
  if (indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
});
require.register("component-classes/index.js", function(module, exports, require){

/**
 * Module dependencies.
 */

var index = require('indexof');

/**
 * Whitespace regexp.
 */

var re = /\s+/;

/**
 * Wrap `el` in a `ClassList`.
 *
 * @param {Element} el
 * @return {ClassList}
 * @api public
 */

module.exports = function(el){
  return new ClassList(el);
};

/**
 * Initialize a new ClassList for `el`.
 *
 * @param {Element} el
 * @api private
 */

function ClassList(el) {
  this.el = el;
  this.list = el.classList;
}

/**
 * Add class `name` if not already present.
 *
 * @param {String} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.add = function(name){
  // classList
  if (this.list) {
    this.list.add(name);
    return this;
  }

  // fallback
  var arr = this.array();
  var i = index(arr, name);
  if (!~i) arr.push(name);
  this.el.className = arr.join(' ');
  return this;
};

/**
 * Remove class `name` when present.
 *
 * @param {String} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.remove = function(name){
  // classList
  if (this.list) {
    this.list.remove(name);
    return this;
  }

  // fallback
  var arr = this.array();
  var i = index(arr, name);
  if (~i) arr.splice(i, 1);
  this.el.className = arr.join(' ');
  return this;
};

/**
 * Toggle class `name`.
 *
 * @param {String} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.toggle = function(name){
  // classList
  if (this.list) {
    this.list.toggle(name);
    return this;
  }

  // fallback
  if (this.has(name)) {
    this.remove(name);
  } else {
    this.add(name);
  }
  return this;
};

/**
 * Return an array of classes.
 *
 * @return {Array}
 * @api public
 */

ClassList.prototype.array = function(){
  var arr = this.el.className.split(re);
  if ('' === arr[0]) arr.pop();
  return arr;
};

/**
 * Check if class `name` is present.
 *
 * @param {String} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.has = function(name){
  return this.list
    ? this.list.contains(name)
    : !! ~index(this.array(), name);
};

});
require.register("ForbesLindesay-booting-sub-nav/index.js", function(module, exports, require){
var classes = require('classes');
var scroll = require('./scroll');

function getTop(element) {
    var box = element.getBoundingClientRect();
    var clientTop  = document.documentElement.clientTop  || document.body.clientTop  || 0;
    var scrollTop  = scroll.scrollTop();
    return box.top  + scrollTop  - clientTop;
};

module.exports = subnav;
function subnav(element, offset, cls) {
    if (!cls && typeof offset === 'string') {
        cls = offset;
        offset = 0;
    }
    offset = offset || 0;
    cls = cls || 'navbar-fixed-top';
    var dataTop = getTop(element);
    classes(element).add('booting-sub-nav');
    scroll.onScroll(function(){
        if (dataTop - offset <= scroll.scrollTop())
            classes(element).add(cls);
        else
            classes(element).remove(cls);
    });
}
});
require.register("ForbesLindesay-booting-sub-nav/scroll.js", function(module, exports, require){
var prefix = "", _addEventListener, support;

// detect event model
if (window.addEventListener) {
    _addEventListener = "addEventListener";
} else {
    _addEventListener = "attachEvent";
    prefix = "on";
}

// detect available wheel event
if (document.onmousewheel !== undefined) {
    // Webkit and IE support at least "mousewheel"
    support = "mousewheel"
}
try {
    // Modern browsers support "wheel"
    WheelEvent("wheel");
    support = "wheel";
} catch (e) {}
if (!support) {
    // let's assume that remaining browsers are older Firefox
    support = "DOMMouseScroll";
}

module.exports.onScroll = function (callback) {
    window[_addEventListener](prefix  + 'scroll', callback, false);
    window[_addEventListener](prefix + 'gesturechange', callback, false);
    window[_addEventListener](prefix + support, callback, false);
    // handle MozMousePixelScroll in older Firefox
    if (support == "DOMMouseScroll") {
        window[_addEventListener](prefix + 'MozMousePixelScroll', callback, false);
    }
};

if (window.pageYOffset !== undefined) {
    module.exports.scrollTop = function () {
        return window.pageYOffset;
    };
} else {
    module.exports.scrollTop = function () {
        return (document.documentElement || document.body.parentNode || document.body).scrollTop;
    };
}
});
require.register("componentWebsite/index.js", function(module, exports, require){
var subNav = require('booting-sub-nav');

var elements = document.getElementsByClassName('fix-when-top');
for (var i = 0; i < elements.length; i++) {
  subNav(elements[i], 0, 'fixed-top');
}

});
require.alias("ForbesLindesay-booting-sub-nav/index.js", "componentWebsite/deps/booting-sub-nav/index.js");
require.alias("ForbesLindesay-booting-sub-nav/scroll.js", "componentWebsite/deps/booting-sub-nav/scroll.js");
require.alias("component-classes/index.js", "ForbesLindesay-booting-sub-nav/deps/classes/index.js");
require.alias("component-indexof/index.js", "component-classes/deps/indexof/index.js");
window.site = require("componentWebsite");
})();