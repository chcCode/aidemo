/* ============================================================
 * 我的世界 · 网页高还原版
 * 自研体素引擎 + Three.js r128
 * 功能：无限程序化地形 / 第一人称 / 破坏与放置 / 日夜循环 / 自动存档
 * ============================================================ */
'use strict';

/* ---------------- 配置常量 ---------------- */
const CHUNK = 16;            // 区块边长（与 MC 一致）
const WORLD_H = 96;          // 世界高度
const SEA_LEVEL = 30;        // 海平面
const RENDER_DIST = 4;       // 渲染半径（区块）
const REACH = 5;             // 交互距离（格）
const GRAVITY = 32;          // 重力加速度（还原 MC）
const JUMP_VEL = 9.0;        // 跳跃初速度（可跳 1.25 格）
const WALK_SPEED = 4.3;      // 行走速度（MC 为 4.317 m/s）
const SPRINT_SPEED = 5.6;    // 疾跑速度
const FLY_SPEED = 11;        // 飞行速度
const PLAYER_HALF = 0.3;     // 玩家半宽（MC 宽 0.6）
const PLAYER_HEIGHT = 1.8;   // 玩家身高
const EYE_HEIGHT = 1.62;     // 眼睛高度（与 MC 一致）
const DAY_LENGTH = 600;      // 一昼夜秒数
const SAVE_KEY = 'minecraft-web-save-v1';
const EPS = 0.001;

/* ---------------- 方块定义 ---------------- */
const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6,
  BEDROCK: 7, WATER: 8, COAL: 9, IRON: 10, COBBLE: 11, PLANKS: 12,
  GLASS: 13, ROSE: 14, DANDELION: 15, TALLGRASS: 16,
};

// 纹理图集坐标（8 列 × 4 行）
const TILES = {
  grass_top: 0, grass_side: 1, dirt: 2, stone: 3, sand: 4,
  log_side: 5, log_top: 6, leaves: 7, bedrock: 8, coal: 9,
  iron: 10, cobble: 11, planks: 12, glass: 13, water: 14,
  rose: 15, dandelion: 16, tallgrass: 17,
};
const ATLAS_COLS = 8, ATLAS_ROWS = 4, TILE_PX = 16;

const BLOCKS = [];
BLOCKS[B.AIR]       = { name: '空气' };
BLOCKS[B.GRASS]     = { name: '草方块',   top: 'grass_top', side: 'grass_side', bottom: 'dirt', opaque: true };
BLOCKS[B.DIRT]      = { name: '泥土',     all: 'dirt',      opaque: true };
BLOCKS[B.STONE]     = { name: '石头',     all: 'stone',     opaque: true };
BLOCKS[B.SAND]      = { name: '沙子',     all: 'sand',      opaque: true };
BLOCKS[B.LOG]       = { name: '橡木原木', top: 'log_top',  side: 'log_side', bottom: 'log_top', opaque: true };
BLOCKS[B.LEAVES]    = { name: '橡树树叶', all: 'leaves',    opaque: true };
BLOCKS[B.BEDROCK]   = { name: '基岩',     all: 'bedrock',   opaque: true, unbreakable: true };
BLOCKS[B.WATER]     = { name: '水',       all: 'water',     liquid: true };
BLOCKS[B.COAL]      = { name: '煤矿石',   all: 'coal',      opaque: true };
BLOCKS[B.IRON]      = { name: '铁矿石',   all: 'iron',      opaque: true };
BLOCKS[B.COBBLE]    = { name: '圆石',     all: 'cobble',    opaque: true };
BLOCKS[B.PLANKS]    = { name: '橡木木板', all: 'planks',    opaque: true };
BLOCKS[B.GLASS]     = { name: '玻璃',     all: 'glass',     glass: true };
BLOCKS[B.ROSE]      = { name: '罂粟',     all: 'rose',      plant: true };
BLOCKS[B.DANDELION] = { name: '蒲公英',   all: 'dandelion', plant: true };
BLOCKS[B.TALLGRASS] = { name: '草',       all: 'tallgrass', plant: true };

function isOpaque(id) { return id !== B.AIR && !!BLOCKS[id].opaque; }
function isSolid(id)  { return id !== B.AIR && !BLOCKS[id].liquid && !BLOCKS[id].plant; }
function isPlant(id)  { return id !== B.AIR && !!BLOCKS[id].plant; }
function faceTexture(id, dirY) {
  const d = BLOCKS[id];
  if (d.all) return TILES[d.all];
  if (dirY > 0) return TILES[d.top];
  if (dirY < 0) return TILES[d.bottom];
  return TILES[d.side];
}

/* ---------------- 程序化像素纹理（16×16，还原 MC 风格） ---------------- */
function tileOrigin(t) { return [(t % ATLAS_COLS) * TILE_PX, Math.floor(t / ATLAS_COLS) * TILE_PX]; }

function makeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE_PX;
  canvas.height = ATLAS_ROWS * TILE_PX;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 确定性伪随机（保证纹理每次一致）
  let rngState = 1337;
  function rnd() {
    rngState = (Math.imul(rngState, 1103515245) + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  }
  function shade(hex, f) {
    const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 255) * f)));
    const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 255) * f)));
    const b = Math.min(255, Math.max(0, Math.round((hex & 255) * f)));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function px(tile, x, y, color) {
    const o = tileOrigin(tile);
    ctx.fillStyle = color;
    ctx.fillRect(o[0] + x, o[1] + y, 1, 1);
  }
  function noiseTile(tile, base, lo, hi) {
    const o = tileOrigin(tile);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = shade(base, lo + rnd() * (hi - lo));
        ctx.fillRect(o[0] + x, o[1] + y, 1, 1);
      }
    }
  }

  // 草方块顶面：绿色噪点 + 深绿斑
  noiseTile(TILES.grass_top, 0x7cbd4f, 0.85, 1.1);
  for (let i = 0; i < 30; i++) px(TILES.grass_top, Math.floor(rnd() * 16), Math.floor(rnd() * 16), shade(0x5a9434, 0.9 + rnd() * 0.2));

  // 泥土
  noiseTile(TILES.dirt, 0x8a5f3c, 0.8, 1.15);
  for (let i = 0; i < 18; i++) px(TILES.dirt, Math.floor(rnd() * 16), Math.floor(rnd() * 16), shade(0x5e3f24, 0.9 + rnd() * 0.2));

  // 草方块侧面：泥土底 + 顶部草皮（参差不齐下垂）
  noiseTile(TILES.grass_side, 0x8a5f3c, 0.8, 1.15);
  for (let x = 0; x < 16; x++) {
    const depth = 2 + Math.floor(rnd() * 3);
    for (let y = 0; y < depth; y++) px(TILES.grass_side, x, y, shade(0x7cbd4f, 0.85 + rnd() * 0.25));
  }

  // 石头
  noiseTile(TILES.stone, 0x8d8d8d, 0.85, 1.1);

  // 沙子
  noiseTile(TILES.sand, 0xddd6a4, 0.9, 1.08);

  // 原木侧面：竖向树皮纹
  noiseTile(TILES.log_side, 0x6b5230, 0.85, 1.1);
  for (let x = 0; x < 16; x += 2) {
    const c = shade(0x4a3820, 0.9 + rnd() * 0.2);
    for (let y = 0; y < 16; y++) if (rnd() < 0.85) px(TILES.log_side, x, y, c);
  }

  // 原木顶面：年轮 + 树皮外圈
  noiseTile(TILES.log_top, 0x8a6a3e, 0.9, 1.08);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (d > 6.5) px(TILES.log_top, x, y, shade(0x5a4226, 0.9 + rnd() * 0.2));
      else if (Math.floor(d) % 2 === 0) px(TILES.log_top, x, y, shade(0x6f5330, 0.9 + rnd() * 0.2));
    }
  }

  // 树叶：带透明洞（fancy 画质风格）
  {
    const o = tileOrigin(TILES.leaves);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (rnd() < 0.14) continue;
        ctx.fillStyle = shade(0x3c7a24, 0.8 + rnd() * 0.35);
        ctx.fillRect(o[0] + x, o[1] + y, 1, 1);
      }
    }
  }

  // 基岩：大对比噪点
  noiseTile(TILES.bedrock, 0x3a3a3a, 0.5, 1.6);

  // 矿石：石头底 + 矿斑
  function ore(tile, color) {
    noiseTile(tile, 0x8d8d8d, 0.85, 1.1);
    for (let i = 0; i < 5; i++) {
      const cx0 = 2 + Math.floor(rnd() * 11), cy0 = 2 + Math.floor(rnd() * 11);
      for (let j = 0; j < 4; j++) {
        px(tile, Math.min(15, Math.max(0, cx0 + Math.floor(rnd() * 3) - 1)),
               Math.min(15, Math.max(0, cy0 + Math.floor(rnd() * 3) - 1)), shade(color, 0.8 + rnd() * 0.4));
      }
    }
  }
  ore(TILES.coal, 0x1c1c1c);
  ore(TILES.iron, 0xd8a080);

  // 圆石：灰底 + 错位石缝
  noiseTile(TILES.cobble, 0x8a8a8a, 0.78, 1.12);
  {
    const seam = shade(0x3f3f3f, 1);
    for (let x = 0; x < 16; x++) { px(TILES.cobble, x, 5, seam); px(TILES.cobble, x, 11, seam); }
    for (let y = 0; y < 16; y++) { px(TILES.cobble, 4, y, seam); px(TILES.cobble, 12, y, seam); }
    for (let y = 6; y < 11; y++) px(TILES.cobble, 8, y, seam);
  }

  // 木板：横板条 + 错缝
  noiseTile(TILES.planks, 0x9f7f4a, 0.88, 1.1);
  for (let x = 0; x < 16; x++) for (const y of [3, 7, 11, 15]) px(TILES.planks, x, y, shade(0x5f4a28, 0.95));
  for (let y = 0; y < 16; y++) px(TILES.planks, [6, 13, 4, 11][Math.floor(y / 4)], y, shade(0x5f4a28, 0.95));

  // 玻璃：透明底 + 白色边框 + 斜向反光
  {
    const o = tileOrigin(TILES.glass);
    ctx.strokeStyle = 'rgba(230,240,255,0.95)';
    ctx.lineWidth = 1;
    ctx.strokeRect(o[0] + 0.5, o[1] + 0.5, 15, 15);
    for (let i = 0; i < 6; i++) px(TILES.glass, 3 + i, 10 - i, 'rgba(255,255,255,0.55)');
  }

  // 水：蓝色噪点 + 亮波纹
  noiseTile(TILES.water, 0x3f76e4, 0.85, 1.12);
  for (let i = 0; i < 26; i++) px(TILES.water, Math.floor(rnd() * 16), Math.floor(rnd() * 16), shade(0x9db8ff, 0.9 + rnd() * 0.2));

  // 花（透明底）：茎 + 叶 + 花头
  function flower(tile, color, center) {
    for (let y = 8; y < 16; y++) { px(tile, 7, y, '#3f7a24'); px(tile, 8, y, '#356b1e'); }
    px(tile, 6, 12, '#3f7a24'); px(tile, 9, 11, '#3f7a24');
    for (let y = 3; y < 8; y++) {
      for (let x = 5; x < 11; x++) {
        if ((x === 5 || x === 10) && (y === 3 || y === 7)) continue;
        px(tile, x, y, shade(color, 0.85 + rnd() * 0.3));
      }
    }
    px(tile, 7, 5, center); px(tile, 8, 5, center);
  }
  flower(TILES.rose, 0xc02828, '#5e1010');
  flower(TILES.dandelion, 0xe8d828, '#a89010');

  // 高草（透明底）：随机绿色竖条
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(rnd() * 16);
    const h = 5 + Math.floor(rnd() * 9);
    for (let y = 15; y > 15 - h; y--) px(TILES.tallgrass, x, y, shade(0x5da33c, 0.8 + rnd() * 0.35));
  }

  return canvas;
}

/* ---------------- 确定性噪声与地形生成 ---------------- */
let SEED = 20260923;

function hash2(x, y) {
  let h = SEED ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function hash3(x, y, z) {
  let h = SEED ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, octaves) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq);
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

// 地形高度（带缓存）
const heightCache = new Map();
function getHeight(x, z) {
  const key = (x + 500000) * 2000001 + (z + 500000);
  let h = heightCache.get(key);
  if (h === undefined) {
    const continent = fbm(x * 0.008, z * 0.008, 4);        // 大陆起伏
    const hills = fbm(x * 0.045 + 137, z * 0.045 + 911, 3); // 丘陵细节
    h = Math.floor(24 + continent * 30 + (hills - 0.5) * 9);
    if (h < 2) h = 2; else if (h > WORLD_H - 20) h = WORLD_H - 20;
    heightCache.set(key, h);
    if (heightCache.size > 300000) heightCache.clear();
  }
  return h;
}

// 每 5×5 网格最多一棵树，格内位置抖动，避免树木重叠
function treeInCell(gx, gz) {
  if (hash2(gx * 5 + 3, gz * 5 + 7) > 0.28) return null;
  const ox = 1 + Math.floor(hash2(gx * 31 + 1, gz * 17 + 5) * 3);
  const oz = 1 + Math.floor(hash2(gx * 13 + 9, gz * 37 + 2) * 3);
  return [gx * 5 + ox, gz * 5 + oz];
}

// 判断 (x,y,z) 是否为树干/树叶（纯函数，跨区块结果一致）
function treeBlockAt(x, y, z) {
  const gx = Math.floor(x / 5), gz = Math.floor(z / 5);
  for (let ix = gx - 1; ix <= gx + 1; ix++) {
    for (let iz = gz - 1; iz <= gz + 1; iz++) {
      const cell = treeInCell(ix, iz);
      if (!cell) continue;
      const tx = cell[0], tz = cell[1];
      const dx = Math.abs(x - tx), dz = Math.abs(z - tz);
      if (dx > 2 || dz > 2) continue;
      const base = getHeight(tx, tz);
      if (base <= SEA_LEVEL + 1) continue; // 水里不长树
      const y0 = base + 1;
      const th = 4 + Math.floor(hash2(tx + 71, tz + 39) * 3); // 树干高 4~6
      if (y < y0 || y > y0 + th) continue;
      const dy = y - y0;
      if (dx === 0 && dz === 0 && dy < th) return B.LOG; // 树干
      if (dy >= th - 3 && dy <= th - 2) { // 下部大叶冠 5×5（随机去角）
        if (dx === 2 && dz === 2 && hash3(x, y, z) < 0.6) continue;
        return B.LEAVES;
      }
      if (dy >= th - 1 && dy <= th) { // 上部小叶冠 3×3（随机去角）
        if (dx === 1 && dz === 1 && hash3(x + 9, y, z + 9) < 0.5) continue;
        return B.LEAVES;
      }
    }
  }
  return B.AIR;
}

// 世界方块纯函数（不依赖已生成数据，保证无限世界一致性）
function computeBlock(x, y, z) {
  if (y === 0) return B.BEDROCK;
  const h = getHeight(x, z);
  if (y > h) {
    if (y <= h + 8) { // 只有接近地表才可能有树
      const t = treeBlockAt(x, y, z);
      if (t !== B.AIR) return t;
    }
    if (y <= SEA_LEVEL) return B.WATER;
    if (y === h + 1 && h > SEA_LEVEL + 1) { // 地表植被
      const r = hash3(x, y, z);
      if (r < 0.012) return B.ROSE;
      if (r < 0.024) return B.DANDELION;
      if (r < 0.07) return B.TALLGRASS;
    }
    return B.AIR;
  }
  if (y === h) return h <= SEA_LEVEL + 1 ? B.SAND : B.GRASS;
  if (y >= h - 3) return h <= SEA_LEVEL + 1 ? B.SAND : B.DIRT;
  const r = hash3(x, y, z);
  if (y < 42 && r < 0.006) return B.IRON;
  if (y < 64 && r < 0.018) return B.COAL;
  return B.STONE;
}

/* ---------------- 世界数据（区块存储 + 玩家修改表） ---------------- */
const chunks = new Map();    // 数值键 -> { cx, cz, data, solidMesh, waterMesh, glassMesh, dirty }
const modified = new Map();  // "x,y,z" -> 方块ID（玩家改动，用于存档）

function chunkKey(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }
function blockKey(x, y, z) { return x + ',' + y + ',' + z; }

function getBlock(x, y, z) {
  if (y < 0) return B.BEDROCK;
  if (y >= WORLD_H) return B.AIR;
  const c = chunks.get((Math.floor(x / CHUNK) + 32768) * 65536 + (Math.floor(z / CHUNK) + 32768));
  if (c && c.data) return c.data[(y * CHUNK + (z & 15)) * CHUNK + (x & 15)];
  const m = modified.get(x + ',' + y + ',' + z);
  return m !== undefined ? m : computeBlock(x, y, z);
}

function generateChunkData(cx, cz) {
  const data = new Uint8Array(CHUNK * CHUNK * WORLD_H);
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  for (let lx = 0; lx < CHUNK; lx++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const x = x0 + lx, z = z0 + lz;
      for (let y = 0; y < WORLD_H; y++) {
        data[(y * CHUNK + lz) * CHUNK + lx] = computeBlock(x, y, z);
      }
    }
  }
  // 应用玩家历史修改
  for (const entry of modified) {
    const p = entry[0].split(',');
    const x = +p[0], y = +p[1], z = +p[2];
    if (x >= x0 && x < x0 + CHUNK && z >= z0 && z < z0 + CHUNK) {
      data[(y * CHUNK + (z - z0)) * CHUNK + (x - x0)] = entry[1];
    }
  }
  return data;
}

/* ---------------- 区块网格构建（只生成可见面） ---------------- */
// 六个面：方向 / 四角顶点(x,y,z,u,v) / 明暗（模拟 MC 的面着色）
const FACES = [
  { dir: [-1, 0, 0], shade: 0.6, corners: [[0,1,0, 0,0],[0,0,0, 0,1],[0,1,1, 1,0],[0,0,1, 1,1]] },
  { dir: [ 1, 0, 0], shade: 0.6, corners: [[1,1,1, 0,0],[1,0,1, 0,1],[1,1,0, 1,0],[1,0,0, 1,1]] },
  { dir: [ 0,-1, 0], shade: 0.5, corners: [[1,0,1, 1,0],[0,0,1, 0,0],[1,0,0, 1,1],[0,0,0, 0,1]] },
  { dir: [ 0, 1, 0], shade: 1.0, corners: [[0,1,1, 1,1],[1,1,1, 0,1],[0,1,0, 1,0],[1,1,0, 0,0]] },
  { dir: [ 0, 0,-1], shade: 0.8, corners: [[1,0,0, 0,1],[0,0,0, 1,1],[1,1,0, 0,0],[0,1,0, 1,0]] },
  { dir: [ 0, 0, 1], shade: 0.8, corners: [[0,0,1, 0,1],[1,0,1, 1,1],[0,1,1, 0,0],[1,1,1, 1,0]] },
];

function newFaceArrays() { return { positions: [], normals: [], uvs: [], colors: [], indices: [] }; }

// 图集 UV（内缩 0.5px 防渗色；v 翻转对齐 canvas 方向）
function tileUV(tile, u, v, out) {
  const col = tile % ATLAS_COLS, row = Math.floor(tile / ATLAS_COLS);
  const w = ATLAS_COLS * TILE_PX, h = ATLAS_ROWS * TILE_PX;
  out.push((col * TILE_PX + 0.5 + u * (TILE_PX - 1)) / w);
  out.push(1 - (row * TILE_PX + 0.5 + (1 - v) * (TILE_PX - 1)) / h);
}

function addFace(arr, x, y, z, face, tile, waterTop) {
  const ndx = arr.positions.length / 3;
  for (const c of face.corners) {
    const cy = waterTop && c[1] === 1 ? 0.9 : c[1]; // 水面略低于方块顶
    arr.positions.push(x + c[0], y + cy, z + c[2]);
    arr.normals.push(face.dir[0], face.dir[1], face.dir[2]);
    tileUV(tile, c[3], 1 - c[4], arr.uvs);
    arr.colors.push(face.shade, face.shade, face.shade);
  }
  arr.indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
}

// 植被：X 形交叉面（双面）
function addCross(arr, x, y, z, tile) {
  const quads = [
    [[0,0,0],[1,0,1],[0,1,0],[1,1,1]],
    [[0,0,1],[1,0,0],[0,1,1],[1,1,0]],
  ];
  const uvq = [[0,0],[1,0],[0,1],[1,1]];
  for (const q of quads) {
    const ndx = arr.positions.length / 3;
    for (let i = 0; i < 4; i++) {
      arr.positions.push(x + q[i][0], y + q[i][1], z + q[i][2]);
      arr.normals.push(0, 1, 0);
      tileUV(tile, uvq[i][0], uvq[i][1], arr.uvs);
      arr.colors.push(1, 1, 1);
    }
    arr.indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
    arr.indices.push(ndx + 2, ndx + 1, ndx, ndx + 3, ndx + 1, ndx + 2);
  }
}

function buildChunk(cx, cz) {
  const c = chunks.get(chunkKey(cx, cz));
  if (!c || !c.data) return;
  const solid = newFaceArrays(), water = newFaceArrays(), glass = newFaceArrays();
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  for (let y = 0; y < WORLD_H; y++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const id = c.data[(y * CHUNK + lz) * CHUNK + lx];
        if (id === B.AIR) continue;
        const x = x0 + lx, z = z0 + lz;
        const def = BLOCKS[id];
        if (def.plant) { addCross(solid, x, y, z, TILES[def.all]); continue; }
        if (def.liquid) {
          const topOpen = getBlock(x, y + 1, z) !== B.WATER;
          for (const f of FACES) {
            const nb = getBlock(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
            if (nb === B.WATER || isOpaque(nb) || BLOCKS[nb].glass) continue;
            addFace(water, x, y, z, f, TILES.water, topOpen);
          }
          continue;
        }
        for (const f of FACES) {
          const nb = getBlock(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
          if (def.glass) {
            if (nb === B.GLASS || isOpaque(nb)) continue;
            addFace(glass, x, y, z, f, TILES.glass, false);
          } else {
            if (isOpaque(nb)) continue;
            addFace(solid, x, y, z, f, faceTexture(id, f.dir[1]), false);
          }
        }
      }
    }
  }
  updateChunkMesh(c, 'solid', solid, solidMaterial);
  updateChunkMesh(c, 'water', water, waterMaterial);
  updateChunkMesh(c, 'glass', glass, glassMaterial);
  c.dirty = false;
}

function updateChunkMesh(c, kind, arr, material) {
  const prop = kind + 'Mesh';
  if (c[prop]) {
    scene.remove(c[prop]);
    c[prop].geometry.dispose();
    c[prop] = null;
  }
  if (arr.indices.length === 0) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(arr.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(arr.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(arr.uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(arr.colors, 3));
  geo.setIndex(arr.indices);
  const mesh = new THREE.Mesh(geo, material);
  mesh.matrixAutoUpdate = false;
  if (kind === 'water') mesh.renderOrder = 1;
  if (kind === 'glass') mesh.renderOrder = 2;
  scene.add(mesh);
  c[prop] = mesh;
}

/* ---------------- 区块流式加载 / 卸载 ---------------- */
const buildQueue = [];
let unloadTimer = 0;

function ensureChunksAround(px, pz) {
  const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
  let added = false;
  for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++) {
    for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (chunks.has(chunkKey(cx, cz))) continue;
      chunks.set(chunkKey(cx, cz), { cx, cz, data: null, solidMesh: null, waterMesh: null, glassMesh: null, dirty: false });
      buildQueue.push({ cx, cz, d: dx * dx + dz * dz });
      added = true;
    }
  }
  if (added) buildQueue.sort((a, b) => a.d - b.d);
}

function processBuildQueue(maxGen) {
  let n = 0;
  while (buildQueue.length && n < maxGen) {
    const job = buildQueue.shift();
    const c = chunks.get(chunkKey(job.cx, job.cz));
    if (!c) continue;
    if (!c.data) c.data = generateChunkData(job.cx, job.cz);
    buildChunk(job.cx, job.cz);
    n++;
  }
  // 重建被修改的脏区块
  let rebuilt = 0;
  for (const c of chunks.values()) {
    if (rebuilt >= 3) break;
    if (c.dirty && c.data) { buildChunk(c.cx, c.cz); rebuilt++; }
  }
}

function unloadFarChunks(px, pz) {
  const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
  for (const entry of chunks) {
    const c = entry[1];
    if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > RENDER_DIST + 2) {
      for (const prop of ['solidMesh', 'waterMesh', 'glassMesh']) {
        if (c[prop]) { scene.remove(c[prop]); c[prop].geometry.dispose(); }
      }
      chunks.delete(entry[0]);
    }
  }
}

/* ---------------- 方块修改 ---------------- */
function markDirty(cx, cz) {
  const c = chunks.get(chunkKey(cx, cz));
  if (c) c.dirty = true;
}

function setBlock(x, y, z, id) {
  if (y < 0 || y >= WORLD_H) return;
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  const c = chunks.get(chunkKey(cx, cz));
  if (!c || !c.data) return;
  c.data[(y * CHUNK + (z - cz * CHUNK)) * CHUNK + (x - cx * CHUNK)] = id;
  modified.set(blockKey(x, y, z), id);
  markDirty(cx, cz);
  const lx = x & 15, lz = z & 15;
  if (lx === 0) markDirty(cx - 1, cz);
  if (lx === CHUNK - 1) markDirty(cx + 1, cz);
  if (lz === 0) markDirty(cx, cz - 1);
  if (lz === CHUNK - 1) markDirty(cx, cz + 1);
  saveSoon();
}

/* ---------------- 射线检测（DDA 体素遍历） ---------------- */
function raycastVoxel(origin, dir, maxDist) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
  const tDeltaX = Math.abs(1 / dir.x), tDeltaY = Math.abs(1 / dir.y), tDeltaZ = Math.abs(1 / dir.z);
  let tMaxX = dir.x !== 0 ? (stepX > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX : Infinity;
  let tMaxY = dir.y !== 0 ? (stepY > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY : Infinity;
  let tMaxZ = dir.z !== 0 ? (stepZ > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ : Infinity;
  let face = [0, 0, 0], t = 0;
  for (let i = 0; i < 256; i++) {
    const id = getBlock(x, y, z);
    if (id !== B.AIR && id !== B.WATER) return { x, y, z, id, face };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0]; }
    else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0]; }
    else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
    if (t > maxDist) return null;
  }
  return null;
}

function getLookHit() {
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  return raycastVoxel(camera.position, dir, REACH);
}

function tryBreak() {
  const hit = getLookHit();
  if (!hit) return;
  if (BLOCKS[hit.id].unbreakable) { showTip('基岩无法破坏！'); return; }
  setBlock(hit.x, hit.y, hit.z, B.AIR);
}

function tryPlace() {
  const hit = getLookHit();
  if (!hit) return;
  const x = hit.x + hit.face[0], y = hit.y + hit.face[1], z = hit.z + hit.face[2];
  if (y < 0 || y >= WORLD_H) return;
  const cur = getBlock(x, y, z);
  if (cur !== B.AIR && cur !== B.WATER && !isPlant(cur)) return;
  const id = hotbar[selected];
  if (isSolid(id) && blockIntersectsPlayer(x, y, z)) return;
  setBlock(x, y, z, id);
}

function blockIntersectsPlayer(x, y, z) {
  const p = player.pos;
  return x + 1 > p.x - PLAYER_HALF && x < p.x + PLAYER_HALF &&
         y + 1 > p.y && y < p.y + PLAYER_HEIGHT &&
         z + 1 > p.z - PLAYER_HALF && z < p.z + PLAYER_HALF;
}

/* ---------------- 玩家 ---------------- */
const player = {
  pos: new THREE.Vector3(8, 60, 8),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  onGround: false, flying: false, inWater: false,
};
let bobT = 0;
let sprinting = false;
let lastWTap = 0;

function syncCamera() {
  camera.position.set(player.pos.x, player.pos.y + EYE_HEIGHT, player.pos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function updatePlayer(dt) {
  if (!keys['KeyW']) sprinting = false;
  const sprint = sprinting || keys['ControlLeft'] || keys['ControlRight'];
  let speed = player.flying ? FLY_SPEED : (sprint ? SPRINT_SPEED : WALK_SPEED);
  if (keys['ShiftLeft'] && !player.flying) speed *= 0.3; // 潜行
  if (player.inWater && !player.flying) speed *= 0.55;

  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  let fx = 0, fz = 0;
  if (keys['KeyW']) { fx -= sin; fz -= cos; }
  if (keys['KeyS']) { fx += sin; fz += cos; }
  if (keys['KeyA']) { fx -= cos; fz += sin; }
  if (keys['KeyD']) { fx += cos; fz -= sin; }
  const len = Math.hypot(fx, fz);
  if (len > 0) { fx /= len; fz /= len; }

  // 水平速度平滑趋近（地面摩擦大、空中惯性大）
  const accel = player.onGround || player.flying ? 14 : 3.5;
  player.vel.x += (fx * speed - player.vel.x) * Math.min(1, accel * dt);
  player.vel.z += (fz * speed - player.vel.z) * Math.min(1, accel * dt);

  // 垂直方向
  if (player.flying) {
    let vy = 0;
    if (keys['Space']) vy += FLY_SPEED;
    if (keys['ShiftLeft']) vy -= FLY_SPEED;
    player.vel.y += (vy - player.vel.y) * Math.min(1, 12 * dt);
  } else if (player.inWater) {
    player.vel.y -= GRAVITY * 0.28 * dt;
    if (keys['Space']) player.vel.y += 26 * dt; // 游泳上浮
    if (player.vel.y < -3.2) player.vel.y = -3.2;
    if (player.vel.y > 3.6) player.vel.y = 3.6;
  } else {
    player.vel.y -= GRAVITY * dt;
    if (player.vel.y < -55) player.vel.y = -55;
    if (keys['Space'] && player.onGround) {
      player.vel.y = JUMP_VEL;
      player.onGround = false;
    }
  }

  moveAndCollide(dt);

  // 掉出世界兜底
  if (player.pos.y < -10) {
    player.pos.y = getHeight(Math.floor(player.pos.x), Math.floor(player.pos.z)) + 3;
    player.vel.set(0, 0, 0);
  }

  syncCamera();

  // 是否在水中
  const bx = Math.floor(player.pos.x), bz = Math.floor(player.pos.z);
  player.inWater = getBlock(bx, Math.floor(player.pos.y + 0.4), bz) === B.WATER ||
                   getBlock(bx, Math.floor(player.pos.y + 1.4), bz) === B.WATER;

  // 行走摆动
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround && hSpeed > 0.5) bobT += dt * hSpeed * 1.6;
}

function moveAndCollide(dt) {
  player.onGround = false;
  player.pos.x += player.vel.x * dt;
  resolveCollisions('x');
  player.pos.z += player.vel.z * dt;
  resolveCollisions('z');
  player.pos.y += player.vel.y * dt;
  resolveCollisions('y');
}

function resolveCollisions(axis) {
  const p = player.pos;
  const minX = Math.floor(p.x - PLAYER_HALF), maxX = Math.floor(p.x + PLAYER_HALF);
  const minY = Math.floor(p.y), maxY = Math.floor(p.y + PLAYER_HEIGHT);
  const minZ = Math.floor(p.z - PLAYER_HALF), maxZ = Math.floor(p.z + PLAYER_HALF);
  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isSolid(getBlock(x, y, z))) continue;
        if (axis === 'x') {
          p.x = player.vel.x > 0 ? x - PLAYER_HALF - EPS : x + 1 + PLAYER_HALF + EPS;
          player.vel.x = 0;
        } else if (axis === 'z') {
          p.z = player.vel.z > 0 ? z - PLAYER_HALF - EPS : z + 1 + PLAYER_HALF + EPS;
          player.vel.z = 0;
        } else {
          if (player.vel.y <= 0) { p.y = y + 1; player.onGround = true; }
          else { p.y = y - PLAYER_HEIGHT - EPS; }
          player.vel.y = 0;
        }
        resolveCollisions(axis); // 位置修正后重新扫描
        return;
      }
    }
  }
}

/* ---------------- 场景对象（init 中赋值） ---------------- */
let scene, camera, renderer;
let sunLight, ambientLight;
let atlasCanvas, atlasTexture;
let solidMaterial, waterMaterial, glassMaterial;
let highlight, cloudGroup;
let handScene, handCam, handMesh = null;

/* ---------------- 物品栏 ---------------- */
const hotbar = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.LEAVES, B.SAND, B.GLASS];
let selected = 0;
let tipTimer = null;

function buildHotbarUI() {
  const bar = document.getElementById('hotbar');
  bar.innerHTML = '';
  hotbar.forEach((id, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === selected ? ' active' : '');
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const c2 = cv.getContext('2d');
    c2.imageSmoothingEnabled = false;
    const tile = TILES[BLOCKS[id].side || BLOCKS[id].all];
    const o = tileOrigin(tile);
    c2.drawImage(atlasCanvas, o[0], o[1], 16, 16, 0, 0, 32, 32);
    slot.appendChild(cv);
    slot.addEventListener('click', () => selectSlot(i));
    bar.appendChild(slot);
  });
}

function selectSlot(i) {
  if (i === selected) return;
  selected = i;
  const slots = document.querySelectorAll('.slot');
  for (let j = 0; j < slots.length; j++) slots[j].classList.toggle('active', j === i);
  showTip(BLOCKS[hotbar[i]].name);
  buildHandMesh();
}

function showTip(text) {
  const el = document.getElementById('item-name');
  el.textContent = text;
  el.style.opacity = 1;
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => { el.style.opacity = 0; }, 1400);
}

/* ---------------- 第一人称手持方块 ---------------- */
function buildHandMesh() {
  if (handMesh) { handScene.remove(handMesh); handMesh.geometry.dispose(); }
  const id = hotbar[selected];
  const arr = newFaceArrays();
  const def = BLOCKS[id];
  if (def.plant) {
    addCross(arr, 0, 0, 0, TILES[def.all]);
  } else {
    for (const f of FACES) addFace(arr, 0, 0, 0, f, faceTexture(id, f.dir[1]), false);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(arr.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(arr.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(arr.uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(arr.colors, 3));
  geo.setIndex(arr.indices);
  handMesh = new THREE.Mesh(geo, solidMaterial);
  handMesh.position.set(0.62, -0.58, -1.05);
  handMesh.rotation.set(0.12, Math.PI * 0.22, 0);
  handMesh.scale.setScalar(0.42);
  handScene.add(handMesh);
}

function updateHand() {
  if (!handMesh) return;
  handMesh.position.y = -0.58 + Math.sin(bobT * 2) * 0.018;
  handMesh.position.x = 0.62 + Math.cos(bobT) * 0.012;
}

/* ---------------- 日夜循环 ---------------- */
let dayTime = 0.28; // 0~1：0.25=正午，0.5=日落，0.75=午夜
const skyDay = new THREE.Color(0x87ceeb);
const skyNight = new THREE.Color(0x070714);
const skyColor = new THREE.Color();

function updateDayNight(dt) {
  dayTime = (dayTime + dt / DAY_LENGTH) % 1;
  const ang = (dayTime - 0.25) * Math.PI * 2;
  const sunHeight = Math.cos(ang); // 1=正午，-1=午夜
  sunLight.position.set(Math.sin(ang) * 80, Math.cos(ang) * 80, 20).add(camera.position);
  sunLight.target.position.copy(camera.position);
  sunLight.target.updateMatrixWorld();
  const dayness = Math.max(0, Math.min(1, sunHeight * 2 + 0.25));
  sunLight.intensity = 0.15 + dayness * 0.85;
  ambientLight.intensity = 0.35 + dayness * 0.3;
  skyColor.copy(skyNight).lerp(skyDay, dayness);
  scene.background = skyColor;
  scene.fog.color.copy(skyColor);
}

function updateClouds(dt) {
  for (const cl of cloudGroup.children) {
    cl.position.x += dt * 1.3;
    if (cl.position.x - camera.position.x > 240) cl.position.x -= 480;
    else if (cl.position.x - camera.position.x < -240) cl.position.x += 480;
    if (cl.position.z - camera.position.z > 240) cl.position.z -= 480;
    else if (cl.position.z - camera.position.z < -240) cl.position.z += 480;
  }
}

/* ---------------- 调试信息 ---------------- */
let debugVisible = false, fps = 0, frames = 0, fpsTimer = 0;

function toggleDebug() {
  debugVisible = !debugVisible;
  document.getElementById('debug').style.display = debugVisible ? 'block' : 'none';
}

function updateDebug(dt) {
  frames++; fpsTimer += dt;
  if (fpsTimer >= 0.5) { fps = Math.round(frames / fpsTimer); frames = 0; fpsTimer = 0; }
  if (!debugVisible) return;
  const p = player.pos;
  const yawN = ((player.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const dirs = ['北', '西北', '西', '西南', '南', '东南', '东', '东北'];
  const dirName = dirs[Math.round(yawN / (Math.PI / 4)) % 8];
  document.getElementById('debug').textContent =
    'XYZ: ' + p.x.toFixed(1) + ' / ' + p.y.toFixed(1) + ' / ' + p.z.toFixed(1) + '\n' +
    '区块: ' + Math.floor(p.x / CHUNK) + ', ' + Math.floor(p.z / CHUNK) + '  已加载: ' + chunks.size + '\n' +
    '朝向: ' + dirName + '  FPS: ' + fps + '\n' +
    '种子: ' + SEED + '  时间: ' + (dayTime * 24).toFixed(1) + ' 时\n' +
    '模式: ' + (player.flying ? '飞行' : '步行') + (player.inWater ? '  水中' : '');
}

/* ---------------- 存档（localStorage） ---------------- */
let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveWorld, 1500);
}
function saveWorld() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      seed: SEED,
      modified: Array.from(modified.entries()),
      player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch, flying: player.flying },
      dayTime: dayTime,
    }));
  } catch (e) { /* 存储已满则忽略 */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    SEED = s.seed;
    for (const entry of s.modified) modified.set(entry[0], entry[1]);
    if (s.player) {
      player.pos.set(s.player.x, s.player.y, s.player.z);
      player.yaw = s.player.yaw;
      player.pitch = s.player.pitch;
      player.flying = !!s.player.flying;
    }
    if (typeof s.dayTime === 'number') dayTime = s.dayTime;
    return true;
  } catch (e) { return false; }
}

/* ---------------- 出生点 ---------------- */
function findSpawn() {
  for (let r = 0; r < 60; r += 4) {
    for (let a = 0; a < 16; a++) {
      const x = 8 + Math.round(Math.cos(a / 16 * Math.PI * 2) * r);
      const z = 8 + Math.round(Math.sin(a / 16 * Math.PI * 2) * r);
      const h = getHeight(x, z);
      if (h > SEA_LEVEL + 1 && treeBlockAt(x, h + 1, z) === B.AIR && treeBlockAt(x, h + 2, z) === B.AIR) {
        return [x, z];
      }
    }
  }
  return [8, 8];
}

/* ---------------- 输入与事件 ---------------- */
const keys = Object.create(null);
const mouseDown = { left: false, right: false };
let actionCooldown = 0;
let locked = false;
let helpVisible = true;
let helpTimer = null;

function bindEvents() {
  const overlay = document.getElementById('overlay');
  const playBtn = document.getElementById('play-btn');
  const helpEl = document.getElementById('help');

  document.addEventListener('keydown', (e) => {
    if (e.code === 'F3') { e.preventDefault(); toggleDebug(); return; }
    keys[e.code] = true;
    if (e.code.indexOf('Digit') === 0) {
      const n = +e.code.slice(5);
      if (n >= 1 && n <= 9) selectSlot(n - 1);
    }
    if (e.code === 'KeyW' && !e.repeat) {
      const now = performance.now();
      if (now - lastWTap < 280) sprinting = true;
      lastWTap = now;
    }
    if (e.code === 'KeyF' && locked) {
      player.flying = !player.flying;
      player.vel.y = 0;
      showTip(player.flying ? '飞行模式：开' : '飞行模式：关');
    }
    if (e.code === 'KeyH') {
      helpVisible = !helpVisible;
      helpEl.style.opacity = helpVisible ? 1 : 0;
    }
  });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    mouseDown.left = mouseDown.right = false;
  });

  renderer.domElement.addEventListener('mousedown', (e) => {
    if (!locked) return;
    if (e.button === 0) { mouseDown.left = true; tryBreak(); actionCooldown = 0.24; }
    if (e.button === 2) { mouseDown.right = true; tryPlace(); actionCooldown = 0.24; }
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown.left = false;
    if (e.button === 2) mouseDown.right = false;
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('wheel', (e) => {
    if (!locked) return;
    selectSlot((selected + (e.deltaY > 0 ? 1 : 8)) % 9);
  }, { passive: true });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch -= e.movementY * 0.0022;
    player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
  });

  playBtn.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('确定要重置世界吗？所有改动将丢失。')) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === renderer.domElement;
    overlay.style.display = locked ? 'none' : 'flex';
    if (locked) {
      playBtn.textContent = '回到游戏';
      clearTimeout(helpTimer);
      helpTimer = setTimeout(() => { if (helpVisible) helpEl.style.opacity = 0; }, 6000);
    } else {
      mouseDown.left = mouseDown.right = false;
      for (const k in keys) keys[k] = false;
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    handCam.aspect = camera.aspect;
    handCam.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  window.addEventListener('beforeunload', saveWorld);
  setInterval(saveWorld, 15000);
}

/* ---------------- 准星高亮框 ---------------- */
function updateHighlight() {
  if (!locked) { highlight.visible = false; return; }
  const hit = getLookHit();
  if (hit) {
    highlight.visible = true;
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  } else {
    highlight.visible = false;
  }
}

/* ---------------- 初始化 ---------------- */
function init() {
  // 读取存档；无存档则随机种子
  if (!loadSave()) SEED = (Math.random() * 0x7fffffff) | 0;

  // 渲染器与场景
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.autoClear = false;
  document.getElementById('game').appendChild(renderer.domElement);

  // 光照
  sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
  ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(sunLight);
  scene.add(sunLight.target);
  scene.add(ambientLight);
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, CHUNK * (RENDER_DIST - 1.2), CHUNK * (RENDER_DIST - 0.2));

  // 纹理图集与材质
  atlasCanvas = makeAtlas();
  atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.generateMipmaps = false;
  solidMaterial = new THREE.MeshLambertMaterial({ map: atlasTexture, vertexColors: true, alphaTest: 0.5 });
  waterMaterial = new THREE.MeshLambertMaterial({ map: atlasTexture, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  glassMaterial = new THREE.MeshLambertMaterial({ map: atlasTexture, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false });

  // 方块云（MC 风格）
  cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, fog: false });
  for (let i = 0; i < 24; i++) {
    const w = 8 + Math.random() * 16, d = 8 + Math.random() * 16;
    const cloud = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, d), cloudMat);
    cloud.position.set((Math.random() - 0.5) * 400, 104 + Math.random() * 6, (Math.random() - 0.5) * 400);
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);

  // 选中方块高亮线框
  highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 })
  );
  highlight.visible = false;
  scene.add(highlight);

  // 手持方块场景
  handScene = new THREE.Scene();
  handCam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 10);
  handScene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const handSun = new THREE.DirectionalLight(0xffffff, 0.8);
  handSun.position.set(1, 2, 1.5);
  handScene.add(handSun);

  // UI
  buildHotbarUI();
  buildHandMesh();
  bindEvents();

  // 出生点（无存档时寻找陆地）
  if (!localStorage.getItem(SAVE_KEY)) {
    const sp = findSpawn();
    player.pos.set(sp[0] + 0.5, getHeight(sp[0], sp[1]) + 2.5, sp[1] + 0.5);
  }
  syncCamera();

  // 调试接口（便于自动化测试）
  window.MC = {
    player: player, chunks: chunks, getBlock: getBlock, setBlock: setBlock,
    setLocked: function (v) { locked = v; },
    isLocked: function () { return locked; },
    seed: function () { return SEED; },
  };

  // 分帧预生成出生区区块，显示进度条
  const loadingEl = document.getElementById('loading');
  const loadingBar = document.getElementById('loading-bar');
  const overlay = document.getElementById('overlay');
  ensureChunksAround(player.pos.x, player.pos.z);
  const total = buildQueue.length;
  function preload() {
    processBuildQueue(6);
    const done = total - buildQueue.length;
    loadingBar.style.width = Math.round(done / total * 100) + '%';
    if (buildQueue.length > 0) {
      requestAnimationFrame(preload);
    } else {
      loadingEl.style.display = 'none';
      overlay.style.display = 'flex';
      requestAnimationFrame(loop);
    }
  }
  requestAnimationFrame(preload);
}

/* ---------------- 主循环 ---------------- */
let lastTime = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  ensureChunksAround(player.pos.x, player.pos.z);
  processBuildQueue(2);
  unloadTimer += dt;
  if (unloadTimer > 2) { unloadTimer = 0; unloadFarChunks(player.pos.x, player.pos.z); }

  if (locked) {
    updatePlayer(dt);
    actionCooldown -= dt;
    if (actionCooldown <= 0 && (mouseDown.left || mouseDown.right)) {
      if (mouseDown.left) tryBreak(); else tryPlace();
      actionCooldown = 0.24;
    }
  }

  updateDayNight(dt);
  updateClouds(dt);
  updateHighlight();
  updateDebug(dt);
  updateHand();

  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(handScene, handCam);
}

/* ---------------- 启动 ---------------- */
if (typeof THREE === 'undefined') {
  document.getElementById('loading').innerHTML = '<p style="color:#f66">Three.js 加载失败，请检查网络连接后刷新页面</p>';
} else {
  init();
}
