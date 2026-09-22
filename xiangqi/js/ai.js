/**
 * 中国象棋 AI：迭代加深 + Alpha-Beta 搜索 + 子力/位置评估。
 * 通过搜索深度与随机性区分难度档位。
 * 同时支持浏览器（挂到 window.XQAI）与 Node.js（module.exports）。
 */
(function (global) {
  'use strict';

  var E = global.XQEngine;

  /** 子力价值 */
  var VALUES = { K: 100000, R: 600, N: 270, C: 300, A: 120, B: 120, P: 60 };
  var MATE = 1000000;

  /**
   * 位置加成表（红方视角，row 0 为黑方底线；黑方取行镜像 table[9-r][c]）。
   * 数值越大位置越优。
   */
  var PST = {
    P: [
      [90, 90, 90, 95, 100, 95, 90, 90, 90],
      [85, 85, 85, 90, 95, 90, 85, 85, 85],
      [75, 80, 85, 90, 90, 90, 85, 80, 75],
      [65, 70, 75, 80, 85, 80, 75, 70, 65],
      [50, 55, 60, 65, 70, 65, 60, 55, 50],
      [20, 25, 30, 35, 35, 35, 30, 25, 20],
      [10, 12, 15, 18, 18, 18, 15, 12, 10],
      [5, 8, 10, 12, 12, 12, 10, 8, 5],
      [5, 8, 10, 12, 12, 12, 10, 8, 5],
      [5, 8, 10, 12, 12, 12, 10, 8, 5]
    ],
    N: [
      [0, 10, 15, 20, 20, 20, 15, 10, 0],
      [10, 20, 30, 35, 35, 35, 30, 20, 10],
      [15, 30, 40, 45, 45, 45, 40, 30, 15],
      [15, 30, 40, 50, 50, 50, 40, 30, 15],
      [10, 25, 40, 50, 55, 50, 40, 25, 10],
      [10, 25, 35, 45, 50, 45, 35, 25, 10],
      [5, 20, 30, 40, 40, 40, 30, 20, 5],
      [5, 15, 25, 30, 30, 30, 25, 15, 5],
      [0, 10, 20, 25, 25, 25, 20, 10, 0],
      [-10, 0, 10, 15, 15, 15, 10, 0, -10]
    ],
    C: [
      [10, 15, 20, 25, 25, 25, 20, 15, 10],
      [10, 20, 25, 30, 30, 30, 25, 20, 10],
      [5, 15, 25, 35, 35, 35, 25, 15, 5],
      [5, 15, 20, 30, 35, 30, 20, 15, 5],
      [0, 10, 20, 25, 30, 25, 20, 10, 0],
      [0, 10, 15, 20, 25, 20, 15, 10, 0],
      [5, 10, 15, 20, 20, 20, 15, 10, 5],
      [10, 15, 20, 25, 25, 25, 20, 15, 10],
      [10, 15, 20, 25, 30, 25, 20, 15, 10],
      [5, 10, 15, 20, 25, 20, 15, 10, 5]
    ],
    R: [
      [15, 20, 20, 25, 25, 25, 20, 20, 15],
      [20, 25, 30, 35, 35, 35, 30, 25, 20],
      [15, 25, 30, 35, 40, 35, 30, 25, 15],
      [15, 25, 30, 35, 40, 35, 30, 25, 15],
      [10, 20, 25, 30, 35, 30, 25, 20, 10],
      [10, 20, 25, 30, 35, 30, 25, 20, 10],
      [10, 15, 20, 25, 25, 25, 20, 15, 10],
      [10, 20, 20, 25, 25, 25, 20, 20, 10],
      [5, 10, 15, 20, 20, 20, 15, 10, 5],
      [5, 10, 15, 20, 20, 20, 15, 10, 5]
    ]
  };

  /** 难度档位：depth 为搜索深度，randomness 为随机选招概率，timeLimit 为思考上限（毫秒）。 */
  var DIFFICULTIES = {
    easy: { name: '简单', maxDepth: 1, randomness: 0.4, timeLimit: 3000 },
    medium: { name: '普通', maxDepth: 2, randomness: 0.1, timeLimit: 5000 },
    hard: { name: '困难', maxDepth: 3, randomness: 0, timeLimit: 8000 },
    master: { name: '大师', maxDepth: 4, randomness: 0, timeLimit: 15000 }
  };

  function pieceValue(p) {
    return VALUES[E.typeOf(p)];
  }

  /**
   * 局面评估：返回红方视角的分数（正值红优，负值黑优）。
   */
  function evaluate(board) {
    var score = 0;
    for (var r = 0; r < E.ROWS; r++) {
      for (var c = 0; c < E.COLS; c++) {
        var p = board[r][c];
        if (!p) continue;
        var t = E.typeOf(p);
        var table = PST[t];
        if (E.isRed(p)) {
          score += VALUES[t] + (table ? table[r][c] : 0);
        } else {
          score -= VALUES[t] + (table ? table[E.ROWS - 1 - r][c] : 0);
        }
      }
    }
    return score;
  }

  /** 走法排序：优先搜索吃子着法（MVV-LVA），提升 Alpha-Beta 剪枝效率。 */
  function orderMoves(moves) {
    moves.sort(function (a, b) {
      return moveOrderScore(b) - moveOrderScore(a);
    });
  }

  function moveOrderScore(m) {
    return m.captured ? 10 * pieceValue(m.captured) - pieceValue(m.piece) : 0;
  }

  /**
   * Negamax 形式的 Alpha-Beta 搜索。
   *
   * Args:
   *   board: 当前棋盘。
   *   depth: 剩余搜索深度。
   *   alpha/beta: 剪枝窗口。
   *   color: 当前行棋方。
   *   ply: 距离根节点的层数（用于优先选择更快的杀棋）。
   *   ctx: 搜索上下文 {nodes, deadline, aborted}。
   * Returns:
   *   当前行棋方视角的局面分数。
   */
  function negamax(board, depth, alpha, beta, color, ply, ctx) {
    ctx.nodes++;
    if ((ctx.nodes & 0x3FF) === 0 && Date.now() > ctx.deadline) {
      ctx.aborted = true;
    }
    if (ctx.aborted) return 0;
    if (depth === 0) return color * evaluate(board);

    var moves = E.generateLegalMoves(board, color);
    if (moves.length === 0) return -MATE + ply; // 被绝杀或困毙

    orderMoves(moves);
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      E.makeMove(board, moves[i]);
      var s = -negamax(board, depth - 1, -beta, -alpha, -color, ply + 1, ctx);
      E.undoMove(board, moves[i]);
      if (ctx.aborted) return 0;
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    return best;
  }

  /**
   * 为指定方搜索最佳走法（迭代加深，超时自动沿用已完成深度的结果）。
   *
   * Args:
   *   board: 当前棋盘（不会被修改）。
   *   color: 行棋方。
   *   preset: 难度配置 {maxDepth, randomness, timeLimit}。
   * Returns:
   *   {move, score, depth, time}；无合法走法时返回 null。
   */
  function findBestMove(board, color, preset) {
    var moves = E.generateLegalMoves(board, color);
    if (moves.length === 0) return null;
    orderMoves(moves);

    var ctx = { nodes: 0, deadline: Date.now() + (preset.timeLimit || 8000), aborted: false };
    var start = Date.now();
    var bestMove = moves[0];
    var bestScore = -Infinity;
    var completedDepth = 0;
    var lastScored = null;

    for (var depth = 1; depth <= preset.maxDepth; depth++) {
      ctx.aborted = false;
      var alpha = -Infinity;
      var iterBest = null;
      var iterBestScore = -Infinity;
      var scored = [];

      for (var i = 0; i < moves.length; i++) {
        var m = moves[i];
        E.makeMove(board, m);
        var s = -negamax(board, depth - 1, -Infinity, -alpha, -color, 1, ctx);
        E.undoMove(board, m);
        if (ctx.aborted) break;
        scored.push({ move: m, score: s });
        if (s > iterBestScore) {
          iterBestScore = s;
          iterBest = m;
        }
        if (s > alpha) alpha = s;
      }

      if (ctx.aborted || !iterBest) break; // 本轮被超时打断，沿用上一轮结果
      bestMove = iterBest;
      bestScore = iterBestScore;
      completedDepth = depth;
      lastScored = scored;

      // 按本轮得分重排走法，加速下一轮迭代
      scored.sort(function (a, b) { return b.score - a.score; });
      moves = scored.map(function (s) { return s.move; });

      if (bestScore >= MATE - 1000) break; // 已找到必杀，无需加深
    }

    // 带随机性的档位：从接近最优的走法中随机挑选，增加变化、降低棋力
    if (preset.randomness > 0 && lastScored && Math.random() < preset.randomness) {
      var pool = lastScored.filter(function (s) { return s.score >= bestScore - 60; });
      if (pool.length > 0) {
        var pick = pool[Math.floor(Math.random() * pool.length)];
        bestMove = pick.move;
        bestScore = pick.score;
      }
    }

    return { move: bestMove, score: bestScore, depth: completedDepth, time: Date.now() - start };
  }

  var api = {
    DIFFICULTIES: DIFFICULTIES,
    evaluate: evaluate,
    findBestMove: findBestMove
  };

  global.XQAI = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
