var Q = require('q');
var request = Q.nfbind(require('request'));
var markdown = require('./markdown');
var github = require('./github');

var cache = loadWiki();
var count = 0;

setInterval(function () {
  var next = loadWiki();
  next.then(function () {
    cache = next;
  });
}, 15 * 60 * 1000);

module.exports = function () {
  return cache;
};
function loadWiki() {
  return request('https://github.com/component/component/wiki/Components')
    .then(function (data) {
      data = data.toString().replace(/\r?\n/g, '');
      data = data.substring(data.indexOf('<div class="markdown-body">') + '<div class="markdown-body">'.length);
      var depth = 1;
      for (var i = 0; i < data.length; i++) {
        if (data.substr(i, 4) == '<div') {
          depth++;
        } else if (data.substr(i, 5) == '</div') {
          depth--;
        }
        if (depth == 0) {
          data = data.substr(0, i);
        }
      }
      data = splitIntoSections(data, 2);
      data.shift();
      data = splitOutRepositories(data);
      count = data.length;
      return Q.all(data.map(function (element) {
        if (element.type != 'component') return element;
        var user = element.repo.split('/')[0];
        var repo = element.repo.split('/')[1];
        return Q.all([github.getComponent(user, repo).fail(function () { return null; }), 
                      github.getReadme(user, repo).fail(function () { return ''; })])
          .spread(function (component, readme) {
            element.component = component;
            element.readme = readme;
            return element;
          });
      }));
    })
    .then(function (data) {
      return data.map(function (element) {
        if (element.type === 'heading') {
          var buf = '';
          for (var i = 0; i < element.depth; i++) {
            buf += '#';
          }
          buf += ' ' + element.content;
          return '\n' + buf + '\n';
        } else if (element.type === 'component') {

          var buf = ' - [' + element.repo + '](/' + element.repo +
              ') - ' + element.description.trim();
          if (element.readme) {
            var md = markdown(element.readme);
            if (md.travis)
              buf += ' ' + '[![Build Status](https://secure.travis-ci.org/' + element.repo + '.png)](http://travis-ci.org/' + element.repo + ')';
          } else {
            buf += ' <span style="color: red;">Missing readme</span>';
          }
          if (element.component) {
            if (typeof element.component.license == 'string') 
              buf += ' <span class="license">' + element.component.license + '</span>';
          } else {
            buf += ' <span style="color: red;">Missing component.json</span>';
          }
          return buf;
        } else {
          throw new Error('Unrecognised element type: ' + element.type);
        }
      }).join('\n');
    })
    .then(function (markdownSrc) {
      var parsed = markdown(markdownSrc);
      parsed.count = count;
      return parsed;
    });
}

function splitIntoSections(data, level, output) {
  output = output || [];
  var tag = 'h' + level;
  data.split('<' + tag + '>')
    .forEach(function (section) {
      section = section.split('</' + tag + '>');
      if (section.length === 1) {
        output.push({
          type: 'text',
          content: section[0]
        })
      } else {
        output.push({
          type: 'heading',
          depth: level,
          content: section[0].replace(/\<[^\>]*\>/g, '')
        });
        splitIntoSections(section[1], level + 1, output);
      }
    });
  return output;
}

function splitOutRepositories(data) {
  var output = [];
  data.forEach(function (element) {
    if (element.type == 'heading') return output.push(element);
    var lis = element.content.split('<li>');
    lis.shift();
    lis.forEach(function (li) {
      li = li.split('</li>')[0];
      li = li.split('</a>');
      var repo = li[0].replace(/\<[^\>]*\>/g, '').trim();
      var description = li[1].substring(3);//.replace(/\<\/?code\>/g, '`');
      output.push({
        type: 'component',
        repo: repo,
        description: description
      });
    });
  });
  return output;
}