// RONIN BAY: Street Kings — audio.js
// WebAudio synth, no assets. Everything is generated.
// In shot mode (G.shot) audio never starts and never throws.

export function initAudio(G) {
  const noopAudio = {
    setMuted(_b) {},
    engine(_s) {},
    skid(_a) {},
    nos() {},
    thud() {},
    jingle(_win) {},
    blip() {},
  };

  try {
    if (!G) return;
    if (G.shot) {
      G.audio = noopAudio;
      return;
    }

    let ctx = null;
    let master = null;
    let muted = !!G.muted;

    let engineOsc1 = null;
    let engineOsc2 = null;
    let engineFilter = null;
    let engineGain = null;

    let skidSource = null;
    let skidFilter = null;
    let skidGain = null;

    let padOsc1 = null;
    let padOsc2 = null;
    let padGain = null;
    let padFilter = null;
    let padTimer = 0;
    let padStep = 0;

    let started = false;
    let lastHealth = null;
    let lastMissionIndex = typeof G.missionIndex === 'number' ? G.missionIndex : 0;
    let lastNosDown = false;
    let nosCooldown = 0;

    function isDown(...names) {
      try {
        const keys = G.input && G.input.keys;
        if (!keys) return false;
        for (const n of names) {
          if (typeof keys.has === 'function' && keys.has(n)) return true;
          if (typeof keys === 'object' && keys[n]) return true;
          // also support array
          if (Array.isArray(keys) && keys.includes(n)) return true;
        }
        // case-insensitive scan for Set/array/object keys
        const wanted = names.map((s) => String(s).toLowerCase());
        const check = (v) => wanted.includes(String(v).toLowerCase());
        if (typeof keys.has === 'function' || keys instanceof Set) {
          for (const v of keys) if (check(v)) return true;
        } else if (Array.isArray(keys)) {
          if (keys.some(check)) return true;
        } else if (typeof keys === 'object') {
          for (const k of Object.keys(keys)) if (keys[k] && check(k)) return true;
        }
        return false;
      } catch (_e) {
        return false;
      }
    }

    function ensureCtx() {
      if (ctx) {
        if (ctx.state === 'suspended') {
          try { ctx.resume(); } catch (_e) {}
        }
        return true;
      }
      try {
        const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(ctx.destination);
        startEngine();
        startSkid();
        startPad();
        started = true;
        return true;
      } catch (_e) {
        ctx = null;
        return false;
      }
    }

    function makeNoiseBuffer() {
      const len = Math.floor(ctx.sampleRate * 1.5);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return buf;
    }

    function startEngine() {
      try {
        engineOsc1 = ctx.createOscillator();
        engineOsc1.type = 'sawtooth';
        engineOsc1.frequency.value = 55;
        engineOsc2 = ctx.createOscillator();
        engineOsc2.type = 'square';
        engineOsc2.frequency.value = 55;
        try { engineOsc2.detune.value = 1205; } catch (_e) {}
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 300;
        engineFilter.Q.value = 2;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        engineOsc1.connect(engineFilter);
        engineOsc2.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(master);
        engineOsc1.start();
        engineOsc2.start();
      } catch (_e) {}
    }

    function startSkid() {
      try {
        skidSource = ctx.createBufferSource();
        skidSource.buffer = makeNoiseBuffer();
        skidSource.loop = true;
        skidFilter = ctx.createBiquadFilter();
        skidFilter.type = 'bandpass';
        skidFilter.frequency.value = 900;
        skidFilter.Q.value = 1.2;
        skidGain = ctx.createGain();
        skidGain.gain.value = 0;
        skidSource.connect(skidFilter);
        skidFilter.connect(skidGain);
        skidGain.connect(master);
        skidSource.start();
      } catch (_e) {}
    }

    function startPad() {
      try {
        padOsc1 = ctx.createOscillator();
        padOsc1.type = 'triangle';
        padOsc1.frequency.value = 220;
        padOsc2 = ctx.createOscillator();
        padOsc2.type = 'triangle';
        padOsc2.frequency.value = 220;
        try { padOsc2.detune.value = 7; } catch (_e) {}
        padFilter = ctx.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.value = 800;
        padGain = ctx.createGain();
        padGain.gain.value = 0;
        padOsc1.connect(padFilter);
        padOsc2.connect(padFilter);
        padFilter.connect(padGain);
        padGain.connect(master);
        padOsc1.start();
        padOsc2.start();
      } catch (_e) {}
    }

    // Chord roots for Am - F - C - G
    const PAD_CHORDS = [
      [220.0, 261.63, 329.63], // Am
      [174.61, 220.0, 261.63], // F
      [130.81, 164.81, 196.0], // C (shifted up in playback below)
      [196.0, 246.94, 293.66], // G
    ];

    function engine(speedNorm) {
      try {
        if (!ctx || !engineOsc1) return;
        const s = Math.max(0, Math.min(1, Number(speedNorm) || 0));
        const f = 55 + s * 165;
        const t = ctx.currentTime;
        engineOsc1.frequency.setTargetAtTime(f, t, 0.08);
        engineOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
        if (engineFilter) engineFilter.frequency.setTargetAtTime(300 + s * 900, t, 0.08);
        if (engineGain) {
          const target = G.mode === 'car' ? 0.06 + s * 0.08 : 0.015;
          engineGain.gain.setTargetAtTime(target, t, 0.1);
        }
      } catch (_e) {}
    }

    function skid(amount) {
      try {
        if (!ctx || !skidGain) return;
        const a = Math.max(0, Math.min(1, Number(amount) || 0));
        skidGain.gain.setTargetAtTime(a * 0.12, ctx.currentTime, 0.05);
      } catch (_e) {}
    }

    function nos() {
      try {
        if (!ensureCtx() || !ctx) return;
        const t = ctx.currentTime;
        // osc rise
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(900, t + 0.35);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(600, t);
        f.frequency.exponentialRampToValueAtTime(3200, t + 0.35);
        osc.connect(f); f.connect(g); g.connect(master);
        osc.start(t); osc.stop(t + 0.45);
        // noise sweep
        const src = ctx.createBufferSource();
        src.buffer = makeNoiseBuffer();
        const nf = ctx.createBiquadFilter();
        nf.type = 'bandpass';
        nf.frequency.setValueAtTime(500, t);
        nf.frequency.exponentialRampToValueAtTime(3500, t + 0.35);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.08, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        src.connect(nf); nf.connect(ng); ng.connect(master);
        src.start(t); src.stop(t + 0.45);
      } catch (_e) {}
    }

    function thud() {
      try {
        if (!ensureCtx() || !ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.25);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(g); g.connect(master);
        osc.start(t); osc.stop(t + 0.32);
      } catch (_e) {}
    }

    function tone(freq, start, dur, gainVal, type) {
      const osc = ctx.createOscillator();
      osc.type = type || 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gainVal, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(g); g.connect(master);
      osc.start(start); osc.stop(start + dur + 0.05);
    }

    function jingle(win) {
      try {
        if (!ensureCtx() || !ctx) return;
        const t = ctx.currentTime;
        if (win === false) {
          tone(392, t, 0.18, 0.12);
          tone(330, t + 0.16, 0.18, 0.12);
          tone(262, t + 0.32, 0.3, 0.12);
        } else {
          tone(523.25, t, 0.16, 0.12);
          tone(659.25, t + 0.14, 0.16, 0.12);
          tone(783.99, t + 0.28, 0.32, 0.14);
        }
      } catch (_e) {}
    }

    function blip() {
      try {
        if (!ensureCtx() || !ctx) return;
        const t = ctx.currentTime;
        tone(880, t, 0.08, 0.08, 'square');
      } catch (_e) {}
    }

    function setMuted(b) {
      muted = !!b;
      try { G.muted = muted; } catch (_e) {}
      try {
        if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.03);
      } catch (_e) {}
    }

    const audio = { setMuted, engine, skid, nos, thud, jingle, blip };
    G.audio = audio;

    // Lazy start on first user gesture.
    try {
      if (typeof window !== 'undefined' && window.addEventListener) {
        const onGesture = () => {
          try { ensureCtx(); } catch (_e) {}
        };
        window.addEventListener('pointerdown', onGesture, { once: true });
        window.addEventListener('keydown', onGesture, { once: true });
      }
    } catch (_e) {}

    // Per-frame updater: drives engine / skid / nos / thud / jingle / pad.
    function updater(dt) {
      try {
        if (!ctx || !started) return;
        const delta = typeof dt === 'number' && dt > 0 ? Math.min(dt, 0.1) : 0.016;

        // --- speed estimate ---
        let speedNorm = 0;
        let speedVal = 0;
        try {
          if (typeof G.speedKmh === 'number') speedVal = Math.abs(G.speedKmh) / 3.6;
          const car = G.car;
          if (car) {
            const cand = car.speed ?? car.userData?.speed ?? car.userData?.speedMs ?? null;
            if (typeof cand === 'number') speedVal = Math.abs(cand);
            else if (car.velocity && typeof car.velocity.length === 'function') speedVal = car.velocity.length();
          }
          speedNorm = Math.max(0, Math.min(1, speedVal / 45));
          if (typeof G.speedKmh === 'number') speedNorm = Math.max(0, Math.min(1, Math.abs(G.speedKmh) / 160));
        } catch (_e) {}

        engine(speedNorm);

        // --- skid estimate ---
        try {
          const spaceDown = isDown('Space', ' ', 'Spacebar');
          const inCar = G.mode === 'car';
          const fast = (typeof G.speedKmh === 'number' ? Math.abs(G.speedKmh) > 10 : speedVal > 10);
          // also honour a drift signal if present
          let amount = inCar && spaceDown && fast ? 0.9 : 0;
          if (inCar && typeof G.driftScore === 'number' && G.driftScore > 0 && fast) {
            amount = Math.max(amount, 0.5);
          }
          skid(amount);
        } catch (_e) {}

        // --- NOS on Shift press edge ---
        try {
          if (nosCooldown > 0) nosCooldown -= delta;
          const shiftDown = isDown('Shift', 'ShiftLeft', 'ShiftRight');
          if (shiftDown && !lastNosDown && G.mode === 'car' && nosCooldown <= 0) {
            nos();
            nosCooldown = 0.6;
          }
          lastNosDown = shiftDown;
        } catch (_e) {}

        // --- thud on health drop ---
        try {
          let hp = null;
          const car = G.car;
          if (car) {
            const cand = car.health ?? car.hp ?? car.userData?.health ?? car.userData?.hp ?? null;
            if (typeof cand === 'number') hp = cand;
          }
          if (hp === null && typeof G.playerHP === 'number' && G.mode !== 'car') hp = G.playerHP;
          if (hp !== null) {
            if (lastHealth !== null && lastHealth - hp > 5) thud();
            lastHealth = hp;
          }
        } catch (_e) {}

        // --- jingle on mission advance ---
        try {
          if (typeof G.missionIndex === 'number') {
            if (G.missionIndex > lastMissionIndex) {
              jingle(true);
              lastMissionIndex = G.missionIndex;
            } else if (G.missionIndex !== lastMissionIndex) {
              lastMissionIndex = G.missionIndex;
            }
          }
        } catch (_e) {}

        // --- ambient pad in menu mode only ---
        try {
          if (padGain && padOsc1 && padOsc2) {
            const inMenu = !G.mode || G.mode === 'menu';
            const target = inMenu ? 0.035 : 0;
            padGain.gain.setTargetAtTime(target, ctx.currentTime, 0.5);
            if (inMenu) {
              padTimer -= delta;
              if (padTimer <= 0) {
                padTimer = 4;
                const chord = PAD_CHORDS[padStep % PAD_CHORDS.length];
                padStep++;
                const t = ctx.currentTime;
                // root on osc1, third/fifth averaged on osc2 (simple, calm)
                padOsc1.frequency.setTargetAtTime(chord[0], t, 0.8);
                padOsc2.frequency.setTargetAtTime(chord[1] * 2, t, 0.8);
              }
            }
          }
        } catch (_e) {}
      } catch (_e) {}
    }

    try {
      if (Array.isArray(G.updaters)) G.updaters.push(updater);
      else if (G.updaters && typeof G.updaters.add === 'function') G.updaters.add(updater);
      else if (G.updaters && typeof G.updaters.push === 'function') G.updaters.push(updater);
      else G.updaters = [updater];
    } catch (_e) {}
  } catch (_e) {
    try {
      if (G && !G.audio) G.audio = noopAudio;
    } catch (_e2) {}
  }
}
