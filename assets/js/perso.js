import { initCore, lenis, REDUCED, FINE, splitChars, scramble, glitchLoop } from './core.js';
import { audio } from './audio.js';
import { createWorld, followScroll } from './world.js';
import { STATS, STAT_NAME, CLASSES, ICONS, signed } from './classes.js';

// Lien du Google Sheet d'inscription des joueurs. Tant qu'il est vide, le bouton reste désactivé.
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1zpGybjiF-GCywaXX0wRc76LTbpYbiX41f9Ips2lJ7aA/edit?usp=sharing';

const { gsap } = window;
initCore({ ambient: { drone: 0.7, wind: 0.7 } });

let world = null;
createWorld(document.getElementById('world'), { flashlight: false, view: 'checkpoint', quality: 'low' })
  .then((w) => {
    world = w;
    world.onLightning = () => audio.thunder(0.6 + Math.random() * 1.5);
    followScroll(world, document.querySelectorAll('[data-view]'));
  })
  .catch((err) => console.error('Monde 3D indisponible :', err));

// ---------- Interrogatoire : questions ----------

const QUESTIONS = [
  {
    q: 'Un infecté surgit au bout du couloir. Votre premier réflexe ?',
    a: [
      ['Me placer devant les autres', { policier: 2 }],
      ['Foncer dans le tas', { motard: 2 }],
      ["Me fondre dans l'ombre et attendre mon heure", { voleur: 2 }],
      ['Faire un maximum de bruit ailleurs pour l’attirer', { influenceur: 2 }],
    ],
  },
  {
    q: "Un allié s'effondre. Il saigne beaucoup.",
    a: [
      ["Je m'occupe de lui, tout de suite", { medecin: 2 }],
      ['Je le couvre pendant qu’on le relève', { policier: 1, motard: 1 }],
      ['Je bricole un brancard avec ce qui traîne', { ingenieur: 2 }],
      ['Je lui jure qu’il va s’en sortir, avec conviction', { influenceur: 2 }],
    ],
  },
  {
    q: "Vous ne pouvez emporter qu'un seul objet.",
    a: [
      ['Un couteau suisse', { ingenieur: 2 }],
      ['Une trousse de soin', { medecin: 2 }],
      ['Un casque de moto', { motard: 2 }],
      ['Mon téléphone. Il me reste 12 %', { influenceur: 2 }],
    ],
  },
  {
    q: 'Votre plus grand talent ?',
    a: [
      ['Encaisser', { policier: 2 }],
      ['Ne jamais être vu', { voleur: 2 }],
      ['Comprendre comment les choses marchent', { ingenieur: 2 }],
      ['Garder les autres en vie', { medecin: 2 }],
    ],
  },
  {
    q: 'Autour de la table, vous voulez surtout…',
    a: [
      ['Taper fort et souvent', { motard: 2 }],
      ["Agir dans le dos de l'ennemi", { voleur: 2 }],
      ['Protéger le groupe', { policier: 2 }],
      ['Fabriquer des solutions improbables', { ingenieur: 2 }],
    ],
  },
];

// ---------- Titre ----------

const lines = [...document.querySelectorAll('#title .t-line')];
lines.forEach((l) => { l.dataset.text = l.textContent.trim(); });
const chars = lines.flatMap((l) => splitChars(l));
gsap.fromTo(chars,
  { opacity: 0, y: () => gsap.utils.random(-60, 60), filter: 'blur(12px)' },
  {
    opacity: 1, y: 0, filter: 'blur(0px)', duration: REDUCED ? 0.01 : 1.3, delay: 0.3, ease: 'expo.out',
    stagger: { each: 0.035, from: 'random' },
    onComplete: () => { gsap.set(chars, { clearProps: 'filter' }); lines.forEach((l) => glitchLoop(l, 3000, 7000)); },
  });
gsap.from('.p-hero .kicker, .p-lede, .p-actions', { opacity: 0, y: 24, duration: 1, delay: 1, stagger: 0.15 });

document.querySelectorAll('[data-reveal]').forEach((el) => {
  gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
});

// ---------- Dossiers ----------

const tabs = document.getElementById('tabs');
const dossier = document.getElementById('dossier');
const passClass = document.getElementById('pass-class');
let current = -1;

tabs.innerHTML = CLASSES.map((c, i) => `
  <button class="d-tab" role="tab" type="button" id="tab-${c.id}" aria-controls="dossier" aria-selected="false" tabindex="-1">
    <span class="d-tab-n">${String(i + 1).padStart(2, '0')}</span>
    <span class="d-tab-name">${c.name}</span>
    <span class="d-tab-role">${c.role}</span>
  </button>`).join('');
const tabEls = [...tabs.querySelectorAll('.d-tab')];

// Le radar va de −1 (centre) à +3 (bord) ; l'anneau du 0 est mis en avant.
const R = 78;
const MIN = -1, MAX = 3;
const radius = (v) => ((v - MIN) / (MAX - MIN)) * R;
const angle = (i) => -Math.PI / 2 + (i * Math.PI) / 3;
const pt = (i, v) => [Math.cos(angle(i)) * v, Math.sin(angle(i)) * v];
const rings = [0, 1, 2, 3].map((k) => `<polygon class="ring${k === 0 ? ' ring--zero' : ''}" points="${STATS.map((_, i) => pt(i, radius(k)).join(',')).join(' ')}"/>`).join('');
const axes = STATS.map((_, i) => `<line class="axis" x1="0" y1="0" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}"/>`).join('');
const labels = STATS.map(([k], i) => {
  const [x, y] = pt(i, R + 18);
  return `<text x="${x}" y="${y + 4}" text-anchor="middle">${k}</text>`;
}).join('');

dossier.innerHTML = `
  <div class="dossier-scan" aria-hidden="true"></div>
  <div class="d-top"><span id="d-num">Dossier 01 / 06</span><span>Statut : <b>scan négatif</b></span></div>
  <div class="d-body">
    <div class="d-visual">
      <div class="d-icon">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" id="d-icon"></svg>
        <div class="d-ca" aria-label="Classe d'armure"><span>CA</span><strong id="d-ca">12</strong></div>
      </div>
      <svg class="radar" viewBox="-120 -112 240 224" role="img" id="radar">
        ${rings}${axes}${labels}
        <polygon class="shape" id="radar-shape" points="0,0"/>
        <g id="radar-dots">${STATS.map(() => '<circle class="dot" r="3" cx="0" cy="0"/>').join('')}</g>
      </svg>
    </div>
    <div class="d-info">
      <h3 class="d-name" id="d-name">Policier</h3>
      <p class="d-role"><span class="tape" id="d-role">Tank</span></p>
      <p class="d-pitch" id="d-pitch"></p>
      <h4 class="d-h">Modificateurs de statistiques</h4>
      <ul class="d-stats" id="d-stats"></ul>
      <h4 class="d-h">Compétences</h4>
      <ul class="d-skills" id="d-skills"></ul>
      <h4 class="d-h">Inventaire de départ</h4>
      <ul class="d-inv" id="d-inv"></ul>
      <a class="btn d-train" id="d-train" href="entrainement.html">Tester cette classe en combat <span class="arrow" aria-hidden="true">→</span></a>
    </div>
  </div>`;

const $ = (id) => document.getElementById(id);
const radarShape = $('radar-shape');
const radarDots = [...$('radar-dots').children];
const radarVals = STATS.map(() => 0);

function drawRadar() {
  const pts = radarVals.map((v, i) => pt(i, Math.max(3, radius(v))));
  radarShape.setAttribute('points', pts.map((p) => p.join(',')).join(' '));
  radarDots.forEach((d, i) => { d.setAttribute('cx', pts[i][0]); d.setAttribute('cy', pts[i][1]); });
}

const costLabel = (s) => {
  if (s.gain) return `<span class="d-cost is-gain"><i></i>−${s.gain} fatigue</span>`;
  if (s.cost) return `<span class="d-cost">${'<i></i>'.repeat(s.cost)}${s.cost} fatigue</span>`;
  return '';
};

function select(i, { user = true, focus = false } = {}) {
  if (i === current) return;
  current = i;
  const c = CLASSES[i];
  tabEls.forEach((t, k) => {
    t.setAttribute('aria-selected', String(k === i));
    t.tabIndex = k === i ? 0 : -1;
  });
  if (focus) tabEls[i].focus({ preventScroll: true });
  // Sur téléphone, les onglets défilent à l'horizontale : garder l'onglet actif visible.
  if (tabs.scrollWidth > tabs.clientWidth) tabs.scrollTo({ left: tabEls[i].offsetLeft - tabs.offsetLeft - 16, behavior: REDUCED ? 'auto' : 'smooth' });
  dossier.setAttribute('aria-labelledby', `tab-${c.id}`);

  $('d-num').textContent = `Dossier ${String(i + 1).padStart(2, '0')} / 06`;
  $('d-icon').innerHTML = ICONS[c.id];
  $('d-train').href = `entrainement.html?classe=${c.id}`;
  $('d-ca').textContent = c.ca;
  $('d-role').textContent = c.role;
  $('d-pitch').textContent = c.pitch;
  $('d-stats').innerHTML = Object.entries(c.stats).map(([k, v]) => `<li${v < 0 ? ' class="is-neg"' : ''}><b>${signed(v)}</b>${STAT_NAME[k]}</li>`).join('')
    + `<li><b>CA</b>${c.ca}${c.caNote ? ` · ${c.caNote}` : ''}</li>`;
  $('d-skills').innerHTML = c.skills.map((s) => `
    <li class="d-skill">
      <div class="d-skill-head"><span class="d-skill-name">${s.name}</span>${costLabel(s)}</div>
      <p>${s.text}</p>
      ${s.list ? `<ul>${s.list.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}
    </li>`).join('');
  $('d-inv').innerHTML = c.inventory.map((it, k) => `<li class="d-item" style="--rot:${k % 2 ? 1.2 : -1.4}deg">${it.name}${it.detail ? `<small>${it.detail}</small>` : ''}</li>`).join('');
  $('radar').setAttribute('aria-label', `Modificateurs : ${Object.entries(c.stats).map(([k, v]) => `${STAT_NAME[k]} ${signed(v)}`).join(', ')}`);

  scramble($('d-name'), c.name, { duration: 700 });
  gsap.to(radarVals, { ...STATS.map(([k]) => c.stats[k] || 0), duration: REDUCED ? 0 : 0.9, ease: 'elastic.out(1, .6)', onUpdate: drawRadar });

  if (user) {
    passClass.textContent = c.name;
    try { localStorage.setItem('bclf-class', c.id); } catch { /* stockage indisponible */ }
    audio.scan();
    world?.trigger('scan');
  }
  if (!REDUCED) {
    gsap.fromTo(dossier.querySelector('.dossier-scan'), { top: '-10%', opacity: 1 }, { top: '105%', opacity: 0.6, duration: 0.9, ease: 'power2.inOut' });
    gsap.fromTo('#d-icon', { scale: 0.85, opacity: 0, skewX: 12 }, { scale: 1, opacity: 1, skewX: 0, duration: 0.6, ease: 'expo.out' });
    gsap.fromTo('.d-pitch, .d-stats li, .d-skill, .d-item', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power2.out', delay: 0.15 });
  }
}

tabEls.forEach((t, i) => t.addEventListener('click', () => select(i)));
tabs.addEventListener('keydown', (e) => {
  const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
  if (e.key in keys) {
    e.preventDefault();
    select((current + keys[e.key] + CLASSES.length) % CLASSES.length, { focus: true });
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    select(e.key === 'Home' ? 0 : CLASSES.length - 1, { focus: true });
  }
});

// Glisser du doigt pour changer de dossier.
let swipeX = null;
dossier.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') swipeX = e.clientX; });
dossier.addEventListener('pointerup', (e) => {
  if (swipeX === null) return;
  const dx = e.clientX - swipeX;
  swipeX = null;
  if (Math.abs(dx) > 60) select((current + (dx < 0 ? 1 : -1) + CLASSES.length) % CLASSES.length);
});

// Légère inclinaison 3D du dossier sous la souris.
if (FINE && !REDUCED) {
  const rx = gsap.quickTo(dossier, 'rotationX', { duration: 0.6, ease: 'power3' });
  const ry = gsap.quickTo(dossier, 'rotationY', { duration: 0.6, ease: 'power3' });
  gsap.set(dossier, { transformPerspective: 1400 });
  dossier.addEventListener('pointermove', (e) => {
    const r = dossier.getBoundingClientRect();
    ry(((e.clientX - r.left) / r.width - 0.5) * 5);
    rx(-((e.clientY - r.top) / r.height - 0.5) * 4);
  });
  dossier.addEventListener('pointerleave', () => { rx(0); ry(0); });
}

let saved = null;
try { saved = localStorage.getItem('bclf-class'); } catch { /* stockage indisponible */ }
const savedIndex = CLASSES.findIndex((c) => c.id === saved);
select(Math.max(0, savedIndex), { user: false });
if (savedIndex >= 0) passClass.textContent = CLASSES[savedIndex].name;

// ---------- Interrogatoire ----------

const qBody = $('q-body');
const qStep = $('q-step');
const qBar = $('q-bar');
let qIndex = 0;
let scores = {};
let lastPick = null;

function showQuestion() {
  const Q = QUESTIONS[qIndex];
  qStep.textContent = `Question ${qIndex + 1} / ${QUESTIONS.length}`;
  qBar.style.width = `${(qIndex / QUESTIONS.length) * 100}%`;
  qBody.innerHTML = `
    <p class="q-question">${Q.q}</p>
    <ul class="q-options">${Q.a.map(([label], k) => `<li><button class="q-opt" type="button" data-k="${k}"><kbd>${'ABCD'[k]}</kbd>${label}</button></li>`).join('')}</ul>`;
  gsap.fromTo(qBody.children, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.08, ease: 'power3.out' });
}

function answer(k) {
  const btn = qBody.querySelector(`[data-k="${k}"]`);
  if (!btn || btn.disabled) return;
  qBody.querySelectorAll('.q-opt').forEach((b) => { b.disabled = true; });
  btn.classList.add('is-picked');
  audio.beep(660 + qIndex * 110);
  const weights = QUESTIONS[qIndex].a[k][1];
  Object.entries(weights).forEach(([id, v]) => { scores[id] = (scores[id] || 0) + v; });
  lastPick = Object.keys(weights)[0];
  setTimeout(() => {
    qIndex++;
    gsap.to(qBody.children, {
      opacity: 0, x: -30, duration: 0.3, stagger: 0.04,
      onComplete: () => (qIndex < QUESTIONS.length ? showQuestion() : showResult()),
    });
  }, 420);
}

function showResult() {
  const best = Math.max(...Object.values(scores));
  const tied = Object.keys(scores).filter((id) => scores[id] === best);
  const id = tied.includes(lastPick) ? lastPick : tied[0];
  const i = CLASSES.findIndex((c) => c.id === id);
  const c = CLASSES[i];
  qStep.textContent = 'Analyse terminée';
  qBar.style.width = '100%';
  qBody.innerHTML = `
    <div class="q-result">
      <p class="kicker">Profil recommandé</p>
      <p class="q-result-name" id="q-name">${c.name}</p>
      <p>${c.pitch} Rôle dans le groupe : ${c.role.toLowerCase()}.</p>
      <div class="actions">
        <button class="btn btn--blood" type="button" id="q-see">Voir le dossier <span class="arrow" aria-hidden="true">→</span></button>
        <button class="btn" type="button" id="q-again">Recommencer</button>
      </div>
    </div>`;
  audio.stinger(0.4);
  scramble($('q-name'), c.name, { duration: 1100 });
  tabEls.forEach((t, k) => t.classList.toggle('is-match', k === i));
  $('q-see').addEventListener('click', () => {
    select(i);
    if (lenis) lenis.scrollTo('#dossiers', { offset: -40, duration: 1.6 });
    else $('dossiers').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  });
  $('q-again').addEventListener('click', () => { qIndex = 0; scores = {}; showQuestion(); });
}

qBody.addEventListener('click', (e) => {
  const b = e.target.closest('.q-opt');
  if (b) answer(Number(b.dataset.k));
});
addEventListener('keydown', (e) => {
  if (qIndex >= QUESTIONS.length || e.target.closest('input, textarea')) return;
  const k = 'abcd'.indexOf(e.key.toLowerCase());
  if (k < 0) return;
  const r = $('quiz').getBoundingClientRect();
  if (r.top < innerHeight && r.bottom > 0) answer(k);
});
showQuestion();

// ---------- Inscription ----------

const bar = $('barcode');
let x = 0;
let svgBars = '';
while (x < 160) {
  const w = 1 + Math.random() * 3.5;
  svgBars += `<rect x="${x}" y="0" width="${w}" height="70" fill="#1a1210"/>`;
  x += w + 1 + Math.random() * 3;
}
bar.innerHTML = svgBars;

const sheet = $('sheet-link');
if (SHEET_URL) {
  sheet.href = SHEET_URL;
} else {
  sheet.removeAttribute('href');
  sheet.setAttribute('aria-disabled', 'true');
  sheet.style.opacity = '.5';
  sheet.firstChild.textContent = 'Inscriptions bientôt ouvertes ';
  document.querySelector('.reg-note').textContent = "Le lien d'inscription n'est pas encore en ligne.";
}
