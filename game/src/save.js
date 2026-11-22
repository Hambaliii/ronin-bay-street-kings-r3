// save.js — localStorage persistence for RONIN BAY: STREET KINGS.
// Session 2 systems. initSave RETURNS the load function (and also sets
// G.loadSave) because main.js wires G.loadSave from either.
const SAVE_KEY = 'roninbay-save-v1';

const DISTRICT_DEFAULTS = {
  port: { control: 60, owner: 'ronin' },
  beach: { control: 20, owner: 'neutral' },
  neon: { control: 20, owner: 'vanta' },
  hill: { control: 10, owner: 'neutral' },
};

export function initSave(G) {
  if (!Array.isArray(G.owned)) G.owned = ['hachi'];
  if (!G.custom || typeof G.custom !== 'object') G.custom = {};
  if (!G.districts || typeof G.districts !== 'object') G.districts = {};

  G.saveGame = function () {
    try {
      const districts = {};
      for (const id of Object.keys(G.districts)) {
        const d = G.districts[id] || {};
        districts[id] = { control: d.control || 0, owner: d.owner || 'neutral' };
      }
      const data = {
        money: G.money || 0,
        rep: G.rep || 0,
        rankIdx: G.rankIdx || 0,
        missionIndex: G.missionIndex || 0,
        owned: Array.isArray(G.owned) ? G.owned.slice() : ['hachi'],
        custom: G.custom || {},
        districts,
        carId: (G.car && G.car.spec && G.car.spec.id) || 'hachi',
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable — play on without saving */ }
  };

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
    if (!raw) return false;
    let data = null;
    try { data = JSON.parse(raw); } catch (e) { return false; }
    if (!data || typeof data !== 'object') return false;
    if (typeof data.money === 'number') G.money = data.money;
    if (typeof data.rep === 'number') G.rep = data.rep;
    if (typeof data.rankIdx === 'number') G.rankIdx = data.rankIdx;
    if (typeof data.missionIndex === 'number') G.missionIndex = data.missionIndex;
    if (Array.isArray(data.owned) && data.owned.length) G.owned = data.owned.slice();
    if (data.custom && typeof data.custom === 'object') G.custom = data.custom;
    if (data.districts && typeof data.districts === 'object') {
      for (const id of Object.keys(data.districts)) {
        const sd = data.districts[id] || {};
        if (!G.districts[id]) G.districts[id] = { control: 0, owner: 'neutral' };
        if (typeof sd.control === 'number') G.districts[id].control = sd.control;
        if (typeof sd.owner === 'string') G.districts[id].owner = sd.owner;
      }
    }
    return true;
  }

  G.loadSave = load;

  G.resetSave = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    G.money = 500;
    G.rep = 0;
    G.rankIdx = 0;
    G.missionIndex = 0;
    G.owned = ['hachi'];
    G.custom = {};
    G.wanted = 0;
    G.bust = 0;
    for (const id of Object.keys(DISTRICT_DEFAULTS)) {
      const def = DISTRICT_DEFAULTS[id];
      if (!G.districts[id]) G.districts[id] = { control: def.control, owner: def.owner };
      else { G.districts[id].control = def.control; G.districts[id].owner = def.owner; }
    }
  };

  // Auto-load once if a save exists (applying twice is harmless).
  load();

  // Autosave every 10s while in play.
  setInterval(() => {
    if (G.mode === 'foot' || G.mode === 'car') G.saveGame();
  }, 10000);

  return load;
}
