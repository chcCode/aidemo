/* ============================================================
 * 打地鼠 · 金山打字游戏经典还原
 * 纯前端实现：HTML + CSS + 原生 JS（WebAudio 合成音效）
 * 玩法：地鼠举字母牌钻出洞口，按对应字母键敲击得分
 * ============================================================ */
'use strict';

/* ---------------- 常量 ---------------- */
var STAGE_W = 1000;
var STAGE_H = 640;
var GAME_DURATION = 90;   // 游戏总时长（秒）
var LEVEL_TIME = 15;      // 每关时长（秒）

// 三行洞口布局：y 为容器顶部坐标，scale 模拟近大远小
var ROWS = [
  { y: 250, scale: 0.78, xs: [160, 387, 613, 840] },
  { y: 360, scale: 0.90, xs: [140, 380, 620, 860] },
  { y: 470, scale: 1.02, xs: [110, 377, 623, 890] }
];

// 关卡配置：地鼠停留时间 / 刷新间隔 / 同屏最大数量
var LEVELS = [
  { up: 2300, spawn: 1050, max: 2 },
  { up: 2000, spawn: 900,  max: 3 },
  { up: 1700, spawn: 780,  max: 3 },
  { up: 1450, spawn: 660,  max: 4 },
  { up: 1200, spawn: 560,  max: 4 },
  { up: 1000, spawn: 470,  max: 5 }
];
var MAX_LEVEL = LEVELS.length;

// 字母池：从基准键位逐步扩展到全键盘（还原打字练习的键位进阶）
var LETTER_POOLS = [
  'ASDFJKL',
  'ASDFGHJKL',
  'QWERTYUIOPASDFGHJKL',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
];

var BEST_KEY = 'whacMoleBestScore';
var SETTINGS_KEY = 'whacMoleSettings';

// 难度：影响出没频率与同屏数量
var DIFFICULTY = {
  easy:   { spawnMul: 1.25, maxOffset: -1 },
  normal: { spawnMul: 1.0,  maxOffset: 0 },
  hard:   { spawnMul: 0.8,  maxOffset: 1 }
};

// 固定键位范围（渐进模式时使用 LETTER_POOLS）
var KEY_RANGES = {
  home: 'ASDFGHJKL',
  top: 'QWERTYUIOP',
  bottom: 'ZXCVBNM',
  all: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
};

var KEYS_NOTES = {
  progressive: 'ASDF JKL 起步，随关卡逐步扩展',
  home: '仅练习基准键位 ASDF GH JKL',
  top: '仅练习上排键位 QWERTY UIOP',
  bottom: '仅练习下排键位 ZXCVBNM',
  all: '练习全部 26 个字母键位'
};

var DEFAULT_SETTINGS = {
  stayTime: 2.3,          // 地鼠停留时间（秒，第 1 关基准值）
  keyRange: 'progressive',
  difficulty: 'normal',
  sound: true
};

/* ---------------- SVG 模板 ---------------- */
var MOLE_SVG =
  '<svg class="mole-svg" viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M60 8 C88 8 102 38 102 72 C102 104 84 128 60 128 C36 128 18 104 18 72 C18 38 32 8 60 8 Z" fill="#8a6242" stroke="#5f4128" stroke-width="3"/>' +
    '<ellipse cx="60" cy="100" rx="23" ry="24" fill="#d7bd93"/>' +
    '<path d="M53 11 Q55 3 58 9 M60 10 Q62 2 64 9 M67 11 Q70 4 71 10" stroke="#5f4128" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
    '<g class="eyes-normal">' +
      '<circle cx="44" cy="46" r="6.5" fill="#ffffff" stroke="#5f4128" stroke-width="2"/>' +
      '<circle cx="76" cy="46" r="6.5" fill="#ffffff" stroke="#5f4128" stroke-width="2"/>' +
      '<circle cx="45.5" cy="47.5" r="3.2" fill="#2b1c10"/>' +
      '<circle cx="77.5" cy="47.5" r="3.2" fill="#2b1c10"/>' +
      '<circle cx="47" cy="46" r="1.2" fill="#ffffff"/>' +
      '<circle cx="79" cy="46" r="1.2" fill="#ffffff"/>' +
    '</g>' +
    '<g class="eyes-dizzy">' +
      '<path d="M38 40 L50 52 M50 40 L38 52" stroke="#2b1c10" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path d="M70 40 L82 52 M82 40 L70 52" stroke="#2b1c10" stroke-width="3.2" stroke-linecap="round"/>' +
    '</g>' +
    '<ellipse cx="33" cy="61" rx="6" ry="4" fill="#e89a8a" opacity="0.65"/>' +
    '<ellipse cx="87" cy="61" rx="6" ry="4" fill="#e89a8a" opacity="0.65"/>' +
    '<ellipse cx="60" cy="58" rx="10" ry="8" fill="#f2a0a8" stroke="#c9737c" stroke-width="2"/>' +
    '<ellipse cx="56.5" cy="55" rx="3" ry="2" fill="#ffd3d8"/>' +
    '<rect x="53" y="65" width="14" height="10" rx="2.5" fill="#ffffff" stroke="#5f4128" stroke-width="2"/>' +
    '<line x1="60" y1="65" x2="60" y2="75" stroke="#5f4128" stroke-width="2"/>' +
    '<ellipse cx="25" cy="100" rx="9" ry="7" fill="#8a6242" stroke="#5f4128" stroke-width="2.5"/>' +
    '<ellipse cx="95" cy="100" rx="9" ry="7" fill="#8a6242" stroke="#5f4128" stroke-width="2.5"/>' +
    '<g class="dizzy-stars" fill="#ffd94d" stroke="#e8a200" stroke-width="1.2">' +
      '<path transform="translate(36 14)" d="M0 -7 L2 -2.2 L7 -2.2 L3 1 L4.4 6 L0 3 L-4.4 6 L-3 1 L-7 -2.2 L-2 -2.2 Z"/>' +
      '<path transform="translate(60 5) scale(1.25)" d="M0 -7 L2 -2.2 L7 -2.2 L3 1 L4.4 6 L0 3 L-4.4 6 L-3 1 L-7 -2.2 L-2 -2.2 Z"/>' +
      '<path transform="translate(84 14)" d="M0 -7 L2 -2.2 L7 -2.2 L3 1 L4.4 6 L0 3 L-4.4 6 L-3 1 L-7 -2.2 L-2 -2.2 Z"/>' +
    '</g>' +
  '</svg>';

var HAMMER_SVG =
  '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">' +
    '<g transform="rotate(-45 50 50)">' +
      '<rect x="45" y="32" width="11" height="56" rx="5.5" fill="#d29a5b" stroke="#a8763a" stroke-width="2.5"/>' +
      '<rect x="24" y="4" width="52" height="30" rx="10" fill="#e25555"/>' +
      '<rect x="32" y="4" width="7" height="30" fill="#ffe9b0"/>' +
      '<rect x="61" y="4" width="7" height="30" fill="#ffe9b0"/>' +
      '<rect x="28" y="8" width="44" height="7" rx="3.5" fill="rgba(255,255,255,0.35)"/>' +
      '<rect x="24" y="4" width="52" height="30" rx="10" fill="none" stroke="#a83232" stroke-width="3"/>' +
    '</g>' +
  '</svg>';

/* ---------------- DOM 引用 ---------------- */
function $(id) { return document.getElementById(id); }

var stageEl = $('stage');
var shakeEl = $('shake');
var hammerEl = $('hammer');
var flashEl = $('flash');
var toastEl = $('toast');
var scoreEl = $('score');
var timeEl = $('time');
var timeFillEl = $('timefill');
var levelEl = $('level');
var comboEl = $('combo');
var countNumEl = $('count-num');

var overlayTitle = $('overlay-title');
var overlayCount = $('overlay-count');
var overlayPause = $('overlay-pause');
var overlayOver = $('overlay-over');
var overlaySettings = $('overlay-settings');

/* ---------------- 音效（WebAudio 合成） ---------------- */
var AudioFX = (function () {
  var ctx = null;
  var noiseBuf = null;
  var muted = false;

  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      var len = Math.floor(ctx.sampleRate * 0.2);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(opt) {
    if (muted) return;
    try {
      var c = ac();
      var t0 = c.currentTime + (opt.when || 0);
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = opt.type || 'square';
      o.frequency.setValueAtTime(opt.freq, t0);
      if (opt.freqEnd) o.frequency.exponentialRampToValueAtTime(opt.freqEnd, t0 + opt.dur);
      g.gain.setValueAtTime(opt.vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + opt.dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + opt.dur + 0.02);
    } catch (e) { /* 忽略音频异常 */ }
  }

  function noise(dur, vol) {
    if (muted) return;
    try {
      var c = ac();
      var s = c.createBufferSource();
      s.buffer = noiseBuf;
      var g = c.createGain();
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      s.connect(g);
      g.connect(c.destination);
      s.start();
      s.stop(c.currentTime + dur);
    } catch (e) { /* 忽略音频异常 */ }
  }

  return {
    pop: function () { tone({ freq: 420, freqEnd: 860, dur: 0.09, type: 'triangle', vol: 0.15 }); },
    bonk: function () {
      noise(0.07, 0.4);
      tone({ freq: 200, freqEnd: 70, dur: 0.16, type: 'square', vol: 0.28 });
    },
    wrong: function () { tone({ freq: 130, dur: 0.16, type: 'sawtooth', vol: 0.16 }); },
    level: function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) {
        tone({ freq: notes[i], dur: 0.1, type: 'square', vol: 0.18, when: i * 0.09 });
      }
    },
    over: function () {
      var notes = [659, 587, 523, 392];
      for (var i = 0; i < notes.length; i++) {
        tone({ freq: notes[i], dur: 0.22, type: 'triangle', vol: 0.2, when: i * 0.18 });
      }
    },
    count: function (fin) {
      tone({ freq: fin ? 880 : 440, dur: fin ? 0.35 : 0.12, type: 'square', vol: 0.22 });
    },
    tick: function () { tone({ freq: 990, dur: 0.05, type: 'square', vol: 0.12 }); },
    toggle: function () { muted = !muted; return muted; },
    set: function (m) { muted = !!m; },
    isMuted: function () { return muted; }
  };
})();

/* ---------------- 游戏状态 ---------------- */
var G = {
  state: 'title',   // title | count | play | pause | over
  score: 0,
  hits: 0,
  escaped: 0,
  wrong: 0,
  combo: 0,
  maxCombo: 0,
  level: 1,
  startAt: 0,
  endAt: 0,
  nextSpawn: 0,
  pausedAt: 0,
  countAt: 0,
  countStep: -1,
  lastTickSec: -1
};

var holes = [];

/* ---------------- 工具函数 ---------------- */
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function levelCfg(lv) {
  var base = LEVELS[Math.min(lv, MAX_LEVEL) - 1];
  var diff = DIFFICULTY[settings.difficulty] || DIFFICULTY.normal;
  return {
    up: Math.max(600, settings.stayTime * 1000 * Math.pow(0.87, lv - 1)),
    spawn: base.spawn * diff.spawnMul,
    max: Math.max(1, base.max + diff.maxOffset)
  };
}

function letterPool(lv) {
  if (settings.keyRange === 'progressive') {
    return LETTER_POOLS[Math.min(lv, MAX_LEVEL) - 1];
  }
  return KEY_RANGES[settings.keyRange] || LETTER_POOLS[0];
}

var toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1300);
}

function loadBest() {
  try {
    return parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch (e) {
    return 0;
  }
}

/* ---------------- 游戏设置 ---------------- */
function clampNum(v, min, max, dft) {
  v = parseFloat(v);
  if (isNaN(v)) return dft;
  return Math.min(max, Math.max(min, v));
}

function loadSettings() {
  var s = {};
  try {
    s = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}') || {};
  } catch (e) {
    s = {};
  }
  return {
    stayTime: clampNum(s.stayTime, 1.0, 3.0, DEFAULT_SETTINGS.stayTime),
    keyRange: ['progressive', 'home', 'top', 'bottom', 'all'].indexOf(s.keyRange) >= 0 ? s.keyRange : DEFAULT_SETTINGS.keyRange,
    difficulty: ['easy', 'normal', 'hard'].indexOf(s.difficulty) >= 0 ? s.difficulty : DEFAULT_SETTINGS.difficulty,
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound
  };
}

function saveSettings() {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) { /* 忽略存储异常 */ }
}

var settings = loadSettings();

function getRadio(name) {
  var list = document.getElementsByName(name);
  for (var i = 0; i < list.length; i++) {
    if (list[i].checked) return list[i].value;
  }
  return '';
}

function setRadio(name, value) {
  var list = document.getElementsByName(name);
  for (var i = 0; i < list.length; i++) {
    list[i].checked = (list[i].value === value);
  }
}

function syncSettingsUI() {
  $('set-stay').value = settings.stayTime;
  $('stay-val').textContent = Number(settings.stayTime).toFixed(1);
  setRadio('keys', settings.keyRange);
  setRadio('diff', settings.difficulty);
  $('set-sound').checked = settings.sound;
  $('keys-note').textContent = KEYS_NOTES[settings.keyRange];
}

function syncSoundBtn() {
  $('btn-sound').textContent = settings.sound ? '音效开' : '音效关';
}

function openSettings() {
  syncSettingsUI();
  hide(overlayTitle);
  show(overlaySettings);
}

function closeSettings() {
  settings.stayTime = clampNum($('set-stay').value, 1.0, 3.0, DEFAULT_SETTINGS.stayTime);
  settings.keyRange = getRadio('keys') || DEFAULT_SETTINGS.keyRange;
  settings.difficulty = getRadio('diff') || DEFAULT_SETTINGS.difficulty;
  settings.sound = $('set-sound').checked;
  saveSettings();
  AudioFX.set(!settings.sound);
  syncSoundBtn();
  hide(overlaySettings);
  show(overlayTitle);
}

function isSettingsOpen() {
  return !overlaySettings.classList.contains('hidden');
}

function saveBest(v) {
  try {
    window.localStorage.setItem(BEST_KEY, String(v));
  } catch (e) { /* 忽略存储异常 */ }
}

function refreshBestTitle() {
  $('best-score-title').textContent = loadBest();
}

function cleanupFx() {
  var list = document.querySelectorAll('.fx-el');
  for (var i = 0; i < list.length; i++) list[i].remove();
}

/* ---------------- 场景构建 ---------------- */
function buildHoles() {
  ROWS.forEach(function (row, r) {
    row.xs.forEach(function (x) {
      var el = document.createElement('div');
      el.className = 'hole';
      el.style.left = x + 'px';
      el.style.top = row.y + 'px';
      el.style.transform = 'translateX(-50%) scale(' + row.scale + ')';
      el.style.zIndex = String(10 + r);
      el.innerHTML =
        '<div class="hole-shadow"></div>' +
        '<div class="pit"></div>' +
        '<div class="mole-mask">' +
          '<div class="mole">' +
            '<div class="mole-inner">' +
              MOLE_SVG +
              '<div class="sign"><span class="letter"></span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="mound"></div>';
      shakeEl.appendChild(el);
      holes.push({
        el: el,
        mole: el.querySelector('.mole'),
        letterEl: el.querySelector('.letter'),
        state: 'down',   // down | up | hit | drop
        letter: '',
        poppedAt: 0,
        downAt: 0,
        phaseAt: 0
      });
    });
  });
}

/* ---------------- 特效 ---------------- */
function strikeAt(m) {
  var d = document.createElement('div');
  d.className = 'strike fx-el';
  d.innerHTML = HAMMER_SVG;
  m.el.appendChild(d);
  setTimeout(function () { d.remove(); }, 280);
}

function starBurst(m) {
  var box = document.createElement('div');
  box.className = 'burst fx-el';
  for (var i = 0; i < 5; i++) {
    var s = document.createElement('span');
    s.className = 'star';
    var ang = (-90 + (i - 2) * 36) * Math.PI / 180;
    var dist = 46 + Math.random() * 22;
    s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    box.appendChild(s);
  }
  m.el.appendChild(box);
  setTimeout(function () { box.remove(); }, 560);
}

function scorePop(m, text) {
  var d = document.createElement('div');
  d.className = 'score-pop fx-el';
  d.textContent = text;
  m.el.appendChild(d);
  setTimeout(function () { d.remove(); }, 780);
}

function puff(m, dark) {
  var d = document.createElement('div');
  d.className = 'puff fx-el' + (dark ? ' dark' : '');
  m.el.appendChild(d);
  setTimeout(function () { d.remove(); }, 500);
}

/* ---------------- 核心逻辑 ---------------- */
function trySpawn(now) {
  var cfg = levelCfg(G.level);
  var active = 0;
  var idle = [];
  var used = {};
  for (var i = 0; i < holes.length; i++) {
    var h = holes[i];
    if (h.state === 'down') {
      idle.push(h);
    } else {
      active++;
      used[h.letter] = true;
    }
  }
  if (active >= cfg.max || idle.length === 0) return;

  var m = idle[Math.floor(Math.random() * idle.length)];
  var pool = letterPool(G.level);
  var letter = '';
  for (var t = 0; t < 30; t++) {
    var c = pool.charAt(Math.floor(Math.random() * pool.length));
    if (!used[c]) { letter = c; break; }
  }
  if (!letter) {
    do {
      letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    } while (used[letter]);
  }

  m.letter = letter;
  m.letterEl.textContent = letter;
  m.state = 'up';
  m.poppedAt = now;
  m.downAt = now + cfg.up * (0.9 + Math.random() * 0.25);
  m.mole.classList.remove('drop');
  m.mole.classList.add('up');
  puff(m, true);
  AudioFX.pop();
}

function escapeMole(m, now) {
  m.state = 'drop';
  m.phaseAt = now + 160;
  m.mole.classList.remove('up');
  m.mole.classList.add('drop');
  G.escaped++;
  G.combo = 0;
  puff(m, false);
  updateHUD();
}

function hitMole(m, now) {
  m.state = 'hit';
  m.phaseAt = now + 380;
  m.mole.classList.add('hit');
  G.hits++;
  G.combo++;
  if (G.combo > G.maxCombo) G.maxCombo = G.combo;
  var pts = 10 * G.level + (G.combo >= 10 ? 10 : 0);
  G.score += pts;
  AudioFX.bonk();
  strikeAt(m);
  starBurst(m);
  scorePop(m, '+' + pts);
  updateHUD();
  comboEl.classList.remove('pulse');
  void comboEl.offsetWidth;
  comboEl.classList.add('pulse');
}

function dropMole(m, now) {
  m.mole.classList.remove('up');
  m.mole.classList.remove('hit');
  m.mole.classList.add('drop');
  m.state = 'drop';
  m.phaseAt = now + 150;
}

function resetMole(m) {
  m.mole.classList.remove('drop');
  m.state = 'down';
  m.letter = '';
}

function wrongKey() {
  G.wrong++;
  G.combo = 0;
  AudioFX.wrong();
  shakeEl.classList.remove('shake');
  void shakeEl.offsetWidth;
  shakeEl.classList.add('shake');
  flashEl.classList.add('show');
  setTimeout(function () { flashEl.classList.remove('show'); }, 160);
  updateHUD();
}

/* ---------------- 流程控制 ---------------- */
function startGame() {
  cleanupFx();
  for (var i = 0; i < holes.length; i++) {
    var m = holes[i];
    m.state = 'down';
    m.letter = '';
    m.mole.classList.remove('up');
    m.mole.classList.remove('hit');
    m.mole.classList.remove('drop');
  }
  G.score = 0;
  G.hits = 0;
  G.escaped = 0;
  G.wrong = 0;
  G.combo = 0;
  G.maxCombo = 0;
  G.level = 1;
  G.lastTickSec = -1;
  updateHUD();
  timeFillEl.style.width = '100%';
  timeFillEl.classList.remove('low');
  timeEl.textContent = GAME_DURATION;
  hide(overlayTitle);
  hide(overlayOver);
  hide(overlayPause);
  stageEl.classList.add('playing');
  G.state = 'count';
  G.countAt = performance.now();
  G.countStep = -1;
  show(overlayCount);
}

function startPlay(now) {
  G.state = 'play';
  G.startAt = now;
  G.endAt = now + GAME_DURATION * 1000;
  G.nextSpawn = now + 350;
  hide(overlayCount);
  toast('开始！');
  AudioFX.count(true);
}

function pauseGame() {
  if (G.state !== 'play') return;
  G.state = 'pause';
  G.pausedAt = performance.now();
  stageEl.classList.remove('playing');
  $('btn-pause').textContent = '继续';
  show(overlayPause);
}

function resumeGame() {
  if (G.state !== 'pause') return;
  var dt = performance.now() - G.pausedAt;
  G.startAt += dt;
  G.endAt += dt;
  G.nextSpawn += dt;
  for (var i = 0; i < holes.length; i++) {
    var m = holes[i];
    if (m.state === 'up') m.downAt += dt;
    if (m.state === 'hit' || m.state === 'drop') m.phaseAt += dt;
  }
  G.state = 'play';
  stageEl.classList.add('playing');
  $('btn-pause').textContent = '暂停';
  hide(overlayPause);
}

function rating(score, acc) {
  if (score >= 1300 && acc >= 0.9) return 'S';
  if (score >= 950) return 'A';
  if (score >= 650) return 'B';
  if (score >= 350) return 'C';
  return 'D';
}

function gameOver() {
  G.state = 'over';
  for (var i = 0; i < holes.length; i++) {
    var m = holes[i];
    m.state = 'down';
    m.mole.classList.remove('up');
    m.mole.classList.remove('hit');
    m.mole.classList.remove('drop');
  }
  stageEl.classList.remove('playing');
  $('btn-pause').textContent = '暂停';
  AudioFX.over();

  var totalKeys = G.hits + G.wrong;
  var acc = totalKeys > 0 ? Math.round(G.hits / totalKeys * 100) : 100;
  var kpm = Math.round(G.hits / (GAME_DURATION / 60));
  var grade = rating(G.score, acc / 100);

  $('final-score').textContent = G.score;
  $('final-hits').textContent = G.hits;
  $('final-escaped').textContent = G.escaped;
  $('final-acc').textContent = acc + '%';
  $('final-kpm').textContent = kpm + ' 键/分';
  $('final-combo').textContent = G.maxCombo;
  var rEl = $('final-rating');
  rEl.textContent = grade;
  rEl.className = 'rating ' + grade.toLowerCase();

  var isNew = G.score > loadBest();
  if (isNew) saveBest(G.score);
  $('new-record').classList.toggle('hidden', !isNew);
  $('best-score-over').textContent = loadBest();
  refreshBestTitle();
  show(overlayOver);
}

function backToTitle() {
  G.state = 'title';
  hide(overlayOver);
  show(overlayTitle);
  refreshBestTitle();
}

/* ---------------- HUD ---------------- */
function updateHUD() {
  scoreEl.textContent = String(G.score).padStart(6, '0');
  levelEl.textContent = G.level;
  comboEl.textContent = G.combo >= 2 ? G.combo + ' 连击!' : '';
}

function updateTime(remain) {
  var sec = Math.ceil(remain / 1000);
  timeEl.textContent = sec;
  timeFillEl.style.width = (remain / (GAME_DURATION * 1000) * 100) + '%';
  timeFillEl.classList.toggle('low', sec <= 10);
  if (sec <= 5 && sec > 0 && sec !== G.lastTickSec) {
    G.lastTickSec = sec;
    AudioFX.tick();
  }
}

function onLevelUp() {
  toast('第 ' + G.level + ' 关 · 速度加快！');
  AudioFX.level();
  updateHUD();
}

/* ---------------- 锤子（鼠标跟随） ---------------- */
var mouseX = STAGE_W / 2;
var mouseY = STAGE_H / 2;
var hammerSwingUntil = 0;

window.addEventListener('mousemove', function (e) {
  var r = stageEl.getBoundingClientRect();
  var scale = r.width / STAGE_W;
  mouseX = (e.clientX - r.left) / scale;
  mouseY = (e.clientY - r.top) / scale;
});

window.addEventListener('mousedown', function () {
  if (G.state === 'play') swingHammer();
});

function swingHammer() {
  hammerSwingUntil = performance.now() + 130;
}

function updateHammer(now) {
  if (G.state !== 'play') {
    hammerEl.style.display = 'none';
    return;
  }
  hammerEl.style.display = 'block';
  var swinging = now < hammerSwingUntil;
  hammerEl.style.transform =
    'translate(' + (mouseX - 77) + 'px, ' + (mouseY - 77) + 'px) rotate(' + (swinging ? 18 : -32) + 'deg)';
}

/* ---------------- 输入 ---------------- */
window.addEventListener('keydown', function (e) {
  if (e.repeat) return;
  var k = e.key;

  if (k === 'Escape') {
    if (isSettingsOpen()) { closeSettings(); return; }
    if (G.state === 'play') pauseGame();
    else if (G.state === 'pause') resumeGame();
    return;
  }

  if (k === 'Enter') {
    if (isSettingsOpen()) return;
    if (G.state === 'title' || G.state === 'over') startGame();
    return;
  }

  if (G.state !== 'play') return;

  if (k === ' ' || k.indexOf('Arrow') === 0) {
    e.preventDefault();
    return;
  }

  if (!/^[a-zA-Z]$/.test(k)) return;

  swingHammer();
  var letter = k.toUpperCase();
  var target = null;
  for (var i = 0; i < holes.length; i++) {
    var h = holes[i];
    if (h.state === 'up' && h.letter === letter) {
      if (!target || h.poppedAt < target.poppedAt) target = h;
    }
  }
  if (target) hitMole(target, performance.now());
  else wrongKey();
});

document.addEventListener('visibilitychange', function () {
  if (document.hidden && G.state === 'play') pauseGame();
});

/* ---------------- 主循环 ---------------- */
function loop(now) {
  requestAnimationFrame(loop);

  if (G.state === 'count') {
    var step = Math.floor((now - G.countAt) / 700);
    if (step !== G.countStep) {
      G.countStep = step;
      if (step >= 3) {
        startPlay(now);
      } else {
        countNumEl.textContent = String(3 - step);
        countNumEl.classList.remove('pop');
        void countNumEl.offsetWidth;
        countNumEl.classList.add('pop');
        AudioFX.count(false);
      }
    }
  }

  if (G.state === 'play') {
    if (now >= G.nextSpawn) {
      trySpawn(now);
      var cfg = levelCfg(G.level);
      G.nextSpawn = now + cfg.spawn * (0.7 + Math.random() * 0.6);
    }

    var lv = Math.min(MAX_LEVEL, Math.floor((now - G.startAt) / (LEVEL_TIME * 1000)) + 1);
    if (lv !== G.level) {
      G.level = lv;
      onLevelUp();
    }

    for (var i = 0; i < holes.length; i++) {
      var m = holes[i];
      if (m.state === 'up' && now >= m.downAt) escapeMole(m, now);
      else if (m.state === 'hit' && now >= m.phaseAt) dropMole(m, now);
      else if (m.state === 'drop' && now >= m.phaseAt) resetMole(m);
    }

    var remain = G.endAt - now;
    if (remain <= 0) {
      updateTime(0);
      gameOver();
    } else {
      updateTime(remain);
    }
  }

  updateHammer(now);
}

/* ---------------- 舞台缩放 ---------------- */
function fit() {
  var s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  stageEl.style.transform = 'scale(' + s + ')';
}

window.addEventListener('resize', fit);

/* ---------------- 按钮绑定 ---------------- */
function bindButtons() {
  $('btn-start').addEventListener('click', function () { this.blur(); startGame(); });
  $('btn-restart').addEventListener('click', function () { this.blur(); startGame(); });
  $('btn-back').addEventListener('click', function () { this.blur(); backToTitle(); });
  $('btn-resume').addEventListener('click', function () { this.blur(); resumeGame(); });
  $('btn-pause').addEventListener('click', function () {
    this.blur();
    if (G.state === 'play') pauseGame();
    else if (G.state === 'pause') resumeGame();
  });
  $('btn-sound').addEventListener('click', function () {
    this.blur();
    var muted = AudioFX.toggle();
    settings.sound = !muted;
    saveSettings();
    syncSoundBtn();
  });
  $('btn-settings').addEventListener('click', function () { this.blur(); openSettings(); });
  $('btn-settings-ok').addEventListener('click', function () { this.blur(); closeSettings(); });
  $('btn-settings-default').addEventListener('click', function () {
    this.blur();
    settings = {
      stayTime: DEFAULT_SETTINGS.stayTime,
      keyRange: DEFAULT_SETTINGS.keyRange,
      difficulty: DEFAULT_SETTINGS.difficulty,
      sound: DEFAULT_SETTINGS.sound
    };
    syncSettingsUI();
  });
  $('set-stay').addEventListener('input', function () {
    $('stay-val').textContent = parseFloat(this.value).toFixed(1);
  });
  $('set-keys').addEventListener('change', function () {
    $('keys-note').textContent = KEYS_NOTES[getRadio('keys')] || '';
  });
}

/* ---------------- 初始化 ---------------- */
function init() {
  hammerEl.innerHTML = HAMMER_SVG;
  document.querySelector('.mascot').innerHTML = MOLE_SVG;
  buildHoles();
  bindButtons();
  AudioFX.set(!settings.sound);
  syncSoundBtn();
  refreshBestTitle();
  fit();
  requestAnimationFrame(loop);
}

init();
