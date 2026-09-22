/**
 * 中国象棋 UI 控制：棋盘渲染、鼠标交互、对局流程、AI 调度。
 */
(function () {
  'use strict';

  var E = window.XQEngine;
  var AI = window.XQAI;

  var CELL = 60;          // 交叉点间距
  var PAD = 40;           // 棋盘边距
  var WIDTH = PAD * 2 + CELL * 8;
  var HEIGHT = PAD * 2 + CELL * 9;
  var PIECE_SIZE = 52;

  var LABELS = {
    K: '帅', A: '仕', B: '相', N: '马', R: '车', C: '炮', P: '兵',
    k: '将', a: '士', b: '象', n: '马', r: '车', c: '炮', p: '卒'
  };

  // 对局状态
  var board = null;
  var turn = E.RED;
  var humanSide = E.RED;
  var aiSide = E.BLACK;
  var flipped = false;      // 执黑时翻转棋盘显示
  var history = [];
  var selected = null;      // 选中的棋子 {r, c}
  var selectedMoves = [];   // 选中棋子的合法落点
  var lastMove = null;
  var gameOver = false;
  var aiThinking = false;

  // DOM
  var wrap = document.getElementById('board-wrap');
  var piecesLayer = document.getElementById('pieces');
  var markersLayer = document.getElementById('markers');
  var statusEl = document.getElementById('status');
  var aiInfoEl = document.getElementById('ai-info');
  var moveListEl = document.getElementById('move-list');
  var difficultyEl = document.getElementById('difficulty');
  var sideEl = document.getElementById('side');

  /** 棋盘坐标 → 显示坐标（执黑时旋转 180°）。 */
  function toDisplay(c, r) {
    return flipped ? [8 - c, 9 - r] : [c, r];
  }

  /** 显示坐标 → 棋盘坐标。 */
  function toBoard(dc, dr) {
    return flipped ? { c: 8 - dc, r: 9 - dr } : { c: dc, r: dr };
  }

  function line(x1, y1, x2, y2) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="grid"/>';
  }

  /** 兵/炮位的角标花纹。 */
  function starMarks(c, r) {
    var x = PAD + c * CELL, y = PAD + r * CELL, g = 5, l = 12;
    var signs = [];
    if (c > 0) signs.push([-1, -1], [-1, 1]);
    if (c < 8) signs.push([1, -1], [1, 1]);
    var s = '';
    for (var i = 0; i < signs.length; i++) {
      var sx = signs[i][0], sy = signs[i][1];
      var cx = x + sx * g, cy = y + sy * g;
      s += '<path d="M ' + cx + ' ' + (cy + sy * l) + ' L ' + cx + ' ' + cy + ' L ' + (cx + sx * l) + ' ' + cy + '"/>';
    }
    return s;
  }

  /** 绘制棋盘网格（SVG）。 */
  function drawGrid() {
    var svg = document.getElementById('grid');
    svg.setAttribute('width', WIDTH);
    svg.setAttribute('height', HEIGHT);
    var x0 = PAD, y0 = PAD;
    var x1 = PAD + 8 * CELL, y1 = PAD + 9 * CELL;
    var s = '<rect x="' + (x0 - 8) + '" y="' + (y0 - 8) + '" width="' + (x1 - x0 + 16) + '" height="' + (y1 - y0 + 16) + '" class="frame"/>';
    s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" class="border"/>';
    var r, c;
    for (r = 1; r < 9; r++) {
      s += line(x0, y0 + r * CELL, x1, y0 + r * CELL);
    }
    for (c = 1; c < 8; c++) {
      s += line(x0 + c * CELL, y0, x0 + c * CELL, y0 + 4 * CELL);
      s += line(x0 + c * CELL, y0 + 5 * CELL, x0 + c * CELL, y1);
    }
    // 九宫斜线
    s += line(x0 + 3 * CELL, y0, x0 + 5 * CELL, y0 + 2 * CELL);
    s += line(x0 + 5 * CELL, y0, x0 + 3 * CELL, y0 + 2 * CELL);
    s += line(x0 + 3 * CELL, y0 + 7 * CELL, x0 + 5 * CELL, y1);
    s += line(x0 + 5 * CELL, y0 + 7 * CELL, x0 + 3 * CELL, y1);
    // 兵/炮位标记
    var marks = [[1, 2], [7, 2], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
                 [1, 7], [7, 7], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]];
    for (var i = 0; i < marks.length; i++) {
      s += starMarks(marks[i][0], marks[i][1]);
    }
    // 楚河汉界
    s += '<text x="' + (x0 + 2 * CELL) + '" y="' + (y0 + 4.5 * CELL + 12) + '" class="river">楚 河</text>';
    s += '<text x="' + (x0 + 6 * CELL) + '" y="' + (y0 + 4.5 * CELL + 12) + '" class="river">汉 界</text>';
    svg.innerHTML = s;
  }

  /** 渲染棋子与标记层。 */
  function render() {
    piecesLayer.innerHTML = '';
    markersLayer.innerHTML = '';

    for (var r = 0; r < E.ROWS; r++) {
      for (var c = 0; c < E.COLS; c++) {
        var p = board[r][c];
        if (!p) continue;
        var pos = toDisplay(c, r);
        var el = document.createElement('div');
        el.className = 'piece ' + (E.isRed(p) ? 'red' : 'black');
        if (selected && selected.r === r && selected.c === c) {
          el.classList.add('selected');
        }
        el.textContent = LABELS[p];
        el.style.left = (PAD + pos[0] * CELL - PIECE_SIZE / 2) + 'px';
        el.style.top = (PAD + pos[1] * CELL - PIECE_SIZE / 2) + 'px';
        piecesLayer.appendChild(el);
      }
    }

    // 上一步走法高亮
    if (lastMove) {
      addMarker('last-square', lastMove.fromC, lastMove.fromR);
      addMarker('last-square', lastMove.toC, lastMove.toR);
    }
    // 选中棋子的合法落点
    for (var i = 0; i < selectedMoves.length; i++) {
      var m = selectedMoves[i];
      addMarker(m.captured ? 'dot capture' : 'dot', m.toC, m.toR);
    }
    // 将军提示
    if (!gameOver && E.isInCheck(board, turn)) {
      var king = E.findKing(board, turn);
      if (king) addMarker('check-ring', king.c, king.r);
    }

    renderMoveList();
  }

  function addMarker(className, c, r) {
    var pos = toDisplay(c, r);
    var el = document.createElement('div');
    el.className = className;
    el.style.left = (PAD + pos[0] * CELL) + 'px';
    el.style.top = (PAD + pos[1] * CELL) + 'px';
    markersLayer.appendChild(el);
  }

  /** 生成简单棋谱记法，如 "红 车 (1,10)→(1,8) 吃马"。 */
  function moveNotation(m) {
    var side = E.isRed(m.piece) ? '红' : '黑';
    var text = side + ' ' + LABELS[m.piece] +
      ' (' + (m.fromC + 1) + ',' + (10 - m.fromR) + ')→(' + (m.toC + 1) + ',' + (10 - m.toR) + ')';
    if (m.captured) text += ' 吃' + LABELS[m.captured];
    return text;
  }

  function renderMoveList() {
    moveListEl.innerHTML = '';
    for (var i = 0; i < history.length; i++) {
      var li = document.createElement('li');
      li.textContent = moveNotation(history[i]);
      moveListEl.appendChild(li);
    }
    moveListEl.scrollTop = moveListEl.scrollHeight;
  }

  function updateStatus() {
    if (gameOver) return;
    if (aiThinking) {
      statusEl.textContent = 'AI 思考中…';
      return;
    }
    var text = (turn === E.RED ? '红方' : '黑方') + '行棋';
    if (E.isInCheck(board, turn)) text += '（将军！）';
    statusEl.textContent = text;
  }

  /** 检查对局是否结束，结束时更新状态栏。 */
  function updateGameOver() {
    var state = E.getGameState(board, turn);
    if (!state.over) return false;
    gameOver = true;
    var winnerName = state.winner === E.RED ? '红方' : '黑方';
    statusEl.textContent = winnerName + '胜（' + (state.reason === 'checkmate' ? '绝杀' : '困毙') + '）';
    render();
    return true;
  }

  /** 执行一手棋并推进对局流程。 */
  function applyMove(move) {
    E.makeMove(board, move);
    history.push(move);
    lastMove = move;
    selected = null;
    selectedMoves = [];
    turn = -turn;
    render();
    if (updateGameOver()) return;
    updateStatus();
    if (turn === aiSide) {
      aiThinking = true;
      updateStatus();
      setTimeout(runAI, 80);
    }
  }

  /** AI 行棋。 */
  function runAI() {
    var preset = AI.DIFFICULTIES[difficultyEl.value] || AI.DIFFICULTIES.medium;
    var res = AI.findBestMove(board, aiSide, preset);
    aiThinking = false;
    if (!res || !res.move) {
      updateGameOver();
      return;
    }
    aiInfoEl.textContent = 'AI（' + preset.name + '）：深度 ' + res.depth +
      '，评分 ' + res.score + '，耗时 ' + (res.time / 1000).toFixed(1) + 's';
    applyMove(res.move);
  }

  /** 点击棋盘交叉点。 */
  function handleSquare(r, c) {
    var p = board[r][c];
    if (selected) {
      var mv = null;
      for (var i = 0; i < selectedMoves.length; i++) {
        if (selectedMoves[i].toR === r && selectedMoves[i].toC === c) {
          mv = selectedMoves[i];
          break;
        }
      }
      if (mv) {
        applyMove(mv);
        return;
      }
    }
    if (p && E.colorOf(p) === humanSide) {
      selected = { r: r, c: c };
      selectedMoves = E.generateLegalMoves(board, humanSide).filter(function (m) {
        return m.fromR === r && m.fromC === c;
      });
    } else {
      selected = null;
      selectedMoves = [];
    }
    render();
  }

  /** 新对局。 */
  function newGame() {
    humanSide = sideEl.value === 'black' ? E.BLACK : E.RED;
    aiSide = -humanSide;
    flipped = humanSide === E.BLACK;
    board = E.createInitialBoard();
    turn = E.RED;
    history = [];
    selected = null;
    selectedMoves = [];
    lastMove = null;
    gameOver = false;
    aiThinking = false;
    aiInfoEl.textContent = '';
    render();
    updateStatus();
    if (turn === aiSide) {
      aiThinking = true;
      updateStatus();
      setTimeout(runAI, 300);
    }
  }

  /** 悔棋：撤销最近一轮（AI 一手 + 自己一手）。 */
  function undo() {
    if (aiThinking || history.length === 0) return;
    if (turn === humanSide &&
        E.colorOf(history[history.length - 1].piece) === aiSide) {
      E.undoMove(board, history.pop());
      turn = -turn;
    }
    if (history.length > 0 &&
        E.colorOf(history[history.length - 1].piece) === humanSide) {
      E.undoMove(board, history.pop());
      turn = -turn;
    }
    gameOver = false;
    selected = null;
    selectedMoves = [];
    lastMove = history[history.length - 1] || null;
    render();
    updateStatus();
    if (turn === aiSide) {
      aiThinking = true;
      updateStatus();
      setTimeout(runAI, 300);
    }
  }

  // 事件绑定
  wrap.addEventListener('click', function (e) {
    if (gameOver || aiThinking || turn !== humanSide) return;
    var rect = wrap.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var dc = Math.round((x - PAD) / CELL);
    var dr = Math.round((y - PAD) / CELL);
    if (dc < 0 || dc > 8 || dr < 0 || dr > 9) return;
    if (Math.abs(x - (PAD + dc * CELL)) > CELL / 2 ||
        Math.abs(y - (PAD + dr * CELL)) > CELL / 2) return;
    var sq = toBoard(dc, dr);
    handleSquare(sq.r, sq.c);
  });

  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('undo').addEventListener('click', undo);
  sideEl.addEventListener('change', newGame);

  // 启动
  drawGrid();
  newGame();
})();
