// Ce que partagent les trois pages : défilement doux, transitions, menu, viseur, son.

import { audio } from './audio.js';

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const FINE = matchMedia('(pointer: fine)').matches;
const { gsap, ScrollTrigger, Lenis } = window;

export let lenis = null;

export function initCore({ ambient } = {}) {
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(window.SplitText);

  if (!REDUCED && Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  initTransitions();
  initMenu();
  initSoundToggle();
  initCursor();
  initHoverSounds();
  initAnchors();
  if (ambient) audio.ambient(ambient);
  audio.armOnGesture();
}

// ---------- Transitions entre pages : coupure de signal ----------

function initTransitions() {
  const root = document.documentElement;
  setTimeout(() => root.classList.add('is-ready'), 60);
  addEventListener('pageshow', (e) => { if (e.persisted) root.classList.remove('is-leaving'); });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented) return;
    const url = new URL(a.href, location.href);
    if (a.target === '_blank' || url.origin !== location.origin || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    audio.staticBurst(0.6, 0.4);
    root.classList.add('is-leaving');
    setTimeout(() => { location.href = url.href; }, REDUCED ? 60 : 620);
  });
}

function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -40, duration: 1.6 });
    else target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  });
}

// ---------- Menu plein écran ----------

function initMenu() {
  const btn = document.querySelector('.hud-menu');
  const menu = document.getElementById('menu');
  if (!btn || !menu) return;
  const set = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    menu.inert = !open;
    if (open) {
      lenis?.stop();
      audio.staticBurst(0.25, 0.25);
      menu.querySelector('a')?.focus({ preventScroll: true });
    } else {
      lenis?.start();
    }
  };
  menu.inert = true;
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { set(false); btn.focus(); } });
}

// ---------- Son ----------

function initSoundToggle() {
  const btn = document.querySelector('[data-sound-toggle]');
  if (!btn) return;
  const label = btn.querySelector('.hud-sound-label');
  btn.addEventListener('click', () => audio.toggle());
  audio.subscribe((on) => {
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('is-on', on);
    if (label) label.textContent = on ? 'Son' : 'Muet';
  });
  if (audio.wanted && !audio.on) btn.classList.add('is-waiting');
  audio.subscribe((on) => { if (on) btn.classList.remove('is-waiting'); });
}

function initHoverSounds() {
  let last = null;
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest('a, button, [role="tab"]');
    if (el && el !== last) audio.tick();
    last = el;
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, [role="tab"]')) audio.click();
  });
}

// ---------- Viseur ----------

function initCursor() {
  if (!FINE) return;
  const el = document.createElement('div');
  el.className = 'reticle';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i></i><i></i><i></i><i></i><b></b>';
  document.body.appendChild(el);
  document.documentElement.classList.add('has-reticle');
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  addEventListener('pointermove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
    const hot = e.target.closest?.('a, button, [role="tab"], input, label');
    el.classList.toggle('is-hot', !!hot);
  }, { passive: true });
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.addEventListener('pointerleave', () => el.classList.add('is-gone'));
  document.addEventListener('pointerenter', () => el.classList.remove('is-gone'));
  gsap.ticker.add(() => {
    x += (tx - x) * 0.35;
    y += (ty - y) * 0.35;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });
}

// ---------- Effets de texte ----------

const GLYPHS = '█▓▒░#%&@$Z0019/\\<>*+=?!';

// Décode un texte caractère par caractère, comme un terminal qui reçoit un message.
export function scramble(el, text = el.dataset.text || el.textContent, { duration = 900, delay = 0 } = {}) {
  el.setAttribute('aria-label', text);
  return new Promise((done) => {
    if (REDUCED) { el.textContent = text; done(); return; }
    const start = performance.now() + delay;
    const step = (now) => {
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        out += ch === ' ' || i < p * text.length ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });
}

// Tape un texte au clavier, avec un petit cliquetis par caractère.
export function typewrite(el, text = el.dataset.text || el.textContent, { speed = 34, sound = true } = {}) {
  el.setAttribute('aria-label', text);
  el.classList.add('is-typing');
  return new Promise((done) => {
    if (REDUCED) { el.textContent = text; el.classList.remove('is-typing'); done(); return; }
    let i = 0;
    el.textContent = '';
    const step = () => {
      i++;
      el.textContent = text.slice(0, i);
      if (sound && i % 2 && text[i - 1] !== ' ') audio.type();
      if (i < text.length) setTimeout(step, speed * (text[i - 1].match(/[.,!?…:]/) ? 6 : 1) * (0.6 + Math.random() * 0.8));
      else { el.classList.remove('is-typing'); done(); }
    };
    step();
  });
}

// Découpe un titre en lettres pour les animer une à une.
export function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  const chars = [];
  // Les lettres restent groupées par mot pour que le retour à la ligne ne coupe pas un mot.
  text.trim().split(/\s+/).forEach((word, w) => {
    if (w) el.appendChild(document.createTextNode(' '));
    const box = document.createElement('span');
    box.className = 'word';
    box.setAttribute('aria-hidden', 'true');
    for (const ch of word) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      box.appendChild(s);
      chars.push(s);
    }
    el.appendChild(box);
  });
  return chars;
}

// Déclenche une fonction une seule fois quand l'élément atteint le milieu de l'écran.
export function onCenter(el, fn, band = '-38% 0px -38% 0px') {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { io.disconnect(); fn(); } });
  }, { rootMargin: band });
  io.observe(el);
}

// Oscillogramme de radio : renvoie une fonction pour régler l'amplitude.
export function radioWave(canvas, color = '255,43,43') {
  const g = canvas.getContext('2d');
  let amp = 0.08;
  let live = false;
  new IntersectionObserver(([e]) => { live = e.isIntersecting; }).observe(canvas);
  gsap.ticker.add(() => {
    if (!live) return;
    const w = (canvas.width = canvas.clientWidth * 1.5);
    const h = (canvas.height = canvas.clientHeight * 1.5);
    g.strokeStyle = `rgba(${color},.9)`;
    g.lineWidth = 2;
    g.shadowColor = `rgb(${color})`;
    g.shadowBlur = 10;
    g.beginPath();
    const now = performance.now();
    for (let x = 0; x <= w; x += 4) {
      const y = h / 2 + (Math.random() - 0.5) * h * amp + Math.sin(x * 0.05 + now * 0.01) * h * amp * 0.4;
      if (x) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
  });
  return (v) => { amp = v; };
}

// Petites salves de glitch aléatoires sur un élément.
export function glitchLoop(el, min = 2500, max = 6000) {
  if (REDUCED) return;
  const go = () => {
    el.classList.add('is-glitch');
    setTimeout(() => el.classList.remove('is-glitch'), 140 + Math.random() * 220);
    setTimeout(go, min + Math.random() * (max - min));
  };
  setTimeout(go, min);
}
