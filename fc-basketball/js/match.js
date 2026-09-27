/* match.js : 比赛流程（跳球 / 进行 / 得分 / 发球 / 加时金球 / 终场）
 * 伪 3D：实体按纵深 y 排序绘制（远先近后），篮架为立体椭圆筐。
 */
window.NB = window.NB || {};

(function () {
  const C = NB.C, U = NB.U, A = NB.Audio, F = NB.Font, PJ = NB.proj;

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
      const P = this.players, M = C.HOOP.MID_Y;
      P[0].x = 150; P[0].y = M - 10;
      P[1].x = 105; P[1].y = M + 12;
      P[2].x = 320; P[2].y = M - 10;
      P[3].x = 365; P[3].y = M + 12;
      for (const p of P) {
        p.z = 0; p.vx = 0; p.vy = 0; p.vz = 0;
        p.face = p.tIdx === 0 ? 1 : -1;
        p.state = 'idle'; p.stateT = 0; p.hasBall = false;
      }
      this.ball.x = C.FIELD_W / 2; this.ball.y = M; this.ball.z = 60;
      this.ball.vx = 0; this.ball.vy = 0; this.ball.vz = 0;
      this.ball.holder = null; this.ball.state = 'free';
    }

    _inbound() {
      const l = this._loserIdx, w = 1 - l, M = C.HOOP.MID_Y;
      const lp0 = this.players[l * 2], lp1 = this.players[l * 2 + 1];
      const wp0 = this.players[w * 2], wp1 = this.players[w * 2 + 1];
      const ownGeo = C.HOOP_GEO[l === 0 ? 'left' : 'right'];
      const dir = l === 0 ? 1 : -1;

      const reset = (p, x, y, face) => {
        p.x = x; p.y = y; p.z = 0;
        p.vx = 0; p.vy = 0; p.vz = 0;
        p.face = face; p.state = 'idle'; p.stateT = 0;
      };
      reset(lp0, ownGeo.rimX + dir * 34, M, dir);
      lp0.hasBall = true; lp0.invuln = 90;
      this.ball.holder = lp0; this.ball.state = 'held'; this.ball.noCatch = 0; this.ball.goalHoop = null;

      reset(lp1, C.FIELD_W / 2 + dir * 40, M - 16, dir);
      reset(wp0, C.FIELD_W / 2 - dir * 46, M + 14, -dir);
      reset(wp1, C.FIELD_W / 2 - dir * 90, M - 14, -dir);

      this.state = 'play'; this.stateT = 0;
    }

    /* ---------------- 特效 ---------------- */
    burst(x, y, z, n, color) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = U.rand(0.5, 2.2);
        this.parts.push(new NB.Particle(x, y, z, Math.cos(a) * v, Math.sin(a) * v * 0.5,
          U.rand(1, 3), U.randInt(14, 30), color, U.randInt(1, 3), 0.08));
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
      this.burst(hoop.geo.rimX, C.HOOP.MID_Y, hoop.z, 8, '#ffffff');
      A.score();
      if (this.ot) this.finish();                  // 加时金球
    }

    dunkScore(player, hoop) {
      player.hasBall = false;
      this.ball.dunkInto(hoop);
      this.burst(hoop.geo.rimX, C.HOOP.MID_Y, hoop.z, 10, '#f88818');
      this.burst(hoop.geo.rimX, C.HOOP.MID_Y, hoop.z - 4, 6, '#f8f828');
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
          if (p.tIdx === winner) { p.state = 'win'; p.stateT = 0; p.vx = 0; p.vy = 0; }
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
            this.items.push(new NB.Item(this, type, U.rand(60, C.FIELD_W - 60), U.rand(16, C.FIELD_D - 16)));
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

      /* 摄像机跟随球（横向卷轴） */
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

      /* 接球（平面接近 + 高度可及） */
      if (b.canCatch() && b.z < C.P_H + 10) {
        const speed = Math.hypot(b.vx, b.vy);
        if (b.state === 'pass' || speed < 7) {
          for (const p of this.players) {
            if (p.hasBall) continue;
            if (['down', 'dizzy', 'hit', 'punch', 'shoot', 'dunk', 'win'].indexOf(p.state) >= 0) continue;
            if (Math.abs(p.x - b.x) < 9 && Math.abs(p.y - b.y) < 8) {
              p.hasBall = true; b.holder = p; b.state = 'held';
              b.vx = 0; b.vy = 0; b.vz = 0;
              break;
            }
          }
        }
      }

      /* 踩人（下落踩到头顶弹起，敌方受伤） */
      for (const a of this.players) {
        if (a.vz >= -1.5 || a.state === 'dunk' || a.state === 'down') continue;
        for (const c of this.players) {
          if (a === c || c.state === 'down' || c.state === 'dizzy') continue;
          const dz = a.z - c.z;
          if (Math.abs(a.x - c.x) < 10 && Math.abs(a.y - c.y) < 7 && dz > 14 && dz < 30) {
            a.vz = a.jmp * 0.8; a.state = 'air'; a.stateT = 0;
            if (c.tIdx !== a.tIdx) c.takeHit(14, U.sign(c.x - a.x), false);
            this.burst(c.x, c.y, c.z + C.P_H, 4, '#ffffff');
            A.bounce();
          }
        }
      }

      /* 捡道具 */
      for (const p of this.players) {
        if (p.hasBall || p.item) continue;
        if (['down', 'dizzy', 'hit', 'punch', 'shoot', 'dunk', 'win'].indexOf(p.state) >= 0) continue;
        for (const it of this.items) {
          if (it.heldBy || it.thrown || it.armed || it.dead || it.z > 4) continue;
          if (Math.abs(p.x - (it.x + it.w / 2)) < 9 && Math.abs(p.y - it.y) < 7) {
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
      ctx.translate(Math.round(shX), Math.round(shY));
      this.stage.draw(ctx, this.cam, this.tick);

      /* 深度排序：按纵深 y 远先近后 */
      const list = [];
      for (const p of this.players) list.push({ y: p.y, d: p });
      for (const it of this.items) list.push({ y: it.y, d: it });
      list.push({ y: this.ball.y, d: this.ball });
      list.push({ y: C.HOOP.MID_Y - 0.5, d: 'hoopL' });
      list.push({ y: C.HOOP.MID_Y - 0.5, d: 'hoopR' });
      list.sort((a, b) => a.y - b.y);
      for (const e of list) {
        if (e.d === 'hoopL') this._drawHoop(ctx, 'left');
        else if (e.d === 'hoopR') this._drawHoop(ctx, 'right');
        else e.d.draw(ctx, this.cam);
      }
      for (const pt of this.parts) pt.draw(ctx, this.cam);
      ctx.restore();

      this._drawHud(ctx);
    }

    /* 立体篮架：立柱 + 篮板 + 椭圆筐环 + 网 */
    _drawHoop(ctx, sideName) {
      const geo = C.HOOP_GEO[sideName];
      const MID = C.HOOP.MID_Y;
      const s = PJ.scale(MID);
      const baseY = PJ.sy(MID, 0);
      const topZ = C.HOOP.LEVELS[2].z + 16;
      const px = geo.poleX - this.cam;

      /* 底座与立柱 */
      ctx.fillStyle = '#484850';
      ctx.fillRect(px - 5, baseY - 3, 10, 3);
      ctx.fillStyle = '#585860';
      ctx.fillRect(px - 1.5, PJ.sy(MID, topZ), 3, baseY - PJ.sy(MID, topZ));
      ctx.fillStyle = '#787880';
      ctx.fillRect(px - 1.5, PJ.sy(MID, topZ), 1, baseY - PJ.sy(MID, topZ));

      for (const lv of C.HOOP.LEVELS) {
        const rimSY = PJ.sy(MID, lv.z);
        /* 篮板（面向场内的竖板） */
        const bx = (sideName === 'left' ? geo.boardX : geo.boardX - C.HOOP.BOARD_W) - this.cam;
        ctx.fillStyle = '#585860';
        ctx.fillRect(Math.min(px, bx), rimSY - 10, Math.abs(bx - px) + C.HOOP.BOARD_W, 2);  // 连接杆
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(bx, rimSY - 14, C.HOOP.BOARD_W, 15);
        ctx.fillStyle = '#c82838';
        ctx.fillRect(bx, rimSY - 7, C.HOOP.BOARD_W, 4);
        /* 筐环（水平圆环 -> 椭圆） */
        const rx = geo.rimX - this.cam;
        const rr = C.HOOP.RIM_R * s;
        ctx.strokeStyle = '#e85818';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(rx, rimSY, rr, rr * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
        /* 网 */
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(rx + i * rr * 0.6, rimSY + 1);
          ctx.lineTo(rx + i * rr * 0.35, rimSY + 7);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.ellipse(rx, rimSY + 7, rr * 0.4, rr * 0.18, 0, 0, Math.PI);
        ctx.stroke();
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
        if (Math.floor(this.tick / 15) % 2 === 0) F.drawCenter(ctx, 'READY?', C.W / 2, 70, '#ffffff', 2);
      }
      if (this.msgT > 0 && this.msg) {
        F.drawCenter(ctx, this.msg, C.W / 2, 66, '#f8d838', 2);
      }
      if (this.state === 'over' && this.result) {
        const r = this.result;
        ctx.fillStyle = 'rgba(0,0,16,0.75)';
        ctx.fillRect(38, 60, 180, 92);
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(38, 60, 180, 2); ctx.fillRect(38, 150, 180, 2);
        ctx.fillRect(38, 60, 2, 92); ctx.fillRect(216, 60, 2, 92);
        F.drawCenter(ctx, 'GAME SET', C.W / 2, 70, '#f8d838', 2);
        F.drawCenter(ctx, r.teamL.short + ' ' + r.scoreL + ' - ' + r.scoreR + ' ' + r.teamR.short, C.W / 2, 96, '#ffffff', 1);
        if (r.winner >= 0) {
          const wt = r.winner === 0 ? r.teamL : r.teamR;
          F.drawCenter(ctx, 'WINNER ' + wt.name + '!', C.W / 2, 112, '#58f858', 1);
        } else {
          F.drawCenter(ctx, 'DRAW GAME', C.W / 2, 112, '#58f858', 1);
        }
        if (this.stateT > 60 && Math.floor(this.tick / 20) % 2 === 0) {
          F.drawCenter(ctx, 'PUSH START', C.W / 2, 132, '#ffffff', 1);
        }
      }
    }
  }

  NB.Match = Match;
})();
