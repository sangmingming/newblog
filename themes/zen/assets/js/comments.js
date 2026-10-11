/*
 * SiteComments — 极简 Waline 评论前端
 *
 * 后端复用 Waline 服务端（仅调 /api/comment），前端只提供：
 * 评论展示 / 发表评论 / 回复评论。无登录、无注册、无点赞。
 *
 * 用法（与 Sodesu / Waline 客户端的初始化方式一致）：
 *   SiteComments.init({
 *     el: '#comments',
 *     serverURL: 'https://waline-comments.isming.me',
 *     path: window.location.pathname, // 可选，默认取当前路径
 *     pageSize: 10                    // 可选
 *   });
 *
 * 样式在 assets/css/common/comments.css，随主题的 common/*.css 自动合并。
 */
(function () {
  'use strict';

  /* ---------- 工具函数 ---------- */

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 只允许 http(s) 链接，其余一律丢弃，防止 javascript: 之类的协议
  function safeUrl(s) {
    try {
      var u = new URL(s);
      return /^https?:$/.test(u.protocol) ? u.toString() : '';
    } catch (e) {
      return '';
    }
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function fmtTime(ms) {
    var d = new Date(Number(ms) || 0);
    if (isNaN(d.getTime())) return '';
    var diff = Date.now() - d.getTime();
    // 未来时间或一分钟内
    if (diff < 60 * 1000) return '刚刚';
    // 一天以内：几分钟前 / 几小时前
    if (diff < 24 * 3600 * 1000) {
      var mins = Math.floor(diff / 60000);
      if (mins < 60) return mins + ' 分钟前';
      return Math.floor(mins / 60) + ' 小时前';
    }
    // 一周以内：几天前
    if (diff < 7 * 24 * 3600 * 1000) {
      return Math.floor(diff / (24 * 3600 * 1000)) + ' 天前';
    }
    // 更早：只显示日期
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // 无头像 / 头像加载失败时，用昵称首字符画一个圆形占位
  function makeAvatarFallback(nick) {
    var div = document.createElement('div');
    div.className = 'cm-avatar cm-avatar-fallback';
    div.textContent = (String(nick || '匿').trim().charAt(0) || '匿').toUpperCase();
    return div;
  }

  // Waline 客户端约定的排序参数（latest → insertedAt_desc）
  var SORT_LATEST = 'insertedAt_desc';

  function apiBase(serverURL) {
    var s = String(serverURL || '').replace(/\/+$/, '');
    return s.endsWith('/api') ? s : s + '/api';
  }

  /* ---------- 主初始化 ---------- */

  function init(opts) {
    var root = typeof opts.el === 'string' ? document.querySelector(opts.el) : opts.el;
    if (!root) return;

    var api = apiBase(opts.serverURL);
    var pagePath = opts.path || window.location.pathname;
    var pageSize = opts.pageSize || 10;

    var state = {
      page: 0,
      totalPages: 1,
      count: 0,
      loading: false,
      replyTo: null // { pid, rid, at }
    };

    /* ---------- 骨架 ---------- */

    root.innerHTML =
      '<div class="cm-box">' +
        '<div class="cm-fields">' +
          '<input class="cm-input" name="nick" maxlength="30" placeholder="昵称（必填）" />' +
          '<input class="cm-input" name="mail" type="email" maxlength="50" placeholder="邮箱（必填，不会公开）" />' +
          '<input class="cm-input" name="link" type="url" maxlength="100" placeholder="网站（可选，https://）" />' +
        '</div>' +
        '<textarea class="cm-editor" rows="4" placeholder="来说点什么吧…"></textarea>' +
        '<div class="cm-foot">' +
          '<span class="cm-reply-hint" hidden>' +
            '回复 <b class="cm-reply-target"></b>' +
            '<button type="button" class="cm-reply-cancel">取消</button>' +
          '</span>' +
          '<button type="button" class="cm-submit">发布</button>' +
        '</div>' +
        '<div class="cm-msg" hidden></div>' +
      '</div>' +
      '<div class="cm-count" hidden></div>' +
      '<div class="cm-list"></div>' +
      '<div class="cm-more-wrap" hidden><button type="button" class="cm-more">加载更多</button></div>';

    var nickInput  = root.querySelector('[name="nick"]');
    var mailInput  = root.querySelector('[name="mail"]');
    var linkInput  = root.querySelector('[name="link"]');
    var editor     = root.querySelector('.cm-editor');
    var submitBtn  = root.querySelector('.cm-submit');
    var msgBox     = root.querySelector('.cm-msg');
    var countBox   = root.querySelector('.cm-count');
    var listBox    = root.querySelector('.cm-list');
    var moreWrap   = root.querySelector('.cm-more-wrap');
    var moreBtn    = root.querySelector('.cm-more');
    var replyHint  = root.querySelector('.cm-reply-hint');
    var replyTarget = root.querySelector('.cm-reply-target');
    var replyCancel = root.querySelector('.cm-reply-cancel');

    // 输入框的「家」：顶部原始位置。回复时整个输入框会被移动到目标评论下方，
    // 取消或发布成功后再移回来。
    var box         = root.querySelector('.cm-box');
    var boxHome     = box.parentNode;
    var boxHomeNext = box.nextSibling;

    // 记住访客信息，下次不用再填
    try {
      var saved = JSON.parse(localStorage.getItem('site-comments-user') || '{}');
      if (saved.nick) nickInput.value = saved.nick;
      if (saved.mail) mailInput.value = saved.mail;
      if (saved.link) linkInput.value = saved.link;
    } catch (e) { /* localStorage 不可用时忽略 */ }

    // 校验失败标红后，用户一输入就恢复正常边框
    [nickInput, mailInput, linkInput, editor].forEach(function (el) {
      el.addEventListener('input', function () { el.classList.remove('cm-invalid'); });
    });

    function showMsg(text, isError) {
      msgBox.textContent = text;
      msgBox.classList.toggle('cm-msg-error', !!isError);
      msgBox.hidden = !text;
    }

    /* ---------- 加载评论 ---------- */

    function loadComments() {
      if (state.loading) return;
      state.loading = true;
      moreBtn.disabled = true;

      var url = api + '/comment?path=' + encodeURIComponent(pagePath) +
                '&page=' + (state.page + 1) + '&pageSize=' + pageSize +
                '&sortBy=' + SORT_LATEST + '&lang=zh-CN';

      fetch(url, { credentials: 'omit' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (json) {
          if (!json || json.errno !== 0 || !json.data) {
            throw new Error((json && json.errmsg) || 'bad response');
          }
          var payload = json.data;
          state.page = payload.page;
          state.totalPages = payload.totalPages || 0;
          state.count = payload.count || 0;

          if (state.page === 1) listBox.innerHTML = '';

          var roots = (payload.data || []).slice();
          // 置顶评论排在最前（仅当前页内）
          roots.sort(function (a, b) { return (b.sticky ? 1 : 0) - (a.sticky ? 1 : 0); });
          roots.forEach(function (c) { listBox.appendChild(renderRoot(c)); });

          countBox.hidden = state.count === 0;
          countBox.textContent = state.count > 0 ? '共 ' + state.count + ' 条评论' : '';
          if (state.count === 0 && state.page >= state.totalPages) {
            listBox.innerHTML = '<p class="cm-empty">还没有评论，来抢沙发～</p>';
          }
          moreWrap.hidden = !(state.page < state.totalPages);
        })
        .catch(function (err) {
          console.error('[comments] load failed:', err);
          if (state.page === 0) {
            listBox.innerHTML = '<p class="cm-empty">评论加载失败，请稍后刷新重试。</p>';
          }
        })
        .finally(function () {
          state.loading = false;
          moreBtn.disabled = false;
        });
    }

    /* ---------- 渲染 ---------- */

    function renderRoot(c) {
      var item = renderItem(c, false);
      var children = Array.isArray(c.children) ? c.children : [];
      if (children.length) {
        var childWrap = document.createElement('div');
        childWrap.className = 'cm-children';
        children.forEach(function (child) {
          childWrap.appendChild(renderItem(child, true, c.objectId));
        });
        // 子评论挂在正文区域里，显示在父评论内容的下方（而非并排）
        item.querySelector('.cm-body').appendChild(childWrap);
      }
      return item;
    }

    function renderItem(c, isChild, rootId) {
      var item = document.createElement('div');
      item.className = 'cm-item' + (isChild ? ' cm-item-child' : '');
      item.setAttribute('data-id', c.objectId);

      var avatar;
      if (c.avatar) {
        avatar = document.createElement('img');
        avatar.className = 'cm-avatar';
        avatar.loading = 'lazy';
        avatar.alt = '';
        avatar.src = c.avatar;
        // 头像加载失败时降级为昵称首字符
        avatar.addEventListener('error', function () {
          avatar.replaceWith(makeAvatarFallback(c.nick));
        });
      } else {
        avatar = makeAvatarFallback(c.nick);
      }

      var body = document.createElement('div');
      body.className = 'cm-body';

      var head = document.createElement('div');
      head.className = 'cm-head';

      var link = safeUrl(c.link);
      var nickHtml = escapeHtml(c.nick || '匿名');
      var nickEl;
      if (link) {
        nickEl = document.createElement('a');
        nickEl.href = link;
        nickEl.target = '_blank';
        nickEl.rel = 'noopener noreferrer';
        nickEl.className = 'cm-nick';
        nickEl.innerHTML = nickHtml;
      } else {
        nickEl = document.createElement('span');
        nickEl.className = 'cm-nick';
        nickEl.innerHTML = nickHtml;
      }
      head.appendChild(nickEl);

      if (c.type === 'administrator') {
        var badge = document.createElement('span');
        badge.className = 'cm-badge';
        badge.textContent = '博主';
        head.appendChild(badge);
      }
      if (isChild && c.reply_user && c.reply_user.nick) {
        var replyTo = document.createElement('span');
        replyTo.className = 'cm-reply-to';
        replyTo.textContent = '回复 @' + c.reply_user.nick;
        head.appendChild(replyTo);
      }

      var time = document.createElement('time');
      time.className = 'cm-time';
      time.textContent = fmtTime(c.time);
      head.appendChild(time);

      var replyBtn = document.createElement('button');
      replyBtn.type = 'button';
      replyBtn.className = 'cm-reply';
      replyBtn.textContent = '回复';
      replyBtn.addEventListener('click', function () {
        setReplyTo({
          pid: c.objectId,
          rid: isChild ? rootId : c.objectId,
          at: c.nick || ''
        }, item);
      });
      head.appendChild(replyBtn);

      var content = document.createElement('div');
      content.className = 'cm-content';
      // comment 字段是 Waline 服务端经 DOMPurify 过滤后的 HTML，可直接渲染
      content.innerHTML = c.comment || '';

      body.appendChild(head);

      // 昵称下方展示浏览器 / 系统信息，接口没返回就不显示
      var uaParts = [];
      if (c.browser) uaParts.push(c.browser);
      if (c.os) uaParts.push(c.os);
      if (uaParts.length) {
        var ua = document.createElement('div');
        ua.className = 'cm-ua';
        ua.textContent = uaParts.join(' · ');
        body.appendChild(ua);
      }

      body.appendChild(content);
      item.appendChild(avatar);
      item.appendChild(body);
      return item;
    }

    /* ---------- 回复状态 ---------- */

    // 找到某条评论条目直属的正文区域（不能往下钻到子评论的 .cm-body）
    function ownBody(itemEl) {
      for (var i = 0; i < itemEl.children.length; i++) {
        if (itemEl.children[i].classList.contains('cm-body')) return itemEl.children[i];
      }
      return itemEl;
    }

    function setReplyTo(target, itemEl) {
      state.replyTo = target;
      showMsg('');
      if (target && itemEl) {
        replyTarget.textContent = '@' + target.at;
        replyHint.hidden = false;
        // 把输入框移动到被回复评论的正下方
        ownBody(itemEl).appendChild(box);
        box.classList.add('cm-box-replying');
        editor.focus();
      } else {
        replyHint.hidden = true;
        box.classList.remove('cm-box-replying');
        // 移回顶部原始位置
        boxHome.insertBefore(box, boxHomeNext);
      }
    }

    replyCancel.addEventListener('click', function () { setReplyTo(null); });

    /* ---------- 发布 ---------- */

    function submit() {
      var nick = nickInput.value.trim();
      var mail = mailInput.value.trim();
      var link = linkInput.value.trim();
      var text = editor.value.trim();

      // 昵称 / 邮箱 / 评论内容必填，为空的输入框标红
      var okNick = !!nick;
      var okMail = !!mail;
      var okText = !!text;
      nickInput.classList.toggle('cm-invalid', !okNick);
      mailInput.classList.toggle('cm-invalid', !okMail);
      editor.classList.toggle('cm-invalid', !okText);
      if (!okNick || !okMail || !okText) {
        showMsg('昵称、邮箱和评论内容都是必填项', true);
        (!okNick ? nickInput : !okMail ? mailInput : editor).focus();
        return;
      }
      if (link && !safeUrl(link)) {
        linkInput.classList.add('cm-invalid');
        showMsg('网站地址需要以 http(s):// 开头', true);
        linkInput.focus();
        return;
      }

      var body = {
        nick: nick,
        mail: mail,
        link: link,
        // 纯文本输入框：把单个换行转成 Markdown 硬换行，保证多行文本按原样显示
        comment: text.replace(/\r\n|\r/g, '\n').replace(/\n/g, '  \n'),
        ua: navigator.userAgent,
        url: pagePath,
        lang: 'zh-CN'
      };
      if (state.replyTo) {
        body.pid = state.replyTo.pid;
        body.rid = state.replyTo.rid;
        body.at = state.replyTo.at;
      }

      submitBtn.disabled = true;
      showMsg('');

      fetch(api + '/comment', {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.json(); })
        .then(function (json) {
          if (!json || json.errno !== 0) {
            throw new Error((json && json.errmsg) || '发布失败');
          }
          try {
            localStorage.setItem('site-comments-user',
              JSON.stringify({ nick: nick, mail: mail, link: link }));
          } catch (e) { /* ignore */ }

          editor.value = '';
          setReplyTo(null);
          showMsg('发布成功');
          // 重新拉第一页，新评论会出现在最上面
          state.page = 0;
          loadComments();
        })
        .catch(function (err) {
          showMsg(err.message || '发布失败，请稍后重试', true);
        })
        .finally(function () {
          submitBtn.disabled = false;
        });
    }

    submitBtn.addEventListener('click', submit);
    moreBtn.addEventListener('click', loadComments);

    // 滚动到底部时自动加载下一页（提前 200px 触发预加载）。
    // moreWrap 在没有更多页时是隐藏的，隐藏元素不会产生交叉，天然不会误触发；
    // 不支持 IntersectionObserver 的旧浏览器退回手动点「加载更多」。
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !moreWrap.hidden) loadComments();
        });
      }, { rootMargin: '200px' });
      io.observe(moreWrap);
    }

    loadComments();
  }

  window.SiteComments = { init: init };
})();
