(function () {
  var CLASSES = {"policier": {"name": "Policier", "art": "le Policier", "role": "Tank", "color": "#2F5D9B", "pitch": "Vous encaissez à la place des autres. Provoquez les ennemis, levez le bouclier et tenez la ligne."}, "ingenieur": {"name": "Ingénieur", "art": "l'Ingénieur", "role": "Création", "color": "#1F7563", "pitch": "Vous fabriquez armes et pièges avec ce qui traîne, et vous trouvez la faille de chaque ennemi."}, "voleur": {"name": "Voleur", "art": "le Voleur", "role": "Discrétion", "color": "#5B4B7A", "pitch": "Vous restez dans l'ombre, vous changez de cachette sans bruit et vous frappez quand personne ne regarde."}, "medecin": {"name": "Médecin", "art": "le Médecin", "role": "Support", "color": "#B53030", "pitch": "Vous gardez le groupe debout : soins, stims et alliés relevés au bon moment."}, "influenceur": {"name": "Influenceur", "art": "l'Influenceur", "role": "Clown", "color": "#B53A74", "pitch": "Vous êtes la vedette du groupe. Vous détournez l'attention des ennemis et vous motivez vos alliés."}, "motard": {"name": "Motard", "art": "le Motard", "role": "Dégâts", "color": "#B4511A", "pitch": "Vous frappez fort et vous frappez deux fois. Ce que vous trouvez sur le terrain devient une arme."}};
  var ORDER = ["policier", "ingenieur", "voleur", "medecin", "influenceur", "motard"];
  var chosen = null;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  function scrollToId(id, flash) {
    var el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: flash ? 'center' : 'start' });
    if (flash) {
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    }
  }

  function setChosen(id, forceOn) {
    chosen = forceOn ? id : (chosen === id ? null : id);
    $$('.pick').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pick') === chosen)); });
    var ch = $('#choice'), cc = $('#cta-class');
    if (chosen) {
      var c = CLASSES[chosen];
      ch.hidden = false;
      ch.innerHTML = 'Classe choisie : <b>' + c.name + '</b>. <a href="#creer">Créer mon personnage</a>';
      cc.hidden = false;
      cc.innerHTML = 'Votre classe<span class="chip" style="--c:' + c.color + '">' + c.name + '</span>';
    } else {
      ch.hidden = true; ch.textContent = '';
      cc.hidden = true; cc.textContent = '';
    }
  }

  var form = $('#quiz');
  var box = $('#result');

  function renderResult() {
    var scores = {}, answered = 0;
    ORDER.forEach(function (k) { scores[k] = 0; });
    ['q1', 'q2', 'q3'].forEach(function (n) {
      var c = form.querySelector('input[name="' + n + '"]:checked');
      if (!c) return;
      answered++;
      c.getAttribute('data-score').split(',').forEach(function (p) {
        var a = p.split(':');
        scores[a[0]] += parseInt(a[1], 10);
      });
    });
    if (answered < 3) {
      var left = 3 - answered;
      box.innerHTML = '<p class="res-wait">' + (answered === 0
        ? 'Répondez aux trois questions pour découvrir votre profil.'
        : 'Encore ' + left + (left > 1 ? ' questions' : ' question') + ' avant de découvrir votre profil.') + '</p>';
      return;
    }
    var ranked = ORDER.slice().sort(function (a, b) {
      return (scores[b] - scores[a]) || (ORDER.indexOf(a) - ORDER.indexOf(b));
    });
    var top = ranked[0], alt = ranked[1];
    var t = CLASSES[top], a2 = CLASSES[alt];
    box.innerHTML =
      '<div class="res" style="--c:' + t.color + '">' +
        '<div class="res-top">Votre profil</div>' +
        '<div class="res-body">' +
          '<h3>' + t.name + '</h3>' +
          '<p class="pitch">' + t.pitch + '</p>' +
          '<div class="res-actions">' +
            '<button type="button" class="btn btn-ink" data-go="classe-' + top + '">Voir la fiche</button>' +
            '<button type="button" class="btn btn-line" data-pick-now="' + top + '">Choisir ' + t.art + '</button>' +
          '</div>' +
          '<p class="res-alt">Autre piste proche de vous : <a href="#classe-' + alt + '" data-go="classe-' + alt + '">' + a2.name + '</a></p>' +
        '</div>' +
      '</div>';
    if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
      box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  form.addEventListener('change', renderResult);
  $('#quiz-reset').addEventListener('click', function () { form.reset(); renderResult(); });

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var pick = t.closest('[data-pick]');
    if (pick) { setChosen(pick.getAttribute('data-pick'), false); return; }
    var now = t.closest('[data-pick-now]');
    if (now) { setChosen(now.getAttribute('data-pick-now'), true); return; }
    var go = t.closest('[data-go]');
    if (go) { e.preventDefault(); scrollToId(go.getAttribute('data-go'), true); return; }
    var a = t.closest('a[href^="#"]');
    if (a) {
      var id = a.getAttribute('href').slice(1);
      if (id && document.getElementById(id)) { e.preventDefault(); scrollToId(id, false); }
    }
  });

  if (location.hash.indexOf('#classe-') === 0) {
    setTimeout(function () { scrollToId(location.hash.slice(1), true); }, 350);
  }
})();

