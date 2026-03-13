// presets.js
// 環境音プリセット定義
// トマトタイマー & ゆらぎめーかー で共有

const SOUND_LIBRARY = [
  { id: 'rain',       name: '雨',       icon: '🌧️',  file: 'rain.mp3',       category: 'nature' },
  { id: 'thunder',    name: '雷',       icon: '⚡',   file: 'thunder.mp3',    category: 'nature' },
  { id: 'fire',       name: '焚き火',   icon: '🔥',   file: 'fire.mp3',       category: 'nature' },
  { id: 'birds',      name: '鳥',       icon: '🐦',   file: 'birds.mp3',      category: 'nature' },
  { id: 'waves',      name: '波',       icon: '🌊',   file: 'waves.mp3',      category: 'nature' },
  { id: 'wind',       name: '風',       icon: '💨',   file: 'wind.mp3',       category: 'nature' },
  { id: 'cafe',       name: 'カフェ',   icon: '☕',   file: 'cafe.mp3',       category: 'ambient' },
  { id: 'train',      name: '電車',     icon: '🚃',   file: 'train.mp3',      category: 'ambient' },
  { id: 'insects',    name: '虫の声',   icon: '🦗',   file: 'insects.mp3',    category: 'nature' },
  { id: 'clock',      name: '時計',     icon: '🕐',   file: 'clock.mp3',      category: 'ambient' },
  { id: 'river',      name: '川',       icon: '🏞️',  file: 'river.mp3',      category: 'nature' },
  { id: 'keyboard',   name: 'キーボード', icon: '⌨️', file: 'keyboard.mp3',   category: 'ambient' },
];

const DEFAULT_PRESETS = [
  {
    id: 'rainy-cafe',
    name: '雨の日のカフェ',
    icon: '🌧️☕',
    masterVolume: 0.7,
    sounds: [
      { id: 'rain', volume: 0.6 },
      { id: 'cafe', volume: 0.4 },
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
      { id: 'insects', volume: 0.2 },
    ]
  },
  {
    id: 'campfire',
    name: 'キャンプファイヤー',
    icon: '🔥🌙',
    masterVolume: 0.7,
    sounds: [
      { id: 'fire', volume: 0.7 },
      { id: 'insects', volume: 0.2 },
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
      { id: 'rain', volume: 0.4 },
      { id: 'clock', volume: 0.2 },
    ]
  },
  {
    id: 'night',
    name: '夜の静けさ',
    icon: '🌙🦗',
    masterVolume: 0.5,
    sounds: [
      { id: 'insects', volume: 0.4 },
      { id: 'wind', volume: 0.15 },
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
