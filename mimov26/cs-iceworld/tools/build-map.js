// GoldSrc (Half-Life / CS1.6) BSP -> data/map.json + data/textures/*.png
// 纯 Node，无第三方依赖。用法: node tools/build-map.js [bsp路径]
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data');
const TEXOUT = path.join(OUT, 'textures');
const bspPath = process.argv[2] || path.join(__dirname, 'bsp', 'maps', 'fy_iceworld.bsp');

const buf = fs.readFileSync(bspPath);
const version = buf.readInt32LE(0);
if (version !== 29 && version !== 30) {
  console.error('未知 BSP 版本: ' + version);
  process.exit(1);
}

const LUMP = {
  ENTITIES: 0, PLANES: 1, TEXTURES: 2, VERTEXES: 3, VISIBILITY: 4,
  NODES: 5, TEXINFO: 6, FACES: 7, LIGHTING: 8, CLIPNODES: 9,
  LEAVES: 10, MARKSURFACES: 11, EDGES: 12, SURFEDGES: 13, MODELS: 14
};

function lump(i) {
  const o = 4 + i * 8;
  return { off: buf.readInt32LE(o), len: buf.readInt32LE(o + 4) };
}

// ---------- entities ----------
function parseEntities() {
  const { off, len } = lump(LUMP.ENTITIES);
  const text = buf.toString('latin1', off, off + len).replace(/\0.*$/, '');
  const ents = [];
  const blocks = text.match(/\{[^{}]*\}/g) || [];
  for (const b of blocks) {
    const e = {};
    const re = /"([^"]*)"\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(b))) e[m[1].toLowerCase()] = m[2];
    if (e.classname) ents.push(e);
  }
  return ents;
}

// ---------- planes / vertices / edges ----------
function readPlanes() {
  const { off, len } = lump(LUMP.PLANES);
  const n = len / 20, arr = [];
  for (let i = 0; i < n; i++) {
    const p = off + i * 20;
    arr.push({ n: [buf.readFloatLE(p), buf.readFloatLE(p + 4), buf.readFloatLE(p + 8)], d: buf.readFloatLE(p + 12) });
  }
  return arr;
}
function readVertices() {
  const { off, len } = lump(LUMP.VERTEXES);
  const n = len / 12, arr = [];
  for (let i = 0; i < n; i++) {
    const p = off + i * 12;
    arr.push([buf.readFloatLE(p), buf.readFloatLE(p + 4), buf.readFloatLE(p + 8)]);
  }
  return arr;
}
function readEdges() {
  const { off, len } = lump(LUMP.EDGES);
  const n = len / 4, arr = [];
  for (let i = 0; i < n; i++) {
    const p = off + i * 4;
    arr.push([buf.readUInt16LE(p), buf.readUInt16LE(p + 2)]);
  }
  return arr;
}
function readSurfedges() {
  const { off, len } = lump(LUMP.SURFEDGES);
  const n = len / 4, arr = [];
  for (let i = 0; i < n; i++) arr.push(buf.readInt32LE(off + i * 4));
  return arr;
}
function readTexinfo() {
  const { off, len } = lump(LUMP.TEXINFO);
  const n = len / 40, arr = [];
  for (let i = 0; i < n; i++) {
    const p = off + i * 40, s = [], t = [];
    for (let k = 0; k < 4; k++) s.push(buf.readFloatLE(p + k * 4));
    for (let k = 0; k < 4; k++) t.push(buf.readFloatLE(p + 16 + k * 4));
    arr.push({ s, t, miptex: buf.readInt32LE(p + 32), flags: buf.readInt32LE(p + 36) });
  }
  return arr;
}
function readFaces() {
  const { off, len } = lump(LUMP.FACES);
  const n = len / 20, arr = [];
  for (let i = 0; i < n; i++) {
    const p = off + i * 20;
    arr.push({
      planenum: buf.readInt16LE(p),
      side: buf.readInt16LE(p + 2),
      firstedge: buf.readInt32LE(p + 4),
      numedges: buf.readInt16LE(p + 8),
      texinfo: buf.readInt16LE(p + 10),
      lightofs: buf.readInt32LE(p + 16)
    });
  }
  return arr;
}
function readModels() {
  const { off, len } = lump(LUMP.MODELS);
  const n = len / 64, arr = [];
  for (let i = 0; i < n; i++) {
    const p = off + i * 64, mins = [], maxs = [], origin = [];
    for (let k = 0; k < 3; k++) mins.push(buf.readFloatLE(p + k * 4));
    for (let k = 0; k < 3; k++) maxs.push(buf.readFloatLE(p + 12 + k * 4));
    for (let k = 0; k < 3; k++) origin.push(buf.readFloatLE(p + 24 + k * 4));
    arr.push({ mins, maxs, origin, firstface: buf.readInt32LE(p + 56), numfaces: buf.readInt32LE(p + 60) });
  }
  return arr;
}

// ---------- textures ----------
function readTextures() {
  const { off, len } = lump(LUMP.TEXTURES);
  const num = buf.readInt32LE(off);
  const list = [];
  for (let i = 0; i < num; i++) {
    const te = off + buf.readInt32LE(off + 4 + i * 4);
    if (te < off || te >= off + len) { list.push(null); continue; }
    const name = buf.toString('latin1', te, te + 16).replace(/\0.*$/, '').toLowerCase();
    const w = buf.readUInt32LE(te + 16), h = buf.readUInt32LE(te + 20);
    const o0 = buf.readUInt32LE(te + 24);
    list.push({ name, w, h, te, embedded: o0 !== 0 && w > 0 && h > 0 && (w & (w - 1)) === 0 && (h & (h - 1)) === 0 });
  }
  return list;
}

// ---------- PNG 编码（8bit 索引色） ----------
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(b) {
  let c = ~0;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'latin1');
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  t.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([t, data])), 8 + data.length);
  return out;
}
function writeIndexedPNG(file, w, h, indices, palette /* Buffer 768 */) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 3; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    indices.copy(raw, y * (w + 1) + 1, y * w, (y + 1) * w);
  }
  const png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('PLTE', palette),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
}

// 8bit RGBA PNG（程序化贴图用）
function writeRGBAPNG(file, w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  fs.writeFileSync(file, Buffer.concat([
    sig, chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]));
}

// 可平铺 value noise
function ihash(x, y, s) {
  let n = (x * 1619 + y * 31337 + s * 6971) | 0;
  n = (n << 13) ^ n;
  return 1.0 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0;
}
function vnoise(x, y, per, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const wrap = a => ((a % per) + per) % per;
  const a = ihash(wrap(xi), wrap(yi), seed), b = ihash(wrap(xi + 1), wrap(yi), seed);
  const c = ihash(wrap(xi), wrap(yi + 1), seed), d = ihash(wrap(xi + 1), wrap(yi + 1), seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y, per0, seed, oct) {
  let sum = 0, amp = 1, per = per0, norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += vnoise(x / (256 / per), y / (256 / per), per, seed + o) * amp;
    norm += amp; amp *= 0.5; per *= 2;
  }
  return sum / norm;
}

// 原版外置贴图的程序化替代
function genSnow(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = fbm(x, y, 8, 11, 4);
    const f = fbm(x, y, 32, 77, 2);
    let base = 214 + n * 24 + f * 16;
    const g = ihash(x, y, 5);
    base += g * 8;
    const i = (y * size + x) * 4;
    rgba[i] = Math.max(0, Math.min(255, base + 6));
    rgba[i + 1] = Math.max(0, Math.min(255, base + 5));
    rgba[i + 2] = Math.max(0, Math.min(255, base + 9));
    rgba[i + 3] = 255;
  }
  return rgba;
}
function genBrick(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const bw = 32, bh = 16, mortar = 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / bh);
    const xx = (x + (row % 2) * (bw / 2)) % size;
    const bx = xx % bw, by = y % bh;
    const i = (y * size + x) * 4;
    const isMortar = bx < mortar || by < mortar;
    if (isMortar) {
      rgba[i] = 30; rgba[i + 1] = 28; rgba[i + 2] = 26;
    } else {
      const bn = fbm(x, y, 16, 31, 3);
      const bi = ihash(Math.floor(xx / bw), row, 9);
      let base = 52 + bn * 18 + bi * 8;
      rgba[i] = Math.max(0, Math.min(255, base + 12));
      rgba[i + 1] = Math.max(0, Math.min(255, base));
      rgba[i + 2] = Math.max(0, Math.min(255, base - 8));
    }
    rgba[i + 3] = 255;
  }
  return rgba;
}

// ---------- 主流程 ----------
const entities = parseEntities();
const planes = readPlanes();
const verts = readVertices();
const edges = readEdges();
const surfedges = readSurfedges();
const texinfos = readTexinfo();
const faces = readFaces();
const models = readModels();
const textures = readTextures();

fs.mkdirSync(TEXOUT, { recursive: true });

const SKIP_RE = /^(sky|aaatrigger|clip|clipnogravity|playersolid|trigger|skip|hint|null|origin|bevel|disregard|caulk|nodraw|shadow|areaportal|invisible|mw|wedge)/;

// CS1.6 armoury_entity item 编号 -> 武器（TWHL wiki）
const ARMOURY = ['mp5navy', 'tmp', 'p90', 'mac10', 'ak47', 'sg552', 'm4a1', 'aug',
  'scout', 'g3sg1', 'awp', 'm3', 'xm1014', 'm249'];
const texOut = [];
const texById = [];   // 原始 texture index -> 输出 index（渲染用，跳过的为 -1）

textures.forEach((t, i) => {
  if (!t) { texById.push(-1); return; }
  if (SKIP_RE.test(t.name)) { texById.push(-1); return; }
  let file = null;
  if (t.embedded) {
    try {
      const mip0 = t.te + buf.readUInt32LE(t.te + 24);
      const mip3 = t.te + buf.readUInt32LE(t.te + 36);
      const palAt = mip3 + (t.w >> 3) * (t.h >> 3);
      const idx = buf.subarray(mip0, mip0 + t.w * t.h);
      const pal = buf.subarray(palAt, palAt + 768);
      if (pal.length === 768 && idx.length === t.w * t.h) {
        file = 'textures/' + texOut.length + '.png';
        writeIndexedPNG(path.join(OUT, file), t.w, t.h, Buffer.from(idx), Buffer.from(pal));
      }
    } catch (e) { console.warn('贴图解码失败 ' + t.name + ': ' + e.message); }
  }
  if (!file) {
    // 外置 WAD 贴图（原版 snow / c_stone1）→ 程序化还原
    const gen = t.name === 'c_stone1' ? genBrick : genSnow;
    const size = t.w === t.h && t.w >= 64 && t.w <= 512 ? t.w : 256;
    file = 'textures/' + texOut.length + '.png';
    writeRGBAPNG(path.join(OUT, file), size, size, gen(size));
    console.log('  程序化生成: ' + t.name);
  }
  texById.push(texOut.length);
  texOut.push({ name: t.name, width: t.w, height: t.h, file });
});

// 按贴图分组三角形（GoldSrc 坐标 Z-up -> three 坐标 Y-up: (x,z,-y)）
const groups = texOut.map(() => ({ positions: [], uvs: [], normals: [] }));
const world = models[0] || { mins: [0, 0, 0], maxs: [0, 0, 0] };
let triCount = 0, skyFaces = 0;

for (const f of faces) {
  const ti = texinfos[f.texinfo];
  if (!ti) continue;
  const outIdx = texById[ti.miptex];
  if (outIdx < 0) { skyFaces++; continue; }
  const tex = texOut[outIdx];
  const g = groups[outIdx];
  const pl = planes[f.planenum];
  const nBsp = f.side ? [-pl.n[0], -pl.n[1], -pl.n[2]] : pl.n;
  const nThree = [nBsp[0], nBsp[2], -nBsp[1]];
  const poly = [];
  for (let i = 0; i < f.numedges; i++) {
    const se = surfedges[f.firstedge + i];
    const e = se >= 0 ? edges[se] : edges[-se];
    const vi = se >= 0 ? e[0] : e[1];
    const v = verts[vi];
    const u = (v[0] * ti.s[0] + v[1] * ti.s[1] + v[2] * ti.s[2] + ti.s[3]) / tex.width;
    const w = (v[0] * ti.t[0] + v[1] * ti.t[1] + v[2] * ti.t[2] + ti.t[3]) / tex.height;
    poly.push([v[0], v[2], -v[1], u, w]);
  }
  if (poly.length < 3) continue;
  for (let i = 1; i < poly.length - 1; i++) {
    const tri = [poly[0], poly[i + 1], poly[i]];   // three.js 逆时针为正面（CCW）
    for (const p of tri) {
      g.positions.push(p[0], p[1], p[2]);
      g.uvs.push(p[3], p[4]);
      g.normals.push(nThree[0], nThree[1], nThree[2]);
    }
    triCount++;
  }
}

// ---------- 实体整理 ----------
const spawns = { T: [], CT: [] };
const pickups = [];
const entsDump = {};
for (const e of entities) {
  entsDump[e.classname] = (entsDump[e.classname] || 0) + 1;
  const org = (e.origin || '0 0 0').split(/\s+/).map(Number);
  const three = [org[0], org[2], -org[1]];
  const angle = e.angle !== undefined ? parseFloat(e.angle) : (e.angles ? parseFloat(e.angles.split(/\s+/)[1]) : 0);
  if (e.classname === 'info_player_deathmatch') spawns.T.push({ p: three, yaw: angle });
  else if (e.classname === 'info_player_start') spawns.CT.push({ p: three, yaw: angle });
  else if (e.classname === 'info_player_terrorist') spawns.T.push({ p: three, yaw: angle });
  else if (e.classname === 'info_player_counterterrorist') spawns.CT.push({ p: three, yaw: angle });
  else if (/^weapon_/.test(e.classname)) pickups.push({ kind: 'weapon', cls: e.classname.replace(/^weapon_/, ''), p: three, yaw: angle });
  else if (e.classname === 'armoury_entity') {
    const id = e.item !== undefined ? parseInt(e.item, 10) : 0;
    pickups.push({ kind: 'weapon', cls: ARMOURY[id] || 'mp5navy', p: three, yaw: angle });
  }
}

const map = {
  name: 'fy_iceworld',
  version,
  unit: 'goldsrc',
  world: { mins: world.mins, maxs: world.maxs },
  textures: texOut,
  meshes: groups.map((g, i) => ({ tex: i, positions: g.positions, uvs: g.uvs, normals: g.normals })).filter(m => m.positions.length),
  spawns,
  pickups,
  stats: { faces: faces.length, tris: triCount, skippedFaces: skyFaces, ents: entities.length }
};

fs.writeFileSync(path.join(OUT, 'map.json'), JSON.stringify(map));
fs.writeFileSync(path.join(OUT, 'entities-raw.json'), JSON.stringify(entities, null, 1));

console.log('BSP v' + version);
console.log('面数(渲染三角形): ' + triCount + ' / 原始面 ' + faces.length + ' / 跳过面 ' + skyFaces);
console.log('贴图: ' + texOut.length + ' 张');
texOut.forEach((t, i) => console.log('  [' + i + '] ' + t.name + ' ' + t.width + 'x' + t.height + ' ' + (t.file ? '内嵌' : '外置(需兜底)')));
console.log('出生点 T=' + spawns.T.length + ' CT=' + spawns.CT.length);
console.log('拾取物 ' + pickups.length);
console.log('实体统计: ' + JSON.stringify(entsDump));
console.log('地图范围 mins=' + world.mins + ' maxs=' + world.maxs);
