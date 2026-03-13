// presets.js
// 環境音プリセット定義
// トマトタイマー & ゆらぎめーかー で共有

const SOUND_LIBRARY = [
  { id: 'rain',    name: '雨',      icon: '🌧️',  file: 'rain.mp3'  },
  { id: 'fire',    name: '焚き火',   icon: '🔥',  file: 'fire.mp3'  },
  { id: 'birds',   name: '鳥',      icon: '🐦',  file: 'birds.mp3' },
  { id: 'waves',   name: '波',      icon: '🌊',  file: 'waves.mp3' },
  { id: 'wind',    name: '風',      icon: '🍃',  file: 'wind.mp3'  },
];

const DEFAULT_PRESETS = [
  {
    id: 'rainy-day',
    name: '雨の日',
    icon: '🌧️🍃',
    masterVolume: 0.7,
    sounds: [
      { id: 'rain', volume: 0.6 },
      { id: 'wind', volume: 0.2 },
    ]
  },
  {
    id: 'forest',
    name: '森の中',
    icon: '🌲🐦',
    masterVolume: 0.6,
    sounds: [
      { id: 'birds', volume: 0.5 },
      { id: 'wind', volume: 0.3 },
    ]
  },
  {
    id: 'campfire',
    name: 'キャンプファイヤー',
    icon: '🔥🌙',
    masterVolume: 0.7,
    sounds: [
      { id: 'fire', volume: 0.7 },
      { id: 'wind', volume: 0.15 },
    ]
  },
  {
    id: 'ocean',
    name: '海辺',
    icon: '🌊🐚',
    masterVolume: 0.6,
    sounds: [
      { id: 'waves', volume: 0.7 },
      { id: 'wind', volume: 0.25 },
      { id: 'birds', volume: 0.15 },
    ]
  },
  {
    id: 'deep-focus',
    name: '集中モード',
    icon: '🎯✨',
    masterVolume: 0.5,
    sounds: [
      { id: 'rain', volume: 0.5 },
    ]
  },
];

// ユーザープリセットの保存/読み込み
function loadUserPresets() {
  try {
    const data = localStorage.getItem('yuragi-presets');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveUserPresets(presets) {
  localStorage.setItem('yuragi-presets', JSON.stringify(presets));
}

function getAllPresets() {
  return [...DEFAULT_PRESETS, ...loadUserPresets()];
}
