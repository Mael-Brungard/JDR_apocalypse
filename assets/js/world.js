// La ville en 3D, partagée par les trois pages : une rue morte, le point d'extraction,
// l'héliport et la vue du ciel. La graine fixe garde la même ville d'une page à l'autre.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const LOW = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FOG = 0x221210;

// Points de vue nommés : chaque page s'y déplace au fil du défilement.
export const VIEWS = {
  street:     { pos: [0, 1.7, 14],     look: [0, 1.9, -30],   fog: 0.05 },
  street2:    { pos: [-1.2, 1.7, -38], look: [0.5, 2, -80],   fog: 0.048 },
  street3:    { pos: [1, 1.7, -92],    look: [0, 2.3, -140],  fog: 0.042 },
  crowd:      { pos: [-3, 2.6, -132],  look: [0, 2, -178],    fog: 0.034 },
  checkpoint: { pos: [3.5, 2, -160],   look: [-1, 2.4, -186], fog: 0.03 },
  scan:       { pos: [-2.5, 1.8, -177], look: [1.5, 2.2, -187], fog: 0.03 },
  helipad:    { pos: [7, 2.4, -198],   look: [-1, 2.2, -218], fog: 0.03 },
  aboard:     { pos: [-1.3, 2.3, -215.5], look: [10, 1.6, -190], fog: 0.03 },
  liftoff:    { pos: [-3, 22, -214],   look: [0, 0, -165],    fog: 0.02 },
  aerial:     { pos: [0, 85, -255],    look: [0, 0, -95],     fog: 0.008 },
};

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- Textures dessinées à la volée ----------

function facadeTextures(r) {
  const S = 512, N = 8, C = S / N;
  const [mc, m] = makeCanvas(S);
  const [ec, e] = makeCanvas(S);
  m.fillStyle = '#2c2826';
  m.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) {
    const v = (r() * 45) | 0;
    m.fillStyle = `rgba(${v},${(v * 0.9) | 0},${(v * 0.8) | 0},${0.3 * r()})`;
    m.fillRect(r() * S, r() * S, 1 + r() * 4, 1 + r() * 4);
  }
  e.fillStyle = '#000';
  e.fillRect(0, 0, S, S);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const wx = x * C + C * 0.2, wy = y * C + C * 0.16, ww = C * 0.6, wh = C * 0.62;
      m.fillStyle = r() < 0.3 ? '#050505' : `rgb(${(16 + r() * 12) | 0},${(18 + r() * 12) | 0},${(22 + r() * 14) | 0})`;
      m.fillRect(wx, wy, ww, wh);
      m.fillStyle = 'rgba(0,0,0,.55)';
      m.fillRect(wx - 3, wy + wh, ww + 6, 4);
      if (r() < 0.04) {
        e.globalAlpha = 0.45 + r() * 0.55;
        e.fillStyle = r() < 0.5 ? '#ff7a2a' : '#ffb35c';
        e.fillRect(wx + 3, wy + 3, ww - 6, wh - 6);
        e.globalAlpha = 1;
      }
    }
  }
  // Coulures de crasse et traces de brûlé.
  for (let i = 0; i < 70; i++) {
    const g = m.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(0,0,0,.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = g;
    m.fillRect(r() * S, r() * S * 0.5, 2 + r() * 7, S * 0.6);
  }
  for (let i = 0; i < 6; i++) {
    const x = r() * S, y = r() * S, rad = 40 + r() * 90;
    const g = m.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(0,0,0,.75)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = g;
    m.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return { map: tex(mc, { repeat: true }), emissive: tex(ec, { repeat: true }) };
}

function streetTextures(r) {
  const W = 256, H = 1024;
  const [c, g] = makeCanvas(W, H);
  const [rc, rg] = makeCanvas(W, H);
  g.fillStyle = '#1d1a19';
  g.fillRect(0, 0, W, H);
  rg.fillStyle = '#e0e0e0';
  rg.fillRect(0, 0, W, H);
  for (let i = 0; i < 14000; i++) {
    const v = (10 + r() * 40) | 0;
    g.fillStyle = `rgba(${v},${v},${v},.5)`;
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
  }
  // Ligne centrale à moitié effacée.
  g.fillStyle = 'rgba(190,150,60,.45)';
  for (let y = 0; y < H; y += 128) g.fillRect(W / 2 - 3, y + 20, 6, 70);
  // Fissures.
  g.strokeStyle = 'rgba(0,0,0,.7)';
  for (let i = 0; i < 18; i++) {
    g.lineWidth = 1 + r() * 2;
    g.beginPath();
    let x = r() * W, y = r() * H;
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 40; y += (r() - 0.3) * 30; g.lineTo(x, y); }
    g.stroke();
  }
  // Flaques (brillantes) et taches sombres, parfois rouges.
  for (let i = 0; i < 16; i++) {
    const x = r() * W, y = r() * H, rad = 10 + r() * 40;
    const gr = rg.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, '#202020');
    gr.addColorStop(1, 'rgba(224,224,224,0)');
    rg.fillStyle = gr;
    rg.beginPath();
    rg.ellipse(x, y, rad * 1.6, rad, r() * 3, 0, 7);
    rg.fill();
  }
  for (let i = 0; i < 5; i++) {
    const x = r() * W, y = r() * H;
    g.fillStyle = r() < 0.6 ? 'rgba(70,4,6,.75)' : 'rgba(8,6,6,.8)';
    g.beginPath();
    g.ellipse(x, y, 8 + r() * 26, 6 + r() * 14, r() * 3, 0, 7);
    g.fill();
    for (let k = 0; k < 8; k++) {
      g.beginPath();
      g.arc(x + (r() - 0.5) * 70, y + (r() - 0.5) * 50, 1 + r() * 4, 0, 7);
      g.fill();
    }
  }
  return { map: tex(c, { repeat: true }), rough: tex(rc, { repeat: true, srgb: false }) };
}

const TAGS = [
  { text: 'ILS ENTENDENT TOUT', color: '#b0141c' },
  { text: 'NE SORTEZ PAS', color: '#d9d0c0' },
  { text: 'Z-001', color: '#b0141c' },
  { text: 'ON ÉTAIT 12', color: '#d9d0c0' },
  { text: 'hand' },
  { text: 'SOUS CONTRÔLE ?', color: '#b0141c' },
  { text: 'EXTRACTION →', color: '#f0b429' },
  { text: 'PITIÉ', color: '#b0141c' },
  { text: 'hand' },
  { text: 'IIII IIII IIII II', color: '#d9d0c0' },
  { text: 'BIENVENUE CHEZ LES FOUS', color: '#b0141c' },
];

function tagTexture(t, r) {
  const [c, g] = makeCanvas(1024, 256);
  if (t.text === 'hand') {
    // Empreinte de main ensanglantée, qui glisse vers le bas.
    g.fillStyle = '#8f0d13';
    g.save();
    g.translate(512, 120);
    g.rotate((r() - 0.5) * 0.6);
    g.beginPath(); g.ellipse(0, 20, 34, 40, 0, 0, 7); g.fill();
    g.lineCap = 'round';
    g.strokeStyle = '#8f0d13';
    [[-30, -10, -46, -52], [-12, -22, -16, -82], [6, -22, 8, -88], [22, -16, 30, -76], [34, 14, 64, -10]].forEach(([x1, y1, x2, y2], i) => {
      g.lineWidth = i === 4 ? 17 : 15;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    });
    g.globalAlpha = 0.7;
    for (let i = 0; i < 6; i++) g.fillRect(-30 + i * 11, 40, 6, 40 + r() * 70);
    g.restore();
    return tex(c);
  }
  let size = 150;
  g.font = `${size}px "Rubik Wet Paint", Impact, sans-serif`;
  const w = g.measureText(t.text).width;
  if (w > 960) { size *= 960 / w; g.font = `${size}px "Rubik Wet Paint", Impact, sans-serif`; }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = t.color;
  g.globalAlpha = 0.92;
  g.fillText(t.text, 512, 112);
  // Coulures qui partent du bas des lettres.
  const data = g.getImageData(0, 0, 1024, 256).data;
  for (let i = 0; i < 40; i++) {
    const x = (60 + r() * 904) | 0;
    let y = 0;
    for (let yy = 200; yy > 60; yy--) if (data[(yy * 1024 + x) * 4 + 3] > 120) { y = yy; break; }
    if (!y) continue;
    const len = 10 + r() * 60;
    g.fillRect(x - 1.5, y, 3, len);
    g.beginPath();
    g.arc(x, y + len, 3, 0, 7);
    g.fill();
  }
  return tex(c);
}

function figureTexture(kind, r) {
  const [c, g] = makeCanvas(128, 256);
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, kind === 'zombie' ? '#8a7f74' : '#7d756e');
  grd.addColorStop(1, '#2a2523');
  g.fillStyle = g.strokeStyle = grd;
  g.lineCap = g.lineJoin = 'round';
  const limb = (w, pts) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(...pts[0]);
    pts.slice(1).forEach((p) => g.lineTo(...p));
    g.stroke();
  };
  if (kind === 'zombie') {
    g.beginPath(); g.ellipse(76, 40, 13, 16, 0.4, 0, 7); g.fill();
    g.beginPath(); g.moveTo(46, 62); g.lineTo(86, 55); g.lineTo(80, 142); g.lineTo(50, 146); g.closePath(); g.fill();
    limb(13, [[80, 64], [102, 98], [114, 124]]);
    limb(12, [[50, 66], [38, 112], [44, 160]]);
    limb(15, [[58, 142], [50, 196], [46, 250]]);
    limb(15, [[74, 142], [86, 194], [82, 250]]);
    // Vêtements en lambeaux.
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 10; i++) {
      const left = i % 2 === 0, y = 92 + r() * 54;
      g.beginPath();
      g.moveTo(left ? 44 : 88, y);
      g.lineTo(left ? 56 : 76, y + 4);
      g.lineTo(left ? 44 : 88, y + 10);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  } else {
    const child = kind === 'child';
    g.save();
    if (child) { g.translate(32, 100); g.scale(0.6, 0.6); }
    g.beginPath(); g.ellipse(64, 34, 13, 15, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(43, 54); g.lineTo(85, 54); g.lineTo(80, 146); g.lineTo(48, 146); g.closePath(); g.fill();
    limb(12, [[46, 60], [38, 110], [42, 150]]);
    limb(12, [[82, 60], [90, 110], [86, 150]]);
    limb(15, [[56, 144], [54, 200], [54, 250]]);
    limb(15, [[72, 144], [74, 200], [74, 250]]);
    g.restore();
  }
  return tex(c);
}

function softDot(color = '255,255,255') {
  const [c, g] = makeCanvas(64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${color},1)`);
  gr.addColorStop(0.4, `rgba(${color},.45)`);
  gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return tex(c);
}

function chainLink() {
  const [c, g] = makeCanvas(64);
  g.strokeStyle = 'rgba(170,170,170,.9)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(64, 64);
  g.moveTo(64, 0); g.lineTo(0, 64);
  g.stroke();
  return tex(c, { repeat: true });
}

function helipadTexture() {
  const [c, g] = makeCanvas(512);
  g.fillStyle = '#1e1c1b';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#8a6a16';
  g.lineWidth = 18;
  g.beginPath(); g.arc(256, 256, 220, 0, 7); g.stroke();
  g.fillStyle = '#7d776d';
  g.font = 'bold 300px Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('H', 256, 270);
  return tex(c);
}

function stencilTexture(text) {
  const [c, g] = makeCanvas(512, 128);
  g.fillStyle = '#2c3029';
  g.fillRect(0, 0, 512, 128);
  for (let x = 0; x < 512; x += 16) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, 0, 6, 128); }
  g.fillStyle = '#e8b40e';
  g.font = '64px "Saira Stencil One", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  return tex(c);
}

// Boîte dont les UV suivent la taille réelle : les fenêtres gardent la même échelle partout.
function boxUV(w, h, d, tile = 22) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  }
  return geo;
}

// ---------- Shaders ----------

const flameShader = {
  uniforms: { uTime: { value: 0 }, uSeed: { value: 0 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform float uTime; uniform float uSeed; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    void main() {
      vec2 uv = vUv;
      float t = uTime * 1.0 + uSeed * 10.0;
      float n = noise(vec2(uv.x * 5.0, uv.y * 4.0 - t * 3.0)) * 0.6 + noise(vec2(uv.x * 11.0, uv.y * 9.0 - t * 5.0)) * 0.3;
      float width = abs(uv.x - 0.5) * (1.7 + uv.y * 2.2);
      float body = (1.0 - smoothstep(0.0, 0.5, width)) * (1.0 - uv.y);
      float f = clamp((body * 1.7 + n * 0.75 - 0.62) * 2.2, 0.0, 1.0);
      vec3 col = mix(vec3(0.55, 0.04, 0.0), vec3(1.0, 0.5, 0.08), f);
      col = mix(col, vec3(1.0, 0.88, 0.55), smoothstep(0.75, 1.0, f));
      gl_FragColor = vec4(col * f * 1.5, f);
    }`,
};

const ashShader = {
  uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSize: { value: 60 }, uMap: { value: null } },
  vertexShader: /* glsl */`
    uniform float uTime; uniform vec3 uCam; uniform float uSize;
    attribute float aSeed; varying float vFade;
    void main() {
      vec3 p = position;
      p.y = mod(p.y - uTime * (0.4 + aSeed * 0.9), 30.0);
      p.x += sin(uTime * 0.5 + aSeed * 20.0) * 1.2 + uTime * 0.6;
      p.z += cos(uTime * 0.4 + aSeed * 13.0) * 0.8;
      p.x = mod(p.x - uCam.x + 30.0, 60.0) + uCam.x - 30.0;
      p.z = mod(p.z - uCam.z + 30.0, 60.0) + uCam.z - 30.0;
      p.y += uCam.y - 12.0;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vFade = smoothstep(32.0, 4.0, -mv.z);
      gl_PointSize = uSize * (0.4 + aSeed) / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D uMap; varying float vFade;
    void main() {
      vec4 t = texture2D(uMap, gl_PointCoord);
      gl_FragColor = vec4(vec3(0.62, 0.56, 0.52), t.a * 0.55 * vFade);
    }`,
};

// Faisceau de lumière dans la brume : un cône additif qui s'estompe vers le bout et sur les bords.
function beamMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uLen: { value: 1 } },
    vertexShader: /* glsl */`
      uniform float uLen; varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        vH = position.z / uLen;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity; varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        float edge = pow(abs(dot(vN, vV)), 1.6);
        float fall = pow(1.0 - clamp(vH, 0.0, 1.0), 1.4);
        gl_FragColor = vec4(uColor, uOpacity * edge * fall);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function beam(color, radius, length, opacity) {
  const geo = new THREE.ConeGeometry(radius, length, 32, 1, true);
  geo.translate(0, -length / 2, 0);
  geo.rotateX(-Math.PI / 2);
  const mat = beamMaterial(color, opacity);
  mat.uniforms.uLen.value = length;
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

const horrorShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.004 },
    uFlash: { value: 0 },
    uRed: { value: 0 },
    uGrain: { value: 0.07 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uAberration, uFlash, uRed, uGrain; varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5; float d = length(c);
      vec2 off = c * (uAberration + uRed * 0.02) * d * 4.0;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, 0.72) * vec3(1.08, 0.95, 0.9);
      col += uRed * vec3(0.45, 0.0, 0.0) * (0.4 + d);
      col = mix(col, vec3(1.0, 0.97, 0.94), uFlash);
      col *= smoothstep(0.92, 0.22, d);
      col += (rand(vUv * 1000.0 + fract(uTime)) - 0.5) * uGrain;
      col -= sin(vUv.y * 1100.0 + uTime * 8.0) * 0.012;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// ---------- Monde ----------

export async function createWorld(canvas, opts = {}) {
  const o = { zombies: false, flashlight: 'mouse', view: 'street', ...opts };
  await Promise.race([
    Promise.all([
      document.fonts.load('80px "Rubik Wet Paint"'),
      document.fonts.load('64px "Saira Stencil One"'),
    ]).catch(() => {}),
    new Promise((res) => setTimeout(res, 2500)),
  ]);

  const r = seeded(2039);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1 : 1.5));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = !LOW;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, VIEWS[o.view].fog);

  const camera = new THREE.PerspectiveCamera(LOW ? 70 : 60, innerWidth / innerHeight, 0.1, 700);
  scene.add(camera);

  const time = { value: 0 };
  const tickers = [];

  // Un ciel rouge sale et une lune malade : presque toute la lumière vient d'ailleurs.
  const sky = new THREE.HemisphereLight(0x6a3428, 0x0b0707, 1);
  scene.add(sky);
  const moon = new THREE.DirectionalLight(0x7a8aa0, 0.18);
  moon.position.set(-60, 90, 30);
  scene.add(moon);

  // ----- Ville -----
  const fac = facadeTextures(r);
  const wallMat = new THREE.MeshStandardMaterial({ map: fac.map, emissiveMap: fac.emissive, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.92 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1b1817, roughness: 1 });
  const mats = [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat];
  const city = new THREE.Group();
  scene.add(city);
  const facades = [];

  const building = (x, z, w, h, d) => {
    const m = new THREE.Mesh(boxUV(w, h, d), mats);
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = !LOW;
    city.add(m);
  };

  for (const side of [-1, 1]) {
    let z = 26;
    while (z > -238) {
      const d = 8 + r() * 10;
      const plaza = z < -146;
      if (!plaza && r() < 0.1) { z -= 5 + r() * 4; continue; }
      const edge = plaza ? 30 : 10.5;
      const w = 9 + r() * 8;
      const h = (plaza ? 16 : 9) + r() * (z < -60 ? 40 : 26);
      building(side * (edge + w / 2), z - d / 2, w, h, d);
      if (!plaza && d > 9) facades.push({ side, x: side * (edge - 0.04), z: z - d / 2 });
      const w2 = 10 + r() * 10;
      building(side * (edge + w + 2 + w2 / 2), z - d / 2, w2, 14 + r() * 50, d * 0.9);
      z -= d + 0.4 + r() * 1.2;
    }
  }
  // La place est fermée au fond par une barre d'immeubles.
  for (let x = -34; x < 34;) {
    const w = 8 + r() * 8;
    building(x + w / 2, -252, w, 18 + r() * 30, 12);
    x += w + 0.5;
  }

  // Le reste de la ville, visible du ciel : un seul appel de dessin.
  {
    const count = LOW ? 260 : 620;
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mats, count);
    const m4 = new THREE.Matrix4();
    let n = 0;
    while (n < count) {
      const x = (r() - 0.5) * 420, z = 80 - r() * 560;
      if (Math.abs(x) < 54 && z > -262 && z < 40) continue;
      const w = 8 + r() * 16, d = 8 + r() * 16, h = 6 + r() ** 2 * 70;
      m4.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      inst.setMatrixAt(n++, m4);
    }
    city.add(inst);
  }

  // ----- Sol -----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: 0x151211, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const st = streetTextures(r);
  st.map.repeat.set(1, 7);
  st.rough.repeat.set(1, 7);
  const street = new THREE.Mesh(
    new THREE.PlaneGeometry(21, 290),
    new THREE.MeshStandardMaterial({ map: st.map, roughnessMap: st.rough, roughness: 1, metalness: 0.15 }),
  );
  street.rotation.x = -Math.PI / 2;
  street.position.set(0, 0.01, -120);
  street.receiveShadow = true;
  scene.add(street);

  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 110),
    new THREE.MeshStandardMaterial({ map: st.map.clone(), roughnessMap: st.rough, roughness: 1, metalness: 0.15, color: 0xa9a29a }),
  );
  plaza.material.map.repeat.set(3, 3);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.015, -200);
  plaza.receiveShadow = true;
  scene.add(plaza);

  const concrete = new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 0.95 });
  for (const side of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 172), concrete);
    walk.position.set(side * 9, 0.09, -60);
    walk.receiveShadow = true;
    scene.add(walk);
  }

  // ----- Graffitis : seule la lampe les révèle vraiment -----
  {
    const spots = facades.filter((_, i) => i % 2 === 0).slice(0, TAGS.length);
    spots.forEach((f, i) => {
      const t = TAGS[i];
      const big = t.text.length > 14;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(big ? 9 : 7, big ? 2.25 : 1.75),
        new THREE.MeshStandardMaterial({ map: tagTexture(t, r), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      );
      plane.position.set(f.x, 2.4 + r() * 1.5, f.z);
      plane.rotation.y = f.side < 0 ? Math.PI / 2 : -Math.PI / 2;
      plane.rotation.z = (r() - 0.5) * 0.12;
      scene.add(plane);
    });
  }

  // ----- Épaves -----
  const carColors = [0x2a2f33, 0x3b1e1c, 0x1f2622, 0x45403a, 0x23201f];
  const burnt = new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 1 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0a0909, roughness: 1 });
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12).rotateZ(Math.PI / 2);
  const carSpots = [];
  const car = (x, z, rotY, isBurnt, flipped) => {
    const g = new THREE.Group();
    const mat = isBurnt ? burnt : new THREE.MeshStandardMaterial({ color: carColors[(r() * carColors.length) | 0], roughness: 0.55, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 4.3), mat);
    body.position.y = 0.6;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), mat);
    cab.position.set(0, 1.2, -0.2);
    g.add(body, cab);
    [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(wheelGeo, tyre);
      w.position.set(wx, 0.36, wz);
      g.add(w);
    });
    g.traverse((m) => { m.castShadow = m.receiveShadow = !LOW; });
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    if (flipped) { g.rotation.z = Math.PI; g.position.y = 1.5; }
    scene.add(g);
    carSpots.push({ x, z });
  };
  for (let i = 0; i < 18; i++) {
    const z = 6 - r() * 138;
    const side = r() < 0.5 ? -1 : 1;
    car(side * (4 + r() * 3.2), z, (r() - 0.5) * 0.7 + (r() < 0.25 ? r() * 1.6 : 0), r() < 0.3, r() < 0.1);
  }

  // Barrières en béton à l'entrée de la place.
  for (let x = -9; x <= 9; x += 2.6) {
    if (Math.abs(x) < 2) continue;
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 0.6), concrete);
    b.position.set(x, 0.45, -144);
    b.rotation.y = (r() - 0.5) * 0.2;
    b.castShadow = b.receiveShadow = !LOW;
    scene.add(b);
  }

  // ----- Lampadaires : deux tiennent encore -----
  const lamps = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1a19, roughness: 0.7, metalness: 0.6 });
  for (let z = 4, k = 0; z > -140; z -= 28, k++) {
    const side = k % 2 ? 1 : -1;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6.5, 8), poleMat);
    pole.position.set(side * 8.4, 3.25, z);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMat);
    arm.position.set(side * 7.7, 6.4, z);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc27a, emissiveIntensity: 0 }));
    head.position.set(side * 7, 6.3, z);
    scene.add(pole, arm, head);
    if (k === 1 || k === 3) {
      const light = new THREE.PointLight(0xffb067, 30, 26, 1.6);
      light.position.set(side * 7, 6, z);
      scene.add(light);
      head.material.emissiveIntensity = 3;
      lamps.push({ light, head, base: 30, alive: true });
    }
  }

  // ----- Feux -----
  const fires = [];
  const emberTex = softDot('255,140,60');
  const fire = (x, z, scale = 1, withLight = true) => {
    const mat = new THREE.ShaderMaterial({
      ...flameShader,
      uniforms: { uTime: time, uSeed: { value: r() } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(2.2 * scale, 3 * scale), mat);
    flame.position.set(x, 1.2 * scale + 0.4, z);
    scene.add(flame);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: emberTex, color: 0xff6a20, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(7 * scale);
    glow.position.set(x, 1.6 * scale, z);
    scene.add(glow);
    let light = null;
    if (withLight) {
      light = new THREE.PointLight(0xff6a22, 34 * scale, 30, 1.6);
      light.position.set(x, 3.2, z);
      scene.add(light);
    }
    fires.push({ flame, light, base: 34 * scale, seed: r() * 100 });
  };
  const burning = carSpots.filter((_, i) => i % 6 === 2).slice(0, LOW ? 2 : 3);
  burning.forEach((c) => fire(c.x, c.z, 1));
  fire(-14, -150, 0.7, !LOW);

  // Fumées et incendies lointains, pour la vue du ciel.
  const smokeTex = softDot('40,34,32');
  const smokes = [];
  const smokeColumn = (x, z, scale) => {
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0.5, depthWrite: false, fog: true }));
      smokes.push({ s, x, z, scale, t: i / 10 });
      scene.add(s);
    }
  };
  burning.forEach((c) => smokeColumn(c.x, c.z, 1));
  for (let i = 0; i < (LOW ? 6 : 12); i++) {
    const x = (r() - 0.5) * 300, z = 40 - r() * 400;
    if (Math.abs(x) < 40 && z > -260) continue;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: emberTex, color: 0xff5a14, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(14 + r() * 10);
    glow.position.set(x, 3, z);
    scene.add(glow);
    smokeColumn(x, z, 2.5);
  }

  // ----- Point d'extraction -----
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2d2b, roughness: 0.6, metalness: 0.7 });

  // Foule de civils qui attend devant les portiques.
  const crowdMeshes = [];
  {
    const kinds = ['adult', 'adult2', 'child'];
    const textures = { adult: figureTexture('adult', r), adult2: figureTexture('adult', r), child: figureTexture('child', r) };
    const total = LOW ? 140 : 300;
    kinds.forEach((kind, ki) => {
      const count = Math.round(total * [0.5, 0.38, 0.12][ki]);
      const mat = new THREE.MeshStandardMaterial({ map: textures[kind], alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: ki === 1 ? 0x6e625a : 0x8a7e75 });
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = time;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = float(gl_InstanceID) * 1.7 + ${ki}.0 * 3.1;
          transformed.x += sin(uTime * 1.3 + ph) * 0.05 * position.y;
          transformed.y += abs(sin(uTime * 1.9 + ph)) * 0.025;`);
      };
      const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.95, 1.9), mat, count);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < count; i++) {
        const z = -179.5 + r() ** 1.7 * 30;
        const x = (r() - 0.5) * (z < -170 ? 44 : 34);
        const s = 0.88 + r() * 0.24;
        q.setFromEuler(e.set(0, (r() - 0.5) * 0.7, 0));
        m4.compose(new THREE.Vector3(x, 0.95 * s, z), q, new THREE.Vector3(s, s, s));
        inst.setMatrixAt(i, m4);
      }
      scene.add(inst);
      crowdMeshes.push(inst);
    });
  }

  // Grillage et portiques de scan.
  const linkTex = chainLink();
  const fenceMat = new THREE.MeshStandardMaterial({ map: linkTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 });
  [[-28, -8.8], [-6.2, -3.8], [-1.2, 1.2], [3.8, 6.2], [8.8, 28]].forEach(([a, b]) => {
    const w = b - a;
    const tx = linkTex.clone();
    tx.repeat.set(w / 0.5, 3.2 / 0.5);
    tx.needsUpdate = true;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.2), fenceMat.clone());
    f.material.map = tx;
    f.position.set((a + b) / 2, 1.6, -182);
    scene.add(f);
    for (let x = a; x <= b + 0.01; x += Math.max(w / Math.ceil(w / 3), 0.1)) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.3, 6), metal);
      post.position.set(x, 1.65, -182);
      scene.add(post);
    }
  });
  const portals = [];
  [-7.5, -2.5, 2.5, 7.5].forEach((x) => {
    const g = new THREE.Group();
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x110505, emissive: 0xff1a1a, emissiveIntensity: 2 });
    [-1.2, 1.2].forEach((dx) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.8, 0.6), metal);
      p.position.set(dx, 1.4, 0);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.4, 0.3), stripMat);
      s.position.set(dx - Math.sign(dx) * 0.17, 1.4, 0);
      g.add(p, s);
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.4, 0.6), metal);
    top.position.y = 3;
    g.add(top);
    g.position.set(x, 0, -182);
    scene.add(g);
    portals.push(stripMat);
  });

  // La salle de confinement : un conteneur, une lampe rouge au-dessus de la porte.
  const container = new THREE.Group();
  {
    const box = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.7, 2.6), new THREE.MeshStandardMaterial({ color: 0x2c3029, roughness: 0.7, metalness: 0.4 }));
    box.position.y = 1.35;
    box.castShadow = box.receiveShadow = !LOW;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshStandardMaterial({ map: stencilTexture('CONFINEMENT'), roughness: 0.8 }));
    sign.position.set(0, 2, 1.31);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), new THREE.MeshStandardMaterial({ color: 0x050505 }));
    door.position.set(2.3, 1.05, 1.31);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1010, emissiveIntensity: 3 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), lampMat);
    lamp.position.set(2.3, 2.45, 1.4);
    container.add(box, sign, door, lamp);
    container.position.set(14, 0, -188);
    container.rotation.y = -0.25;
    scene.add(container);
    container.userData.lampMat = lampMat;
  }
  const containerLight = new THREE.PointLight(0xff1a10, 12, 14, 1.8);
  containerLight.position.set(15.5, 2.6, -186);
  scene.add(containerLight);
  const muzzle = new THREE.PointLight(0xfff0d0, 0, 40, 1.5);
  muzzle.position.set(16, 1.6, -185.5);
  scene.add(muzzle);

  // Tours d'éclairage militaires.
  const floods = [];
  [[-19, -6], [19, 6]].forEach(([x, tx]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 10, 8), metal);
    pole.position.set(x, 5, -175);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xe8f0ff, emissiveIntensity: 4 }));
    head.position.set(x, 10, -175);
    head.lookAt(tx, 0, -166);
    scene.add(pole, head);
    const spot = new THREE.SpotLight(0xdfe8ff, 900, 60, 0.6, 0.55, 1.6);
    spot.position.set(x, 9.8, -175);
    spot.target.position.set(tx, 0, -166);
    scene.add(spot, spot.target);
    const b = beam(0xcfe0ff, Math.tan(0.6) * 16, 16, 0.07);
    b.position.copy(spot.position);
    b.lookAt(spot.target.position);
    scene.add(b);
    floods.push(spot);
  });

  // Gyrophares rouges sur les véhicules militaires.
  const beacons = [];
  [[-11, -146], [11, -147], [-22, -200], [24, -205]].forEach(([x, z], i) => {
    const truck = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.4), new THREE.MeshStandardMaterial({ color: 0x2b3126, roughness: 0.8 }));
    cab.position.set(0, 1.4, 2.6);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.6, 5), new THREE.MeshStandardMaterial({ color: 0x252a20, roughness: 0.9 }));
    bed.position.set(0, 1.6, -1.2);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x200000, emissive: 0xff1a1a, emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.25, 10), lampMat);
    lamp.position.set(0, 2.65, 2.6);
    truck.add(cab, bed, lamp);
    truck.traverse((m) => { m.castShadow = !LOW; });
    truck.position.set(x, 0, z);
    truck.rotation.y = i % 2 ? 0.4 : -0.3;
    scene.add(truck);
    const light = new THREE.PointLight(0xff1a1a, 0, 22, 1.6);
    light.position.set(x, 3, z + 2);
    scene.add(light);
    beacons.push({ light, lampMat, phase: i * 1.3 });
  });
  let beaconLevel = 0.6;

  // ----- Héliport et hélicoptère -----
  const pad = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ map: helipadTexture(), roughness: 0.8 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.03, -218);
  pad.receiveShadow = true;
  scene.add(pad);
  const padLights = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ emissive: 0x9cff7a, emissiveIntensity: 1.2, color: 0x000000 }));
    m.position.set(Math.cos(a) * 9.4, 0.1, -218 + Math.sin(a) * 9.4);
    scene.add(m);
    padLights.push(m);
  }

  const heli = new THREE.Group();
  const rotor = new THREE.Group();
  const tailRotor = new THREE.Group();
  {
    const hull = new THREE.MeshStandardMaterial({ color: 0x3c4536, roughness: 0.5, metalness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 0.1, metalness: 0.9 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), hull);
    body.scale.set(1.5, 1.35, 3.1);
    body.position.y = 1.7;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    nose.scale.set(1.25, 1.05, 1.5);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.85, 1.9);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 6.5, 10), hull);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 2.1, -5.6);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 1), hull);
    fin.position.set(0, 2.8, -8.6);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 8), hull);
    mast.position.y = 3.25;
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 7), bladeMat);
      blade.position.z = 3.5;
      const pivot = new THREE.Group();
      pivot.rotation.y = (i * Math.PI) / 2;
      pivot.add(blade);
      rotor.add(pivot);
    }
    rotor.position.y = 3.6;
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.16), bladeMat);
      b.rotation.x = (i * Math.PI) / 2;
      tailRotor.add(b);
    }
    tailRotor.position.set(0.22, 2.8, -8.6);
    [-1.1, 1.1].forEach((x) => {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.6), metal);
      skid.position.set(x, 0.12, 0);
      heli.add(skid);
      [-1, 1].forEach((z) => {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), metal);
        strut.position.set(x * 0.85, 0.5, z);
        heli.add(strut);
      });
    });
    const tailLight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ emissive: 0xff2020, emissiveIntensity: 5, color: 0 }));
    tailLight.position.set(0, 3.7, -8.8);
    heli.add(body, nose, tail, fin, mast, rotor, tailRotor, tailLight);
    heli.userData.tailLight = tailLight;
    heli.traverse((m) => { m.castShadow = !LOW; });
    heli.position.set(0, 0, -218);
    heli.rotation.y = 0.5;
    scene.add(heli);
  }
  let rotorSpeed = 2;

  // Projecteur militaire braqué sur l'héliport.
  const padSpot = new THREE.SpotLight(0xe6eeff, 500, 50, 0.5, 0.6, 1.5);
  padSpot.position.set(-14, 14, -206);
  padSpot.target.position.set(0, 0, -218);
  padSpot.castShadow = !LOW;
  padSpot.shadow.mapSize.set(1024, 1024);
  scene.add(padSpot, padSpot.target);
  const padBeam = beam(0xcfe0ff, Math.tan(0.5) * 20, 20, 0.05);
  padBeam.position.copy(padSpot.position);
  padBeam.lookAt(padSpot.target.position);
  scene.add(padBeam);

  // Projecteur d'un hélicoptère invisible qui balaie la ville.
  const search = new THREE.SpotLight(0xe8eeff, 4000, 140, 0.13, 0.5, 1.4);
  scene.add(search, search.target);
  const searchBeam = beam(0xdfe8ff, 1, 1, 0.09);
  scene.add(searchBeam);

  // ----- Cendres -----
  const ashCount = LOW ? 1400 : 3500;
  const ashGeo = new THREE.BufferGeometry();
  const ashPos = new Float32Array(ashCount * 3);
  const ashSeed = new Float32Array(ashCount);
  for (let i = 0; i < ashCount; i++) {
    ashPos[i * 3] = Math.random() * 60;
    ashPos[i * 3 + 1] = Math.random() * 30;
    ashPos[i * 3 + 2] = Math.random() * 60;
    ashSeed[i] = Math.random();
  }
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
  ashGeo.setAttribute('aSeed', new THREE.BufferAttribute(ashSeed, 1));
  const ashMat = new THREE.ShaderMaterial({ ...ashShader, uniforms: { ...ashShader.uniforms, uTime: time, uMap: { value: softDot() } }, transparent: true, depthWrite: false });
  ashMat.uniforms.uSize.value = 70 * renderer.getPixelRatio();
  const ash = new THREE.Points(ashGeo, ashMat);
  ash.frustumCulled = false;
  scene.add(ash);

  // ----- Infectés dans la rue -----
  const zombies = [];
  if (o.zombies) {
    const ztex = figureTexture('zombie', r);
    const zmat = new THREE.MeshStandardMaterial({ map: ztex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: 0x5a4e46 });
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ztex, alphaTest: 0.5 });
    const n = LOW ? 9 : 16;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), zmat);
      m.customDepthMaterial = depth;
      m.castShadow = !LOW;
      const z = { mesh: m, home: new THREE.Vector3((r() - 0.5) * 13, 1, -8 - r() * 120), phase: r() * 10, lit: 0, mode: 'idle', t: 0, speed: 0.15 + r() * 0.25, dir: r() < 0.5 ? -1 : 1 };
      m.position.copy(z.home);
      scene.add(m);
      zombies.push(z);
    }
  }

  // ----- Lampe torche -----
  const torch = new THREE.SpotLight(0xfff0d8, 220, 48, 0.36, 0.45, 1.5);
  torch.castShadow = !LOW;
  torch.shadow.mapSize.set(1024, 1024);
  torch.shadow.camera.near = 0.5;
  torch.shadow.camera.far = 48;
  torch.shadow.bias = -0.0006;
  scene.add(torch, torch.target);
  const torchBeam = beam(0xfff2dc, Math.tan(0.36) * 14, 14, 0.05);
  scene.add(torchBeam);
  let torchPower = o.flashlight ? 1 : 0;

  // ----- Post-traitement -----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  let bloom = null;
  if (!LOW) {
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.85, 0.5, 0.72);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());
  const horror = new ShaderPass(horrorShader);
  composer.addPass(horror);
  const fx = horror.uniforms;

  // ----- Caméra : on glisse d'un point de vue à l'autre -----
  const toV = (a) => new THREE.Vector3(...a);
  const cur = { pos: toV(VIEWS[o.view].pos), look: toV(VIEWS[o.view].look), fog: VIEWS[o.view].fog };
  const goal = { pos: cur.pos.clone(), look: cur.look.clone(), fog: cur.fog };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  const resolve = (v) => (typeof v === 'string' ? VIEWS[v] : v);

  const pointer = { x: 0, y: 0, sx: 0, sy: 0, active: false };
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && !e.buttons && e.type !== 'pointerdown') return;
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    pointer.active = true;
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    pointer.active = true;
  }, { passive: true });

  let shake = 0, vibrate = 0, lightningT = 6 + Math.random() * 8, flashSeq = null;
  let liftoff = false;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
  const torchGoal = new THREE.Vector3(0, 1, -20);

  const api = {
    scene, camera,
    onLightning: null,
    onLunge: null,
    view(a, b = a, t = 0) {
      const A = resolve(a), B = resolve(b);
      goal.pos.copy(tmpA.set(...A.pos)).lerp(tmpB.set(...B.pos), t);
      goal.look.copy(tmpA.set(...A.look)).lerp(tmpB.set(...B.look), t);
      goal.fog = A.fog + (B.fog - A.fog) * t;
    },
    jump(name) {
      api.view(name);
      cur.pos.copy(goal.pos);
      cur.look.copy(goal.look);
      cur.fog = goal.fog;
    },
    shake(v) { shake = Math.max(shake, REDUCED ? v * 0.2 : v); },
    vibrate(v) { vibrate = REDUCED ? v * 0.2 : v; },
    flash(v = 0.6) { fx.uFlash.value = Math.max(fx.uFlash.value, REDUCED ? v * 0.25 : v); },
    red(v = 0.6) { fx.uRed.value = Math.max(fx.uRed.value, v); },
    torch(on) { torchPower = on ? 1 : 0; },
    trigger(name) {
      if (name === 'powercut') {
        lamps.forEach((l, i) => { l.dying = 1.2 + i * 0.5; });
        wallMat.userData.target = 0.25;
      } else if (name === 'alert') {
        beaconLevel = 1.6;
      } else if (name === 'scan') {
        portals.forEach((p) => { p.emissive.set(0x48ff7a); p.emissiveIntensity = 5; });
        setTimeout(() => portals.forEach((p) => { p.emissive.set(0xff1a1a); p.emissiveIntensity = 2; }), 1400);
      } else if (name === 'gunshot') {
        muzzle.intensity = 4000;
        setTimeout(() => { muzzle.intensity = 0; }, 70);
        setTimeout(() => { muzzle.intensity = 1500; }, 110);
        setTimeout(() => { muzzle.intensity = 0; }, 150);
        api.flash(0.55);
        api.shake(0.5);
        api.red(0.7);
      } else if (name === 'liftoff') {
        liftoff = true;
        rotorSpeed = 28;
      } else if (name === 'rotor') {
        rotorSpeed = 16;
      }
    },
  };

  const resize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setSize(innerWidth, innerHeight);
    bloom?.setSize(innerWidth / 2, innerHeight / 2);
  };
  addEventListener('resize', resize);

  const clock = new THREE.Clock();
  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { clock.getDelta(); loop(); }
  });

  function update(dt) {
    const t = (time.value += dt);
    fx.uTime.value = t;

    // Caméra amortie vers son but.
    const k = 1 - Math.exp(-dt * 2.6);
    const prev = tmpA.copy(cur.pos);
    cur.pos.lerp(goal.pos, k);
    cur.look.lerp(goal.look, k);
    cur.fog += (goal.fog - cur.fog) * k;
    scene.fog.density = cur.fog;
    const speed = prev.distanceTo(cur.pos) / Math.max(dt, 1e-4);

    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 4));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 4));

    camera.position.copy(cur.pos);
    const walk = Math.min(speed / 6, 1) * (cur.pos.y < 4 ? 1 : 0);
    camera.position.y += Math.sin(t * 7) * 0.05 * walk;
    camera.position.x += Math.sin(t * 3.5) * 0.03 * walk;
    camera.lookAt(cur.look);
    camera.updateMatrixWorld();
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const look = tmpB.copy(cur.look).addScaledVector(right, pointer.sx * 3.2).addScaledVector(up, pointer.sy * 1.6);
    if (!REDUCED) look.y += Math.sin(t * 0.4) * 0.15;
    camera.lookAt(look);

    if (shake > 0.001 || vibrate > 0) {
      const s = shake + vibrate * 0.05;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.rotation.z += (Math.random() - 0.5) * s * 0.1;
      shake *= Math.exp(-dt * 5);
    }
    camera.updateMatrixWorld();

    // Lampe torche : elle suit le pointeur, ou erre seule.
    fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    if (o.flashlight === 'mouse' && pointer.active) ndc.set(pointer.x, pointer.y);
    else ndc.set(Math.sin(t * 0.23) * 0.55 + Math.sin(t * 0.61) * 0.15, Math.sin(t * 0.31) * 0.25 - 0.15);
    raycaster.setFromCamera(ndc, camera);
    torchGoal.lerp(raycaster.ray.at(22, tmpA), 1 - Math.exp(-dt * 8));
    torch.position.copy(camera.position).addScaledVector(right, 0.35).addScaledVector(up, -0.3);
    torch.target.position.copy(torchGoal);
    const flicker = Math.sin(t * 0.7) > 0.985 ? (Math.random() < 0.5 ? 0.1 : 1) : 1;
    const heightFade = THREE.MathUtils.clamp(1 - (camera.position.y - 4) / 6, 0, 1);
    torch.intensity = 380 * torchPower * flicker * heightFade;
    torchBeam.visible = torch.intensity > 1;
    torchBeam.position.copy(torch.position);
    torchBeam.lookAt(torchGoal);

    // Éclairs.
    lightningT -= dt;
    if (lightningT < 0) {
      lightningT = 14 + Math.random() * 16;
      flashSeq = REDUCED ? [0.5] : [3, 0.4, 2.2, 0.2, 1.4];
      api.onLightning?.();
    }
    if (flashSeq) {
      const v = flashSeq.shift();
      sky.intensity = 1 + v * 2.2;
      moon.intensity = 0.18 + v * 2;
      if (!flashSeq.length) flashSeq = null;
    } else {
      sky.intensity += (1 - sky.intensity) * (1 - Math.exp(-dt * 10));
      moon.intensity += (0.18 - moon.intensity) * (1 - Math.exp(-dt * 10));
    }

    // Lampadaires, fenêtres, feux.
    lamps.forEach((l) => {
      if (l.dying !== undefined) {
        l.dying -= dt;
        const on = l.dying > 0 && Math.random() < 0.5;
        l.light.intensity = on ? l.base : 0;
        l.head.material.emissiveIntensity = on ? 3 : 0;
        if (l.dying <= 0) { l.light.intensity = 0; l.head.material.emissiveIntensity = 0; delete l.dying; }
      } else if (l.light.intensity > 0) {
        l.light.intensity = l.base * (Math.random() < 0.02 ? 0.2 : 1);
      }
    });
    if (wallMat.userData.target !== undefined) {
      wallMat.emissiveIntensity += (wallMat.userData.target - wallMat.emissiveIntensity) * (1 - Math.exp(-dt * 3));
    }
    fires.forEach((f) => {
      f.flame.quaternion.copy(camera.quaternion);
      if (f.light) f.light.intensity = f.base * (0.75 + 0.25 * Math.sin(t * 13 + f.seed) * Math.sin(t * 7.3 + f.seed * 2));
    });
    smokes.forEach((s) => {
      const p = (s.t + t * 0.04) % 1;
      s.s.position.set(s.x + p * 6 * s.scale, 2 + p * 30 * s.scale, s.z - p * 3);
      s.s.scale.setScalar((2 + p * 10) * s.scale);
      s.s.material.opacity = Math.sin(p * Math.PI) * 0.45;
    });

    // Point d'extraction.
    beacons.forEach((b) => {
      const pulse = Math.max(0, Math.sin(t * 6 + b.phase)) ** 3;
      b.light.intensity = pulse * 40 * beaconLevel;
      b.lampMat.emissiveIntensity = pulse * 6 * beaconLevel;
    });
    containerLight.intensity = 10 + Math.sin(t * 3) * 4;
    container.userData.lampMat.emissiveIntensity = 2 + Math.sin(t * 3) * 1.5;
    padLights.forEach((m, i) => { m.material.emissiveIntensity = (Math.floor(t * 4) % 14) === i ? 4 : 0.8; });
    fx.uFlash.value *= Math.exp(-dt * 6);
    fx.uRed.value *= Math.exp(-dt * 1.6);

    // Hélicoptère : il décolle avec nous, puis disparaît de notre champ.
    rotor.rotation.y += dt * rotorSpeed;
    tailRotor.rotation.x += dt * rotorSpeed * 2.2;
    heli.userData.tailLight.material.emissiveIntensity = Math.sin(t * 5) > 0.6 ? 6 : 0.3;
    if (liftoff) heli.position.y += (Math.max(0, camera.position.y - 3) - heli.position.y) * (1 - Math.exp(-dt * 2));
    heli.visible = camera.position.distanceTo(tmpA.copy(heli.position).setY(heli.position.y + 1.6)) > 7 && !(liftoff && camera.position.y > 5);

    // Projecteur du ciel.
    const sx = Math.sin(t * 0.11) * 18, sz = -60 + Math.sin(t * 0.07) * 70;
    search.position.set(sx + 20, 60, sz + 30);
    search.target.position.set(sx, 0, sz);
    searchBeam.position.copy(search.position);
    searchBeam.lookAt(search.target.position);
    const len = search.position.distanceTo(search.target.position);
    searchBeam.scale.set(Math.tan(0.13) * len, Math.tan(0.13) * len, len);

    ashMat.uniforms.uCam.value.copy(camera.position);

    // Infectés : ils titubent, et se jettent sur vous si vous les fixez trop longtemps.
    zombies.forEach((z) => {
      const m = z.mesh;
      if (z.mode === 'idle') {
        z.home.x += Math.sin(t * 0.3 + z.phase) * dt * z.speed * z.dir;
        z.home.z += dt * z.speed * 0.6;
        if (z.home.z > camera.position.z + 2 || z.home.z < camera.position.z - 140) {
          z.home.set((Math.random() - 0.5) * 13, 1, camera.position.z - 30 - Math.random() * 70);
        }
        m.position.set(z.home.x + Math.sin(t * 1.4 + z.phase) * 0.08, 1 + Math.abs(Math.sin(t * 1.4 + z.phase)) * 0.04, z.home.z);
        m.rotation.set(0, Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z), Math.sin(t * 1.4 + z.phase) * 0.06);
        const toZ = tmpA.copy(m.position).sub(torch.position);
        const dist = toZ.length();
        const aim = toZ.normalize().dot(tmpB.copy(torchGoal).sub(torch.position).normalize());
        if (!REDUCED && torch.intensity > 50 && dist < 24 && aim > 0.97) z.lit += dt;
        else z.lit = Math.max(0, z.lit - dt * 0.5);
        if (z.lit > 0.9 && !api.lungeLock) {
          z.mode = 'lunge';
          z.t = 0;
          z.from = m.position.clone();
          api.lungeLock = true;
          api.onLunge?.();
          api.shake(0.35);
          api.red(0.9);
        }
      } else {
        z.t += dt;
        const target = tmpA.copy(camera.position).addScaledVector(fwd, 1.6);
        target.y = 1.15;
        const p = Math.min(z.t / 0.32, 1);
        m.position.lerpVectors(z.from, target, p * p);
        m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
        if (z.t > 0.7) {
          z.mode = 'idle';
          z.lit = 0;
          z.home.set((Math.random() - 0.5) * 13, 1, camera.position.z - 50 - Math.random() * 60);
          setTimeout(() => { api.lungeLock = false; }, 9000);
        }
      }
    });

    tickers.forEach((fn) => fn(dt, t));
  }

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    update(dt);
    composer.render();
  }

  api.jump(o.view);
  loop();
  canvas.classList.add('is-on');
  return api;
}

// Fait glisser la caméra entre les points de vue des éléments `data-view`, selon le défilement.
export function followScroll(world, els) {
  const anchors = [...els];
  let tops = [];
  const smooth = (t) => t * t * (3 - 2 * t);
  const measure = () => { tops = anchors.map((el) => el.getBoundingClientRect().top + scrollY); };
  const update = () => {
    const c = scrollY + innerHeight * 0.5;
    let i = 0;
    while (i < tops.length - 1 && c >= tops[i + 1]) i++;
    if (c <= tops[0] || i === tops.length - 1) return world.view(anchors[i].dataset.view);
    const t = (c - tops[i]) / (tops[i + 1] - tops[i]);
    world.view(anchors[i].dataset.view, anchors[i + 1].dataset.view, smooth(t));
  };
  const refresh = () => { measure(); update(); };
  refresh();
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', refresh);
  new ResizeObserver(refresh).observe(document.body);
  return refresh;
}
