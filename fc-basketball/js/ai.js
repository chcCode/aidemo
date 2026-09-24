/* ai.js : CPU 球员控制器（状态机：进攻 / 防守 / 抢球 / 道具） */
window.NB = window.NB || {};

(function () {
  const C = NB.C, U = NB.U;

  class AI {
    constructor(player, match) {
      this.p = player;
      this.m = match;
      this.decideT = 0;          // 决策间隔
      this.moveX = player.x;     // 当前移动目标
      this.punchCD = 0;          // 出拳冷却
      this.shootCD = 0;          // 投篮冷却
      this.wantJump = false;
      this.wantShoot = false;
      this.wantPass = false;
    }

    /* 输出与人类玩家同构的虚拟手柄 */
    update() {
      const out = {
        left: false, right: false, up: false, down: false,
        shoot: false, jump: false, pass: false,
        jumpP: false, shootP: false, passP: false,
      };
      const p = this.p;
      if (this.punchCD > 0) this.punchCD--;
      if (this.shootCD > 0) this.shootCD--;

      /* 不可控状态 */
      if (['hit', 'down', 'dizzy', 'punch', 'shoot', 'dunk', 'win'].indexOf(p.state) >= 0) return out;

      if (--this.decideT <= 0) {
        this.decideT = 5;
        this._think();
      }

      /* 空中：接近筐就扣 */
      if (!p.onGround && p.hasBall) {
        if (p._findDunkHoop()) { out.shootP = true; return out; }
      }

      /* 执行移动目标 */
      const dx = this.moveX - p.cx;
      if (dx > 3) out.right = true;
      else if (dx < -3) out.left = true;

      if (this.wantJump)  { this.wantJump = false;  out.jumpP = true; }
      if (this.wantShoot) { this.wantShoot = false; out.shootP = true; }
      if (this.wantPass)  { this.wantPass = false;  out.passP = true; }
      return out;
    }

    _think() {
      const p = this.p, m = this.m, ball = m.ball;
      const holder = ball.holder;

      if (p.hasBall) return this._thinkOffense();
      if (p.item) {
        /* 持道具：扔向敌方持球者（或最近敌人） */
        const tgt = (holder && holder.tIdx !== p.tIdx) ? holder : p._nearestOpp();
        if (tgt) {
          const d = U.dist(p.cx, p.y, tgt.cx, tgt.y);
          p.face = tgt.cx > p.cx ? 1 : -1;
          if (d < 100) { this.wantShoot = true; return; }
          this.moveX = tgt.cx;
        }
        return;
      }
      if (holder === p.teammate()) return this._thinkOffBall();
      if (holder && holder.tIdx !== p.tIdx) return this._thinkDefense(holder);
      return this._thinkLooseBall();
    }

    /* 持球进攻 */
    _thinkOffense() {
      const p = this.p;
      const geo = C.HOOP_GEO[p.hoopSide];
      /* 依据跳跃力选择能扣的最高筐 */
      const lv = p.jmp > 9.0 ? C.HOOP.LEVELS[2] : (p.jmp > 8.0 ? C.HOOP.LEVELS[1] : C.HOOP.LEVELS[0]);
      const d = Math.abs(p.cx - geo.rimCX);

      /* 被贴身：概率分球 */
      const def = p._nearestOpp();
      if (def && U.dist(p.cx, p.y, def.cx, def.y) < 18 && U.chance(0.35)) {
        this.wantPass = true;
        return;
      }

      if (d < 26) {
        if (p.onGround) { this.wantJump = true; this.moveX = geo.rimCX; }
      } else if (d < 160 && this.shootCD <= 0 && p.onGround) {
        /* 空位跳投/原地投 */
        const pressure = def && U.dist(p.cx, p.y, def.cx, def.y) < 26;
        if (!pressure || U.chance(0.3)) {
          this.wantShoot = true;
          this.shootCD = 50;
          return;
        }
        this.moveX = geo.rimCX;
      } else {
        this.moveX = geo.rimCX;
      }
    }

    /* 队友持球：拉开空间跑向前场 */
    _thinkOffBall() {
      const p = this.p;
      const attackX = p.hoopSide === 'right' ? C.FIELD_W * 0.72 : C.FIELD_W * 0.28;
      this.moveX = attackX + (p.pIdx === 0 ? -30 : 30) * (p.hoopSide === 'right' ? 1 : -1);
      /* 顺路捡道具 */
      const it = this._nearItem(36);
      if (it) this.moveX = it.x;
    }

    /* 防守 */
    _thinkDefense(holder) {
      const p = this.p, m = this.m;
      const mate = p.teammate();
      const myD = U.dist(p.cx, p.y, holder.cx, holder.y);
      const mateD = U.dist(mate.cx, mate.y, holder.cx, holder.y);

      if (myD <= mateD || mate.state === 'down' || mate.state === 'dizzy') {
        /* 主防：追持球者并出拳 */
        this.moveX = holder.cx;
        if (myD < 16 && this.punchCD <= 0 && p.onGround) {
          p.face = holder.cx > p.cx ? 1 : -1;
          this.wantShoot = true;               // 无球时 shoot = 攻击
          this.punchCD = 32;
        }
        /* 对方起跳尝试盖帽 */
        if (!holder.onGround && myD < 30 && p.onGround && U.chance(0.3)) this.wantJump = true;
      } else {
        /* 协防：守己方篮下 */
        const own = C.HOOP_GEO[p.ownSide];
        this.moveX = own.rimCX + (p.ownSide === 'left' ? 26 : -26);
      }
    }

    /* 抢地板球 */
    _thinkLooseBall() {
      const p = this.p, m = this.m, ball = m.ball;
      const mate = p.teammate();
      const myD = Math.abs(p.cx - ball.x);
      const mateD = Math.abs(mate.cx - ball.x);
      const oppNear = m.players.some(q => q.tIdx !== p.tIdx && Math.abs(q.cx - ball.x) < myD);

      if ((myD <= mateD || mate.state === 'down') && myD < 200) {
        this.moveX = ball.x;
      } else if (!oppNear) {
        this.moveX = ball.x;
      } else {
        /* 回不去就回防 */
        const own = C.HOOP_GEO[p.ownSide];
        this.moveX = own.rimCX + (p.ownSide === 'left' ? 30 : -30);
      }
      /* 顺路捡道具 */
      const it = this._nearItem(30);
      if (it && !oppNear) this.moveX = it.x;
    }

    _nearItem(range) {
      const p = this.p;
      for (const it of this.m.items) {
        if (it.heldBy || it.thrown || it.armed || it.dead) continue;
        if (Math.abs(it.x - p.cx) < range) return it;
      }
      return null;
    }
  }

  NB.AI = AI;
})();
