/* utils.js : 工具函数 */
window.NB = window.NB || {};

NB.U = {
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  chance(p) { return Math.random() < p; },
  sign(v) { return v < 0 ? -1 : 1; },
  lerp(a, b, t) { return a + (b - a) * t; },
  overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  },
  dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); },
};
