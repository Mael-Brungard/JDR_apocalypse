import { initCore, lenis, REDUCED, splitChars, glitchLoop } from './core.js';
import { audio } from './audio.js';
import { createWorld } from './world.js';
import { CLASSES, ICONS, STAT_NAME, BASE, signed } from './classes.js';

const { gsap } = window;
initCore({ ambient: { drone: 0.8, wind: 0.8 } });

let world = null;
createWorld(document.getElementById('world'), { zombies: true, flashlight: 'drift', view: 'street2' })
  .then((w) => {
    world = w;
    world.onLightning = () => audio.thunder(0.6 + Math.random() * 1.5);
  })
  .catch((err) => console.error('Monde 3D indisponible :', err));

// ---------- Règles de la simulation ----------
// Le document de règles ne précise pas tout (jet d'attaque, ennemis, armes de fortune) :
// ces valeurs d'entraînement suivent les conventions habituelles du d20 et se règlent ici.

const RULES = {
  maitrise: 2,      // bonus de Maîtrise, utilisé par l'arme improvisée de l'Ingénieur
  defensive: 3,     // bonus de CA de la position défensive
  kitUses: 2,       // utilisations du kit de soin pendant la simulation
  stims: 2,
  stimRounds: 5,
  hideDD: 10,       // se cacher avant le combat
  provokeDD: 12,
  diversionDD: 15,
  diversionInt: 8,  // la Diversion n'affecte que les créatures au-dessus de ce score d'Intelligence
};

// Les classes sans arme ramassent une arme de fortune : 1d4 + Force.
const IMPROVISED = { name: 'Pied-de-biche', dice: [1, 4], stat: 'FOR', improvised: true };
const WEAPONS = {
  policier: { name: 'Matraque', dice: [1, 6], stat: 'FOR' },
  ingenieur: { name: 'Couteau suisse', dice: [1, 4], stat: 'DEX' },
  voleur: { name: 'Couteau', dice: [1, 4], stat: 'DEX' },
  medecin: IMPROVISED,
  influenceur: IMPROVISED,
  motard: { name: 'Barre de fer', dice: [1, 4], stat: 'FOR', improvised: true },
};

const ZOMBIE = { name: 'Rôdeur', pv: 11, ca: 8, attack: 3, dmg: [1, 4], dmgFlat: 1, stats: { DEX: -1, SAG: -2, CHA: -3 }, intScore: 1 };
const SAM = { name: 'Sam', sub: 'Civil', pv: 10, ca: 10, attack: 1, dmg: [1, 4], dmgFlat: 1, stats: { DEX: 1 } };

const ART = {
  zombie: '<svg viewBox="0 0 64 128"><ellipse cx="38" cy="20" rx="7" ry="8.5" transform="rotate(22 38 20)"/><path d="M23 31L44 28L40 72L25 74Z"/><g fill="none" stroke="currentColor" stroke-linecap="round"><path d="M41 33L52 50L58 63" stroke-width="6.5"/><path d="M25 34L18 57L21 82" stroke-width="6"/><path d="M29 72L25 99L22 125" stroke-width="7.5"/><path d="M37 72L44 98L42 125" stroke-width="7.5"/></g></svg>',
  civil: '<svg viewBox="0 0 64 128"><ellipse cx="32" cy="17" rx="7" ry="8"/><path d="M21 28H43L41 74H23Z"/><g fill="none" stroke="currentColor" stroke-linecap="round"><path d="M22 31L18 56L20 76" stroke-width="6"/><path d="M42 31L46 56L44 76" stroke-width="6"/><path d="M28 73L27 100L27 125" stroke-width="7.5"/><path d="M36 73L37 100L37 125" stroke-width="7.5"/></g></svg>',
};

const SHAPES = {
  4: '50,8 94,88 6,88',
  6: '14,14 86,14 86,86 14,86',
  8: '50,4 94,50 50,96 6,50',
  20: '50,4 92,28 92,72 50,96 8,72 8,28',
};

// ---------- Outils ----------

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, REDUCED ? Math.min(ms, 120) : ms));
const d = (n) => 1 + Math.floor(Math.random() * n);
// Sur écran étroit, le plateau est empilé : on amène sous les yeux ce qui attend le joueur.
const reveal = (el) => {
  if (innerWidth >= 1100) return;
  if (lenis) lenis.scrollTo(el, { offset: -90, duration: 0.8 });
  else el.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
};
const diceText = ([n, s], flat = 0, statLabel = '') => `${n}d${s}${statLabel ? ` + ${statLabel}` : flat ? ` + ${flat}` : ''}`;

const sfx = {
  dice() {
    for (let i = 0; i < 6; i++) audio.burst({ type: 'bandpass', freq: 1800 + Math.random() * 1500, q: 4, peak: 0.12, attack: 0.001, decay: 0.04, delay: i * 0.07 + Math.random() * 0.03 });
  },
  hit() {
    audio.tone({ freq: 130, to: 45, peak: 0.5, decay: 0.25 });
    audio.burst({ freq: 900, sweep: 180, peak: 0.45, decay: 0.22 });
  },
  miss() { audio.burst({ type: 'bandpass', freq: 600, sweep: 2600, q: 1.2, peak: 0.22, attack: 0.02, decay: 0.3 }); },
  heal() { audio.tone({ type: 'triangle', freq: 440, to: 880, peak: 0.12, attack: 0.02, decay: 0.5, wet: 0.4 }); },
  fatigue() { audio.tone({ type: 'sawtooth', freq: 90, to: 60, peak: 0.08, decay: 0.4 }); },
};

// ---------- Éléments ----------

const arena = $('arena');
const coachText = $('coach-text');
const coachNext = $('coach-next');
const guideToggle = $('guide-toggle');
const orderEl = $('order');
const enemiesEl = $('enemies');
const alliesEl = $('allies');
const die = $('die');
const dieShape = $('die-shape');
const dieNum = $('die-num');
const dieType = $('die-type');
const dieAlt = $('die-alt');
const trayLabel = $('tray-label');
const trayFormula = $('tray-formula');
const trayVerdict = $('tray-verdict');
const rollBtn = $('roll-btn');
const actionsEl = $('actions');
const endBtn = $('end-turn');
const tokensEl = $('tokens');
const targetHint = $('target-hint');
const cancelBtn = $('cancel-target');
const askEl = $('ask');
const logEl = $('log');

let S = null;

// ---------- Écran de choix ----------

const lines = [...document.querySelectorAll('#title .t-line')];
lines.forEach((l) => { l.dataset.text = l.textContent.trim(); });
const chars = lines.flatMap((l) => splitChars(l));
gsap.fromTo(chars,
  { opacity: 0, y: () => gsap.utils.random(-60, 60), filter: 'blur(12px)' },
  {
    opacity: 1, y: 0, filter: 'blur(0px)', duration: REDUCED ? 0.01 : 1.3, delay: 0.3, ease: 'expo.out',
    stagger: { each: 0.04, from: 'random' },
    onComplete: () => { gsap.set(chars, { clearProps: 'filter' }); lines.forEach((l) => glitchLoop(l, 3000, 7000)); },
  });
gsap.from('.sim-hero .kicker, .sim-hero .p-lede, .basics li, .pick-card', { opacity: 0, y: 24, duration: 0.9, delay: 0.9, stagger: 0.06 });

const COMBAT_PITCH = {
  policier: 'Encaisse et attire les coups sur lui.',
  ingenieur: 'Fabrique une arme, pose un piège, trouve la faille.',
  voleur: 'Frappe ceux qui ne le regardent pas.',
  medecin: 'Garde le groupe en vie, se bat peu.',
  influenceur: 'Pousse les autres à se dépasser.',
  motard: 'Frappe deux fois et ne lâche rien.',
};

$('pick-grid').innerHTML = CLASSES.map((c) => {
  const w = WEAPONS[c.id];
  return `
    <button class="pick-card" type="button" data-id="${c.id}">
      <svg class="pick-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[c.id]}</svg>
      <span class="pick-role">${c.role}</span>
      <span class="pick-name">${c.name}</span>
      <span class="pick-line">${COMBAT_PITCH[c.id]}</span>
      <span class="pick-meta mono"><span>CA ${c.ca + (c.caBonus || 0)}</span><span>${w.name} · ${diceText(w.dice, 0, STAT_NAME[w.stat])}</span></span>
      <span class="pick-go mono">Lancer la simulation →</span>
    </button>`;
}).join('');

document.querySelectorAll('.pick-card').forEach((b) => b.addEventListener('click', () => start(b.dataset.id)));

// Arrivée depuis un dossier de classe : on met sa carte en avant.
const wanted = new URLSearchParams(location.search).get('classe');
const wantedCard = wanted && document.querySelector(`.pick-card[data-id="${wanted}"]`);
if (wantedCard) {
  wantedCard.classList.add('is-wanted');
  setTimeout(() => wantedCard.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' }), 900);
}

// ---------- Conseils du Capitaine Trevor ----------

let typing = null;
function type(text) {
  if (typing) typing.skip = true;
  const job = { skip: false };
  typing = job;
  coachText.classList.add('is-typing');
  return new Promise((done) => {
    let i = 0;
    const step = () => {
      i = job.skip || REDUCED ? text.length : i + 1;
      coachText.textContent = text.slice(0, i);
      if (i % 3 === 0) audio.type();
      if (i < text.length) setTimeout(step, 16);
      else { coachText.classList.remove('is-typing'); done(); }
    };
    step();
  });
}
$('coach').addEventListener('click', (e) => { if (!e.target.closest('button') && typing) typing.skip = true; });

async function say(text, { next = false, label = 'Compris' } = {}) {
  if (!S.guided) return;
  audio.beep(1200);
  await type(text);
  if (!next) return;
  coachNext.textContent = label;
  coachNext.hidden = false;
  coachNext.focus({ preventScroll: true });
  await new Promise((r) => coachNext.addEventListener('click', r, { once: true }));
  coachNext.hidden = true;
}

// Un conseil ne s'affiche qu'une fois par partie.
function hint(key, text, opts) {
  if (S.tips.has(key)) return Promise.resolve();
  S.tips.add(key);
  return say(text, opts);
}

guideToggle.addEventListener('click', () => {
  S.guided = !S.guided;
  guideToggle.setAttribute('aria-pressed', String(S.guided));
  guideToggle.textContent = `Conseils : ${S.guided ? 'activés' : 'coupés'}`;
  if (!S.guided) {
    coachText.textContent = 'Conseils coupés. Vous êtes seul.';
    if (!coachNext.hidden) coachNext.click();
  }
});

// ---------- Unités ----------

const mod = (u, stat) => u.stats[stat] ?? 0;
const ca = (u) => u.ca + (u.status.defensive ? RULES.defensive : 0);
const alive = (u) => u.pv > 0;
const liveZombies = () => S.zombies.filter(alive);

function card(u) {
  const el = document.createElement('div');
  el.className = `unit unit--${u.side}`;
  el.innerHTML = `
    <div class="unit-art" aria-hidden="true">${u.art}</div>
    <div class="unit-info">
      <p class="unit-name">${u.name}${u.sub ? `<small>${u.sub}</small>` : ''}</p>
      <div class="unit-pv" aria-hidden="true"><i></i></div>
      <p class="unit-nums"><span class="pv"></span><span class="ca"></span></p>
      ${u.side === 'hero' ? '<p class="unit-fatigue"><span>Fatigue</span><span class="pips"><i></i><i></i><i></i></span></p>' : ''}
      <ul class="unit-status"></ul>
    </div>
    <button class="unit-target" type="button" disabled aria-label="Cibler ${u.name}"></button>`;
  u.el = el;
  render(u);
  return el;
}

function render(u) {
  const el = u.el;
  el.querySelector('.unit-pv i').style.width = `${(Math.max(0, Math.min(u.pv, u.max)) / u.max) * 100}%`;
  el.querySelector('.pv').textContent = `PV ${u.pv}/${u.max}`;
  el.querySelector('.ca').textContent = `CA ${ca(u)}`;
  el.classList.toggle('is-down', u.pv <= 0);
  el.classList.toggle('is-low', u.pv > 0 && u.pv <= u.max * 0.35);
  const st = u.status;
  const chips = [];
  if (u.pv <= 0) chips.push([u.side === 'enemy' ? 'Abattu' : 'À terre', '']);
  if (st.hidden) chips.push(['Caché', 'Les ennemis ne vous voient pas : avantage et attaque sournoise possible']);
  if (st.defensive) chips.push([`Défensive +${RULES.defensive} CA`, 'Ne peut pas attaquer']);
  if (st.provoked) chips.push(['Provoqué', 'Ne peut attaquer que le Policier ce tour-ci']);
  if (st.exposed) chips.push(['Point faible', 'Les attaques contre lui ont l’avantage']);
  if (st.immobilized) chips.push(['Immobilisé', 'Perd son prochain tour']);
  if (st.distracted && alive(u)) chips.push(['Distrait', 'Occupé avec quelqu’un d’autre']);
  if (st.motivated) chips.push(['Motivé +1d4', 'Bonus sur son prochain jet']);
  if (st.stim) chips.push([`Stim +1d4 · ${st.stim}`, 'Bonus sur ses jets']);
  el.querySelector('.unit-status').innerHTML = chips.map(([t, tip]) => `<li${tip ? ` title="${tip}"` : ''}>${t}</li>`).join('');
  if (u.side === 'hero') el.querySelectorAll('.pips i').forEach((p, k) => p.classList.toggle('is-on', k < S.fatigue));
}

function float(u, text, kind = 'dmg') {
  const f = document.createElement('span');
  f.className = `float float--${kind}`;
  f.textContent = text;
  u.el.appendChild(f);
  gsap.fromTo(f, { y: 0, opacity: 1, scale: 0.6 }, { y: -64, opacity: 0, scale: 1.15, duration: 1.5, ease: 'power2.out', onComplete: () => f.remove() });
}

function jolt(u) {
  if (REDUCED) return;
  gsap.fromTo(u.el, { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, .3)' });
}

function log(html, kind = '') {
  const li = document.createElement('li');
  li.className = kind;
  li.innerHTML = `<span class="log-r">T${S.round}</span><span>${html}</span>`;
  logEl.prepend(li);
}

function setActive(u) {
  [S.hero, S.sam, ...S.zombies].forEach((x) => x.el.classList.toggle('is-active', x === u));
  orderEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c.dataset.id === u.id));
}

function renderOrder() {
  orderEl.innerHTML = `<span class="order-round">Tour ${S.round || '—'}</span>`
    + S.order.map((u) => `<span class="chip${alive(u) ? '' : ' is-out'}" data-id="${u.id}">${u.name}<b>${u.init ?? ''}</b></span>`).join('');
}

// ---------- Dés ----------

function tumble(sides, rolls, adv) {
  const final = adv ? Math.max(...rolls) : rolls.reduce((a, b) => a + b, 0);
  return new Promise((done) => {
    die.classList.add('is-rolling');
    let n = 0;
    const tick = setInterval(() => {
      dieNum.textContent = d(sides);
      if (++n >= (REDUCED ? 1 : 12)) {
        clearInterval(tick);
        dieNum.textContent = final;
        die.classList.remove('is-rolling');
        die.classList.toggle('is-nat20', sides === 20 && final === 20);
        die.classList.toggle('is-nat1', sides === 20 && final === 1);
        if (!REDUCED) gsap.fromTo(die, { scale: 1.25 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' });
        done(final);
      }
    }, 50);
  });
}

// Lance des dés dans le plateau et affiche le calcul. `extra` : dés bonus (stim, motivation).
async function roll({ label, count = 1, sides = 20, adv = false, mod: m = 0, modLabel = '', extra = [], user = false }) {
  trayLabel.textContent = label;
  trayFormula.innerHTML = '';
  trayVerdict.textContent = '';
  trayVerdict.className = 'tray-verdict';
  dieAlt.textContent = '';
  dieShape.setAttribute('points', SHAPES[sides] || SHAPES[20]);
  dieType.textContent = `${adv ? 2 : count}d${sides}`;
  if (user) {
    rollBtn.textContent = adv ? 'Lancer 2d20 (avantage)' : `Lancer ${count}d${sides}`;
    rollBtn.hidden = false;
    rollBtn.focus({ preventScroll: true });
    reveal($('tray'));
    die.classList.add('is-waiting');
    await new Promise((r) => {
      const go = () => { die.removeEventListener('click', go); rollBtn.removeEventListener('click', go); r(); };
      rollBtn.addEventListener('click', go);
      die.addEventListener('click', go);
    });
    die.classList.remove('is-waiting');
    rollBtn.hidden = true;
  }
  const rolls = Array.from({ length: adv ? 2 : count }, () => d(sides));
  sfx.dice();
  const kept = await tumble(sides, rolls, adv);
  const extras = extra.map((e) => ({ ...e, value: d(e.sides) }));
  const total = kept + m + extras.reduce((a, e) => a + e.value, 0);
  let f = adv ? `2d20 (${rolls.join(' / ')}) → ${kept}` : `${count}d${sides} (${rolls.join(' + ')})`;
  if (modLabel) f += ` ${m < 0 ? '−' : '+'} ${Math.abs(m)} ${modLabel}`;
  extras.forEach((e) => { f += ` + ${e.value} ${e.label}`; });
  f += ` = <b>${total}</b>`;
  trayFormula.innerHTML = f;
  if (adv) dieAlt.textContent = 'Avantage : on garde le meilleur des deux dés.';
  return { rolls, kept, total, nat: sides === 20 ? kept : 0 };
}

function verdict(text, kind) {
  trayVerdict.textContent = text;
  trayVerdict.className = `tray-verdict is-${kind}`;
}

// ---------- Choix du joueur ----------

function tokens() {
  tokensEl.querySelector('[data-token="action"]').classList.toggle('is-spent', !S.action);
  tokensEl.querySelector('[data-token="bonus"]').classList.toggle('is-spent', !S.bonus);
}

function lockActions() {
  actionsEl.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  endBtn.disabled = true;
}

function blockReason(a) {
  if (a.cost === 'action' && !S.action) return 'Action déjà utilisée ce tour.';
  if (a.cost === 'bonus' && !S.bonus) return 'Action bonus déjà utilisée ce tour.';
  if (a.fatigue && S.fatigue + a.fatigue > BASE.fatigueMax) return 'Trop fatigué : la jauge est pleine.';
  if (a.targets && !a.targets().length) return a.noTarget || 'Aucune cible possible.';
  return a.check?.() || null;
}

function ask(title, text, yes = 'Oui', no = 'Non') {
  return new Promise((resolve) => {
    actionsEl.hidden = true;
    askEl.hidden = false;
    $('ask-title').textContent = title;
    $('ask-text').textContent = text;
    const y = $('ask-yes'), n = $('ask-no');
    y.textContent = yes;
    n.textContent = no;
    y.focus({ preventScroll: true });
    reveal(askEl);
    const done = (v) => {
      askEl.hidden = true;
      actionsEl.hidden = false;
      y.onclick = n.onclick = null;
      resolve(v);
    };
    y.onclick = () => done(true);
    n.onclick = () => done(false);
  });
}

function pickTarget(a) {
  const options = a.targets();
  if (options.length === 1) return Promise.resolve(options[0]);
  return new Promise((resolve) => {
    arena.classList.add('is-targeting');
    targetHint.textContent = a.targetText || 'Choisissez une cible';
    cancelBtn.hidden = false;
    const onKey = (e) => { if (e.key === 'Escape') finish(null); };
    const finish = (u) => {
      arena.classList.remove('is-targeting');
      targetHint.textContent = '';
      cancelBtn.hidden = true;
      options.forEach((o) => {
        const b = o.el.querySelector('.unit-target');
        b.disabled = true;
        b.onclick = null;
        o.el.classList.remove('is-candidate');
      });
      removeEventListener('keydown', onKey);
      resolve(u);
    };
    options.forEach((o) => {
      const b = o.el.querySelector('.unit-target');
      b.disabled = false;
      b.onclick = () => finish(o);
      o.el.classList.add('is-candidate');
    });
    options[0].el.querySelector('.unit-target').focus({ preventScroll: true });
    reveal(options[0].el);
    cancelBtn.onclick = () => finish(null);
    addEventListener('keydown', onKey);
  });
}

function costTag(a) {
  const parts = [a.cost === 'bonus' ? 'Bonus' : a.cost === 'action' ? 'Action' : 'Gratuit'];
  if (a.fatigue) parts.push(`+${a.fatigue} fatigue`);
  return parts.map((p) => `<span>${p}</span>`).join('');
}

function choose() {
  return new Promise((resolve) => {
    actionsEl.innerHTML = '';
    heroActions().forEach((a) => {
      const reason = blockReason(a);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `act${a.id === S.suggest ? ' is-hint' : ''}`;
      b.disabled = !!reason;
      b.innerHTML = `<span class="act-name">${a.label}</span><span class="act-meta mono">${costTag(a)}</span><span class="act-desc">${reason || a.desc}</span>`;
      b.addEventListener('click', async () => {
        let target = null;
        if (a.targets) {
          target = await pickTarget(a);
          if (!target) return;
        }
        resolve({ a, target });
      });
      actionsEl.appendChild(b);
    });
    endBtn.disabled = false;
    endBtn.onclick = () => resolve({ a: { id: 'end' } });
    reveal($('bar'));
  });
}

function pay(n) {
  S.fatigue = Math.max(0, Math.min(BASE.fatigueMax, S.fatigue + n));
  render(S.hero);
  if (n > 0) {
    sfx.fatigue();
    float(S.hero, `+${n} fatigue`, 'fatigue');
    if (S.fatigue >= BASE.fatigueMax) hint('fatigue-max', 'Fatigue à 3 : vous êtes à bout. Plus aucune compétence qui coûte de la fatigue avant un repos.');
  } else if (n < 0) {
    float(S.hero, `${n} fatigue`, 'heal');
  }
}

// ---------- Les actions de chaque classe ----------

function heroActions() {
  const c = S.cls;
  const h = S.hero;
  const w = S.weapon;
  const enemyTargets = () => liveZombies();
  const allyTargets = () => [h, S.sam].filter(alive);
  const list = [{
    id: 'attack',
    label: `Attaquer · ${w.name}`,
    cost: 'action',
    desc: `d20 ${signed(mod(h, w.stat))} (${STAT_NAME[w.stat]}) contre la CA. Dégâts : ${diceText(w.dice, w.flat, w.flat ? '' : STAT_NAME[w.stat])}${w.flat ? ' (Maîtrise)' : ''}.`,
    targets: enemyTargets,
    targetText: 'Cliquez sur le rôdeur à frapper',
    check: () => (h.status.defensive ? 'En position défensive, vous ne pouvez pas attaquer.' : null),
    run: (t) => heroAttack(t),
  }];

  if (c.id === 'policier') {
    list.push({
      id: 'provoke', label: 'Provoquer', cost: 'action', fatigue: 1,
      desc: `Le rôdeur fait un jet de Sagesse DD ${RULES.provokeDD}. Raté : il ne peut attaquer que vous, et vous passez en position défensive.`,
      targets: enemyTargets, targetText: 'Quel rôdeur provoquer ?',
      run: (t) => provoke(t),
    }, {
      id: 'defend', label: 'Position défensive', cost: 'action',
      desc: `+${RULES.defensive} CA jusqu'à votre prochain tour, mais pas d'attaque.`,
      check: () => (h.status.defensive ? 'Déjà en position défensive.' : null),
      run: async () => {
        h.status.defensive = true;
        render(h);
        float(h, `+${RULES.defensive} CA`, 'buff');
        log(`Vous levez le bouclier : CA ${ca(h)}.`, 'is-buff');
        await wait(500);
      },
    });
  }

  if (c.id === 'ingenieur') {
    list.push({
      id: 'craft', label: 'Arme improvisée', cost: 'action',
      desc: 'Un d4 décide de la qualité : 1-2 donne 1d4 + Maîtrise, 3-4 donne 1d6 + Maîtrise.',
      check: () => (S.crafted ? 'Arme déjà fabriquée.' : null),
      run: () => craft(),
    }, {
      id: 'weak', label: 'Repérer un point faible', cost: 'action', fatigue: 1,
      desc: 'Votre Intelligence contre son Charisme. Réussi : les attaques contre lui ont l’avantage.',
      targets: () => liveZombies().filter((z) => !z.status.exposed), noTarget: 'Tous les rôdeurs sont déjà repérés.',
      targetText: 'Quel rôdeur observer ?',
      run: (t) => weakPoint(t),
    });
  }

  if (c.id === 'medecin') {
    list.push({
      id: 'heal', label: `Kit de soin (${S.kit})`, cost: 'action',
      desc: `Rend 1d8 ${signed(mod(h, 'SAG'))} (Sagesse) PV à vous ou à Sam.`,
      check: () => (S.kit <= 0 ? 'Le kit est vide.' : null),
      targets: () => [h, S.sam].filter((u) => u.pv < u.max), noTarget: 'Personne n’est blessé.',
      targetText: 'Qui soigner ?',
      run: (t) => heal(t),
    }, {
      id: 'stabilize', label: 'Stabiliser', cost: 'action', fatigue: 1,
      desc: 'Un allié à terre récupère 1 PV.',
      targets: () => [S.sam].filter((u) => !alive(u)), noTarget: 'Personne n’est à terre.',
      run: (t) => stabilize(t),
    }, {
      id: 'stim', label: `Stim (${S.stims})`, cost: 'action',
      desc: `+1d4 PV et +1d4 sur tous ses jets pendant ${RULES.stimRounds} tours.`,
      check: () => (S.stims <= 0 ? 'Plus de stims.' : null),
      targets: () => allyTargets().filter((u) => !u.status.stim), noTarget: 'Tout le monde est déjà sous stim.',
      targetText: 'Qui reçoit le stim ?',
      run: (t) => stim(t),
    });
  }

  if (c.id === 'influenceur') {
    list.push({
      id: 'diversion', label: 'Diversion', cost: 'action',
      desc: `DD ${RULES.diversionDD} Sagesse, sur les créatures à plus de ${RULES.diversionInt} en Intelligence.`,
      check: () => `Les rôdeurs ont ${ZOMBIE.intScore} en Intelligence : la Diversion n'a aucun effet sur eux.`,
      run: async () => {},
    }, {
      id: 'motivate', label: 'Motivation', cost: 'bonus', fatigue: 1,
      desc: 'Sam ajoute 1d4 à son prochain jet.',
      targets: () => [S.sam].filter((u) => alive(u) && !u.status.motivated), noTarget: 'Sam est à terre ou déjà motivé.',
      run: (t) => motivate(t),
    });
  }

  if (c.id === 'motard') {
    list.push({
      id: 'multi', label: 'Attaque multiple', cost: 'bonus', fatigue: 1,
      desc: 'Une attaque supplémentaire avec votre action bonus.',
      targets: enemyTargets, targetText: 'Qui frapper encore ?',
      run: (t) => heroAttack(t),
    });
  }
  return list;
}

// ---------- Résolution ----------

async function heroAttack(t) {
  const h = S.hero;
  const w = S.weapon;
  const adv = !!t.status.exposed || !!h.status.hidden;
  const extra = h.status.stim ? [{ label: 'stim', sides: 4 }] : [];
  const sneaky = S.cls.id === 'voleur' && (t.status.distracted || h.status.hidden) && !S.sneakUsed;
  const r = await roll({
    label: `Vous attaquez ${t.name} (${w.name})`,
    adv, mod: mod(h, w.stat), modLabel: `(${STAT_NAME[w.stat]})`, extra, user: true,
  });
  let total = r.total;
  const crit = r.nat === 20;
  let hit = r.nat !== 1 && (crit || total >= ca(t));
  if (h.status.hidden) {
    delete h.status.hidden;
    render(h);
  }

  // Motard : rattraper un échec avec une arme improvisée.
  if (!hit && r.nat !== 1 && w.improvised && S.cls.id === 'motard' && S.fatigue < BASE.fatigueMax) {
    verdict(`${total} contre CA ${ca(t)} : raté de ${ca(t) - total}`, 'miss');
    const ok = await ask("Pro de l'improvisation", `Raté de ${ca(t) - total}. Ajouter 1d4 au jet pour 1 fatigue ?`, 'Ajouter 1d4', 'Laisser');
    if (ok) {
      pay(1);
      const more = await roll({ label: "Pro de l'improvisation", sides: 4 });
      total += more.total;
      hit = total >= ca(t);
      trayFormula.innerHTML = `Jet d'attaque ${r.total} + ${more.total} (1d4) = <b>${total}</b>`;
    }
  }

  if (!hit) {
    S.stats.misses++;
    verdict(r.nat === 1 ? '1 naturel : échec automatique' : `${total} < CA ${ca(t)} : raté`, 'miss');
    sfx.miss();
    float(t, 'Raté', 'miss');
    log(`Vous attaquez ${t.name} : ${total} contre CA ${ca(t)}, <b>raté</b>.`, 'is-miss');
    await hint('first-miss', `Raté : votre total (${total}) est sous sa CA (${ca(t)}). Un 1 naturel rate toujours, un 20 naturel touche toujours.`);
    await wait(500);
    return;
  }

  S.stats.hits++;
  verdict(crit ? '20 naturel : coup critique !' : `${total} ≥ CA ${ca(t)} : touché`, crit ? 'crit' : 'hit');
  if (crit) audio.stinger(0.4);
  await hint('first-hit', `Touché : ${total}, c'est au moins sa CA de ${ca(t)}.${adv ? ' Avec l’avantage, vous avez gardé le meilleur de deux d20.' : ''} Maintenant, les dégâts.`);
  await wait(450);

  const statMod = w.flat ? 0 : mod(h, w.stat);
  const flat = w.flat || statMod;
  const dmg = await roll({
    label: crit ? 'Dégâts critiques : dés doublés' : `Dégâts · ${w.name}`,
    count: w.dice[0] * (crit ? 2 : 1), sides: w.dice[1],
    mod: flat, modLabel: w.flat ? '(Maîtrise)' : `(${STAT_NAME[w.stat]})`,
  });
  let amount = Math.max(1, dmg.total);

  if (sneaky && S.fatigue < BASE.fatigueMax) {
    const why = t.status.distracted ? `${t.name} est occupé avec Sam` : 'Il ne vous a pas vu venir';
    const ok = await ask('Attaque sournoise', `${why} : +1d6 dégâts pour 1 fatigue ?`, '+1d6 dégâts', 'Non merci');
    if (ok) {
      S.sneakUsed = true;
      pay(1);
      const s = await roll({ label: 'Attaque sournoise', sides: 6 });
      trayFormula.innerHTML = `Dégâts ${amount} + ${s.total} (sournoise) = <b>${amount + s.total}</b>`;
      amount += s.total;
    }
  }

  verdict(`${amount} dégâts`, 'hit');
  log(`Vous touchez ${t.name} (${total} contre CA ${ca(t)}) : <b>${amount} dégâts</b>.`, 'is-hit');
  damage(t, amount);
  await hint('first-damage', 'Les dégâts : le dé de votre arme plus votre modificateur. À 0 PV, un rôdeur tombe.');
  await wait(600);

  // Motard : achever pour souffler.
  if (!alive(t) && S.cls.id === 'motard' && S.bonus) {
    const ok = await ask('Soif de bagarre', 'Vous avez porté le dernier coup. L’exécuter avec votre action bonus et perdre 1 fatigue ?', 'Exécuter', 'Non');
    if (ok) {
      S.bonus = false;
      tokens();
      pay(-1);
      log('Vous achevez le rôdeur : −1 fatigue.', 'is-buff');
      await wait(500);
    }
  }
}

function damage(u, n) {
  u.pv = Math.max(0, u.pv - n);
  if (u === S.hero) S.stats.taken += n;
  else if (u.side === 'enemy') S.stats.dealt += n;
  float(u, `−${n}`, 'dmg');
  jolt(u);
  sfx.hit();
  if (u === S.hero && !REDUCED) { world?.red(0.5); world?.shake(0.15); }
  render(u);
  if (!alive(u)) {
    if (u.side === 'enemy') {
      log(`${u.name} s'effondre.`, 'is-kill');
      audio.growl();
      renderOrder();
    } else if (u === S.sam) {
      log('Sam est à terre.', 'is-bad');
    }
  }
}

async function provoke(t) {
  const r = await roll({ label: `${t.name} : jet de Sagesse DD ${RULES.provokeDD}`, mod: mod(t, 'SAG'), modLabel: '(Sagesse)' });
  if (r.total < RULES.provokeDD) {
    t.status.provoked = true;
    verdict(`${r.total} < DD ${RULES.provokeDD} : provoqué`, 'hit');
    log(`${t.name} rate son jet (${r.total}) : il ne voit plus que vous.`, 'is-buff');
  } else {
    verdict(`${r.total} ≥ DD ${RULES.provokeDD} : il résiste`, 'miss');
    log(`${t.name} résiste à la provocation (${r.total}).`, 'is-miss');
  }
  S.hero.status.defensive = true;
  render(t);
  render(S.hero);
  float(S.hero, `+${RULES.defensive} CA`, 'buff');
  await hint('provoke', `Le DD, c'est le seuil à battre pour résister. Et vous passez en position défensive : +${RULES.defensive} CA, mais pas d'attaque jusqu'à votre prochain tour.`);
  await wait(500);
}

async function craft() {
  const r = await roll({ label: 'Arme improvisée : qualité', sides: 4, user: true });
  const good = r.total >= 3;
  S.crafted = true;
  S.weapon = { name: good ? 'Lance de fortune' : 'Masse bricolée', dice: [1, good ? 6 : 4], flat: RULES.maitrise, stat: 'FOR', improvised: true };
  verdict(`${r.total} : ${good ? '1d6' : '1d4'} + Maîtrise (${RULES.maitrise})`, 'hit');
  log(`Vous fabriquez une ${S.weapon.name.toLowerCase()} : ${diceText(S.weapon.dice, RULES.maitrise)} dégâts.`, 'is-buff');
  await hint('craft', `La Maîtrise vaut +${RULES.maitrise} au niveau 1 : vos dégâts ne dépendent plus de votre Force.`);
  await wait(500);
}

async function weakPoint(t) {
  const me = await roll({ label: 'Votre jet d’Intelligence', mod: mod(S.hero, 'INT'), modLabel: '(Intelligence)', user: true });
  await wait(400);
  const them = await roll({ label: `${t.name} : jet de Charisme`, mod: mod(t, 'CHA'), modLabel: '(Charisme)' });
  if (me.total >= them.total) {
    t.status.exposed = S.round + 1;
    verdict(`${me.total} contre ${them.total} : faille trouvée`, 'hit');
    log(`Point faible repéré sur ${t.name} (${me.total} contre ${them.total}) : avantage contre lui.`, 'is-buff');
  } else {
    verdict(`${me.total} contre ${them.total} : rien trouvé`, 'miss');
    log(`Pas de faille visible sur ${t.name} (${me.total} contre ${them.total}).`, 'is-miss');
  }
  render(t);
  await hint('weak', 'Un jet opposé : chacun lance son d20, le plus haut gagne. L’avantage fait lancer deux d20 et garder le meilleur.');
  await wait(500);
}

async function heal(t) {
  S.kit--;
  const r = await roll({ label: `Kit de soin sur ${t.name}`, sides: 8, mod: mod(S.hero, 'SAG'), modLabel: '(Sagesse)', user: true });
  const n = Math.max(1, r.total);
  const before = t.pv;
  t.pv = Math.min(t.max, t.pv + n);
  verdict(`+${t.pv - before} PV`, 'heal');
  float(t, `+${t.pv - before}`, 'heal');
  sfx.heal();
  render(t);
  renderOrder();
  log(`Vous soignez ${t.name} : +${t.pv - before} PV.`, 'is-heal');
  await wait(500);
}

async function stabilize(t) {
  t.pv = 1;
  float(t, '+1', 'heal');
  sfx.heal();
  render(t);
  renderOrder();
  verdict(`${t.name} reprend connaissance`, 'heal');
  log(`Vous stabilisez ${t.name} : il revient à 1 PV.`, 'is-heal');
  await wait(600);
}

async function stim(t) {
  S.stims--;
  const r = await roll({ label: `Stim pour ${t.name}`, sides: 4 });
  t.pv += r.total;
  t.status.stim = RULES.stimRounds;
  float(t, `+${r.total}`, 'heal');
  sfx.heal();
  render(t);
  verdict(`+${r.total} PV et +1d4 aux jets`, 'heal');
  log(`Stim pour ${t.name} : +${r.total} PV, +1d4 à ses jets pendant ${RULES.stimRounds} tours.`, 'is-heal');
  await wait(500);
}

async function motivate(t) {
  t.status.motivated = true;
  render(t);
  float(t, '+1d4', 'buff');
  audio.tone({ type: 'triangle', freq: 660, to: 990, peak: 0.08, decay: 0.3 });
  verdict('Sam ajoutera 1d4 à son prochain jet', 'heal');
  log('« Tu vas l’avoir, Sam ! » : +1d4 à son prochain jet.', 'is-buff');
  await wait(500);
}

// ---------- Tours ----------

async function heroTurn() {
  const h = S.hero;
  if (h.status.defensive) {
    delete h.status.defensive;
    render(h);
  }
  S.zombies.forEach((z) => {
    if (z.status.exposed && S.round > z.status.exposed) {
      delete z.status.exposed;
      render(z);
    }
  });
  S.action = true;
  S.bonus = true;
  S.sneakUsed = false;
  tokens();
  S.heroTurns++;
  S.suggest = S.heroTurns === 1 ? 'attack' : null;

  if (S.heroTurns === 1) {
    await hint('turn-1', 'Votre tour. Vous avez une action et une action bonus. Pour frapper : Attaquer, puis cliquez sur un rôdeur.');
  } else if (S.heroTurns === 2) {
    S.suggest = SKILL_TIP[S.cls.id].id;
    await hint('turn-2', SKILL_TIP[S.cls.id].text);
  }
  if (h.pv <= 8) await hint('low', 'Vous saignez. Pensez à vous protéger : chaque PV compte.');

  while (!S.over) {
    const { a, target } = await choose();
    if (a.id === 'end') break;
    lockActions();
    if (a.cost === 'action') S.action = false;
    if (a.cost === 'bonus') S.bonus = false;
    tokens();
    if (a.fatigue) pay(a.fatigue);
    await a.run(target);
    if (checkEnd()) return;
    const left = heroActions().some((x) => x.cost === 'bonus' && !blockReason(x));
    if (!S.action && !left) {
      await wait(400);
      break;
    }
  }
  lockActions();
  actionsEl.innerHTML = '';
}

const SKILL_TIP = {
  policier: { id: 'provoke', text: `Essayez Provoquer : le rôdeur fait un jet de Sagesse contre DD ${RULES.provokeDD}. S'il le rate, il ne peut attaquer que vous. Ça coûte 1 fatigue.` },
  ingenieur: { id: 'craft', text: 'Fabriquez votre arme improvisée : un d4 décide de sa qualité. Ou repérez un point faible pour 1 fatigue : vos attaques auront l’avantage.' },
  voleur: { id: 'attack', text: 'Un rôdeur qui attaque Sam est distrait. Frappez-le : si vous touchez, l’attaque sournoise ajoute 1d6 dégâts pour 1 fatigue.' },
  medecin: { id: 'heal', text: 'Le kit de soin rend 1d8 + Sagesse PV, à vous ou à Sam. Si Sam tombe, Stabiliser le relève à 1 PV pour 1 fatigue.' },
  influenceur: { id: 'motivate', text: `La Diversion ne marche que sur les créatures à plus de ${RULES.diversionInt} en Intelligence : les rôdeurs en ont ${ZOMBIE.intScore}. Motivez plutôt Sam : +1d4 à son prochain jet, avec votre action bonus.` },
  motard: { id: 'multi', text: 'Après votre attaque, il vous reste l’action bonus : Attaque multiple vous fait frapper une deuxième fois, pour 1 fatigue.' },
};

async function samTurn() {
  const sam = S.sam;
  const targets = liveZombies().sort((a, b) => a.pv - b.pv);
  if (!targets.length) return;
  const t = targets[0];
  await wait(350);
  const extra = [];
  if (sam.status.motivated) extra.push({ label: 'motivation', sides: 4 });
  if (sam.status.stim) extra.push({ label: 'stim', sides: 4 });
  const r = await roll({ label: `Sam attaque ${t.name}`, adv: !!t.status.exposed, mod: SAM.attack, modLabel: '(attaque)', extra });
  delete sam.status.motivated;
  render(sam);
  const hit = r.nat !== 1 && (r.nat === 20 || r.total >= ca(t));
  if (!hit) {
    verdict(`${r.total} < CA ${ca(t)} : raté`, 'miss');
    sfx.miss();
    float(t, 'Raté', 'miss');
    log(`Sam attaque ${t.name} : ${r.total}, raté.`, 'is-miss');
    await wait(700);
    return;
  }
  await wait(300);
  const dmg = await roll({ label: 'Dégâts de Sam', count: SAM.dmg[0], sides: SAM.dmg[1], mod: SAM.dmgFlat, modLabel: '(Force)' });
  verdict(`${dmg.total} dégâts`, 'hit');
  log(`Sam touche ${t.name} : ${dmg.total} dégâts.`, 'is-hit');
  damage(t, dmg.total);
  await wait(700);
}

async function zombieTurn(z) {
  if (z.status.immobilized) {
    delete z.status.immobilized;
    render(z);
    verdict(`${z.name} se débat dans le piège`, 'miss');
    log(`${z.name} reste coincé dans le piège : il perd son tour.`, 'is-buff');
    await wait(900);
    return;
  }
  const h = S.hero;
  let t;
  if (z.status.provoked) t = h;
  else {
    const pool = [];
    if (!h.status.hidden) pool.push(h);
    if (alive(S.sam)) pool.push(S.sam);
    t = pool.length ? pool[Math.random() < 0.55 || pool.length === 1 ? 0 : 1] : h;
  }
  z.status.distracted = t !== h;
  await wait(350);
  if (Math.random() < 0.5) audio.growl();
  const attacks = t === h ? 'vous attaque' : `attaque ${t.name}`;
  const r = await roll({ label: `${z.name} ${attacks}`, mod: ZOMBIE.attack, modLabel: '(morsure)' });
  const hit = r.nat !== 1 && (r.nat === 20 || r.total >= ca(t));
  if (t === h && !S.tips.has('enemy-attack')) {
    await hint('enemy-attack', `Il vous attaque : son d20 + ${ZOMBIE.attack} contre votre CA de ${ca(h)}. Plus votre CA est haute, plus il rate.`);
  }
  if (!hit) {
    verdict(`${r.total} < CA ${ca(t)} : raté`, 'miss');
    sfx.miss();
    float(t, 'Esquivé', 'miss');
    log(`${z.name} ${attacks} : ${r.total} contre CA ${ca(t)}, raté.`, 'is-miss');
  } else {
    await wait(300);
    const dmg = await roll({ label: `Morsure de ${z.name}`, count: ZOMBIE.dmg[0], sides: ZOMBIE.dmg[1], mod: ZOMBIE.dmgFlat, modLabel: '(Force)' });
    verdict(`${dmg.total} dégâts`, 'bad');
    log(`${z.name} mord ${t === h ? 'vous' : t.name} : <b>${dmg.total} dégâts</b>.`, 'is-bad');
    damage(t, dmg.total);
    if (t === S.sam && !alive(S.sam)) {
      await hint('sam-down', S.cls.id === 'medecin'
        ? 'Sam est à terre ! Stabiliser le relève à 1 PV, ou le kit de soin le remet sur pied.'
        : 'Sam est à terre. Il ne se battra plus. Finissez-en vite.');
    }
  }
  if (z.status.provoked) {
    delete z.status.provoked;
    render(z);
  }
  render(z);
  await wait(800);
}

function checkEnd() {
  if (S.over) return true;
  if (!alive(S.hero)) { S.over = 'lose'; return true; }
  if (!liveZombies().length) { S.over = 'win'; return true; }
  return false;
}

// ---------- Déroulé d'une partie ----------

function newState(cls) {
  const w = WEAPONS[cls.id];
  const hero = { id: 'hero', side: 'hero', name: cls.name, sub: 'Vous', pv: BASE.pv, max: BASE.pv, ca: cls.ca + (cls.caBonus || 0), stats: { ...cls.stats }, status: {}, art: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[cls.id]}</svg>` };
  const sam = { id: 'sam', side: 'ally', name: SAM.name, sub: SAM.sub, pv: SAM.pv, max: SAM.pv, ca: SAM.ca, stats: { ...SAM.stats }, status: {}, art: ART.civil };
  const zombies = [1, 2].map((n) => ({ id: `z${n}`, side: 'enemy', name: `${ZOMBIE.name} ${n}`, pv: ZOMBIE.pv, max: ZOMBIE.pv, ca: ZOMBIE.ca, stats: { ...ZOMBIE.stats }, status: {}, art: ART.zombie }));
  return {
    cls, hero, sam, zombies, order: [], round: 0, heroTurns: 0, fatigue: 0,
    action: false, bonus: false, weapon: { ...w }, crafted: false, kit: RULES.kitUses, stims: RULES.stims,
    tips: new Set(), guided: S ? S.guided : true, over: false, suggest: null, sneakUsed: false,
    stats: { hits: 0, misses: 0, dealt: 0, taken: 0 },
  };
}

async function start(id) {
  const cls = CLASSES.find((c) => c.id === id);
  S = newState(cls);
  audio.impact();
  $('pick').hidden = true;
  $('end').hidden = true;
  arena.hidden = false;
  scrollTo({ top: 0 });
  world?.flash(0.4);

  enemiesEl.innerHTML = '';
  alliesEl.innerHTML = '';
  logEl.innerHTML = '';
  actionsEl.innerHTML = '';
  orderEl.innerHTML = '';
  coachText.textContent = '';
  trayLabel.textContent = 'En attente du contact';
  trayFormula.textContent = '';
  trayVerdict.textContent = '';
  dieAlt.textContent = '';
  alliesEl.append(card(S.hero), card(S.sam));
  S.zombies.forEach((z) => { card(z); z.el.classList.add('is-hidden'); enemiesEl.appendChild(z.el); });
  tokens();
  gsap.fromTo('.coach, .field, .bar, .journal', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'expo.out' });

  await say('Ici le Capitaine Trevor. Avant le vrai, on s’entraîne. Simulation de combat, niveau un.', { next: true });
  await say(`Votre fiche : ${BASE.pv} points de vie, une CA de ${S.hero.ca} et une jauge de fatigue qui monte jusqu’à ${BASE.fatigueMax}. La CA, c’est ce qu’un ennemi doit atteindre avec son d20 pour vous toucher.`, { next: true });
  await say('Avec vous, Sam, un civil. Il se bat mal, mais il se bat. Gardez-le en vie.', { next: true });
  await prepare();

  // Contact.
  S.zombies.forEach((z, i) => setTimeout(() => {
    z.el.classList.remove('is-hidden');
    gsap.fromTo(z.el, { opacity: 0, y: -40, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'expo.out' });
  }, i * 350));
  audio.growl();
  audio.stinger(0.5);
  log('Deux rôdeurs sortent de l’ombre.', 'is-bad');
  if (S.trap) await springTrap();
  await say(`Contact. Deux rôdeurs en face : CA ${ZOMBIE.ca}, ${ZOMBIE.pv} points de vie chacun.`, { next: true, label: 'En position' });

  await initiative();
  await fight();
  end();
}

async function prepare() {
  const c = S.cls;
  if (c.id === 'ingenieur') {
    await say('Ils arrivent dans dix minutes. Assez pour poser un piège improvisé.');
    const ok = await ask('Piège improvisé', '10 minutes d’installation, 1 fatigue. Le premier rôdeur sera immobilisé et prendra 1d4 dégâts.', 'Poser le piège', 'Pas de piège');
    if (ok) {
      pay(1);
      S.trap = true;
      log('Vous posez un piège dans le couloir (+1 fatigue).', 'is-buff');
    }
  } else if (c.id === 'voleur') {
    await say(`Vous avez le temps de vous cacher. Tapi dans l'arbre : jet de Dextérité avec avantage contre DD ${RULES.hideDD}.`);
    const ok = await ask('Se cacher', 'Réussi, vous commencez caché : ils ne vous verront pas venir.', 'Se cacher', 'Rester à découvert');
    if (ok) {
      const r = await roll({ label: `Se cacher : Dextérité DD ${RULES.hideDD}`, adv: true, mod: mod(S.hero, 'DEX'), modLabel: '(Dextérité)', user: true });
      if (r.total >= RULES.hideDD) {
        S.hero.status.hidden = true;
        verdict(`${r.total} ≥ DD ${RULES.hideDD} : caché`, 'hit');
        log(`Vous vous cachez (${r.total}).`, 'is-buff');
      } else {
        verdict(`${r.total} < DD ${RULES.hideDD} : repéré`, 'miss');
        log(`Vous ne trouvez pas de cachette (${r.total}).`, 'is-miss');
      }
      render(S.hero);
      await say('L’avantage : deux d20, on garde le meilleur. Votre compétence vous le donne pour vous cacher.', { next: true });
    }
  } else if (c.id === 'policier') {
    await say(`Bouclier anti-émeute en main : CA ${c.ca} + ${c.caBonus} = ${S.hero.ca}. Vous êtes le plus dur à toucher du groupe.`, { next: true });
  } else if (c.id === 'motard') {
    await say(`Casque et gants : CA ${c.ca} + ${c.caBonus} = ${S.hero.ca}. Vous ramassez une barre de fer : arme improvisée, 1d4 + Force.`, { next: true });
  } else {
    await say(`Vous n’avez pas d’arme. Ramassez ce pied-de-biche : arme improvisée, 1d4 + Force (${signed(mod(S.hero, 'FOR'))}). Votre force est ailleurs.`, { next: true });
  }
}

async function springTrap() {
  const z = S.zombies[0];
  await wait(700);
  z.status.immobilized = true;
  const r = await roll({ label: `Le piège se referme sur ${z.name}`, sides: 4 });
  verdict(`${r.total} dégâts, immobilisé`, 'hit');
  log(`Le piège se referme sur ${z.name} : ${r.total} dégâts, il perd son prochain tour.`, 'is-hit');
  damage(z, r.total);
}

async function initiative() {
  await say('Initiative : chacun lance un d20 et ajoute sa Dextérité. Le plus haut agit en premier. À vous de lancer.');
  const all = [S.hero, S.sam, ...S.zombies];
  const me = await roll({ label: 'Votre initiative', mod: mod(S.hero, 'DEX'), modLabel: '(Dextérité)', user: true });
  S.hero.init = me.total;
  for (const u of all.slice(1)) {
    await wait(250);
    const r = await roll({ label: `Initiative : ${u.name}`, mod: mod(u, 'DEX'), modLabel: '(Dextérité)' });
    u.init = r.total;
  }
  S.order = all.filter((u) => u.side !== 'enemy' || alive(u)).sort((a, b) => b.init - a.init || (a.side === 'hero' ? -1 : 1));
  S.round = 1;
  renderOrder();
  log(`Ordre du tour : ${S.order.map((u) => `${u.name} (${u.init})`).join(', ')}.`);
  verdict(`Vous jouez en ${S.order.indexOf(S.hero) + 1}${S.order.indexOf(S.hero) ? 'e' : 'er'}`, 'hit');
  await say('Voilà l’ordre. Il reste le même jusqu’à la fin du combat.', { next: true, label: 'Au combat' });
}

async function fight() {
  while (!S.over) {
    renderOrder();
    for (const u of S.order) {
      if (S.over) break;
      if (!alive(u)) continue;
      setActive(u);
      if (u.side === 'hero') await heroTurn();
      else if (u.side === 'ally') await samTurn();
      else await zombieTurn(u);
      if (checkEnd()) break;
    }
    if (S.over) break;
    // Fin du tour de table : les effets qui durent s'usent.
    [S.hero, S.sam].forEach((u) => {
      if (u.status.stim && --u.status.stim <= 0) delete u.status.stim;
      render(u);
    });
    S.round++;
  }
  setActive({});
}

function end() {
  const win = S.over === 'win';
  if (win) {
    audio.alertTone(1);
    log('Zone sécurisée.', 'is-heal');
  } else {
    audio.impact();
    world?.red(0.9);
    log('Vous êtes à terre.', 'is-bad');
  }
  const finish = async () => {
    await say(win
      ? 'Zone sécurisée. Bon travail. Retenez ça : d20 plus modificateur contre la CA, puis les dégâts.'
      : 'Vous êtes à terre. En vrai, ce serait fini. Recommencez : ça s’apprend.', { next: true, label: 'Voir le bilan' });
    arena.hidden = true;
    $('end').hidden = false;
    scrollTo({ top: 0 });
    $('end-kicker').textContent = win ? 'Simulation réussie' : 'Simulation échouée';
    $('end-title').textContent = win ? 'Zone sécurisée' : 'À terre';
    $('end-text').textContent = win
      ? `Les deux rôdeurs sont tombés${alive(S.sam) ? ' et Sam est vivant' : ', mais Sam est resté à terre'}. Vous savez jouer un combat.`
      : 'Les rôdeurs ont eu raison de vous. Essayez une autre approche, ou une autre classe.';
    const total = S.stats.hits + S.stats.misses;
    $('end-stats').innerHTML = [
      ['Classe', S.cls.name],
      ['Tours de table', S.round],
      ['Attaques réussies', `${S.stats.hits} / ${total}`],
      ['Dégâts infligés', S.stats.dealt],
      ['Dégâts reçus', S.stats.taken],
      ['PV restants', `${S.hero.pv} / ${S.hero.max}`],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    renderRest();
    gsap.fromTo('#end > *', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'expo.out' });
  };
  if (S.guided) finish();
  else { S.guided = true; finish().then(() => { S.guided = false; }); }
}

function renderRest() {
  $('rest-pips').querySelectorAll('i').forEach((p, k) => p.classList.toggle('is-on', k < S.fatigue));
  $('rest-text').textContent = S.fatigue
    ? `Fatigue : ${S.fatigue} / ${BASE.fatigueMax}. Un repos court la fait redescendre de ${BASE.shortRest}.`
    : 'Fatigue à 0 : vous êtes reposé.';
  $('rest-btn').disabled = !S.fatigue;
}

$('rest-btn').addEventListener('click', () => {
  S.fatigue = Math.max(0, S.fatigue - BASE.shortRest);
  sfx.heal();
  renderRest();
});
$('again').addEventListener('click', () => start(S.cls.id));
$('change').addEventListener('click', () => {
  $('end').hidden = true;
  $('pick').hidden = false;
  scrollTo({ top: 0 });
});
