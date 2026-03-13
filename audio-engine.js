// audio-engine.js - Web Audio API 環境音合成エンジン
// mp3ファイル不要。ブラウザ内で環境音をリアルタイム合成する。

const AudioEngine = (function() {
  'use strict';

  let ctx = null;
  let masterGain = null;
  const sources = {};

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.7;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ===== ノイズ生成 =====
  function createNoiseBuffer(duration, type) {
    const c = ensureContext();
    const sr = c.sampleRate;
    const len = sr * duration;
    const buf = c.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } else if (type === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    } else if (type === 'pink') {
      let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886*b0 + w*0.0555179;
        b1 = 0.99332*b1 + w*0.0750759;
        b2 = 0.96900*b2 + w*0.1538520;
        b3 = 0.86650*b3 + w*0.3104856;
        b4 = 0.55000*b4 + w*0.5329522;
        b5 = -0.7616*b5 - w*0.0168980;
        data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    return buf;
  }

  // ===== 各環境音の合成 =====
  const SYNTHS = {
    rain(c, dest) {
      const buf = createNoiseBuffer(4, 'pink');
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 800;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 8000;
      const g = c.createGain(); g.gain.value = 0.6;
      src.connect(hp).connect(lp).connect(g).connect(dest);
      src.start();
      return { source: src, gain: g };
    },

    thunder(c, dest) {
      const buf = createNoiseBuffer(4, 'brown');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 200;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.15;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 0.4;
      lfo.connect(lfoGain);
      const g = c.createGain(); g.gain.value = 0.3;
      lfoGain.connect(g.gain);
      src.connect(lp).connect(g).connect(dest);
      lfo.start();
      src.start();
      return { source: src, gain: g, extras: [lfo] };
    },

    fire(c, dest) {
      const buf = createNoiseBuffer(4, 'brown');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.5;
      const lfo = c.createOscillator();
      lfo.frequency.value = 3;
      const lfoG = c.createGain();
      lfoG.gain.value = 0.15;
      lfo.connect(lfoG);
      const g = c.createGain(); g.gain.value = 0.5;
      lfoG.connect(g.gain);
      src.connect(bp).connect(g).connect(dest);
      lfo.start(); src.start();
      return { source: src, gain: g, extras: [lfo] };
    },

    birds(c, dest) {
      const g = c.createGain(); g.gain.value = 0.3;
      g.connect(dest);
      const chirpLoop = [];
      function makeChirp() {
        const osc = c.createOscillator();
        osc.type = 'sine';
        const base = 1800 + Math.random() * 2400;
        osc.frequency.value = base;
        const cg = c.createGain(); cg.gain.value = 0;
        osc.connect(cg).connect(g);
        osc.start();
        function doChirp() {
          const now = c.currentTime;
          const dur = 0.05 + Math.random() * 0.1;
          osc.frequency.setValueAtTime(base + Math.random() * 500, now);
          osc.frequency.linearRampToValueAtTime(base + Math.random() * 800, now + dur);
          cg.gain.setValueAtTime(0, now);
          cg.gain.linearRampToValueAtTime(0.15, now + dur * 0.3);
          cg.gain.linearRampToValueAtTime(0, now + dur);
          const next = 0.3 + Math.random() * 2;
          const tid = setTimeout(doChirp, next * 1000);
          chirpLoop.push(tid);
        }
        setTimeout(doChirp, Math.random() * 2000);
        return osc;
      }
      const oscs = [makeChirp(), makeChirp(), makeChirp()];
      return { source: oscs[0], gain: g, extras: oscs, timers: chirpLoop };
    },

    waves(c, dest) {
      const buf = createNoiseBuffer(4, 'pink');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1200;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.08;
      const lfoG = c.createGain(); lfoG.gain.value = 800;
      lfo.connect(lfoG).connect(lp.frequency);
      const g = c.createGain(); g.gain.value = 0.5;
      src.connect(lp).connect(g).connect(dest);
      lfo.start(); src.start();
      return { source: src, gain: g, extras: [lfo] };
    },

    wind(c, dest) {
      const buf = createNoiseBuffer(4, 'white');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.3;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.2;
      const lfoG = c.createGain(); lfoG.gain.value = 400;
      lfo.connect(lfoG).connect(bp.frequency);
      const g = c.createGain(); g.gain.value = 0.35;
      src.connect(bp).connect(g).connect(dest);
      lfo.start(); src.start();
      return { source: src, gain: g, extras: [lfo] };
    },

    cafe(c, dest) {
      const buf = createNoiseBuffer(4, 'pink');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.3;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 4000;
      const g = c.createGain(); g.gain.value = 0.25;
      src.connect(bp).connect(lp).connect(g).connect(dest);
      src.start();
      return { source: src, gain: g };
    },

    train(c, dest) {
      const buf = createNoiseBuffer(4, 'brown');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 500;
      const lfo = c.createOscillator();
      lfo.frequency.value = 2.5;
      const lfoG = c.createGain(); lfoG.gain.value = 0.2;
      lfo.connect(lfoG);
      const g = c.createGain(); g.gain.value = 0.35;
      lfoG.connect(g.gain);
      src.connect(lp).connect(g).connect(dest);
      lfo.start(); src.start();
      return { source: src, gain: g, extras: [lfo] };
    },

    insects(c, dest) {
      const g = c.createGain(); g.gain.value = 0.15;
      g.connect(dest);
      const oscs = [];
      for (let i = 0; i < 3; i++) {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 4000 + Math.random() * 3000;
        const am = c.createOscillator();
        am.frequency.value = 5 + Math.random() * 15;
        const amG = c.createGain(); amG.gain.value = 0.5;
        am.connect(amG);
        const og = c.createGain(); og.gain.value = 0;
        amG.connect(og.gain);
        osc.connect(og).connect(g);
        osc.start(); am.start();
        oscs.push(osc, am);
      }
      return { source: oscs[0], gain: g, extras: oscs };
    },

    clock(c, dest) {
      const g = c.createGain(); g.gain.value = 0.3;
      g.connect(dest);
      const timers = [];
      function tick() {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 800;
        const eg = c.createGain();
        const now = c.currentTime;
        eg.gain.setValueAtTime(0.3, now);
        eg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(eg).connect(g);
        osc.start(now);
        osc.stop(now + 0.06);
        timers.push(setTimeout(tick, 1000));
      }
      tick();
      return { source: null, gain: g, timers };
    },

    river(c, dest) {
      const buf = createNoiseBuffer(4, 'pink');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2500;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 300;
      const g = c.createGain(); g.gain.value = 0.4;
      src.connect(lp).connect(hp).connect(g).connect(dest);
      src.start();
      return { source: src, gain: g };
    },

    keyboard(c, dest) {
      const g = c.createGain(); g.gain.value = 0.2;
      g.connect(dest);
      const timers = [];
      function key() {
        const osc = c.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 2000 + Math.random() * 3000;
        const eg = c.createGain();
        const now = c.currentTime;
        eg.gain.setValueAtTime(0.12, now);
        eg.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.connect(eg).connect(g);
        osc.start(now);
        osc.stop(now + 0.04);
        const next = 80 + Math.random() * 300;
        timers.push(setTimeout(key, next));
      }
      key();
      return { source: null, gain: g, timers };
    },
  };

  // ===== 公開API =====
  return {
    play(id) {
      if (sources[id]) return;
      const c = ensureContext();
      const synth = SYNTHS[id];
      if (!synth) return;
      sources[id] = synth(c, masterGain);
    },

    stop(id) {
      const s = sources[id];
      if (!s) return;
      try { if (s.source) s.source.stop(); } catch(e) {}
      if (s.extras) s.extras.forEach(e => { try { e.stop(); } catch(ex) {} });
      if (s.timers) s.timers.forEach(t => clearTimeout(t));
      try { if (s.gain) s.gain.disconnect(); } catch(e) {}
      delete sources[id];
    },

    stopAll() {
      Object.keys(sources).forEach(id => this.stop(id));
    },

    setVolume(id, vol) {
      const s = sources[id];
      if (s && s.gain) {
        s.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
      }
    },

    setMasterVolume(vol) {
      ensureContext();
      masterGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
    },

    isPlaying(id) { return !!sources[id]; },
  };
})();
