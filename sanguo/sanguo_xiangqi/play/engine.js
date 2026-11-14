/* 三国象棋规则引擎（专利 CN87205572U 版）
 * 纯 JS、无平台 API：微信小程序与网页试玩版共用同一份。
 *
 * 棋盘为 135 点的图：228 条阵内边 + 12 条边路虚线 + 3 条中路线。
 * 「三角形河界算作一格」：从本方国境线 r=4 经跨区连线到另一方 r=4 视为一步；
 * 棋子进入他方阵地后，前进方向自动翻转为 r 递减。
 */
var SanguoEngine = (function () {
  var BD = (typeof SanguoBoardData !== 'undefined')
    ? SanguoBoardData : require('./board-data.js');

  var POINTS = BD.points;
  var CROSS_ADJ = BD.cross_adj;
  var TURN_ORDER = BD.turn_order;
  var SIDES = ['A', 'B', 'C'];
  var RULES = BD.rules;

  var VALUE = { '车': 900, '马': 400, '炮': 450, '士': 180, '象': 190,
                '兵': 100, '卒': 100, '勇': 100, '魏': 100000,
                '蜀': 100000, '吴': 100000 };
  var PAWNS = { '兵': 1, '卒': 1, '勇': 1 };
  var KINGS = { '魏': 1, '蜀': 1, '吴': 1 };

  function pid(s, f, r) { return s + f + r; }
  function parse(p) { return { s: p.charAt(0), f: +p.charAt(1), r: +p.charAt(2) }; }
  function isKing(t) { return !!KINGS[t]; }
  function isPawn(t) { return !!PAWNS[t]; }
  function signFor(owner, s) { return s === owner ? 1 : -1; }

  /* 跨区邻接：只保留「离开本方」的方向，禁止通过虚线退回本方 */
  function crossNeighbors(p, owner) {
    var list = CROSS_ADJ[p] || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (parse(list[i]).s !== owner) out.push(list[i]);
    }
    return out;
  }

  /* 沿 4 个局部方向走一步。返回候选点数组（中路线 f=4 有两个去向）。
   * allowCross=false 用于「虚线仅兵卒勇可用」的专利严格模式。 */
  function stepOne(p, dir, owner, allowBack, allowCross) {
    var o = parse(p), s = o.s, f = o.f, r = o.r;
    var sign = signFor(owner, s);
    if (dir === 'L' || dir === 'R') {
      var nf = f + (dir === 'L' ? -1 : 1);
      if (nf < 0 || nf > 8) return [];
      return [pid(s, nf, r)];
    }
    var dr = (dir === 'F') ? 1 : -1;
    var nr = r + dr * sign;
    if (nr >= 0 && nr <= 4) return [pid(s, f, nr)];
    if (nr > 4 && ((s === owner && dir === 'F') || (s !== owner && dir === 'B' && allowBack))) {
      if (allowCross === false) return [];
      return crossNeighbors(pid(s, f, 4), owner);
    }
    return [];
  }

  /* 车 / 炮用的射线：返回若干条「按行进顺序排列的点序列」。
   * 中路线跨河时会分叉到另外两国，两条分支必须各自独立处理，
   * 否则一条分支上的炮架或阻挡会串到另一条分支上。 */
  function rayPaths(from, dir, owner, allowBack, allowCross) {
    var paths = [], work = [{ at: from, pts: [], seen: {} }], guard = 0;
    while (work.length && paths.length < 64 && guard++ < 4000) {
      var cur = work.pop();
      var ns = stepOne(cur.at, dir, owner, allowBack, allowCross);
      if (!ns.length) {
        if (cur.pts.length) paths.push(cur.pts);
        continue;
      }
      for (var i = 0; i < ns.length; i++) {
        var p = ns[i], pts = cur.pts.slice(), seen = {};
        for (var k in cur.seen) if (cur.seen.hasOwnProperty(k)) seen[k] = true;
        seen[from] = true;
        if (seen[p]) {
          if (pts.length) paths.push(pts);
          continue;
        }
        pts.push(p);
        seen[p] = true;
        work.push({ at: p, pts: pts, seen: seen });
      }
    }
    return paths;
  }

  /* 多条射线可能到达同一个点，按落点去重 */
  function dedupe(moves) {
    var out = [], seen = {};
    for (var i = 0; i < moves.length; i++) {
      var k = moves[i].to;
      if (seen[k]) continue;
      seen[k] = true;
      out.push(moves[i]);
    }
    return out;
  }

  /* 逻辑坐标目标：df 横向、dr 沿「前进方向」；自动处理跨河映射 */
  function logicalTarget(p, df, dr, owner, allowCross) {
    var o = parse(p), s = o.s, f = o.f, r = o.r;
    var nf = f + df;
    if (nf < 0 || nf > 8) return [];
    var nr = r + dr * signFor(owner, s);
    if (nr >= 0 && nr <= 4) return [pid(s, nf, nr)];
    if (nr > 4 && s === owner && allowCross !== false) {
      var k = nr - 5;                 // 跨河本身占一步
      var r2 = 4 - k;
      if (r2 < 0) return [];
      var ns = crossNeighbors(pid(s, nf, 4), owner);
      var out = [];
      for (var i = 0; i < ns.length; i++) {
        var q = parse(ns[i]);
        out.push(pid(q.s, q.f, r2));
      }
      return out;
    }
    return [];
  }

  function first(list) { return list.length ? list[0] : null; }
  function inPalace(o) { return o.f >= 3 && o.f <= 5 && o.r >= 0 && o.r <= 2; }

  function pushMove(out, from, to, board, side, allowPromote) {
    if (!to) return;
    var target = board[to];
    if (target && target.s === side) return;
    var o = parse(to);
    var promote = !!(allowPromote && o.s !== side && o.r === 0);
    out.push({ from: from, to: to, capture: target ? target.t : null,
               captureSide: target ? target.s : null, promote: promote });
  }

  /* 生成单枚棋子的全部着法 */
  function movesFor(state, from) {
    var board = state.board, piece = board[from];
    if (!piece) return [];
    var side = piece.s, t = (piece.promoted ? '车' : piece.t);
    var o = parse(from), out = [];
    var i, j, dirs, arr, leg, targets;
    // 专利原文「虚线其它棋子不能利用它」：打开该开关后，只有兵卒勇能跨河
    var allowCross = !(RULES && RULES.dashed_for_pawns_only) || isPawn(t);

    if (isKing(t) || t === '士' || t === '象') {
      // 这三种棋子不能越过三角形河界，且将/士限于九宫
      var cand = [];
      if (isKing(t)) {
        cand = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      } else if (t === '士') {
        cand = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      } else {
        cand = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
      }
      for (i = 0; i < cand.length; i++) {
        var df = cand[i][0], dr = cand[i][1];
        if (t === '象') {
          leg = first(logicalTarget(from, df / 2, dr / 2, side, allowCross));
          if (leg && board[leg]) continue;       // 塞象眼
        }
        targets = logicalTarget(from, df, dr, side, allowCross);
        for (j = 0; j < targets.length; j++) {
          var tp = parse(targets[j]);
          if (tp.s !== side) continue;           // 不能过河
          if ((isKing(t) || t === '士') && !inPalace(tp)) continue;
          pushMove(out, from, targets[j], board, side, false);
        }
      }
      return dedupe(out);
    }

    if (t === '马') {
      var horse = [[1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1],
                   [2, 1, 1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [-2, -1, -1, 0]];
      for (i = 0; i < horse.length; i++) {
        leg = first(logicalTarget(from, horse[i][2], horse[i][3], side, allowCross));
        if (!leg || board[leg]) continue;        // 蹩马腿
        targets = logicalTarget(from, horse[i][0], horse[i][1], side, allowCross);
        for (j = 0; j < targets.length; j++) pushMove(out, from, targets[j], board, side, false);
      }
      return dedupe(out);
    }

    dirs = ['F', 'B', 'L', 'R'];
    for (i = 0; i < dirs.length; i++) {
      var dir = dirs[i];
      if (isPawn(t)) {
        if (dir === 'B') continue;               // 兵不能后退
        if (dir === 'L' || dir === 'R') {
          if (o.s === side) continue;            // 未过河不能横走
        }
      }
      var allowBack = !(isPawn(t));
      var paths = rayPaths(from, dir, side, allowBack, allowCross);
      for (var pi = 0; pi < paths.length; pi++) {
        var ray = paths[pi];
        if (t === '炮') {
          // 未过炮架：空格可落子，遇到的第一个棋子是炮架（不可落子）；
          // 过炮架后：空格不可落子，只能吃遇到的第一个敌子。
          var passed = false;
          for (j = 0; j < ray.length; j++) {
            var pp = ray[j], occ = board[pp];
            if (!passed) {
              if (occ) { passed = true; continue; }
              pushMove(out, from, pp, board, side, false);
            } else if (occ) {
              pushMove(out, from, pp, board, side, false);
              break;
            }
          }
        } else {
          for (j = 0; j < ray.length; j++) {
            var qp = ray[j], qocc = board[qp];
            if (qocc) {
              if (qocc.s !== side) pushMove(out, from, qp, board, side, isPawn(t));
              break;
            }
            if (isPawn(t)) {                        // 兵每步只走一格
              pushMove(out, from, qp, board, side, true);
              break;
            }
            pushMove(out, from, qp, board, side, false);
          }
        }
      }
    }
    return dedupe(out);
  }

  function allMoves(state, side) {
    var out = [], board = state.board;
    for (var p in board) {
      if (!board.hasOwnProperty(p)) continue;
      if (board[p].s !== side) continue;
      if (state.frozen[side]) continue;          // 败方余子原地冻结
      var ms = movesFor(state, p);
      for (var i = 0; i < ms.length; i++) out.push(ms[i]);
    }
    return out;
  }

  function cloneState(s) {
    var b = {};
    for (var p in s.board) if (s.board.hasOwnProperty(p)) {
      b[p] = { s: s.board[p].s, t: s.board[p].t, promoted: s.board[p].promoted };
    }
    return {
      board: b, turn: s.turn,
      alive: { A: s.alive.A, B: s.alive.B, C: s.alive.C },
      frozen: { A: s.frozen.A, B: s.frozen.B, C: s.frozen.C },
      moveNo: s.moveNo, winner: s.winner, lastMove: s.lastMove
    };
  }

  function nextSide(state, cur) {
    var i = TURN_ORDER.indexOf(cur);
    for (var k = 1; k <= 3; k++) {
      var s = TURN_ORDER[(i + k) % 3];
      if (state.alive[s]) return s;
    }
    return cur;
  }

  function refreshWinner(state) {
    var alive = [];
    for (var i = 0; i < SIDES.length; i++) if (state.alive[SIDES[i]]) alive.push(SIDES[i]);
    if (alive.length === 1) state.winner = alive[0];
    else if (alive.length === 0) state.winner = 'DRAW';
    return state.winner;
  }

  function createGame() {
    var board = {};
    for (var i = 0; i < BD.initial.length; i++) {
      var it = BD.initial[i];
      board[it.p] = { s: it.s, t: it.t, promoted: false };
    }
    return {
      board: board, turn: TURN_ORDER[0],
      alive: { A: true, B: true, C: true },
      frozen: { A: false, B: false, C: false },
      moveNo: 1, winner: null, lastMove: null
    };
  }

  function applyMove(state, m) {
    var ns = cloneState(state);
    var piece = ns.board[m.from];
    if (!piece) return ns;
    var cap = ns.board[m.to];
    delete ns.board[m.from];
    if (m.promote) ns.board[m.to] = { s: piece.s, t: '车', promoted: true };
    else ns.board[m.to] = piece;
    if (cap && isKing(cap.t)) {
      ns.alive[cap.s] = false;
      ns.frozen[cap.s] = true;
    }
    ns.lastMove = { from: m.from, to: m.to, s: piece.s, t: piece.t,
                    capture: cap ? cap.t : null, captureSide: cap ? cap.s : null,
                    promote: !!m.promote };
    ns.moveNo++;
    refreshWinner(ns);
    ns.turn = ns.winner ? ns.turn : nextSide(ns, ns.turn);
    return ns;
  }

  /* 主帅是否正被攻击（用于界面「被将」提示） */
  function inCheck(state, side) {
    var kingAt = null;
    for (var p in state.board) if (state.board.hasOwnProperty(p)) {
      var pc = state.board[p];
      if (pc.s === side && isKing(pc.t)) { kingAt = p; break; }
    }
    if (!kingAt) return false;
    for (var q in state.board) if (state.board.hasOwnProperty(q)) {
      var o = state.board[q];
      if (o.s === side || state.frozen[o.s]) continue;
      var ms = movesFor(state, q);
      for (var i = 0; i < ms.length; i++) if (ms[i].to === kingAt) return true;
    }
    return false;
  }

  /* 评估：以 me 的视角，子力 + 位置 */
  function evaluate(state, me) {
    if (!state.alive[me]) return -1000000;
    if (state.winner === me) return 1000000;
    if (state.winner && state.winner !== 'DRAW') return -1000000;
    var score = 0;
    for (var p in state.board) if (state.board.hasOwnProperty(p)) {
      var pc = state.board[p], o = parse(p);
      var v = VALUE[pc.promoted ? '车' : pc.t] || 100;
      if (isPawn(pc.t) && !pc.promoted) {
        // 越靠近对方底线越值钱
        v += (o.s === pc.s) ? o.r * 8 : (4 - o.r) * 22;
      }
      if (pc.t === '车' || pc.t === '炮') v += (4 - Math.abs(o.f - 4)) * 3;
      if (pc.s === me) score += v;
      else if (state.frozen[pc.s]) score += 0;     // 败方冻结残兵不计入任何一方实力
      else score -= v * 0.72;
    }
    return score;
  }

  // 简易伪随机，保证同一局面下 AI 略有变化但不依赖 Math.random 的平台差异
  var seed = 20261114;
  function rnd() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  function orderMoves(moves, state) {
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], sc = 0;
      if (m.capture) {
        var v = VALUE[m.capture] || 100;
        sc += 10000 + v;
        if (isKing(m.capture)) sc += 500000;
      }
      if (m.promote) sc += 3000;
      sc += rnd() * 60;
      m._score = sc;
    }
    moves.sort(function (a, b) { return b._score - a._score; });
    return moves;
  }

  function search(state, depth, alpha, beta, me, deadline) {
    if (state.winner || depth <= 0 || Date.now() > deadline) return evaluate(state, me);
    var side = state.turn;
    var moves = allMoves(state, side);
    if (!moves.length) {
      var skipped = cloneState(state);
      skipped.turn = nextSide(skipped, side);
      return search(skipped, depth - 1, alpha, beta, me, deadline);
    }
    orderMoves(moves, state);
    var maximizing = (side === me);
    var best = maximizing ? -Infinity : Infinity;
    for (var i = 0; i < moves.length; i++) {
      var ns = applyMove(state, moves[i]);
      var v = search(ns, depth - 1, alpha, beta, me, deadline);
      if (maximizing) {
        if (v > best) best = v;
        if (best > alpha) alpha = best;
      } else {
        if (v < best) best = v;
        if (best < beta) beta = best;
      }
      if (beta <= alpha || Date.now() > deadline) break;
    }
    return best;
  }

  /* AI 选着：level 0=入门 1=普通 2=进阶 */
  function chooseMove(state, side, level) {
    var moves = allMoves(state, side);
    if (!moves.length) return null;
    orderMoves(moves, state);
    if (level === 0) {
      var pool = moves.slice(0, Math.min(6, moves.length));
      return pool[Math.floor(rnd() * pool.length)];
    }
    var depth = (level === 1) ? 2 : 3;
    var budget = (level === 1) ? 550 : 1400;
    var deadline = Date.now() + budget;
    var best = null, bestScore = -Infinity, alpha = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var ns = applyMove(state, moves[i]);
      var v = search(ns, depth - 1, alpha, Infinity, side, deadline);
      v += rnd() * 12;
      if (v > bestScore) { bestScore = v; best = moves[i]; }
      if (v > alpha) alpha = v;
      if (Date.now() > deadline) break;
    }
    return best || moves[0];
  }

  return {
    BD: BD,
    createGame: createGame,
    allMoves: allMoves,
    movesFor: movesFor,
    applyMove: applyMove,
    cloneState: cloneState,
    inCheck: inCheck,
    evaluate: evaluate,
    chooseMove: chooseMove,
    nextSide: nextSide,
    parse: parse,
    isKing: isKing,
    VALUE: VALUE
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = SanguoEngine; }
