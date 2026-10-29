/*
 * SiteWebmentions — 从 webmention.io 加载并展示当前文章的 Webmentions。
 * 所有外部内容均通过 textContent 渲染，不执行来源站点提供的 HTML。
 */
(function () {
  'use strict';

  var FACE_TYPES = {
    'like-of': '喜欢',
    'repost-of': '转发',
    'bookmark-of': '收藏'
  };

  var TEXT_TYPES = {
    'in-reply-to': '回复了本文',
    'mention-of': '提及了本文',
    'rsvp': '回应了活动邀请'
  };

  function safeUrl(value) {
    try {
      var url = new URL(value);
      return /^https?:$/.test(url.protocol) ? url.toString() : '';
    } catch (e) {
      return '';
    }
  }

  function element(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function authorName(mention) {
    var author = mention.author || {};
    if (author.name) return String(author.name);
    var url = safeUrl(mention.url || mention['wm-source']);
    if (url) {
      try { return new URL(url).hostname; } catch (e) { /* 使用下面的兜底 */ }
    }
    return '匿名访客';
  }

  function avatar(mention) {
    var author = mention.author || {};
    var name = authorName(mention);
    var photo = safeUrl(author.photo).replace(/^http:\/\//i, 'https://');
    if (photo) {
      var img = element('img', 'wm-avatar');
      img.src = photo;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', function () {
        img.replaceWith(avatarFallback(name));
      });
      return img;
    }
    return avatarFallback(name);
  }

  function avatarFallback(name) {
    return element('span', 'wm-avatar wm-avatar-fallback',
      (String(name || '匿').trim().charAt(0) || '匿').toUpperCase());
  }

  function linkOrSpan(url, className, text) {
    var el = element(url ? 'a' : 'span', className, text);
    if (url) {
      el.href = url;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    }
    return el;
  }

  function formatDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    function pad(number) { return number < 10 ? '0' + number : String(number); }
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function renderReactionGroup(type, mentions) {
    var group = element('section', 'wm-face-group');
    group.appendChild(element('h3', 'wm-group-title',
      FACE_TYPES[type] + '（' + mentions.length + '）'));
    var faces = element('div', 'wm-faces');

    mentions.forEach(function (mention) {
      var name = authorName(mention);
      var url = safeUrl(mention.url || mention['wm-source'] ||
        (mention.author && mention.author.url));
      var face = linkOrSpan(url, 'wm-face', '');
      face.title = name + ' · ' + FACE_TYPES[type];
      face.appendChild(avatar(mention));
      faces.appendChild(face);
    });

    group.appendChild(faces);
    return group;
  }

  function renderMention(mention) {
    var item = element('article', 'wm-item');
    item.appendChild(avatar(mention));

    var body = element('div', 'wm-body');
    var head = element('div', 'wm-head');
    var author = mention.author || {};
    var name = authorName(mention);
    var authorUrl = safeUrl(author.url);
    head.appendChild(linkOrSpan(authorUrl, 'wm-author', name));

    var type = mention['wm-property'];
    head.appendChild(element('span', 'wm-action', TEXT_TYPES[type] || '链接了本文'));

    var date = formatDate(mention.published || mention.updated || mention['wm-received']);
    var source = safeUrl(mention.url || mention['wm-source']);
    if (date) {
      var time = element('time', 'wm-time', date);
      if (mention.published) time.dateTime = mention.published;
      head.appendChild(time);
    }
    body.appendChild(head);

    var content = mention.content;
    var text = content && typeof content === 'object' ? content.text : content;
    text = text || mention.summary || mention.name || '';
    if (text) body.appendChild(element('p', 'wm-content', String(text)));

    if (source) {
      var sourceLink = linkOrSpan(source, 'wm-source', '查看原文 ↗');
      body.appendChild(sourceLink);
    }

    item.appendChild(body);
    return item;
  }

  function render(root, mentions) {
    var reactions = root.querySelector('.wm-reactions');
    var list = root.querySelector('.wm-list');
    var status = root.querySelector('.wm-status');
    var count = root.querySelector('.wm-count');
    reactions.textContent = '';
    list.textContent = '';

    var grouped = { 'like-of': [], 'repost-of': [], 'bookmark-of': [] };
    var textMentions = [];

    mentions.forEach(function (mention) {
      var type = mention['wm-property'];
      if (grouped[type]) grouped[type].push(mention);
      else textMentions.push(mention);
    });

    Object.keys(grouped).forEach(function (type) {
      if (grouped[type].length) {
        reactions.appendChild(renderReactionGroup(type, grouped[type]));
      }
    });
    textMentions.forEach(function (mention) {
      list.appendChild(renderMention(mention));
    });

    count.hidden = mentions.length === 0;
    count.textContent = mentions.length ? '(' + mentions.length + ')' : '';
    status.hidden = mentions.length > 0;
    status.textContent = mentions.length ? '' : '还没有 Webmention。';
  }

  function init(options) {
    var root = typeof options.el === 'string' ? document.querySelector(options.el) : options.el;
    if (!root || !options.target) return;

    var api = String(options.api || 'https://webmention.io/api/mentions.jf2');
    var separator = api.indexOf('?') === -1 ? '?' : '&';
    var url = api + separator + 'target=' + encodeURIComponent(options.target) +
      '&per-page=100&sort-by=published&sort-dir=up';

    fetch(url, { credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.children)) throw new Error('Bad response');
        render(root, data.children);
      })
      .catch(function (error) {
        console.error('[webmentions] load failed:', error);
        var status = root.querySelector('.wm-status');
        status.hidden = false;
        status.textContent = 'Webmentions 暂时加载失败，仍可手动发送。';
      });
  }

  window.SiteWebmentions = { init: init };
})();
