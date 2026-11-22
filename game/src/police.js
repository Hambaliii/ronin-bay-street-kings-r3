// police.js — wanted system, cop AI, roadblocks, spike strips, helicopter.
// RONIN BAY: STREET KINGS — session 2 systems.
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH, glowSprite } from './world.js';
import { spawnVehicle } from './cars.js';
import { makeFigure } from './player.js';
import { rr, pick, chance } from './random.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function playerPos(G) {
  if (G.mode === 'car' && G.car && G.car.mesh) return G.car.mesh.position;
  if (G.player && G.player.mesh) return G.player.mesh.position;
  return null;
}

function playerSpeed(G) {
  if (G.mode === 'car' && G.car) return Math.abs(G.car.speed || 0);
  return 0;
}

function playerVel(G) {
  // Forward convention (session 1): forward = (sin θ, cos θ).
  if (G.mode === 'car' && G.car) {
    const s = G.car.speed || 0;
    return { x: Math.sin(G.car.angle) * s, z: Math.cos(G.car.angle) * s };
  }
  return { x: 0, z: 0 };
}

function nearestRoad(G, v, axis) {
  const lines = axis === 'x' ? G.roadX : G.roadZ;
  if (!lines || !lines.length) return v;
  let best = lines[0], bd = Infinity;
  for (const l of lines) { const d = Math.abs(l - v); if (d < bd) { bd = d; best = l; } }
  return best;
}

function removeVehicle(G, v) {
  if (!v) return;
  if (v.mesh && v.mesh.parent) v.mesh.parent.remove(v.mesh);
  else if (v.mesh) G.scene.remove(v.mesh);
  let i = G.vehicles.indexOf(v); if (i >= 0) G.vehicles.splice(i, 1);
  i = G.cops.indexOf(v); if (i >= 0) G.cops.splice(i, 1);
}

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#f5f5f5'; g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#ff7a1a';
  for (let x = -32; x < 160; x += 32) {
    g.beginPath();
    g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32);
    g.closePath(); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function initPolice(G) {
  if (!Array.isArray(G.cops)) G.cops = [];

  const S = {
    t: 0,                 // accumulated play time
    roadblockTimer: 18,   // first roadblock a little after wanted >= 3
    roadblock: null,      // { group stuff... }
    heli: null,
    noCopTime: 0,         // continuous seconds with no cop within 90
    decayAcc: 0,
    poppedUntil: -1,
    bustedTimer: null,
  };

  // ---------- spawning cops ----------
  function spawnCop() {
    const p = playerPos(G); if (!p) return;
    const wantSuv = G.wanted >= 3;
    const idx = G.cops.length;
    const spec = (wantSuv && idx % 2 === 1) ? 'police-suv' : 'police';
    // Spawn on a road 120–200 units away, biased out of the view centre.
    const ang = rr(0, Math.PI * 2);
    const dist = rr(120, 200);
    let x = p.x + Math.sin(ang) * dist;
    let z = p.z + Math.cos(ang) * dist;
    // Snap to the nearest road line on the axis with the bigger offset.
    if (Math.abs(Math.sin(ang)) > Math.abs(Math.cos(ang))) x = nearestRoad(G, x, 'x');
    else z = nearestRoad(G, z, 'z');
    x = Math.max(-650, Math.min(650, x));
    z = Math.max(-650, Math.min(650, z));
    const face = Math.atan2(p.x - x, p.z - z);
    const v = spawnVehicle(G, spec, x, z, face, { driver: 'cop' });
    if (v) G.cops.push(v);
  }

  // ---------- roadblocks ----------
  function clearRoadblock() {
    const rb = S.roadblock; if (!rb) return;
    for (const v of rb.vehicles) removeVehicle(G, v);
    for (const m of rb.meshes) { if (m.parent) m.parent.remove(m); else G.scene.remove(m); }
    for (const f of rb.figures) { if (f.parent) f.parent.remove(f); else G.scene.remove(f); }
    if (rb.spike) { if (rb.spike.mesh.parent) rb.spike.mesh.parent.remove(rb.spike.mesh); else G.scene.remove(rb.spike.mesh); }
    G.colliders = G.colliders.filter(c => c.tag !== 'roadblock');
    S.roadblock = null;
    S.roadblockTimer = 25;
  }

  function placeRoadblock() {
    const p = playerPos(G); if (!p) return;
    const pv = playerVel(G);
    let fx = 0, fz = 1;
    if (G.mode === 'car' && G.car) { fx = Math.sin(G.car.angle); fz = Math.cos(G.car.angle); }
    else if (Math.abs(pv.x) + Math.abs(pv.z) > 0.1) { const m = Math.hypot(pv.x, pv.z); fx = pv.x / m; fz = pv.z / m; }
    else if (G.player) { fx = Math.sin(G.player.angle || 0); fz = Math.cos(G.player.angle || 0); }
    let bx = p.x + fx * 85;
    let bz = p.z + fz * 85;
    // Snap the block onto a road line perpendicular to travel.
    let roadAngle; // direction of travel along the road
    if (Math.abs(fx) > Math.abs(fz)) { bz = nearestRoad(G, bz, 'z'); roadAngle = Math.PI / 2; }
    else { bx = nearestRoad(G, bx, 'x'); roadAngle = 0; }
    bx = Math.max(-640, Math.min(640, bx));
    bz = Math.max(-640, Math.min(640, bz));
    const y = groundH(bx, bz);
    // Perpendicular axis (across the road).
    const px = Math.cos(roadAngle), pz = -Math.sin(roadAngle);

    const vehicles = [], meshes = [], figures = [];
    const specs = ['police', 'police-suv', 'police'];
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 7.5;
      const cx = bx + px * off, cz = bz + pz * off;
      const v = spawnVehicle(G, specs[i], cx, cz, roadAngle + Math.PI / 2 + rr(-0.16, 0.16),
        { driver: 'parked', lights: true });
      if (v) vehicles.push(v);
    }

    // Striped barriers.
    const tex = stripeTexture();
    const bMat = new THREE.MeshLambertMaterial({ map: tex });
    const legMat = new THREE.MeshLambertMaterial({ color: 0x333338 });
    for (const off of [-11, 11]) {
      const cx = bx + px * off, cz = bz + pz * off;
      const grp = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.55, 0.18), bMat);
      bar.position.y = 0.95; grp.add(bar);
      for (const s of [-1.7, 1.7]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.95, 0.5), legMat);
        leg.position.set(s, 0.48, 0); grp.add(leg);
      }
      grp.position.set(cx, groundH(cx, cz), cz);
      grp.rotation.y = roadAngle;
      G.scene.add(grp);
      meshes.push(grp);
      const hw = 2.3, hd = 0.6;
      G.colliders.push({
        x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd,
        minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd,
        h: 1.2, tag: 'roadblock',
      });
    }

    // Two officers standing beside the line.
    const copCast = CAST.find(c => c.id === 'cop');
    if (copCast) {
      for (const off of [-5.5, 5.5]) {
        const fx2 = bx + px * off + fz * 3.5, fz2 = bz + pz * off + fx * 3.5;
        const fig = makeFigure({
          shirt: copCast.shirt, pants: copCast.pants, skin: copCast.skin,
          hat: copCast.hat, hatColor: copCast.hatColor, hair: copCast.hair,
          height: copCast.height, build: copCast.build, outfit: copCast.outfit,
          hairStyle: copCast.hairStyle,
        });
        fig.position.set(fx2, groundH(fx2, fz2), fz2);
        fig.rotation.y = Math.atan2(p.x - fx2, p.z - fz2);
        G.scene.add(fig);
        figures.push(fig);
      }
    }

    // Spike strip (wanted >= 4, 30% chance).
    let spike = null;
    if (G.wanted >= 4 && chance(0.3)) {
      spike = makeSpikeStrip(bx - px * 3.5, bz - pz * 3.5, roadAngle);
    }

    S.roadblock = { x: bx, z: bz, angle: roadAngle, vehicles, meshes, figures, spike };
    if (G.toast) G.toast('Roadblock ahead!');
  }

  function makeSpikeStrip(x, z, roadAngle) {
    const grp = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.06, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x1c1c20 }));
    base.position.y = 0.03; grp.add(base);
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.9, roughness: 0.25 });
    for (let i = 0; i < 11; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), toothMat);
      tooth.position.set(-2.7 + i * 0.54, 0.16, 0);
      grp.add(tooth);
    }
    // Warning sign at the end of the strip.
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.5, 0.06),
      new THREE.MeshLambertMaterial({ color: 0xd42424 }));
    sign.position.set(3.4, 0.55, 0); grp.add(sign);
    const signFace = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.35, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    signFace.position.set(3.4, 0.55, 0.045); grp.add(signFace);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.55, 0.07),
      new THREE.MeshLambertMaterial({ color: 0x44444a }));
    post.position.set(3.4, 0.27, 0); grp.add(post);
    grp.position.set(x, groundH(x, z), z);
    grp.rotation.y = roadAngle;
    G.scene.add(grp);
    return { x, z, angle: roadAngle, mesh: grp, hit: false };
  }

  // ---------- helicopter ----------
  function buildHeli() {
    const grp = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1d3f8f });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf2f4f8 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, 6.4), bodyMat);
    body.position.y = 0; grp.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 1.6), darkMat);
    nose.position.set(0, -0.2, 3.6); grp.add(nose);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.26, 0.5, 6.46), whiteMat);
    stripe.position.y = -0.55; grp.add(stripe);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 6.5), bodyMat);
    boom.position.set(0, 0.35, -6.2); grp.add(boom);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.8, 1.1), bodyMat);
    fin.position.set(0, 0.7, -9.3); grp.add(fin);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), darkMat);
    mast.position.y = 1.2; grp.add(mast);
    const rotor = new THREE.Group();
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0x22242c });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(13, 0.06, 0.55), bladeMat); rotor.add(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 13), bladeMat); rotor.add(b2);
    rotor.position.y = 1.5; grp.add(rotor);
    const tailRotor = new THREE.Group();
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 0.3), bladeMat); tailRotor.add(tb);
    tailRotor.position.set(0.25, 0.7, -9.3); grp.add(tailRotor);
    for (const s of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 5.4), darkMat);
      skid.position.set(s * 1.5, -1.5, 0.4); grp.add(skid);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), darkMat);
      strut.position.set(s * 1.5, -1.1, 1.2); grp.add(strut);
      const strut2 = strut.clone(); strut2.position.z = -0.6; grp.add(strut2);
    }
    // Searchlight: real spotlight + visible cone.
    const spot = new THREE.SpotLight(0xfff6d8, 2.2, 90, 0.32, 0.45, 0.6);
    spot.position.set(0, -0.8, 2.4);
    grp.add(spot);
    grp.add(spot.target);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.13,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(7.5, 30, 20, 1, true), coneMat);
    cone.position.set(0, -15.8, 2.4);
    grp.add(cone);
    const glow = glowSprite(0xfff2b0, 6);
    glow.position.set(0, -1, 2.4); grp.add(glow);
    G.scene.add(grp);
    return { mesh: grp, rotor, tailRotor, spot, spotTarget: spot.target, cone };
  }

  function clearHeli() {
    if (!S.heli) return;
    if (S.heli.mesh.parent) S.heli.mesh.parent.remove(S.heli.mesh);
    else G.scene.remove(S.heli.mesh);
    S.heli = null;
  }

  // ---------- busted ----------
  function doBusted() {
    G.wanted = 0;
    G.bust = 0;
    G.money = Math.max(0, (G.money || 0) - 150);
    const hq = (G.spots && G.spots.hq) || { x: -420, z: 375 };
    if (G.car && G.car.mesh) {
      G.car.mesh.position.set(hq.x + 4, groundH(hq.x + 4, hq.z + 6), hq.z + 6);
      G.car.angle = 0; G.car.speed = 0;
      G.car.mesh.rotation.y = 0;
    }
    if (G.player && G.player.mesh) {
      G.player.mesh.position.set(hq.x, groundH(hq.x, hq.z), hq.z);
    }
    clearRoadblock();
    const el = document.getElementById('bustedScreen');
    if (el) {
      el.classList.add('show');
      el.style.display = 'flex';
      if (S.bustedTimer) clearTimeout(S.bustedTimer);
      S.bustedTimer = setTimeout(() => {
        el.classList.remove('show');
        el.style.display = 'none';
      }, 2500);
    }
    if (G.toast) G.toast('Busted! $150 fine.');
    if (G.saveGame) G.saveGame();
  }

  // ---------- cop driving ----------
  function driveCop(G2, cop, dt) {
    const p = playerPos(G2); if (!p) return;
    const pv = playerVel(G2);
    const m = cop.mesh.position;
    // Intercept point slightly ahead of the player's motion.
    const tx = p.x + pv.x * 0.55, tz = p.z + pv.z * 0.55;
    const dx = tx - m.x, dz = tz - m.z;
    const dist = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    const diff = wrapAngle(desired - cop.angle);
    const maxTurn = 2.4 * dt;
    cop.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
    cop.steer = Math.max(-1, Math.min(1, diff));
    const top = (cop.spec && cop.spec.topSpeed) || 50;
    let cruise = top * (0.8 + G2.wanted * 0.06);
    if (dist < 9) cruise = Math.min(cruise, Math.max(2, playerSpeed(G2) * 0.9));
    if (Math.abs(diff) > 1.1) cruise *= 0.45; // slow for sharp turns
    const accel = (cop.spec && cop.spec.accel) || 14;
    if (cop.speed < cruise) cop.speed = Math.min(cruise, cop.speed + accel * dt);
    else cop.speed = Math.max(cruise, cop.speed - accel * 1.6 * dt);
    m.x += Math.sin(cop.angle) * cop.speed * dt;
    m.z += Math.cos(cop.angle) * cop.speed * dt;
    m.x = Math.max(-655, Math.min(655, m.x));
    m.z = Math.max(-655, Math.min(655, m.z));
    m.y = groundH(m.x, m.z);
    cop.mesh.rotation.y = cop.angle;
  }

  // ---------- main updater ----------
  G.updaters.push((GG, dt) => {
    if (!GG.flags) GG.flags = {};
    S.t += dt;
    const p = playerPos(GG);
    if (!p) return;

    // Crime flag → at least 1 star.
    if (GG.flags.crime) {
      if (GG.wanted < 1) GG.wanted = 1;
      GG.flags.crime = false;
    }
    GG.wanted = Math.max(0, Math.min(5, GG.wanted || 0));

    // --- cop population ---
    const desired = Math.min(5, Math.floor(GG.wanted));
    // Remove far cops / all cops at wanted 0.
    for (let i = GG.cops.length - 1; i >= 0; i--) {
      const c = GG.cops[i];
      const d = c.mesh ? Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z) : 9999;
      if (GG.wanted <= 0 || d > 400 || c.dead) removeVehicle(GG, c);
    }
    while (GG.cops.length < desired) {
      const before = GG.cops.length;
      spawnCop();
      if (GG.cops.length === before) break; // spawn failed; don't spin
    }
    for (const c of GG.cops) if (!c.dead) driveCop(GG, c, dt);

    // --- bust meter ---
    let nearestCop = Infinity;
    for (const c of GG.cops) {
      if (!c.mesh) continue;
      const d = Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z);
      if (d < nearestCop) nearestCop = d;
    }
    const bustRange = GG.mode === 'car' ? 6 : 5;
    if (nearestCop < bustRange && playerSpeed(GG) < 3) GG.bust = (GG.bust || 0) + dt;
    else GG.bust = Math.max(0, (GG.bust || 0) - dt * 0.6);
    if (GG.bust >= 3) { doBusted(); return; }

    // --- wanted decay ---
    if (nearestCop > 90 && GG.wanted > 0) {
      S.noCopTime += dt;
      if (S.noCopTime > 12) {
        S.decayAcc += dt;
        if (S.decayAcc >= 5) {
          S.decayAcc = 0;
          GG.wanted = Math.max(0, GG.wanted - 0.25);
        }
      }
    } else { S.noCopTime = 0; S.decayAcc = 0; }

    // --- roadblocks ---
    if (GG.wanted >= 3) {
      if (S.roadblock) {
        const d = Math.hypot(S.roadblock.x - p.x, S.roadblock.z - p.z);
        if (d > 250) clearRoadblock();
      } else {
        S.roadblockTimer -= dt;
        if (S.roadblockTimer <= 0) { placeRoadblock(); S.roadblockTimer = 25; }
      }
    } else if (S.roadblock) clearRoadblock();

    // --- spike strips ---
    const rb = S.roadblock;
    if (rb && rb.spike && !rb.spike.hit && GG.mode === 'car' && GG.car) {
      const sp = rb.spike;
      // Local frame of the strip: along = x-axis of the strip group.
      const lx = p.x - sp.x, lz = p.z - sp.z;
      const ca = Math.cos(-sp.angle), sa = Math.sin(-sp.angle);
      const along = lx * ca - lz * sa;
      const across = lx * sa + lz * ca;
      if (Math.abs(across) < 1.2 && Math.abs(along) < 3.2 && Math.abs(GG.car.speed || 0) > 2) {
        sp.hit = true;
        GG.car.wheelsPopped = true;
        S.poppedUntil = S.t + 20;
        if (GG.spawnSmoke) GG.spawnSmoke(GG.car.mesh.position, 14);
        if (GG.toast) GG.toast('Spikes! Tires shredded');
      }
    }
    if (S.poppedUntil > 0 && S.t >= S.poppedUntil) {
      if (GG.car) GG.car.wheelsPopped = false;
      S.poppedUntil = -1;
    }

    // --- helicopter ---
    if (GG.wanted >= 5) {
      if (!S.heli) S.heli = buildHeli();
      const h = S.heli;
      const targetX = p.x + 14, targetZ = p.z - 10;
      h.mesh.position.x += (targetX - h.mesh.position.x) * Math.min(1, dt * 1.4);
      h.mesh.position.z += (targetZ - h.mesh.position.z) * Math.min(1, dt * 1.4);
      h.mesh.position.y = groundH(h.mesh.position.x, h.mesh.position.z) + 30 + Math.sin(S.t * 0.9) * 0.8;
      h.mesh.rotation.y = Math.atan2(p.x - h.mesh.position.x, p.z - h.mesh.position.z);
      h.rotor.rotation.y += dt * 28;
      h.tailRotor.rotation.x += dt * 34;
      // Aim the spotlight at the player (target is a child of the heli group,
      // so convert: keep target directly under the nose in local space and
      // lean the cone toward the player via group tilt).
      h.spotTarget.position.set(
        (p.x - h.mesh.position.x) * 0.4, -30, 2.4 + (p.z - h.mesh.position.z) * 0.4);
    } else if (S.heli) clearHeli();
  });
}
