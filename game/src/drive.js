// drive.js — arcade driving: throttle, drift, NOS, collisions, near-miss.
import { groundH } from './world.js';
import { damageVehicle } from './cars.js';
import { rnd } from './random.js';

export function enterCar(G, v) {
  if (!v) return;
  G.car = v; v.driver = 'player'; G.mode = 'car';
  if (G.player) G.player.mesh.visible = false;
  G.toast('Driving: ' + v.spec.name);
}
export function exitCar(G) {
  const v = G.car; if (!v) return;
  v.driver = 'parked'; v.speed = 0; v.vx = 0; v.vz = 0;
  if (G.player) {
    const side = 2.4;
    const px = v.mesh.position.x + Math.cos(v.angle) * side;
    const pz = v.mesh.position.z - Math.sin(v.angle) * side;
    G.player.mesh.position.set(px, groundH(px, pz), pz);
    G.player.mesh.visible = true;
    G.player.angle = v.angle;
  }
  G.car = null; G.mode = 'foot'; G.speedKmh = 0;
}

export function updateDriving(G, dt) {
  const v = G.car; if (!v) return;
  const spec = v.spec, st = spec.style || {};
  const k = G.input.keys;
  const throttle = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
  const steerIn = (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
  const handbrake = !!k['Space'];
  const nos = (k['ShiftLeft'] || k['ShiftRight']) && v.speed > 4 && !v.wheelsPopped;
  const maxSpeed = spec.topSpeed * (v.wheelsPopped ? 0.4 : 1) * (nos ? 1.25 : 1);
  // Speed scalar along heading
  if (throttle > 0) v.speed += spec.accel * (nos ? 2.2 : 1) * dt;
  else if (throttle < 0) v.speed -= (v.speed > 0.5 ? spec.accel * 1.4 : spec.accel * 0.7) * dt;
  else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 6 * dt);
  // Rolling friction
  v.speed -= v.speed * 0.35 * dt;
  v.speed = Math.max(-12, Math.min(maxSpeed, v.speed));
  if (v.dead) v.speed = 0;
  // Steering
  const steerTarget = steerIn * 0.55;
  v.steer += (steerTarget - v.steer) * Math.min(1, dt * 8);
  const spdF = Math.min(1, Math.abs(v.speed) / 9);
  let yawRate = v.steer * 1.9 * spdF * Math.sign(v.speed || 1);
  if (handbrake) yawRate *= 1.45;
  if (v.wheelsPopped) yawRate += 0.12 * Math.sin(performance.now() / 300);
  v.angle += yawRate * dt;
  // Velocity: blend toward heading*speed; grip controls lateral retention
  const fx = Math.sin(v.angle), fz = Math.cos(v.angle);
  const gripBase = spec.grip;
  const latKeep = handbrake ? Math.max(0.02, gripBase - (spec.driftFactor || spec.drift || 0.4)) : gripBase;
  const fwdVel = v.vx * fx + v.vz * fz;
  let latX = v.vx - fx * fwdVel, latZ = v.vz - fz * fwdVel;
  const latDecay = Math.exp(-(handbrake ? 1.2 : 9 * latKeep) * dt);
  latX *= latDecay; latZ *= latDecay;
  v.vx = fx * v.speed + latX; v.vz = fz * v.speed + latZ;
  const slide = Math.hypot(latX, latZ);
  if (handbrake && slide > 3 && Math.abs(v.speed) > 10) G.driftScore += slide * dt * 10;
  const px = v.mesh.position.x, pz = v.mesh.position.z;
  let nx = px + v.vx * dt, nz = pz + v.vz * dt;
  nx = Math.max(-652, Math.min(652, nx)); nz = Math.max(-652, Math.min(652, nz));
  // Building collisions
  const hw = (st.width || 1.9) / 2 + 0.3, hl = (st.length || 4.5) / 2;
  for (const c of G.colliders) {
    if (nx > c.x0 - hw && nx < c.x1 + hw && nz > c.z0 - hw && nz < c.z1 + hw && (c.h || 10) > 1.2) {
      const impact = Math.abs(v.speed);
      if (impact > 7) { damageVehicle(G, v, impact * 0.7); if (G.hurtPlayer) G.hurtPlayer(impact * 0.25); }
      // Push out along smallest penetration (x or z)
      const dxl = nx - (c.x0 - hw), dxr = (c.x1 + hw) - nx, dzl = nz - (c.z0 - hw), dzr = (c.z1 + hw) - nz;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) nx = c.x0 - hw; else if (m === dxr) nx = c.x1 + hw;
      else if (m === dzl) nz = c.z0 - hw; else nz = c.z1 + hw;
      v.speed *= -0.25; v.vx *= -0.3; v.vz *= -0.3;
      if (G.spawnSmoke) G.spawnSmoke(v.mesh.position, 3);
    }
  }
  // Vehicle collisions
  for (const o of G.vehicles) {
    if (o === v) continue;
    const dx = o.mesh.position.x - nx, dz = o.mesh.position.z - nz;
    const d = Math.hypot(dx, dz), minD = 2.6 + ((o.spec.style && o.spec.style.length) || 4) * 0.22;
    if (d > 0.01 && d < minD) {
      const impact = Math.abs(v.speed);
      if (impact > 5) {
        damageVehicle(G, o, impact * 0.9); damageVehicle(G, v, impact * 0.35);
        if (o.driver === 'traffic') G.flags.crime = true;
        if (G.spawnSmoke) G.spawnSmoke(o.mesh.position, 4);
      }
      const push = (minD - d);
      nx -= (dx / d) * push * 0.6; nz -= (dz / d) * push * 0.6;
      o.mesh.position.x += (dx / d) * push * 0.3; o.mesh.position.z += (dz / d) * push * 0.3;
      v.speed *= 0.45; v.vx *= 0.5; v.vz *= 0.5;
    }
  }
  v.mesh.position.set(nx, groundH(nx, nz), nz);
  v.mesh.rotation.y = v.angle;
  // Wheels
  const wr = st.wheelR || 0.36;
  for (const pivot of (v.mesh.userData.wheels || [])) {
    if (pivot.userData.front) pivot.rotation.y = v.steer * 0.8;
    if (pivot.userData.spin) pivot.userData.spin.rotation.x += (v.speed * dt) / wr;
  }
  // NOS fx
  if (nos) {
    G.camKick = 1;
    if (rnd() < 0.7) {
      const ex = new (v.mesh.position.constructor)(nx - fx * hl, groundH(nx, nz) + 0.5, nz - fz * hl);
      if (G.spawnSmoke) G.spawnSmoke(ex, 1);
    }
  }
  // Near miss
  if (!G._nmCd) G._nmCd = {};
  const now = performance.now() / 1000;
  if (Math.abs(v.speed) > 25) {
    for (const o of G.vehicles) {
      if (o === v || o.driver !== 'traffic') continue;
      const d = o.mesh.position.distanceTo(v.mesh.position);
      if (d > 2.4 && d < 3.2 && (!G._nmCd[o.id] || now - G._nmCd[o.id] > 1.5)) {
        G._nmCd[o.id] = now; if (G.onNearMiss) G.onNearMiss();
      }
    }
  }
  G.speedKmh = Math.round(Math.abs(v.speed) * 3.2);
  void hl;
}
