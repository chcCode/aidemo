'use strict';

/* ================= 画布与窗口 ================= */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let viewW = window.innerWidth;
let viewH = window.innerHeight;

function resize() {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = viewW;
  canvas.height = viewH;
}
window.addEventListener('resize', resize);
resize();

/* ================= 常量 ================= */
const WORLD = { w: 4200, h: 4200 };
const FOOD_COUNT = 550;
const AI_COUNT = 14;
const START_MASS = 120;
const MAX_PLAYER_CELLS = 8;
const MERGE_DELAY_MS = 15000;
const EJECT_MASS = 15;
const EJECT_COOLDOWN_MS = 120;

const FOOD_COLORS = ['#ff8a80', '#ea80fc', '#8c9eff', '#80d8ff', '#a7ffeb', '#ccff90', '#ffff8d', '#ffd180'];
const CELL_COLORS = ['#e53935', '#d81b60', '#8e24aa', '#3949ab', '#1e88e5', '#00897b', '#7cb342', '#fb8c00', '#6d4c41', '#546e7a', '#5e35b1', '#00acc1', '#c0ca33', '#f4511e'];
const AI_NAMES = ['方块侠', '小方', '砖头哥', '骰子王', '方天画戟', '正方形', '积木人', '方糖', '魔方怪', '方老板', '硬方', '方跑跑', '方墩墩', '尖角兽'];

const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

/* ================= 工具函数 ================= */
function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function sideFromMass(mass) { return Math.sqrt(mass) * 4; }
function speedFor(mass) { return Math.max(55, 250 * Math.pow(START_MASS / mass, 0.22)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ================= 游戏状态 ================= */
let foods = [];
let ejecteds = [];
let ais = [];
let player = null;
let running = false;
let gameOverDelay = 0;
let lastEjectAt = 0;

const cam = { x: WORLD.w / 2, y: WORLD.h / 2, scale: 1 };
const mouse = { x: viewW / 2, y: viewH / 2 };

/* ================= 实体创建 ================= */
function newFood() {
  return {
    x: rand(20, WORLD.w - 20),
    y: rand(20, WORLD.h - 20),
    mass: rand(2, 6),
    color: pick(FOOD_COLORS),
  };
}

function makeCell(x, y, mass, owner, name, color) {
  return { x, y, mass, side: sideFromMass(mass), vx: 0, vy: 0, owner, name, color, mergeAt: 0 };
}

function spawnAICell(ai) {
  let x = rand(200, WORLD.w - 200);
  let y = rand(200, WORLD.h - 200);
  if (player && player.alive && player.cells.length > 0) {
    const p = player.cells[0];
    if (Math.hypot(x - p.x, y - p.y) < 600) {
      x = WORLD.w - x;
      y = WORLD.h - y;
    }
  }
  ai.cell = makeCell(x, y, rand(80, 260), ai.id, ai.name, ai.color);
}

function newAI(id, name, color) {
  return { id, name, color, cell: null, respawnAt: 0, dir: rand(0, Math.PI * 2), dirTimer: 0 };
}

function getAllCells() {
  const all = [];
  if (player && player.alive) all.push(...player.cells);
  for (const ai of ais) if (ai.cell) all.push(ai.cell);
  return all;
}

/* ================= 初始化 ================= */
function initGame(name) {
  foods = [];
  for (let i = 0; i < FOOD_COUNT; i++) foods.push(newFood());
  ejecteds = [];
  ais = [];
  const names = [...AI_NAMES].sort(() => Math.random() - 0.5);
  const colors = [...CELL_COLORS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < AI_COUNT; i++) {
    const ai = newAI(i, names[i % names.length], colors[i % colors.length]);
    spawnAICell(ai);
    ais.push(ai);
  }
  player = {
    name,
    color: '#43a047',
    cells: [makeCell(WORLD.w / 2 + rand(-300, 300), WORLD.h / 2 + rand(-300, 300), START_MASS, 'player', name, '#43a047')],
    alive: true,
    lastMass: START_MASS,
  };
  cam.x = player.cells[0].x;
  cam.y = player.cells[0].y;
  cam.scale = 1;
  gameOverDelay = 0;
  running = true;
}

/* ================= 鼠标 / 键盘输入 ================= */
function mouseWorld() {
  return {
    x: cam.x + (mouse.x - viewW / 2) / cam.scale,
    y: cam.y + (mouse.y - viewH / 2) / cam.scale,
  };
}

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener('keydown', (e) => {
  if (!running) return;
  if (e.code === 'Space') {
    e.preventDefault();
    splitPlayer();
  } else if (e.code === 'KeyW') {
    ejectMass();
  }
});

/* ================= 触屏摇杆 ================= */
const JOY_RADIUS = 55;
const JOY_BASE_SIZE = 140;
const joystick = { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };
const joyEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');
const touchZone = document.getElementById('touchZone');

function joyStart(x, y, id) {
  joystick.active = true;
  joystick.id = id;
  joystick.baseX = x;
  joystick.baseY = y;
  joystick.dx = 0;
  joystick.dy = 0;
  joyEl.classList.remove('hidden');
  joyEl.style.left = `${x - JOY_BASE_SIZE / 2}px`;
  joyEl.style.top = `${y - JOY_BASE_SIZE / 2}px`;
  stickEl.style.transform = 'translate(0px, 0px)';
}

function joyMove(x, y) {
  let dx = x - joystick.baseX;
  let dy = y - joystick.baseY;
  const d = Math.hypot(dx, dy);
  if (d > JOY_RADIUS) {
    dx = (dx / d) * JOY_RADIUS;
    dy = (dy / d) * JOY_RADIUS;
  }
  joystick.dx = dx / JOY_RADIUS;
  joystick.dy = dy / JOY_RADIUS;
  stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
}

function joyEnd() {
  joystick.active = false;
  joystick.id = null;
  joystick.dx = 0;
  joystick.dy = 0;
  joyEl.classList.add('hidden');
}

touchZone.addEventListener('touchstart', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (!joystick.active) joyStart(t.clientX, t.clientY, t.identifier);
  }
}, { passive: false });

touchZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (joystick.active && t.identifier === joystick.id) joyMove(t.clientX, t.clientY);
  }
}, { passive: false });

function onJoyTouchEnd(e) {
  for (const t of e.changedTouches) {
    if (joystick.active && t.identifier === joystick.id) joyEnd();
  }
}
touchZone.addEventListener('touchend', onJoyTouchEnd);
touchZone.addEventListener('touchcancel', onJoyTouchEnd);

/* 鼠标拖动摇杆（PC 调试 / 触控板替代操作） */
touchZone.addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (!joystick.active) joyStart(e.clientX, e.clientY, 'mouse');
});
window.addEventListener('mousemove', (e) => {
  if (joystick.active && joystick.id === 'mouse') joyMove(e.clientX, e.clientY);
});
window.addEventListener('mouseup', () => {
  if (joystick.active && joystick.id === 'mouse') joyEnd();
});

/* 摇杆驱动：把摇杆向量换算成屏幕中心偏移，复用鼠标移动逻辑 */
function applyJoystick() {
  if (!joystick.active) return;
  mouse.x = viewW / 2 + joystick.dx * 160;
  mouse.y = viewH / 2 + joystick.dy * 160;
}

/* ================= 触屏按钮 ================= */
const btnSplit = document.getElementById('btnSplit');
const btnEject = document.getElementById('btnEject');
let ejectTimer = null;

btnSplit.addEventListener('touchstart', (e) => {
  e.preventDefault();
  splitPlayer();
}, { passive: false });
btnSplit.addEventListener('click', () => splitPlayer());

function stopEject() {
  if (ejectTimer) {
    clearInterval(ejectTimer);
    ejectTimer = null;
  }
}
btnEject.addEventListener('touchstart', (e) => {
  e.preventDefault();
  ejectMass();
  if (!ejectTimer) ejectTimer = setInterval(ejectMass, 150);
}, { passive: false });
btnEject.addEventListener('touchend', stopEject);
btnEject.addEventListener('touchcancel', stopEject);
btnEject.addEventListener('mousedown', (e) => {
  e.preventDefault();
  ejectMass();
  if (!ejectTimer) ejectTimer = setInterval(ejectMass, 150);
});
window.addEventListener('mouseup', stopEject);
btnEject.addEventListener('click', () => ejectMass());

/* ================= 玩家操作 ================= */
function splitPlayer() {
  if (!running || !player || !player.alive) return;
  const now = performance.now();
  const target = mouseWorld();
  const created = [];
  for (const c of player.cells) {
    if (player.cells.length + created.length >= MAX_PLAYER_CELLS) break;
    if (c.mass < 60) continue;
    const half = c.mass / 2;
    c.mass = half;
    c.side = sideFromMass(half);
    c.mergeAt = now + MERGE_DELAY_MS;
    const angle = Math.atan2(target.y - c.y, target.x - c.x);
    const nc = makeCell(c.x, c.y, half, 'player', player.name, player.color);
    nc.vx = Math.cos(angle) * 750;
    nc.vy = Math.sin(angle) * 750;
    nc.mergeAt = now + MERGE_DELAY_MS;
    created.push(nc);
  }
  player.cells.push(...created);
}

function ejectMass() {
  if (!running || !player || !player.alive) return;
  const now = performance.now();
  if (now - lastEjectAt < EJECT_COOLDOWN_MS) return;
  lastEjectAt = now;
  const target = mouseWorld();
  for (const c of player.cells) {
    if (c.mass < 45) continue;
    c.mass -= EJECT_MASS;
    c.side = sideFromMass(c.mass);
    const angle = Math.atan2(target.y - c.y, target.x - c.x);
    ejecteds.push({
      x: c.x + Math.cos(angle) * (c.side / 2 + 12),
      y: c.y + Math.sin(angle) * (c.side / 2 + 12),
      vx: Math.cos(angle) * 650,
      vy: Math.sin(angle) * 650,
      mass: EJECT_MASS,
      color: c.color,
      age: 0,
    });
  }
}

/* ================= 更新逻辑 ================= */
function updatePlayer(dt, now) {
  if (!player.alive) return;
  const target = mouseWorld();
  for (const c of player.cells) {
    const dx = target.x - c.x;
    const dy = target.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const sp = speedFor(c.mass) * Math.min(1, d / 120);
      c.x += (dx / d) * sp * dt;
      c.y += (dy / d) * sp * dt;
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    const decay = Math.min(1, 4 * dt);
    c.vx -= c.vx * decay;
    c.vy -= c.vy * decay;
    c.x = clamp(c.x, c.side / 2, WORLD.w - c.side / 2);
    c.y = clamp(c.y, c.side / 2, WORLD.h - c.side / 2);
  }
  // 自身细胞：未到合并时间则互相推开，到时间则重叠合并
  for (let i = 0; i < player.cells.length; i++) {
    for (let j = player.cells.length - 1; j > i; j--) {
      const a = player.cells[i];
      const b = player.cells[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const canMerge = now >= a.mergeAt && now >= b.mergeAt;
      if (canMerge) {
        if (d < Math.max(a.side, b.side) / 2) {
          const total = a.mass + b.mass;
          a.x = (a.x * a.mass + b.x * b.mass) / total;
          a.y = (a.y * a.mass + b.y * b.mass) / total;
          a.mass = total;
          a.side = sideFromMass(total);
          player.cells.splice(j, 1);
        }
      } else {
        const minD = (a.side + b.side) / 2;
        if (d < minD) {
          const push = (minD - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }
}

function updateAIs(dt, now) {
  const all = getAllCells();
  for (const ai of ais) {
    if (!ai.cell) {
      if (now >= ai.respawnAt) spawnAICell(ai);
      continue;
    }
    const c = ai.cell;
    let threat = null;
    let threatD2 = 700 * 700;
    let prey = null;
    let preyD2 = 900 * 900;
    for (const o of all) {
      if (o === c || o.owner === ai.id) continue;
      const d2 = (c.x - o.x) * (c.x - o.x) + (c.y - o.y) * (c.y - o.y);
      if (o.side > c.side * 1.15 && d2 < threatD2) {
        threat = o;
        threatD2 = d2;
      } else if (c.side > o.side * 1.2 && d2 < preyD2) {
        prey = o;
        preyD2 = d2;
      }
    }
    let tx;
    let ty;
    if (threat) {
      const dx = c.x - threat.x;
      const dy = c.y - threat.y;
      const d = Math.hypot(dx, dy) || 1;
      tx = c.x + (dx / d) * 400;
      ty = c.y + (dy / d) * 400;
    } else if (prey) {
      tx = prey.x;
      ty = prey.y;
    } else {
      let bestFood = null;
      let bestD2 = 600 * 600;
      for (const f of foods) {
        const d2 = (c.x - f.x) * (c.x - f.x) + (c.y - f.y) * (c.y - f.y);
        if (d2 < bestD2) {
          bestD2 = d2;
          bestFood = f;
        }
      }
      if (bestFood) {
        tx = bestFood.x;
        ty = bestFood.y;
      } else {
        ai.dirTimer -= dt;
        if (ai.dirTimer <= 0) {
          ai.dir = rand(0, Math.PI * 2);
          ai.dirTimer = rand(2, 4);
        }
        tx = c.x + Math.cos(ai.dir) * 300;
        ty = c.y + Math.sin(ai.dir) * 300;
      }
    }
    const margin = 250;
    if (c.x < margin) tx = c.x + 500;
    if (c.x > WORLD.w - margin) tx = c.x - 500;
    if (c.y < margin) ty = c.y + 500;
    if (c.y > WORLD.h - margin) ty = c.y - 500;
    const dx = tx - c.x;
    const dy = ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const sp = speedFor(c.mass) * 0.9;
      c.x += (dx / d) * sp * dt;
      c.y += (dy / d) * sp * dt;
    }
    c.x = clamp(c.x, c.side / 2, WORLD.w - c.side / 2);
    c.y = clamp(c.y, c.side / 2, WORLD.h - c.side / 2);
  }
}

function updateEjecteds(dt) {
  for (const e of ejecteds) {
    e.age += dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    const decay = Math.min(1, 3 * dt);
    e.vx -= e.vx * decay;
    e.vy -= e.vy * decay;
    e.x = clamp(e.x, 0, WORLD.w);
    e.y = clamp(e.y, 0, WORLD.h);
  }
}

function removeCell(cell) {
  if (cell.owner === 'player') {
    const idx = player.cells.indexOf(cell);
    if (idx >= 0) player.cells.splice(idx, 1);
  } else {
    const ai = ais[cell.owner];
    if (ai && ai.cell === cell) {
      ai.cell = null;
      ai.respawnAt = performance.now() + 3000;
    }
  }
}

function handleCellEating() {
  const all = getAllCells();
  const dead = new Set();
  for (const big of all) {
    if (dead.has(big)) continue;
    for (const small of all) {
      if (dead.has(small) || small === big || small.owner === big.owner) continue;
      if (big.side < small.side * 1.15) continue;
      const d = Math.hypot(big.x - small.x, big.y - small.y);
      if (d < big.side / 2 - small.side / 4) {
        dead.add(small);
        removeCell(small);
        big.mass += small.mass;
        big.side = sideFromMass(big.mass);
      }
    }
  }
}

function handleFoodEating() {
  const all = getAllCells();
  for (const c of all) {
    const half = c.side / 2;
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      if (Math.abs(c.x - f.x) > half + 6 || Math.abs(c.y - f.y) > half + 6) continue;
      c.mass += f.mass;
      foods.splice(i, 1);
      foods.push(newFood());
    }
    for (let i = ejecteds.length - 1; i >= 0; i--) {
      const e = ejecteds[i];
      if (e.age < 0.4) continue;
      if (Math.abs(c.x - e.x) > half || Math.abs(c.y - e.y) > half) continue;
      c.mass += e.mass;
      ejecteds.splice(i, 1);
    }
    c.side = sideFromMass(c.mass);
  }
}

function updateCamera(dt) {
  if (!player || !player.alive || player.cells.length === 0) return;
  let sx = 0;
  let sy = 0;
  let sm = 0;
  for (const c of player.cells) {
    sx += c.x * c.mass;
    sy += c.y * c.mass;
    sm += c.mass;
  }
  player.lastMass = sm;
  const k = Math.min(1, 5 * dt);
  cam.x += (sx / sm - cam.x) * k;
  cam.y += (sy / sm - cam.y) * k;
  const targetScale = clamp(Math.pow(44 / sideFromMass(sm), 0.4), 0.22, 1.1);
  cam.scale += (targetScale - cam.scale) * Math.min(1, 3 * dt);
}

function update(dt) {
  const now = performance.now();
  applyJoystick();
  updatePlayer(dt, now);
  updateAIs(dt, now);
  updateEjecteds(dt);
  handleCellEating();
  handleFoodEating();
  if (player.alive && player.cells.length === 0) {
    player.alive = false;
    gameOverDelay = 1.0;
  }
  if (!player.alive && gameOverDelay > 0) {
    gameOverDelay -= dt;
    if (gameOverDelay <= 0) {
      running = false;
      showGameOver();
    }
  }
  updateCamera(dt);
}

/* ================= 渲染 ================= */
function drawFoods(left, right, top, bottom) {
  for (const f of foods) {
    if (f.x < left - 20 || f.x > right + 20 || f.y < top - 20 || f.y > bottom + 20) continue;
    const s = sideFromMass(f.mass);
    ctx.fillStyle = f.color;
    ctx.fillRect(f.x - s / 2, f.y - s / 2, s, s);
  }
}

function drawEjecteds(left, right, top, bottom) {
  for (const e of ejecteds) {
    if (e.x < left - 30 || e.x > right + 30 || e.y < top - 30 || e.y > bottom + 30) continue;
    const s = sideFromMass(e.mass);
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - s / 2, e.y - s / 2, s, s);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(e.x - s / 2, e.y - s / 2, s, s);
  }
}

function drawCells() {
  const all = getAllCells().sort((a, b) => a.side - b.side);
  for (const c of all) {
    const s = c.side;
    const x = c.x - s / 2;
    const y = c.y - s / 2;
    ctx.fillStyle = c.color;
    ctx.fillRect(x, y, s, s);
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.strokeRect(x, y, s, s);
    if (s > 26) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      const nameSize = Math.max(12, s * 0.2);
      ctx.font = `bold ${nameSize}px "Microsoft YaHei", Arial, sans-serif`;
      ctx.lineWidth = Math.max(2, nameSize * 0.15);
      const showMass = s > 60;
      const nameY = showMass ? c.y - s * 0.1 : c.y;
      ctx.strokeText(c.name, c.x, nameY);
      ctx.fillText(c.name, c.x, nameY);
      if (showMass) {
        const massSize = Math.max(10, s * 0.14);
        ctx.font = `bold ${massSize}px "Microsoft YaHei", Arial, sans-serif`;
        ctx.lineWidth = Math.max(2, massSize * 0.15);
        const massText = String(Math.round(c.mass));
        ctx.strokeText(massText, c.x, c.y + s * 0.14);
        ctx.fillText(massText, c.x, c.y + s * 0.14);
      }
    }
  }
}

function leaderboardData() {
  const rows = [];
  if (player && player.alive) {
    rows.push({
      name: player.name,
      mass: player.cells.reduce((s, c) => s + c.mass, 0),
      me: true,
    });
  }
  for (const ai of ais) {
    if (ai.cell) rows.push({ name: ai.name, mass: ai.cell.mass, me: false });
  }
  rows.sort((a, b) => b.mass - a.mass);
  return rows;
}

function drawLeaderboard() {
  const compact = viewH < 480;
  const rows = leaderboardData().slice(0, compact ? 8 : 10);
  const w = compact ? 150 : 190;
  const rowH = compact ? 18 : 22;
  const headH = compact ? 26 : 32;
  const h = headH + 8 + rows.length * rowH;
  const x = viewW - w - 12;
  const y = 12;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(x, y, w, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `bold ${compact ? 12 : 15}px "Microsoft YaHei", Arial, sans-serif`;
  ctx.fillStyle = '#ffd54f';
  ctx.fillText('排行榜', x + 10, y + (compact ? 6 : 9));
  ctx.font = `${compact ? 11 : 13}px "Microsoft YaHei", Arial, sans-serif`;
  rows.forEach((r, i) => {
    const ry = y + headH + i * rowH;
    ctx.fillStyle = r.me ? '#ffd54f' : '#ffffff';
    ctx.fillText(`${i + 1}. ${r.name}`, x + 10, ry);
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(r.mass)), x + w - 10, ry);
    ctx.textAlign = 'left';
  });
}

function drawMinimap() {
  const size = viewH < 480 ? 96 : 140;
  const x = viewW - size - 12;
  const y = viewH - size - 12;
  const k = size / WORLD.w;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, size, size);
  for (const ai of ais) {
    if (!ai.cell) continue;
    ctx.fillStyle = ai.color;
    ctx.fillRect(x + ai.cell.x * k - 1.5, y + ai.cell.y * k - 1.5, 3, 3);
  }
  if (player && player.alive) {
    ctx.fillStyle = '#ffffff';
    for (const c of player.cells) {
      ctx.fillRect(x + c.x * k - 2.5, y + c.y * k - 2.5, 5, 5);
    }
  }
}

function drawHUD() {
  const compact = viewH < 480;
  drawLeaderboard();
  drawMinimap();
  if (player && player.alive) {
    const total = player.cells.reduce((s, c) => s + c.mass, 0);
    const w = compact ? 140 : 190;
    const h = compact ? 32 : 40;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(12, 12, w, h);
    ctx.font = `bold ${compact ? 15 : 20}px "Microsoft YaHei", Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`质量：${Math.round(total)}`, 22, compact ? 19 : 21);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `${compact ? 12 : 14}px "Microsoft YaHei", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  const hint = IS_TOUCH
    ? '左侧摇杆移动 · 右侧按钮分裂 / 吐球'
    : '鼠标移动或拖动左侧摇杆 · 空格 / 分裂按钮 · W / 吐球按钮';
  ctx.fillText(hint, viewW / 2, viewH - 12);
}

function render() {
  ctx.fillStyle = '#20262e';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.save();
  ctx.translate(viewW / 2, viewH / 2);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.x, -cam.y);

  const left = cam.x - viewW / 2 / cam.scale;
  const right = cam.x + viewW / 2 / cam.scale;
  const top = cam.y - viewH / 2 / cam.scale;
  const bottom = cam.y + viewH / 2 / cam.scale;

  ctx.fillStyle = '#eef3f8';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.strokeStyle = '#dbe4ee';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.max(0, Math.floor(left / 100) * 100); x <= Math.min(WORLD.w, right); x += 100) {
    ctx.moveTo(x, Math.max(0, top));
    ctx.lineTo(x, Math.min(WORLD.h, bottom));
  }
  for (let y = Math.max(0, Math.floor(top / 100) * 100); y <= Math.min(WORLD.h, bottom); y += 100) {
    ctx.moveTo(Math.max(0, left), y);
    ctx.lineTo(Math.min(WORLD.w, right), y);
  }
  ctx.stroke();
  ctx.strokeStyle = '#e53935';
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, WORLD.w, WORLD.h);

  drawFoods(left, right, top, bottom);
  drawEjecteds(left, right, top, bottom);
  drawCells();
  ctx.restore();

  if (running) drawHUD();
}

/* ================= 界面切换 ================= */
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const nameInput = document.getElementById('nameInput');
const finalStats = document.getElementById('finalStats');
const startTips = document.getElementById('startTips');

if (IS_TOUCH) {
  startTips.textContent = '左侧摇杆控制方向 · 右侧按钮分裂 / 吐球';
} else {
  startTips.textContent = '鼠标移动或拖动左侧摇杆 · 空格 / 分裂按钮 · W / 吐球按钮';
}

function startFromUI() {
  const name = (nameInput.value || '').trim() || '方块君';
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  document.body.classList.add('playing');
  if (IS_MOBILE) {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } catch (err) { /* 忽略全屏失败 */ }
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (err) { /* 忽略锁定失败 */ }
  }
  initGame(name);
}

function showGameOver() {
  document.body.classList.remove('playing');
  joyEnd();
  stopEject();
  const finalMass = Math.round(player.lastMass || 0);
  let rank = 1;
  for (const ai of ais) {
    if (ai.cell && ai.cell.mass > finalMass) rank++;
  }
  finalStats.textContent = `最终质量：${finalMass} · 排名：第 ${rank} 名`;
  gameOverScreen.classList.remove('hidden');
}

document.getElementById('startBtn').addEventListener('click', startFromUI);
document.getElementById('restartBtn').addEventListener('click', startFromUI);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startFromUI();
});

/* ================= 主循环 ================= */
let lastTime = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastTime) / 1000 || 0);
  lastTime = t;
  if (running) update(dt);
  render();
}
requestAnimationFrame(loop);
