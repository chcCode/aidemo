(function (SB) {
  'use strict';

  const U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = (arr) => arr[(Math.random() * arr.length) | 0];

  U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  U.dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };

  U.normAngle = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  U.angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

  // 朝 target 角度转向，限制每帧最大角速度
  U.steer = (cur, target, maxTurn) => {
    let d = U.normAngle(target - cur);
    if (d > maxTurn) d = maxTurn;
    else if (d < -maxTurn) d = -maxTurn;
    return cur + d;
  };

  // 平滑插值角度（不受 ±π 跳变影响）
  U.angleLerp = (a, b, t) => a + U.normAngle(b - a) * t;

  U.hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  U.rgba = (hex, a) => {
    const c = U.hexToRgb(hex);
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  };

  U.shade = (hex, f) => {
    const c = U.hexToRgb(hex);
    const g = (v) => U.clamp(Math.round(v * f), 0, 255);
    return `rgb(${g(c[0])},${g(c[1])},${g(c[2])})`;
  };

  // 随机安全出生点（远离其他蛇）
  U.safeSpot = (worldW, worldH, snakes, minDist) => {
    for (let i = 0; i < 60; i++) {
      const x = U.rand(200, worldW - 200);
      const y = U.rand(200, worldH - 200);
      let ok = true;
      for (const s of snakes) {
        if (!s.alive) continue;
        if (U.dist2(x, y, s.head.x, s.head.y) < minDist * minDist) { ok = false; break; }
      }
      if (ok) return { x, y };
    }
    return { x: U.rand(200, worldW - 200), y: U.rand(200, worldH - 200) };
  };

  /* 简单网格空间索引：每帧重建或按需插入 */
  function SpatialGrid(cell) {
    this.cell = cell;
    this.map = new Map();
  }
  SpatialGrid.prototype.clear = function () { this.map.clear(); };
  SpatialGrid.prototype._key = function (cx, cy) { return cx * 73856093 ^ cy * 19349663; };
  SpatialGrid.prototype.insert = function (x, y, obj) {
    const cx = (x / this.cell) | 0, cy = (y / this.cell) | 0;
    const k = this._key(cx, cy);
    let arr = this.map.get(k);
    if (!arr) { arr = []; this.map.set(k, arr); }
    arr.push(obj);
  };
  // 返回与 (x,y,r) 覆盖的所有单元内的对象数组（可能含略微越界者，调用方需二次过滤）
  SpatialGrid.prototype.query = function (x, y, r, out) {
    out = out || [];
    out.length = 0;
    const c = this.cell;
    const x0 = ((x - r) / c) | 0, x1 = ((x + r) / c) | 0;
    const y0 = ((y - r) / c) | 0, y1 = ((y + r) / c) | 0;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const arr = this.map.get(this._key(cx, cy));
        if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]);
      }
    }
    return out;
  };

  SB.U = U;
  SB.SpatialGrid = SpatialGrid;
})(window.SB);
