/*
 * captureFix.js — html2canvas の画像拡大バグ対策
 *
 * 一部の端末(主に iPhone の Safari と思われる)で、html2canvas が画像の縦横サイズを
 * 実際より小さく読み取ってしまい、画像の左上だけが拡大されて保存されることがある。
 * html2canvas は「読み取ったサイズの範囲を切り抜いて描く」ため、サイズがずれると拡大になる。
 *
 * 対策: 撮影の直前に、撮影範囲内の <img> を自前の <canvas> に描き直して差し替える。
 * 描くときは「画像全体を枠に入れる」方式で、読み取ったサイズは縦横比にしか使わないので
 * 縮尺がずれる余地がない。見た目(object-fit / object-position)は元の表示を再現する。
 *
 * html2canvas.min.js の直後に読み込むと、window.html2canvas を包んで自動で効く。
 * 途中で何か失敗したときは、その画像は差し替えずに元のまま撮る(今までと同じ動き)。
 */
(function () {
  'use strict';
  var original = window.html2canvas;
  if (typeof original !== 'function' || original.__ukoCaptureFix) return;

  var ATTR = 'data-uko-cap';
  var LOAD_TIMEOUT_MS = 8000;

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      try {
        var u = new URL(src, location.href);
        if ((u.protocol === 'http:' || u.protocol === 'https:') && u.origin !== location.origin) {
          im.crossOrigin = 'anonymous';
        }
      } catch (e) { /* data: など */ }
      var timer = setTimeout(function () { reject(new Error('timeout')); }, LOAD_TIMEOUT_MS);
      im.onload = function () { clearTimeout(timer); resolve(im); };
      im.onerror = function () { clearTimeout(timer); reject(new Error('load error')); };
      im.src = src;
    });
  }

  // "50% 50%" / "center top" / "10px 0" などを 0〜1 の割合(px は px のまま)に変換
  function parsePos(token, free) {
    if (!token) return free / 2;
    if (token === 'left' || token === 'top') return 0;
    if (token === 'right' || token === 'bottom') return free;
    if (token === 'center') return free / 2;
    if (/%$/.test(token)) return free * parseFloat(token) / 100;
    if (/px$/.test(token)) return parseFloat(token);
    return free / 2;
  }

  function drawFitted(ctx, im, cw, ch, fit, position) {
    var nw = im.naturalWidth || im.width;
    var nh = im.naturalHeight || im.height;
    if (!nw || !nh) return false;
    var ratio = nw / nh; // 縦横比だけ使う(サイズが誤って読まれても比は変わらない)
    var dw, dh;
    if (fit === 'contain' || fit === 'scale-down') {
      if (cw / ch > ratio) { dh = ch; dw = ch * ratio; } else { dw = cw; dh = cw / ratio; }
    } else if (fit === 'cover') {
      if (cw / ch > ratio) { dw = cw; dh = cw / ratio; } else { dh = ch; dw = ch * ratio; }
    } else if (fit === 'none') {
      return false; // 等倍表示は元の処理に任せる(このサイト群では未使用)
    } else { // fill
      dw = cw; dh = ch;
    }
    var parts = (position || '50% 50%').trim().split(/\s+/);
    var px = parts[0], py = parts[1] || '50%';
    if (px === 'top' || px === 'bottom') { var tmp = px; px = py === tmp ? '50%' : py; py = tmp; }
    var dx = parsePos(px, cw - dw);
    var dy = parsePos(py, ch - dh);
    // 切り抜き範囲(source rect)は指定せず、画像全体を枠の中に描く
    ctx.drawImage(im, dx, dy, dw, dh);
    return true;
  }

  function copyStyles(fromEl, toEl) {
    var cs = getComputedStyle(fromEl);
    var s = '';
    for (var i = 0; i < cs.length; i++) {
      var p = cs[i];
      // アニメーションをコピーすると複製側で最初から再生され、透明な状態で撮られることがある
      if (/^(animation|transition)/.test(p)) continue;
      s +=p + ':' + cs.getPropertyValue(p) + ';';
    }
    toEl.style.cssText = s;
  }

  async function prepare(root, scale) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
    if (root.tagName === 'IMG') imgs.unshift(root);
    var results = {};
    await Promise.all(imgs.map(async function (img, i) {
      try {
        var src = img.currentSrc || img.src;
        if (!src || /\.svg(\?|#|$)/i.test(src) || /^data:image\/svg/i.test(src)) return;
        var cs = getComputedStyle(img);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        var cw = img.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
        var ch = img.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
        if (!(cw > 0 && ch > 0)) return;
        var im = await loadImage(src);
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(cw * scale));
        canvas.height = Math.max(1, Math.round(ch * scale));
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.scale(canvas.width / cw, canvas.height / ch);
        if (!drawFitted(ctx, im, cw, ch, cs.objectFit, cs.objectPosition)) return;
        ctx.getImageData(0, 0, 1, 1); // 汚染(CORS失敗)していたら例外 → 差し替えない
        copyStyles(img, canvas);
        canvas.className = img.className;
        var key = 'c' + i;
        img.setAttribute(ATTR, key);
        results[key] = canvas;
      } catch (e) { /* この画像は元のまま */ }
    }));
    return results;
  }

  function wrapped(element, options) {
    options = options || {};
    var scale = options.scale || window.devicePixelRatio || 1;
    var marked = [];
    var userOnclone = options.onclone;

    return prepare(element, scale).catch(function () { return {}; }).then(function (canvases) {
      Object.keys(canvases).forEach(function (k) {
        var el = element.querySelector('[' + ATTR + '="' + k + '"]') ||
          (element.getAttribute && element.getAttribute(ATTR) === k ? element : null);
        if (el) marked.push(el);
      });
      var opts = Object.assign({}, options, {
        onclone: function (doc, clonedEl) {
          try {
            var list = doc.querySelectorAll('[' + ATTR + ']');
            for (var i = 0; i < list.length; i++) {
              var c = canvases[list[i].getAttribute(ATTR)];
              if (!c || !list[i].parentNode) continue;
              var copy = doc.importNode ? doc.importNode(c, false) : c.cloneNode(false);
              copy.width = c.width; copy.height = c.height;
              copy.getContext('2d').drawImage(c, 0, 0);
              list[i].parentNode.replaceChild(copy, list[i]);
            }
          } catch (e) { /* 差し替え失敗時は元の画像のまま撮る */ }
          if (typeof userOnclone === 'function') return userOnclone(doc, clonedEl);
        }
      });
      var cleanup = function () {
        marked.forEach(function (el) { el.removeAttribute(ATTR); });
      };
      return original(element, opts).then(function (cvs) { cleanup(); return cvs; },
        function (err) { cleanup(); throw err; });
    });
  }

  wrapped.__ukoCaptureFix = true;
  window.html2canvas = wrapped;
})();
