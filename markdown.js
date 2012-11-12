var marked = require('marked');
var hljs = require('highlight.js');

marked.setOptions({
  gfm: true,
  pedantic: false,
  sanitize: false,
  highlight: function(code, lang) {
    if (lang) {
      try {
        return hljs.highlight(lang.toLowerCase(), code).value;
      } catch (ex) {}
    }
    return code;
  }
});

var travisRegex = /^\[\!\[Build Status\]\([^\)]+\)\]\([^\)]+\)\n?$/;
function makeHeadingID(text) {
  return text.toLowerCase().replace(/ /g, '-').replace(/[^\-\w]/g, '');
}

module.exports = parse;
function parse(markdown) {
  var travis = false;
  var tokens = marked.lexer(markdown);
  var links = tokens.links;
  tokens = tokens.filter(function (token) {
    if (token.type == 'paragraph' && travisRegex.test(token.text)) {
      travis = marked(token.text).replace(/\<p\>/g, '<div class="travis-status">').replace(/\<\/p\>/g, '</div>');
      return false;
    }
    return token.type != 'heading' || token.depth != 1;
  })
  var newTokens = [];
  var first = true;
  var headings = [];
  tokens.forEach(function (token) {
    if (token.type == 'heading' && token.depth == 2 && !first) {
      newTokens.push({
        type: 'html',
        pre: true,
        text: '</div></section><section class="page"><div class="content">'
      });
    } else if (first && token.type != 'heading') {
      headings.push({id: 'introduction', text: 'Introduction', children: []});
      newTokens.push({
        type: 'html',
        pre: true,
        text: '<a id="introduction" style="margin-bottom:60px; display: block;"></a>'
      });
      newTokens.push({
        type: 'heading',
        depth: 2,
        text: 'Introduction'
      });
    }
    if (token.type == 'heading') {
      if (token.depth == 2) {
        headings.push({id: makeHeadingID(token.text), text: token.text, children: []});
      } else if (token.depth == 3 && headings.length) {
        headings[headings.length - 1].children.push({id: makeHeadingID(token.text), text: token.text});
      }
      if (token.depth == 2 || token.depth == 3) {
        newTokens.push({
          type: 'html',
          pre: true,
          text: '<a id="' + makeHeadingID(token.text) + '" style="margin-bottom:40px; display: block;"></a>'
        });
      }
    }
    first = false;
    newTokens.push(token);
  });
  console.log(tokens.links);
  tokens = newTokens;
  tokens.links = links;

  var html = marked.parser(tokens);

  return {html: html, headings: headings, travis: travis};
}