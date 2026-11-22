// hud.js — money/rep/rank/stars, health bars, speedometer gauge, minimap,
// briefings, mission card and the garage panel.
// RONIN BAY: STREET KINGS — session 2 systems.
// Runs on its OWN 100ms interval so the HUD also renders in shot mode.
import { CARS, CLUB_RANKS, DISTRICTS } from './config.js';
import { spawnVehicle } from './cars.js';
import { groundH } from './world.js';

const RANK_REQ = { hachi: 0, sora15: 2, hoshi7: 3, taiyo: 4, kaze: 5 };
const UNBUYABLE = ['hero-supra', 'hero-gtr', 'police', 'police-suv'];
const PAINTS = [0xff2e88, 0x00f5d4, 0xffe95a, 0x7b2fff, 0xff8c42, 0xe63946, 0xf5f5f5, 0x181818];
const GLOWS = [0xff2e88, 0x00f5d4, 0xffe95a, 0x7b2fff, 0xff8c42, null];
const WINGS = ['stock', 'none', 'big'];

function el(id) { return document.getElementById(id); }
function fmt(n) { return Math.floor(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function hexCss(h) { return '#' + (h >>> 0).toString(16).padStart(6, '0'); }
function rgba(h, a) {
  const r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

export function initHUD(G) {
  if (!Array.isArray(G.owned)) G.owned = ['hachi'];
  if (!G.custom || typeof G.custom !== 'object') G.custom = {};
  if (!G.flags) G.flags = {};

  const S = {
    lastStars: 0,
    garageOpen: false,
    garageCarId: null,   // car id currently shown/customized in the garage
    glowIdx: 0,
    starsBuilt: false,
    customBuilt: false,
  };

  function playerPos() {
    if (G.mode === 'car' && G.car && G.car.mesh) return G.car.mesh.position;
    if (G.player && G.player.mesh) return G.player.mesh.position;
    return null;
  }

  // ---------- briefing + mission card ----------
  G.showMissionCard = function (giverName, text, color) {
    const card = el('missionCard'); if (!card) return;
    const portrait = el('cardPortrait');
    const giverEl = el('cardGiver');
    const textEl = el('cardText');
    const prog = el('cardProg');
    const col = (color === undefined || color === null) ? 0xff2e88 : color;
    if (portrait) {
      portrait.textContent = (giverName || '?').charAt(0).toUpperCase();
      portrait.style.background = 'radial-gradient(circle at 35% 30%, ' + rgba(col, 0.95) + ', ' + rgba(col, 0.35) + ' 70%, rgba(10,10,18,.9))';
    }
    if (giverEl) giverEl.textContent = giverName || '';
    if (textEl) textEl.textContent = text || '';
    card.classList.add('show');
    if (prog) {
      prog.style.transition = 'none';
      prog.style.width = '100%';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          prog.style.transition = 'width 6s linear';
          prog.style.width = '0%';
        });
      });
    }
    clearTimeout(G.showMissionCard._t);
    G.showMissionCard._t = setTimeout(() => card.classList.remove('show'), 6000);
  };

  G.showBriefing = function (giver, line, color) {
    const panel = el('briefing');
    const col = (color === undefined || color === null) ? 0xff2e88 : color;
    if (panel) {
      const chip = panel.querySelector('.giverChip');
      const giverEl = panel.querySelector('.giver');
      const lineEl = panel.querySelector('.line');
      if (chip) {
        chip.textContent = (giver || '?').charAt(0).toUpperCase();
        chip.style.background = 'radial-gradient(circle at 35% 30%, ' + rgba(col, 0.95) + ', ' + rgba(col, 0.35) + ' 70%, rgba(10,10,18,.9))';
      }
      if (giverEl) giverEl.textContent = giver || '';
      if (lineEl) lineEl.textContent = line || '';
      panel.classList.add('show');
      clearTimeout(G.showBriefing._t);
      G.showBriefing._t = setTimeout(() => panel.classList.remove('show'), 6000);
    }
    // The mission card carries the same briefing.
    if (G.showMissionCard) G.showMissionCard(giver, line, color);
  };

  // ---------- garage ----------
  function garageTargetCar() {
    if (G.flags.garageCar) return G.flags.garageCar;
    if (G.car) return G.car;
    return null;
  }

  function applyGlow(car, glowHex) {
    if (!car || !car.mesh) return;
    let done = false;
    const ud = car.mesh.userData || {};
    if (ud.glow && ud.glow.material && ud.glow.material.color && glowHex !== null && glowHex !== undefined) {
      ud.glow.material.color.set(glowHex); done = true;
    }
    if (ud.glowSprite && ud.glowSprite.material && ud.glowSprite.material.color && glowHex !== null && glowHex !== undefined) {
      ud.glowSprite.material.color.set(glowHex); done = true;
    }
    if (ud.glow) ud.glow.visible = glowHex !== null && glowHex !== undefined;
    if (ud.glowSprite) ud.glowSprite.visible = glowHex !== null && glowHex !== undefined;
    if (!done) {
      car.mesh.traverse(o => {
        if (o.isMesh && o.material && o.material.isMeshBasicMaterial && o.geometry &&
            o.geometry.type === 'PlaneGeometry') {
          if (glowHex !== null && glowHex !== undefined) o.material.color.set(glowHex);
          o.visible = glowHex !== null && glowHex !== undefined;
        }
        if (o.isSprite && o.material && o.material.color && glowHex !== null && glowHex !== undefined) {
          o.material.color.set(glowHex);
        }
      });
    }
  }

  function renderGarage() {
    const list = el('carList'); if (!list) return;
    list.innerHTML = '';
    const title = el('garageTitle');
    if (title) title.textContent = 'RONIN GARAGE — $' + fmt(G.money);
    for (const spec of CARS) {
      const row = document.createElement('div');
      row.className = 'carRow';
      const owned = G.owned.includes(spec.id);
      const req = RANK_REQ[spec.id] || 0;
      const unbuyable = UNBUYABLE.includes(spec.id);
      let label, disabled = false, reason = '';
      if (owned) label = 'DRIVE';
      else if (unbuyable) { label = 'CLUB REWARD'; disabled = true; reason = 'Win it in a pink-slip race'; }
      else if ((G.rankIdx || 0) < req) { label = 'BUY $' + fmt(spec.price); disabled = true; reason = 'Needs rank ' + (CLUB_RANKS[req] ? CLUB_RANKS[req].name : req); }
      else if ((G.money || 0) < spec.price) { label = 'BUY $' + fmt(spec.price); disabled = true; reason = 'Not enough cash'; }
      else label = 'BUY $' + fmt(spec.price);

      const info = document.createElement('div');
      info.className = 'carInfo';
      info.innerHTML = '<b>' + spec.name + '</b> <span>' + (spec.cls || '') + '</span>' +
        (reason ? '<i>' + reason + '</i>' : '');
      const btn = document.createElement('button');
      btn.className = 'carBtn';
      btn.textContent = label;
      btn.disabled = disabled;
      btn.addEventListener('click', () => {
        if (owned) driveCar(spec.id);
        else buyCar(spec.id);
      });
      row.appendChild(info);
      row.appendChild(btn);
      list.appendChild(row);
    }
    buildCustomRow();
  }

  function driveCar(id) {
    const spot = (G.spots && G.spots.garage) || { x: -420, z: 398 };
    // Despawn the current player car.
    if (G.car) {
      const old = G.car;
      if (old.mesh && old.mesh.parent) old.mesh.parent.remove(old.mesh);
      else if (old.mesh) G.scene.remove(old.mesh);
      const i = G.vehicles.indexOf(old); if (i >= 0) G.vehicles.splice(i, 1);
      G.car = null;
    }
    const cust = G.custom[id] || {};
    const v = spawnVehicle(G, id, spot.x, spot.z + 6, 0, {
      driver: G.mode === 'car' ? 'player' : 'parked',
      color: cust.paint !== undefined ? cust.paint : undefined,
      glowColor: cust.glow !== undefined ? cust.glow : undefined,
    });
    if (!v) return;
    if (cust.glow !== undefined) applyGlow(v, cust.glow);
    if (cust.wing && v.mesh.userData && v.mesh.userData.wing) {
      v.mesh.userData.wing.visible = cust.wing !== 'none';
    }
    S.garageCarId = id;
    if (G.mode === 'car') G.car = v;
    else G.flags.garageCar = v;
    if (G.toast) G.toast('Rolled out: ' + v.spec.name);
    renderGarage();
  }

  function buyCar(id) {
    const spec = CARS.find(c => c.id === id);
    if (!spec) return;
    if ((G.money || 0) < spec.price) return;
    G.money -= spec.price;
    G.owned.push(id);
    if (G.saveGame) G.saveGame();
    if (G.toast) G.toast('Bought: ' + spec.name);
    renderGarage();
  }

  function buildCustomRow() {
    const rowEl = el('customRow');
    if (!rowEl || S.customBuilt) return;
    S.customBuilt = true;
    const targetId = () => S.garageCarId || (garageTargetCar() && garageTargetCar().spec.id) || G.owned[0];
    for (const hex of PAINTS) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = hexCss(hex);
      b.title = 'Paint';
      b.addEventListener('click', () => {
        const car = garageTargetCar(); if (!car) return;
        const id = targetId(); if (!id) return;
        if (!G.custom[id]) G.custom[id] = {};
        G.custom[id].paint = hex;
        const ud = car.mesh.userData || {};
        if (ud.bodyMat && ud.bodyMat.color) ud.bodyMat.color.set(hex);
        else car.mesh.traverse(o => {
          if (o.isMesh && o.material && o.material.color && o.userData && o.userData.isBody) o.material.color.set(hex);
        });
        if (G.saveGame) G.saveGame();
      });
      rowEl.appendChild(b);
    }
    const glowBtn = document.createElement('button');
    glowBtn.className = 'customBtn';
    glowBtn.textContent = 'GLOW';
    glowBtn.addEventListener('click', () => {
      const car = garageTargetCar(); if (!car) return;
      const id = targetId(); if (!id) return;
      S.glowIdx = (S.glowIdx + 1) % GLOWS.length;
      const glow = GLOWS[S.glowIdx];
      if (!G.custom[id]) G.custom[id] = {};
      G.custom[id].glow = glow;
      car.glowColor = glow;
      applyGlow(car, glow);
      if (G.saveGame) G.saveGame();
    });
    rowEl.appendChild(glowBtn);
    const wingBtn = document.createElement('button');
    wingBtn.className = 'customBtn';
    wingBtn.textContent = 'WING';
    wingBtn.addEventListener('click', () => {
      const car = garageTargetCar();
      const id = targetId(); if (!id) return;
      if (!G.custom[id]) G.custom[id] = {};
      const cur = G.custom[id].wing || 'stock';
      const next = WINGS[(WINGS.indexOf(cur) + 1) % WINGS.length];
      G.custom[id].wing = next;
      if (car && car.mesh.userData && car.mesh.userData.wing) {
        car.mesh.userData.wing.visible = next !== 'none';
        if (next === 'big') car.mesh.userData.wing.scale.set(1.35, 1.3, 1.35);
        else car.mesh.userData.wing.scale.set(1, 1, 1);
      }
      if (G.toast) G.toast('Wing: ' + next);
      if (G.saveGame) G.saveGame();
    });
    rowEl.appendChild(wingBtn);
  }

  function setGarage(open) {
    const panel = el('garagePanel'); if (!panel) return;
    S.garageOpen = open;
    G.flags.garageOpen = open;
    panel.classList.toggle('show', open);
    panel.style.display = open ? 'block' : 'none';
    if (open) {
      if (!S.garageCarId) {
        const t = garageTargetCar();
        S.garageCarId = t ? t.spec.id : G.owned[0];
      }
      renderGarage();
    }
  }

  const closeBtn = el('closeGarage');
  if (closeBtn) closeBtn.addEventListener('click', () => setGarage(false));

  window.addEventListener('keydown', (ev) => {
    if (G.shot) return;
    if (ev.code !== 'KeyE' && ev.key !== 'e' && ev.key !== 'E') return;
    const p = playerPos(); if (!p) return;
    const spot = (G.spots && G.spots.garage) || { x: -420, z: 398 };
    const d = Math.hypot(p.x - spot.x, p.z - spot.z);
    if (d < 10) setGarage(!S.garageOpen);
  });

  // ---------- speedometer ----------
  function drawSpeedo() {
    const cv = el('speedoCanvas'); if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const W = cv.width || 170, H = cv.height || 110;
    ctx.clearRect(0, 0, W, H);
    const cx = 85, cy = 62, r = 62;
    const a0 = (-210 * Math.PI) / 180, a1 = (30 * Math.PI) / 180;
    const inCar = G.mode === 'car';
    ctx.save();
    if (!inCar) ctx.globalAlpha = 0.35;
    const frac = Math.max(0, Math.min(1, (G.speedKmh || 0) / 240));
    // Background arc.
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 10;
    ctx.stroke();
    // Colored speed arc.
    if (frac > 0.005) {
      const grad = ctx.createLinearGradient(20, 90, 150, 20);
      grad.addColorStop(0, '#00f5d4');
      grad.addColorStop(0.6, '#7b2fff');
      grad.addColorStop(1, '#ff2e88');
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * frac);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    // Ticks.
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (a1 - a0) * (i / 8);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 9), cy + Math.sin(a) * (r - 9));
      ctx.lineTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14));
      ctx.stroke();
    }
    // Needle.
    const na = a0 + (a1 - a0) * frac;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(na) * (r - 16), cy + Math.sin(na) * (r - 16));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0e16';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Digital readout.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(inCar ? (G.speedKmh || 0) : 0)), cx, cy + 32);
    ctx.font = '10px Arial';
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText('km/h', cx, cy + 44);
    // NOS bar.
    let nos = 0.6;
    if (G.nosLevel !== undefined) nos = G.nosLevel;
    else if (inCar && G.input && G.input.keys && G.input.keys['ShiftLeft']) nos = 1;
    nos = Math.max(0, Math.min(1, nos));
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(35, H - 10, 100, 5);
    if (nos > 0) {
      ctx.fillStyle = '#ff8c42';
      ctx.fillRect(35, H - 10, 100 * nos, 5);
    }
    ctx.restore();
  }

  // ---------- minimap ----------
  function drawMinimap() {
    const cv = el('minimap'); if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const S2 = 220, world = 1320, sc = S2 / world;
    const wx = (x) => (x + world / 2) * sc;
    const wz = (z) => (z + world / 2) * sc;
    const bg = ctx.createLinearGradient(0, 0, 0, S2);
    bg.addColorStop(0, '#0d1626'); bg.addColorStop(1, '#0a0f1c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S2, S2);
    // Districts by owner.
    for (const d of DISTRICTS) {
      const st = G.districts && G.districts[d.id];
      const owner = st ? st.owner : 'neutral';
      ctx.fillStyle = owner === 'ronin' ? 'rgba(255,46,136,.28)'
        : owner === 'vanta' ? 'rgba(123,47,255,.28)' : 'rgba(140,150,170,.10)';
      ctx.fillRect(wx(d.x0), wz(d.z0), (d.x1 - d.x0) * sc, (d.z1 - d.z0) * sc);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(d.name.toUpperCase(), wx((d.x0 + d.x1) / 2), wz((d.z0 + d.z1) / 2));
    }
    // Water: south + east margins.
    ctx.fillStyle = '#0e5f7a';
    ctx.fillRect(0, wz(560), S2, S2 - wz(560));
    ctx.fillRect(wx(560), 0, S2 - wx(560), wz(560));
    // Roads.
    ctx.strokeStyle = 'rgba(180,200,230,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const x of (G.roadX || [])) { ctx.moveTo(wx(x), 0); ctx.lineTo(wx(x), S2); }
    for (const z of (G.roadZ || [])) { ctx.moveTo(0, wz(z)); ctx.lineTo(S2, wz(z)); }
    ctx.stroke();
    // GPS route.
    if (G.gpsRoute && G.gpsRoute.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#00f5d4';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f5d4';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      G.gpsRoute.forEach((pt, i) => {
        const X = wx(pt.x), Y = wz(pt.z);
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      });
      ctx.stroke();
      ctx.restore();
    }
    // HQ + garage icons.
    const spots = G.spots || {};
    if (spots.hq) {
      const X = wx(spots.hq.x), Y = wz(spots.hq.z);
      ctx.fillStyle = '#ff2e88';
      ctx.fillRect(X - 3.5, Y - 1, 7, 5.5);
      ctx.beginPath();
      ctx.moveTo(X - 4.5, Y - 1); ctx.lineTo(X, Y - 5); ctx.lineTo(X + 4.5, Y - 1);
      ctx.closePath(); ctx.fill();
    }
    if (spots.garage) {
      const X = wx(spots.garage.x), Y = wz(spots.garage.z);
      ctx.fillStyle = '#00f5d4';
      ctx.fillRect(X - 4, Y - 4, 8, 8);
      ctx.fillStyle = '#062a26';
      ctx.font = 'bold 7px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('G', X, Y + 2.5);
    }
    // Vehicles (pink dots).
    ctx.fillStyle = '#ff7ab8';
    for (const v of (G.vehicles || [])) {
      if (!v || !v.mesh || v.driver === 'cop') continue;
      ctx.beginPath();
      ctx.arc(wx(v.mesh.position.x), wz(v.mesh.position.z), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cops (blue dots, white ring).
    for (const c of (G.cops || [])) {
      if (!c || !c.mesh) continue;
      const X = wx(c.mesh.position.x), Y = wz(c.mesh.position.z);
      ctx.beginPath(); ctx.arc(X, Y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#3a86ff'; ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
    }
    // Mission marker: pulsing gold dot + ring.
    if (G.missionMarker) {
      const X = wx(G.missionMarker.x), Y = wz(G.missionMarker.z);
      const pulse = 3.5 + Math.sin(Date.now() / 220) * 1.2;
      ctx.beginPath(); ctx.arc(X, Y, pulse + 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,210,63,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(X, Y, pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd23f'; ctx.fill();
    }
    // Player arrow (forward +Z: dir = (sin θ, cos θ); canvas y = +z down).
    const p = playerPos();
    if (p) {
      const ang = (G.mode === 'car' && G.car) ? (G.car.angle || 0) : ((G.player && G.player.angle) || 0);
      const X = wx(p.x), Y = wz(p.z);
      const dx = Math.sin(ang), dy = Math.cos(ang);
      const px = -dy, py = dx;
      ctx.beginPath();
      ctx.moveTo(X + dx * 6, Y + dy * 6);
      ctx.lineTo(X - dx * 4 + px * 3.5, Y - dy * 4 + py * 3.5);
      ctx.lineTo(X - dx * 4 - px * 3.5, Y - dy * 4 - py * 3.5);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#0b0e16';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    // Border.
    ctx.strokeStyle = 'rgba(0,245,212,.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, S2 - 2, S2 - 2);
  }

  // ---------- 100ms HUD tick ----------
  setInterval(() => {
    try {
      // Money / rep / rank.
      const moneyEl = el('money');
      if (moneyEl) moneyEl.textContent = '$' + fmt(G.money);
      const repEl = el('rep');
      if (repEl) repEl.textContent = 'REP ' + fmt(G.rep);
      const rankEl = el('rank');
      if (rankEl) {
        const rankName = (CLUB_RANKS[G.rankIdx || 0] || CLUB_RANKS[0]).name;
        if ((G.bust || 0) > 0.3) rankEl.innerHTML = rankName + ' · <span style="color:#ff3b3b;font-weight:bold">BUSTING!</span>';
        else rankEl.textContent = rankName;
      }
      // Wanted stars.
      const starsEl = el('stars');
      if (starsEl) {
        if (!S.starsBuilt || starsEl.children.length !== 5) {
          starsEl.innerHTML = '';
          for (let i = 0; i < 5; i++) {
            const s = document.createElement('span');
            s.className = 'star';
            s.textContent = '★';
            starsEl.appendChild(s);
          }
          S.starsBuilt = true;
        }
        const lit = Math.floor(G.wanted || 0);
        for (let i = 0; i < 5; i++) {
          const s = starsEl.children[i];
          if (s) s.classList.toggle('on', i < lit);
        }
        if (lit > S.lastStars) {
          const s = starsEl.children[lit - 1];
          if (s) {
            s.classList.add('pulse');
            setTimeout(() => s.classList.remove('pulse'), 500);
          }
        }
        S.lastStars = lit;
        starsEl.classList.toggle('hot', (G.wanted || 0) >= 4);
      }
      // Health bars.
      const hb = el('healthBar');
      if (hb) hb.style.width = Math.max(0, Math.min(100, G.playerHP || 0)) + '%';
      const cb = el('carBar');
      if (cb) {
        const pct = G.car ? Math.max(0, Math.min(100, 100 * (G.car.health || 0) / ((G.car.spec && G.car.spec.health) || 100))) : 0;
        cb.style.width = pct + '%';
        const track = cb.parentElement;
        if (track) track.style.opacity = G.car ? '1' : '.35';
      }
      // Objective.
      const obj = el('objective');
      if (obj) obj.textContent = G.objectiveText || 'Free roam — visit a glowing marker';
      // Garage auto-close.
      if (S.garageOpen) {
        const p = playerPos();
        const spot = (G.spots && G.spots.garage) || { x: -420, z: 398 };
        if (!p || Math.hypot(p.x - spot.x, p.z - spot.z) > 14) setGarage(false);
      }
      drawSpeedo();
      drawMinimap();
    } catch (e) { /* HUD must never kill the frame loop */ }
  }, 100);
}
