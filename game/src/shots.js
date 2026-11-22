// shots.js — deterministic screenshot staging for gta6-01.
import * as THREE from 'three';
import { CAST, MISSIONS } from './config.js';
import { groundH } from './world.js';
import { spawnVehicle } from './cars.js';
import { makeFigure } from './player.js';

function castFig(G, id, x, z, angle) {
  const c = CAST.find(m => m.id === id) || CAST[0];
  const f = makeFigure(c);
  f.position.set(x, groundH(x, z), z); f.rotation.y = angle || 0;
  G.scene.add(f); return f;
}
function crowdFig(G, i, x, z, angle) {
  const shirts = [0xffc93c, 0x2f9df0, 0x37c978, 0xff6b9d, 0xf2f2f2, 0x7b2fff, 0xff8c42, 0x2fb9a8];
  const f = makeFigure({
    shirt: shirts[i % shirts.length], pants: [0x22242c, 0x3a3f4a, 0x5a4632][i % 3], skin: [0xe8b08a, 0xc98e62, 0xf0c09a, 0xb87f52][i % 4],
    hat: i % 3 === 0 ? 'cap' : 'none', hatColor: 0x181818, hair: [0x14100c, 0x3a2318, 0xbbbbbb][i % 3],
    height: 0.93 + (i % 5) * 0.04, build: 0.85 + (i % 4) * 0.12,
    outfit: ['tee', 'hoodie', 'jacket', 'dress'][i % 4], hairStyle: i % 4 === 3 ? 'long' : 'short',
    accessory: i % 5 === 4 ? 'pack' : 'none'
  });
  f.position.set(x, groundH(x, z), z); f.rotation.y = angle || 0;
  G.scene.add(f); return f;
}
function setCam(G, px, py, pz, tx, ty, tz) {
  G.shotCam = { pos: new THREE.Vector3(px, py, pz), target: new THREE.Vector3(tx, ty, tz) };
  G.camera.position.set(px, py, pz); G.camera.lookAt(tx, ty, tz);
}
function setObjective(text) { const el = document.getElementById('objective'); if (el) el.textContent = text; }

export function setupShot(G, name) {
  G.money = 4250; G.rep = 1450; G.rankIdx = 4;
  G.speedKmh = 0;
  if (G.player) G.player.mesh.visible = false;

  if (name === 'city') {
    const heroCar = spawnVehicle(G, 'hero-supra', -452, 388, 0.7, { color: 0xff6a00, driver: 'parked' });
    G.car = heroCar;
    castFig(G, 'ren', -454.8, 390.8, 2.6);
    castFig(G, 'mika', -447, 383, -0.6);
    castFig(G, 'jun', -444, 390, -1.4);
    spawnVehicle(G, 'hachi', -436, 384, Math.PI / 2, { color: 0xf2f2f2, driver: 'parked' });
    spawnVehicle(G, 'sora15', -428, 384, Math.PI / 2, { color: 0xb02020, driver: 'parked' });
    spawnVehicle(G, 'hoshi7', -420, 384, Math.PI / 2, { color: 0xffc93c, driver: 'parked' });
    setObjective('M1 First Keys — meet Mika at HQ');
    const br = document.getElementById('briefing');
    if (br) {
      const giver = br.querySelector('.giver'); if (giver) giver.textContent = 'Mika';
      const chip = br.querySelector('.giverChip'); if (chip) chip.textContent = 'M';
      const line = br.querySelector('.line'); if (line) line.textContent = MISSIONS[0].brief.split('\n')[0].replace(/^Mika:\s*/, '');
      br.classList.add('show');
    }
    setCam(G, -457, 2.2, 383, -452, 1.2, 388);
  } else if (name === 'meet') {
    const ids = ['hachi', 'sora15', 'hoshi7', 'taiyo', 'kaze', 'hero-supra', 'hero-gtr'];
    const glows = [0xff2e88, 0x00f5d4, 0xffe95a, 0x7b2fff, 0xff8c42, 0x19b34a, 0x4f8cff];
    const cols = [0xf2f2f2, 0xb8bcc4, 0xffc93c, 0xe8e8ec, 0x2a2e36, 0xff6a00, 0x2456c8];
    ids.forEach((id, i) => {
      const x = -21 + i * 7;
      spawnVehicle(G, id, x, 330, Math.PI + (i - 3) * 0.06, { color: cols[i], driver: 'parked', glow: true, glowColor: glows[i] });
    });
    castFig(G, 'ren', -6, 326.5, Math.PI);
    castFig(G, 'mika', 2, 326, Math.PI);
    castFig(G, 'ako', 9, 327, Math.PI);
    for (let i = 0; i < 8; i++) crowdFig(G, i, -26 + i * 7.5, 335 + (i % 2) * 2.5, Math.PI + (i % 3 - 1) * 0.3);
    setObjective('Club meet — Neon Mile avenue, all seven cars');
    const card = document.getElementById('missionCard');
    if (card) {
      const gEl = document.getElementById('cardGiver'); if (gEl) gEl.textContent = 'Chief Ako';
      const tEl = document.getElementById('cardText'); if (tEl) tEl.textContent = 'Hold the lot. Twelve stories, one king.';
      const pEl = document.getElementById('cardPortrait'); if (pEl) pEl.textContent = 'A';
      card.classList.add('show');
    }
    setCam(G, 8, 2.4, 320, 0, 1.0, 330);
  } else if (name === 'chase') {
    const hero = spawnVehicle(G, 'hero-supra', 60, -165, Math.PI / 2, { driver: 'parked', driverVisual: 'ren', glow: true, glowColor: 0xff8c42 });
    hero.speed = 30; G.car = hero;
    spawnVehicle(G, 'police', 38, -169, Math.PI / 2, { driver: 'cop', lights: true });
    spawnVehicle(G, 'police', 22, -161, Math.PI / 2, { driver: 'cop', lights: true });
    spawnVehicle(G, 'police-suv', 48, -158, Math.PI / 2, { driver: 'cop', lights: true });
    // Helicopter
    const heli = new THREE.Group();
    const hBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2, 7), new THREE.MeshPhongMaterial({ color: 0x1c2f5e }));
    heli.add(hBody);
    const hStripe = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.5, 7.1), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    heli.add(hStripe);
    const hCock = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 2), new THREE.MeshPhongMaterial({ color: 0xdff2ff }));
    hCock.position.set(0, 0.3, 3.6); heli.add(hCock);
    const hTail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 6), new THREE.MeshPhongMaterial({ color: 0x1c2f5e }));
    hTail.position.set(0, 0.4, -6); heli.add(hTail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(13, 0.12, 0.7), new THREE.MeshBasicMaterial({ color: 0x22262e }));
    rotor.position.y = 1.4; heli.add(rotor);
    const rotor2 = rotor.clone(); rotor2.rotation.y = Math.PI / 2; heli.add(rotor2);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 24, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.set(-4, -13, 6); cone.rotation.z = 0.3; cone.rotation.x = -0.22; heli.add(cone);
    heli.position.set(75, 26, -185); heli.rotation.y = Math.PI / 2;
    G.scene.add(heli);
    G.wanted = 5; G.speedKmh = 132;
    setObjective('Escape the RBPD — lose the heat!');
    setCam(G, 36, 5.5, -140, 62, 1, -165);
  } else if (name === 'hero') {
    spawnVehicle(G, 'hero-gtr', 430, 648, -0.5, { driver: 'parked', glow: true, glowColor: 0x4f8cff });
    castFig(G, 'ren', 428, 646.3, 1.1);
    setObjective('Bayside Ghost — the final pink slip awaits');
    setCam(G, 428.6, 1.6, 643.2, 431, 1.1, 648);
  } else if (name === 'lineup') {
    const ids = ['kei', 'hachi', 'roadster', 'sora15', 'hoshi7', 'taiyo', 'kaze', 'sedan', 'suv', 'taxi', 'police', 'truck'];
    const cols = [0xff6b9d, 0xf2f2f2, 0xb02020, 0xb8bcc4, 0xffc93c, 0xe8e8ec, 0x2a2e36, 0x3a6ea8, 0x37c978, 0xffc61a, 0x101216, 0xeef1f4];
    ids.forEach((id, i) => {
      const x = (i - 5.5) * 6.5;
      spawnVehicle(G, id, x, 330, Math.PI - 0.35, { color: cols[i], driver: 'parked', glow: false });
    });
    castFig(G, 'ren', 0, 325, Math.PI);
    setObjective('Lineup — twelve silhouettes of Kairyu Bay');
    setCam(G, 0, 2.6, 319, 0, 1.2, 330);
  } else {
    setObjective('RONIN BAY — STREET KINGS');
    setCam(G, -466, 3.2, 372, -450, 1.2, 389);
  }
}
