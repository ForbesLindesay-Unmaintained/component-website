var Q = require('q');
var request = Q.nbind(require('request'));
var markdown = require('./markdown');

var cache = false;

module.exports = loadWiki;
function loadWiki() {
  if (cache) {
    return cache;
  }
  setTimeout(function () {
    cache = false;
  }, 5 * 60 * 1000);
  return cache = request('https://github.com/component/component/wiki/Components')
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
          return data;
        }
      }
    })
    .then(function (data) {
      data = splitIntoSections(data, 2);
      data.shift();
      data = splitOutRepositories(data);

      return data.map(function (element) {
        if (element.type === 'heading') {
          var buf = '';
          for (var i = 0; i < element.depth; i++) {
            buf += '#';
          }
          buf += ' ' + element.content;
          return '\n' + buf + '\n';
        } else if (element.type === 'component') {
          return ' - [' + element.repo + '](/' + element.repo +
              ') - ' + element.description.trim();
        } else {
          throw new Error('Unrecognised element type: ' + element.type);
        }
      }).join('\n');
    })
    .then(function (markdownSrc) {
      return markdown(markdownSrc);
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