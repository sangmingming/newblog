/* 简单灯箱：正文图片点击预览，仅文章详情页（single.html）加载。
 * 功能：毛玻璃背景；左右箭头 / 左右滑动切换；点击图片放大缩小；双指捏合 / 鼠标滚轮缩放；
 *       放大后单指 / 鼠标拖动平移；关闭按钮 / 点击空白 / Esc 关闭。
 * 鼠标与触屏统一走 Pointer Events。
 */
(function () {
  var MAX_SCALE = 5; // 最大放大倍数
  var SWIPE_MIN = 60; // 滑动切换的最小横向位移（px）

  function init() {
    // 只收集正文里的图片，跳过链接包裹的图片（保留原链接行为，如友情链接 logo）
    var imgs = Array.prototype.slice
      .call(document.querySelectorAll('.post-content img'))
      .filter(function (img) {
        return !img.closest('a');
      });
    if (!imgs.length) return;

    var overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', '图片预览');
    overlay.innerHTML =
      '<div class="lightbox-stage"><img class="lightbox-img" alt=""></div>' +
      '<button class="lightbox-btn lightbox-close" aria-label="关闭" title="关闭">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg></button>' +
      '<button class="lightbox-btn lightbox-prev" aria-label="上一张" title="上一张">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="15 18 9 12 15 6"/></svg></button>' +
      '<button class="lightbox-btn lightbox-next" aria-label="下一张" title="下一张">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="9 18 15 12 9 6"/></svg></button>';
    document.body.appendChild(overlay);

    var stage = overlay.querySelector('.lightbox-stage');
    var view = overlay.querySelector('.lightbox-img');
    var btnClose = overlay.querySelector('.lightbox-close');
    var btnPrev = overlay.querySelector('.lightbox-prev');
    var btnNext = overlay.querySelector('.lightbox-next');

    // 只有一张图时不显示左右箭头
    var multi = imgs.length > 1;
    if (!multi) {
      btnPrev.style.display = 'none';
      btnNext.style.display = 'none';
    }

    var index = 0;

    /* ---- 缩放 / 平移状态：transform: translate(tx, ty) scale(scale) ---- */
    var scale = 1;
    var tx = 0;
    var ty = 0;
    var swipeX = 0; // 未放大时横向跟手位移

    function applyTransform(anim) {
      view.classList.toggle('anim', !!anim);
      view.style.transform =
        'translate(' + (tx + swipeX) + 'px,' + ty + 'px) scale(' + scale + ')';
    }

    // 限制平移范围，不让图片被拖出可视区域太多
    function clampPan() {
      var maxX = Math.max(0, (view.offsetWidth * scale - stage.clientWidth) / 2);
      var maxY = Math.max(0, (view.offsetHeight * scale - stage.clientHeight) / 2);
      tx = Math.min(maxX, Math.max(-maxX, tx));
      ty = Math.min(maxY, Math.max(-maxY, ty));
    }

    // 以屏幕上某点为中心缩放
    function zoomAt(clientX, clientY, newScale, anim) {
      newScale = Math.min(MAX_SCALE, Math.max(1, newScale));
      var rect = stage.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var k = newScale / scale;
      tx = tx - (clientX - cx - tx) * (k - 1);
      ty = ty - (clientY - cy - ty) * (k - 1);
      scale = newScale;
      clampPan();
      view.classList.toggle('zoomed', scale > 1);
      applyTransform(anim);
    }

    function resetZoom(anim) {
      scale = 1;
      tx = 0;
      ty = 0;
      swipeX = 0;
      view.classList.remove('zoomed');
      applyTransform(anim);
    }

    function show(i) {
      index = (i + imgs.length) % imgs.length;
      view.src = imgs[index].currentSrc || imgs[index].src;
      view.alt = imgs[index].alt || '';
      resetZoom(false);
    }

    function open(i) {
      show(i);
      overlay.classList.add('active');
      document.body.classList.add('lightbox-lock');
    }

    function close() {
      overlay.classList.remove('active');
      document.body.classList.remove('lightbox-lock');
      resetZoom(false);
    }

    imgs.forEach(function (img, i) {
      img.addEventListener('click', function () {
        open(i);
      });
    });

    btnClose.addEventListener('click', close);
    btnPrev.addEventListener('click', function (e) {
      e.stopPropagation();
      show(index - 1);
    });
    btnNext.addEventListener('click', function (e) {
      e.stopPropagation();
      show(index + 1);
    });

    /* ---- 手势：单指/鼠标拖动平移或滑动切换，双指捏合缩放 ---- */
    var pointers = new Map(); // pointerId -> {x, y}
    var gesture = null; // 'pan' | 'swipe' | 'pinch'
    var startX = 0;
    var startY = 0;
    var startTx = 0;
    var startTy = 0;
    var pinchDist = 0;
    var pinchScale = 1;
    var pinchMid = null;
    var pinchT = null;
    var dragMoved = false; // 用于区分点击与手势

    function midOf(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function distOf(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    view.addEventListener('dragstart', function (e) {
      e.preventDefault();
    });

    view.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try {
        view.setPointerCapture(e.pointerId);
      } catch (err) { /* 合成事件无活动指针，忽略 */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      view.classList.remove('anim');

      if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        gesture = 'pinch';
        pinchDist = distOf(pts[0], pts[1]);
        pinchScale = scale;
        pinchMid = midOf(pts[0], pts[1]);
        pinchT = { x: tx, y: ty };
        dragMoved = true;
      } else if (pointers.size === 1) {
        gesture = scale > 1 ? 'pan' : 'swipe';
        startX = e.clientX;
        startY = e.clientY;
        startTx = tx;
        startTy = ty;
        swipeX = 0;
        dragMoved = false;
      }
    });

    view.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (gesture === 'pinch' && pointers.size >= 2) {
        var pts = Array.from(pointers.values());
        var mid = midOf(pts[0], pts[1]);
        var newScale = Math.min(MAX_SCALE, Math.max(1, (pinchScale * distOf(pts[0], pts[1])) / pinchDist));
        var rect = stage.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var k = newScale / pinchScale;
        // 起始捏合中点下的图像位置跟随当前双指中点
        tx = mid.x - cx - (pinchMid.x - cx - pinchT.x) * k;
        ty = mid.y - cy - (pinchMid.y - cy - pinchT.y) * k;
        scale = newScale;
        clampPan();
        applyTransform(false);
      } else if (gesture === 'pan') {
        if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) {
          dragMoved = true;
          view.classList.add('dragging');
        }
        tx = startTx + (e.clientX - startX);
        ty = startTy + (e.clientY - startY);
        clampPan();
        applyTransform(false);
      } else if (gesture === 'swipe' && multi) {
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
        // 明显横向滑动时才跟手，纵向滑动不干预
        swipeX = Math.abs(dx) > Math.abs(dy) ? dx : 0;
        applyTransform(false);
      }
    });

    function endPointer(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      view.classList.remove('dragging');

      if (gesture === 'pinch') {
        if (pointers.size === 1) {
          // 还剩一根手指：无缝转为平移 / 滑动
          var rest = Array.from(pointers.values())[0];
          gesture = scale > 1 ? 'pan' : 'swipe';
          startX = rest.x;
          startY = rest.y;
          startTx = tx;
          startTy = ty;
          swipeX = 0;
        } else if (pointers.size === 0) {
          gesture = null;
          view.classList.toggle('zoomed', scale > 1);
          applyTransform(true); // 收势动画（scale 为 1 时 clampPan 已把位移归零）
        }
        return;
      }

      if (pointers.size > 0) return;

      if (gesture === 'swipe') {
        if (multi && Math.abs(swipeX) > SWIPE_MIN) {
          dragMoved = true;
          show(index + (swipeX < 0 ? 1 : -1)); // 左滑下一张，右滑上一张
        } else {
          swipeX = 0;
          applyTransform(true); // 未达阈值，回弹
        }
      } else if (gesture === 'pan') {
        clampPan();
        applyTransform(true);
      }
      // 同步放大状态（捏合收尾会走上面的 pan/swipe 分支，统一在这里处理）
      view.classList.toggle('zoomed', scale > 1);
      gesture = null;
    }

    view.addEventListener('pointerup', endPointer);
    view.addEventListener('pointercancel', endPointer);

    // 点击图片本身：放大 / 缩小切换（拖动、滑动、捏合后不触发）
    view.addEventListener('click', function (e) {
      e.stopPropagation();
      if (dragMoved) {
        dragMoved = false;
        return;
      }
      if (scale > 1) {
        resetZoom(true);
      } else {
        // 放大到接近原图尺寸
        var fitW = view.offsetWidth || 1;
        var natural = view.naturalWidth || fitW;
        zoomAt(e.clientX, e.clientY, Math.min(MAX_SCALE, Math.max(1.5, natural / fitW)), true);
      }
    });

    // 鼠标滚轮缩放（触控板捏合会触发带 ctrlKey 的滚轮，按捏合处理更顺滑）
    view.addEventListener(
      'wheel',
      function (e) {
        e.preventDefault();
        var factor = e.ctrlKey ? Math.exp(-e.deltaY * 0.01) : e.deltaY < 0 ? 1.2 : 1 / 1.2;
        zoomAt(e.clientX, e.clientY, scale * factor, false);
      },
      { passive: false }
    );

    // 点击空白处关闭（点到图片和按钮不关闭）
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target === stage) close();
    });

    // Esc 关闭，左右方向键切换
    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('active')) return;
      if (e.key === 'Escape') close();
      else if (multi && e.key === 'ArrowLeft') show(index - 1);
      else if (multi && e.key === 'ArrowRight') show(index + 1);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
