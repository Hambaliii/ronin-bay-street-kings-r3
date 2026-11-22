// world.js — Kairyu Bay: bright sun-soaked grid city, hill plateau, harbour, park, touge.
import * as THREE from 'three';
import { CFG, DISTRICTS, TOUGE_POINTS } from './config.js';
import { rnd, rr, ri, pick, chance } from './random.js';

export function groundH(x, z) {
  if (x >= -660 && x <= 0 && z >= -660 && z <= 0) {
    const fE = Math.min(1, (0 - x) / 90);
    const fS = Math.min(1, (0 - z) / 90);
    return 26 * Math.min(fE, fS);
  }
  return 0;
}
function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[1];
}
export function glowSprite(color, scale) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const col = new THREE.Color(color);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, `rgba(255,255,255,0.95)`);
  grad.addColorStop(0.25, `rgba(${rgb},0.85)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 });
  const sp = new THREE.Sprite(m); sp.scale.set(scale, scale, 1);
  return sp;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function signTex(text, bg, fg) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.font = '900 64px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 2);
  });
}
// A road strip (plane displaced to follow groundH)
function roadStrip(width, length, cx, cz, alongZ, mat, yOff) {
  const seg = 72;
  // After rotation.x = -PI/2: local +x -> world +x, local +y -> world -z.
  // Vertical road: plane is (width x length). Horizontal: (length x width).
  const geo = alongZ ? new THREE.PlaneGeometry(width, length, 1, seg)
                     : new THREE.PlaneGeometry(length, width, seg, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const wx = cx + pos.getX(i), wz = cz - pos.getY(i);
    pos.setZ(i, groundH(wx, wz) + yOff);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, 0, cz); m.receiveShadow = true;
  return m;
}

const PALETTES = [
  { t: 6, sky: 0xffd9a8, sun: 0xffc38a, sunI: 1.5, hemi: .85, night: .2 },
  { t: 9, sky: 0x6ec6ff, sun: 0xfff2d0, sunI: 1.9, hemi: 1.05, night: 0 },
  { t: 16, sky: 0x5fb8f7, sun: 0xffeec0, sunI: 1.85, hemi: 1.0, night: 0 },
  { t: 18.5, sky: 0xff9a6a, sun: 0xff9a5f, sunI: 1.45, hemi: .8, night: .15 },
  { t: 20, sky: 0x51428a, sun: 0xffb37a, sunI: .7, hemi: .55, night: .7 },
  { t: 24, sky: 0x1d2a52, sun: 0x9fb6ff, sunI: .45, hemi: .5, night: 1 },
  { t: 30, sky: 0xffd9a8, sun: 0xffc38a, sunI: 1.5, hemi: .85, night: .2 }
];
function paletteAt(t) {
  let tt = t; if (tt < 6) tt += 24;
  for (let i = 0; i < PALETTES.length - 1; i++) {
    const a = PALETTES[i], b = PALETTES[i + 1];
    if (tt >= a.t && tt <= b.t) {
      const f = (tt - a.t) / Math.max(0.001, b.t - a.t);
      const L = (x, y) => x + (y - x) * f;
      return {
        sky: new THREE.Color(a.sky).lerp(new THREE.Color(b.sky), f),
        sun: new THREE.Color(a.sun).lerp(new THREE.Color(b.sun), f),
        sunI: L(a.sunI, b.sunI), hemi: L(a.hemi, b.hemi), night: L(a.night, b.night)
      };
    }
  }
  const p = PALETTES[1]; return { sky: new THREE.Color(p.sky), sun: new THREE.Color(p.sun), sunI: p.sunI, hemi: p.hemi, night: 0 };
}

export function buildWorld(G) {
  const scene = G.scene;
  G.lampMats = []; G.lampGlows = []; G.buildingMats = []; G.waterTexs = []; G.fountains = [];
  // Lights
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5f, 1.0); scene.add(hemi); G.hemi = hemi;
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -190; sun.shadow.camera.right = 190; sun.shadow.camera.top = 190; sun.shadow.camera.bottom = -190;
  sun.shadow.camera.far = 1200; sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target); G.sun = sun;
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  // Sky dome + fog
  scene.fog = new THREE.Fog(0xbfe3ff, 200, 1000);
  scene.background = new THREE.Color(0x6ec6ff);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x6ec6ff, side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1450, 24, 14), skyMat);
  scene.add(sky); G.skyMat = skyMat;
  // Roads grid
  G.roadX = []; G.roadZ = [];
  for (let v = -660; v <= 660; v += CFG.roadEvery) { G.roadX.push(v); G.roadZ.push(v); }
  // Base + district grounds
  const base = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshLambertMaterial({ color: 0x9db08a }));
  base.rotation.x = -Math.PI / 2; base.position.y = -0.08; scene.add(base);
  for (const d of DISTRICTS) {
    const w = d.x1 - d.x0, dep = d.z1 - d.z0;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, dep), new THREE.MeshLambertMaterial({ color: d.ground }));
    p.rotation.x = -Math.PI / 2;
    p.position.set(d.x0 + w / 2, (d.id === 'hill' ? 26 : 0) + 0.02, d.z0 + dep / 2);
    p.receiveShadow = true; scene.add(p);
  }
  // Sand + water (south & east)
  const sandMat = new THREE.MeshLambertMaterial({ color: 0xf6dc9e });
  for (const [w, d, x, z, rz] of [[1500, 46, 40, 683, 0], [46, 1500, 683, 40, 0]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), sandMat);
    s.rotation.x = -Math.PI / 2; s.position.set(x, 0.04, z); scene.add(s);
  }
  const waterTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1f9fd8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3;
    for (let i = 0; i < 22; i++) { g.beginPath(); const y = rnd() * h; g.moveTo(rnd() * w, y); g.lineTo(rnd() * w, y + rr(-6, 6)); g.stroke(); }
    g.fillStyle = 'rgba(120,220,255,0.35)';
    for (let i = 0; i < 30; i++) g.fillRect(rnd() * w, rnd() * h, rr(10, 42), 3);
  });
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(10, 4);
  G.waterTexs.push(waterTex);
  const waterMat = new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.92 });
  for (const [w, d, x, z] of [[1700, 260, 40, 800], [260, 1700, 800, 40]]) {
    const wp = new THREE.Mesh(new THREE.PlaneGeometry(w, d), waterMat);
    wp.rotation.x = -Math.PI / 2; wp.position.set(x, 0.25, z); scene.add(wp);
  }
  // Roads
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x565d66 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xc9ced6 });
  for (const x of G.roadX) {
    scene.add(roadStrip(CFG.roadW, 1340, x, 0, true, asphalt, 0.06));
    scene.add(roadStrip(3, 1340, x - 16.5, 0, true, walkMat, 0.09));
    scene.add(roadStrip(3, 1340, x + 16.5, 0, true, walkMat, 0.09));
  }
  for (const z of G.roadZ) {
    scene.add(roadStrip(CFG.roadW, 1340, 0, z, false, asphalt, 0.055));
    scene.add(roadStrip(3, 1340, 0, z - 16.5, false, walkMat, 0.085));
    scene.add(roadStrip(3, 1340, 0, z + 16.5, false, walkMat, 0.085));
  }
  // Edge lines + centre dashes
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf4f7fa });
  const edgeGeo = new THREE.BoxGeometry(0.35, 0.06, 9);
  const edges = new THREE.InstancedMesh(edgeGeo, edgeMat, 2400);
  let ei = 0; const M = new THREE.Object3D();
  const addEdge = (x, z, rotY) => { if (ei >= 2400) return; M.position.set(x, groundH(x, z) + 0.12, z); M.rotation.set(0, rotY, 0); M.updateMatrix(); edges.setMatrixAt(ei++, M.matrix); };
  for (const x of G.roadX) for (let z = -650; z < 660; z += 22) { addEdge(x - 13.5, z, 0); addEdge(x + 13.5, z, 0); }
  for (const z of G.roadZ) for (let x = -650; x < 660; x += 22) { addEdge(x, z - 13.5, Math.PI / 2); addEdge(x, z + 13.5, Math.PI / 2); }
  edges.count = ei; scene.add(edges);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffe95a });
  const dashGeo = new THREE.BoxGeometry(0.5, 0.07, 5);
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, 1600);
  let di = 0;
  const addDash = (x, z, rotY) => { if (di >= 1600) return; M.position.set(x, groundH(x, z) + 0.13, z); M.rotation.set(0, rotY, 0); M.updateMatrix(); dashes.setMatrixAt(di++, M.matrix); };
  for (const x of G.roadX) for (let z = -645; z < 660; z += 20) { if (G.roadZ.some(rz => Math.abs(rz - z) < 18)) continue; addDash(x, z, 0); }
  for (const z of G.roadZ) for (let x = -645; x < 660; x += 20) { if (G.roadX.some(rx => Math.abs(rx - x) < 18)) continue; addDash(x, z, Math.PI / 2); }
  dashes.count = di; scene.add(dashes);
  // Crosswalks
  const cwMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cwGeo = new THREE.BoxGeometry(1.6, 0.05, 6);
  const cws = new THREE.InstancedMesh(cwGeo, cwMat, 900); let ci = 0;
  for (const x of G.roadX) for (const z of G.roadZ) {
    if (Math.abs(x) > 500 || Math.abs(z) > 500) continue;
    for (let k = -2; k <= 2; k++) {
      if (ci < 900) { M.position.set(x + k * 3, groundH(x, z) + 0.11, z - 17); M.rotation.set(0, 0, 0); M.updateMatrix(); cws.setMatrixAt(ci++, M.matrix); }
      if (ci < 900) { M.position.set(x + k * 3, groundH(x, z) + 0.11, z + 17); M.rotation.set(0, 0, 0); M.updateMatrix(); cws.setMatrixAt(ci++, M.matrix); }
    }
  }
  cws.count = ci; scene.add(cws);

  // ---------- Buildings ----------
  const neonColors = [0xff2e88, 0x00f5d4, 0xffe95a, 0x7b2fff, 0xff8c42];
  const signWords = ['RAMEN', 'TUNER', 'CAFE', 'PARTS', 'HOTEL', 'SUSHI', 'CLUB', 'MART'];
  const tallNeon = [];
  const addCollider = (cx, cz, hw, hd, h) => G.colliders.push({ x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd, minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd, cx, cz, hw, hd, h: h || 10 });
  G.addCollider = addCollider;
  function facadeTex(colorHex) {
    const col = '#' + colorHex.toString(16).padStart(6, '0');
    return canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = col; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, w, 14);
      for (let y = 18; y < h - 12; y += 22) for (let x = 10; x < w - 12; x += 22) {
        g.fillStyle = chance(0.42) ? '#ffd98a' : '#33506e';
        g.fillRect(x, y, 13, 14);
      }
    });
  }
  const block = CFG.roadEvery;
  for (let bx = 0; bx < 8; bx++) for (let bz = 0; bz < 8; bz++) {
    const cx = -660 + bx * block + block / 2, cz = -660 + bz * block + block / 2;
    const dist = districtAt(cx, cz);
    const isPark = Math.abs(cx - 82.5) < 1 && Math.abs(cz - (-82.5)) < 1;
    const isHQ = Math.abs(cx - (-412.5)) < 1 && Math.abs(cz - 412.5) < 1;
    if (isPark) { buildPark(G, cx, cz); continue; }
    if (isHQ) continue;
    const n = ri(1, 4);
    for (let i = 0; i < n; i++) {
      const bw = rr(20, 38), bd = rr(20, 38);
      const px = cx + (n === 1 ? 0 : rr(-52, 52)), pz = cz + (n === 1 ? 0 : rr(-52, 52));
      if (Math.abs(px - cx) > 58 || Math.abs(pz - cz) > 58) continue;
      const bh = dist.id === 'neon' ? rr(40, 120) : rr(10, 35);
      const gy = groundH(px, pz);
      const ftex = facadeTex(pick(dist.building));
      const mat = new THREE.MeshLambertMaterial({ map: ftex, emissive: 0xffc37a, emissiveIntensity: 0 });
      G.buildingMats.push(mat);
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
      b.position.set(px, gy + bh / 2, pz); b.castShadow = true; b.receiveShadow = true; scene.add(b);
      addCollider(px, pz, bw / 2, bd / 2, bh);
      if (bh > 70 && dist.id === 'neon') tallNeon.push({ x: px, z: pz, w: bw, h: bh, gy });
      // Storefronts
      if ((dist.id === 'beach' || dist.id === 'neon') && chance(0.4)) {
        const accent = pick(neonColors);
        const awn = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.7, 0.5, 4), new THREE.MeshLambertMaterial({ color: accent }));
        awn.position.set(px, gy + 3.4, pz + bd / 2 + 1.6); scene.add(awn);
        const word = pick(signWords);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.62, 2.2),
          new THREE.MeshBasicMaterial({ map: signTex(word, '#101828', '#' + accent.toString(16).padStart(6, '0')) }));
        sign.position.set(px, gy + 5.2, pz + bd / 2 + 0.15); scene.add(sign);
        const gl = glowSprite(accent, 7); gl.position.set(px, gy + 5.2, pz + bd / 2 + 1); scene.add(gl);
      }
      // Neon signs
      if (dist.id === 'neon' && chance(0.55)) {
        const accent = pick(neonColors);
        const ns = new THREE.Mesh(new THREE.BoxGeometry(1.2, rr(6, 14), 0.6), new THREE.MeshBasicMaterial({ color: accent }));
        ns.position.set(px + bw / 2 + 0.5, gy + bh * rr(0.4, 0.7), pz); scene.add(ns);
        const gl = glowSprite(accent, 12); gl.position.copy(ns.position); scene.add(gl);
      }
    }
  }
  // Billboards on tall neon buildings
  const bbWords = ['RONIN KAI', 'KAZE GT-X', 'TAIYO JZ-400', 'VISIT CORAL STRIP', 'NEON MILE'];
  tallNeon.slice(0, 8).forEach((tb, i) => {
    const word = bbWords[i % bbWords.length];
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(34, tb.w + 8), 10),
      new THREE.MeshBasicMaterial({ map: signTex(word, '#0d1526', i % 2 ? '#00f5d4' : '#ff2e88') }));
    bb.position.set(tb.x, tb.gy + tb.h + 6, tb.z); bb.rotation.y = (i % 4) * Math.PI / 2; scene.add(bb);
    const post = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), new THREE.MeshLambertMaterial({ color: 0x555f6e }));
    post.position.set(tb.x, tb.gy + tb.h + 1, tb.z); scene.add(post);
    const gl = glowSprite(i % 2 ? 0x00f5d4 : 0xff2e88, 26); gl.position.copy(bb.position); scene.add(gl);
  });

  buildTrees(G);
  buildLamps(G);
  buildTrafficLights(G);
  buildHarbor(G);
  buildHQ(G);
  buildTouge(G);
}

function buildPark(G, cx, cz) {
  const scene = G.scene, gy = groundH(cx, cz);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), new THREE.MeshLambertMaterial({ color: 0x58b368 }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(cx, gy + 0.07, cz); grass.receiveShadow = true; scene.add(grass);
  const pathMat = new THREE.MeshLambertMaterial({ color: 0xe6dcc3 });
  for (const rot of [0, Math.PI / 2]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(130, 7), pathMat);
    p.rotation.x = -Math.PI / 2; p.rotation.z = rot; p.position.set(cx, gy + 0.1, cz); scene.add(p);
  }
  for (let i = 0; i < 16; i++) {
    const x = cx + rr(-56, 56), z = cz + rr(-56, 56);
    if (Math.abs(x - cx) < 7 || Math.abs(z - cz) < 7) continue;
    streetTree(G, x, z);
  }
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x8a5a34 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 1), benchMat);
    bench.position.set(cx + Math.cos(a) * 20, gy + 0.5, cz + Math.sin(a) * 20); bench.rotation.y = -a; bench.castShadow = true; scene.add(bench);
  }
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.6, 1.4, 20), new THREE.MeshLambertMaterial({ color: 0xd8dee8 }));
  basin.position.set(cx, gy + 0.7, cz); basin.castShadow = true; scene.add(basin);
  const discMat = new THREE.MeshBasicMaterial({ color: 0x54c8f0, transparent: true, opacity: 0.85 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.25, 20), discMat);
  disc.position.set(cx, gy + 1.45, cz); scene.add(disc);
  G.fountains.push(disc);
  const gl = glowSprite(0x54c8f0, 10); gl.position.set(cx, gy + 3, cz); scene.add(gl);
  G.addCollider(cx, cz, 7.6, 7.6, 1.4);
}

// ---- Trees: instanced trunks/canopies + individual palms ----
const _treeSpots = { street: [], pine: [] };
function streetTree(G, x, z) { _treeSpots.street.push([x, z]); }
function buildTrees(G) {
  const scene = G.scene;
  // Palms: coasts + beach avenues
  const palmSpots = [];
  for (let x = 10; x <= 640; x += 28) palmSpots.push([x + rr(-4, 4), rr(606, 640)]);
  for (let z = 10; z <= 640; z += 28) palmSpots.push([rr(606, 640), z + rr(-4, 4)]);
  for (let x = 20; x <= 620; x += 55) { palmSpots.push([x, 495 - 20]); palmSpots.push([x, 330 - 20]); }
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x9a7648 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f, side: THREE.DoubleSide });
  for (const [x, z] of palmSpots) {
    const gy = groundH(x, z), grp = new THREE.Group();
    const lean = rr(-0.16, 0.16);
    let px = 0, py = 0;
    for (let sIdx = 0; sIdx < 4; sIdx++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.22 - sIdx * 0.03, 0.26 - sIdx * 0.03, 1.5, 6), trunkMat);
      px += lean * 1.4; py += 1.4;
      seg.position.set(px, py, 0); seg.rotation.z = -lean; seg.castShadow = true; grp.add(seg);
    }
    for (let f = 0; f < 8; f++) {
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 2.0), frondMat);
      const a = (f / 8) * Math.PI * 2;
      fr.position.set(px + Math.cos(a) * 0.7, py + 0.7, Math.sin(a) * 0.7);
      fr.rotation.set(1.15, a, 0, 'YXZ'); grp.add(fr);
    }
    grp.position.set(x, gy, z); scene.add(grp);
  }
  // Street trees along sidewalks, all districts
  for (const x of G.roadX) for (let z = -640; z <= 640; z += 52) {
    for (const side of [-19, 19]) {
      const px = x + side, pz = z + rr(-7, 7);
      if (G.roadZ.some(rz => Math.abs(rz - pz) < 24)) continue;
      if (px < -655 || px > 655) continue;
      const d = districtAt(px, pz);
      if (d.id === 'hill') _treeSpots.pine.push([px, pz]); else _treeSpots.street.push([px, pz]);
    }
  }
  for (const z of G.roadZ) for (let x = -640; x <= 640; x += 52) {
    for (const side of [-19, 19]) {
      const px = x + rr(-7, 7), pz = z + side;
      if (G.roadX.some(rx => Math.abs(rx - px) < 24)) continue;
      if (pz < -655 || pz > 655) continue;
      const d = districtAt(px, pz);
      if (d.id === 'hill') _treeSpots.pine.push([px, pz]); else _treeSpots.street.push([px, pz]);
    }
  }
  for (let i = 0; i < 60; i++) _treeSpots.pine.push([rr(-640, -30), rr(-640, -30)]);
  // Instanced street trees
  const sN = _treeSpots.street.length;
  const trunkI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 6), trunkMat, sN);
  const canI = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.7, 1), new THREE.MeshLambertMaterial({ color: 0x3da653 }), sN * 3);
  const M = new THREE.Object3D(); let ci2 = 0;
  _treeSpots.street.forEach(([x, z], i) => {
    const gy = groundH(x, z);
    M.position.set(x, gy + 1.1, z); M.rotation.set(0, 0, 0); M.scale.setScalar(rr(0.85, 1.2)); M.updateMatrix(); trunkI.setMatrixAt(i, M.matrix);
    for (let k = 0; k < 3; k++) {
      M.position.set(x + rr(-0.9, 0.9), gy + 2.9 + k * 0.8, z + rr(-0.9, 0.9)); M.scale.setScalar(rr(0.6, 1.0)); M.updateMatrix();
      if (ci2 < sN * 3) canI.setMatrixAt(ci2++, M.matrix);
    }
  });
  canI.count = ci2; trunkI.castShadow = true; scene.add(trunkI); scene.add(canI);
  // Instanced pines
  const pN = _treeSpots.pine.length;
  const pTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1.8, 6), trunkMat, pN);
  const pCone = new THREE.InstancedMesh(new THREE.ConeGeometry(1.9, 4.6, 8), new THREE.MeshLambertMaterial({ color: 0x2c7a3f }), pN);
  _treeSpots.pine.forEach(([x, z], i) => {
    const gy = groundH(x, z);
    M.rotation.set(0, 0, 0); M.scale.setScalar(rr(0.9, 1.35));
    M.position.set(x, gy + 0.9, z); M.updateMatrix(); pTrunk.setMatrixAt(i, M.matrix);
    M.position.set(x, gy + 3.6, z); M.updateMatrix(); pCone.setMatrixAt(i, M.matrix);
  });
  scene.add(pTrunk); scene.add(pCone);
}
function buildLamps(G) {
  const scene = G.scene;
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3c4656 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  G.lampMats.push(headMat);
  const spots = [];
  for (const x of G.roadX) for (let z = -610; z <= 620; z += 110) spots.push([x + 17, z]);
  for (const z of G.roadZ) for (let x = -610; x <= 620; x += 110) spots.push([x, z + 17]);
  const poleI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 6.4, 6), poleMat, spots.length);
  const headI = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.3, 0.5), headMat, spots.length);
  const M = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    const gy = groundH(x, z);
    M.rotation.set(0, 0, 0); M.scale.setScalar(1);
    M.position.set(x, gy + 3.2, z); M.updateMatrix(); poleI.setMatrixAt(i, M.matrix);
    M.position.set(x, gy + 6.5, z); M.updateMatrix(); headI.setMatrixAt(i, M.matrix);
    if (i % 2 === 0) { const gl = glowSprite(0xffdf9a, 6); gl.position.set(x, gy + 6.5, z); gl.material.opacity = 0.25; scene.add(gl); G.lampGlows.push(gl); }
  });
  scene.add(poleI); scene.add(headI);
}
function buildTrafficLights(G) {
  const scene = G.scene;
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c3442 });
  for (const x of G.roadX) for (const z of G.roadZ) {
    if (Math.abs(x) > 500 || Math.abs(z) > 500) continue;
    const gy = groundH(x, z), grp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.4, 6), poleMat);
    pole.position.set(0, 2.7, 0); grp.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.7), new THREE.MeshLambertMaterial({ color: 0x161c26 }));
    box.position.set(0, 5.2, 0); grp.add(box);
    const lamps = [];
    const cols = [0xff3b30, 0xffcc00, 0x2eff6a];
    for (let i = 0; i < 3; i++) {
      const lm = new THREE.MeshBasicMaterial({ color: 0x333a44 });
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lm);
      s.position.set(0, 5.85 - i * 0.62, 0.38); grp.add(s); lamps.push(lm);
      lamps[i].userData = { on: cols[i] };
    }
    grp.position.set(x + 17, gy, z + 17); scene.add(grp);
    G.trafficLights.push({ x, z, phase: 0, t: rr(0, 6), lamps });
  }
}
function buildHarbor(G) {
  const scene = G.scene;
  const dock = new THREE.Mesh(new THREE.BoxGeometry(220, 2, 90), new THREE.MeshLambertMaterial({ color: 0x8d949e }));
  dock.position.set(-480, 1, 612); dock.receiveShadow = true; scene.add(dock);
  G.addCollider(-480, 612, 110, 45, 2);
  const contCols = [0xff5a3c, 0x2f9df0, 0x37c978, 0xffc93c, 0xff6b9d, 0x7b2fff, 0x00b8a9];
  for (let i = 0; i < 26; i++) {
    const col = pick(contCols);
    const cx = -580 + (i % 9) * 26, cz = 585 + Math.floor(i / 9) * 24, lvl = chance(0.3) ? 1 : 0;
    const c = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 6), new THREE.MeshLambertMaterial({ color: col }));
    c.position.set(cx, 2 + 2.5 + lvl * 5, cz); c.castShadow = true; scene.add(c);
    if (!lvl) G.addCollider(cx, cz, 6, 3, 5);
  }
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xff8c42 });
  for (const cx of [-560, -470, -380]) {
    const grp = new THREE.Group();
    for (const dx of [-8, 8]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 26, 1.4), craneMat); leg.position.set(dx, 13, 0); grp.add(leg); }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 44), craneMat); arm.position.set(0, 26, 8); grp.add(arm);
    const top = new THREE.Mesh(new THREE.BoxGeometry(19, 2, 2), craneMat); top.position.set(0, 26, 0); grp.add(top);
    grp.position.set(cx, 2, 590); grp.traverse(o => { o.castShadow = true; }); scene.add(grp);
    G.addCollider(cx, 590, 9, 2, 26);
  }
  // crates + barrels near HQ
  for (let i = 0; i < 14; i++) {
    const cx = -500 + rr(-30, 90), cz = rr(350, 400);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshLambertMaterial({ color: pick([0xb08954, 0x8a6a42, 0xc9a86a]) }));
    crate.position.set(cx, groundH(cx, cz) + 1.2, cz); crate.castShadow = true; scene.add(crate);
  }
  for (let i = 0; i < 10; i++) {
    const cx = -480 + rr(-40, 60), cz = rr(345, 395);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.7, 10), new THREE.MeshLambertMaterial({ color: pick([0x2f9df0, 0xff5a3c, 0x37c978]) }));
    bar.position.set(cx, groundH(cx, cz) + 0.85, cz); scene.add(bar);
  }
  // Kiosk booths near meet lot
  for (const [kx, word, col] of [[-462, 'RAMEN', '#ff2e88'], [-378, 'PARTS', '#00f5d4']]) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(7, 4.4, 6), new THREE.MeshLambertMaterial({ color: 0xf2ead8 }));
    k.position.set(kx, groundH(kx, 368) + 2.2, 368); k.castShadow = true; scene.add(k);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 7.4), new THREE.MeshLambertMaterial({ color: 0xff8c42 }));
    awn.position.set(kx, groundH(kx, 368) + 4.6, 368); scene.add(awn);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: signTex(word, '#101828', col) }));
    sign.position.set(kx, groundH(kx, 368) + 3.4, 371.1); scene.add(sign);
    G.addCollider(kx, 368, 3.5, 3, 4.4);
  }
}
function buildHQ(G) {
  const scene = G.scene, gy = groundH(-420, 420);
  const hq = new THREE.Mesh(new THREE.BoxGeometry(46, 14, 30), new THREE.MeshLambertMaterial({ color: 0x46586e }));
  hq.position.set(-420, gy + 7, 428); hq.castShadow = true; scene.add(hq);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(38, 7), new THREE.MeshBasicMaterial({ map: signTex('RONIN KAI', '#0d1526', '#ff2e88') }));
  sign.position.set(-420, gy + 10.5, 412.8); sign.rotation.y = Math.PI; scene.add(sign);
  const gl = glowSprite(0xff2e88, 17); gl.position.set(-420, gy + 10.5, 410); scene.add(gl);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(48, 1, 32), new THREE.MeshLambertMaterial({ color: 0x2c3a4e }));
  roof.position.set(-420, gy + 14.4, 428); scene.add(roof);
  // Lit window strips on the lot-facing wall (z = 413 face) — warm emissive
  // material matching the city-building window approach.
  const winMat = new THREE.MeshLambertMaterial({ color: 0xffd98a, emissive: 0xffc37a, emissiveIntensity: 0.9 });
  for (const wy of [3.2, 6.4]) {
    for (let wi = 0; wi < 5; wi++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.4), winMat);
      win.position.set(-436 + wi * 8, gy + wy, 412.7); win.rotation.y = Math.PI; scene.add(win);
    }
  }
  const band = new THREE.Mesh(new THREE.BoxGeometry(46.4, 1.1, 30.4), new THREE.MeshLambertMaterial({ color: 0x2c3a4e }));
  band.position.set(-420, gy + 8.6, 428); scene.add(band);
  G.addCollider(-420, 428, 23, 15, 14);
  // Meet lot painted lines
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 8; i++) {
    const ln = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 11), lineMat);
    ln.position.set(-452 + i * 9, gy + 0.14, 380); scene.add(ln);
  }
  G.spots = { hq: { x: -420, z: 375 }, meet: { x: -420, z: 380 }, garage: { x: -420, z: 398 }, spray: { x: -360, z: 380 } };
}
function buildTouge(G) {
  const scene = G.scene;
  const mat = new THREE.MeshLambertMaterial({ color: 0x3f464f });
  const railMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < TOUGE_POINTS.length - 1; i++) {
    const [x0, z0] = TOUGE_POINTS[i], [x1, z1] = TOUGE_POINTS[i + 1];
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, len + 4), mat);
    seg.position.set(mx, 26.12, mz); seg.rotation.y = ang; seg.receiveShadow = true; scene.add(seg);
    for (const side of [-7.6, 7.6]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, len + 4), railMat);
      rail.position.set(mx + Math.cos(ang) * side, 26.7, mz - Math.sin(ang) * side);
      rail.rotation.y = ang; scene.add(rail);
    }
  }
}

export function updateWorld(G, dt) {
  if (!G.shot) {
    G.timeOfDay += dt * (24 / CFG.dayLength);
    if (G.timeOfDay >= 24) G.timeOfDay -= 24;
  }
  const pal = paletteAt(G.timeOfDay);
  G.nightFactor = pal.night;
  if (G.skyMat) G.skyMat.color.copy(pal.sky);
  if (G.scene.background && G.scene.background.isColor) G.scene.background.copy(pal.sky);
  if (G.scene.fog) G.scene.fog.color.copy(pal.sky).lerp(new THREE.Color(0xffffff), 0.25);
  const focus = (G.car && G.mode === 'car') ? G.car.mesh.position : (G.player ? G.player.mesh.position : G.camera.position);
  if (G.sun) {
    const dayF = ((G.timeOfDay - 6) / 12) * Math.PI;
    const elev = Math.max(0.18, Math.sin(dayF));
    G.sun.position.set(focus.x + Math.cos(dayF) * 320, elev * 380 + 60, focus.z + 190);
    G.sun.target.position.copy(focus);
    G.sun.color.copy(pal.sun); G.sun.intensity = pal.sunI;
    G.sun.target.updateMatrixWorld();
  }
  if (G.hemi) G.hemi.intensity = pal.hemi;
  const lampO = 0.2 + pal.night * 0.8;
  for (const gl of (G.lampGlows || [])) gl.material.opacity = lampO;
  for (const m of (G.lampMats || [])) m.color.setHex(pal.night > 0.4 ? 0xffe9a8 : 0xfff6da);
  for (const m of (G.buildingMats || [])) m.emissiveIntensity = pal.night * 0.38;
  for (const t of (G.waterTexs || [])) { t.offset.x += dt * 0.015; t.offset.y += dt * 0.006; }
  for (const f of (G.fountains || [])) f.rotation.y += dt * 0.7;
  // Traffic lights: 7s phases
  for (const tl of G.trafficLights) {
    tl.t += dt;
    const cyc = tl.t % 14;
    tl.phase = cyc < 7 ? 0 : 1;
    const yellow = (cyc > 6 && cyc < 7) || (cyc > 13 && cyc < 14);
    tl.lamps.forEach((lm, i) => {
      let on = false;
      if (yellow) on = i === 1;
      else if (tl.phase === 0) on = i === 2;
      else on = i === 0;
      lm.color.setHex(on ? lm.userData.on : 0x333a44);
    });
  }
}

export function roadRoute(G, from, to) {
  const near = (arr, v) => arr.reduce((best, cur) => Math.abs(cur - v) < Math.abs(best - v) ? cur : best, arr[0]);
  const midX = near(G.roadX, to.x), midZ = near(G.roadZ, from.z);
  const pts = [];
  const push = (x, z) => {
    const p = new THREE.Vector3(x, groundH(x, z), z);
    if (!pts.length || pts[pts.length - 1].distanceTo(p) > 1) pts.push(p);
  };
  push(from.x, from.z); push(from.x, midZ); push(midX, midZ); push(midX, to.z); push(to.x, to.z);
  return pts;
}
