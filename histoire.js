(function () {
  var reader = document.getElementById('reader');
  if (!reader) return;
  var scenes = Array.prototype.slice.call(reader.querySelectorAll('.scene'));
  var n = scenes.length, cur = 0;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var bar = document.getElementById('bar');
  var count = document.getElementById('count');
  var prev = document.getElementById('prev');
  var next = document.getElementById('next');
  var dots = document.getElementById('dots');
  reader.classList.add('js');
  document.documentElement.classList.add('js');

  for (var i = 0; i < n; i++) {
    (function (k) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Aller à la scène ' + (k + 1));
      b.addEventListener('click', function () { show(k, true); });
      li.appendChild(b);
      dots.appendChild(li);
    })(i);
  }

  function show(i, scroll) {
    cur = Math.max(0, Math.min(n - 1, i));
    scenes.forEach(function (s, k) {
      s.hidden = k !== cur;
      s.classList.remove('in');
    });
    void scenes[cur].offsetWidth;
    if (!reduce) scenes[cur].classList.add('in');
    count.textContent = 'Scène ' + (cur + 1) + ' sur ' + n;
    bar.style.width = ((cur + 1) / n * 100) + '%';
    bar.parentNode.setAttribute('aria-valuenow', String(cur + 1));
    prev.disabled = cur === 0;
    next.hidden = cur === n - 1;
    Array.prototype.forEach.call(dots.querySelectorAll('button'), function (b, k) {
      if (k === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    try { history.replaceState(null, '', '#scene-' + (cur + 1)); } catch (e) {}
    if (scroll) reader.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  prev.addEventListener('click', function () { show(cur - 1, true); });
  next.addEventListener('click', function () { show(cur + 1, true); });
  var restart = document.getElementById('restart');
  if (restart) restart.addEventListener('click', function () { show(0, true); });
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') show(cur + 1, false);
    if (e.key === 'ArrowLeft') show(cur - 1, false);
  });
  window.addEventListener('hashchange', function () {
    var m = /^#scene-(\d+)$/.exec(location.hash);
    if (m) show(parseInt(m[1], 10) - 1, false);
  });
  var m = /^#scene-(\d+)$/.exec(location.hash);
  show(m ? parseInt(m[1], 10) - 1 : 0, false);
})();
