// audio-engine.js
// 環境音の再生/停止/音量制御のコアロジック
// トマトタイマー & ゆらぎめーかー で共有

class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.sounds = {};
    this.gainNodes = {};
    this.sourceNodes = {};
    this.buffers = {};
    this.masterGain = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    this.masterGain.gain.value = 0.7;
    this.isInitialized = true;
  }

  async loadSound(id, url) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.buffers[id] = audioBuffer;
      return true;
    } catch (error) {
      console.warn(`音源の読み込みに失敗: ${id}`, error);
      return false;
    }
  }

  play(id) {
    if (!this.buffers[id] || !this.isInitialized) return;

    this.stop(id);

    const source = this.audioContext.createBufferSource();
    source.buffer = this.buffers[id];
    source.loop = true;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.gainNodes[id]?.gain?.value ?? 0.5;

    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    source.start(0);

    this.sourceNodes[id] = source;
    this.gainNodes[id] = gainNode;
  }

  stop(id) {
    if (this.sourceNodes[id]) {
      try {
        this.sourceNodes[id].stop();
      } catch (e) {
        // already stopped
      }
      this.sourceNodes[id].disconnect();
      delete this.sourceNodes[id];
    }
  }

  stopAll() {
    Object.keys(this.sourceNodes).forEach(id => this.stop(id));
  }

  setVolume(id, volume) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (this.gainNodes[id]) {
      this.gainNodes[id].gain.value = clampedVolume;
    }
  }

  setMasterVolume(volume) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = clampedVolume;
    }
  }

  getMasterVolume() {
    return this.masterGain ? this.masterGain.gain.value : 0.7;
  }

  isPlaying(id) {
    return !!this.sourceNodes[id];
  }

  getActiveSounds() {
    return Object.keys(this.sourceNodes);
  }

  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // プリセットの適用
  applyPreset(preset) {
    this.stopAll();
    if (!preset || !preset.sounds) return;

    preset.sounds.forEach(s => {
      this.setVolume(s.id, s.volume);
      this.play(s.id);
    });

    if (preset.masterVolume !== undefined) {
      this.setMasterVolume(preset.masterVolume);
    }
  }
}

// シングルトンとしてエクスポート
const audioEngine = new AudioEngine();
