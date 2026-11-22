// player.js — procedural people with real silhouette variety + on-foot control.
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';

function mat(hex) { return new THREE.MeshPhongMaterial({ color: hex, shininess: 25 }); }
function darken(hex, f) { return new THREE.Color(hex).multiplyScalar(f).getHex(); }
function bx(w, h, d, m, x, y, z) {
  const ms = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  ms.position.set(x, y, z); ms.castShadow = true; return ms;
}

export function makeFigure(o) {
  const build = o.build || 1, H = o.height || 1;
  const shirt = mat(o.shirt), pants = mat(o.pants), skin = mat(o.skin);
  const grp = new THREE.Group();
  const body = new THREE.Group(); grp.add(body);
  const legs = [], arms = [];
  const isDress = o.outfit === 'dress';
  if (isDress) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * build, 0.34 * build, 0.8, 10), shirt);
    skirt.position.y = 0.82; skirt.castShadow = true; body.add(skirt);
    body.userData.skirt = skirt;
    for (const sx of [-0.1, 0.1]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * build, 0.48, 0);
      const leg = bx(0.13, 0.48, 0.15, skin, 0, -0.24, 0); pivot.add(leg); body.add(pivot); legs.push(pivot);
    }
  } else {
    for (const sx of [-0.11, 0.11]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * build, 0.92, 0);
      const leg = bx(0.15 * build, 0.92, 0.17, pants, 0, -0.46, 0); pivot.add(leg); body.add(pivot); legs.push(pivot);
    }
  }
  // Torso by outfit
  const torsoY = 1.28;
  if (o.outfit === 'jacket') {
    body.add(bx(0.52 * build, 0.68, 0.3 * build, shirt, 0, torsoY, 0));
    body.add(bx(0.58 * build, 0.6, 0.36 * build, mat(darken(o.shirt, 0.72)), 0, torsoY - 0.02, -0.02));
    body.add(bx(0.2, 0.5, 0.02, mat(0xf2f2f2), 0, torsoY, 0.19 * build));
  } else if (o.outfit === 'hoodie') {
    body.add(bx(0.54 * build, 0.66, 0.36 * build, shirt, 0, torsoY, 0));
    body.add(bx(0.3, 0.2, 0.14, shirt, 0, torsoY + 0.38, -0.2 * build)); // hood bump
    body.add(bx(0.34, 0.22, 0.03, mat(darken(o.shirt, 0.8)), 0, torsoY - 0.08, 0.19 * build)); // pocket
  } else if (o.outfit === 'overalls') {
    body.add(bx(0.52 * build, 0.68, 0.3 * build, shirt, 0, torsoY, 0));
    body.add(bx(0.44 * build, 0.44, 0.32 * build, pants, 0, torsoY - 0.1, 0.01)); // bib
  } else { // tee
    body.add(bx(0.5 * build, 0.66, 0.28 * build, shirt, 0, torsoY, 0));
  }
  // Arms: pivot at shoulder; tee gets skin forearms
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * (0.3 * build + 0.05), 1.56, 0);
    const upper = bx(0.13 * build, 0.4, 0.15, shirt, 0, -0.2, 0); pivot.add(upper);
    const fore = bx(0.11 * build, 0.34, 0.12, o.outfit === 'tee' ? skin : shirt, 0, -0.55, 0); pivot.add(fore);
    body.add(pivot); arms.push(pivot);
  }
  // Head + hair + hat
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), skin);
  head.position.y = 1.82; head.castShadow = true; body.add(head);
  const hairStyle = o.hairStyle || (o.hat === 'cap' ? 'short' : 'short');
  if (hairStyle !== 'bald' && o.hair !== undefined) {
    const hairMat = mat(o.hair);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.225, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    cap.position.y = 1.85; body.add(cap);
    if (hairStyle === 'long') body.add(bx(0.34, 0.55, 0.1, hairMat, 0, 1.5, -0.17));
  }
  if (o.hat === 'cap') {
    const hatMat = mat(o.hatColor || 0x181818);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hatMat);
    top.position.y = 1.86; body.add(top);
    body.add(bx(0.3, 0.04, 0.26, hatMat, 0, 1.88, 0.28)); // brim
  }
  if (o.accessory === 'pack') body.add(bx(0.4, 0.5, 0.2, mat(o.packColor || 0x5a6068), 0, 1.3, -0.28 * build));
  if (o.accessory === 'shades') body.add(bx(0.3, 0.07, 0.03, mat(0x0a0a0c), 0, 1.84, 0.2));
  grp.scale.set(1, H, 1);
  grp.userData.arms = arms; grp.userData.legs = legs; grp.userData.head = head; grp.userData.body = body;
  if (body.userData.skirt) grp.userData.skirt = body.userData.skirt;
  return grp;
}

export function animateFigure(fig, t, speed) {
  const u = fig.userData; if (!u.arms) return;
  const body = u.body || fig;
  if (speed > 0.1) {
    const sw = Math.sin(t * 10);
    if (u.skirt) { u.skirt.rotation.x = sw * 0.15; u.legs.forEach((l, i) => { l.rotation.x = sw * (i === 0 ? 0.35 : -0.35); }); }
    else u.legs.forEach((l, i) => { l.rotation.x = sw * (i === 0 ? 0.6 : -0.6); });
    u.arms.forEach((a, i) => { a.rotation.x = sw * (i === 0 ? -0.4 : 0.4); });
    body.position.y = Math.abs(Math.sin(t * 10)) * 0.06;
  } else {
    u.legs.forEach(l => { l.rotation.x *= 0.8; });
    u.arms.forEach(a => { a.rotation.x *= 0.8; });
    body.position.y = Math.sin(t * 2) * 0.015;
  }
}

export function createPlayer(G) {
  const ren = CAST.find(c => c.id === 'ren');
  const mesh = makeFigure(ren);
  const spot = (G.spots && G.spots.hq) || { x: -420, z: 375 };
  mesh.position.set(spot.x, groundH(spot.x, spot.z), spot.z);
  G.scene.add(mesh);
  G.player = { mesh, angle: 0, walkPhase: 0 };
  return G.player;
}

function collide(G, pos, r) {
  for (const c of G.colliders) {
    if (pos.x > c.x0 - r && pos.x < c.x1 + r && pos.z > c.z0 - r && pos.z < c.z1 + r) {
      const dxl = pos.x - (c.x0 - r), dxr = (c.x1 + r) - pos.x, dzl = pos.z - (c.z0 - r), dzr = (c.z1 + r) - pos.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) pos.x = c.x0 - r; else if (m === dxr) pos.x = c.x1 + r;
      else if (m === dzl) pos.z = c.z0 - r; else pos.z = c.z1 + r;
    }
  }
}

export function updatePlayer(G, dt) {
  const p = G.player; if (!p) return;
  const k = G.input.keys;
  const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
  const strafe = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
  const run = k['ShiftLeft'] || k['ShiftRight'];
  const speed = run ? 14 : 9;
  const cy = G.camYaw || 0;
  const fx = Math.sin(cy), fz = Math.cos(cy);
  const rx = Math.cos(cy), rz = -Math.sin(cy);
  let mx = fx * fwd + rx * strafe, mz = fz * fwd + rz * strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    p.mesh.position.x += mx * speed * dt;
    p.mesh.position.z += mz * speed * dt;
    p.angle = Math.atan2(mx, mz);
    p.walkPhase += dt * (speed / 9);
  }
  p.mesh.rotation.y = p.angle;
  collide(G, p.mesh.position, 0.45);
  p.mesh.position.x = Math.max(-655, Math.min(655, p.mesh.position.x));
  p.mesh.position.z = Math.max(-655, Math.min(655, p.mesh.position.z));
  p.mesh.position.y = groundH(p.mesh.position.x, p.mesh.position.z);
  animateFigure(p.mesh, p.walkPhase * (len > 0.01 ? 1 : 1) + performance.now() / 1000 * (len > 0.01 ? 0 : 1), len > 0.01 ? speed : 0);
  // Near car
  G.nearCar = null; let best = 4.5;
  for (const v of G.vehicles) {
    if (v.driver === 'traffic' || v.dead) continue;
    const d = v.mesh.position.distanceTo(p.mesh.position);
    if (d < best) { best = d; G.nearCar = v; }
  }
}
