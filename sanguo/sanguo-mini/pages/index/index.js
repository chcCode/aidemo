/* 三国象棋 · 对局页：1~3 人同屏，空缺席位由端上 AI 补齐 */
var E = require('../../utils/engine.js');
var R = require('../../utils/render.js');
var BD = require('../../utils/board-data.js');

var SHOW_ORDER = ['B', 'A', 'C'];        // 展示顺序：黑魏、红蜀、黄吴
var TURN_ORDER = BD.turn_order;           // 行棋顺序：['B','A','C']
var PICK_SIDES = ['A', 'B', 'C'];        // 玩家1 可选执方
var LEVELS = ['入门', '普通', '进阶'];
var MODES = ['单人 · 双 AI', '双人 · 单 AI', '三人同屏'];

Page({
    data: {
        boardW: 320,
        boardH: 280,
        statusText: '准备开局',
        turnName: '魏',
        thinking: false,
        selected: '',
        targetCount: 0,
        humanCount: 1,
        hasAI: true,
        modeBadge: MODES[0],
        seatsText: '',
        playerSide: 'A',
        playerName: '蜀',
        level: 1,
        levelName: '普通',
        showLinks: true,
        winner: '',
        winnerText: '',
        checkText: '',
        sides: [],
        log: [],
        moveCount: 0,
        handoff: null
    },

    onLoad: function () {
        var info = wx.getSystemInfoSync();
        var w = Math.max(280, info.windowWidth - 24);
        var h = Math.round(w * (R.H + R.PAD * 2) / (R.W + R.PAD * 2));
        this.playerSide = 'A';
        this.humanCount = 1;
        this.level = 1;
        this.showLinks = true;
        this.lastActor = null;
        this.history = [];
        this.logs = [];
        this.selected = '';
        this.game = E.createGame();
        this.rebuildSeats();
        this.setData({ boardW: w, boardH: h });
        this.refreshUI();
    },

    onReady: function () {
        this.initCanvas();
        this.runAI();
    },

    /* 席位分配：玩家1 执自选方，其余真人按行棋顺序顺延，剩下的交给 AI */
    rebuildSeats: function () {
        var n = this.humanCount, first = this.playerSide;
        var seatOf = { A: 0, B: 0, C: 0 };   // 0 = AI，>0 = 玩家编号
        seatOf[first] = 1;
        var start = TURN_ORDER.indexOf(first), used = 1;
        for (var k = 1; k < TURN_ORDER.length && used < n; k++) {
            var s = TURN_ORDER[(start + k) % TURN_ORDER.length];
            seatOf[s] = used + 1;
            used++;
        }
        this.seatOf = seatOf;
        var parts = SHOW_ORDER.map(function (key) {
            return (seatOf[key] ? '玩家' + seatOf[key] : 'AI') + ' ' + BD.sides[key].name;
        });
        this.setData({
            humanCount: n,
            hasAI: n < 3,
            modeBadge: MODES[n - 1],
            seatsText: parts.join('　·　'),
            playerSide: first,
            playerName: BD.sides[first].name
        });
    },

    isHuman: function (side) { return !!(this.seatOf && this.seatOf[side]); },
    seatLabel: function (side) {
        var n = this.seatOf ? this.seatOf[side] : 0;
        return n ? '玩家' + n : 'AI';
    },

    initCanvas: function () {
        var that = this;
        var q = wx.createSelectorQuery();
        q.select('#board').fields({ node: true, size: true }).exec(function (res) {
            if (!res || !res[0] || !res[0].node) return;
            var canvas = res[0].node;
            var ctx = canvas.getContext('2d');
            var dpr = wx.getSystemInfoSync().pixelRatio || 2;
            canvas.width = Math.round(res[0].width * dpr);
            canvas.height = Math.round(res[0].height * dpr);
            ctx.scale(dpr, dpr);
            that.canvas = canvas;
            that.ctx = ctx;
            that.cw = res[0].width;
            that.ch = res[0].height;
            that.draw();
        });
        q.select('#board').boundingClientRect(function (rect) {
            if (rect) { that.rectLeft = rect.left; that.rectTop = rect.top; }
        }).exec();
    },

    draw: function () {
        if (!this.ctx) return;
        var st = this.game;
        var targets = [];
        if (this.selected) {
            var ms = E.movesFor(st, this.selected);
            for (var i = 0; i < ms.length; i++) targets.push(ms[i]);
        }
        R.draw(this.ctx, {
            width: this.cw, height: this.ch, state: st,
            selected: this.selected, targets: targets,
            showLinks: this.showLinks, background: '#0F172A'
        });
    },

    refreshUI: function () {
        var st = this.game, that = this;
        var sides = SHOW_ORDER.map(function (k) {
            return {
                key: k, name: BD.sides[k].name, color: BD.sides[k].color,
                alive: st.alive[k], isPlayer: that.seatOf[k] === 1,
                isTurn: st.turn === k && !st.winner,
                label: BD.sides[k].name + '　' + that.seatLabel(k)
            };
        });
        var turnName = BD.sides[st.turn] ? BD.sides[st.turn].name : '';
        var seat = this.seatOf[st.turn] || 0;
        var status;
        if (st.winner) status = '对局结束';
        else if (seat) status = this.humanCount === 1 ? '轮到你走棋' :
            '轮到 玩家' + seat + '（' + turnName + '）走棋';
        else status = 'AI（' + turnName + '）正在行棋';
        var checkText = (!st.winner && E.inCheck(st, st.turn)) ? turnName + ' 被将' : '';
        this.setData({
            sides: sides, turnName: turnName, statusText: status,
            checkText: checkText, log: this.logs.slice(-7).reverse(),
            moveCount: st.moveNo - 1,
            winner: st.winner || '',
            winnerText: st.winner === 'DRAW' ? '和棋' :
                (st.winner ? BD.sides[st.winner].name + '（' + this.seatLabel(st.winner) + '）一统天下' : ''),
            selected: this.selected || '', targetCount: 0
        });
        this.draw();
    },

    describeMove: function (m, state) {
        var p = state.lastMove;
        var text = BD.sides[p.s].name + '[' + this.seatLabel(p.s) + ']　' + p.t +
                   '　' + m.from + ' → ' + m.to;
        if (m.capture) text += '　吃' + m.capture;
        if (m.promote) text += '　升车';
        return text;
    },

    onBoardTap: function (e) {
        if (!this.ctx || this.data.thinking || this.data.handoff || this.game.winner) return;
        var t = (e.touches && e.touches[0]) ||
                (e.changedTouches && e.changedTouches[0]) || e.detail || {};
        var x = t.x, y = t.y;
        if (typeof x !== 'number' || typeof y !== 'number') {
            x = (t.clientX || t.pageX || 0) - (this.rectLeft || 0);
            y = (t.clientY || t.pageY || 0) - (this.rectTop || 0);
        } else if (x > this.cw * 1.2 || y > this.ch * 1.2) {
            x = (t.clientX || t.pageX || x) - (this.rectLeft || 0);
            y = (t.clientY || t.pageY || y) - (this.rectTop || 0);
        }
        var p = R.hit({ width: this.cw, height: this.ch }, x, y);
        if (!p) return;
        var st = this.game;
        if (!this.isHuman(st.turn)) return;      // AI 席位不接受点击

        var pc = st.board[p];
        if (this.selected) {
            var ms = E.movesFor(st, this.selected);
            for (var i = 0; i < ms.length; i++) {
                if (ms[i].to === p) { this.playMove(ms[i]); return; }
            }
        }
        if (pc && pc.s === st.turn && !st.frozen[st.turn]) {
            this.selected = p;
            var count = E.movesFor(st, p).length;
            this.setData({ selected: p, targetCount: count });
            this.draw();
        } else {
            this.selected = '';
            this.setData({ selected: '', targetCount: 0 });
            this.draw();
        }
    },

    playMove: function (m) {
        this.lastActor = this.game.turn;
        this.history.push({ state: E.cloneState(this.game), logs: this.logs.slice() });
        if (this.history.length > 90) this.history.shift();
        this.game = E.applyMove(this.game, m);
        this.logs.push(this.describeMove(m, this.game));
        this.selected = '';
        this.refreshUI();
        if (this.game.winner) { this.finish(); return; }
        this.runAI();
    },

    /* 连续走完所有 AI 席位，直到轮到真人或对局结束 */
    runAI: function () {
        if (this.game.winner) { this.finish(); return; }
        this.setData({ thinking: true });
        var guard = 0;
        while (!this.game.winner && !this.isHuman(this.game.turn) && guard < 6) {
            var m = E.chooseMove(this.game, this.game.turn, this.level);
            if (!m) break;
            this.history.push({ state: E.cloneState(this.game), logs: this.logs.slice() });
            this.game = E.applyMove(this.game, m);
            this.logs.push(this.describeMove(m, this.game));
            guard++;
        }
        this.setData({ thinking: false });
        this.refreshUI();
        if (this.game.winner) { this.finish(); return; }
        this.maybeHandoff();
    },

    /* 多人同屏：换人时遮挡棋盘，避免上一位玩家误触 */
    maybeHandoff: function () {
        if (this.humanCount < 2 || this.game.winner) return;
        var s = this.game.turn, seat = this.seatOf[s] || 0;
        if (!seat || !this.lastActor || this.lastActor === s) return;
        this.setData({ handoff: {
            seat: seat, name: BD.sides[s].name, color: BD.sides[s].color
        }});
    },

    onHandoffDone: function () { this.setData({ handoff: null }); },

    finish: function () {
        var w = this.game.winner;
        var who = w === 'DRAW' ? '' : '（' + this.seatLabel(w) + '）';
        var txt = w === 'DRAW' ? '和棋，各得一分' :
            BD.sides[w].name + who + ' 一统天下，得三分';
        this.setData({ thinking: false, handoff: null, statusText: '对局结束' });
        wx.showModal({ title: '对局结束', content: txt, showCancel: false });
    },

    onUndo: function () {
        if (!this.history.length) { wx.showToast({ title: '没有可悔的棋', icon: 'none' }); return; }
        var snap = null, guard = 0;
        while (this.history.length && guard < 8) {
            snap = this.history.pop();
            guard++;
            if (this.isHuman(snap.state.turn)) break;   // 退回上一位真人的回合
        }
        if (!snap) return;
        this.game = snap.state;
        this.logs = snap.logs;
        this.selected = '';
        this.lastActor = null;
        this.setData({ handoff: null });
        this.refreshUI();
        wx.showToast({ title: '已悔棋', icon: 'none' });
    },

    onRestart: function () {
        this.game = E.createGame();
        this.history = [];
        this.logs = [];
        this.selected = '';
        this.lastActor = null;
        this.setData({ handoff: null });
        this.refreshUI();
        wx.showToast({ title: '重新开局', icon: 'none' });
        this.runAI();
    },

    onPickSide: function () {
        var that = this;
        wx.showActionSheet({
            itemList: ['玩家1 执 蜀（红，下方）', '玩家1 执 魏（黑，左上）', '玩家1 执 吴（黄，右上）'],
            success: function (res) {
                that.playerSide = PICK_SIDES[res.tapIndex];
                that.rebuildSeats();      // 其余真人按行棋顺序顺延
                that.onRestart();
            },
            fail: function () {}
        });
    },

    onPickPlayers: function () {
        var that = this;
        wx.showActionSheet({
            itemList: ['1 人（另两方由 AI 执）', '2 人（剩一方由 AI 执）', '3 人（全真人，无 AI）'],
            success: function (res) {
                that.humanCount = res.tapIndex + 1;
                that.rebuildSeats();
                that.onRestart();
            },
            fail: function () {}
        });
    },

    onPickLevel: function () {
        var that = this;
        wx.showActionSheet({
            itemList: ['入门（快速、随机）', '普通（两步搜索）', '进阶（三步搜索）'],
            success: function (res) {
                that.level = res.tapIndex;
                that.setData({ level: that.level, levelName: LEVELS[that.level] });
                wx.showToast({ title: 'AI 难度：' + LEVELS[that.level], icon: 'none' });
            },
            fail: function () {}
        });
    },

    onToggleLinks: function () {
        this.showLinks = !this.showLinks;
        this.setData({ showLinks: this.showLinks });
        this.draw();
        wx.showToast({ title: this.showLinks ? '已显示连接线' : '已隐藏连接线', icon: 'none' });
    },

    onRules: function () { wx.navigateTo({ url: '/pages/rules/rules' }); }
});
