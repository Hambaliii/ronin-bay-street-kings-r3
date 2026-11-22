// peds.js — pedestrians with real variety, named cast, loiterers.
// RONIN BAY: STREET KINGS — session 2 systems.
import { CAST, CFG, DISTRICTS } from './config.js';
import { groundH } from './world.js';
import { spawnVehicle } from './cars.js';
import { makeFigure, animateFigure } from './player.js';
import { rr, ri, pick, chance } from './random.js';

const SKINS = [0xf0c09a, 0xe8b08a, 0xd9a075, 0xc98e62, 0xb87f52, 0x8a5a34];
const HAIRS = [0x0e0e12, 0x1a1a1a, 0x3a2318, 0x6a4526, 0xbbbbbb, 0x8a2f2f];
const SHIRTS = [0xff2e88, 0x00f5d4, 0xffe95a, 0xff8c42, 0x7b2fff, 0x35d461,
  0x3a86ff, 0xff3860, 0xf15bb5, 0x00bbf9, 0xffd60a, 0x2ec4b6, 0xef476f, 0x06d6a0];
const PANTS = [0x23232e, 0x2e4057, 0x3d2b1f, 0x1f3a5f, 0x4a4a55, 0x5c374c,
  0x264653, 0x6b705c, 0x22223b, 0x7f5539];
const HAT_COLORS = [0xff2e88, 0xffe95a, 0x00f5d4, 0xff8c42, 0xffffff, 0x3a86ff, 0xef476f];

let lastShirt = -1;

function randomPedParams(forceShirt) {
  let shirt = forceShirt !== undefined ? forceShirt : pick(SHIRTS);
  if (forceShirt === undefined) {
    let guard = 0;
    while (shirt === lastShirt && guard++ < 8) shirt = pick(SHIRTS);
  }
  lastShirt = shirt;
  const outfitRoll = Math.random();
  const outfit = outfitRoll < 0.2 ? 'dress'
    : pick(['tee', 'tee', 'jacket', 'hoodie', 'overalls']);
  return {
    shirt,
    pants: pick(PANTS),
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairStyle: pick(['short', 'short', 'long', 'bald']),
    hat: chance(0.3) ? 'cap' : 'none',
    hatColor: pick(HAT_COLORS),
    height: rr(0.9, 1.08),
    build: rr(0.8, 1.3),
    outfit,
    accessory: chance(0.2) ? 'pack' : (chance(0.18) ? 'shades' : 'none'),
  };
}

function castParams(c) {
  return {
    shirt: c.shirt, pants: c.pants, skin: c.skin, hat: c.hat,
    hatColor: c.hatColor, hair: c.hair, height: c.height, build: c.build,
    outfit: c.outfit, hairStyle: c.hairStyle, accessory: 'none',
  };
}

export function initPeds(G) {
  if (!Array.isArray(G.peds)) G.peds = [];
  if (!Array.isArray(G.npcs)) G.npcs = [];
  const roadHalf = (CFG.roadW || 30) / 2;
  const sideOff = roadHalf + 3.5;
  const loiterers = [];

  function placeFigure(fig, x, z, angle) {
    fig.position.set(x, groundH(x, z), z);
    if (angle !== undefined) fig.rotation.y = angle;
    G.scene.add(fig);
    return fig;
  }

  // ---------- 64 wandering pedestrians ----------
  const linesX = (G.roadX && G.roadX.length) ? G.roadX : [0];
  const linesZ = (G.roadZ && G.roadZ.length) ? G.roadZ : [0];
  for (let i = 0; i < 64; i++) {
    const params = randomPedParams();
    const mesh = makeFigure(params);
    const alongX = chance(0.5);
    const axis = alongX ? 'x' : 'z';
    const line = alongX ? pick(linesZ) : pick(linesX);
    const off = (chance(0.5) ? 1 : -1) * sideOff;
    const along = rr(-640, 640);
    const x = alongX ? along : line + off;
    const z = alongX ? line + off : along;
    placeFigure(mesh, x, z, 0);
    G.peds.push({
      mesh, axis, line, off,
      dir: chance(0.5) ? 1 : -1,
      speed: rr(2.2, 3.4),
      phase: rr(0, Math.PI * 2),
      animT: rr(0, 10),
      fleeT: 0, fleeX: 0, fleeZ: 0,
      turnCool: rr(2, 8),
    });
  }

  // ---------- named cast ----------
  function placeCast(id, x, z, angle) {
    const c = CAST.find(e => e.id === id);
    if (!c) return null;
    const mesh = makeFigure(castParams(c));
    placeFigure(mesh, x, z, angle);
    const rec = { id: c.id, name: c.name, mesh };
    G.npcs.push(rec);
    return rec;
  }

  const meet = (G.spots && G.spots.meet) || { x: -420, z: 380 };
  const garage = (G.spots && G.spots.garage) || { x: -420, z: 398 };
  // Chief Ako + Mika at the HQ meet lot, facing into it.
  placeCast('ako', meet.x - 3, meet.z - 4, Math.PI * 0.85);
  placeCast('mika', meet.x + 3.5, meet.z - 3, Math.PI * 1.1);
  // Jun the mechanic at the garage, next to a parked car.
  placeCast('jun', garage.x + 3, garage.z + 1, -Math.PI / 2);
  spawnVehicle(G, 'hatch', garage.x - 4, garage.z + 3, 0.4, { driver: 'parked', color: 0x8a8f98 });

  // 10 club members hanging around the meet lot in small groups.
  const groupOffsets = [
    [-9, 4], [-7, 6], [-8, 2.5], [8, 5], [10, 3.5], [9, 7],
    [-2, 10], [1, 11], [5, 9], [-5, -8],
  ];
  groupOffsets.forEach(([ox, oz], i) => {
    const force = i < 3 ? pick([0xff2e88, 0xff5da2, 0xff2e88]) : undefined;
    const mesh = makeFigure(randomPedParams(force));
    const ang = Math.atan2(meet.x - (meet.x + ox), meet.z - (meet.z + oz)) + rr(-0.5, 0.5);
    placeFigure(mesh, meet.x + ox, meet.z + oz, ang);
    loiterers.push({ mesh, phase: rr(0, 10), idle: true });
  });

  // Ryo + Dante — rival hangout on the Neon Mile avenue (z = -330 road edge).
  placeCast('ryo', 196, -318, Math.PI);
  placeCast('dante', 206, -318.5, Math.PI * 0.9);
  spawnVehicle(G, 'sora15', 192, -313, Math.PI / 2, { driver: 'parked', color: 0x6a1fb0 });
  spawnVehicle(G, 'sora15', 210, -313, Math.PI / 2, { driver: 'parked', color: 0x6a1fb0 });

  // ---------- storefront loiterers (beach + neon) ----------
  const beach = DISTRICTS.find(d => d.id === 'beach');
  const neon = DISTRICTS.find(d => d.id === 'neon');
  const zones = [beach, neon].filter(Boolean);
  for (let i = 0; i < 8 && zones.length; i++) {
    const d = zones[i % zones.length];
    const x = rr(d.x0 + 14, d.x1 - 14);
    const z = rr(d.z0 + 14, d.z1 - 14);
    const mesh = makeFigure(randomPedParams());
    placeFigure(mesh, x, z, rr(0, Math.PI * 2));
    loiterers.push({
      mesh, phase: rr(0, 10), idle: chance(0.5),
      wander: chance(0.5), wx: x, wz: z, homeX: x, homeZ: z,
      speed: rr(0.5, 0.9), wt: rr(0, 6),
    });
  }

  // ---------- updater ----------
  let elapsed = 0;
  G.updaters.push((GG, dt) => {
    elapsed += dt;
    const carPos = (GG.mode === 'car' && GG.car && GG.car.mesh) ? GG.car.mesh.position : null;
    const carSpeed = GG.car ? Math.abs(GG.car.speed || 0) : 0;

    for (const ped of GG.peds) {
      const m = ped.mesh.position;
      // Flee from a fast-approaching player car.
      if (ped.fleeT <= 0 && carPos && carSpeed > 15) {
        const dx = m.x - carPos.x, dz = m.z - carPos.z;
        if (dx * dx + dz * dz < 49) {
          // Run perpendicular to the car's heading.
          const ca = GG.car.angle || 0;
          const side = chance(0.5) ? 1 : -1;
          ped.fleeX = Math.cos(ca) * side;
          ped.fleeZ = -Math.sin(ca) * side;
          // Bias away from the car as well.
          const d = Math.hypot(dx, dz) || 1;
          ped.fleeX += (dx / d) * 0.5; ped.fleeZ += (dz / d) * 0.5;
          const fm = Math.hypot(ped.fleeX, ped.fleeZ) || 1;
          ped.fleeX /= fm; ped.fleeZ /= fm;
          ped.fleeT = 2;
        }
      }
      let moveSpeed = ped.speed;
      if (ped.fleeT > 0) {
        ped.fleeT -= dt;
        m.x += ped.fleeX * 7 * dt;
        m.z += ped.fleeZ * 7 * dt;
        moveSpeed = 7;
        ped.mesh.rotation.y = Math.atan2(ped.fleeX, ped.fleeZ);
      } else {
        if (ped.axis === 'x') m.x += ped.dir * ped.speed * dt;
        else m.z += ped.dir * ped.speed * dt;
        // Wrap: turn around at the map edge.
        const along = ped.axis === 'x' ? m.x : m.z;
        if (along > 650) { ped.dir = -1; if (ped.axis === 'x') m.x = 650; else m.z = 650; }
        if (along < -650) { ped.dir = 1; if (ped.axis === 'x') m.x = -650; else m.z = -650; }
        // Sometimes turn onto a crossing road at intersections.
        ped.turnCool -= dt;
        if (ped.turnCool <= 0) {
          const crossLines = ped.axis === 'x' ? GG.roadX : GG.roadZ;
          const alongNow = ped.axis === 'x' ? m.x : m.z;
          if (crossLines) {
            for (const cl of crossLines) {
              if (Math.abs(alongNow - cl) < 1.2 && chance(0.35)) {
                // Pivot onto the crossing road's sidewalk.
                if (ped.axis === 'x') { m.x = cl + ped.off; ped.axis = 'z'; }
                else { m.z = cl + ped.off; ped.axis = 'x'; }
                ped.line = cl;
                break;
              }
            }
          }
          ped.turnCool = rr(1.5, 5);
        }
        // Heading: forward along axis/dir; on a sidewalk the facing follows motion.
        const vx = ped.axis === 'x' ? ped.dir : 0;
        const vz = ped.axis === 'z' ? ped.dir : 0;
        ped.mesh.rotation.y = Math.atan2(vx, vz);
      }
      m.y = groundH(m.x, m.z);
      ped.animT += dt * (moveSpeed / 2.6);
      animateFigure(ped.mesh, ped.animT + ped.phase, moveSpeed);
    }

    // Cast + loiterers: gentle idle sway; wanderers drift around home.
    for (const l of loiterers) {
      if (l.wander) {
        l.wt -= dt;
        if (l.wt <= 0) {
          l.wt = rr(3, 7);
          l.wx = l.homeX + rr(-7, 7);
          l.wz = l.homeZ + rr(-7, 7);
        }
        const m = l.mesh.position;
        const dx = l.wx - m.x, dz = l.wz - m.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.4) {
          m.x += (dx / d) * l.speed * dt;
          m.z += (dz / d) * l.speed * dt;
          l.mesh.rotation.y = Math.atan2(dx, dz);
          m.y = groundH(m.x, m.z);
          animateFigure(l.mesh, elapsed * 1.6 + l.phase, l.speed);
        } else {
          animateFigure(l.mesh, elapsed + l.phase, 0);
        }
      } else {
        animateFigure(l.mesh, elapsed + l.phase, 0);
      }
    }
    // Named cast idle.
    for (const n of GG.npcs) {
      animateFigure(n.mesh, elapsed * 0.9 + n.mesh.position.x * 0.05, 0);
    }
  });
}
