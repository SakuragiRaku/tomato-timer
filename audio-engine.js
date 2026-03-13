// audio-engine.js - 環境音エンジン (mp3ファイル読み込み方式)
// Pixabayのフリー音源 (Pixabay Content License) を使用

const AudioEngine = (function() {
  'use strict';

  let ctx = null;
  let masterGain = null;
  const buffers = {};
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

  async function loadSound(id, url) {
    if (buffers[id]) return;
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await getContext().decodeAudioData(arrayBuffer);
      buffers[id] = audioBuffer;
    } catch (err) {
      console.warn('Failed to load sound:', id, err);
    }
  }

  return {
    async play(id, url) {
      if (activeSources[id]) return;
      const c = getContext();
      await c.resume();

      if (!buffers[id] && url) {
        await loadSound(id, url);
      }
      if (!buffers[id]) {
        console.warn('No buffer for:', id);
        return;
      }

      const source = c.createBufferSource();
      source.buffer = buffers[id];
      source.loop = true;

      const gain = c.createGain();
      gain.gain.value = 0.5;

      source.connect(gain);
      gain.connect(masterGain);
      source.start();

      activeSources[id] = { source, gain };
    },

    stop(id) {
      const s = activeSources[id];
      if (!s) return;
      try { s.source.stop(); } catch(e) {}
      try { s.gain.disconnect(); } catch(e) {}
      delete activeSources[id];
    },

    stopAll() {
      Object.keys(activeSources).forEach(id => this.stop(id));
    },

    setVolume(id, vol) {
      const s = activeSources[id];
      if (s && s.gain) {
        s.gain.gain.value = Math.max(0, Math.min(1, vol));
      }
    },

    setMasterVolume(vol) {
      getContext();
      masterGain.gain.value = Math.max(0, Math.min(1, vol));
    },

    isPlaying(id) {
      return !!activeSources[id];
    },

    async preload(id, url) {
      getContext();
      await loadSound(id, url);
    },
  };
})();
