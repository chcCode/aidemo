/* 三国象棋规则引擎回归测试（Node 直接运行）
 * 运行：node sanguo_xiangqi/test_engine.js
 * 重点覆盖炮：未过架走空格、炮架不可落、架后空格不可落、隔架吃子、
 * 中路跨河分叉互不串线、严格模式只放行兵卒勇。
 */
var E = require('../sanguo-mini/utils/engine.js');
var BD = E.BD;
var fails = 0;

function ok(cond, msg) {
  if (!cond) { fails++; console.log('FAIL  ' + msg); }
  else console.log('PASS  ' + msg);
}
function empty() {
  return { board: {}, turn: 'A', alive: { A: true, B: true, C: true },
           frozen: { A: false, B: false, C: false },
           moveNo: 1, winner: null, lastMove: null };
}
function put(s, p, side, t) { s.board[p] = { s: side, t: t, promoted: false }; }
function tos(ms) { return ms.map(function (m) { return m.to; }); }
function caps(ms) { return ms.filter(function (m) { return m.capture; })
                             .map(function (m) { return m.to; }); }
function has(list, p) { return list.indexOf(p) >= 0; }

console.log('--- 1. 炮：未过架走空格 / 架后吃子 ---');
var s1 = empty();
put(s1, 'A42', 'A', '炮');
put(s1, 'A22', 'A', '兵');   // 向左第二格：炮架
put(s1, 'A02', 'B', '卒');   // 架后敌子
var t1 = tos(E.movesFor(s1, 'A42'));
ok(has(t1, 'A32'), '未过炮架可走空格 A32');
ok(!has(t1, 'A22'), '炮架本身不可落子 A22');
ok(!has(t1, 'A12'), '过炮架后空格不可落子 A12');
ok(has(t1, 'A02'), '隔一子可吃敌卒 A02');
ok(has(t1, 'A82'), '另一侧无架方向可走到 A82');

console.log('--- 2. 炮：架后遇己方子即停 ---');
var s2 = empty();
put(s2, 'A42', 'A', '炮');
put(s2, 'A32', 'A', '兵');   // 炮架
put(s2, 'A22', 'A', '车');   // 架后第一个子是己方
put(s2, 'A12', 'B', '卒');   // 更远的敌子，不能再穿透吃
var t2 = tos(E.movesFor(s2, 'A42'));
ok(!has(t2, 'A22'), '架后己方子不可吃 A22');
ok(!has(t2, 'A12'), '架后不能穿透到更远敌子 A12');
ok(has(t2, 'A52'), '其它方向仍可正常走 A52');

console.log('--- 3. 炮：无架不吃紧邻敌子 ---');
var s3 = empty();
put(s3, 'A42', 'A', '炮');
put(s3, 'A22', 'B', '卒');
var t3 = tos(E.movesFor(s3, 'A42'));
ok(has(t3, 'A32'), '紧邻空格可走 A32');
ok(!has(t3, 'A22'), '没有炮架时不能吃紧邻敌子 A22');

console.log('--- 4. 炮：中路跨河分叉两条射线各自独立 ---');
var s4 = empty();
put(s4, 'A44', 'A', '炮');
put(s4, 'B44', 'B', '卒'); put(s4, 'B43', 'B', '车');   // 分支一：架 + 目标
put(s4, 'C44', 'C', '勇'); put(s4, 'C43', 'C', '马');   // 分支二：架 + 目标
var c4 = caps(E.movesFor(s4, 'A44'));
ok(has(c4, 'B43'), '分支一可隔架吃 B43');
ok(has(c4, 'C43'), '分支二可隔架吃 C43（旧实现会串线漏掉）');
ok(!has(c4, 'B44') && !has(c4, 'C44'), '两条分支上的炮架均不可落子');

console.log('--- 5. 开局炮：不能只有吃子着法 ---');
var g = E.createGame();
var m12 = E.movesFor(g, 'A12');
var quiet = m12.filter(function (m) { return !m.capture; }).length;
ok(quiet >= 4, '开局炮有多个普通移动着法（旧实现为 0）');
ok(m12.some(function (m) { return m.to === 'B70' && m.capture === '马'; }),
   '隔河以敌炮为架仍可打马 B70');
console.log('      开局 A12 炮着法数 =', m12.length, '（普通', quiet, '）');
var allB = E.allMoves(g, 'B');
console.log('      开局 B 方总着法数 =', allB.length);
ok(allB.length >= 22, '其它棋子未因修复而丢失着法');

console.log('--- 6. 严格模式：虚线只给兵卒勇 ---');
BD.rules.dashed_for_pawns_only = true;
var gs = E.createGame();
ok(!E.movesFor(gs, 'A12').some(function (m) { return m.to.charAt(0) !== 'A'; }),
   '严格模式下炮不能跨虚线过河');
var sc = empty(); put(sc, 'A04', 'A', '车');
ok(!E.movesFor(sc, 'A04').some(function (m) { return m.to.charAt(0) !== 'A'; }),
   '严格模式下车不能跨虚线过河');
var sp = empty(); put(sp, 'A04', 'A', '兵');
ok(E.movesFor(sp, 'A04').some(function (m) { return m.to.charAt(0) !== 'A'; }),
   '严格模式下兵卒勇仍可跨虚线过河');
BD.rules.dashed_for_pawns_only = false;

console.log('--- 7. AI 自对弈稳定性 ---');
var st = E.createGame(), plies = 0, err = null;
try {
  for (var i = 0; i < 90 && !st.winner; i++) {
    var m = E.chooseMove(st, st.turn, 1);
    if (!m) break;
    st = E.applyMove(st, m);
    plies++;
  }
} catch (e) { err = e; }
ok(!err && plies >= 20, 'AI 自对弈 ' + plies + ' 手无异常' + (err ? '（' + err.message + '）' : ''));

console.log('\n' + (fails ? 'FAILED: ' + fails + ' 项' : 'ALL PASS'));
process.exit(fails ? 1 : 0);
