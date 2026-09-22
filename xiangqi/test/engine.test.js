/**
 * 引擎规则测试：Perft 基准 + 关键规则单元测试。
 * 运行：node test/engine.test.js
 */
'use strict';

const E = require('../js/engine.js');

let passed = 0;
let failed = 0;

function assert(cond, name) {
  if (cond) {
    passed++;
    console.log('  ✓ ' + name);
  } else {
    failed++;
    console.error('  ✗ ' + name);
  }
}

/** 用简化棋盘字符串数组构建棋盘（'.' 为空）。 */
function boardFromRows(rows) {
  return rows.map(function (row) {
    return row.split('').map(function (ch) { return ch === '.' ? null : ch; });
  });
}

function emptyBoard() {
  const rows = [];
  for (let i = 0; i < 10; i++) rows.push('.........');
  return boardFromRows(rows);
}

function legalTargets(board, r, c, color) {
  return E.generateLegalMoves(board, color)
    .filter(function (m) { return m.fromR === r && m.fromC === c; })
    .map(function (m) { return m.toR + ',' + m.toC; });
}

// ---------- Perft 基准（官方数据：44 / 1920 / 79666） ----------
console.log('[Perft 基准]');
{
  const board = E.createInitialBoard();
  const cases = [[1, 44], [2, 1920], [3, 79666]];
  for (const [depth, expected] of cases) {
    const t0 = Date.now();
    const got = E.perft(board, depth, E.RED);
    assert(got === expected, 'perft(' + depth + ') = ' + got + '（期望 ' + expected + '，' + (Date.now() - t0) + 'ms）');
  }
}

// ---------- 初始局面炮的隔子吃 ----------
console.log('[炮：隔子吃与直线移动]');
{
  const board = E.createInitialBoard();
  const targets = legalTargets(board, 7, 1, E.RED);
  assert(targets.indexOf('0,1') !== -1, '初始局面炮可隔对方炮吃马 (7,1)->(0,1)');
  assert(targets.indexOf('2,1') === -1, '炮不能直接吃第一个遇到的棋子（炮架）');
  assert(targets.length === 12, '初始局面单炮共 12 步（实际 ' + targets.length + '）');
}

// ---------- 马与蹩马腿 ----------
console.log('[马：蹩马腿]');
{
  const board = E.createInitialBoard();
  const targets = legalTargets(board, 9, 1, E.RED);
  assert(targets.length === 2, '初始局面马被象蹩腿只有 2 步（实际 ' + targets.length + '）');
  assert(targets.indexOf('7,0') !== -1 && targets.indexOf('7,2') !== -1, '马可走 (7,0) 与 (7,2)');
  assert(targets.indexOf('8,3') === -1, '象占腿位时马不能走 (8,3)');
}

// ---------- 象：不过河、塞象眼 ----------
console.log('[象：不过河与塞象眼]');
{
  const rows = emptyBoard();
  rows[9][4] = 'K';
  rows[0][3] = 'k'; // 黑将错开列，避免两将照面干扰
  rows[7][2] = 'B'; // 红相
  rows[6][3] = 'P'; // 占象眼
  const targets = legalTargets(rows, 7, 2, E.RED);
  assert(targets.indexOf('5,4') === -1, '象眼被塞不能走 (5,4)');
  assert(targets.indexOf('5,0') !== -1, '象眼畅通可走 (5,0)');
  assert(targets.indexOf('9,4') === -1, '象不能落子在己方将所在格');
  assert(targets.every(function (t) { return parseInt(t.split(',')[0], 10) >= 5; }), '红相不能过河');
}

// ---------- 将/士：不出九宫 ----------
console.log('[将/士：九宫限制]');
{
  const rows = emptyBoard();
  rows[9][4] = 'K';
  rows[8][4] = 'A';
  rows[0][3] = 'k'; // 黑将错开列，避免两将照面干扰
  const kingTargets = legalTargets(rows, 9, 4, E.RED);
  assert(kingTargets.length === 1 && kingTargets[0] === '9,5',
    '被士挡且 (9,3) 与黑将照面时将只剩 1 步（实际 ' + kingTargets.join(' ') + '）');
  assert(kingTargets.every(function (t) {
    const c = parseInt(t.split(',')[1], 10);
    return c >= 3 && c <= 5;
  }), '将不出九宫（列 3-5）');
  const advisorTargets = legalTargets(rows, 8, 4, E.RED);
  assert(advisorTargets.length === 4, '居中士有 4 步（实际 ' + advisorTargets.length + '）');
}

// ---------- 飞将规则 ----------
console.log('[飞将：将帅不能照面]');
{
  const rows = emptyBoard();
  rows[9][4] = 'K';
  rows[0][4] = 'k';
  rows[4][4] = 'R'; // 红车挡在两将之间
  const rookTargets = legalTargets(rows, 4, 4, E.RED);
  assert(rookTargets.every(function (t) { return t.split(',')[1] === '4'; }),
    '挡住将帅照面的车只能沿纵线走（横向离开即送将）');
  // 飞将直取：中路无子时红帅可直取黑将
  const rows2 = emptyBoard();
  rows2[9][4] = 'K';
  rows2[0][4] = 'k';
  const kingTargets = legalTargets(rows2, 9, 4, E.RED);
  assert(kingTargets.indexOf('0,4') !== -1, '两将照面时帅可飞将直取');
}

// ---------- 兵：过河前后 ----------
console.log('[兵：过河前后走法]');
{
  const rows = emptyBoard();
  rows[9][4] = 'K';
  rows[0][4] = 'k';
  rows[6][4] = 'P'; // 未过河
  rows[4][4] = 'P'; // 已过河
  const before = legalTargets(rows, 6, 4, E.RED);
  const after = legalTargets(rows, 4, 4, E.RED);
  assert(before.length === 1 && before[0] === '5,4', '未过河兵只能向前');
  assert(after.length === 3, '过河兵可向前及左右（实际 ' + after.length + '）');
  assert(after.indexOf('5,4') === -1, '兵不能后退');
}

// ---------- 将军与应将 ----------
console.log('[将军：不能送将]');
{
  const rows = emptyBoard();
  rows[9][4] = 'K';
  rows[0][3] = 'k';
  rows[0][4] = 'r'; // 黑车沉底叫将
  assert(E.isInCheck(rows, E.RED), '黑车沿纵线将军');
  const kingTargets = legalTargets(rows, 9, 4, E.RED);
  assert(kingTargets.length === 1 && kingTargets[0] === '9,5',
    '被将军时 (8,4) 入车口、(9,3) 与黑将照面均非法，只能走 (9,5)（实际 ' + kingTargets.join(' ') + '）');
}

// ---------- 绝杀判定 ----------
console.log('[绝杀]');
{
  const rows = emptyBoard();
  rows[0][4] = 'k';
  rows[0][8] = 'R'; // 车控底线
  rows[1][0] = 'R'; // 车控二线
  rows[9][3] = 'K';
  const state = E.getGameState(rows, E.BLACK);
  assert(state.over && state.winner === E.RED && state.reason === 'checkmate', '双车错绝杀黑将');
}

// ---------- 困毙判定 ----------
console.log('[困毙]');
{
  const rows = emptyBoard();
  rows[0][3] = 'k';
  rows[1][4] = 'R'; // 控制 (0,4) 与第二行
  rows[9][5] = 'K';
  assert(!E.isInCheck(rows, E.BLACK), '黑将当前未被将军');
  const state = E.getGameState(rows, E.BLACK);
  assert(state.over && state.winner === E.RED && state.reason === 'stalemate', '黑方无棋可走判困毙');
}

// ---------- AI 冒烟测试 ----------
console.log('[AI 冒烟测试]');
{
  globalThis.XQEngine = E;
  const AI = require('../js/ai.js');
  const board = E.createInitialBoard();
  const t0 = Date.now();
  const res = AI.findBestMove(board, E.RED, AI.DIFFICULTIES.hard);
  const elapsed = Date.now() - t0;
  assert(!!(res && res.move), 'AI（困难）能给出走法');
  if (res && res.move) {
    console.log('    首步: (' + res.move.fromR + ',' + res.move.fromC + ')->(' +
      res.move.toR + ',' + res.move.toC + ') 评分 ' + res.score +
      ' 深度 ' + res.depth + ' 耗时 ' + elapsed + 'ms');
  }
  const res2 = AI.findBestMove(board, E.RED, AI.DIFFICULTIES.master);
  assert(!!(res2 && res2.move && res2.depth >= 3), 'AI（大师）至少完成 3 层搜索（实际 ' + (res2 && res2.depth) + '）');
}

console.log('');
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项');
process.exit(failed === 0 ? 0 : 1);
