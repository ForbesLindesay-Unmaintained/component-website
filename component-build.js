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
      var outstanding = 3;
      var def = Q.defer();
      function complete() {
        if (--outstanding === 0) {
          def.resolve();
        }
      }

      var js = fs.createWriteStream(path.join(dir, 'build', 'build.js'));
      var css = fs.createWriteStream(path.join(dir, 'build', 'build.css'));
      var both = fs.createWriteStream(path.join(dir, 'build', 'build.component.js'));
      
      js.on('error', def.reject);
      css.on('error', def.reject);
      both.on('error', def.reject);
      js.on('close', complete);
      css.on('close', complete);
      both.on('close', complete);

      css.write(obj.css);
      css.end();

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
      js.write(umd)
      js.write('}())');
      js.end();

      both.write(';(function(){\n')
      both.write(obj.require);
      both.write(obj.js)
      both.write('var style = document.createElement(\'style\')\n')
      both.write('style.appendChild(document.createTextNode('+JSON.stringify(obj.css)+'))\n')
      both.write('document.getElementsByTagName(\'head\')[0].appendChild(style)\n')
      both.write(umd)
      both.write('}())')
      both.end()

      return def.promise;
    });
}

module.exports = build;