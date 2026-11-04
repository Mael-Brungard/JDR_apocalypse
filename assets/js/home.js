import { initCore, lenis, REDUCED, splitChars, typewrite, onCenter, glitchLoop, radioWave } from './core.js';
import { audio } from './audio.js';
import { createWorld, followScroll } from './world.js';

const { gsap } = window;
initCore({ ambient: { drone: 1, wind: 1, heart: 56 } });

const root = document.documentElement;
const gate = document.getElementById('gate');
const holdBtn = document.getElementById('hold');
const holdFill = holdBtn.querySelector('.hold-fill');
const holdLabel = document.getElementById('hold-label');
const loadPct = document.getElementById('gate-load');
const title = document.getElementById('title');
const lines = [...title.querySelectorAll('.t-line')];
lines.forEach((l) => { l.dataset.text = l.textContent.trim(); });
const chars = lines.flatMap((l) => splitChars(l));
const heroBits = document.querySelectorAll('[data-hero-fade]');

let world = null;
const alreadyIn = (() => { try { return sessionStorage.getItem('bclf-entered') === '1'; } catch { return false; } })();

gsap.set(chars, { opacity: 0 });
gsap.set(heroBits, { opacity: 0 });

// ---------- Le monde se charge derrière l'écran d'avertissement ----------

let fakeLoad = 0;
const loadTimer = setInterval(() => {
  fakeLoad = Math.min(fakeLoad + Math.random() * 9, world ? 100 : 92);
  loadPct.textContent = Math.round(fakeLoad);
  if (fakeLoad >= 100) clearInterval(loadTimer);
}, 90);

createWorld(document.getElementById('world'), { zombies: true, flashlight: 'mouse', view: 'street' })
  .then((w) => {
    world = w;
    world.onLightning = () => audio.thunder(0.5 + Math.random() * 1.6);
    world.onLunge = () => { audio.growl(); audio.stinger(0.7); };
    followScroll(world, document.querySelectorAll('[data-view]'));
  })
  .catch((err) => console.error('Monde 3D indisponible :', err));

// ---------- Écran d'entrée : maintenir pour entrer ----------

let progress = 0;
let holding = false;
let entered = false;
let pressAt = 0;

if (alreadyIn) {
  gate.hidden = true;
  requestAnimationFrame(intro);
} else {
  root.style.overflow = 'hidden';
  lenis?.stop();
  holdBtn.focus({ preventScroll: true });
}

const isKey = (e) => e.key === 'Enter' || e.key === ' ';
function startHold(e) {
  if (entered) return;
  if (e.type === 'keydown' && (!isKey(e) || e.repeat)) return;
  e.preventDefault();
  holding = true;
  pressAt = performance.now();
  if (!audio.on) audio.enable();
}
function stopHold(e) {
  if (e.type === 'keyup' && !isKey(e)) return;
  if (!holding) return;
  holding = false;
  if (performance.now() - pressAt < 250 && !entered) {
    holdLabel.innerHTML = 'Gardez<br>appuyé';
  }
}
holdBtn.addEventListener('pointerdown', startHold);
holdBtn.addEventListener('keydown', startHold);
holdBtn.addEventListener('keyup', stopHold);
addEventListener('pointerup', stopHold);
addEventListener('pointercancel', stopHold);
holdBtn.addEventListener('contextmenu', (e) => e.preventDefault());

document.getElementById('enter-mute').addEventListener('click', () => {
  audio.disable();
  enter();
});

const holdTick = (_, dt) => {
  if (entered) return;
  progress = Math.min(1, Math.max(0, progress + (holding ? dt / 1700 : -dt / 600)));
  holdFill.style.strokeDashoffset = String(339.3 * (1 - progress));
  audio.heartbeat(56 + progress * 110);
  if (!REDUCED) {
    const s = holding ? progress * 7 : 0;
    gate.querySelector('.gate-inner').style.transform = s ? `translate(${(Math.random() - 0.5) * s}px, ${(Math.random() - 0.5) * s}px)` : '';
    gate.style.background = `radial-gradient(ellipse at center, rgba(${60 + progress * 120},6,8,1) 0%, #060404 ${70 - progress * 20}%)`;
  }
  if (progress >= 1) enter();
};
gsap.ticker.add(holdTick);

function enter() {
  if (entered) return;
  entered = true;
  gsap.ticker.remove(holdTick);
  try { sessionStorage.setItem('bclf-entered', '1'); } catch { /* navigation privée */ }
  audio.heartbeat(60);
  audio.impact();
  root.style.overflow = '';
  lenis?.start();
  gsap.timeline()
    .to(gate, { backgroundColor: '#fff', duration: 0.06 })
    .to(gate, { opacity: 0, duration: REDUCED ? 0.2 : 1.4, ease: 'power2.in', onComplete: () => { gate.hidden = true; } })
    .add(intro, '-=0.6');
  world?.flash(0.8);
}

// ---------- Titre : lettres qui tombent, puis saignent ----------

function intro() {
  gsap.fromTo(chars,
    { opacity: 0, yPercent: () => gsap.utils.random(-90, 90), rotate: () => gsap.utils.random(-25, 25), filter: 'blur(14px)' },
    {
      opacity: 1, yPercent: 0, rotate: 0, filter: 'blur(0px)',
      duration: REDUCED ? 0.01 : 1.4,
      ease: 'expo.out',
      stagger: { each: 0.045, from: 'random' },
      onComplete: () => {
        gsap.set(chars, { clearProps: 'filter' });
        lines.forEach((l) => glitchLoop(l, 2200, 6500));
        startDrips();
      },
    });
  gsap.to(heroBits, { opacity: 1, duration: 1.2, delay: 1.1, stagger: 0.15 });
}

function startDrips() {
  if (REDUCED) return;
  const cv = document.getElementById('drips');
  const g = cv.getContext('2d');
  const stack = cv.parentElement;
  const dpr = Math.min(devicePixelRatio, 2);
  let W = 0, H = 0;
  const size = () => {
    W = cv.clientWidth;
    H = cv.clientHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  addEventListener('resize', size);
  const solid = chars.filter((c) => c.textContent.trim());
  const scale = Math.min(1, 0.35 + innerWidth / 1400);
  const drips = [];
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stack);

  const spawn = () => {
    if (drips.length > 46) return;
    const c = solid[(Math.random() * solid.length) | 0];
    const r = c.getBoundingClientRect();
    const s = cv.getBoundingClientRect();
    drips.push({
      x: r.left - s.left + r.width * (0.12 + Math.random() * 0.76),
      y: r.bottom - s.top - r.height * 0.1,
      len: 0,
      max: (14 + Math.random() ** 3 * 240) * scale,
      w: (2.5 + Math.random() * 5.5) * scale,
      v: 14 + Math.random() * 40,
      age: 0,
    });
  };
  for (let i = 0; i < 14; i++) spawn();

  gsap.ticker.add((_, dtMs) => {
    if (!visible) return;
    const dt = dtMs / 1000;
    if (Math.random() < dt * 2.2) spawn();
    g.clearRect(0, 0, W, H);
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i];
      d.age += dt;
      const left = 1 - d.len / d.max;
      d.len += d.v * dt * Math.max(left, 0) ** 0.6 * (0.6 + Math.random() * 0.8);
      const alpha = d.age > 9 ? Math.max(0, 1 - (d.age - 9) / 3) : 1;
      if (alpha <= 0) { drips.splice(i, 1); continue; }
      const grd = g.createLinearGradient(0, d.y, 0, d.y + d.len);
      grd.addColorStop(0, `rgba(120,8,12,${alpha})`);
      grd.addColorStop(1, `rgba(190,18,26,${alpha})`);
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(d.x - d.w * 0.9, d.y);
      g.quadraticCurveTo(d.x - d.w * 0.5, d.y + d.len * 0.3, d.x - d.w * 0.5, d.y + d.len);
      g.lineTo(d.x + d.w * 0.5, d.y + d.len);
      g.quadraticCurveTo(d.x + d.w * 0.5, d.y + d.len * 0.3, d.x + d.w * 0.9, d.y);
      g.fill();
      g.beginPath();
      g.arc(d.x, d.y + d.len, d.w * 0.75, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// ---------- Défilement ----------

gsap.to('.hero-stack', {
  yPercent: -25,
  opacity: 0.1,
  ease: 'none',
  scrollTrigger: { trigger: '.h-hero', start: 'top top', end: 'bottom top', scrub: true },
});

document.querySelectorAll('.h-frag').forEach((sec) => {
  const num = sec.querySelector('.frag-num');
  const word = sec.querySelector('.frag-word');
  const sub = sec.querySelector('.frag-sub');
  gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 70%', end: 'bottom 30%', toggleActions: 'play reverse play reverse' } })
    .fromTo(num, { opacity: 0, scale: 1.35, filter: 'blur(24px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out' })
    .fromTo(word, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' }, '-=0.7')
    .fromTo(word, { opacity: 0.2 }, { opacity: 1, duration: 0.3, ease: 'steps(4)' }, '-=0.4')
    .fromTo(sub, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.3');
});

// La lumière lâche : lampadaires, fenêtres, tout s'éteint.
onCenter(document.getElementById('powercut'), () => {
  world?.trigger('powercut');
  audio.burst({ type: 'bandpass', freq: 120, q: 4, peak: 0.5, attack: 0.01, decay: 0.5 });
  audio.tone({ type: 'sawtooth', freq: 60, to: 30, peak: 0.12, decay: 1.2 });
  const cv = document.getElementById('world');
  if (!REDUCED) gsap.to(cv, { keyframes: { opacity: [1, 0.15, 0.9, 0.1, 0.7, 0.05, 1] }, duration: 1.4, ease: 'steps(7)' });
});

// Diffusion d'urgence.
const setWave = radioWave(document.getElementById('wave'));
const radioText = document.getElementById('radio-text');
const radioSub = document.getElementById('radio-sub');
radioText.textContent = '';
radioSub.textContent = '';
onCenter(document.getElementById('broadcast'), async () => {
  world?.trigger('alert');
  audio.staticBurst(0.9, 0.45);
  audio.alertTone(3);
  audio.layer('siren', 1, 4);
  setWave(0.7);
  await new Promise((r) => setTimeout(r, REDUCED ? 0 : 2300));
  await typewrite(radioText, radioText.dataset.text, { speed: 55 });
  await typewrite(radioSub, radioSub.dataset.text, { speed: 28 });
  setWave(0.12);
});

// Présage.
gsap.fromTo('.omen', { opacity: 0, scale: 0.92, filter: 'blur(10px)' }, {
  opacity: 1, scale: 1, filter: 'blur(0px)', ease: 'none',
  scrollTrigger: { trigger: '#omen', start: 'top 80%', end: 'center center', scrub: true },
});
onCenter(document.getElementById('omen'), () => {
  audio.stinger(0.6);
  world?.red(0.5);
  audio.layer('crowd', 0.7, 6);
});

// Les deux portes.
gsap.fromTo('.door', { opacity: 0, y: 60 }, {
  opacity: 1, y: 0, duration: 1, stagger: 0.15, ease: 'expo.out',
  scrollTrigger: { trigger: '.doors', start: 'top 80%' },
});
document.querySelectorAll('.door').forEach((door) => {
  door.addEventListener('pointermove', (e) => {
    const r = door.getBoundingClientRect();
    door.style.setProperty('--mx', `${e.clientX - r.left}px`);
    door.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});
