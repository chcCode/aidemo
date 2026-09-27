/* entities.js : 粒子 / 篮球 / 道具 / 球员（状态机） */
window.NB = window.NB || {};

(function () {
  const C = NB.C, U = NB.U, A = NB.Audio;

  /* ==================== 粒子 ==================== */
  class Particle {
    constructor(x, y, vx, vy, life, color, size, grav) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.life = life; this.color = color;
      this.size = size || 2; this.grav = grav || 0;
      this.dead = false;
    }
    update() {
      this.x += this.vx; this.y += this.vy; this.vy += this.grav;
      if (--this.life <= 0) this.dead = true;
    }
    draw(ctx) {
      ctx.fillStyle = this.color;
      const s = this.life < 6 ? 1 : this.size;
      ctx.fillRect(Math.round(this.x - s / 2), Math.round(this.y - s / 2), s, s);
    }
  }

  /* ==================== 篮球 ==================== */
  class Ball {
    constructor(match) {
      this.m = match;
      this.x = C.FIELD_W / 2; this.y = 80;
      this.vx = 0; this.vy = 0;
      this.holder = null;
      this.state = 'free';        // free | held | shot | pass
      this.spin = 0;
      this.noCatch = 0;           // 出手后短暂不可接
      this.goalHoop = null;       // 已进的筐（穿网期间不再碰撞）
      this.frames = NB.Sprites.makeBall();
    }

    /* 抛物线求解：给定目标点与飞行时间反推初速度 */
    _arcTo(tx, ty, speed) {
      const dx = tx - this.x;
      const T = U.clamp(Math.abs(dx) / speed + 10, 22, 54);
      this.vx = dx / T;
      this.vy = (ty - this.y - 0.5 * C.GRAVITY * T * T) / T;
    }

    /* 投篮。result: 'score' 空心 | 'rim' 打铁 | 'air' 三不沾 */
    shootAt(hoop, result) {
      const g = hoop.geo, y = hoop.y;
      let tx, ty = y - 2;
      if (result === 'score')      { tx = g.rimCX; }
      else if (result === 'rim')   { tx = (U.chance(0.5) ? g.rimX1 : g.rimX2) + U.rand(-1, 1); }
      else                         { tx = g.rimCX + U.rand(-26, 26); ty = y + U.rand(-4, 10); }
      this._arcTo(tx, ty, 3.2);
      this.state = 'shot';
      this.noCatch = 25;
      this.goalHoop = null;
    }

    passTo(target) {
      const dx = (target.x + C.P_W / 2) + target.vx * 10 - this.x;
      const T = U.clamp(Math.abs(dx) / 6, 10, 40);
      this.vx = dx / T;
      this.vy = (target.y + 12 - this.y - 0.5 * C.GRAVITY * T * T) / T;
      this.state = 'pass';
      this.noCatch = 8;
      this.goalHoop = null;
    }

    fumble(dir) {
      this.holder = null;
      this.state = 'free';
      this.vx = dir * U.rand(1.5, 3.5);
      this.vy = -3.5;
      this.noCatch = 10;
    }

    /* 扣篮直接入筐 */
    dunkInto(hoop) {
      this.holder = null;
      this.x = hoop.geo.rimCX; this.y = hoop.y + 2;
      this.vx = 0; this.vy = 2.2;
      this.state = 'free';
      this.goalHoop = hoop;
      this.noCatch = 15;
    }

    update() {
      if (this.noCatch > 0) this.noCatch--;
      if (this.state === 'held') {
        const h = this.holder;
        this.x = h.cx + h.face * 2;
        this.y = h.y - 5;
        return;
      }
      this.vy += C.GRAVITY;
      this.x += this.vx; this.y += this.vy;
      this.spin += this.vx * 0.15;

      /* 场地边界 */
      if (this.x < 8) { this.x = 8; this.vx = Math.abs(this.vx) * 0.7; }
      if (this.x > C.FIELD_W - 8) { this.x = C.FIELD_W - 8; this.vx = -Math.abs(this.vx) * 0.7; }

      /* 地面反弹（小幅弹跳不播音，避免密集音效） */
      const gy = C.GROUND_Y - C.BALL_R;
      if (this.y > gy) {
        this.y = gy;
        if (this.vy > 1.8) { A.bounce(); this.vy *= -0.55; this.vx *= 0.75; }
        else {
          this.vy = 0;
          this.vx = Math.abs(this.vx) < 0.15 ? 0 : this.vx * 0.92;
        }
        if (this.state === 'shot') this.state = 'free';
        this.goalHoop = null;
      }

      /* 篮筐 / 篮板 / 立柱碰撞与进球判定 */
      this._hoops();
    }

    _hoops() {
      const R = C.BALL_R;
      for (const sideName of ['left', 'right']) {
        const geo = C.HOOP_GEO[sideName];
        for (const lv of C.HOOP.LEVELS) {
          const hoop = { geo, y: lv.y, score: lv.score, side: sideName };
          /* 进球判定：下落穿越筐口水平线且球心在筐口内 */
          if (this.vy > 0 && this.y - this.vy < lv.y + 1 && this.y >= lv.y + 1 &&
              this.x > geo.rimX1 + 2 && this.x < geo.rimX2 - 2) {
            this.m.goal(hoop, null);
            this.goalHoop = hoop;
            this.vy = 1.8;
            this.state = 'free';
            continue;
          }
          if (this.goalHoop === hoop) continue;      // 穿网
          /* 筐沿（两个点，半径 2.5 的圆） */
          for (const ex of [geo.rimX1, geo.rimX2]) {
            const dx = this.x - ex, dy = this.y - lv.y;
            const d = Math.hypot(dx, dy), min = R + 2.5;
            if (d < min && d > 0.01) {
              const nx = dx / d, ny = dy / d;
              this.x = ex + nx * min; this.y = lv.y + ny * min;
              const dot = this.vx * nx + this.vy * ny;
              if (dot < 0) {
                this.vx -= 1.6 * dot * nx; this.vy -= 1.6 * dot * ny;
                this.vx *= 0.7; this.vy *= 0.7;
                A.rim();
              }
              if (this.state === 'shot') this.state = 'free';
            }
          }
          /* 篮板（竖板） */
          const bx = sideName === 'left' ? geo.boardX : geo.boardX - C.HOOP.BOARD_W;
          if (U.overlap(this.x - R, this.y - R, R * 2, R * 2, bx, lv.y - 15, C.HOOP.BOARD_W, 16)) {
            if (sideName === 'left') { this.x = bx + C.HOOP.BOARD_W + R; this.vx = Math.abs(this.vx) * 0.65; }
            else                     { this.x = bx - R; this.vx = -Math.abs(this.vx) * 0.65; }
            A.rim();
            if (this.state === 'shot') this.state = 'free';
          }
        }
        /* 立柱 */
        const topY = C.HOOP.LEVELS[2].y - 18;
        if (U.overlap(this.x - R, this.y - R, R * 2, R * 2, geo.poleX - 2, topY, 4, C.GROUND_Y - topY)) {
          if (this.x < geo.poleX) { this.x = geo.poleX - 2 - R; this.vx = -Math.abs(this.vx) * 0.6; }
          else                    { this.x = geo.poleX + 2 + R; this.vx = Math.abs(this.vx) * 0.6; }
        }
      }
    }

    canCatch() { return this.state !== 'held' && this.state !== 'shot' && this.noCatch <= 0; }

    draw(ctx) {
      const f = this.frames[Math.abs(Math.floor(this.spin)) % 2];
      ctx.drawImage(f, Math.round(this.x - 4), Math.round(this.y - 4));
    }
  }

  /* ==================== 道具 ==================== */
  class Item {
    constructor(match, type, x) {
      this.m = match; this.type = type;
      this.x = x; this.y = C.GROUND_Y - 10;
      this.vx = 0; this.vy = 0;
      this.heldBy = null;
      this.thrown = false; this.thrownBy = null; this.thrownT = 0;
      this.armed = false;             // 香蕉皮落地后成为陷阱
      this.life = 600; this.dead = false;
      this.rot = 0;
    }

    get w() { return this.type === 'BIN' ? 10 : (this.type === 'TIRE' ? 10 : 8); }
    get h() { return this.type === 'BIN' ? 12 : (this.type === 'TIRE' ? 10 : 6); }

    throwIt(face) {
      this.thrown = true; this.thrownT = 0;
      this.vx = face * 4.5; this.vy = -4.5;
      this.heldBy = null;
    }
    drop() { this.heldBy = null; this.thrown = false; this.vx = 0; this.vy = -2; }

    update() {
      if (this.heldBy) {
        this.x = this.heldBy.cx - this.w / 2;
        this.y = this.heldBy.y - this.h - 2;
        return;
      }
      if (this.armed) {               // 香蕉皮陷阱
        if (--this.life <= 0) this.dead = true;
        for (const p of this.m.players) {
          if (p.state === 'down' || p.state === 'dizzy') continue;
          if (!p.onGround) continue;
          if (U.overlap(p.x, p.y, C.P_W, C.P_H, this.x, this.y - 2, this.w, this.h + 2)) {
            p.takeHit(8, U.chance(0.5) ? 1 : -1, true);
            this.dead = true;
            break;
          }
        }
        return;
      }
      this.thrownT++;
      this.vy += C.GRAVITY;
      this.x += this.vx; this.y += this.vy;
      this.rot += this.vx * 0.2;

      if (this.x < 6) { this.x = 6; this.vx = Math.abs(this.vx) * 0.6; }
      if (this.x > C.FIELD_W - 6 - this.w) { this.x = C.FIELD_W - 6 - this.w; this.vx = -Math.abs(this.vx) * 0.6; }

      const gy = C.GROUND_Y - this.h;
      if (this.y > gy) {
        this.y = gy;
        if (this.type === 'BANANA') { this.armed = true; this.thrown = false; this.vx = 0; this.vy = 0; this.life = 480; return; }
        if (Math.abs(this.vy) > 1) { this.vy *= -0.45; this.vx *= 0.7; }
        else { this.vy = 0; this.vx *= (this.type === 'TIRE' ? 0.985 : 0.85); }
        if (Math.abs(this.vx) < 0.3 && this.type !== 'TIRE') this.vx = 0;
      }

      /* 投掷 / 滚动命中 */
      const active = this.thrown || (this.type === 'TIRE' && Math.abs(this.vx) > 0.8);
      if (active) {
        for (const p of this.m.players) {
          if (p === this.thrownBy && this.thrownT < 20) continue;
          if (p.state === 'down') continue;
          if (U.overlap(p.x, p.y, C.P_W, C.P_H, this.x, this.y, this.w, this.h)) {
            this._effect(p);
            if (this.dead) return;
          }
        }
      }

      /* 静止后倒计时消失 */
      if (!this.thrown && this.vx === 0 && this.vy === 0) {
        if (--this.life <= 0) this.dead = true;
      }
    }

    _effect(p) {
      const dir = U.sign(this.vx) || 1;
      switch (this.type) {
        case 'STONE':
          p.takeHit(24, dir, true);
          this.dead = true;
          break;
        case 'TIRE':
          p.takeHit(12, dir, false);
          this.vx = -this.vx * 0.5; this.thrown = false;
          break;
        case 'BIN':
          p.binHead = 300;
          p.takeHit(6, dir, false);
          this.dead = true;
          break;
        case 'BANANA':
          p.takeHit(8, dir, true);
          this.dead = true;
          break;
      }
      this.m.burst(p.cx, p.y + 8, 6, '#f8f828');
    }

    draw(ctx) {
      if (this.life < 120 && Math.floor(this.life / 6) % 2 === 0 && !this.heldBy) return; // 消失前闪烁
      const img = NB.Sprites.items[this.type];
      ctx.drawImage(img, Math.round(this.x), Math.round(this.y));
    }
  }

  /* ==================== 球员 ==================== */
  class Player {
    constructor(match, team, tIdx, pIdx, ctrl) {
      this.m = match; this.team = team; this.tIdx = tIdx; this.pIdx = pIdx;
      const d = team.players[pIdx];
      this.name = d.name;
      this.spd = 1.0 + d.sp * 0.22;                 // 移动速度 px/f
      this.jmp = 7.3 + d.jp * 0.42;                 // 跳跃初速
      this.pow = d.pw; this.sht = d.sh;
      this.frames = NB.Sprites.makePlayer(pIdx === 0 ? team.pal : team.pal2);
      this.ctrl = ctrl;                             // 'p1' | 'p2' | 'ai'
      this.ai = ctrl === 'ai' ? new NB.AI(this, match) : null;

      this.x = 0; this.y = C.GROUND_Y - C.P_H;
      this.vx = 0; this.vy = 0;
      this.face = tIdx === 0 ? 1 : -1;
      this.onGround = true;
      this.hp = 100; this.maxHp = 100;
      this.state = 'idle'; this.stateT = 0;
      this.hasBall = false; this.item = null;
      this.binHead = 0;                             // 垃圾桶套头剩余帧
      this.attackDone = false;
      this.invuln = 0;                              // 发球保护
      this.animT = 0;
      this.pts = 0;                                 // 个人得分
      this.dunkHoop = null;
      this.dunkFrom = null;
    }

    get cx() { return this.x + C.P_W / 2; }
    get handX() { return this.cx + this.face * 3; }
    get handY() { return this.y - 4; }
    get hoopSide() { return this.tIdx === 0 ? 'right' : 'left'; }   // 进攻方向
    get ownSide() { return this.tIdx === 0 ? 'left' : 'right'; }

    teammate() { return this.m.players[this.tIdx * 2 + (1 - this.pIdx)]; }
    opponents() { return this.m.players.filter(q => q.tIdx !== this.tIdx); }

    /* ---------------- 主更新 ---------------- */
    update(pad) {
      this.stateT++;
      if (this.binHead > 0) this.binHead--;
      if (this.invuln > 0) this.invuln--;
      this.hp = Math.min(this.maxHp, this.hp + 0.04);

      switch (this.state) {
        case 'idle': case 'run': this._ground(pad); break;
        case 'air':   this._air(pad); break;
        case 'shoot':
          if (this.stateT === 14) this._releaseShot();
          if (this.stateT > 22) this._toIdle();
          break;
        case 'dunk':  this._dunk(); break;
        case 'punch':
          if (this.stateT >= 5 && this.stateT <= 8) this._punchHit();
          if (this.stateT > 12) this._toIdle();
          break;
        case 'kick':
          this._kickHit();
          break;
        case 'hit':
          if (this.stateT > 16) this._toIdle();
          break;
        case 'down':
          if (this.stateT > 85) { this.hp = this.maxHp * 0.7; this.state = 'dizzy'; this.stateT = 0; }
          break;
        case 'dizzy':
          if (this.stateT > 28) this._toIdle();
          break;
        case 'win': break;
      }

      /* 物理 */
      if (!(this.state === 'dunk' && this.stateT <= 16)) this.vy += C.GRAVITY;
      this.x += this.vx; this.y += this.vy;

      /* 传送带 */
      if (this.onGround) {
        for (const cv of this.m.stage.conveyors) {
          if (this.cx > cv.x0 && this.cx < cv.x1) this.x += cv.dir * 0.5;
        }
      }

      /* 地面 */
      const gy = C.GROUND_Y - C.P_H;
      if (this.y >= gy) {
        this.y = gy; this.vy = 0;
        if (!this.onGround) {
          this.onGround = true;
          if (this.state === 'air' || this.state === 'kick') this._toIdle();
        }
        /* 地面摩擦（场地摩擦系数） */
        if (this.state === 'idle' || this.state === 'run') {
          this.vx *= (1 - this.m.stage.friction);
          if (Math.abs(this.vx) < 0.05) this.vx = 0;
        }
      } else {
        this.onGround = false;
      }

      /* 边界 */
      this.x = U.clamp(this.x, 4, C.FIELD_W - 4 - C.P_W);

      if (this.state === 'run') this.animT++;
    }

    _toIdle() { this.state = 'idle'; this.stateT = 0; }

    /* ---------------- 地面操作 ---------------- */
    _ground(pad) {
      const slow = this.binHead > 0 ? 0.5 : 1;
      const move = pad.right ? 1 : (pad.left ? -1 : 0);
      if (move !== 0) {
        this.vx = move * this.spd * slow;
        this.face = move;
        this.state = 'run';
      } else {
        this.state = 'idle';
      }

      if (pad.jumpP) {
        const runBoost = Math.abs(this.vx) > 1.2 ? 1.08 : 1;
        this.vy = -this.jmp * runBoost * this.m.stage.jumpMul;
        this.onGround = false;
        this.state = 'air'; this.stateT = 0;
        A.jump();
        return;
      }
      if (pad.shootP) {
        if (this.hasBall) { this.state = 'shoot'; this.stateT = 0; this.vx = 0; }
        else if (this.item) this._throwItem();
        else { this.state = 'punch'; this.stateT = 0; this.attackDone = false; this.vx = 0; }
        return;
      }
      if (pad.passP && this.hasBall) this._pass();
    }

    /* ---------------- 空中操作 ---------------- */
    _air(pad) {
      const move = pad.right ? 1 : (pad.left ? -1 : 0);
      if (move !== 0) {
        this.vx = U.clamp(this.vx + move * 0.14, -this.spd, this.spd);
        this.face = move;
      }
      if (pad.shootP) {
        if (this.hasBall) {
          const hoop = this._findDunkHoop();
          if (hoop) this._startDunk(hoop);
          else this._releaseShot();
        } else if (this.item) this._throwItem();
        else { this.state = 'kick'; this.stateT = 0; this.attackDone = false; }
        return;
      }
      if (pad.passP && this.hasBall) this._pass();
    }

    /* ---------------- 投篮 / 扣篮 ---------------- */
    _aimHoop() {
      /* 选与出手点高度最接近的筐 */
      const geo = C.HOOP_GEO[this.hoopSide];
      let best = null, bd = 1e9;
      for (const lv of C.HOOP.LEVELS) {
        const d = Math.abs(lv.y - this.handY);
        if (d < bd) { bd = d; best = { geo, y: lv.y, score: lv.score, side: this.hoopSide }; }
      }
      return best;
    }

    _releaseShot() {
      if (!this.hasBall) return;
      const hoop = this._aimHoop();
      const d = Math.abs(this.cx - hoop.geo.rimCX);
      let q = 0.30 + this.sht * 0.09 - d / 500;
      if (!this.onGround) q += 0.10;
      const def = this._nearestOpp();
      if (def && U.dist(this.cx, this.y, def.cx, def.y) < 24) q -= 0.18;
      q = U.clamp(q, 0.05, 0.95);
      const r = Math.random();
      const result = r < q ? 'score' : (r < q + (1 - q) * 0.55 ? 'rim' : 'air');
      const b = this.m.ball;
      b.holder = null; this.hasBall = false;
      b.x = this.handX; b.y = this.handY;
      b.lastShooter = this;
      b.shootAt(hoop, result);
      A.shoot();
    }

    _findDunkHoop() {
      const geo = C.HOOP_GEO[this.hoopSide];
      let best = null;
      for (const lv of C.HOOP.LEVELS) {
        if (Math.abs(this.handX - geo.rimCX) < 16 &&
            this.handY < lv.y + 10 && this.handY > lv.y - 26) {
          if (!best || lv.y < best.y) best = { geo, y: lv.y, score: lv.score, side: this.hoopSide };
        }
      }
      return best;
    }

    _startDunk(hoop) {
      this.state = 'dunk'; this.stateT = 0;
      this.dunkHoop = hoop;
      this.dunkFrom = { x: this.x, y: this.y };
      this.vx = 0; this.vy = 0;
    }

    _dunk() {
      const hoop = this.dunkHoop;
      const tx = hoop.geo.rimCX - C.P_W / 2 - this.face * 2;
      const ty = hoop.y - 22;
      if (this.stateT <= 7) {
        const t = this.stateT / 7;
        this.x = U.lerp(this.dunkFrom.x, tx, t);
        this.y = U.lerp(this.dunkFrom.y, ty, t);
        /* 撞开路径上的防守者 */
        for (const o of this.opponents()) {
          if (o.state === 'down') continue;
          if (U.overlap(this.x, this.y, C.P_W, C.P_H, o.x, o.y, C.P_W, C.P_H)) {
            o.takeHit(8 + this.pow * 2, U.sign(o.cx - this.cx) || 1, false);
          }
        }
      } else if (this.stateT === 8) {
        this.m.dunkScore(this, hoop);
      } else if (this.stateT <= 16) {
        this.x = tx; this.y = ty;                 // 挂筐
      } else {
        this.vy += C.GRAVITY;                     // 下落（由主物理接管）
        if (this.onGround) this._toIdle();
      }
    }

    /* ---------------- 攻击 ---------------- */
    _punchHit() {
      if (this.attackDone) return;
      const ax = this.face > 0 ? this.x + C.P_W : this.x - 14;
      for (const o of this.opponents()) {
        if (U.overlap(ax, this.y + 6, 14, 12, o.x, o.y, C.P_W, C.P_H)) {
          o.takeHit(6 + this.pow * 2.5, this.face, false);
          this.attackDone = true;
          break;
        }
      }
    }

    _kickHit() {
      if (this.attackDone) return;
      for (const o of this.opponents()) {
        if (U.overlap(this.x - 3, this.y, C.P_W + 8, C.P_H, o.x, o.y, C.P_W, C.P_H)) {
          o.takeHit(4 + this.pow * 2, U.sign(o.cx - this.cx) || this.face, false);
          this.attackDone = true;
          break;
        }
      }
    }

    /* 受击。dmg 伤害，dir 击退方向，heavy 是否强制倒地 */
    takeHit(dmg, dir, heavy) {
      if (this.invuln > 0 || this.state === 'down' || this.state === 'dizzy') return;
      this.hp -= dmg;
      this.vx = dir * 2.2; this.vy = -2; this.onGround = false;
      if (this.hasBall) { this.m.ball.fumble(dir); this.hasBall = false; }
      if (this.item) { this.item.drop(); this.item = null; }
      this.m.burst(this.cx, this.y + 6, 4, '#f8f8f8');
      if (this.hp <= 0 || heavy) {
        this.hp = Math.max(0, this.hp);
        this.state = 'down'; this.stateT = 0;
        A.down();
      } else {
        this.state = 'hit'; this.stateT = 0;
        A.hit();
      }
    }

    _pass() {
      const b = this.m.ball;
      b.holder = null; this.hasBall = false;
      b.x = this.handX; b.y = this.handY;
      b.passTo(this.teammate());
      A.pass();
    }

    _throwItem() {
      if (!this.item) return;
      this.item.thrownBy = this;
      this.item.throwIt(this.face);
      this.item = null;
      A.throwIt();
    }

    _nearestOpp() {
      let best = null, bd = 1e9;
      for (const o of this.opponents()) {
        const d = U.dist(this.cx, this.y, o.cx, o.y);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }

    /* ---------------- 绘制 ---------------- */
    frameName() {
      switch (this.state) {
        case 'run': {
          const f = Math.floor(this.animT / 6) % 2;
          if (this.item) return 'carryrun' + f;
          return this.hasBall ? 'holdrun' + f : 'run' + f;
        }
        case 'air':   return this.hasBall ? 'holdjump' : 'jump';
        case 'shoot': return 'shoot';
        case 'dunk':  return 'dunk';
        case 'punch': return 'punch';
        case 'kick':  return 'kick';
        case 'hit':   return 'hit';
        case 'down':  return 'down';
        case 'dizzy': return 'dizzy';
        case 'win':   return 'win';
        default:
          if (this.item) return 'carry';
          return this.hasBall ? 'hold' : 'idle';
      }
    }

    draw(ctx) {
      const f = this.frames[this.frameName()];
      const dx = Math.round(this.x + C.P_W / 2 - 14);
      const dy = Math.round(this.y + C.P_H - 28);
      ctx.save();
      if (this.face < 0) {
        ctx.translate(dx + 14, dy); ctx.scale(-1, 1); ctx.translate(-14, 0);
        ctx.drawImage(f, 0, 0);
      } else {
        ctx.drawImage(f, dx, dy);
      }
      ctx.restore();

      /* 垃圾桶套头 */
      if (this.binHead > 0) {
        const bin = NB.Sprites.items.BIN;
        ctx.drawImage(bin, Math.round(this.cx - 5), Math.round(this.y - 4));
      }
      /* 眩晕星星 */
      if (this.state === 'dizzy') {
        const t = this.m.tick;
        for (let i = 0; i < 3; i++) {
          const a = t * 0.15 + i * 2.1;
          ctx.fillStyle = '#f8f828';
          ctx.fillRect(Math.round(this.cx + Math.cos(a) * 8), Math.round(this.y + 2 + Math.sin(a) * 3), 2, 2);
        }
      }
      /* 体力条 */
      if (this.hp < this.maxHp && this.state !== 'down') {
        const w = 12, r = this.hp / this.maxHp;
        ctx.fillStyle = '#101010';
        ctx.fillRect(Math.round(this.x), Math.round(this.y - 5), w, 2);
        ctx.fillStyle = r > 0.5 ? '#38c838' : (r > 0.25 ? '#f8c838' : '#f03838');
        ctx.fillRect(Math.round(this.x), Math.round(this.y - 5), Math.ceil(w * r), 2);
      }
      /* 持球标记 */
      if (this.hasBall) {
        const t = Math.floor(this.m.tick / 8) % 2;
        ctx.fillStyle = t ? '#ffffff' : '#f8d838';
        const mx = Math.round(this.cx), my = Math.round(this.y - 11);
        ctx.fillRect(mx - 2, my, 5, 2);
        ctx.fillRect(mx - 1, my + 2, 3, 1);
        ctx.fillRect(mx, my + 3, 1, 1);
      }
    }
  }

  NB.Particle = Particle;
  NB.Ball = Ball;
  NB.Item = Item;
  NB.Player = Player;
})();
