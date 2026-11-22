// missions.js — mission engine, territory war, club activities, dynamic events.
// RONIN BAY: STREET KINGS — session 2 systems.
import * as THREE from 'three';
import { DISTRICTS, MISSIONS, TOUGE_POINTS, CLUB_RANKS, CAST } from './config.js';
import { groundH, glowSprite, roadRoute } from './world.js';
import { spawnVehicle, damageVehicle } from './cars.js';
import { rr, ri, pick, chance } from './random.js';

const START_SPOTS = {
  m1: { x: -420, z: 380 }, m2: { x: 330, z: 495 }, m3: { x: -495, z: 165 },
  m4: { x: -620, z: -40 }, m5: { x: -330, z: 330 }, m6: { x: -495, z: 495 },
  m7: { x: -620, z: -40 }, m8: { x: 165, z: -165 }, m9: { x: 330, z: -330 },
  m10: { x: -420, z: 380 }, m11: { x: -165, z: 495 }, m12: { x: 495, z: -495 },
};
const GIVER_COLORS = { Mika: 0xff2e88, Jun: 0x3a6ea8, Ako: 0x181818, Ryo: 0x6a1fb0, Dante: 0xb02020 };
const DISTRICT_DEFAULTS = {
  port: { control: 60, owner: 'ronin' },
  beach: { control: 20, owner: 'neutral' },
  neon: { control: 20, owner: 'vanta' },
  hill: { control: 10, owner: 'neutral' },
};
const RACE_CARS = { m9: 'sora15', m10: 'taiyo', m12: 'kaze' };

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

export function initMissions(G) {
  // ---- districts: fill defaults only for missing keys (save may have run) ----
  if (!G.districts || typeof G.districts !== 'object') G.districts = {};
  for (const d of DISTRICTS) {
    if (!G.districts[d.id]) {
      const def = DISTRICT_DEFAULTS[d.id] || { control: 0, owner: 'neutral' };
      G.districts[d.id] = { control: def.control, owner: def.owner };
    }
  }
  if (!G.flags) G.flags = {};
  if (!Array.isArray(G.owned)) G.owned = ['hachi'];

  // ---- marker pillar ----
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xffd23f, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 26, 18, 1, true), markerMat);
  marker.visible = false;
  const markerGlow = glowSprite(0xffd23f, 10);
  markerGlow.visible = false;
  G.scene.add(marker); G.scene.add(markerGlow);

  const S = {
    active: null,        // mission / activity in progress
    event: null,         // dynamic event in progress
    gpsT: 0,
    incomeT: 0,
    pressureT: 0,
    eventT: 55,          // first dynamic event a little after start
    activityCool: {},    // id -> seconds remaining
    markerPulse: 0,
  };

  function playerPos() {
    if (G.mode === 'car' && G.car && G.car.mesh) return G.car.mesh.position;
    if (G.player && G.player.mesh) return G.player.mesh.position;
    return { x: 0, z: 0 };
  }

  function setTarget(x, z) {
    G.missionMarker = { x, z };
    marker.visible = true; markerGlow.visible = true;
    marker.position.set(x, groundH(x, z) + 13, z);
    markerGlow.position.set(x, groundH(x, z) + 1.2, z);
    refreshGPS();
  }
  function clearTarget() {
    G.missionMarker = null;
    G.gpsRoute = null;
    marker.visible = false; markerGlow.visible = false;
  }
  function refreshGPS() {
    if (!G.missionMarker) return;
    try {
      const p = playerPos();
      G.gpsRoute = roadRoute(G, { x: p.x, z: p.z }, G.missionMarker);
    } catch (e) { G.gpsRoute = null; }
  }

  function districtAt(x, z) {
    for (const d of DISTRICTS) {
      if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.id;
    }
    return null;
  }
  function districtForMission(def, spot) {
    if (def.params && def.params.district && G.districts[def.params.district]) return def.params.district;
    return districtAt(spot.x, spot.z) || 'port';
  }
  function addControl(id, amt) {
    const d = id && G.districts[id];
    if (!d) return;
    d.control = Math.max(0, Math.min(100, d.control + amt));
    if (d.control >= 70) d.owner = 'ronin';
    else if (d.owner === 'ronin' && d.control < 40) d.owner = 'neutral';
  }

  function checkRank() {
    let idx = 0;
    for (let i = 0; i < CLUB_RANKS.length; i++) {
      if (G.rep >= CLUB_RANKS[i].rep) idx = i;
    }
    if (idx > (G.rankIdx || 0)) {
      G.rankIdx = idx;
      if (G.banner) G.banner('RANK UP — ' + CLUB_RANKS[idx].name, 'New cars unlocked at the garage');
      if (G.toast) G.toast('Rank up: ' + CLUB_RANKS[idx].name + ' — check the garage');
    } else G.rankIdx = idx;
  }

  function giverColor(def) {
    if (GIVER_COLORS[def.giver] !== undefined) return GIVER_COLORS[def.giver];
    const c = CAST.find(e => e.name === def.giver);
    return c ? c.shirt : 0xffd23f;
  }

  function briefStart(def) {
    const lines = String(def.brief || '').split('\n');
    if (G.showBriefing) G.showBriefing(def.giver, lines[0] || def.title, giverColor(def));
    if (G.banner) G.banner(def.title, def.giver);
  }

  // ---------- generic AI driving for mission vehicles ----------
  function driveAI(v, tx, tz, cruise, dt) {
    if (!v || v.dead || !v.mesh) return;
    const m = v.mesh.position;
    const dx = tx - m.x, dz = tz - m.z;
    const d = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    const diff = wrapAngle(desired - v.angle);
    const maxTurn = 2.2 * dt;
    v.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
    v.steer = Math.max(-1, Math.min(1, diff));
    let target = cruise;
    if (Math.abs(diff) > 1.0) target *= 0.45;
    if (d < 6) target *= 0.5;
    const accel = (v.spec && v.spec.accel) || 13;
    if (v.speed < target) v.speed = Math.min(target, v.speed + accel * dt);
    else v.speed = Math.max(target, v.speed - accel * 1.7 * dt);
    m.x += Math.sin(v.angle) * v.speed * dt;
    m.z += Math.cos(v.angle) * v.speed * dt;
    m.x = Math.max(-655, Math.min(655, m.x));
    m.z = Math.max(-655, Math.min(655, m.z));
    m.y = groundH(m.x, m.z);
    v.mesh.rotation.y = v.angle;
  }

  function removeAIVehicle(v) {
    if (!v) return;
    if (v.mesh && v.mesh.parent) v.mesh.parent.remove(v.mesh);
    else if (v.mesh) G.scene.remove(v.mesh);
    let i = G.vehicles.indexOf(v); if (i >= 0) G.vehicles.splice(i, 1);
  }

  function roadPointIn(districtId) {
    const d = DISTRICTS.find(e => e.id === districtId);
    const xs = G.roadX || [0], zs = G.roadZ || [0];
    const inX = xs.filter(v => !d || (v >= d.x0 && v <= d.x1));
    const inZ = zs.filter(v => !d || (v >= d.z0 && v <= d.z1));
    return { x: pick(inX.length ? inX : xs), z: pick(inZ.length ? inZ : zs) };
  }

  function cleanupActive() {
    const a = S.active;
    if (!a) return;
    if (a.aiCar) removeAIVehicle(a.aiCar);
    if (a.aiCars) for (const v of a.aiCars) removeAIVehicle(v);
    if (a.waves) for (const v of a.waves) removeAIVehicle(v);
    S.active = null;
    clearTarget();
  }

  // ---------- rewards / completion ----------
  function completeMission() {
    const a = S.active; if (!a) return;
    const def = a.def;
    const lines = String(def.brief || '').split('\n');
    if (a.isActivity) {
      G.rep = (G.rep || 0) + 30;
      G.money = (G.money || 0) + 100;
      if (G.banner) G.banner('ACTIVITY COMPLETE', def.title);
      S.activityCool[a.activityId] = 60;
    } else if (a.isEvent) {
      // events complete through their own path; not used here
    } else {
      const idx = G.missionIndex || 0;
      let money = 200 + idx * 150;
      if (def.type === 'pinkslip' || def.type === 'race') money *= 2;
      if (a.bonusMoney) money += a.bonusMoney;
      const rep = 60 + idx * 25;
      G.money = (G.money || 0) + money;
      G.rep = (G.rep || 0) + rep;
      if (def.type === 'pinkslip' || def.type === 'race') {
        const winCar = (def.params && def.params.winCar) || RACE_CARS[def.id];
        if (winCar && !G.owned.includes(winCar)) {
          G.owned.push(winCar);
          const specName = winCar;
          if (G.toast) G.toast('Won: ' + specName);
        }
      }
      addControl(a.district, 15 + (a.bonusControl || 0));
      if (G.banner) G.banner('MISSION COMPLETE', def.title + '  +$' + money + '  +' + rep + ' REP');
      if (lines[1] && G.showBriefing) G.showBriefing(def.giver, lines[1], giverColor(def));
      G.missionIndex = idx + 1;
    }
    checkRank();
    cleanupActive();
    if (G.saveGame) G.saveGame();
    G.objectiveText = 'Free roam — visit a glowing marker';
  }

  function failMission(reason) {
    const a = S.active; if (!a) return;
    if (G.toast) G.toast(reason || 'Mission failed — try again');
    if (a.isActivity) S.activityCool[a.activityId] = 20;
    cleanupActive();
    G.objectiveText = 'Free roam — visit a glowing marker';
  }

  // ---------- mission setup per type ----------
  function startMission(def, opts) {
    opts = opts || {};
    const spot = START_SPOTS[def.id] || { x: -420, z: 380 };
    const a = {
      def, phase: 'run', isActivity: !!opts.isActivity, isEvent: false,
      activityId: opts.activityId || null,
      district: districtForMission(def, spot),
      timer: 0, idx: 0, checkpoints: [], aiCar: null, aiCars: [], waves: [],
      waveT: 0, boxedT: 0, startHealth: null, startHP: G.playerHP,
      aiIdx: 0, graceT: 1.2,
    };
    S.active = a;
    briefStart(def);
    const P = def.params || {};
    const p = playerPos();

    switch (def.type) {
      case 'meet': {
        const t = (G.spots && G.spots.meet) || spot;
        a.target = { x: t.x, z: t.z };
        setTarget(t.x, t.z);
        G.objectiveText = def.title + ': reach the meet point';
        break;
      }
      case 'sprint': {
        const n = opts.checkpoints || 4;
        for (let i = 0; i < n; i++) a.checkpoints.push(roadPointIn(a.district));
        a.timer = P.time || 120;
        a.target = a.checkpoints[0];
        setTarget(a.target.x, a.target.z);
        G.objectiveText = def.title + ': checkpoint 1/' + n;
        break;
      }
      case 'delivery': {
        let dest = roadPointIn(a.district);
        let guard = 0;
        while (dist2(dest.x, dest.z, p.x, p.z) < 260 && guard++ < 12) dest = roadPointIn(a.district);
        a.target = dest;
        a.timer = P.time || 180;
        if (G.car) a.startHealth = G.car.health;
        setTarget(dest.x, dest.z);
        G.objectiveText = def.title + ': deliver the car — keep it clean';
        break;
      }
      case 'drift': {
        a.target = { x: spot.x, z: spot.z };
        a.need = P.score || 600;
        G.driftScore = 0;
        setTarget(spot.x, spot.z);
        G.objectiveText = def.title + ': drift in the zone — ' + a.need + ' pts';
        break;
      }
      case 'disable': {
        const wp = roadPointIn('port');
        a.aiCar = spawnVehicle(G, 'sora15', wp.x, wp.z, rr(0, 6.28), { driver: 'rival', color: 0x6a1fb0 });
        a.waypoints = [];
        for (let i = 0; i < 5; i++) a.waypoints.push(roadPointIn('port'));
        a.wpIdx = 0;
        a.target = { x: wp.x, z: wp.z };
        setTarget(wp.x, wp.z);
        if (G.flags) G.flags.crime = true;
        G.objectiveText = def.title + ': disable the rival car';
        break;
      }
      case 'jack': {
        const wp = roadPointIn('port');
        a.aiCar = spawnVehicle(G, 'truck', wp.x, wp.z, rr(0, 6.28), { driver: 'rival', color: 0x37414f });
        a.aiCars = [
          spawnVehicle(G, 'sedan', wp.x + 8, wp.z + 6, 0, { driver: 'rival', color: 0x22242c }),
          spawnVehicle(G, 'sedan', wp.x - 8, wp.z - 6, 0, { driver: 'rival', color: 0x22242c }),
        ].filter(Boolean);
        a.waypoints = [];
        for (let i = 0; i < 5; i++) a.waypoints.push(roadPointIn('port'));
        a.wpIdx = 0;
        a.bonusMoney = 800;
        a.target = { x: wp.x, z: wp.z };
        setTarget(wp.x, wp.z);
        if (G.flags) G.flags.crime = true;
        G.objectiveText = def.title + ': stop the truck';
        break;
      }
      case 'timetrial': {
        a.checkpoints = TOUGE_POINTS.map(([x, z]) => ({ x, z }));
        a.timer = P.time || 300;
        a.target = a.checkpoints[0];
        setTarget(a.target.x, a.target.z);
        G.objectiveText = def.title + ': touge point 1/' + a.checkpoints.length;
        break;
      }
      case 'hold': {
        a.target = { x: spot.x, z: spot.z };
        a.timer = P.time || 60;
        a.waveT = 6;
        setTarget(spot.x, spot.z);
        G.objectiveText = def.title + ': hold the zone';
        break;
      }
      case 'pinkslip':
      case 'race': {
        const carId = RACE_CARS[def.id] || P.rivalCar || 'sora15';
        const startPt = { x: spot.x, z: spot.z };
        a.aiCar = spawnVehicle(G, carId, startPt.x + 6, startPt.z + 4, 0, { driver: 'rival', color: 0x6a1fb0 });
        a.checkpoints = [];
        for (let i = 0; i < 4; i++) a.checkpoints.push(roadPointIn(a.district));
        const fin = roadPointIn(a.district);
        a.checkpoints.push(fin);
        a.aiIdx = 0;
        a.target = a.checkpoints[0];
        setTarget(a.target.x, a.target.z);
        G.objectiveText = def.title + ': beat ' + def.giver + ' — checkpoint 1/5';
        break;
      }
      default: {
        a.target = { x: spot.x, z: spot.z };
        setTarget(spot.x, spot.z);
        G.objectiveText = def.title;
      }
    }
  }

  // ---------- club activities ----------
  const ACTIVITIES = [
    { id: 'act-sprint', title: 'Club Sprint — Beach', type: 'sprint', x: 330, z: 495, params: { time: 90 }, checkpoints: 4 },
    { id: 'act-drift', title: 'Club Drift — Neon', type: 'drift', x: 330, z: -330, params: { score: 500 } },
    { id: 'act-touge', title: 'Club Touge — Hill', type: 'timetrial', x: -620, z: -40, params: { time: 300 } },
  ];

  // ---------- dynamic events ----------
  function startEvent() {
    const kind = pick(['convoy', 'race', 'robbery']);
    const p = playerPos();
    if (kind === 'convoy') {
      const wp = roadPointIn('port');
      const truck = spawnVehicle(G, 'truck', wp.x, wp.z, rr(0, 6.28), { driver: 'rival', color: 0x4a3b12 });
      const escorts = [
        spawnVehicle(G, 'sedan', wp.x + 8, wp.z, 0, { driver: 'rival', color: 0x22242c }),
        spawnVehicle(G, 'sedan', wp.x - 8, wp.z, 0, { driver: 'rival', color: 0x22242c }),
      ].filter(Boolean);
      S.event = { kind, truck, escorts, t: 120, waypoints: [], wpIdx: 0 };
      for (let i = 0; i < 5; i++) S.event.waypoints.push(roadPointIn('port'));
      setTarget(wp.x, wp.z);
      if (G.banner) G.banner('MONEY CONVOY', 'Disable the truck — $600');
      if (G.toast) G.toast('Event: money convoy spotted');
      G.objectiveText = 'Event: disable the convoy truck';
    } else if (kind === 'robbery') {
      const wp = roadPointIn('neon');
      const van = spawnVehicle(G, 'suv', wp.x, wp.z, rr(0, 6.28), { driver: 'rival', color: 0x14151a });
      S.event = { kind, van, t: 120 };
      setTarget(wp.x, wp.z);
      if (G.banner) G.banner('ROBBERY VAN', 'Disable the fleeing van — $450');
      if (G.toast) G.toast('Event: robbery van fleeing');
      G.objectiveText = 'Event: disable the robbery van';
    } else {
      const start = roadPointIn('beach');
      const fin = roadPointIn('beach');
      const rival = spawnVehicle(G, 'hachi', start.x + 5, start.z + 3, 0, { driver: 'rival', color: 0xb02020 });
      S.event = { kind, rival, fin, t: 120, started: false };
      setTarget(start.x, start.z);
      if (G.banner) G.banner('STREET RACE', 'Beat the rival — $300 +20 REP');
      if (G.toast) G.toast('Event: street race challenge');
      G.objectiveText = 'Event: reach the rival to start the race';
      void p;
    }
  }

  function endEvent(reward, msg) {
    const ev = S.event; if (!ev) return;
    if (ev.truck) removeAIVehicle(ev.truck);
    if (ev.van) removeAIVehicle(ev.van);
    if (ev.rival) removeAIVehicle(ev.rival);
    if (ev.escorts) for (const v of ev.escorts) removeAIVehicle(v);
    S.event = null;
    if (!S.active) { clearTarget(); G.objectiveText = 'Free roam — visit a glowing marker'; }
    if (reward) {
      if (reward.money) G.money = (G.money || 0) + reward.money;
      if (reward.rep) G.rep = (G.rep || 0) + reward.rep;
      if (G.banner) G.banner('EVENT COMPLETE', msg || '');
      checkRank();
      if (G.saveGame) G.saveGame();
    } else if (msg && G.toast) G.toast(msg);
    S.eventT = 100;
  }

  // ---------- per-type runtime ----------
  function runActive(dt) {
    const a = S.active;
    const p = playerPos();
    const def = a.def;
    if (a.graceT > 0) a.graceT -= dt;

    switch (def.type) {
      case 'meet': {
        if (a.graceT <= 0 && dist2(p.x, p.z, a.target.x, a.target.z) < 8) completeMission();
        break;
      }
      case 'sprint':
      case 'timetrial': {
        a.timer -= dt;
        if (a.timer <= 0) { failMission(def.title + ': out of time'); return; }
        const t = a.checkpoints[a.idx];
        if (t && dist2(p.x, p.z, t.x, t.z) < 14) {
          a.idx++;
          if (a.idx >= a.checkpoints.length) { completeMission(); return; }
          a.target = a.checkpoints[a.idx];
          setTarget(a.target.x, a.target.z);
        }
        G.objectiveText = def.title + ': checkpoint ' + (a.idx + 1) + '/' + a.checkpoints.length +
          ' — ' + Math.ceil(a.timer) + 's';
        break;
      }
      case 'delivery': {
        a.timer -= dt;
        if (a.timer <= 0) { failMission(def.title + ': too slow'); return; }
        if (G.car && a.startHealth !== null && a.startHealth !== undefined) {
          const maxH = (G.car.spec && G.car.spec.health) || 100;
          if ((a.startHealth - G.car.health) > maxH * 0.4) { failMission(def.title + ': car wrecked'); return; }
        }
        if (dist2(p.x, p.z, a.target.x, a.target.z) < 12) completeMission();
        else G.objectiveText = def.title + ': deliver — ' + Math.ceil(a.timer) + 's';
        break;
      }
      case 'drift': {
        const inside = dist2(p.x, p.z, a.target.x, a.target.z) < 40;
        G.objectiveText = def.title + ': drift ' + Math.floor(G.driftScore || 0) + '/' + a.need +
          (inside ? '' : ' — get to the zone');
        if ((G.driftScore || 0) >= a.need) completeMission();
        break;
      }
      case 'disable': {
        const v = a.aiCar;
        if (!v || v.dead || (v.health !== undefined && v.health <= 0)) { completeMission(); return; }
        const vm = v.mesh.position;
        // Waypoint loop; flee from the player when hurt.
        const lowHp = v.spec && v.health < v.spec.health * 0.3;
        if (lowHp) {
          driveAI(v, vm.x + (vm.x - p.x), vm.z + (vm.z - p.z), (v.spec.topSpeed || 45) * 0.95, dt);
        } else {
          const wp = a.waypoints[a.wpIdx];
          if (dist2(vm.x, vm.z, wp.x, wp.z) < 16) a.wpIdx = (a.wpIdx + 1) % a.waypoints.length;
          driveAI(v, wp.x, wp.z, (v.spec.topSpeed || 45) * 0.62, dt);
        }
        a.target = { x: vm.x, z: vm.z };
        G.missionMarker = a.target;
        marker.position.set(vm.x, groundH(vm.x, vm.z) + 13, vm.z);
        markerGlow.position.set(vm.x, groundH(vm.x, vm.z) + 1.2, vm.z);
        G.objectiveText = def.title + ': ram the rival — hull ' +
          Math.max(0, Math.ceil(100 * v.health / ((v.spec && v.spec.health) || 100))) + '%';
        break;
      }
      case 'jack': {
        const truck = a.aiCar;
        if (a.phase === 'run') {
          if (!truck) { failMission(def.title + ': truck lost'); return; }
          const tm = truck.mesh.position;
          const maxH = (truck.spec && truck.spec.health) || 200;
          const hurt = truck.health <= maxH * 0.3;
          const nearStopped = Math.abs(truck.speed || 0) < 0.6 && dist2(p.x, p.z, tm.x, tm.z) < 8;
          if (nearStopped) a.boxedT += dt; else a.boxedT = Math.max(0, a.boxedT - dt);
          if (truck.dead || hurt || a.boxedT >= 3) {
            a.phase = 'escape';
            for (const e of a.aiCars) removeAIVehicle(e);
            a.aiCars = [];
            if (truck.speed !== undefined) truck.speed = 0;
            G.wanted = 3;
            const hq = (G.spots && G.spots.hq) || { x: -420, z: 375 };
            a.target = { x: hq.x, z: hq.z };
            setTarget(hq.x, hq.z);
            if (G.toast) G.toast('Truck stopped! Lose the cops — get to HQ');
            G.objectiveText = def.title + ': escape to HQ';
          } else {
            const wp = a.waypoints[a.wpIdx];
            if (dist2(tm.x, tm.z, wp.x, wp.z) < 18) a.wpIdx = (a.wpIdx + 1) % a.waypoints.length;
            driveAI(truck, wp.x, wp.z, (truck.spec.topSpeed || 38) * 0.7, dt);
            a.aiCars.forEach((e, i) => {
              if (e && !e.dead) driveAI(e, tm.x + (i ? 9 : -9), tm.z + (i ? -6 : 6), (e.spec.topSpeed || 45) * 0.7, dt);
            });
            a.target = { x: tm.x, z: tm.z };
            G.missionMarker = a.target;
            marker.position.set(tm.x, groundH(tm.x, tm.z) + 13, tm.z);
            markerGlow.position.set(tm.x, groundH(tm.x, tm.z) + 1.2, tm.z);
            G.objectiveText = def.title + ': stop the truck';
          }
        } else {
          if (dist2(p.x, p.z, a.target.x, a.target.z) < 12) completeMission();
        }
        break;
      }
      case 'hold': {
        const inside = dist2(p.x, p.z, a.target.x, a.target.z) < 35;
        if (inside) a.timer -= dt;
        // Waves of rivals.
        a.waveT -= dt;
        a.waves = a.waves.filter(v => v && !v.dead && v.health > 0);
        if (a.waveT <= 0 && a.waves.length < 3) {
          a.waveT = 15;
          const ang = rr(0, Math.PI * 2);
          const v = spawnVehicle(G, pick(['sedan', 'hatch', 'suv']),
            a.target.x + Math.sin(ang) * 70, a.target.z + Math.cos(ang) * 70,
            0, { driver: 'rival', color: 0x6a1fb0 });
          if (v) a.waves.push(v);
        }
        for (const v of a.waves) driveAI(v, p.x, p.z, (v.spec.topSpeed || 45) * 0.8, dt);
        G.objectiveText = def.title + ': hold ' + Math.ceil(Math.max(0, a.timer)) + 's' +
          (inside ? '' : ' — GET BACK IN THE ZONE');
        if (a.timer <= 0) { a.bonusControl = 25; completeMission(); }
        break;
      }
      case 'pinkslip':
      case 'race': {
        const v = a.aiCar;
        // Player progress.
        const t = a.checkpoints[a.idx];
        if (t && dist2(p.x, p.z, t.x, t.z) < 14) {
          a.idx++;
          if (a.idx >= a.checkpoints.length) { completeMission(); return; }
          a.target = a.checkpoints[a.idx];
          setTarget(a.target.x, a.target.z);
        }
        // AI progress.
        if (v && !v.dead) {
          const at = a.checkpoints[a.aiIdx];
          if (at) {
            driveAI(v, at.x, at.z, (v.spec.topSpeed || 50) * 0.85, dt);
            const vm = v.mesh.position;
            if (dist2(vm.x, vm.z, at.x, at.z) < 15) {
              a.aiIdx++;
              if (a.aiIdx >= a.checkpoints.length) { failMission(def.title + ': ' + def.giver + ' won'); return; }
            }
          }
        }
        G.objectiveText = def.title + ': checkpoint ' + (a.idx + 1) + '/5 — ' +
          def.giver + ' at ' + (a.aiIdx + 1) + '/5';
        break;
      }
      default: {
        if (a.target && dist2(p.x, p.z, a.target.x, a.target.z) < 10) completeMission();
      }
    }
  }

  // ---------- event runtime ----------
  function runEvent(dt) {
    const ev = S.event; if (!ev) return;
    const p = playerPos();
    ev.t -= dt;
    if (ev.t <= 0) { endEvent(null, 'Event expired'); return; }
    if (ev.kind === 'convoy') {
      const truck = ev.truck;
      if (!truck || truck.dead || truck.health <= 0) { endEvent({ money: 600 }, 'Convoy hit — +$600'); return; }
      const tm = truck.mesh.position;
      const wp = ev.waypoints[ev.wpIdx];
      if (dist2(tm.x, tm.z, wp.x, wp.z) < 18) ev.wpIdx = (ev.wpIdx + 1) % ev.waypoints.length;
      driveAI(truck, wp.x, wp.z, (truck.spec.topSpeed || 38) * 0.72, dt);
      ev.escorts.forEach((e, i) => {
        if (e && !e.dead) driveAI(e, tm.x + (i ? 9 : -9), tm.z + (i ? -6 : 6), (e.spec.topSpeed || 45) * 0.72, dt);
      });
      G.missionMarker = { x: tm.x, z: tm.z };
      marker.visible = true; markerGlow.visible = true;
      marker.position.set(tm.x, groundH(tm.x, tm.z) + 13, tm.z);
      markerGlow.position.set(tm.x, groundH(tm.x, tm.z) + 1.2, tm.z);
    } else if (ev.kind === 'robbery') {
      const van = ev.van;
      if (!van || van.dead || van.health <= 0) { endEvent({ money: 450 }, 'Van disabled — +$450'); return; }
      const vm = van.mesh.position;
      driveAI(van, vm.x + (vm.x - p.x) * 2, vm.z + (vm.z - p.z) * 2, (van.spec.topSpeed || 48) * 0.92, dt);
      G.missionMarker = { x: vm.x, z: vm.z };
      marker.visible = true; markerGlow.visible = true;
      marker.position.set(vm.x, groundH(vm.x, vm.z) + 13, vm.z);
      markerGlow.position.set(vm.x, groundH(vm.x, vm.z) + 1.2, vm.z);
    } else if (ev.kind === 'race') {
      const rival = ev.rival;
      if (!ev.started) {
        if (rival && dist2(p.x, p.z, rival.mesh.position.x, rival.mesh.position.z) < 10) {
          ev.started = true;
          setTarget(ev.fin.x, ev.fin.z);
          G.objectiveText = 'Event race: beat the rival to the finish';
          if (G.toast) G.toast('GO!');
        }
      } else if (rival && !rival.dead) {
        driveAI(rival, ev.fin.x, ev.fin.z, (rival.spec.topSpeed || 45) * 0.85, dt);
        const rm = rival.mesh.position;
        if (dist2(rm.x, rm.z, ev.fin.x, ev.fin.z) < 14) { endEvent(null, 'Event race lost'); return; }
        if (dist2(p.x, p.z, ev.fin.x, ev.fin.z) < 14) { endEvent({ money: 300, rep: 20 }, 'Race won — +$300 +20 REP'); return; }
      }
    }
  }

  // ---------- main updater ----------
  G.updaters.push((GG, dt) => {
    void GG;
    const p = playerPos();
    S.markerPulse += dt;

    // Marker idle motion.
    if (marker.visible) {
      marker.rotation.y += dt * 1.5;
      markerMat.opacity = 0.32 + Math.sin(S.markerPulse * 4) * 0.12;
    }

    // GPS refresh every 2s while a target is live.
    if (G.missionMarker && (S.active || S.event)) {
      S.gpsT -= dt;
      if (S.gpsT <= 0) { S.gpsT = 2; refreshGPS(); }
    }

    // Activity cooldowns tick down.
    for (const k of Object.keys(S.activityCool)) {
      if (S.activityCool[k] > 0) S.activityCool[k] -= dt;
    }

    if (S.active) { runActive(dt); return; }

    // Dynamic events run in free roam.
    if (S.event) runEvent(dt);
    else {
      S.eventT -= dt;
      if (S.eventT <= 0) { S.eventT = 100; startEvent(); }
    }

    // Next mission start marker.
    const def = MISSIONS[G.missionIndex || 0];
    if (def) {
      const spot = START_SPOTS[def.id] || { x: -420, z: 380 };
      if (!S.event) {
        setTargetThrottled(spot);
        G.objectiveText = 'Next: ' + def.title + ' — head to the gold marker';
      }
      if (dist2(p.x, p.z, spot.x, spot.z) < 6) {
        // Starting a mission supersedes any dynamic event marker.
        if (S.event) endEvent(null);
        startMission(def);
        return;
      }
    } else if (!S.event) {
      G.objectiveText = 'All missions complete — free roam';
      clearTarget();
    }

    // Club activities (only when no mission start was taken).
    if (!S.active) {
      for (const act of ACTIVITIES) {
        if ((S.activityCool[act.id] || 0) > 0) continue;
        // Don't fight the mission marker if it sits on the same spot.
        if (def) {
          const spot = START_SPOTS[def.id];
          if (spot && Math.abs(spot.x - act.x) < 4 && Math.abs(spot.z - act.z) < 4) continue;
        }
        if (dist2(p.x, p.z, act.x, act.z) < 6) {
          if (S.event) endEvent(null);
          const fakeDef = {
            id: act.id, title: act.title, giver: 'Mika', type: act.type,
            params: act.params, brief: act.title + '\nClub activity — rep and cash on the line.',
          };
          startMission(fakeDef, { isActivity: true, activityId: act.id, checkpoints: act.checkpoints });
          return;
        }
      }
    }

    // ---- territory income & pressure ----
    S.incomeT += dt;
    if (S.incomeT >= 30) {
      S.incomeT = 0;
      let pay = 0;
      for (const id of Object.keys(G.districts)) {
        if (G.districts[id].owner === 'ronin') pay += 25;
      }
      if (pay > 0) G.money = (G.money || 0) + pay;
    }
    S.pressureT += dt;
    if (S.pressureT >= 120) {
      S.pressureT = 0;
      const activeDistrict = S.active ? S.active.district : null;
      for (const id of Object.keys(G.districts)) {
        const d = G.districts[id];
        if (d.owner === 'vanta' && d.control > 0 && id !== activeDistrict) {
          d.control = Math.max(0, d.control - 5);
        }
      }
    }
  });

  // Throttled start-marker placement (avoid GPS rebuild every frame).
  let startMarkT = 0;
  function setTargetThrottled(spot) {
    startMarkT -= 1;
    if (!G.missionMarker || G.missionMarker.x !== spot.x || G.missionMarker.z !== spot.z) {
      setTarget(spot.x, spot.z);
    }
    void startMarkT;
  }

  // Expose helpers other systems may use.
  G.checkRank = checkRank;
  G.addDistrictControl = addControl;
}
