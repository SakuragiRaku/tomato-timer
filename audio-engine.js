// audio-engine.js - Web Audio API 環境音合成エンジン
// mp3ファイル不要。ブラウザ内で環境音をリアルタイム合成する。

const AudioEngine = (function() {
  'use strict';

  let ctx = null;
  let masterGain = null;
  const activeSources = {};

  function getContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.7;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  // ===== ノイズバッファ生成 =====
  function makeNoise(seconds, type) {
    const c = getContext();
    const rate = c.sampleRate;
    const length = rate * seconds;
    const buffer = c.createBuffer(2, length, rate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);

      if (type === 'white') {
        for (let i = 0; i < length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      } else if (type === 'brown') {
        let last = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.5;
        }
      } else if (type === 'pink') {
        let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886*b0 + white*0.0555179;
          b1 = 0.99332*b1 + white*0.0750759;
          b2 = 0.96900*b2 + white*0.1538520;
          b3 = 0.86650*b3 + white*0.3104856;
          b4 = 0.55000*b4 + white*0.5329522;
          b5 = -0.7616*b5 - white*0.0168980;
          data[i] = (b0+b1+b2+b3+b4+b5+b6+white*0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      }
    }
    return buffer;
  }

  // ===== ノイズベースの音を作る共通関数 =====
  function createNoiseSound(c, dest, noiseType, filterType, filterFreq, filterQ, gainVal, lfoFreq, lfoAmount) {
    const buf = makeNoise(4, noiseType);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    if (filterQ) filter.Q.value = filterQ;

    const gain = c.createGain();
    gain.gain.value = gainVal;

    const nodes = [src];

    if (lfoFreq) {
      const lfo = c.createOscillator();
      lfo.frequency.value = lfoFreq;
      const lfoGain = c.createGain();
      lfoGain.gain.value = lfoAmount || 0.3;
      lfo.connect(lfoGain);
      if (filterType === 'bandpass' || filterType === 'lowpass' || filterType === 'highpass') {
        lfoGain.connect(filter.frequency);
      } else {
        lfoGain.connect(gain.gain);
      }
      lfo.start();
      nodes.push(lfo);
    }

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start();

    return { nodes, gain };
  }

  // ===== 各環境音の合成レシピ =====
  const recipes = {
    rain(c, dest) {
      const buf = makeNoise(4, 'pink');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;

      const hp = c.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 800;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 8000;
      const g = c.createGain(); g.gain.value = 0.6;

      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(dest);
      src.start();
      return { nodes: [src], gain: g };
    },

    thunder(c, dest) {
      const buf = makeNoise(4, 'brown');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;

      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 200;

      const lfo = c.createOscillator();
      lfo.frequency.value = 0.15;
      const lfoG = c.createGain(); lfoG.gain.value = 0.4;
      lfo.connect(lfoG);

      const g = c.createGain(); g.gain.value = 0.3;
      lfoG.connect(g.gain);

      src.connect(lp); lp.connect(g); g.connect(dest);
      lfo.start(); src.start();
      return { nodes: [src, lfo], gain: g };
    },

    fire(c, dest) {
      const buf = makeNoise(4, 'brown');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;

      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.5;

      const lfo = c.createOscillator();
      lfo.frequency.value = 3;
      const lfoG = c.createGain(); lfoG.gain.value = 300;
      lfo.connect(lfoG); lfoG.connect(bp.frequency);

      const g = c.createGain(); g.gain.value = 0.5;

      src.connect(bp); bp.connect(g); g.connect(dest);
      lfo.start(); src.start();
      return { nodes: [src, lfo], gain: g };
    },

    birds(c, dest) {
      const g = c.createGain(); g.gain.value = 0.3;
      g.connect(dest);

      const timers = [];
      const oscs = [];

      for (let i = 0; i < 3; i++) {
        const osc = c.createOscillator();
        osc.type = 'sine';
        const freq = 1800 + Math.random() * 2400;
        osc.frequency.value = freq;
        const eg = c.createGain(); eg.gain.value = 0;
        osc.connect(eg); eg.connect(g);
        osc.start();
        oscs.push(osc);

        function chirp() {
          const now = c.currentTime;
          const dur = 0.05 + Math.random() * 0.1;
          osc.frequency.setValueAtTime(freq + Math.random() * 500, now);
          osc.frequency.linearRampToValueAtTime(freq + Math.random() * 800, now + dur);
          eg.gain.setValueAtTime(0.15, now);
          eg.gain.linearRampToValueAtTime(0.001, now + dur);
          timers.push(setTimeout(chirp, (0.3 + Math.random() * 2) * 1000));
        }
        timers.push(setTimeout(chirp, Math.random() * 2000));
      }

      return { nodes: oscs, gain: g, timers };
    },

    waves(c, dest) {
      const buf = makeNoise(4, 'pink');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;

      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1200;

      const lfo = c.createOscillator();
      lfo.frequency.value = 0.08;
      const lfoG = c.createGain(); lfoG.gain.value = 800;
      lfo.connect(lfoG); lfoG.connect(lp.frequency);

      const g = c.createGain(); g.gain.value = 0.5;

      src.connect(lp); lp.connect(g); g.connect(dest);
      lfo.start(); src.start();
      return { nodes: [src, lfo], gain: g };
    },

    wind(c, dest) {
      const buf = makeNoise(4, 'white');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;

      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.3;

      const lfo = c.createOscillator();
      lfo.frequency.value = 0.2;
      const lfoG = c.createGain(); lfoG.gain.value = 400;
      lfo.connect(lfoG); lfoG.connect(bp.frequency);

      const g = c.createGain(); g.gain.value = 0.35;

      src.connect(bp); bp.connect(g); g.connect(dest);
      lfo.start(); src.start();
      return { nodes: [src, lfo], gain: g };
    },

    cafe(c, dest) {
      const buf = makeNoise(4, 'pink');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;

      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.3;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 4000;

      const g = c.createGain(); g.gain.value = 0.25;

      src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(dest);
      src.start();
      return { nodes: [src], gain: g };
    },

    train(c, dest) {
      const buf = makeNoise(4, 'brown');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;

      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 500;

      const lfo = c.createOscillator();
      lfo.frequency.value = 2.5;
      const lfoG = c.createGain(); lfoG.gain.value = 0.2;
      lfo.connect(lfoG); lfoG.connect(lp.frequency);

      const g = c.createGain(); g.gain.value = 0.35;

      src.connect(lp); lp.connect(g); g.connect(dest);
      lfo.start(); src.start();
      return { nodes: [src, lfo], gain: g };
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
        osc.connect(og); og.connect(g);
        osc.start(); am.start();
        oscs.push(osc, am);
      }

      return { nodes: oscs, gain: g };
    },

    clock(c, dest) {
      const g = c.createGain(); g.gain.value = 0.3;
      g.connect(dest);
      const timers = [];

      function tick() {
        if (!activeSources.clock) return;
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 800;
        const eg = c.createGain();
        const now = c.currentTime;
        eg.gain.setValueAtTime(0.3, now);
        eg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(eg); eg.connect(g);
        osc.start(now);
        osc.stop(now + 0.06);
        timers.push(setTimeout(tick, 1000));
      }
      tick();
      return { nodes: [], gain: g, timers };
    },

    river(c, dest) {
      const buf = makeNoise(4, 'pink');
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;

      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2500;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 300;

      const g = c.createGain(); g.gain.value = 0.4;

      src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(dest);
      src.start();
      return { nodes: [src], gain: g };
    },

    keyboard(c, dest) {
      const g = c.createGain(); g.gain.value = 0.2;
      g.connect(dest);
      const timers = [];

      function key() {
        if (!activeSources.keyboard) return;
        const osc = c.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 2000 + Math.random() * 3000;
        const eg = c.createGain();
        const now = c.currentTime;
        eg.gain.setValueAtTime(0.12, now);
        eg.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.connect(eg); eg.connect(g);
        osc.start(now);
        osc.stop(now + 0.04);
        timers.push(setTimeout(key, 80 + Math.random() * 300));
      }
      key();
      return { nodes: [], gain: g, timers };
    },
  };

  // ===== 公開API =====
  return {
    play(id) {
      if (activeSources[id]) return;
      const c = getContext();
      const recipe = recipes[id];
      if (!recipe) { console.warn('Unknown sound:', id); return; }
      activeSources[id] = recipe(c, masterGain);
    },

    stop(id) {
      const s = activeSources[id];
      if (!s) return;
      if (s.nodes) s.nodes.forEach(n => { try { n.stop(); } catch(e) {} });
      if (s.timers) s.timers.forEach(t => clearTimeout(t));
      try { if (s.gain) s.gain.disconnect(); } catch(e) {}
      delete activeSources[id];
    },

    stopAll() {
      Object.keys(activeSources).forEach(id => this.stop(id));
    },

    setVolume(id, vol) {
      const s = activeSources[id];
      if (s && s.gain) {
        s.gain.gain.cancelScheduledValues(0);
        s.gain.gain.value = vol;
      }
    },

    setMasterVolume(vol) {
      getContext();
      masterGain.gain.cancelScheduledValues(0);
      masterGain.gain.value = vol;
    },

    isPlaying(id) {
      return !!activeSources[id];
    },
  };
})();
