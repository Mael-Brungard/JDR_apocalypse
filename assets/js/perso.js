import { initCore, lenis, REDUCED, FINE, splitChars, scramble, glitchLoop } from './core.js';
import { audio } from './audio.js';
import { createWorld, followScroll } from './world.js';

// Lien du Google Sheet d'inscription des joueurs. Tant qu'il est vide, le bouton reste désactivé.
const SHEET_URL = '';

const { gsap } = window;
initCore({ ambient: { drone: 0.7, wind: 0.7 } });

let world = null;
createWorld(document.getElementById('world'), { flashlight: false, view: 'checkpoint' })
  .then((w) => {
    world = w;
    world.onLightning = () => audio.thunder(0.6 + Math.random() * 1.5);
    followScroll(world, document.querySelectorAll('[data-view]'));
  })
  .catch((err) => console.error('Monde 3D indisponible :', err));

// ---------- Données des classes ----------

const STATS = [
  ['FOR', 'Force'], ['DEX', 'Dextérité'], ['CON', 'Constitution'],
  ['INT', 'Intelligence'], ['SAG', 'Sagesse'], ['CHA', 'Charisme'],
];

const CLASSES = [
  {
    id: 'policier', name: 'Policier', role: 'Tank', ca: '12', caNote: '+2 si bouclier équipé',
    stats: { CON: 2, FOR: 1, DEX: 1 },
    pitch: 'Vous vous mettez entre le groupe et ce qui veut le dévorer.',
    skills: [
      { name: 'Provoquer', cost: 1, text: 'DD 12 Sagesse. Une entité provoquée ne peut attaquer que le Policier pendant 1 tour et passe en position défensive.' },
      { name: 'Position défensive', text: '+3 CA, mais ne peut pas attaquer. Sa vitesse est divisée par 2.' },
    ],
    inventory: [{ name: 'Bouclier anti-émeute', detail: '+2 CA' }, { name: 'Matraque', detail: '1d6 + Force' }],
  },
  {
    id: 'ingenieur', name: 'Ingénieur', role: 'Création', ca: '12',
    stats: { INT: 2, DEX: 1, CHA: 1 },
    pitch: 'Un tas de ferraille, dix minutes, et le groupe a une chance de plus.',
    skills: [
      { name: 'Arme improvisée', text: 'Fabrique une arme, les dégâts sont définis par 1d4 :', list: ['sur 1 ou 2 : 1d4 + Maîtrise', 'sur 3 ou 4 : 1d6 + Maîtrise'] },
      { name: 'Repérer un point faible', cost: 1, text: "Jet d'Intelligence contre Charisme." },
      { name: 'Piège improvisé', cost: 1, text: "10 minutes d'installation. Immobilise un ennemi et lui inflige 1d4 dégâts." },
    ],
    inventory: [{ name: 'Couteau suisse' }],
  },
  {
    id: 'voleur', name: 'Voleur', role: 'Discrétion', ca: '11',
    stats: { DEX: 2, SAG: 1, CON: 1 },
    pitch: 'Personne ne vous voit arriver. Surtout pas eux.',
    skills: [
      { name: 'Attaque sournoise', cost: 1, text: 'Inflige 1d6 dégâts si la cible est distraite ou ne le voit pas.' },
      { name: "Tapi dans l'arbre", text: "Avantage au jet de Dextérité pour passer d'une cachette à une autre." },
    ],
    inventory: [{ name: 'Couteau', detail: '1d4 + Dextérité' }],
  },
  {
    id: 'medecin', name: 'Médecin', role: 'Support', ca: '11',
    stats: { SAG: 2, INT: 1, FOR: 1 },
    pitch: 'Tant que vous tenez debout, personne ne reste à terre.',
    skills: [
      { name: 'Stabiliser', cost: 1, text: 'Un allié à terre récupère 1 PV.' },
      { name: 'Fabrication de stims', text: 'Combine (Seringue + Médicament) pour fabriquer un stim.' },
    ],
    inventory: [{ name: 'Kit de soin', detail: '1d8 + Sagesse' }, { name: 'Stims ×2', detail: '1d4 PV bonus et 1d4 sur n’importe quel jet pendant 5 tours' }],
  },
  {
    id: 'influenceur', name: 'Influenceur', role: 'Clown', ca: '12',
    stats: { CHA: 3, SAG: 1 },
    pitch: 'Le monde s’est effondré. Votre audience, elle, vous suit toujours.',
    skills: [
      { name: 'Diversion', text: 'DD 15 Sagesse, affectant les créatures ayant plus de 8 en Intelligence.' },
      { name: 'Motivation', cost: 1, text: 'Accorde un bonus de 1d4 à un allié.' },
    ],
    inventory: [{ name: 'Téléphone' }, { name: 'Kit de maquillage' }],
  },
  {
    id: 'motard', name: 'Motard', role: 'Dégâts', ca: '12', caNote: '+2 avec casque et gants',
    stats: { FOR: 2, CON: 1, INT: 1 },
    pitch: 'Quand ça tourne mal, c’est vous qui foncez dans le tas.',
    skills: [
      { name: 'Attaque multiple', cost: 1, text: 'Utilise son action bonus pour effectuer une attaque supplémentaire.' },
      { name: "Pro de l'improvisation", cost: 1, text: "En cas d'échec au toucher avec une arme improvisée, il peut ajouter 1d4 à son jet et ajouter 1 fatigue." },
      { name: 'Soif de bagarre', gain: 1, text: "S'il met le dernier coup à un ennemi, il peut l'exécuter en action bonus et perdre 1 fatigue." },
    ],
    inventory: [{ name: 'Casque moto + gants', detail: '+2 CA' }],
  },
];

const ICONS = {
  policier: '<rect x="14" y="8" width="26" height="46" rx="5"/><path d="M19 17h16M27 22v26"/><path d="M44 18l12 38M41 25l7-2"/>',
  ingenieur: '<path d="M44 6a11 11 0 0 0-10 15L10 45a5 5 0 0 0 8 8l24-24a11 11 0 0 0 15-10l-7 6-6-2-2-6 6-7c-1-.3-3-.6-4-.6z"/><circle cx="14" cy="49" r="1.5"/><path d="M40 40l14 14M50 44l-6 6"/>',
  voleur: '<path d="M6 26c9-5 18-5 26 0 8-5 17-5 26 0-1 11-7 16-14 16-6 0-9-3-12-6-3 3-6 6-12 6-7 0-13-5-14-16z"/><ellipse cx="19" cy="31" rx="6" ry="3.5"/><ellipse cx="45" cy="31" rx="6" ry="3.5"/><path d="M26 48l-6 10M38 48l6 10"/>',
  medecin: '<g transform="rotate(-45 32 32)"><rect x="18" y="26" width="26" height="12" rx="2"/><path d="M44 32h8M52 26v12M18 32H6M24 26v5M30 26v5M36 26v5"/></g><path d="M48 6v12M42 12h12"/>',
  influenceur: '<circle cx="32" cy="30" r="22" stroke-dasharray="3 5"/><rect x="22" y="12" width="20" height="38" rx="3"/><path d="M29 16h6"/><circle cx="32" cy="30" r="5"/><circle cx="37" cy="44" r="1.6"/><path d="M26 56h12"/>',
  motard: '<path d="M10 42c0-16 10-28 24-28 12 0 20 9 20 22v8H32l-5 7H12z"/><path d="M30 26h24v10H30z"/><path d="M16 34c2-6 6-11 12-13"/>',
};

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

const R = 78;
const angle = (i) => -Math.PI / 2 + (i * Math.PI) / 3;
const pt = (i, v) => [Math.cos(angle(i)) * v, Math.sin(angle(i)) * v];
const rings = [1, 2, 3].map((k) => `<polygon class="ring" points="${STATS.map((_, i) => pt(i, (R * k) / 3).join(',')).join(' ')}"/>`).join('');
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
    </div>
  </div>`;

const $ = (id) => document.getElementById(id);
const radarShape = $('radar-shape');
const radarDots = [...$('radar-dots').children];
const radarVals = STATS.map(() => 0);

function drawRadar() {
  const pts = radarVals.map((v, i) => pt(i, Math.max(4, (v / 3) * R)));
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
  $('d-ca').textContent = c.ca;
  $('d-role').textContent = c.role;
  $('d-pitch').textContent = c.pitch;
  const fullName = Object.fromEntries(STATS);
  $('d-stats').innerHTML = Object.entries(c.stats).map(([k, v]) => `<li><b>+${v}</b>${fullName[k]}</li>`).join('')
    + `<li><b>CA</b>${c.ca}${c.caNote ? ` · ${c.caNote}` : ''}</li>`;
  $('d-skills').innerHTML = c.skills.map((s) => `
    <li class="d-skill">
      <div class="d-skill-head"><span class="d-skill-name">${s.name}</span>${costLabel(s)}</div>
      <p>${s.text}</p>
      ${s.list ? `<ul>${s.list.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}
    </li>`).join('');
  $('d-inv').innerHTML = c.inventory.map((it, k) => `<li class="d-item" style="--rot:${k % 2 ? 1.2 : -1.4}deg">${it.name}${it.detail ? `<small>${it.detail}</small>` : ''}</li>`).join('');
  $('radar').setAttribute('aria-label', `Modificateurs : ${STATS.filter(([k]) => c.stats[k]).map(([k, full]) => `${full} +${c.stats[k]}`).join(', ')}`);

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
