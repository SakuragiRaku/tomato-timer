// app.js - トマトタイマー メインロジック

(function() {
  'use strict';

  // ===== 状態管理 =====
  const STATE_KEY = 'tomato-timer-state';
  const STATS_KEY = 'tomato-timer-stats';

  const defaultSettings = {
    focusDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    notification: true,
    autoStart: false,
  };

  let settings = { ...defaultSettings };
  let timerState = {
    type: 'focus', // focus, break, long-break
    remaining: settings.focusDuration * 60,
    total: settings.focusDuration * 60,
    isRunning: false,
    pomodoroCount: 0,
    currentPreset: 'none',
  };
  let timerInterval = null;
  let tasks = [];

  // ===== DOM要素 =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    app: $('#app'),
    timerTime: $('#timer-time'),
    timerLabel: $('#timer-label'),
    timerProgress: $('#timer-progress'),
    btnStart: $('#btn-start'),
    btnReset: $('#btn-reset'),
    btnSkip: $('#btn-skip'),
    iconPlay: $('.icon-play'),
    iconPause: $('.icon-pause'),
    pomodoroCount: $('#pomodoro-count'),
    taskInput: $('#task-input'),
    taskAddBtn: $('#task-add-btn'),
    taskList: $('#task-list'),
    presetChips: $('#preset-chips'),
    themeToggle: $('#theme-toggle'),
    // Stats
    statToday: $('#stat-today'),
    statWeek: $('#stat-week'),
    statTotal: $('#stat-total'),
    statPomodoros: $('#stat-pomodoros'),
    weeklyChart: $('#weekly-chart'),
    // Settings
    settingFocus: $('#setting-focus'),
    settingBreak: $('#setting-break'),
    settingLongBreak: $('#setting-long-break'),
    settingLongBreakInterval: $('#setting-long-break-interval'),
    settingNotification: $('#setting-notification'),
    settingAutoStart: $('#setting-auto-start'),
  };

  // ===== 初期化 =====
  function init() {
    loadState();
    loadSettings();
    setupEventListeners();
    setupPresetChips();
    renderTimer();
    renderTasks();
    renderPomodoroCount();
    applyTheme();
    applySettingsToUI();
  }

  // ===== ストレージ =====
  function loadState() {
    try {
      const data = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      tasks = data.tasks || [];
      timerState.pomodoroCount = data.pomodoroCount || 0;
      timerState.currentPreset = data.currentPreset || 'none';
    } catch { /* ignore */ }
  }

  function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      tasks,
      pomodoroCount: timerState.pomodoroCount,
      currentPreset: timerState.currentPreset,
    }));
  }

  function loadSettings() {
    try {
      const data = JSON.parse(localStorage.getItem('tomato-timer-settings') || '{}');
      settings = { ...defaultSettings, ...data };
    } catch { /* ignore */ }
    timerState.remaining = settings.focusDuration * 60;
    timerState.total = settings.focusDuration * 60;
  }

  function saveSettings() {
    localStorage.setItem('tomato-timer-settings', JSON.stringify(settings));
  }

  // ===== 統計データ =====
  function getStats() {
    try {
      return JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    } catch { return {}; }
  }

  function recordSession(minutes) {
    const stats = getStats();
    const today = new Date().toISOString().slice(0, 10);
    if (!stats[today]) stats[today] = { minutes: 0, pomodoros: 0 };
    stats[today].minutes += minutes;
    stats[today].pomodoros += 1;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  // ===== タイマーロジック =====
  function startTimer() {
    if (timerState.isRunning) {
      pauseTimer();
      return;
    }

    // AudioContextのresume（ユーザーインタラクション必須）
    if (typeof audioEngine !== 'undefined') {
      audioEngine.resume();
    }

    timerState.isRunning = true;
    els.iconPlay.classList.add('hidden');
    els.iconPause.classList.remove('hidden');

    // 環境音再生（集中タイム時）
    if (timerState.type === 'focus' && timerState.currentPreset !== 'none') {
      playPreset(timerState.currentPreset);
    }

    timerInterval = setInterval(() => {
      timerState.remaining--;
      renderTimer();

      if (timerState.remaining <= 0) {
        completeSession();
      }
    }, 1000);
  }

  function pauseTimer() {
    timerState.isRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    els.iconPlay.classList.remove('hidden');
    els.iconPause.classList.add('hidden');
  }

  function resetTimer() {
    pauseTimer();
    stopAmbientSound();
    setSessionDuration();
    renderTimer();
  }

  function skipSession() {
    completeSession();
  }

  function completeSession() {
    pauseTimer();
    stopAmbientSound();

    if (timerState.type === 'focus') {
      timerState.pomodoroCount++;
      recordSession(settings.focusDuration);
      renderPomodoroCount();
      saveState();

      // 通知
      sendNotification('🍅 集中タイム終了！', '休憩を取りましょう。');

      // 次は休憩
      if (timerState.pomodoroCount % settings.longBreakInterval === 0) {
        switchSession('long-break');
      } else {
        switchSession('break');
      }
    } else {
      sendNotification('☕ 休憩終了！', '次の集中タイムを始めましょう。');
      switchSession('focus');
    }

    if (settings.autoStart) {
      setTimeout(() => startTimer(), 500);
    }
  }

  function switchSession(type) {
    timerState.type = type;
    els.app.setAttribute('data-session', type);

    $$('.session-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.type === type);
    });

    setSessionDuration();
    renderTimer();
  }

  function setSessionDuration() {
    let minutes;
    switch (timerState.type) {
      case 'focus': minutes = settings.focusDuration; break;
      case 'break': minutes = settings.breakDuration; break;
      case 'long-break': minutes = settings.longBreakDuration; break;
    }
    timerState.remaining = minutes * 60;
    timerState.total = minutes * 60;
  }

  // ===== レンダリング =====
  function renderTimer() {
    const mins = Math.floor(timerState.remaining / 60);
    const secs = timerState.remaining % 60;
    els.timerTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // プログレスリング
    const circumference = 2 * Math.PI * 120;
    const progress = timerState.remaining / timerState.total;
    const offset = circumference * (1 - progress);
    els.timerProgress.style.strokeDasharray = circumference;
    els.timerProgress.style.strokeDashoffset = offset;

    // ラベル
    const labels = { focus: '集中タイム', break: '☕ 休憩', 'long-break': '🌿 長休憩' };
    els.timerLabel.textContent = labels[timerState.type];

    // タイトル更新
    document.title = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} - トマトタイマー`;
  }

  function renderPomodoroCount() {
    const count = timerState.pomodoroCount;
    const tomatoes = '🍅'.repeat(Math.min(count, 12));
    const extra = count > 12 ? ` +${count - 12}` : '';
    els.pomodoroCount.querySelector('.tomato-icons').textContent = tomatoes + extra || '---';
  }

  // ===== タスク管理 =====
  function addTask(text) {
    if (!text.trim()) return;
    tasks.push({
      id: Date.now(),
      text: text.trim(),
      completed: false,
      pomodoros: 0,
    });
    saveState();
    renderTasks();
    els.taskInput.value = '';
  }

  function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      saveState();
      renderTasks();
    }
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveState();
    renderTasks();
  }

  function renderTasks() {
    els.taskList.innerHTML = tasks.map(task => `
      <li class="task-item" data-id="${task.id}">
        <button class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggle">
          ${task.completed ? '✓' : ''}
        </button>
        <span class="task-text ${task.completed ? 'completed' : ''}">${escapeHtml(task.text)}</span>
        <span class="task-pomodoros">🍅${task.pomodoros}</span>
        <button class="task-delete" data-action="delete">✕</button>
      </li>
    `).join('');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== 環境音 =====
  function setupPresetChips() {
    if (typeof DEFAULT_PRESETS === 'undefined') return;

    const chips = [{ id: 'none', name: 'なし', icon: '' }]
      .concat(getAllPresets());

    els.presetChips.innerHTML = chips.map(p => `
      <button class="preset-chip ${timerState.currentPreset === p.id ? 'active' : ''}" data-preset="${p.id}">
        ${p.icon || ''} ${p.name}
      </button>
    `).join('');
  }

  async function playPreset(presetId) {
    if (typeof audioEngine === 'undefined' || presetId === 'none') return;

    await audioEngine.init();

    const presets = getAllPresets();
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    // 音源を読み込み
    for (const s of preset.sounds) {
      const soundDef = SOUND_LIBRARY.find(lib => lib.id === s.id);
      if (soundDef && !audioEngine.buffers[s.id]) {
        await audioEngine.loadSound(s.id, `sounds/${soundDef.file}`);
      }
    }

    audioEngine.applyPreset(preset);
  }

  function stopAmbientSound() {
    if (typeof audioEngine !== 'undefined') {
      audioEngine.stopAll();
    }
  }

  // ===== 通知 =====
  function sendNotification(title, body) {
    if (!settings.notification) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '🍅' });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          new Notification(title, { body, icon: '🍅' });
        }
      });
    }
  }

  // ===== テーマ =====
  function applyTheme() {
    const theme = localStorage.getItem('tomato-theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    els.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('tomato-theme', next);
    els.themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  }

  // ===== 設定UI =====
  function applySettingsToUI() {
    els.settingFocus.value = settings.focusDuration;
    els.settingBreak.value = settings.breakDuration;
    els.settingLongBreak.value = settings.longBreakDuration;
    els.settingLongBreakInterval.value = settings.longBreakInterval;
    els.settingNotification.checked = settings.notification;
    els.settingAutoStart.checked = settings.autoStart;
  }

  function updateSettingFromUI() {
    settings.focusDuration = parseInt(els.settingFocus.value) || 25;
    settings.breakDuration = parseInt(els.settingBreak.value) || 5;
    settings.longBreakDuration = parseInt(els.settingLongBreak.value) || 15;
    settings.longBreakInterval = parseInt(els.settingLongBreakInterval.value) || 4;
    settings.notification = els.settingNotification.checked;
    settings.autoStart = els.settingAutoStart.checked;
    saveSettings();

    if (!timerState.isRunning) {
      setSessionDuration();
      renderTimer();
    }
  }

  // ===== 統計レンダリング =====
  function renderStats() {
    const stats = getStats();
    const today = new Date().toISOString().slice(0, 10);

    // 今日
    const todayData = stats[today] || { minutes: 0, pomodoros: 0 };
    els.statToday.textContent = todayData.minutes;

    // 今週
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    let weekMinutes = 0;
    let totalMinutes = 0;
    let totalPomodoros = 0;

    Object.entries(stats).forEach(([date, data]) => {
      totalMinutes += data.minutes;
      totalPomodoros += data.pomodoros;
      if (new Date(date) >= weekStart) {
        weekMinutes += data.minutes;
      }
    });

    els.statWeek.textContent = weekMinutes;
    els.statTotal.textContent = totalMinutes;
    els.statPomodoros.textContent = totalPomodoros;

    // 今週のチャート
    drawWeeklyChart(stats);
  }

  function drawWeeklyChart(stats) {
    const canvas = els.weeklyChart;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = 250 * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth;
    const h = 250;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };

    ctx.clearRect(0, 0, w, h);

    // 今週のデータ
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const today = new Date();
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      weekData.push({
        label: days[d.getDay()],
        value: stats[key]?.minutes || 0,
        isToday: i === 0,
      });
    }

    const maxValue = Math.max(...weekData.map(d => d.value), 30);
    const barWidth = (w - padding.left - padding.right) / 7 * 0.6;
    const gap = (w - padding.left - padding.right) / 7;

    // Y軸(グリッドライン)
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-muted').trim();
    const gridColor = style.getPropertyValue('--border').trim();
    const accentColor = style.getPropertyValue('--accent').trim();

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.fillStyle = textColor;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (h - padding.top - padding.bottom) * (1 - i / 4);
      const val = Math.round(maxValue * i / 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${val}`, padding.left - 8, y + 4);
    }

    // バー
    weekData.forEach((d, i) => {
      const x = padding.left + gap * i + (gap - barWidth) / 2;
      const barH = (d.value / maxValue) * (h - padding.top - padding.bottom);
      const y = h - padding.bottom - barH;

      // バーのグラデーション
      const gradient = ctx.createLinearGradient(x, y, x, h - padding.bottom);
      if (d.isToday) {
        gradient.addColorStop(0, accentColor);
        gradient.addColorStop(1, accentColor + '80');
      } else {
        gradient.addColorStop(0, accentColor + '60');
        gradient.addColorStop(1, accentColor + '20');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
      ctx.fill();

      // ラベル
      ctx.fillStyle = d.isToday ? accentColor : textColor;
      ctx.font = d.isToday ? 'bold 12px Inter, sans-serif' : '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barWidth / 2, h - padding.bottom + 20);

      // 値表示
      if (d.value > 0) {
        ctx.fillStyle = textColor;
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(`${d.value}分`, x + barWidth / 2, y - 6);
      }
    });
  }

  // ===== イベントリスナー =====
  function setupEventListeners() {
    // ナビゲーション
    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.view').forEach(v => v.classList.remove('active'));
        $(`#view-${btn.dataset.view}`).classList.add('active');

        if (btn.dataset.view === 'stats') renderStats();
      });
    });

    // セッションタブ
    $$('.session-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (timerState.isRunning) return;
        switchSession(tab.dataset.type);
      });
    });

    // タイマーボタン
    els.btnStart.addEventListener('click', startTimer);
    els.btnReset.addEventListener('click', resetTimer);
    els.btnSkip.addEventListener('click', skipSession);

    // タスク
    els.taskAddBtn.addEventListener('click', () => addTask(els.taskInput.value));
    els.taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTask(els.taskInput.value);
    });

    els.taskList.addEventListener('click', (e) => {
      const item = e.target.closest('.task-item');
      if (!item) return;
      const id = parseInt(item.dataset.id);
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'toggle') toggleTask(id);
      if (action === 'delete') deleteTask(id);
    });

    // プリセット
    els.presetChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.preset-chip');
      if (!chip) return;

      $$('.preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      timerState.currentPreset = chip.dataset.preset;
      saveState();

      if (timerState.isRunning && timerState.type === 'focus') {
        stopAmbientSound();
        if (timerState.currentPreset !== 'none') {
          playPreset(timerState.currentPreset);
        }
      }
    });

    // テーマ
    els.themeToggle.addEventListener('click', toggleTheme);

    // 設定
    ['settingFocus', 'settingBreak', 'settingLongBreak', 'settingLongBreakInterval'].forEach(key => {
      els[key].addEventListener('change', updateSettingFromUI);
    });
    els.settingNotification.addEventListener('change', updateSettingFromUI);
    els.settingAutoStart.addEventListener('change', updateSettingFromUI);

    // 通知許可リクエスト
    if (settings.notification && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  // ===== 起動 =====
  document.addEventListener('DOMContentLoaded', init);
})();
