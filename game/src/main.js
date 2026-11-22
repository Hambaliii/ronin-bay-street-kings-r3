// main.js — boot, game object, input, menu, main loop.
import * as THREE from 'three';
import { srand } from './random.js';
import { buildWorld, updateWorld, groundH } from './world.js';
import { spawnVehicle, spawnTraffic, updateTraffic, spawnSmokeAt } from './cars.js';
import { createPlayer, updatePlayer } from './player.js';
import { enterCar, exitCar, updateDriving } from './drive.js';
import { setupShot } from './shots.js';
import { initSave } from './save.js';
import { initHUD } from './hud.js';
import { initAudio } from './audio.js';
import { initPeds } from './peds.js';
import { initPolice } from './police.js';
import { initMissions } from './missions.js';

const params = new URLSearchParams(location.search);
const seedParam = parseInt(params.get('seed') || '1', 10);
const seed = Number.isFinite(seedParam) ? seedParam : 1;
srand(seed);
const shot = params.get('shot');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 3000);

const G = {
  scene, camera, renderer, mode: 'menu', player: null, car: null,
  vehicles: [], peds: [], cops: [], npcs: [], colliders: [], trafficLights: [],
  spots: {}, wanted: 0, bust: 0, money: 500, rep: 0, rankIdx: 0, districts: {},
  missionIndex: 0, flags: {}, timeOfDay: shot ? (shot === 'chase' ? 17.8 : 10.5) : 10.5,
  input: { keys: {}, mouse: { down: false, x: 0, y: 0 } },
  audio: null, shot, seed, updaters: [], roadX: [], roadZ: [],
  driftScore: 0, timeScale: 1, camYaw: 0, camKick: 0, muted: false, paused: false,
  slowmoT: 0, playerHP: 100, nearCar: null, speedKmh: 0, nightFactor: 0
};
window.__game = G;

// ---- Helpers on G ----
let toastTimer = 0, bannerTimer = 0;
G.toast = (msg) => {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
};
G.banner = (title, sub) => {
  const el = document.getElementById('banner');
  if (!el) return;
  el.querySelector('h1').textContent = title || '';
  el.querySelector('p').textContent = sub || '';
  el.style.opacity = '1';
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { el.style.opacity = '0'; }, 3400);
};
G.onNearMiss = () => { G.rep += 2; G.toast('Near miss! +2 REP'); };
G.spawnSmoke = (pos, n) => spawnSmokeAt(G, pos, n || 2, false);
G.hurtPlayer = (n) => {
  if (G.mode === 'menu' || G.shot) return;
  G.playerHP -= n;
  if (G.playerHP <= 0) {
    G.playerHP = 0;
    const ws = document.getElementById('wastedScreen');
    if (ws) ws.style.display = 'flex';
    setTimeout(() => {
      if (ws) ws.style.display = 'none';
      G.playerHP = 100;
      const spot = G.spots.hq || { x: -420, z: 375 };
      if (G.car) exitCar(G);
      if (G.player) { G.player.mesh.position.set(spot.x, groundH(spot.x, spot.z), spot.z); G.player.mesh.visible = true; }
      G.mode = 'foot'; G.wanted = 0;
    }, 2500);
  }
};

// ---- World & cast ----
buildWorld(G);
createPlayer(G);
{
  const spot = G.spots.hq || { x: -420, z: 375 };
  if (G.player) G.player.mesh.position.set(spot.x, groundH(spot.x, spot.z), spot.z);
}
spawnVehicle(G, 'hachi', (G.spots.hq ? G.spots.hq.x : -420) + 8, (G.spots.hq ? G.spots.hq.z : 375) + 2, Math.PI / 2, { color: 0xf2f2f2, driver: 'parked' });
spawnTraffic(G, 34);

// ---- Session 2/3 systems (in contract order) ----
try { const r = initSave(G); if (typeof r === 'function') G.loadSave = r; else if (r && typeof r.load === 'function') G.loadSave = r.load; } catch (e) { console.warn('initSave', e); }
try { initHUD(G); } catch (e) { console.warn('initHUD', e); }
try { const a = initAudio(G); if (a) G.audio = a; } catch (e) { console.warn('initAudio', e); }
try { initPeds(G); } catch (e) { console.warn('initPeds', e); }
try { initPolice(G); } catch (e) { console.warn('initPolice', e); }
try { initMissions(G); } catch (e) { console.warn('initMissions', e); }

// ---- Input ----
addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  G.input.keys[e.code] = true;
  if (e.code === 'KeyF' && !shot && !G.paused) {
    if (G.mode === 'foot' && G.nearCar) enterCar(G, G.nearCar);
    else if (G.mode === 'car') exitCar(G);
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (!shot) {
      G.paused = !G.paused;
      const pm = document.getElementById('pauseMenu');
      if (pm) pm.style.display = G.paused ? 'flex' : 'none';
    }
  }
  if (e.code === 'KeyM') { G.muted = !G.muted; if (G.audio && G.audio.setMuted) G.audio.setMuted(G.muted); }
});
addEventListener('keyup', (e) => { G.input.keys[e.code] = false; });
addEventListener('mousedown', (e) => { G.input.mouse.down = true; G.input.mouse.x = e.clientX; G.input.mouse.y = e.clientY; });
addEventListener('mouseup', () => { G.input.mouse.down = false; });
addEventListener('mousemove', (e) => { G.input.mouse.x = e.clientX; G.input.mouse.y = e.clientY; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- Menu ----
const menuEl = document.getElementById('menu');
const hudEl = document.getElementById('hud');
let saveExists = false;
try { saveExists = !!localStorage.getItem('roninbay-save-v1'); } catch (e) { saveExists = false; }
const continueBtn = document.getElementById('continueBtn');
if (continueBtn && !saveExists) continueBtn.style.display = 'none';
function startGame() {
  if (menuEl) menuEl.style.display = 'none';
  if (hudEl) hudEl.style.display = 'block';
  G.mode = 'foot';
  G.banner('RONIN BAY', 'Meet Mika at the RONIN KAI lot');
  const obj = document.getElementById('objective');
  if (obj) obj.textContent = 'M1 First Keys — meet Mika at HQ';
}
const newBtn = document.getElementById('newGameBtn');
if (newBtn) newBtn.addEventListener('click', () => {
  try { localStorage.removeItem('roninbay-save-v1'); } catch (e) {}
  if (G.resetSave) { try { G.resetSave(); } catch (e) {} }
  startGame();
});
if (continueBtn) continueBtn.addEventListener('click', () => {
  if (G.loadSave) { try { G.loadSave(); } catch (e) { console.warn('loadSave', e); } }
  startGame();
});

if (shot) {
  try { setupShot(G, shot); } catch (e) { console.warn('setupShot', e); }
  if (menuEl) menuEl.style.display = 'none';
  if (hudEl) hudEl.style.display = 'block';
}

// ---- Loop ----
const clock = new THREE.Clock();
let menuAngle = 0;
const _focus = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
let _camInit = false;
function frame() {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, clock.getDelta());
  if (G.slowmoT > 0) { G.slowmoT -= dt; G.timeScale = 0.35; } else G.timeScale = 1;
  dt *= G.timeScale;
  if (G.paused) { renderer.render(scene, camera); return; }

  if (shot) {
    updateWorld(G, dt);
    updateTraffic(G, dt);
    if (G.shotCam) {
      camera.position.copy(G.shotCam.pos);
      camera.lookAt(G.shotCam.target);
    }
    for (const v of G.vehicles) {
      if (v.speed > 1) for (const spin of (v.mesh.userData.wheelSpin || [])) spin.rotation.x += (v.speed * dt) / ((v.spec.style && v.spec.style.wheelR) || 0.36);
    }
  } else if (G.mode === 'menu') {
    menuAngle += dt * 0.05;
    camera.position.set(Math.cos(menuAngle) * 180, 70, Math.sin(menuAngle) * 180);
    camera.lookAt(0, 10, 0);
    updateWorld(G, dt);
    updateTraffic(G, dt);
  } else {
    if (G.mode === 'foot') updatePlayer(G, dt);
    else if (G.mode === 'car') updateDriving(G, dt);
    updateTraffic(G, dt);
    updateWorld(G, dt);
    for (const u of G.updaters) { try { u(G, dt); } catch (e) { console.warn('updater', e); } }
    // Camera follow
    const focusObj = G.mode === 'car' && G.car ? G.car : (G.player ? { mesh: G.player.mesh, angle: G.player.angle } : null);
    if (focusObj) {
      _focus.copy(focusObj.mesh.position);
      const ang = focusObj.angle || 0;
      G.camYaw = ang;
      const isCar = G.mode === 'car';
      const spd = isCar && G.car ? Math.abs(G.car.speed) : 0;
      const dist = isCar ? 11 + spd * 0.18 : 7;
      const h = isCar ? 4.2 : 3.2;
      _camTarget.set(_focus.x - Math.sin(ang) * dist, _focus.y + h, _focus.z - Math.cos(ang) * dist);
      if (!_camInit) { camera.position.copy(_camTarget); _camInit = true; }
      else camera.position.lerp(_camTarget, Math.min(1, dt * 5));
      camera.lookAt(_focus.x, _focus.y + 1.4, _focus.z);
      G.camKick = Math.max(0, G.camKick - dt * 2.2);
      const targetFov = 62 + G.camKick * 8 + spd * 0.12;
      if (Math.abs(camera.fov - targetFov) > 0.05) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }
    }
  }
  renderer.render(scene, camera);
}
frame();
