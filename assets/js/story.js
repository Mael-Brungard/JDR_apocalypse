import { initCore, REDUCED, splitChars, typewrite, onCenter, glitchLoop, radioWave } from './core.js';
import { audio } from './audio.js';
import { createWorld, followScroll } from './world.js';

const { gsap, ScrollTrigger } = window;
initCore({ ambient: { drone: 0.9, wind: 1 } });

let world = null;
createWorld(document.getElementById('world'), { flashlight: 'drift', view: 'street' })
  .then((w) => {
    world = w;
    world.onLightning = () => audio.thunder(0.6 + Math.random() * 1.5);
    followScroll(world, document.querySelectorAll('[data-view]'));
  })
  .catch((err) => console.error('Monde 3D indisponible :', err));

// ---------- Titre ----------

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
gsap.from('.s-hero .kicker, .s-meta', { opacity: 0, y: 20, duration: 1, delay: 1.2, stagger: 0.2 });

// ---------- Lecture : chaque paragraphe sort de l'ombre ----------

document.querySelectorAll('.s-p, .s-scream, .s-radio, .s-comms').forEach((el) => {
  gsap.fromTo(el, { opacity: 0, y: 40, filter: 'blur(8px)' }, {
    opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    onComplete: () => gsap.set(el, { clearProps: 'filter' }),
  });
});

// Rail des chapitres.
const rail = document.querySelector('.s-rail');
const railItems = [...rail.querySelectorAll('li')];
ScrollTrigger.create({
  trigger: '#story',
  start: 'top 60%',
  end: 'bottom 40%',
  onToggle: (self) => rail.classList.toggle('is-on', self.isActive),
});
document.querySelectorAll('[data-chapter]').forEach((el) => {
  ScrollTrigger.create({
    trigger: el,
    start: 'top 55%',
    onEnter: () => setChapter(el.id),
    onLeaveBack: () => {
      const i = railItems.findIndex((li) => li.dataset.for === el.id);
      if (i > 0) setChapter(railItems[i - 1].dataset.for);
    },
  });
});
function setChapter(id) {
  railItems.forEach((li) => li.classList.toggle('is-active', li.dataset.for === id));
}

// ---------- Moments du récit ----------

onCenter(document.getElementById('ironic'), () => {
  document.getElementById('ironic').classList.add('is-on');
  audio.burst({ type: 'bandpass', freq: 3200, q: 2, peak: 0.12, attack: 0.05, decay: 0.5 });
});

onCenter(document.getElementById('powercut'), () => {
  document.querySelector('.s-flicker').classList.add('is-on');
  world?.trigger('powercut');
  audio.burst({ type: 'bandpass', freq: 120, q: 4, peak: 0.45, attack: 0.01, decay: 0.5 });
  audio.tone({ type: 'sawtooth', freq: 60, to: 30, peak: 0.12, decay: 1.2 });
});

// Les messages radio se tapent au moment où on les atteint.
document.querySelectorAll('[data-type]').forEach((p) => {
  p.dataset.text = p.textContent.trim();
  p.style.minHeight = `${p.offsetHeight}px`;
  p.textContent = '';
});
addEventListener('resize', () => document.querySelectorAll('[data-type]').forEach((p) => { p.style.minHeight = ''; }));

const broadcast = document.getElementById('broadcast');
const setBroadcastWave = radioWave(broadcast.querySelector('.wave'));
onCenter(broadcast, async () => {
  world?.trigger('alert');
  audio.staticBurst(0.8, 0.4);
  audio.alertTone(2);
  audio.layer('siren', 0.8, 5);
  setBroadcastWave(0.7);
  await new Promise((r) => setTimeout(r, REDUCED ? 0 : 1500));
  await typewrite(broadcast.querySelector('[data-type]'), undefined, { speed: 26 });
  setBroadcastWave(0.1);
});

onCenter(document.getElementById('ch-evacuation'), () => {
  audio.layer('crowd', 1, 4);
  if (!REDUCED) {
    gsap.fromTo('#ch-evacuation', { x: 0 }, { keyframes: { x: [0, -10, 8, -6, 4, 0] }, duration: 0.7, ease: 'none' });
  }
  world?.shake(0.15);
});

const scream = document.getElementById('scream');
onCenter(scream, () => {
  scream.classList.add('is-on');
  audio.stinger(1);
  world?.red(0.8);
  world?.shake(0.35);
  setTimeout(() => { scream.classList.remove('is-on'); scream.classList.add('is-calm'); }, 1600);
});

onCenter(document.getElementById('ch-portiques'), () => {
  document.getElementById('ch-portiques').classList.add('is-on');
  world?.trigger('scan');
  audio.scan();
  audio.layer('crowd', 0.5, 3);
});

onCenter(document.getElementById('ch-envol'), () => {
  world?.trigger('rotor');
  world?.vibrate(0.25);
  audio.layer('rotor', 0.4, 3);
  audio.layer('siren', 0.2, 3);
});

const trevor = document.getElementById('trevor');
const setTrevorWave = radioWave(trevor.querySelector('.wave'), '125,255,138');
onCenter(trevor, async () => {
  audio.staticBurst(0.4, 0.3);
  audio.beep(880);
  setTrevorWave(0.5);
  await typewrite(trevor.querySelector('[data-type]'), undefined, { speed: 30 });
  setTrevorWave(0.06);
});

const shot = document.getElementById('shot');
onCenter(shot, () => {
  audio.screech();
  world?.shake(0.12);
  setTimeout(() => {
    shot.classList.add('is-on');
    audio.gunshot();
    world?.trigger('gunshot');
    splatter();
    audio.layer('crowd', 0.9, 0.5);
    setTimeout(() => audio.stinger(0.5), 400);
  }, REDUCED ? 0 : 850);
}, '-30% 0px -30% 0px');

onCenter(document.getElementById('liftoff'), () => {
  world?.trigger('liftoff');
  world?.vibrate(0.7);
  audio.layer('rotor', 1, 4);
  audio.layer('crowd', 0, 6);
  audio.layer('siren', 0, 6);
  setTimeout(() => world?.vibrate(0.3), 5000);
});

// ---------- Éclaboussures au coup de feu ----------

function splatter() {
  const cv = document.createElement('canvas');
  cv.className = 'splatter';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const dpr = Math.min(devicePixelRatio, 2);
  const W = innerWidth, H = innerHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const blobs = 3 + ((Math.random() * 3) | 0);
  for (let b = 0; b < blobs; b++) {
    const edge = Math.random() < 0.5;
    const x = edge ? (Math.random() < 0.5 ? rnd(0, W * 0.2) : rnd(W * 0.8, W)) : rnd(0, W);
    const y = edge ? rnd(0, H) : (Math.random() < 0.5 ? rnd(0, H * 0.2) : rnd(H * 0.75, H));
    const R = rnd(30, 90);
    g.fillStyle = `rgba(${(rnd(90, 140)) | 0},0,6,.92)`;
    g.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const rr = R * rnd(0.7, 1.25);
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.fill();
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * Math.PI * 2, d = R * rnd(1, 3.4), s = rnd(1, 9) * (1 - d / (R * 3.6));
      g.beginPath();
      g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(s, 0.6) * 1.8, Math.max(s, 0.6), a, 0, Math.PI * 2);
      g.fill();
    }
    for (let k = 0; k < 6; k++) {
      const dx = x + rnd(-R * 0.6, R * 0.6), len = rnd(40, 220), w = rnd(3, 8);
      g.fillRect(dx - w / 2, y, w, len);
      g.beginPath();
      g.arc(dx, y + len, w * 0.8, 0, Math.PI * 2);
      g.fill();
    }
  }
  gsap.fromTo(cv, { opacity: 1, scale: 1.04 }, { scale: 1, duration: 0.25 });
  gsap.to(cv, { opacity: 0, delay: 4, duration: 5, onComplete: () => cv.remove() });
}
