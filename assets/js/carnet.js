// Le carnet du survivant : les questions qui aident à construire son personnage
// (histoire, apparence, alignement) et que le MJ récupère pour nourrir la campagne.

import { REDUCED, scramble } from './core.js';
import { audio } from './audio.js';
import { CLASSES } from './classes.js';

const { gsap } = window;
const KEY = 'bclf-carnet';

const CHAPTERS = [
  {
    id: 'histoire',
    title: 'Histoire',
    intro: 'Qui étiez-vous avant de monter dans cet hélicoptère ? Ces réponses donnent au MJ des personnes, des lieux et des souvenirs à faire revenir en jeu.',
    questions: [
      { id: 'avant', q: 'Qui étiez-vous avant le virus ?', ph: 'Votre métier, votre quartier, vos habitudes…', why: 'Vos contacts et ce que vous connaissez de la ville.' },
      { id: 'confinement', q: 'Où étiez-vous le jour où la ville a été bouclée, il y a quatre ans ?', ph: 'Au travail, chez vous, à l’hôpital…', why: 'Un souvenir précis que le MJ pourra faire ressurgir.' },
      { id: 'proches', q: 'Qui sont les proches dont vous avez été séparé au point d’extraction ?', ph: 'Leur nom, votre lien, ce que vous vous êtes dit en dernier…', why: 'Ils sont montés dans un autre hélicoptère. Le MJ décidera de ce qui leur arrive.' },
      { id: 'perte', q: 'Qu’avez-vous perdu pendant ces quatre années ?', ph: 'Une personne, un lieu, une part de vous…', why: 'Les sujets qui peuvent toucher votre personnage.' },
      { id: 'honte', q: 'Qu’avez-vous fait pour survivre dont vous n’êtes pas fier ?', ph: 'Un vol, un abandon, un mensonge…', why: 'Une ombre du passé que la campagne peut réveiller.' },
      { id: 'secret', q: 'Quel secret gardez-vous ?', ph: 'Quelque chose que les autres joueurs ne doivent pas savoir.', why: 'Seul le MJ le saura. Il pourra le mettre en jeu, à votre rythme.' },
      { id: 'competences', q: 'Comment avez-vous appris ce que sait faire votre classe ?', ph: 'Une formation, un métier, la débrouille, quelqu’un vous a appris…', why: 'Relier vos compétences à votre passé.' },
      { id: 'peur', q: 'Qu’est-ce qui vous fait le plus peur ?', ph: 'Le noir, l’eau, être seul, devenir l’un d’eux…', why: 'Pour les scènes de tension. Dites aussi ce que vous ne voulez pas voir en jeu.' },
      { id: 'proteger', q: 'Qui ou quoi protégeriez-vous à tout prix ?', ph: 'Une personne, un objet, une promesse…', why: 'Ce qui vous fera prendre des risques.' },
      { id: 'objectif', q: 'Qu’espérez-vous trouver sur la base de confinement maritime n°7 ?', ph: 'Retrouver quelqu’un, la vérité, un remède, une vie normale…', why: 'Votre objectif personnel : le MJ construira des scènes autour.' },
    ],
  },
  {
    id: 'apparence',
    title: 'Apparence',
    intro: 'À quoi ressemble votre survivant après quatre ans de confinement ? Le MJ s’en sert pour décrire les scènes et pour les réactions des personnages qu’il joue.',
    questions: [
      { id: 'identite', q: 'Nom, prénom, surnom et âge ?', ph: 'Et le nom qu’on vous donne vraiment.', why: 'Pour que tout le monde vous appelle pareil autour de la table.' },
      { id: 'silhouette', q: 'À quoi ressemble votre silhouette ?', ph: 'Taille, carrure, démarche : comment vous reconnaît-on de loin ?', why: 'Le MJ décrira les scènes en vous y voyant.' },
      { id: 'visage', q: 'Qu’est-ce qu’on remarque d’abord sur votre visage ?', ph: 'Les yeux, une cicatrice, un tatouage, des lunettes, une barbe…', why: 'Le détail que les PNJ retiendront de vous.' },
      { id: 'tenue', q: 'Comment étiez-vous habillé le jour de l’évacuation ?', ph: 'Vous n’avez pas eu le temps de vous changer…', why: 'Utile quand il fera froid, qu’il faudra courir… ou se cacher.' },
      { id: 'objet', q: 'Quel objet personnel gardez-vous toujours sur vous ?', ph: 'Une photo, un bijou, une montre cassée… (sans effet en jeu)', why: 'Un objet chargé d’histoire que le MJ pourra mettre en scène.' },
      { id: 'marque', q: 'Quelle trace ces quatre années ont-elles laissée sur vous ?', ph: 'Une blessure, une maigreur, des cheveux blanchis, un tic…', why: 'Le confinement a marqué tout le monde : le MJ en tiendra compte.' },
      { id: 'voix', q: 'Comment parlez-vous ?', ph: 'Un accent, un débit, des expressions, des silences…', why: 'Pour vous aider à jouer votre personnage, et le MJ à lui répondre.' },
      { id: 'impression', q: 'Que pensent les autres en vous voyant pour la première fois ?', ph: 'Rassurant, inquiétant, fragile, dangereux…', why: 'La première scène dans l’hélicoptère commence par ce regard.' },
    ],
  },
  {
    id: 'alignement',
    title: 'Alignement',
    intro: 'L’alignement résume la morale de votre personnage sur deux axes : son rapport aux règles (Loyal, Neutre ou Chaotique) et son rapport aux autres (Bon, Neutre ou Mauvais). Faites le test, puis dites si le résultat vous ressemble.',
    questions: [
      { id: 'ressemble', q: 'Ce résultat vous ressemble-t-il ? Sinon, quel alignement choisiriez-vous, et pourquoi ?', ph: 'Le test guide, c’est vous qui décidez.', why: 'L’alignement que le MJ retiendra pour votre personnage.' },
      { id: 'ligne', q: 'Quelle ligne rouge votre personnage ne franchira-t-il jamais ?', ph: 'Tuer un innocent, abandonner un enfant, mentir à un ami…', why: 'Le MJ pourra vous mettre face à ce choix. Une seule fois.' },
      { id: 'jusquou', q: 'Jusqu’où iriez-vous pour survivre ?', ph: 'Voler, trahir, laisser quelqu’un derrière…', why: 'Pour doser les dilemmes moraux de la campagne.' },
    ],
  },
];

// Test d'alignement : chaque réponse déplace sur l'axe des règles (loi) et sur celui de la morale (bien).
const ALIGN_TEST = [
  {
    q: 'Un militaire vous ordonne de laisser un blessé derrière la barrière.',
    a: [
      ['J’obéis : les règles sont là pour une raison.', 2, 0],
      ['Je refuse et je l’aide à passer, quitte à désobéir.', -2, 2],
      ['Je négocie : je l’emmène si on me laisse le surveiller.', 1, 1],
      ['Je le laisse : un blessé ralentit tout le monde.', 0, -2],
    ],
  },
  {
    q: 'Vous trouvez un sac de vivres, personne en vue.',
    a: [
      ['Je le partage avec le groupe.', 0, 2],
      ['Je cherche à qui il appartient.', 2, 1],
      ['Je le garde pour moi, discrètement.', -1, -1],
      ['Je le prends, et je le revendrai cher.', 0, -2],
    ],
  },
  {
    q: 'Le groupe vote une décision avec laquelle vous n’êtes pas d’accord.',
    a: [
      ['Je m’y plie : le groupe a décidé.', 2, 0],
      ['J’argumente, puis je suis la majorité.', 1, 1],
      ['Je fais à ma façon, de toute façon.', -2, 0],
      ['Je fais semblant d’accepter, puis j’agis dans mon intérêt.', -1, -1],
    ],
  },
  {
    q: 'En pleine nuit, un inconnu frappe à votre abri. Il jure qu’il n’est pas mordu.',
    a: [
      ['J’ouvre : on ne laisse personne dehors.', -1, 2],
      ['J’ouvre après l’avoir fouillé, comme le veulent nos règles.', 2, 1],
      ['Je n’ouvre pas : c’est trop risqué.', 0, -1],
      ['J’ouvre, et je lui prends ce qu’il a.', -1, -2],
    ],
  },
  {
    q: 'Le gouvernement disait que tout était « sous contrôle ». Qu’en pensez-vous ?',
    a: [
      ['Ils ont fait ce qu’ils ont pu, il faut leur faire confiance.', 2, 0],
      ['Ils ont menti, mais il faut quand même de l’ordre.', 1, 0],
      ['Ils ont menti : je ne crois plus aucune autorité.', -2, 0],
      ['Peu importe : je ne compte que sur moi.', -1, -1],
    ],
  },
  {
    q: 'Un membre du groupe est mordu, mais pas encore transformé.',
    a: [
      ['Je reste avec lui jusqu’au bout.', 0, 2],
      ['J’applique le protocole : on l’isole.', 2, 0],
      ['Je l’achève avant que ça tourne mal, sans prévenir personne.', -1, -1],
      ['Je le laisse en arrière pour couvrir notre fuite.', 0, -2],
    ],
  },
  {
    q: 'Un autre groupe a le médicament qui sauverait votre ami.',
    a: [
      ['Je propose un échange, même à mon désavantage.', 1, 1],
      ['Je le vole sans hésiter.', -2, 1],
      ['Je n’y touche pas : ce n’est pas à moi.', 2, 0],
      ['Je vole tout leur stock, tant pis pour eux.', -1, -2],
    ],
  },
  {
    q: 'Quelle est votre plus grande valeur ?',
    a: [
      ['La loyauté envers les miens.', 1, 1],
      ['L’ordre et la discipline.', 2, 0],
      ['La liberté.', -2, 0],
      ['Ma propre survie.', 0, -2],
    ],
  },
  {
    q: 'Quelqu’un vous a trahi. Vous le retrouvez, désarmé.',
    a: [
      ['Je le laisse partir.', 0, 2],
      ['Je le livre aux militaires.', 2, 0],
      ['Je me venge moi-même.', -2, -1],
      ['Je le garde en vie : il pourra m’être utile.', 0, -1],
    ],
  },
];

const LAW = ['Loyal', 'Neutre', 'Chaotique'];
const MORAL = ['Bon', 'Neutre', 'Mauvais'];
const ALIGN_TEXT = {
  'Loyal Bon': 'Vous faites ce qui est juste, en respectant les règles. Le groupe peut compter sur vous.',
  'Neutre Bon': 'Vous aidez les autres, avec ou sans règles. Ce qui compte, c’est le résultat.',
  'Chaotique Bon': 'Vous suivez votre conscience, pas les ordres. Quitte à désobéir pour sauver quelqu’un.',
  'Loyal Neutre': 'L’ordre avant tout : un code, une hiérarchie, une parole donnée.',
  'Neutre strict': 'Vous évitez les extrêmes et faites ce qu’il faut pour durer.',
  'Chaotique Neutre': 'Libre avant tout. Personne ne vous dit quoi faire.',
  'Loyal Mauvais': 'Vous respectez les règles… surtout quand elles servent vos intérêts.',
  'Neutre Mauvais': 'Vous d’abord. Les autres sont des outils, ou des obstacles.',
  'Chaotique Mauvais': 'Le chaos vous va bien, et tant pis pour ceux qui tombent.',
};

const alignName = (law, moral) => {
  const l = LAW[law], m = MORAL[moral];
  return l === 'Neutre' && m === 'Neutre' ? 'Neutre strict' : `${l} ${m}`;
};
// Un score entre −18 et +18 tombe dans une des trois colonnes.
const band = (score) => (score >= 3 ? 0 : score <= -3 ? 2 : 1);

// ---------- Sauvegarde ----------

const blank = () => ({ answers: {}, align: { picks: [], result: null } });
function load() {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return blank(); }
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* stockage indisponible */ }
  }, 300);
}
let data = load();

// ---------- Rendu ----------

const $ = (id) => document.getElementById(id);
const tabsEl = $('c-tabs');
const panelsEl = $('c-panels');
const statusEl = $('c-status');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

tabsEl.innerHTML = CHAPTERS.map((c, i) => `
  <button class="c-tab" role="tab" type="button" id="ctab-${c.id}" aria-controls="cpanel-${c.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
    <span class="c-tab-n mono">0${i + 1}</span>
    <span class="c-tab-name">${c.title}</span>
    <span class="c-tab-count mono" data-count="${c.id}"></span>
  </button>`).join('');

const question = (q, n) => `
  <div class="c-q">
    <label class="c-label" for="cq-${q.id}"><span class="c-n mono">${String(n).padStart(2, '0')}</span>${q.q}</label>
    <p class="c-why mono"><b>Pour le MJ</b> ${q.why}</p>
    <textarea class="c-input" id="cq-${q.id}" data-id="${q.id}" rows="2" placeholder="${esc(q.ph)}"></textarea>
  </div>`;

panelsEl.innerHTML = CHAPTERS.map((c, i) => `
  <div class="c-panel" role="tabpanel" id="cpanel-${c.id}" aria-labelledby="ctab-${c.id}" tabindex="0"${i ? ' hidden' : ''}>
    <p class="c-intro">${c.intro}</p>
    ${c.id === 'alignement' ? alignMarkup() : ''}
    <div class="c-questions">${c.questions.map((q, k) => question(q, k + 1)).join('')}</div>
    ${i < CHAPTERS.length - 1 ? `<button class="btn c-next" type="button" data-next="${i + 1}">Chapitre suivant : ${CHAPTERS[i + 1].title} <span class="arrow" aria-hidden="true">→</span></button>` : ''}
  </div>`).join('');

function alignMarkup() {
  const cells = MORAL.map((m, mi) => LAW.map((l, li) => {
    const name = alignName(li, mi);
    return `<div class="al-cell" data-name="${name}"><span>${name}</span></div>`;
  }).join('')).join('');
  return `
    <div class="q-card al-test" id="al-test">
      <div class="q-top"><span id="al-step">Question 1 / ${ALIGN_TEST.length}</span><span>Test d'alignement</span></div>
      <div class="q-bar"><i id="al-bar"></i></div>
      <div class="q-body" id="al-body" aria-live="polite"></div>
    </div>
    <div class="al-result" id="al-result" hidden>
      <div class="al-map">
        <span class="al-axis al-axis--top mono">Bon</span>
        <span class="al-axis al-axis--bottom mono">Mauvais</span>
        <span class="al-axis al-axis--left mono">Loyal</span>
        <span class="al-axis al-axis--right mono">Chaotique</span>
        <div class="al-grid">${cells}<i class="al-dot" id="al-dot"></i></div>
      </div>
      <div class="al-text">
        <p class="kicker">Votre alignement</p>
        <p class="al-name" id="al-name"></p>
        <p class="al-desc" id="al-desc"></p>
        <p class="al-scores mono" id="al-scores"></p>
        <button class="btn" id="al-again" type="button">Refaire le test</button>
      </div>
    </div>`;
}

// ---------- Onglets ----------

const tabs = [...tabsEl.querySelectorAll('.c-tab')];
function openTab(i, { focus = false, scroll = false } = {}) {
  tabs.forEach((t, k) => {
    t.setAttribute('aria-selected', String(k === i));
    t.tabIndex = k === i ? 0 : -1;
    $(`cpanel-${CHAPTERS[k].id}`).hidden = k !== i;
  });
  if (focus) tabs[i].focus();
  const panel = $(`cpanel-${CHAPTERS[i].id}`);
  if (!REDUCED) gsap.fromTo(panel, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
  panel.querySelectorAll('.c-input').forEach(grow);
  if (scroll) $('c-tabs').scrollIntoView({ block: 'start', behavior: REDUCED ? 'auto' : 'smooth' });
  audio.staticBurst(0.15, 0.15);
}
tabs.forEach((t, i) => t.addEventListener('click', () => openTab(i)));
tabsEl.addEventListener('keydown', (e) => {
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (step) {
    e.preventDefault();
    openTab((i + step + tabs.length) % tabs.length, { focus: true });
  }
});
panelsEl.addEventListener('click', (e) => {
  const next = e.target.closest('[data-next]');
  if (next) openTab(Number(next.dataset.next), { scroll: true });
});

// ---------- Réponses libres ----------

// Le champ grandit avec le texte.
function grow(t) {
  t.style.height = 'auto';
  t.style.height = `${t.scrollHeight + 2}px`;
}

const inputs = [...panelsEl.querySelectorAll('.c-input')];
inputs.forEach((t) => {
  t.value = data.answers[t.dataset.id] || '';
  t.addEventListener('input', () => {
    data.answers[t.dataset.id] = t.value;
    grow(t);
    counts();
    save();
  });
});

function counts() {
  CHAPTERS.forEach((c) => {
    const done = c.questions.filter((q) => (data.answers[q.id] || '').trim()).length + (c.id === 'alignement' && data.align.result ? 1 : 0);
    const total = c.questions.length + (c.id === 'alignement' ? 1 : 0);
    const el = tabsEl.querySelector(`[data-count="${c.id}"]`);
    el.textContent = `${done}/${total}`;
    el.closest('.c-tab').classList.toggle('is-done', done === total);
  });
}

// ---------- Test d'alignement ----------

const alBody = $('al-body');
const alStep = $('al-step');
const alBar = $('al-bar');

function alQuestion() {
  const i = data.align.picks.length;
  const Q = ALIGN_TEST[i];
  alStep.textContent = `Question ${i + 1} / ${ALIGN_TEST.length}`;
  alBar.style.width = `${(i / ALIGN_TEST.length) * 100}%`;
  alBody.innerHTML = `
    <p class="q-question">${Q.q}</p>
    <ul class="q-options">${Q.a.map(([label], k) => `<li><button class="q-opt" type="button" data-k="${k}"><kbd>${'ABCD'[k]}</kbd>${label}</button></li>`).join('')}</ul>`;
  if (!REDUCED) gsap.fromTo(alBody.children, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.07, ease: 'power3.out' });
}

alBody.addEventListener('click', (e) => {
  const b = e.target.closest('.q-opt');
  if (!b || b.disabled) return;
  alBody.querySelectorAll('.q-opt').forEach((x) => { x.disabled = true; });
  b.classList.add('is-picked');
  audio.beep(600 + data.align.picks.length * 60);
  data.align.picks.push(Number(b.dataset.k));
  save();
  setTimeout(() => {
    if (data.align.picks.length < ALIGN_TEST.length) alQuestion();
    else alFinish(true);
  }, REDUCED ? 0 : 380);
});

function alScores() {
  return data.align.picks.reduce(([law, good], k, i) => {
    const [, l, g] = ALIGN_TEST[i].a[k];
    return [law + l, good + g];
  }, [0, 0]);
}

function alFinish(fresh) {
  const [law, good] = alScores();
  const li = band(law), mi = band(good);
  const name = alignName(li, mi);
  data.align.result = { name, law, good };
  save();
  counts();
  $('al-test').hidden = true;
  $('al-result').hidden = false;
  $('al-desc').textContent = ALIGN_TEXT[name];
  $('al-scores').textContent = `Règles : ${law > 0 ? '+' : ''}${law} (loyal ↔ chaotique) · Morale : ${good > 0 ? '+' : ''}${good} (bon ↔ mauvais)`;
  document.querySelectorAll('.al-cell').forEach((c) => c.classList.toggle('is-match', c.dataset.name === name));
  // Le point se place dans la grille : loi à gauche, chaos à droite, bien en haut, mal en bas.
  // Chaque tiers correspond à une bande de score, pour que le point tombe dans la bonne case.
  const max = ALIGN_TEST.length * 2;
  const pos = (s) => {
    if (s >= 3) return 33.3 - Math.min(1, (s - 3) / (max - 3)) * 28;
    if (s <= -3) return 66.7 + Math.min(1, (-s - 3) / (max - 3)) * 28;
    return 50 - (s / 3) * 14;
  };
  const x = pos(law), y = pos(good);
  const dot = $('al-dot');
  if (fresh && !REDUCED) {
    gsap.fromTo(dot, { left: '50%', top: '50%', scale: 0 }, { left: `${x}%`, top: `${y}%`, scale: 1, duration: 1.2, ease: 'expo.out' });
    gsap.fromTo('.al-cell', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.04 });
    scramble($('al-name'), name, { duration: 900 });
    audio.stinger(0.3);
  } else {
    Object.assign(dot.style, { left: `${x}%`, top: `${y}%` });
    $('al-name').textContent = name;
  }
}

$('al-again').addEventListener('click', () => {
  data.align = { picks: [], result: null };
  save();
  counts();
  $('al-result').hidden = true;
  $('al-test').hidden = false;
  alQuestion();
});

if (data.align.result && data.align.picks.length === ALIGN_TEST.length) alFinish(false);
else {
  data.align.picks = data.align.picks.slice(0, ALIGN_TEST.length - 1);
  alQuestion();
}
counts();

// ---------- Export ----------

function exportText() {
  let classe = 'non choisie';
  try { classe = CLASSES.find((c) => c.id === localStorage.getItem('bclf-class'))?.name || classe; } catch { /* stockage indisponible */ }
  const out = ['CARNET DU SURVIVANT · Bienvenue chez les fous', `Classe : ${classe}`, ''];
  CHAPTERS.forEach((c) => {
    out.push(`== ${c.title.toUpperCase()} ==`);
    if (c.id === 'alignement') {
      const r = data.align.result;
      out.push(r ? `Résultat du test : ${r.name} (règles ${r.law > 0 ? '+' : ''}${r.law}, morale ${r.good > 0 ? '+' : ''}${r.good})` : 'Test non fait.', '');
    }
    c.questions.forEach((q, k) => {
      out.push(`${k + 1}. ${q.q}`, `→ ${(data.answers[q.id] || '').trim() || '(pas de réponse)'}`, '');
    });
  });
  return out.join('\n');
}

function status(msg) {
  statusEl.textContent = msg;
  if (!REDUCED) gsap.fromTo(statusEl, { opacity: 0 }, { opacity: 1, duration: 0.3 });
}

$('c-copy').addEventListener('click', async () => {
  const text = exportText();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Repli pour les navigateurs qui refusent l'accès au presse-papiers.
    const t = document.createElement('textarea');
    t.value = text;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  audio.beep(1320);
  status('Réponses copiées. Collez-les dans un message au MJ ou dans le Google Sheet.');
});

$('c-download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([exportText()], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'carnet-du-survivant.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Fichier téléchargé : carnet-du-survivant.txt');
});

$('c-reset').addEventListener('click', () => {
  if (!confirm('Effacer toutes les réponses du carnet sur cet appareil ?')) return;
  data = blank();
  save();
  inputs.forEach((t) => { t.value = ''; grow(t); });
  $('al-result').hidden = true;
  $('al-test').hidden = false;
  alQuestion();
  counts();
  status('Carnet effacé.');
});

// Les champs prennent leur hauteur une fois les polices chargées.
document.fonts?.ready.then(() => inputs.forEach(grow));
gsap.from('.c-tab', { opacity: 0, y: 20, duration: 0.8, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '#c-tabs', start: 'top 85%', once: true } });
