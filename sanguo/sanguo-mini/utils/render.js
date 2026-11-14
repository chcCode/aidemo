/* 三国象棋棋盘绘制层（微信小程序 canvas 2d / 浏览器 Canvas 共用）
 * 连接线默认印出：12 条边路虚线 + 3 条汇向鼎点的中路线。
 */
var SanguoRender = (function () {
  var BD = (typeof SanguoBoardData !== 'undefined')
    ? SanguoBoardData : require('./board-data.js');

  var W = BD.canvas[0], H = BD.canvas[1];
  var PAD = 46;
  var PAPER = '#CBA65C';
  var INK = '#3A2C18';
  var GRID = '#5A4527';
  var DASH = '#9E2B20';           // 12 条边路虚线
  var CENTER_LINE = '#6B4A12';    // 3 条中路线
  var PIECE_BG = '#F6E9CB';
  var ROT = { A: 0, B: -120, C: 120 };
  // 棋子尺寸（逻辑像素，随画布缩放）。最小落子点间距约 70.7，
  // 半径 28 + 阴影 2.5 = 30.5，两子之间仍留约 10 的间隙，不会互相压盖。
  var PIECE_R = 28;
  var PIECE_FONT = 1.18;   // 棋面字号 = 半径 * 系数（28 * 1.18 ≈ 33px）
  // 选中环与落子提示的视觉参数（2.4 调整：全部加粗加亮，绘制在棋子之上）
  var SEL_RING = '#FFD24D';      // 选中环主色（粗环）
  var SEL_GLOW = 'rgba(255,201,74,0.85)'; // 选中环发光
  var SEL_OUTER = 'rgba(255,255,255,0.95)'; // 选中外圈细环
  var HINT_MOVE = '#2AD46E';    // 空位可走点
  var HINT_TAKE = '#FF4436';    // 可吃点红环
  var HINT_PREV = '#6B4423';    // 上一步落点环（深棕，与纸面强对比）

  function layout(width, height) {
    var sw = W + PAD * 2, sh = H + PAD * 2;
    var scale = Math.min(width / sw, height / sh);
    return { scale: scale, ox: (width - sw * scale) / 2 + PAD * scale,
             oy: (height - sh * scale) / 2 + PAD * scale };
  }
  function tx(L, p) { return [L.ox + p[0] * L.scale, L.oy + p[1] * L.scale]; }

  function poly(ctx, L, pts, fill, stroke, width) {
    if (!pts || pts.length < 2) return;
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var q = tx(L, pts[i]);
      if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1; ctx.stroke(); }
  }

  function dashLine(ctx, a, b, dash, gap, color, width) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) return;
    var ux = dx / len, uy = dy / len, t = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    while (t < len) {
      var e = Math.min(t + dash, len);
      ctx.moveTo(a[0] + ux * t, a[1] + uy * t);
      ctx.lineTo(a[0] + ux * e, a[1] + uy * e);
      t = e + gap;
    }
    ctx.stroke();
  }

  function crossMark(ctx, x, y, r, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    var a = r - 2, b = r + 4;
    var segs = [
      [[-a, -b], [-a, -a]], [[-a, -a], [-b, -a]],
      [[a, -b], [a, -a]], [[a, -a], [b, -a]],
      [[-a, b], [-a, a]], [[-a, a], [-b, a]],
      [[a, b], [a, a]], [[a, a], [b, a]]
    ];
    ctx.beginPath();
    for (var i = 0; i < segs.length; i++) {
      ctx.moveTo(x + segs[i][0][0], y + segs[i][0][1]);
      ctx.lineTo(x + segs[i][1][0], y + segs[i][1][1]);
    }
    ctx.stroke();
  }

  function drawPiece(ctx, x, y, r, piece, side, selected) {
    var info = BD.sides[side];
    ctx.save();
    if (selected) {
      // 选中棋子整体金色发光
      ctx.shadowColor = SEL_GLOW;
      ctx.shadowBlur = 26;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = PIECE_BG;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,14,6,0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = PIECE_BG;
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.13);
    ctx.strokeStyle = info.color;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.78, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = info.color;
    ctx.stroke();
    if (selected) {
      // 发光粗环 + 白色外圈细环，双层高亮，保证在棕黄棋盘上一眼可辨
      ctx.save();
      ctx.shadowColor = SEL_GLOW;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(x, y, r + 4.5, 0, Math.PI * 2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = SEL_RING;
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x, y, r + 8, 0, Math.PI * 2);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = SEL_OUTER;
      ctx.stroke();
    }
    ctx.translate(x, y);
    ctx.rotate(ROT[side] * Math.PI / 180);
    ctx.fillStyle = info.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(r * PIECE_FONT) + 'px sans-serif';
    ctx.fillText(piece.t, 0, 1);
    if (piece.promoted) {
      ctx.font = 'bold ' + Math.round(r * 0.55) + 'px sans-serif';
      ctx.fillText('车', 0, r * 0.66);
    }
    ctx.restore();
  }

  function draw(ctx, opts) {
    var width = opts.width, height = opts.height;
    var L = layout(width, height), s = L.scale;
    var state = opts.state;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = opts.background || '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // 棋盘纸面
    var tl = tx(L, [-PAD, -PAD]), br = tx(L, [W + PAD, H + PAD]);
    ctx.fillStyle = PAPER;
    ctx.fillRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);

    // 四角禁区
    for (var i = 0; i < BD.corners.length; i++) poly(ctx, L, BD.corners[i], '#B8934E', INK, 1);
    // 三块野区
    for (i = 0; i < BD.wilds.length; i++) poly(ctx, L, BD.wilds[i], '#DEC28C', '#9C7B44', 1);
    // 中央六边形
    poly(ctx, L, BD.hex, '#E4CD9C', INK, 1.5);

    // 阵营网格（228 条边）
    ctx.strokeStyle = GRID;
    ctx.lineWidth = Math.max(1, 1.15 * s);
    ctx.beginPath();
    for (i = 0; i < BD.edges.length; i++) {
      var a = tx(L, BD.points[BD.edges[i][0]]), b = tx(L, BD.points[BD.edges[i][1]]);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();

    // 九宫斜线（手写虚线，兼容小程序 canvas）
    for (var sd in BD.palace) if (BD.palace.hasOwnProperty(sd)) {
      for (i = 0; i < BD.palace[sd].length; i++) {
        var pl = BD.palace[sd][i];
        var u = tx(L, BD.points[pl[0]]), v = tx(L, BD.points[pl[1]]);
        dashLine(ctx, u, v, 4 * s, 4 * s, GRID, Math.max(1, 1 * s));
      }
    }

    // 连接线：12 条边路虚线 + 3 条中路线（按用户要求印出来）
    if (opts.showLinks !== false) {
      for (i = 0; i < BD.cross.length; i++) {
        var p = tx(L, BD.points[BD.cross[i][0]]), q = tx(L, BD.points[BD.cross[i][1]]);
        dashLine(ctx, p, q, 8 * s, 5 * s, DASH, Math.max(1.6, 2.2 * s));
      }
      for (i = 0; i < BD.center_spokes.length; i++) {
        var sp = BD.center_spokes[i];
        var p2 = tx(L, BD.points[sp[0]]), q2 = tx(L, sp[1]);
        dashLine(ctx, p2, q2, 6 * s, 4 * s, CENTER_LINE, Math.max(1.4, 1.8 * s));
      }
      // 鼎点标记画在连接线之上，避免被虚线盖住
      var c = tx(L, BD.center);
      ctx.beginPath();
      ctx.arc(c[0], c[1], Math.max(8, 12 * s), 0, Math.PI * 2);
      ctx.fillStyle = '#E4CD9C';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, 1.2 * s);
      ctx.stroke();
      ctx.fillStyle = '#7A5B25';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.max(9, Math.round(12 * s)) + 'px sans-serif';
      ctx.fillText('鼎', c[0], c[1]);
    }

    // 炮位 / 兵位十字标记
    for (i = 0; i < BD.marks.length; i++) {
      var m = tx(L, BD.points[BD.marks[i]]);
      crossMark(ctx, m[0], m[1], 6 * s, GRID);
    }

    // 棋子
    var radius = PIECE_R * s;
    for (var key in state.board) if (state.board.hasOwnProperty(key)) {
      var pc = state.board[key], pp = tx(L, BD.points[key]);
      drawPiece(ctx, pp[0], pp[1], radius, pc, pc.s, key === opts.selected);
    }

    // —— 以下提示标记画在棋子之上，保证不被棋子遮挡 ——

    // 上一步落点：环绕棋子外缘的深棕细环
    if (state.lastMove) {
      var lp = tx(L, BD.points[state.lastMove.to]);
      ctx.beginPath();
      ctx.arc(lp[0], lp[1], radius + 6 * s, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1.6, 2.2 * s);
      ctx.strokeStyle = HINT_PREV;
      ctx.stroke();
    }

    // 可走点：空位画发光亮绿点 + 白描边；可吃子画环绕棋子的发光红环
    var targets = opts.targets || [];
    for (i = 0; i < targets.length; i++) {
      var tp = tx(L, BD.points[targets[i].to]);
      if (targets[i].capture) {
        ctx.save();
        ctx.shadowColor = 'rgba(255,68,54,0.9)';
        ctx.shadowBlur = 14 * s;
        ctx.beginPath();
        ctx.arc(tp[0], tp[1], radius + 4.5 * s, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(3, 4.5 * s);
        ctx.strokeStyle = HINT_TAKE;
        ctx.stroke();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(tp[0], tp[1], radius + 1.6 * s, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1.2, 1.8 * s);
        ctx.strokeStyle = 'rgba(255,96,80,0.85)';
        ctx.stroke();
      } else {
        ctx.save();
        ctx.shadowColor = 'rgba(42,212,110,0.95)';
        ctx.shadowBlur = 12 * s;
        ctx.beginPath();
        ctx.arc(tp[0], tp[1], 9 * s, 0, Math.PI * 2);
        ctx.fillStyle = HINT_MOVE;
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(tp[0], tp[1], 9 * s, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1.8, 2.4 * s);
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
      }
    }

    return L;
  }

  function hit(opts, x, y) {
    var L = layout(opts.width, opts.height);
    var best = null, bd = 38 / L.scale;   // 点击容差随棋子一起放大
    for (var p in BD.points) if (BD.points.hasOwnProperty(p)) {
      var q = BD.points[p];
      var d = Math.sqrt(Math.pow(q[0] - (x - L.ox) / L.scale, 2) +
                        Math.pow(q[1] - (y - L.oy) / L.scale, 2));
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  return { layout: layout, draw: draw, hit: hit,
           W: W, H: H, PAD: PAD, PIECE_R: PIECE_R, PIECE_FONT: PIECE_FONT };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = SanguoRender; }
