// Moteur sonore entièrement synthétisé avec Web Audio : aucun fichier à télécharger.
// Le son ne démarre qu'après un geste du joueur (règle des navigateurs).

const KEY = 'bclf-sound';
const store = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch { /* stockage indisponible */ } },
};

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.subs = new Set();
    this.layers = {};
    this.ambientConf = null;
    this.ambientStarted = false;
    this.heartBpm = 0;
    this.heartTimer = 0;
  }

  get wanted() { return store.get() === 'on'; }

  setup() {
    if (this.ctx) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    const ctx = this.ctx = new Ctx();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 14;
    comp.ratio.value = 5;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(3.6, 2.3);
    this.verb.connect(this.master);
    this.white = this.noise(false);
    this.brown = this.noise(true);
    return true;
  }

  enable() {
    if (!this.setup()) return;
    const { ctx } = this;
    ctx.resume();
    this.on = true;
    store.set('on');
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
    if (this.ambientConf && !this.ambientStarted) this.startAmbient();
    this.emit();
  }

  disable() {
    this.on = false;
    store.set('off');
    if (this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    }
    this.emit();
  }

  toggle() { this.on ? this.disable() : this.enable(); }

  subscribe(fn) { this.subs.add(fn); fn(this.on); }
  emit() { this.subs.forEach((fn) => fn(this.on)); }

  // Relance le son au premier geste si le joueur l'avait laissé activé sur une autre page.
  armOnGesture() {
    if (!this.wanted || this.on) return;
    const events = ['pointerdown', 'keydown', 'touchend'];
    const off = () => events.forEach((e) => removeEventListener(e, go, true));
    const go = (e) => {
      off();
      // Le bouton son gère lui-même son clic : ne pas l'allumer puis l'éteindre aussitôt.
      if (e.target.closest?.('[data-sound-toggle]')) return;
      this.enable();
    };
    events.forEach((e) => addEventListener(e, go, true));
  }

  // ---------- Briques ----------

  noise(brown) {
    const { ctx } = this;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  impulse(seconds, decay) {
    const { ctx } = this;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
    return buf;
  }

  src(buffer, loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = loop;
    if (loop) s.loopStart = Math.random();
    return s;
  }

  filter(type, freq, q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  gain(v = 1) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  // Envoie un nœud vers la sortie, avec une part de réverbération.
  out(node, dry = 1, wet = 0) {
    if (dry) node.connect(this.gain(dry)).connect(this.master);
    if (wet) node.connect(this.gain(wet)).connect(this.verb);
  }

  env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  lfo(freq, depth, target, type = 'sine') {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.gain(depth);
    o.connect(g).connect(target);
    o.start();
    return o;
  }

  // ---------- Ambiance continue ----------

  ambient(conf) {
    this.ambientConf = conf;
    if (this.on && !this.ambientStarted) this.startAmbient();
  }

  startAmbient() {
    this.ambientStarted = true;
    const { ctx } = this;
    const conf = this.ambientConf;

    // Bourdon grave, deux scies légèrement désaccordées.
    const drone = this.gain(0);
    const lp = this.filter('lowpass', 150, 7);
    [55, 55.45, 41.2].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    });
    this.lfo(0.06, 70, lp.frequency);
    lp.connect(drone);
    this.out(drone, 1, 0.3);
    drone.gain.setTargetAtTime(0.16 * (conf.drone ?? 1), ctx.currentTime, 2);

    // Vent : bruit brun filtré qui respire.
    const wind = this.gain(0);
    const ws = this.src(this.brown, true);
    const bp = this.filter('bandpass', 500, 0.7);
    this.lfo(0.08, 320, bp.frequency);
    ws.connect(bp).connect(wind);
    ws.start();
    this.out(wind, 1, 0.2);
    wind.gain.setTargetAtTime(0.32 * (conf.wind ?? 1), ctx.currentTime, 3);

    if (conf.heart) this.heartbeat(conf.heart);
  }

  // Couches qu'on monte ou baisse selon la scène : rotor, foule, sirène.
  layer(name, level, time = 1.2) {
    if (!this.ctx) return;
    if (!this.layers[name]) this.layers[name] = this[`build_${name}`]();
    const L = this.layers[name];
    const t = this.ctx.currentTime;
    L.out.gain.setTargetAtTime(level * L.max, t, time / 3);
    L.set?.(level, t);
  }

  build_rotor() {
    const { ctx } = this;
    const out = this.gain(0);
    const body = this.gain(0.4);
    const n = this.src(this.brown, true);
    const lp = this.filter('lowpass', 280, 1.2);
    n.connect(lp).connect(body);
    n.start();
    // « Whop whop » : modulation d'amplitude par des impulsions.
    const rate = ctx.createOscillator();
    rate.frequency.value = 3;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.max(0, (i / 128 - 1)) ** 3 * 1.6;
    shaper.curve = curve;
    rate.connect(shaper).connect(body.gain);
    rate.start();
    body.connect(out);
    const whine = ctx.createOscillator();
    whine.frequency.value = 820;
    const wg = this.gain(0.012);
    whine.connect(wg).connect(out);
    whine.start();
    this.out(out, 1, 0.25);
    return {
      out, max: 0.9,
      set: (lvl, t) => {
        rate.frequency.setTargetAtTime(2.5 + lvl * 4.5, t, 1.2);
        whine.frequency.setTargetAtTime(700 + lvl * 500, t, 1.5);
      },
    };
  }

  build_crowd() {
    const out = this.gain(0);
    [320, 850, 1900, 2600].forEach((f, i) => {
      const n = this.src(this.white, true);
      const bp = this.filter('bandpass', f, 4);
      const g = this.gain(0.25);
      this.lfo(0.4 + i * 0.37, 0.22, g.gain);
      this.lfo(0.13 + i * 0.11, f * 0.15, bp.frequency);
      n.connect(bp).connect(g).connect(out);
      n.start();
    });
    this.out(out, 1, 0.5);
    return { out, max: 0.35 };
  }

  build_siren() {
    const { ctx } = this;
    const out = this.gain(0);
    const o = ctx.createOscillator();
    o.frequency.value = 720;
    this.lfo(0.22, 180, o.frequency, 'triangle');
    const lp = this.filter('lowpass', 1400);
    o.connect(lp).connect(out);
    o.start();
    this.out(out, 0.35, 1);
    return { out, max: 0.09 };
  }

  heartbeat(bpm) {
    this.heartBpm = bpm;
    if (this.heartTimer || !bpm) return;
    const beat = () => {
      if (!this.heartBpm) { this.heartTimer = 0; return; }
      if (this.on) {
        const t = this.ctx.currentTime + 0.02;
        this.thump(t, 0.55);
        this.thump(t + 0.2, 0.38);
      }
      this.heartTimer = setTimeout(beat, 60000 / this.heartBpm);
    };
    beat();
  }

  thump(t, vol) {
    const { ctx } = this;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(62, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.16);
    const g = this.gain(0);
    this.env(g, t, vol, 0.012, 0.22);
    o.connect(g);
    this.out(g, 1, 0.1);
    o.start(t);
    o.stop(t + 0.3);
  }

  // ---------- Effets ponctuels ----------

  burst({ buffer = this.white, type = 'lowpass', freq = 2000, q = 1, peak = 0.5, attack = 0.005, decay = 0.3, dry = 1, wet = 0, sweep, rate = 1, delay = 0 }) {
    if (!this.on) return;
    const t = this.ctx.currentTime + delay;
    const s = this.src(buffer);
    s.playbackRate.value = rate;
    const f = this.filter(type, freq, q);
    if (sweep) {
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(sweep, t + attack + decay);
    }
    const g = this.gain(0);
    this.env(g, t, peak, attack, decay);
    s.connect(f).connect(g);
    this.out(g, dry, wet);
    s.start(t, Math.random() * 2);
    s.stop(t + attack + decay + 0.05);
  }

  tone({ type = 'sine', freq = 440, to, peak = 0.1, attack = 0.005, decay = 0.2, dry = 1, wet = 0, delay = 0 }) {
    if (!this.on) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    const g = this.gain(0);
    this.env(g, t, peak, attack, decay);
    o.connect(g);
    this.out(g, dry, wet);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  tick() { this.burst({ type: 'highpass', freq: 3000, peak: 0.08, attack: 0.001, decay: 0.03 }); }

  click() {
    this.tone({ type: 'square', freq: 160, to: 60, peak: 0.12, decay: 0.08 });
    this.burst({ type: 'bandpass', freq: 1800, q: 2, peak: 0.15, decay: 0.05 });
  }

  type() { this.burst({ type: 'bandpass', freq: 2500 + Math.random() * 1500, q: 3, peak: 0.06, attack: 0.001, decay: 0.025 }); }

  staticBurst(dur = 0.4, vol = 0.35) {
    this.burst({ type: 'highpass', freq: 1200, peak: vol, attack: 0.01, decay: dur });
    this.burst({ type: 'bandpass', freq: 4200, q: 0.8, peak: vol * 0.6, attack: 0.02, decay: dur * 0.8 });
  }

  // Tonalité d'alerte double (853 + 960 Hz), celle des systèmes d'urgence.
  alertTone(times = 3) {
    for (let i = 0; i < times; i++) {
      [853, 960].forEach((f) => this.tone({ type: 'sine', freq: f, peak: 0.07, attack: 0.01, decay: 0.55, wet: 0.3, delay: i * 0.8 }));
    }
  }

  beep(freq = 1000, delay = 0) { this.tone({ type: 'square', freq, peak: 0.05, attack: 0.002, decay: 0.09, delay }); }

  scan() {
    this.tone({ type: 'sawtooth', freq: 300, to: 1800, peak: 0.05, attack: 0.02, decay: 0.45, wet: 0.2 });
    this.beep(1320, 0.5);
  }

  thunder(delay = 0) {
    this.burst({ buffer: this.brown, freq: 900, sweep: 120, peak: 0.9, attack: 0.03, decay: 3.8, wet: 0.6, delay });
    this.burst({ type: 'bandpass', freq: 400, peak: 0.4, attack: 0.01, decay: 0.6, wet: 0.4, delay });
  }

  impact() {
    this.tone({ freq: 90, to: 28, peak: 0.9, attack: 0.005, decay: 1.4, wet: 0.5 });
    this.burst({ buffer: this.brown, freq: 1200, sweep: 80, peak: 0.8, attack: 0.005, decay: 1.6, wet: 0.8 });
  }

  gunshot() {
    this.burst({ freq: 7000, sweep: 300, peak: 1.4, attack: 0.002, decay: 0.42, wet: 1 });
    this.tone({ freq: 150, to: 38, peak: 1.1, attack: 0.002, decay: 0.3, wet: 0.5 });
    this.burst({ buffer: this.brown, freq: 600, sweep: 90, peak: 0.6, attack: 0.01, decay: 2.2, dry: 0.2, wet: 1, delay: 0.05 });
  }

  // Grincement strident : scies aiguës avec un vibrato nerveux.
  screech() {
    if (!this.on) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const g = this.gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
    g.gain.setValueAtTime(0.16, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    const bp = this.filter('bandpass', 2400, 3);
    [1800, 2347].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 1.35, t + 0.8);
      const v = ctx.createOscillator();
      v.frequency.value = 28;
      const vg = this.gain(f * 0.08);
      v.connect(vg).connect(o.frequency);
      o.connect(bp);
      o.start(t); v.start(t);
      o.stop(t + 0.9); v.stop(t + 0.9);
    });
    bp.connect(g);
    this.out(g, 1, 0.7);
  }

  // Accord dissonant qui claque : le « coup » des films d'horreur.
  stinger(strength = 1) {
    if (!this.on) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const g = this.gain(0);
    this.env(g, t, 0.18 * strength, 0.015, 2.6);
    const lp = this.filter('lowpass', 900, 2);
    lp.frequency.setValueAtTime(5000, t);
    lp.frequency.exponentialRampToValueAtTime(400, t + 2.4);
    [233, 247, 349, 370, 494, 523, 740].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.01);
      o.connect(lp);
      o.start(t);
      o.stop(t + 2.8);
    });
    lp.connect(g);
    this.out(g, 1, 0.8);
    this.burst({ freq: 6000, sweep: 500, peak: 0.4 * strength, attack: 0.005, decay: 0.8, wet: 0.6 });
  }

  // Râle d'infecté : scie grave instable, saturée.
  growl() {
    if (!this.on) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(95, t);
    o.frequency.linearRampToValueAtTime(70, t + 1.1);
    const j = ctx.createOscillator();
    j.type = 'square';
    j.frequency.value = 17;
    const jg = this.gain(18);
    j.connect(jg).connect(o.frequency);
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) { const x = i / 256 - 1; curve[i] = Math.tanh(x * 6); }
    shaper.curve = curve;
    const bp = this.filter('bandpass', 520, 1.5);
    this.lfo(5, 200, bp.frequency);
    const g = this.gain(0);
    this.env(g, t, 0.35, 0.08, 1.1);
    o.connect(shaper).connect(bp).connect(g);
    this.out(g, 1, 0.5);
    o.start(t); j.start(t);
    o.stop(t + 1.3); j.stop(t + 1.3);
    this.burst({ type: 'bandpass', freq: 900, q: 1.2, peak: 0.2, attack: 0.05, decay: 1, wet: 0.4 });
  }
}

export const audio = new SoundEngine();
