var Q = require('q');

var Builder = require('component-builder');

var path = require('path');
var join = path.join;

var fs = require('fs');
var mkdir = Q.nbind(fs.mkdir);
var exists = function (path) {
  var def = Q.defer();
  fs.exists(path, def.resolve);
  return def.promise;
}

function camelCase(name) {
  return name.replace(/\-(\w)/g, function (_, c) { return c.toUpperCase(); });
}

function build(dir, name) {
  return exists(path.join(dir, 'build'))
    .then(function (exists) {
      if (!exists) return mkdir(path.join(dir, 'build'));
    })
    .then(function () {
      var builder = new Builder(dir);
      builder.paths = [join(dir, 'components')];
      return Q.nbind(builder.build, builder)();
    })
    .then(function (obj) {
      var outstanding = 2;
      var def = Q.defer();
      function complete() {
        if (--outstanding == 0) {
          def.resolve();
        }
      }

      var js = fs.createWriteStream(path.join(dir, 'build', 'build.js'));
      var css = fs.createWriteStream(path.join(dir, 'build', 'build.css'));
      
      js.on('error', def.reject);
      css.on('error', def.reject);
      js.on('close', complete);
      css.on('close', complete);

      css.write(obj.css);
      css.end();

      js.write(';(function(){\n');
      js.write(obj.require);
      js.write(obj.js);
      var lib = 'require("' + name + '")';
      js.write('if (typeof module != "undefined" && typeof module.exports != "undefined") {\n');
      js.write('  module.exports = ' + lib + '\n');
      js.write('} else if (typeof define == "function") {\n');
      js.write('  define("' + name + '", [], function () {\n');
      js.write('    return ' + lib + '\n');
      js.write('  });')
      js.write('} else {\n');
      js.write('  window.' + camelCase(name) + ' = ' + lib + '\n');
      js.write('}\n');
      js.write('}())');
      js.end();

      return def.promise;
    });
}

module.exports = build;