/* entities.js : 粒子 / 篮球 / 道具 / 球员（伪 3D 三轴物理 + 状态机）
 * 坐标：x 横向 / y 纵深 / z 高度；绘制经 NB.proj 投影并近大远小。
 */
window.NB = window.NB || {};

(function () {
  const C = NB.C, U = NB.U, A = NB.Audio, PJ = NB.proj;

  /* 地面影子（伪 3D 关键元素：z 越高影子越小越淡） */
  function drawShadow(ctx, cam, x, y, z, w) {
    const s = PJ.scale(y);
    const alpha = Math.max(0.06, 0.26 - z / 500);
    const ww = w * s * Math.max(0.5, 1 - z / 260);
    ctx.fillStyle = 'rgba(0,0,0,' + alpha.toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(x - cam, PJ.sy(y, 0), ww, ww * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ==================== 粒子 ==================== */
  class Particle {
    constructor(x, y, z, vx, vy, vz, life, color, size, grav) {
      this.x = x; this.y = y; this.z = z || 0;
      this.vx = vx; this.vy = vy || 0; this.vz = vz || 0;
      this.life = life; this.color = color;
      this.size = size || 2; this.grav = grav === undefined ? 0.08 : grav;
      this.dead = false;
    }
    update() {
      this.x += this.vx; this.y += this.vy; this.z += this.vz;
      this.vz -= this.grav;
      if (this.z < 0) { this.z = 0; this.vz = 0; }
      if (--this.life <= 0) this.dead = true;
    }
    draw(ctx, cam) {
      ctx.fillStyle = this.color;
      const s = this.life < 6 ? 1 : this.size;
      ctx.fillRect(Math.round(this.x - cam - s / 2), Math.round(PJ.sy(this.y, this.z) - s / 2), s, s);
    }
  }

  /* ==================== 篮球 ==================== */
  class Ball {
    constructor(match) {
      this.m = match;
      this.x = C.FIELD_W / 2; this.y = C.HOOP.MID_Y; this.z = 60;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.holder = null;
      this.state = 'free';        // free | held | shot | pass
      this.spin = 0;
      this.noCatch = 0;
      this.goalHoop = null;       // 已进的筐（穿网期间不再碰撞）
      this.lastShooter = null;
      this.frames = NB.Sprites.makeBall();
    }

    /* 三维抛物线：给定目标点与飞行时间反推初速度（重力作用于 z 轴） */
    _arcTo(tx, ty, tz, speed) {
      const dx = tx - this.x, dy = ty - this.y;
      const T = U.clamp((Math.abs(dx) + Math.abs(dy)) / speed + 10, 22, 54);
      this.vx = dx / T;
      this.vy = dy / T;
      this.vz = (tz - this.z + 0.5 * C.GRAVITY * T * T) / T;
    }

    /* 投篮。result: 'score' 空心 | 'rim' 打铁 | 'air' 三不沾 */
    shootAt(hoop, result) {
      let tx = hoop.geo.rimX, ty = C.HOOP.MID_Y, tz = hoop.z - 2;
      if (result === 'rim') {
        tx += U.chance(0.5) ? -C.HOOP.RIM_R : C.HOOP.RIM_R;
        ty += U.rand(-3, 3);
      } else if (result === 'air') {
        tx += U.rand(-26, 26); ty += U.rand(-8, 8); tz += U.rand(-6, 8);
      }
      this._arcTo(tx, ty, tz, 3.2);
      this.state = 'shot';
      this.noCatch = 25;
      this.goalHoop = null;
    }

    passTo(target) {
      const dx = target.x + target.vx * 10 - this.x;
      const dy = target.y + target.vy * 10 - this.y;
      const T = U.clamp((Math.abs(dx) + Math.abs(dy)) / 6, 10, 40);
      this.vx = dx / T;
      this.vy = dy / T;
      this.vz = (target.z + 12 - this.z + 0.5 * C.GRAVITY * T * T) / T;
      this.state = 'pass';
      this.noCatch = 8;
      this.goalHoop = null;
    }

    fumble(dir) {
      this.holder = null;
      this.state = 'free';
      this.vx = dir * U.rand(1.5, 3.5);
      this.vy = U.rand(-2, 2);
      this.vz = 3.5;
      this.noCatch = 10;
    }

    /* 扣篮直接入筐 */
    dunkInto(hoop) {
      this.holder = null;
      this.x = hoop.geo.rimX; this.y = C.HOOP.MID_Y; this.z = hoop.z + 2;
      this.vx = 0; this.vy = 0; this.vz = -2.2;
      this.state = 'free';
      this.goalHoop = hoop;
      this.noCatch = 15;
    }

    update() {
      if (this.noCatch > 0) this.noCatch--;
      if (this.state === 'held') {
        const h = this.holder;
        this.x = h.x + h.face * 2;
        this.y = h.y;
        this.z = h.z + C.P_H + 5;
        return;
      }
      this.vz -= C.GRAVITY;
      this.x += this.vx; this.y += this.vy; this.z += this.vz;
      this.spin += (Math.abs(this.vx) + Math.abs(this.vy)) * 0.15;

      /* 场地边界 */
      if (this.x < 8) { this.x = 8; this.vx = Math.abs(this.vx) * 0.7; }
      if (this.x > C.FIELD_W - 8) { this.x = C.FIELD_W - 8; this.vx = -Math.abs(this.vx) * 0.7; }
      if (this.y < 4) { this.y = 4; this.vy = Math.abs(this.vy) * 0.7; }
      if (this.y > C.FIELD_D - 4) { this.y = C.FIELD_D - 4; this.vy = -Math.abs(this.vy) * 0.7; }

      /* 落地反弹（小幅弹跳不播音，避免密集音效） */
      if (this.z < 0) {
        this.z = 0;
        if (-this.vz > 1.8) {
          this.vz = -this.vz * 0.55;
          this.vx *= 0.75; this.vy *= 0.75;
          A.bounce();
        } else {
          this.vz = 0;
          this.vx = Math.abs(this.vx) < 0.15 ? 0 : this.vx * 0.92;
          this.vy = Math.abs(this.vy) < 0.15 ? 0 : this.vy * 0.92;
        }
        if (this.state === 'shot') this.state = 'free';
        this.goalHoop = null;
      }

      this._hoops();
    }

    _hoops() {
      const R = C.BALL_R, MID = C.HOOP.MID_Y;
      for (const sideName of ['left', 'right']) {
        const geo = C.HOOP_GEO[sideName];
        for (const lv of C.HOOP.LEVELS) {
          const hoop = { geo, z: lv.z, score: lv.score, side: sideName };
          /* 进球判定：下落穿越筐高且球心在筐口平面范围内 */
          if (this.vz < 0 && this.z - this.vz >= lv.z && this.z < lv.z) {
            const dg = Math.hypot(this.x - geo.rimX, this.y - MID);
            if (dg < C.HOOP.RIM_R - 1) {
              this.m.goal(hoop, null);
              this.goalHoop = hoop;
              this.vz = -1.8;
              this.state = 'free';
              continue;
            }
          }
          if (this.goalHoop === hoop) continue;      // 穿网
          /* 筐沿（水平圆环）：z 接近筐高时做平面圆环碰撞 */
          if (Math.abs(this.z - lv.z) < R + 2.5) {
            const dx = this.x - geo.rimX, dy = this.y - MID;
            const d = Math.hypot(dx, dy);
            const diff = d - C.HOOP.RIM_R;           // 到环的平面偏差
            if (Math.abs(diff) < R + 1.5 && d > 0.01) {
              const nx = dx / d, ny = dy / d;
              const push = (diff > 0 ? R + 1.5 - diff : -(R + 1.5) - diff);
              this.x += nx * push; this.y += ny * push;
              const dot = this.vx * nx + this.vy * ny;
              if ((diff > 0 && dot < 0) || (diff < 0 && dot > 0)) {
                this.vx -= 1.6 * dot * nx; this.vy -= 1.6 * dot * ny;
                this.vx *= 0.7; this.vy *= 0.7; this.vz *= -0.4;
                A.rim();
              }
              if (this.state === 'shot') this.state = 'free';
            }
          }
          /* 篮板（x = boardX 竖板） */
          const bx = sideName === 'left' ? geo.boardX : geo.boardX - C.HOOP.BOARD_W;
          const fromInside = sideName === 'left' ? (this.x - R < bx + C.HOOP.BOARD_W && this.x > geo.poleX)
                                                 : (this.x + R > bx && this.x < geo.poleX);
          if (fromInside && Math.abs(this.y - MID) < 9 && this.z > lv.z - 3 && this.z < lv.z + 13) {
            if (sideName === 'left') { this.x = bx + C.HOOP.BOARD_W + R; this.vx = Math.abs(this.vx) * 0.65; }
            else                     { this.x = bx - R; this.vx = -Math.abs(this.vx) * 0.65; }
            A.rim();
            if (this.state === 'shot') this.state = 'free';
          }
        }
        /* 立柱（平面圆柱） */
        const topZ = C.HOOP.LEVELS[2].z + 16;
        if (this.z < topZ) {
          const dx = this.x - geo.poleX, dy = this.y - MID;
          const d = Math.hypot(dx, dy), min = 3 + R;
          if (d < min && d > 0.01) {
            const nx = dx / d, ny = dy / d;
            this.x = geo.poleX + nx * min; this.y = MID + ny * min;
            const dot = this.vx * nx + this.vy * ny;
            if (dot < 0) { this.vx -= 1.5 * dot * nx; this.vy -= 1.5 * dot * ny; this.vx *= 0.6; this.vy *= 0.6; }
          }
        }
      }
    }

    canCatch() { return this.state !== 'held' && this.state !== 'shot' && this.noCatch <= 0; }

    draw(ctx, cam) {
      drawShadow(ctx, cam, this.x, this.y, this.z, 5);
      const s = PJ.scale(this.y);
      const f = this.frames[Math.abs(Math.floor(this.spin)) % 2];
      const w = 8 * s;
      ctx.drawImage(f, this.x - cam - w / 2, PJ.sy(this.y, this.z) - w / 2, w, w);
    }
  }

  /* ==================== 道具 ==================== */
  class Item {
    constructor(match, type, x, y) {
      this.m = match; this.type = type;
      this.x = x; this.y = y; this.z = 0;
      this.vx = 0; this.vy = 0; this.vz = 0;
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
      this.vx = face * 4.5; this.vy = 0; this.vz = 4.5;
      this.heldBy = null;
    }
    drop() { this.heldBy = null; this.thrown = false; this.vx = 0; this.vy = 0; this.vz = 2; }

    update() {
      if (this.heldBy) {
        this.x = this.heldBy.x - this.w / 2;
        this.y = this.heldBy.y;
        this.z = this.heldBy.z + C.P_H + 4;
        return;
      }
      if (this.armed) {               // 香蕉皮陷阱
        if (--this.life <= 0) this.dead = true;
        for (const p of this.m.players) {
          if (p.state === 'down' || p.state === 'dizzy' || p.z > 4) continue;
          if (Math.abs(p.x - (this.x + this.w / 2)) < 8 && Math.abs(p.y - this.y) < 6) {
            p.takeHit(8, U.chance(0.5) ? 1 : -1, true);
            this.dead = true;
            break;
          }
        }
        return;
      }
      this.thrownT++;
      this.vz -= C.GRAVITY;
      this.x += this.vx; this.y += this.vy; this.z += this.vz;
      this.rot += this.vx * 0.2;

      if (this.x < 6) { this.x = 6; this.vx = Math.abs(this.vx) * 0.6; }
      if (this.x > C.FIELD_W - 6 - this.w) { this.x = C.FIELD_W - 6 - this.w; this.vx = -Math.abs(this.vx) * 0.6; }
      if (this.y < 4) { this.y = 4; this.vy = Math.abs(this.vy) * 0.6; }
      if (this.y > C.FIELD_D - 4) { this.y = C.FIELD_D - 4; this.vy = -Math.abs(this.vy) * 0.6; }

      if (this.z < 0) {
        this.z = 0;
        if (this.type === 'BANANA') { this.armed = true; this.thrown = false; this.vx = 0; this.vy = 0; this.vz = 0; this.life = 480; return; }
        if (-this.vz > 1) { this.vz = -this.vz * 0.45; this.vx *= 0.7; this.vy *= 0.7; }
        else {
          this.vz = 0;
          this.vx *= (this.type === 'TIRE' ? 0.985 : 0.85);
          this.vy *= (this.type === 'TIRE' ? 0.985 : 0.85);
          if (Math.abs(this.vx) < 0.3 && this.type !== 'TIRE') { this.vx = 0; this.vy = 0; }
        }
      }

      /* 投掷 / 滚动命中（平面重叠 + 高度接近） */
      const active = this.thrown || (this.type === 'TIRE' && Math.abs(this.vx) + Math.abs(this.vy) > 0.8);
      if (active) {
        for (const p of this.m.players) {
          if (p === this.thrownBy && this.thrownT < 20) continue;
          if (p.state === 'down') continue;
          if (Math.abs(p.x - (this.x + this.w / 2)) < 9 && Math.abs(p.y - this.y) < 7 &&
              this.z > p.z - 4 && this.z < p.z + C.P_H + 4) {
            this._effect(p);
            if (this.dead) return;
          }
        }
      }

      /* 静止后倒计时消失 */
      if (!this.thrown && this.vx === 0 && this.vy === 0 && this.vz === 0) {
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
      this.m.burst(p.x, p.y, p.z + 10, 6, '#f8f828');
    }

    draw(ctx, cam) {
      if (this.life < 120 && Math.floor(this.life / 6) % 2 === 0 && !this.heldBy) return; // 消失前闪烁
      const s = PJ.scale(this.y);
      drawShadow(ctx, cam, this.x + this.w / 2, this.y, Math.max(0, this.z), this.w * 0.6);
      const img = NB.Sprites.items[this.type];
      const w = this.w * s, h = this.h * s;
      ctx.drawImage(img, this.x + this.w / 2 - cam - w / 2, PJ.sy(this.y, this.z) - h, w, h);
    }
  }

  /* ==================== 球员 ==================== */
  class Player {
    constructor(match, team, tIdx, pIdx, ctrl) {
      this.m = match; this.team = team; this.tIdx = tIdx; this.pIdx = pIdx;
      const d = team.players[pIdx];
      this.name = d.name;
      this.spd = 1.0 + d.sp * 0.22;                 // 移动速度 px/f
      this.jmp = 7.3 + d.jp * 0.42;                 // 跳跃初速（z 轴）
      this.pow = d.pw; this.sht = d.sh;
      this.frames = NB.Sprites.makePlayer(pIdx === 0 ? team.pal : team.pal2);
      this.ctrl = ctrl;                             // 'p1' | 'p2' | 'ai'
      this.ai = ctrl === 'ai' ? new NB.AI(this, match) : null;

      this.x = 0; this.y = C.FIELD_D / 2; this.z = 0;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.face = tIdx === 0 ? 1 : -1;
      this.hp = 100; this.maxHp = 100;
      this.state = 'idle'; this.stateT = 0;
      this.hasBall = false; this.item = null;
      this.binHead = 0;
      this.attackDone = false;
      this.invuln = 0;
      this.animT = 0;
      this.pts = 0;
      this.dunkHoop = null;
      this.dunkFrom = null;
    }

    get onGround() { return this.z <= 0; }
    get hoopSide() { return this.tIdx === 0 ? 'right' : 'left'; }
    get ownSide() { return this.tIdx === 0 ? 'left' : 'right'; }

    /* 手部（球）位置 */
    hand() { return { x: this.x + this.face * 3, y: this.y, z: this.z + C.P_H + 4 }; }

    teammate() { return this.m.players[this.tIdx * 2 + (1 - this.pIdx)]; }
    opponents() { return this.m.players.filter(q => q.tIdx !== this.tIdx); }

    /* 平面 + 高度重叠判定 */
    _nearBody(o, dw, dd, dz) {
      return Math.abs(this.x - o.x) < dw && Math.abs(this.y - o.y) < dd &&
             this.z < o.z + C.P_H && o.z < this.z + C.P_H + (dz || 0);
    }

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

      /* z 轴物理 */
      if (!(this.state === 'dunk' && this.stateT <= 16)) this.vz -= C.GRAVITY;
      this.x += this.vx; this.y += this.vy; this.z += this.vz;

      /* 传送带（站在机关区域内被输送） */
      if (this.onGround) {
        for (const cv of this.m.stage.conveyors) {
          if (this.x > cv.x0 && this.x < cv.x1 && this.y > cv.y0 && this.y < cv.y1) {
            this.x += cv.dir * 0.5;
          }
        }
      }

      /* 落地 */
      if (this.z <= 0) {
        if (!this._wasGround && (this.state === 'air' || this.state === 'kick')) this._toIdle();
        this.z = 0; this.vz = 0;
        if (this.state === 'idle' || this.state === 'run') {
          const f = 1 - this.m.stage.friction;
          this.vx *= f; this.vy *= f;
          if (Math.abs(this.vx) < 0.05) this.vx = 0;
          if (Math.abs(this.vy) < 0.05) this.vy = 0;
        }
      }
      this._wasGround = this.z <= 0;

      /* 边界 */
      this.x = U.clamp(this.x, 6, C.FIELD_W - 6);
      this.y = U.clamp(this.y, 6, C.FIELD_D - 6);

      if (this.state === 'run') this.animT++;
    }

    _toIdle() { this.state = 'idle'; this.stateT = 0; }

    /* ---------------- 地面操作 ---------------- */
    _ground(pad) {
      const slow = this.binHead > 0 ? 0.5 : 1;
      const mx = pad.right ? 1 : (pad.left ? -1 : 0);
      const my = pad.down ? 1 : (pad.up ? -1 : 0);   // up=向远端，down=向近端
      if (mx !== 0) this.face = mx;
      this.vx = mx * this.spd * slow;
      this.vy = my * this.spd * 0.8 * slow;
      this.state = (mx !== 0 || my !== 0) ? 'run' : 'idle';

      if (pad.jumpP) {
        const runBoost = Math.abs(this.vx) > 1.2 ? 1.08 : 1;
        this.vz = this.jmp * runBoost * this.m.stage.jumpMul;
        this.state = 'air'; this.stateT = 0;
        A.jump();
        return;
      }
      if (pad.shootP) {
        if (this.hasBall) { this.state = 'shoot'; this.stateT = 0; this.vx = 0; this.vy = 0; }
        else if (this.item) this._throwItem();
        else { this.state = 'punch'; this.stateT = 0; this.attackDone = false; this.vx = 0; this.vy = 0; }
        return;
      }
      if (pad.passP && this.hasBall) this._pass();
    }

    /* ---------------- 空中操作 ---------------- */
    _air(pad) {
      const mx = pad.right ? 1 : (pad.left ? -1 : 0);
      const my = pad.down ? 1 : (pad.up ? -1 : 0);
      if (mx !== 0) { this.vx = U.clamp(this.vx + mx * 0.14, -this.spd, this.spd); this.face = mx; }
      if (my !== 0) this.vy = U.clamp(this.vy + my * 0.11, -this.spd * 0.8, this.spd * 0.8);

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
      /* 选与出手高度最接近的筐层 */
      const geo = C.HOOP_GEO[this.hoopSide];
      const hz = this.hand().z;
      let best = null, bd = 1e9;
      for (const lv of C.HOOP.LEVELS) {
        const d = Math.abs(lv.z - hz);
        if (d < bd) { bd = d; best = { geo, z: lv.z, score: lv.score, side: this.hoopSide }; }
      }
      return best;
    }

    _releaseShot() {
      if (!this.hasBall) return;
      const hoop = this._aimHoop();
      const h = this.hand();
      const d = Math.hypot(this.x - hoop.geo.rimX, this.y - C.HOOP.MID_Y);
      let q = 0.30 + this.sht * 0.09 - d / 500;
      if (!this.onGround) q += 0.10;
      const def = this._nearestOpp();
      if (def && this._nearBody(def, 20, 14, 20)) q -= 0.18;
      q = U.clamp(q, 0.05, 0.95);
      const r = Math.random();
      const result = r < q ? 'score' : (r < q + (1 - q) * 0.55 ? 'rim' : 'air');
      const b = this.m.ball;
      b.holder = null; this.hasBall = false;
      b.x = h.x; b.y = h.y; b.z = h.z;
      b.lastShooter = this;
      b.shootAt(hoop, result);
      A.shoot();
    }

    _findDunkHoop() {
      const geo = C.HOOP_GEO[this.hoopSide];
      const h = this.hand();
      let best = null;
      for (const lv of C.HOOP.LEVELS) {
        if (Math.hypot(h.x - geo.rimX, h.y - C.HOOP.MID_Y) < 16 &&
            h.z > lv.z - 10 && h.z < lv.z + 14) {
          if (!best || lv.z > best.z) best = { geo, z: lv.z, score: lv.score, side: this.hoopSide };
        }
      }
      return best;
    }

    _startDunk(hoop) {
      this.state = 'dunk'; this.stateT = 0;
      this.dunkHoop = hoop;
      this.dunkFrom = { x: this.x, y: this.y, z: this.z };
      this.vx = 0; this.vy = 0; this.vz = 0;
    }

    _dunk() {
      const hoop = this.dunkHoop;
      const tx = hoop.geo.rimX - this.face * 8;
      const ty = C.HOOP.MID_Y;
      const tz = hoop.z - 22;
      if (this.stateT <= 7) {
        const t = this.stateT / 7;
        this.x = U.lerp(this.dunkFrom.x, tx, t);
        this.y = U.lerp(this.dunkFrom.y, ty, t);
        this.z = U.lerp(this.dunkFrom.z, tz, t);
        /* 撞开路径上的防守者 */
        for (const o of this.opponents()) {
          if (o.state === 'down') continue;
          if (this._nearBody(o, 11, 8, 0)) {
            o.takeHit(8 + this.pow * 2, U.sign(o.x - this.x) || 1, false);
          }
        }
      } else if (this.stateT === 8) {
        this.m.dunkScore(this, hoop);
      } else if (this.stateT <= 16) {
        this.x = tx; this.y = ty; this.z = tz;     // 挂筐
      }
      /* 之后由主物理自由下落，落地转 idle */
    }

    /* ---------------- 攻击 ---------------- */
    _punchHit() {
      if (this.attackDone) return;
      const ax = this.x + this.face * 13;
      for (const o of this.opponents()) {
        if (Math.abs(o.x - ax) < 10 && Math.abs(o.y - this.y) < 8 &&
            Math.abs(o.z - this.z) < 18) {
          o.takeHit(6 + this.pow * 2.5, this.face, false);
          this.attackDone = true;
          break;
        }
      }
    }

    _kickHit() {
      if (this.attackDone) return;
      for (const o of this.opponents()) {
        if (this._nearBody(o, 12, 8, 4)) {
          o.takeHit(4 + this.pow * 2, U.sign(o.x - this.x) || this.face, false);
          this.attackDone = true;
          break;
        }
      }
    }

    /* 受击。dmg 伤害，dir 击退方向，heavy 是否强制倒地 */
    takeHit(dmg, dir, heavy) {
      if (this.invuln > 0 || this.state === 'down' || this.state === 'dizzy') return;
      this.hp -= dmg;
      this.vx = dir * 2.2; this.vy = U.rand(-1, 1); this.vz = 2;
      if (this.hasBall) { this.m.ball.fumble(dir); this.hasBall = false; }
      if (this.item) { this.item.drop(); this.item = null; }
      this.m.burst(this.x, this.y, this.z + 14, 4, '#f8f8f8');
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
      const h = this.hand();
      b.holder = null; this.hasBall = false;
      b.x = h.x; b.y = h.y; b.z = h.z;
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
        const d = Math.hypot(this.x - o.x, this.y - o.y);
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

    draw(ctx, cam) {
      const s = PJ.scale(this.y);
      const sx = this.x - cam;
      const syFoot = PJ.sy(this.y, this.z);          // 脚底屏幕 y
      drawShadow(ctx, cam, this.x, this.y, this.z, 9);

      /* 精灵（28x28 帧，近大远小缩放，朝左翻转） */
      const w = 28 * s, h = 28 * s;
      const f = this.frames[this.frameName()];
      ctx.save();
      ctx.translate(sx, syFoot - 27 * s);
      if (this.face < 0) ctx.scale(-1, 1);
      ctx.drawImage(f, -14 * s, 0, w, h);
      ctx.restore();

      const headY = syFoot - 27 * s;
      /* 垃圾桶套头 */
      if (this.binHead > 0) {
        const bin = NB.Sprites.items.BIN;
        ctx.drawImage(bin, sx - 5 * s, headY - 2 * s, 10 * s, 12 * s);
      }
      /* 眩晕星星 */
      if (this.state === 'dizzy') {
        const t = this.m.tick;
        for (let i = 0; i < 3; i++) {
          const a = t * 0.15 + i * 2.1;
          ctx.fillStyle = '#f8f828';
          ctx.fillRect(Math.round(sx + Math.cos(a) * 8 * s), Math.round(headY + 4 * s + Math.sin(a) * 3), 2, 2);
        }
      }
      /* 体力条 */
      if (this.hp < this.maxHp && this.state !== 'down') {
        const w2 = 12 * s, r = this.hp / this.maxHp;
        ctx.fillStyle = '#101010';
        ctx.fillRect(Math.round(sx - w2 / 2), Math.round(headY - 5), w2, 2);
        ctx.fillStyle = r > 0.5 ? '#38c838' : (r > 0.25 ? '#f8c838' : '#f03838');
        ctx.fillRect(Math.round(sx - w2 / 2), Math.round(headY - 5), Math.ceil(w2 * r), 2);
      }
      /* 持球标记 */
      if (this.hasBall) {
        const t = Math.floor(this.m.tick / 8) % 2;
        ctx.fillStyle = t ? '#ffffff' : '#f8d838';
        const my = Math.round(headY - 10);
        ctx.fillRect(Math.round(sx) - 2, my, 5, 2);
        ctx.fillRect(Math.round(sx) - 1, my + 2, 3, 1);
        ctx.fillRect(Math.round(sx), my + 3, 1, 1);
      }
    }
  }

  NB.Particle = Particle;
  NB.Ball = Ball;
  NB.Item = Item;
  NB.Player = Player;
  NB.drawShadow = drawShadow;
})();
