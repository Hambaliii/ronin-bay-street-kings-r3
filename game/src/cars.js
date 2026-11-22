// cars.js — primitive-built cars whose silhouettes must read model-by-model.
import * as THREE from 'three';
import { CARS, CAST } from './config.js';
import { groundH, glowSprite } from './world.js';
import { rnd, rr, ri, pick } from './random.js';

const TRAFFIC_COLORS = [0xe8e8ec, 0xc0c6ce, 0x3a6ea8, 0xb02020, 0x37c978, 0xffc93c, 0x7a4fd0, 0x22262e, 0xff8c42, 0x2fb9a8];
function specById(id) { return CARS.find(c => c.id === id) || CARS[0]; }
function box(w, h, d, mat, x, y, z, rx) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (rx) m.rotation.x = rx;
  m.castShadow = true; return m;
}
function textTex(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 256, 128);
  g.font = '900 62px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = fg; g.fillText(text, 128, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeCarMesh(spec, colorHex, opts = {}) {
  const st = Object.assign({ length: 4.5, width: 1.9, height: 1.42, hoodLen: 1.1, cabinBack: .2, cabinLen: 2, cabinH: .5, noseSlope: .25, tail: 'notch', wheelR: .36, wing: 'none' }, spec.style || {});
  const L = st.length, W = st.width, H = st.height, wr = st.wheelR;
  const grp = new THREE.Group();
  const isTruck = st.tail === 'truck';
  const bodyMat = new THREE.MeshPhongMaterial({ color: colorHex, shininess: 90, specular: 0x888888 });
  const darkMat = new THREE.MeshPhongMaterial({ color: 0x14181f, shininess: 40 });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x16222f, shininess: 140, specular: 0xbfe3ff, transparent: !!opts.driver, opacity: opts.driver ? 0.6 : 1 });
  const chromeMat = new THREE.MeshPhongMaterial({ color: 0xd8dee8, shininess: 160 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  grp.userData.bodyMat = bodyMat; grp.userData.headMat = headMat;
  const baseY = wr + (H * 0.30);
  if (isTruck) {
    // cab + separate cargo box
    const cab = box(W, 1.5, 1.7, bodyMat, 0, wr + 0.95, L / 2 - 0.95); grp.add(cab);
    const cabGlass = box(W * 0.92, 0.62, 0.9, glassMat, 0, wr + 1.45, L / 2 - 0.6); grp.add(cabGlass);
    const cargoCol = opts.cargoColor || 0xeef1f4;
    const cargo = box(W, 2.5, L - 2.1, new THREE.MeshPhongMaterial({ color: cargoCol, shininess: 30 }), 0, wr + 1.55, -0.9); grp.add(cargo);
    const chassis = box(W * 0.9, 0.4, L, darkMat, 0, wr + 0.15, 0); grp.add(chassis);
  } else {
    // Lower body
    const lowerH = st.tail === 'suv' ? H * 0.52 : H * 0.5;
    const lower = box(W, lowerH, L, bodyMat, 0, baseY, 0); grp.add(lower);
    // Side skirts
    grp.add(box(W + 0.06, 0.16, L * 0.55, darkMat, 0, wr + 0.05, 0));
    // Hood: sloped box at front (+z is front)
    const hoodZ = L / 2 - st.hoodLen / 2;
    const hood = box(W * 0.94, 0.22, st.hoodLen, bodyMat, 0, baseY + lowerH / 2 + 0.02, hoodZ, st.noseSlope * 0.38);
    grp.add(hood);
    // Cabin by tail type
    const cabZ = -st.cabinBack;
    if (st.tail === 'roadster') {
      const tub = box(W * 0.96, 0.3, st.cabinLen + 0.7, bodyMat, 0, baseY + lowerH / 2, cabZ); grp.add(tub);
      const interior = box(W * 0.8, 0.16, st.cabinLen, darkMat, 0, baseY + lowerH / 2 + 0.14, cabZ); grp.add(interior);
      for (const sx of [-W * 0.22, W * 0.22]) {
        grp.add(box(0.52, 0.42, 0.5, darkMat, sx, baseY + lowerH / 2 + 0.3, cabZ - 0.1));
        grp.add(box(0.4, 0.3, 0.14, darkMat, sx, baseY + lowerH / 2 + 0.55, cabZ - 0.38));
      }
      const shield = box(W * 0.86, 0.5, 0.06, glassMat, 0, baseY + lowerH / 2 + 0.42, cabZ + st.cabinLen / 2 + 0.22, -0.32); grp.add(shield);
    } else if (st.tail === 'suv') {
      const cab = box(W * 0.94, st.cabinH + 0.35, st.cabinLen, glassMat, 0, baseY + lowerH / 2 + (st.cabinH + 0.35) / 2 - 0.05, cabZ); grp.add(cab);
      const roof = box(W * 0.98, 0.1, st.cabinLen + 0.1, bodyMat, 0, baseY + lowerH / 2 + st.cabinH + 0.32, cabZ); grp.add(roof);
      for (const sx of [-W * 0.3, W * 0.3]) grp.add(box(0.07, 0.07, st.cabinLen * 0.9, darkMat, sx, baseY + lowerH / 2 + st.cabinH + 0.42, cabZ));
    } else if (st.tail === 'hatch') {
      const cab = box(W * 0.9, st.cabinH + 0.22, st.cabinLen, glassMat, 0, baseY + lowerH / 2 + (st.cabinH + 0.22) / 2 - 0.04, cabZ); grp.add(cab);
      const roof = box(W * 0.94, 0.09, st.cabinLen * 0.92, bodyMat, 0, baseY + lowerH / 2 + st.cabinH + 0.2, cabZ); grp.add(roof);
      const rearGlass = box(W * 0.84, st.cabinH + 0.1, 0.07, glassMat, 0, baseY + lowerH / 2 + (st.cabinH) / 2 + 0.1, cabZ - st.cabinLen / 2 - 0.03, 0.18); grp.add(rearGlass);
    } else if (st.tail === 'fastback') {
      const narrow = (spec.id === 'taiyo' || spec.id === 'hoshi7' || spec.id === 'hero-supra') ? 0.82 : 0.9;
      const cab = box(W * narrow, st.cabinH + 0.16, st.cabinLen, glassMat, 0, baseY + lowerH / 2 + (st.cabinH + 0.16) / 2 - 0.05, cabZ, 0.1); grp.add(cab);
      const slope = box(W * (narrow + 0.04), 0.09, st.cabinLen * 0.75, bodyMat, 0, baseY + lowerH / 2 + 0.12, cabZ - st.cabinLen * 0.55, 0.42); grp.add(slope);
      if (spec.id === 'hoshi7' || spec.id === 'taiyo' || spec.id === 'hero-supra') {
        const roofCurve = new THREE.Mesh(new THREE.CylinderGeometry(W * narrow * 0.5, W * narrow * 0.5, st.cabinLen * 0.92, 12, 1, false, 0, Math.PI), glassMat);
        roofCurve.rotation.z = Math.PI / 2; roofCurve.rotation.y = Math.PI / 2;
        roofCurve.position.set(0, baseY + lowerH / 2 + st.cabinH + 0.1, cabZ); roofCurve.castShadow = true; grp.add(roofCurve);
      }
    } else { // notch
      const cab = box(W * 0.9, st.cabinH + 0.18, st.cabinLen, glassMat, 0, baseY + lowerH / 2 + (st.cabinH + 0.18) / 2 - 0.04, cabZ); grp.add(cab);
      const roof = box(W * 0.94, 0.09, st.cabinLen * 0.9, bodyMat, 0, baseY + lowerH / 2 + st.cabinH + 0.16, cabZ); grp.add(roof);
      const deck = box(W * 0.95, 0.14, Math.max(0.4, L / 2 + cabZ - st.cabinLen / 2 - 0.1), bodyMat, 0, baseY + lowerH / 2 + 0.02, cabZ - st.cabinLen / 2 - Math.max(0.4, L / 2 + cabZ - st.cabinLen / 2 - 0.1) / 2 + 0.1); grp.add(deck);
    }
    if (spec.id === 'kei') {
      const cab = box(W * 0.96, st.cabinH + 0.3, L * 0.72, glassMat, 0, baseY + 0.55, -0.1); grp.add(cab);
      grp.add(box(W, 0.09, L * 0.76, bodyMat, 0, baseY + 0.55 + st.cabinH + 0.32, -0.1));
    }
    if (spec.id === 'kaze' || spec.id === 'hero-gtr') {
      grp.add(box(W * 0.5, 0.16, 0.5, darkMat, 0, baseY + 0.42, L / 2 - 0.28)); // grille panel
      for (const sx of [-0.4, 0.4]) grp.add(box(0.42, 0.07, 0.3, darkMat, sx, baseY + 0.62, L / 2 - st.hoodLen * 0.4));
      for (const sz of [-L * 0.3]) for (const sx of [-1, 1]) {
        const flare = box(0.14, 0.34, 1.1, bodyMat, sx * (W / 2 + 0.05), wr + 0.28, sz); grp.add(flare);
      }
    }
    // Bumpers
    grp.add(box(W * 0.98, 0.24, 0.22, spec.id === 'hachi' ? darkMat : bodyMat, 0, wr + 0.18, L / 2 + 0.05));
    grp.add(box(W * 0.98, 0.24, 0.22, spec.id === 'hachi' ? darkMat : bodyMat, 0, wr + 0.18, -L / 2 - 0.05));
  }
  // Headlights (front = +z)
  if (st.popups) {
    grp.userData.popups = [];
    for (const sx of [-W * 0.3, W * 0.3]) {
      const p = box(0.44, 0.16, 0.4, bodyMat, sx, baseY + 0.42, L / 2 - 0.25, -0.4); grp.add(p); grp.userData.popups.push(p);
      const lens = box(0.4, 0.13, 0.05, headMat, sx, baseY + 0.5, L / 2 - 0.06, -0.4); grp.add(lens);
    }
  } else if (!isTruck) {
    const slim = spec.id === 'sora15';
    for (const sx of [-W * 0.32, W * 0.32]) grp.add(box(slim ? 0.52 : 0.44, slim ? 0.1 : 0.16, 0.07, headMat, sx, baseY + 0.3, L / 2 + 0.12));
  } else {
    for (const sx of [-W * 0.32, W * 0.32]) grp.add(box(0.46, 0.2, 0.07, headMat, sx, wr + 0.8, L / 2 + 0.06));
  }
  // Taillights (rear = -z)
  const tailY = baseY + 0.32, tailZ = -L / 2 - 0.12;
  if (st.quadTail) {
    for (const sx of [-W * 0.3, -W * 0.13, W * 0.13, W * 0.3]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), tailMat);
      t.rotation.x = Math.PI / 2; t.position.set(sx, tailY, tailZ); grp.add(t);
    }
    grp.add(box(W * 0.9, 0.2, 0.06, darkMat, 0, tailY, tailZ + 0.01));
  } else if (st.roundTail) {
    for (const sx of [-W * 0.28, W * 0.28]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 14), tailMat);
      t.rotation.x = Math.PI / 2; t.position.set(sx, tailY, tailZ); grp.add(t);
    }
  } else if (!isTruck) {
    grp.add(box(W * 0.82, 0.13, 0.06, tailMat, 0, tailY, tailZ));
  } else {
    for (const sx of [-W * 0.35, W * 0.35]) grp.add(box(0.3, 0.16, 0.06, tailMat, sx, wr + 0.5, -L / 2 - 0.06));
  }
  // Wings
  const wingY = baseY + H * 0.5 + st.cabinH + 0.1, wingZ = -L / 2 + 0.25;
  if (st.wing === 'small') {
    for (const sx of [-W * 0.3, W * 0.3]) grp.add(box(0.08, 0.22, 0.08, darkMat, sx, wingY - 0.1, wingZ));
    grp.add(box(W * 0.82, 0.07, 0.36, bodyMat, 0, wingY, wingZ));
  } else if (st.wing === 'big') {
    for (const sx of [-W * 0.34, W * 0.34]) grp.add(box(0.09, 0.42, 0.09, darkMat, sx, wingY - 0.12, wingZ));
    grp.add(box(W * 1.02, 0.08, 0.44, darkMat, 0, wingY + 0.1, wingZ));
  } else if (st.wing === 'ducktail') {
    grp.add(box(W * 0.9, 0.09, 0.4, bodyMat, 0, tailY + 0.22, -L / 2 + 0.12, -0.5));
  } else if (st.wing === 'curved') {
    const topY = wingY + 0.28;
    for (const sx of [-W * 0.3, W * 0.3]) {
      grp.add(box(0.09, 0.3, 0.09, darkMat, sx, wingY + 0.02, wingZ + 0.08, 0.25));
      grp.add(box(0.09, 0.3, 0.09, darkMat, sx, wingY + 0.22, wingZ - 0.08, 0.25));
    }
    grp.add(box(W * 0.62, 0.07, 0.4, darkMat, 0, topY, wingZ));
    grp.add(box(W * 0.22, 0.07, 0.36, darkMat, -W * 0.42, topY - 0.05, wingZ, 0)); grp.children[grp.children.length - 1].rotation.z = 0.18;
    grp.add(box(W * 0.22, 0.07, 0.36, darkMat, W * 0.42, topY - 0.05, wingZ, 0)); grp.children[grp.children.length - 1].rotation.z = -0.18;
  }
  // Liveries
  const liv = st.livery || spec.livery;
  if (liv === 'panda' || spec.id === 'hachi') {
    const bandMat = new THREE.MeshPhongMaterial({ color: 0xf4f4f4, shininess: 60 });
    grp.add(box(W + 0.03, H * 0.2, L + 0.03, bandMat, 0, baseY + 0.08, 0));
  }
  if (liv === 'taxi' || spec.id === 'taxi') {
    const sign = box(0.7, 0.28, 0.36, new THREE.MeshBasicMaterial({ color: 0xffd23f }), 0, baseY + H * 0.5 + st.cabinH + 0.32, -st.cabinBack); grp.add(sign);
  }
  if (liv === 'police' || spec.cls === 'police') {
    const doorTex = textTex('RBPD', '#ffffff', '#101828');
    for (const sx of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), new THREE.MeshBasicMaterial({ map: doorTex }));
      door.position.set(sx * (W / 2 + 0.02), baseY + 0.1, -st.cabinBack); door.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; grp.add(door);
      grp.add(box(0.03, H * 0.34, L * 0.55, new THREE.MeshPhongMaterial({ color: 0xffffff }), sx * (W / 2 + 0.005), baseY + 0.1, -st.cabinBack));
    }
    grp.add(box(W * 0.92, 0.07, st.cabinLen * 0.9, new THREE.MeshPhongMaterial({ color: 0xffffff }), 0, baseY + H * 0.5 + st.cabinH + (st.tail === 'suv' ? 0.34 : 0.2), -st.cabinBack));
    // Lightbar
    const lb = new THREE.Group();
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x2255ff });
    const rHalf = box(0.55, 0.18, 0.4, redMat, -0.3, 0, 0); const bHalf = box(0.55, 0.18, 0.4, blueMat, 0.3, 0, 0);
    lb.add(rHalf); lb.add(bHalf);
    lb.position.set(0, baseY + H * 0.5 + st.cabinH + (st.tail === 'suv' ? 0.48 : 0.34), -st.cabinBack);
    grp.add(lb);
    const gR = glowSprite(0xff2222, 3.2); gR.position.copy(lb.position).x -= 0.3; grp.add(gR);
    const gB = glowSprite(0x2255ff, 3.2); gB.position.copy(lb.position).x += 0.3; grp.add(gB);
    grp.userData.lightbar = lb; grp.userData.lightMats = [redMat, blueMat]; grp.userData.lightGlows = [gR, gB];
    grp.userData.lightGlowR = gR; grp.userData.lightGlowB = gB;
  }
  if (liv === 'hero-supra' || spec.id === 'hero-supra') {
    const gtex = (() => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d'); g.fillStyle = '#ff6a00'; g.fillRect(0, 0, 512, 128);
      g.fillStyle = '#19b34a'; g.beginPath(); g.moveTo(0, 96); g.bezierCurveTo(150, 20, 300, 120, 512, 40); g.lineTo(512, 80); g.bezierCurveTo(300, 150, 150, 60, 0, 122); g.fill();
      g.fillStyle = '#d8dee8'; g.fillRect(0, 108, 512, 10);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.72, 0.62), new THREE.MeshBasicMaterial({ map: gtex }));
      p.position.set(sx * (W / 2 + 0.02), baseY + 0.05, -0.1); p.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; grp.add(p);
    }
  }
  if (liv === 'hero-gtr' || spec.id === 'hero-gtr') {
    grp.add(box(0.34, 0.04, L * 0.9, chromeMat, -0.24, baseY + H * 0.5 + 0.32, 0));
    grp.add(box(0.34, 0.04, L * 0.9, chromeMat, 0.24, baseY + H * 0.5 + 0.32, 0));
    grp.add(box(0.3, 0.04, st.cabinLen * 0.85, chromeMat, -0.22, baseY + H * 0.5 + st.cabinH + 0.26, -st.cabinBack));
    grp.add(box(0.3, 0.04, st.cabinLen * 0.85, chromeMat, 0.22, baseY + H * 0.5 + st.cabinH + 0.26, -st.cabinBack));
  }
  // Wheels: pivot (steer) -> spin group -> tyre + hub
  const wheels = [], wheelSpin = [];
  const tyreMat = new THREE.MeshPhongMaterial({ color: 0x15161a, shininess: 10 });
  const hubMat = new THREE.MeshPhongMaterial({ color: 0xc8ccd4, shininess: 140 });
  const wheelZ = isTruck ? [L * 0.34, -L * 0.28, -L * 0.42] : [L * 0.33, -L * 0.33];
  for (const wz of wheelZ) for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * (W / 2 - 0.05), wr, wz);
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.28, 16), tyreMat);
    tyre.rotation.z = Math.PI / 2; tyre.castShadow = true; spin.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, 0.3, 10), hubMat);
    hub.rotation.z = Math.PI / 2; spin.add(hub);
    pivot.add(spin); grp.add(pivot);
    pivot.userData.front = wz > 0 && !isTruck || (isTruck && wz === wheelZ[0]);
    pivot.userData.spin = spin;
    wheels.push(pivot); wheelSpin.push(spin);
  }
  grp.userData.wheels = wheels; grp.userData.wheelSpin = wheelSpin;
  // Driver figure (simple seated)
  if (opts.driver) {
    const cast = CAST.find(c => c.id === opts.driver) || null;
    const shirt = cast ? cast.shirt : pick([0xff7a1a, 0x3a6ea8, 0xff2e88, 0x37c978, 0xffc93c]);
    const skin = cast ? cast.skin : 0xe0aa7e;
    const fig = new THREE.Group();
    const torso = box(0.46, 0.55, 0.28, new THREE.MeshPhongMaterial({ color: shirt }), 0, 0.62, 0); fig.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), new THREE.MeshPhongMaterial({ color: skin }));
    head.position.set(0, 1.05, 0.02); fig.add(head);
    const seatZ = st.tail === 'roadster' ? -st.cabinBack - 0.1 : -st.cabinBack + 0.25;
    fig.position.set(-W * 0.18, baseY + H * 0.32, seatZ);
    grp.add(fig);
  }
  // Underglow
  const glowColor = opts.glowColor || (liv === 'police' ? 0x2255ff : (spec.cls === 'coupe' ? 0x00f5d4 : 0xff2e88));
  if (opts.glow) {
    const ug = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.1, L + 1.1),
      new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    ug.rotation.x = -Math.PI / 2; ug.position.y = 0.12; grp.add(ug);
    const gs = glowSprite(glowColor, Math.max(W, L) * 1.15); gs.position.y = 0.35; gs.material.opacity = 0.35; grp.add(gs);
    grp.userData.glowSprite = gs;
  }
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return grp;
}

export function spawnVehicle(G, specId, x, z, angle, opts = {}) {
  const spec = typeof specId === 'object' ? specId : specById(specId);
  let color = opts.color;
  if (color === undefined) {
    if (spec.id === 'hero-supra') color = 0xff6a00;
    else if (spec.id === 'hero-gtr') color = 0x2456c8;
    else if (spec.id === 'taxi') color = 0xffc61a;
    else if (spec.cls === 'police') color = 0x101216;
    else color = pick(TRAFFIC_COLORS);
  }
  const isClub = ['hachi', 'sora15', 'hoshi7', 'taiyo', 'kaze', 'hero-supra', 'hero-gtr'].includes(spec.id);
  const mesh = makeCarMesh(spec, color, {
    driver: opts.driver && opts.driver !== 'traffic' && opts.driver !== 'parked' ? opts.driver : (opts.driverVisual || null),
    glow: opts.glow !== undefined ? opts.glow : isClub,
    glowColor: opts.glowColor, cargoColor: opts.cargoColor
  });
  const gy = groundH(x, z);
  mesh.position.set(x, gy, z); mesh.rotation.y = angle || 0;
  G.scene.add(mesh);
  const v = {
    id: opts.id || ('v' + (G.vehicles.length + 1) + '-' + spec.id), specId: spec.id, spec, mesh,
    angle: angle || 0, speed: 0, steer: 0, health: spec.health, maxHealth: spec.health,
    driver: opts.driver || 'parked', color, wheelsPopped: false, dead: false,
    vx: 0, vz: 0, roadAxis: opts.roadAxis || null, roadLine: opts.roadLine !== undefined ? opts.roadLine : null,
    dir: opts.dir || 1, smokeAcc: 0, lights: !!opts.lights, lightT: rr(0, 1), cargoColor: opts.cargoColor
  };
  if (v.driver === 'traffic' && !v.roadAxis) {
    // Snap to nearest road line
    const nearX = G.roadX.reduce((b, c) => Math.abs(c - x) < Math.abs(b - x) ? c : b, G.roadX[0]);
    const nearZ = G.roadZ.reduce((b, c) => Math.abs(c - z) < Math.abs(b - z) ? c : b, G.roadZ[0]);
    if (Math.abs(nearX - x) <= Math.abs(nearZ - z)) { v.roadAxis = 'z'; v.roadLine = nearX; mesh.position.x = nearX; }
    else { v.roadAxis = 'x'; v.roadLine = nearZ; mesh.position.z = nearZ; }
    v.dir = chance(0.5) ? 1 : -1;
    v.angle = v.roadAxis === 'z' ? (v.dir > 0 ? 0 : Math.PI) : (v.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    mesh.rotation.y = v.angle;
    v.speed = rr(10, 16);
  }
  if (v.driver === 'cop') v.lights = true;
  mesh.userData.vehicle = v;
  G.vehicles.push(v);
  return v;
}

export function spawnTraffic(G, count) {
  const specs = ['sedan', 'suv', 'taxi', 'kei', 'hatch', 'roadster', 'sedan', 'suv', 'hatch'];
  for (let i = 0; i < count; i++) {
    const alongZ = chance(0.5);
    const line = pick(alongZ ? G.roadX : G.roadZ);
    const pos = rr(-620, 620);
    const x = alongZ ? line : pos, z = alongZ ? pos : line;
    if (Math.hypot(x - (-420), z - 380) < 60) continue;
    spawnVehicle(G, pick(specs), x, z, 0, { driver: 'traffic' });
  }
  const parkedSpecs = ['sedan', 'suv', 'kei', 'hatch', 'roadster', 'hachi', 'sora15', 'hoshi7', 'sedan', 'hatch'];
  for (let i = 0; i < 48; i++) {
    const alongZ = chance(0.5);
    const line = pick(alongZ ? G.roadX : G.roadZ);
    const side = chance(0.5) ? 1 : -1;
    const pos = rr(-630, 630);
    const off = side * (CFG_ROAD_HALF + 2.2);
    const x = alongZ ? line + off : pos, z = alongZ ? pos : line + off;
    if (x < -650 || x > 650 || z < -650 || z > 650) continue;
    const ang = alongZ ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    spawnVehicle(G, pick(parkedSpecs), x, z, ang, { driver: 'parked', glow: false });
  }
}
const CFG_ROAD_HALF = 15;

function flashPolice(v, dt) {
  const u = v.mesh.userData;
  if (!u.lightMats) return;
  v.lightT += dt * 6;
  const phase = Math.floor(v.lightT) % 2 === 0;
  u.lightMats[0].color.setHex(phase ? 0xff2222 : 0x661111);
  u.lightMats[1].color.setHex(phase ? 0x112266 : 0x2255ff);
  if (u.lightGlows) { u.lightGlows[0].visible = phase; u.lightGlows[1].visible = !phase; }
}

export function updateTraffic(G, dt) {
  const focus = G.car && G.mode === 'car' ? G.car.mesh.position : (G.player ? G.player.mesh.position : null);
  for (const v of G.vehicles) {
    if ((v.lights || v.driver === 'cop') && v.spec.cls === 'police') flashPolice(v, dt);
    if (v.driver !== 'traffic') continue;
    if (v.dead) { v.speed = 0; continue; }
    let target = 16;
    // Red light check
    const fx = Math.sin(v.angle), fz = Math.cos(v.angle);
    for (const tl of G.trafficLights) {
      const dx = tl.x - v.mesh.position.x, dz = tl.z - v.mesh.position.z;
      const ahead = dx * fx + dz * fz, dist = Math.hypot(dx, dz);
      if (ahead > 2 && ahead < 16 && dist < 20) {
        const nsGreen = tl.phase === 0;
        const myGreen = v.roadAxis === 'z' ? nsGreen : !nsGreen;
        if (!myGreen) target = 0;
      }
    }
    // Car ahead
    for (const o of G.vehicles) {
      if (o === v) continue;
      const dx = o.mesh.position.x - v.mesh.position.x, dz = o.mesh.position.z - v.mesh.position.z;
      const ahead = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 9 && lat < 2.2) target = Math.min(target, Math.max(0, (ahead - 5) * 3));
    }
    v.speed += Math.sign(target - v.speed) * Math.min(Math.abs(target - v.speed), 14 * dt);
    let nx = v.mesh.position.x + fx * v.speed * dt;
    let nz = v.mesh.position.z + fz * v.speed * dt;
    // Turn at world edge
    if (nx > 645 || nx < -645 || nz > 645 || nz < -645) {
      if (v.roadAxis === 'z') {
        v.roadAxis = 'x'; v.roadLine = G.roadZ.reduce((b, c) => Math.abs(c - nz) < Math.abs(b - nz) ? c : b, G.roadZ[0]);
        nz = v.roadLine; v.dir = chance(0.5) ? 1 : -1; v.angle = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        nx = Math.max(-640, Math.min(640, nx));
      } else {
        v.roadAxis = 'z'; v.roadLine = G.roadX.reduce((b, c) => Math.abs(c - nx) < Math.abs(b - nx) ? c : b, G.roadX[0]);
        nx = v.roadLine; v.dir = chance(0.5) ? 1 : -1; v.angle = v.dir > 0 ? 0 : Math.PI;
        nz = Math.max(-640, Math.min(640, nz));
      }
    }
    if (v.roadAxis === 'z') nx = v.roadLine; else nz = v.roadLine;
    v.mesh.position.set(nx, groundH(nx, nz), nz);
    v.mesh.rotation.y = v.angle;
    v.vx = fx * v.speed; v.vz = fz * v.speed;
    for (const spin of (v.mesh.userData.wheelSpin || [])) spin.rotation.x += (v.speed * dt) / (v.spec.style.wheelR || 0.36);
    // Recycle far traffic
    if (focus && v.mesh.position.distanceTo(focus) > 700) {
      const line = pick(G.roadX); const pos = focus.z + (chance(0.5) ? -1 : 1) * rr(220, 300);
      v.roadAxis = 'z'; v.roadLine = line;
      v.mesh.position.set(line, groundH(line, pos), Math.max(-640, Math.min(640, pos)));
    }
    if (v.health < v.maxHealth * 0.5 && !v.dead) { v.smokeAcc += dt; if (v.smokeAcc > 0.25) { v.smokeAcc = 0; spawnSmokeAt(G, v.mesh.position, 1, v.health < v.maxHealth * 0.25); } }
  }
  updateSmoke(G, dt);
}

export function damageVehicle(G, v, amt) {
  if (!v || v.dead) return;
  v.health -= amt;
  spawnSmokeAt(G, v.mesh.position, amt > 8 ? 3 : 1, v.health < v.maxHealth * 0.3);
  if (v.health <= 0) {
    v.dead = true; v.speed = 0;
    if (v.mesh.userData.bodyMat) v.mesh.userData.bodyMat.color.setHex(0x1c1c20);
    spawnSmokeAt(G, v.mesh.position, 10, true);
  }
}

// ---- Smoke / fire pool ----
export function spawnSmokeAt(G, pos, n, fire) {
  if (!G._smokePool) G._smokePool = [];
  for (let i = 0; i < (n || 1); i++) {
    let s = G._smokePool.find(p => !p.visible);
    if (!s) {
      if (G._smokePool.length > 220) return;
      s = glowSprite(0x999999, 2); G.scene.add(s); G._smokePool.push(s);
      s.userData = { life: 0, max: 1, vx: 0, vy: 0, vz: 0 };
    }
    s.visible = true;
    s.material = s.material.clone();
    s.material.color = new THREE.Color(fire ? 0xff7a22 : 0x8a8f98);
    s.material.opacity = fire ? 0.9 : 0.55;
    s.position.set(pos.x + rr(-0.7, 0.7), (pos.y || 0) + rr(0.6, 1.4), pos.z + rr(-0.7, 0.7));
    const sc = fire ? rr(1, 1.8) : rr(1.4, 2.6); s.scale.set(sc, sc, 1);
    s.userData.life = 0; s.userData.max = rr(0.7, 1.4);
    s.userData.vx = rr(-0.4, 0.4); s.userData.vy = rr(1.6, 3); s.userData.vz = rr(-0.4, 0.4);
    s.userData.fire = !!fire; s.userData.baseScale = sc;
  }
}
export function updateSmoke(G, dt) {
  if (!G._smokePool) return;
  for (const s of G._smokePool) {
    if (!s.visible) continue;
    s.userData.life += dt;
    const f = s.userData.life / s.userData.max;
    if (f >= 1) { s.visible = false; continue; }
    s.position.x += s.userData.vx * dt; s.position.y += s.userData.vy * dt; s.position.z += s.userData.vz * dt;
    const sc = s.userData.baseScale * (1 + f * 1.6); s.scale.set(sc, sc, 1);
    s.material.opacity = (s.userData.fire ? 0.9 : 0.55) * (1 - f);
  }
}
