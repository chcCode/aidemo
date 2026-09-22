/**
 * 中国象棋核心引擎：棋盘状态、走法生成、规则校验。
 * 棋盘为 10×9 数组，row 0 为黑方底线，row 9 为红方底线。
 * 大写字母为红方，小写字母为黑方：
 * K/k 将帅, A/a 仕士, B/b 相象, N/n 马, R/r 车, C/c 炮, P/p 兵卒
 * 同时支持浏览器（挂到 window.XQEngine）与 Node.js（module.exports）。
 */
(function (global) {
  'use strict';

  var ROWS = 10;
  var COLS = 9;
  var RED = 1;
  var BLACK = -1;

  var INITIAL_ROWS = [
    'rnbakabnr',
    '.........',
    '.c.....c.',
    'p.p.p.p.p',
    '.........',
    '.........',
    'P.P.P.P.P',
    '.C.....C.',
    '.........',
    'RNBAKABNR'
  ];

  /** 创建初始棋盘。 */
  function createInitialBoard() {
    return INITIAL_ROWS.map(function (row) {
      return row.split('').map(function (ch) { return ch === '.' ? null : ch; });
    });
  }

  /** 深拷贝棋盘。 */
  function cloneBoard(board) {
    return board.map(function (row) { return row.slice(); });
  }

  function isRed(p) { return p >= 'A' && p <= 'Z'; }
  function isBlack(p) { return p >= 'a' && p <= 'z'; }
  function colorOf(p) { return isRed(p) ? RED : BLACK; }
  function typeOf(p) { return p.toUpperCase(); }
  function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

  /**
   * 向走法列表添加一步（目标需在界内且非己方棋子）。
   */
  function addMove(board, moves, r, c, tr, tc) {
    if (!inBounds(tr, tc)) return;
    var target = board[tr][tc];
    if (target && colorOf(target) === colorOf(board[r][c])) return;
    moves.push({ fromR: r, fromC: c, toR: tr, toC: tc, piece: board[r][c], captured: target });
  }

  /** 将/帅：九宫内直走一步；飞将（同列无子可直取对方将帅）。 */
  function genKingMoves(board, moves, r, c, color) {
    var rMin = color === RED ? 7 : 0;
    var rMax = color === RED ? 9 : 2;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var tr = r + dirs[i][0], tc = c + dirs[i][1];
      if (tr < rMin || tr > rMax || tc < 3 || tc > 5) continue;
      addMove(board, moves, r, c, tr, tc);
    }
    var step = color === RED ? -1 : 1;
    var fr = r + step;
    while (fr >= 0 && fr < ROWS) {
      var p = board[fr][c];
      if (p) {
        if (typeOf(p) === 'K' && colorOf(p) !== color) {
          addMove(board, moves, r, c, fr, c);
        }
        break;
      }
      fr += step;
    }
  }

  /** 仕/士：九宫内斜走一步。 */
  function genAdvisorMoves(board, moves, r, c, color) {
    var rMin = color === RED ? 7 : 0;
    var rMax = color === RED ? 9 : 2;
    var dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var tr = r + dirs[i][0], tc = c + dirs[i][1];
      if (tr < rMin || tr > rMax || tc < 3 || tc > 5) continue;
      addMove(board, moves, r, c, tr, tc);
    }
  }

  /** 相/象：田字对角走，不能过河，塞象眼则不可走。 */
  function genElephantMoves(board, moves, r, c, color) {
    var rMin = color === RED ? 5 : 0;
    var rMax = color === RED ? 9 : 4;
    var dirs = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
    for (var i = 0; i < dirs.length; i++) {
      var dr = dirs[i][0], dc = dirs[i][1];
      var tr = r + dr, tc = c + dc;
      if (tr < rMin || tr > rMax || tc < 0 || tc > COLS - 1) continue;
      if (board[r + dr / 2][c + dc / 2]) continue; // 塞象眼
      addMove(board, moves, r, c, tr, tc);
    }
  }

  /** 马的八个方向及对应腿位（蹩马腿）。 */
  var HORSE_STEPS = [
    [-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0],
    [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1]
  ];

  /** 马：日字走法，腿位有子则不可走。 */
  function genHorseMoves(board, moves, r, c) {
    for (var i = 0; i < HORSE_STEPS.length; i++) {
      var s = HORSE_STEPS[i];
      var tr = r + s[0], tc = c + s[1];
      if (!inBounds(tr, tc)) continue;
      if (board[r + s[2]][c + s[3]]) continue; // 蹩马腿
      addMove(board, moves, r, c, tr, tc);
    }
  }

  /** 车：直线任意距离，不可越子。 */
  function genRookMoves(board, moves, r, c) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var tr = r + dirs[i][0], tc = c + dirs[i][1];
      while (inBounds(tr, tc)) {
        var p = board[tr][tc];
        if (!p) {
          addMove(board, moves, r, c, tr, tc);
        } else {
          if (colorOf(p) !== colorOf(board[r][c])) addMove(board, moves, r, c, tr, tc);
          break;
        }
        tr += dirs[i][0];
        tc += dirs[i][1];
      }
    }
  }

  /** 炮：移动同车；吃子需恰好隔一个棋子（炮架）。 */
  function genCannonMoves(board, moves, r, c) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var tr = r + dirs[i][0], tc = c + dirs[i][1];
      var jumped = false;
      while (inBounds(tr, tc)) {
        var p = board[tr][tc];
        if (!jumped) {
          if (!p) {
            addMove(board, moves, r, c, tr, tc);
          } else {
            jumped = true; // 遇到炮架
          }
        } else if (p) {
          if (colorOf(p) !== colorOf(board[r][c])) addMove(board, moves, r, c, tr, tc);
          break;
        }
        tr += dirs[i][0];
        tc += dirs[i][1];
      }
    }
  }

  /** 兵/卒：前进一步；过河后可平移；不可后退。 */
  function genPawnMoves(board, moves, r, c, color) {
    var fwd = color === RED ? -1 : 1;
    addMove(board, moves, r, c, r + fwd, c);
    var crossed = color === RED ? r <= 4 : r >= 5;
    if (crossed) {
      addMove(board, moves, r, c, r, c - 1);
      addMove(board, moves, r, c, r, c + 1);
    }
  }

  /**
   * 生成某方的全部伪合法走法（不校验走后己方将帅是否被将）。
   *
   * Args:
   *   board: 10×9 棋盘数组。
   *   color: RED 或 BLACK。
   * Returns:
   *   走法对象数组 {fromR, fromC, toR, toC, piece, captured}。
   */
  function generatePseudoMoves(board, color) {
    var moves = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var p = board[r][c];
        if (!p || colorOf(p) !== color) continue;
        switch (typeOf(p)) {
          case 'K': genKingMoves(board, moves, r, c, color); break;
          case 'A': genAdvisorMoves(board, moves, r, c, color); break;
          case 'B': genElephantMoves(board, moves, r, c, color); break;
          case 'N': genHorseMoves(board, moves, r, c); break;
          case 'R': genRookMoves(board, moves, r, c); break;
          case 'C': genCannonMoves(board, moves, r, c); break;
          case 'P': genPawnMoves(board, moves, r, c, color); break;
        }
      }
    }
    return moves;
  }

  /**
   * 判断格子 (r, c) 是否被 byColor 方攻击。
   * 只需考虑能攻击到将帅的棋子：车、炮、马、兵、飞将（士象不出宫/不过河，不可能攻击到）。
   */
  function isAttacked(board, r, c, byColor) {
    var i, p, t, enemy;
    // 车 / 炮 / 飞将：四条直线射线
    var rays = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (i = 0; i < rays.length; i++) {
      var dr = rays[i][0], dc = rays[i][1];
      var nr = r + dr, nc = c + dc;
      var screen = false;
      while (inBounds(nr, nc)) {
        p = board[nr][nc];
        if (p) {
          enemy = colorOf(p) === byColor;
          t = typeOf(p);
          if (!screen) {
            // 射线上第一个棋子：车可直接攻击；同列的将帅为飞将
            if (enemy && (t === 'R' || (t === 'K' && dc === 0))) return true;
            screen = true;
          } else {
            // 隔一个棋子的第二个棋子：炮可攻击
            if (enemy && t === 'C') return true;
            break;
          }
        }
        nr += dr;
        nc += dc;
      }
    }
    // 马：检查八个可能的攻击位置，且其腿位为空
    for (i = 0; i < HORSE_STEPS.length; i++) {
      var s = HORSE_STEPS[i];
      var ar = r + s[0], ac = c + s[1];
      if (!inBounds(ar, ac)) continue;
      p = board[ar][ac];
      if (!p || typeOf(p) !== 'N' || colorOf(p) !== byColor) continue;
      if (!board[r + s[2]][c + s[3]]) return true;
    }
    // 兵/卒：红兵向上攻（攻击者位于 r+1 行），过河后可横向攻击
    if (byColor === RED) {
      if (inBounds(r + 1, c) && board[r + 1][c] === 'P') return true;
      if (r <= 4) {
        if (c > 0 && board[r][c - 1] === 'P') return true;
        if (c < COLS - 1 && board[r][c + 1] === 'P') return true;
      }
    } else {
      if (inBounds(r - 1, c) && board[r - 1][c] === 'p') return true;
      if (r >= 5) {
        if (c > 0 && board[r][c - 1] === 'p') return true;
        if (c < COLS - 1 && board[r][c + 1] === 'p') return true;
      }
    }
    return false;
  }

  /** 找到某方将帅位置，返回 {r, c} 或 null。 */
  function findKing(board, color) {
    var target = color === RED ? 'K' : 'k';
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (board[r][c] === target) return { r: r, c: c };
      }
    }
    return null;
  }

  /** 判断某方是否被将军（将帅被吃也视为被将）。 */
  function isInCheck(board, color) {
    var king = findKing(board, color);
    if (!king) return true;
    return isAttacked(board, king.r, king.c, -color);
  }

  /** 执行走法（就地修改棋盘）。 */
  function makeMove(board, move) {
    board[move.toR][move.toC] = move.piece;
    board[move.fromR][move.fromC] = null;
  }

  /** 撤销走法。 */
  function undoMove(board, move) {
    board[move.fromR][move.fromC] = move.piece;
    board[move.toR][move.toC] = move.captured;
  }

  /**
   * 生成某方的全部合法走法（过滤掉走后己方被将军的走法）。
   */
  function generateLegalMoves(board, color) {
    var pseudo = generatePseudoMoves(board, color);
    var legal = [];
    for (var i = 0; i < pseudo.length; i++) {
      var m = pseudo[i];
      makeMove(board, m);
      if (!isInCheck(board, color)) legal.push(m);
      undoMove(board, m);
    }
    return legal;
  }

  /**
   * 获取对局状态。
   *
   * Returns:
   *   {over, winner, reason, legalMoves}；无合法走法时游戏结束，
   *   被将军为绝杀（checkmate），否则为困毙（stalemate，象棋规则判负）。
   */
  function getGameState(board, colorToMove) {
    var legal = generateLegalMoves(board, colorToMove);
    if (legal.length > 0) {
      return { over: false, winner: 0, reason: '', legalMoves: legal };
    }
    var check = isInCheck(board, colorToMove);
    return {
      over: true,
      winner: -colorToMove,
      reason: check ? 'checkmate' : 'stalemate',
      legalMoves: []
    };
  }

  /**
   * Perft：统计指定深度的走法树节点数，用于校验走法生成正确性。
   */
  function perft(board, depth, color) {
    if (depth === 0) return 1;
    var moves = generateLegalMoves(board, color);
    if (depth === 1) return moves.length;
    var nodes = 0;
    for (var i = 0; i < moves.length; i++) {
      makeMove(board, moves[i]);
      nodes += perft(board, depth - 1, -color);
      undoMove(board, moves[i]);
    }
    return nodes;
  }

  var api = {
    ROWS: ROWS,
    COLS: COLS,
    RED: RED,
    BLACK: BLACK,
    createInitialBoard: createInitialBoard,
    cloneBoard: cloneBoard,
    isRed: isRed,
    isBlack: isBlack,
    colorOf: colorOf,
    typeOf: typeOf,
    inBounds: inBounds,
    generatePseudoMoves: generatePseudoMoves,
    generateLegalMoves: generateLegalMoves,
    isAttacked: isAttacked,
    findKing: findKing,
    isInCheck: isInCheck,
    makeMove: makeMove,
    undoMove: undoMove,
    getGameState: getGameState,
    perft: perft
  };

  global.XQEngine = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
