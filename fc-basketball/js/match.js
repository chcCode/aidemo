/* match.js : 比赛流程（跳球 / 进行 / 得分 / 发球 / 加时金球 / 终场） */
window.NB = window.NB || {};

(function () {
  const C = NB.C, U = NB.U, A = NB.Audio, F = NB.Font;

  class Match {
    /* opt: { mode:'1p'|'2p'|'vs', teamL, teamR, stage } */
    constructor(opt) {
      this.mode = opt.mode;
      this.stage = NB.Stages[opt.stage];
      this.teamL = NB.TEAMS[opt.teamL];
      this.teamR = NB.TEAMS[opt.teamR];

      this.players = [
        new NB.Player(this, this.teamL, 0, 0, 'p1'),
        new NB.Player(this, this.teamL, 0, 1, this.mode === '2p' ? 'p2' : 'ai'),
        new NB.Player(this, this.teamR, 1, 0, this.mode === 'vs' ? 'p2' : 'ai'),
        new NB.Player(this, this.teamR, 1, 1, 'ai'),
      ];
      this.ball = new NB.Ball(this);
      this.items = [];
      this.parts = [];

      this.scoreL = 0; this.scoreR = 0;
      this.time = C.MATCH_TIME * 60;         // 帧
      this.ot = false;
      this.state = 'tipoff'; this.stateT = 0;
      this.tick = 0;
      this.cam = (C.FIELD_W - C.W) / 2;
      this.shake = 0;
      this.itemTimer = U.randInt(C.ITEM_MIN, C.ITEM_MAX);
      this.lastSec = 999;
      this.msg = ''; this.msgT = 0;
      this.result = null;
      this.done = false;
      this._loserIdx = 0;

      this._placeKickoff();
    }

    /* ---------------- 站位 ---------------- */
    _placeKickoff() {
      const P = this.players;
      P[0].x = 150; P[1].x = 105;
      P[2].x = 320; P[3].x = 365;
      for (const p of P) {
        p.y = C.GROUND_Y - C.P_H; p.vx = 0; p.vy = 0;
        p.face = p.tIdx === 0 ? 1 : -1;
        p.state = 'idle'; p.stateT = 0; p.hasBall = false;
      }
      this.ball.x = C.FIELD_W / 2; this.ball.y = 70;
      this.ball.vx = 0; this.ball.vy = 0;
      this.ball.holder = null; this.ball.state = 'free';
    }

    _inbound() {
      const l = this._loserIdx, w = 1 - l;
      const lp0 = this.players[l * 2], lp1 = this.players[l * 2 + 1];
      const wp0 = this.players[w * 2], wp1 = this.players[w * 2 + 1];
      const ownGeo = C.HOOP_GEO[l === 0 ? 'left' : 'right'];
      const dir = l === 0 ? 1 : -1;

      lp0.x = ownGeo.rimCX + dir * 34 - C.P_W / 2;
      lp0.y = C.GROUND_Y - C.P_H;
      lp0.face = dir; lp0.vx = 0; lp0.vy = 0;
      lp0.state = 'idle'; lp0.stateT = 0;
      lp0.hasBall = true; lp0.invuln = 90;
      this.ball.holder = lp0; this.ball.state = 'held'; this.ball.noCatch = 0; this.ball.goalHoop = null;

      lp1.x = C.FIELD_W / 2 + dir * 40; lp1.y = C.GROUND_Y - C.P_H;
      lp1.face = dir; lp1.vx = 0; lp1.vy = 0; lp1.state = 'idle'; lp1.stateT = 0;
      wp0.x = C.FIELD_W / 2 - dir * 46; wp0.y = C.GROUND_Y - C.P_H;
      wp0.face = -dir; wp0.vx = 0; wp0.vy = 0; wp0.state = 'idle'; wp0.stateT = 0;
      wp1.x = C.FIELD_W / 2 - dir * 90; wp1.y = C.GROUND_Y - C.P_H;
      wp1.face = -dir; wp1.vx = 0; wp1.vy = 0; wp1.state = 'idle'; wp1.stateT = 0;

      this.state = 'play'; this.stateT = 0;
    }

    /* ---------------- 特效 ---------------- */
    burst(x, y, n, color) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = U.rand(0.5, 2.2);
        this.parts.push(new NB.Particle(x, y, Math.cos(a) * v, Math.sin(a) * v - 1,
          U.randInt(14, 30), color, U.randInt(1, 3), 0.08));
      }
    }

    /* ---------------- 得分 ---------------- */
    goal(hoop, scorer) {
      if (this.state !== 'play') return;
      const tIdx = hoop.side === 'left' ? 1 : 0;   // 左架是左队防区，右队得分
      if (tIdx === 0) this.scoreL += hoop.score; else this.scoreR += hoop.score;
      if (!scorer) scorer = this.ball.lastShooter;
      if (scorer && scorer.tIdx === tIdx) scorer.pts += hoop.score;
      this._loserIdx = 1 - tIdx;
      this.msg = 'GOAL! +' + hoop.score;
      this.msgT = 80;
      this.state = 'goal'; this.stateT = 0;
      this.burst(hoop.geo.rimCX, hoop.y, 8, '#ffffff');
      A.score();
      if (this.ot) this.finish();                  // 加时金球
    }

    dunkScore(player, hoop) {
      player.hasBall = false;
      this.ball.dunkInto(hoop);
      this.burst(hoop.geo.rimCX, hoop.y, 10, '#f88818');
      this.burst(hoop.geo.rimCX, hoop.y + 4, 6, '#f8f828');
      this.shake = 8;
      A.dunk();
      this.goal(hoop, player);
    }

    finish() {
      this.state = 'over'; this.stateT = 0;
      A.buzzer();
      const winner = this.scoreL > this.scoreR ? 0 : (this.scoreR > this.scoreL ? 1 : -1);
      this.result = {
        scoreL: this.scoreL, scoreR: this.scoreR,
        winner, teamL: this.teamL, teamR: this.teamR,
      };
      if (winner >= 0) {
        for (const p of this.players) {
          if (p.tIdx === winner) { p.state = 'win'; p.stateT = 0; p.vx = 0; }
        }
      }
    }

    /* ---------------- 主更新 ---------------- */
    update() {
      this.tick++;
      this.stateT++;
      if (this.msgT > 0) this.msgT--;

      switch (this.state) {
        case 'tipoff':
          this._updatePlayers();
          if (this.stateT === 40) A.whistle();
          if (this.stateT >= 60) { this.state = 'play'; this.stateT = 0; }
          break;

        case 'play': {
          this._updatePlayers();
          this.ball.update();
          this._updateItems();
          this._collisions();
          /* 计时 */
          this.time--;
          const sec = Math.max(0, Math.ceil(this.time / 60));
          if (sec <= 10 && sec !== this.lastSec) { this.lastSec = sec; A.tick(); }
          if (this.time <= 0) this._timeUp();
          /* 道具刷新 */
          if (--this.itemTimer <= 0 && this.items.filter(i => !i.dead).length < C.MAX_ITEMS) {
            const type = C.ITEM_TYPES[U.randInt(0, C.ITEM_TYPES.length - 1)];
            this.items.push(new NB.Item(this, type, U.rand(60, C.FIELD_W - 60)));
            this.itemTimer = U.randInt(C.ITEM_MIN, C.ITEM_MAX);
          }
          break;
        }

        case 'goal':
          this._updatePlayers();
          this.ball.update();
          this._updateItems();
          if (this.stateT > 90) this._inbound();
          break;

        case 'over':
          this.ball.update();
          if (this.stateT > 260 || (this.stateT > 60 && NB.Input.menuOk())) this.done = true;
          break;
      }

      /* 粒子 */
      for (const pt of this.parts) pt.update();
      this.parts = this.parts.filter(p => !p.dead);

      /* 摄像机跟随球 */
      const target = this.ball.x + (this.ball.holder ? this.ball.holder.face * 24 : 0);
      this.cam = U.clamp(U.lerp(this.cam, target - C.W / 2, 0.08), 0, C.FIELD_W - C.W);
      if (this.shake > 0) this.shake--;

      return this.done ? 'done' : null;
    }

    _updatePlayers() {
      const pads = [NB.Input.pad(0), NB.Input.pad(1)];
      for (const p of this.players) {
        let pad;
        if (p.ctrl === 'p1') pad = pads[0];
        else if (p.ctrl === 'p2') pad = pads[1];
        else pad = p.ai.update();
        p.update(pad);
      }
    }

    _updateItems() {
      for (const it of this.items) it.update();
      this.items = this.items.filter(i => !i.dead);
    }

    _timeUp() {
      if (this.scoreL !== this.scoreR) { this.finish(); return; }
      if (!this.ot) {
        this.ot = true;
        this.time = C.OT_TIME * 60;
        this.msg = 'OVERTIME! GOLDEN GOAL';
        this.msgT = 120;
        A.whistle();
      } else {
        this.finish();                            // 加时仍平 -> DRAW
      }
    }

    /* ---------------- 碰撞（接球 / 踩人 / 捡道具） ---------------- */
    _collisions() {
      const b = this.ball;

      /* 接球 */
      if (b.canCatch()) {
        const speed = Math.hypot(b.vx, b.vy);
        if (b.state === 'pass' || speed < 7) {
          for (const p of this.players) {
            if (p.hasBall) continue;
            if (['down', 'dizzy', 'hit', 'punch', 'shoot', 'dunk', 'win'].indexOf(p.state) >= 0) continue;
            if (U.overlap(p.x - 2, p.y - 6, C.P_W + 4, C.P_H + 6, b.x - 4, b.y - 4, 8, 8)) {
              p.hasBall = true; b.holder = p; b.state = 'held';
              b.vx = 0; b.vy = 0;
              break;
            }
          }
        }
      }

      /* 踩人（下落踩到头顶弹起，敌方受伤） */
      for (const a of this.players) {
        if (a.vy <= 1.5 || a.state === 'dunk' || a.state === 'down') continue;
        for (const c of this.players) {
          if (a === c || c.state === 'down' || c.state === 'dizzy') continue;
          if (U.overlap(a.x, a.y + C.P_H - 4, C.P_W, 6, c.x, c.y - 2, C.P_W, 8)) {
            a.vy = -a.jmp * 0.8; a.onGround = false; a.state = 'air'; a.stateT = 0;
            if (c.tIdx !== a.tIdx) c.takeHit(14, U.sign(c.cx - a.cx), false);
            this.burst(c.cx, c.y, 4, '#ffffff');
            A.bounce();
          }
        }
      }

      /* 捡道具 */
      for (const p of this.players) {
        if (p.hasBall || p.item) continue;
        if (['down', 'dizzy', 'hit', 'punch', 'shoot', 'dunk', 'win'].indexOf(p.state) >= 0) continue;
        for (const it of this.items) {
          if (it.heldBy || it.thrown || it.armed || it.dead || it.vy !== 0) continue;
          if (U.overlap(p.x, p.y, C.P_W, C.P_H, it.x - 2, it.y - 4, it.w + 4, it.h + 4)) {
            it.heldBy = p; p.item = it;
            A.pick();
            break;
          }
        }
      }
    }

    /* ---------------- 绘制 ---------------- */
    draw(ctx) {
      const shX = this.shake > 0 ? U.rand(-2, 2) * this.shake / 6 : 0;
      const shY = this.shake > 0 ? U.rand(-1.5, 1.5) * this.shake / 6 : 0;

      ctx.save();
      ctx.translate(Math.round(-this.cam + shX), Math.round(shY));
      this.stage.draw(ctx, this.cam, this.tick);
      this._drawHoops(ctx);
      for (const it of this.items) it.draw(ctx);
      for (const p of this.players) p.draw(ctx);
      this.ball.draw(ctx);
      for (const pt of this.parts) pt.draw(ctx);
      ctx.restore();

      this._drawHud(ctx);
    }

    _drawHoops(ctx) {
      for (const sideName of ['left', 'right']) {
        const geo = C.HOOP_GEO[sideName];
        const topY = C.HOOP.LEVELS[2].y - 18;
        /* 立柱与底座 */
        ctx.fillStyle = '#585860';
        ctx.fillRect(geo.poleX - 2, topY, 4, C.GROUND_Y - topY);
        ctx.fillStyle = '#787880';
        ctx.fillRect(geo.poleX - 2, topY, 1, C.GROUND_Y - topY);
        ctx.fillStyle = '#484850';
        ctx.fillRect(geo.poleX - 5, C.GROUND_Y - 4, 10, 4);
        for (const lv of C.HOOP.LEVELS) {
          /* 篮板 */
          const bx = sideName === 'left' ? geo.boardX : geo.boardX - C.HOOP.BOARD_W;
          ctx.fillStyle = '#f8f8f8';
          ctx.fillRect(bx, lv.y - 15, C.HOOP.BOARD_W, 16);
          ctx.fillStyle = '#c82838';
          ctx.fillRect(bx, lv.y - 8, C.HOOP.BOARD_W, 5);
          /* 筐环 */
          ctx.fillStyle = '#e85818';
          ctx.fillRect(geo.rimX1, lv.y, C.HOOP.RIM_LEN, 2);
          /* 网 */
          ctx.fillStyle = '#e8e8e8';
          for (let i = 0; i < 3; i++) ctx.fillRect(geo.rimX1 + 1 + i * 5, lv.y + 2, 1, 6);
          ctx.fillRect(geo.rimX1 + 1, lv.y + 4, C.HOOP.RIM_LEN - 2, 1);
          ctx.fillRect(geo.rimX1 + 3, lv.y + 7, C.HOOP.RIM_LEN - 6, 1);
        }
      }
    }

    _drawHud(ctx) {
      /* 顶栏 */
      ctx.fillStyle = '#101018';
      ctx.fillRect(0, 0, C.W, C.HUD_H);
      ctx.fillStyle = '#303048';
      ctx.fillRect(0, C.HUD_H, C.W, 1);

      F.draw(ctx, this.teamL.short, 8, 7, '#f85858');
      F.draw(ctx, String(this.scoreL), 44, 7, '#ffffff');
      F.draw(ctx, String(this.scoreR), C.W - 44 - F.width(String(this.scoreR)), 7, '#ffffff');
      F.draw(ctx, this.teamR.short, C.W - 8 - F.width(this.teamR.short), 7, '#5898f8');

      const sec = Math.max(0, Math.ceil(this.time / 60));
      const ts = Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + sec % 60;
      const tColor = this.ot ? '#f85858' : (sec <= 10 ? '#f8d838' : '#ffffff');
      if (this.ot) F.draw(ctx, 'OT', C.W / 2 - 24, 7, '#f85858');
      F.drawCenter(ctx, ts, C.W / 2 + (this.ot ? 8 : 0), 7, tColor);

      /* 中央提示信息 */
      if (this.state === 'tipoff') {
        if (Math.floor(this.tick / 15) % 2 === 0) F.drawCenter(ctx, 'READY?', C.W / 2, 100, '#ffffff', 2);
      }
      if (this.msgT > 0 && this.msg) {
        F.drawCenter(ctx, this.msg, C.W / 2, 96, '#f8d838', 2);
      }
      if (this.state === 'over' && this.result) {
        const r = this.result;
        ctx.fillStyle = 'rgba(0,0,16,0.75)';
        ctx.fillRect(38, 70, 180, 92);
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(38, 70, 180, 2); ctx.fillRect(38, 160, 180, 2);
        ctx.fillRect(38, 70, 2, 92); ctx.fillRect(216, 70, 2, 92);
        F.drawCenter(ctx, 'GAME SET', C.W / 2, 80, '#f8d838', 2);
        F.drawCenter(ctx, r.teamL.short + ' ' + r.scoreL + ' - ' + r.scoreR + ' ' + r.teamR.short, C.W / 2, 106, '#ffffff', 1);
        if (r.winner >= 0) {
          const wt = r.winner === 0 ? r.teamL : r.teamR;
          F.drawCenter(ctx, 'WINNER ' + wt.name + '!', C.W / 2, 122, '#58f858', 1);
        } else {
          F.drawCenter(ctx, 'DRAW GAME', C.W / 2, 122, '#58f858', 1);
        }
        if (this.stateT > 60 && Math.floor(this.tick / 20) % 2 === 0) {
          F.drawCenter(ctx, 'PUSH START', C.W / 2, 142, '#ffffff', 1);
        }
      }
    }
  }

  NB.Match = Match;
})();
