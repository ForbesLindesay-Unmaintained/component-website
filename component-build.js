var Q = require('q');

var Builder = require('component-builder');

var path = require('path');
var join = path.join;

var fs = require('fs');
var mkdir = Q.nfbind(fs.mkdir);
var exists = function (path) {
  var def = Q.defer();
  fs.exists(path, def.resolve);
  return def.promise;
}

function camelCase(name) {
  return name.replace(/\-(\w)/g, function (_, c) { return c.toUpperCase(); })
             .replace(/\.js$/, '');
}

function build(dir, name) {
  return exists(path.join(dir, 'build'))
    .then(function (exists) {
      if (!exists) return mkdir(path.join(dir, 'build'));
    })
    .then(function () {
      var builder = new Builder(dir);
      builder.paths = [join(dir, 'components')];
      return Q.nfbind(builder.build.bind(builder))();
    })
    .then(function (obj) {
      var def = Q.defer();
      var js = fs.createWriteStream(path.join(dir, 'build', 'build.js'));
      
      js.on('error', def.reject);
      js.on('close', def.resolve);

      var lib = 'require("' + name + '")';
      var umd =
        'if (typeof module != "undefined" && typeof module.exports != "undefined") {\n'
        +'  module.exports = ' + lib + '\n'
        +'} else if (typeof define == "function") {\n'
        +'  define("' + name + '", [], function () {\n'
        +'    return ' + lib + '\n'
        +'  });'
        +'} else {\n'
        +'  window.' + camelCase(name) + ' = ' + lib + '\n'
        +'}\n'

      js.write(';(function(){\n');
      js.write(obj.require);
      js.write(obj.js);
      if (obj.css) {
        js.write('var style = document.createElement(\'style\')\n')
        js.write('style.appendChild(document.createTextNode('+JSON.stringify(obj.css)+'))\n')
        js.write('document.getElementsByTagName(\'head\')[0].appendChild(style)\n')
      }
      js.write(umd)
      js.write('}())');
      js.end();

      return def.promise;
    });
}

module.exports = build;