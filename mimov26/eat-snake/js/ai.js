(function (SB) {
  'use strict';
  const U = SB.U;
  const C = SB.CONFIG;

  function AI(snake, game) {
    this.snake = snake;
    this.game = game;

    const skill = U.rand(0.35, 1);           // 反应与技巧
    this.aggression = U.rand(0.2, 0.95);     // 好斗程度
    this.vision = 320 + skill * 380;         // 找食物视野
    this.thinkDt = 0.34 - skill * 0.22;      // 决策间隔
    this.reaction = 0.12 - skill * 0.08;     // 危险反应延迟
    this.skill = skill;

    this.timer = Math.random() * this.thinkDt;
    this.aim = Math.random() * Math.PI * 2;
    this.escapeT = 0;
    this.boostT = 0;
    this.boostCd = U.rand(0.5, 2.5);
    this.wanderT = 0;
    this.wander = { x: 0, y: 0 };
    this.prey = null;
    this.pp = { x: 0, y: 0, t: 0 };
    this.lastHead = { x: 0, y: 0 };
    this.danger = 0;
    this.huntT = 0;
  }

  AI.prototype.pickWander = function () {
    const s = this.snake;
    const R = 420 + Math.random() * 520;
    const a = Math.random() * Math.PI * 2;
    this.wander.x = U.clamp(s.head.x + Math.cos(a) * R, 80, C.WORLD_W - 80);
    this.wander.y = U.clamp(s.head.y + Math.sin(a) * R, 80, C.WORLD_H - 80);
    this.wanderT = U.rand(2.4, 5);
  };

  // 找出威胁：正前方 / 贴身的敌方身体点与蛇头
  AI.prototype.findDanger = function () {
    const s = this.snake, g = this.game;
    const hx = s.head.x, hy = s.head.y;
    const scanR = 60 + s.radius + (this.escapeT > 0 ? 170 : 110 + this.skill * 90);
    const pts = g.bodyGrid.query(hx, hy, scanR, g._aiBuf);
    let best = null, bestEff = Infinity;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.s === s) continue;
      const d = U.dist(hx, hy, p.x, p.y);
      const eff = d - p.r - s.radius;
      if (eff > 60) continue;
      const ang = Math.abs(U.normAngle(U.angleTo(hx, hy, p.x, p.y) - s.heading));
      if (ang > 2.0 && eff > 24) continue;      // 只关心前方与贴近的
      if (eff < bestEff) { bestEff = eff; best = p; }
    }

    // 蛇头对撞
    const snakes = g.snakes;
    for (let i = 0; i < snakes.length; i++) {
      const o = snakes[i];
      if (o === s || !o.alive) continue;
      const d = U.dist(hx, hy, o.head.x, o.head.y);
      const eff = d - o.radius - s.radius;
      const closing = (o.head.x - hx) * Math.cos(s.heading) + (o.head.y - hy) * Math.sin(s.heading) > 0;
      if (eff < bestEff && (closing || eff < 30)) { bestEff = eff; best = { x: o.head.x, y: o.head.y, r: o.radius }; }
    }
    return best ? { pt: best, eff: bestEff } : null;
  };

  AI.prototype.escapeAngle = function (threat) {
    const s = this.snake;
    const away = U.angleTo(threat.pt.x, threat.pt.y, s.head.x, s.head.y);
    // 两个侧向候选，选前方障碍更少的一侧
    const cand = [away, away + 0.9, away - 0.9];
    let bestA = away, bestScore = -Infinity;
    for (let i = 0; i < cand.length; i++) {
      const a = U.normAngle(cand[i]);
      const px = s.head.x + Math.cos(a) * (s.radius + 90);
      const py = s.head.y + Math.sin(a) * (s.radius + 90);
      if (px < 40 || py < 40 || px > C.WORLD_W - 40 || py > C.WORLD_H - 40) continue;
      const near = this.game.bodyGrid.query(px, py, 70, this.game._aiBuf2);
      let sc = 0;
      for (let j = 0; j < near.length; j++) {
        const q = near[j];
        if (q.s === s) continue;
        const d = U.dist2(px, py, q.x, q.y);
        sc -= 14000 / (d + 400);
      }
      sc -= Math.abs(U.normAngle(a - s.heading)) * 0.4;   // 少转一点弯
      if (sc > bestScore) { bestScore = sc; bestA = a; }
    }
    return bestA;
  };

  AI.prototype.findFood = function () {
    const s = this.snake, g = this.game;
    const list = g.food.query(s.head.x, s.head.y, this.vision);
    let best = null, bd = Infinity;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.dead) continue;
      let d = U.dist2(s.head.x, s.head.y, f.x, f.y);
      d -= f.value * 1400;                       // 大光点优先
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  };

  AI.prototype.findPrey = function () {
    const s = this.snake, g = this.game;
    let best = null, bd = Infinity;
    const scan = 460 + this.aggression * 260;
    for (let i = 0; i < g.snakes.length; i++) {
      const o = g.snakes[i];
      if (o === s || !o.alive) continue;
      if (o.score > s.score * 0.92) continue;    // 只欺负比自己小的
      const d = U.dist(s.head.x, s.head.y, o.head.x, o.head.y);
      if (d > scan) continue;
      // 目标前方要有可围的路径（大致朝向我）
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  };

  AI.prototype.think = function (dt) {
    const s = this.snake, g = this.game;
    this.wanderT -= dt;
    this.huntT -= dt;
    this.boostCd -= dt;

    const danger = this.findDanger();
    this.danger = danger ? danger.eff : 9999;

    let aim = this.aim;

    // 1) 撞墙修正（最高优先）
    const wallM = 200 + s.radius * 2;
    const hx = s.head.x, hy = s.head.y;
    let nearWall = false;
    if (hx < wallM) { aim = 0; nearWall = true; }
    else if (hx > C.WORLD_W - wallM) { aim = Math.PI; nearWall = true; }
    if (hy < wallM) { aim = nearWall ? (hx < C.WORLD_W / 2 ? Math.PI / 4 : -Math.PI / 4) : Math.PI / 2; nearWall = true; }
    else if (hy > C.WORLD_H - wallM) { aim = nearWall ? (hx < C.WORLD_W / 2 ? -Math.PI / 4 : Math.PI * 3 / 4) : -Math.PI / 2; nearWall = true; }
    if (nearWall) {
      this.escapeT = 0;
      this.aim = aim;
      this.tryBoost(danger != null && danger.eff < 90, dt);
      return;
    }

    // 2) 逃跑
    if (danger && danger.eff < 120 + s.radius) {
      if (this.escapeT <= 0) this.escapeT = U.rand(0.35, 0.7);
    }
    if (this.escapeT > 0 && danger) {
      this.escapeT -= dt;
      aim = this.escapeAngle(danger);
      this.aim = aim;
      this.tryBoost(danger.eff < 70 + s.radius, dt);
      return;
    }
    this.escapeT = 0;

    // 3) 追猎
    const now = performance.now() / 1000;
    const huntRoll = Math.random() < this.aggression;
    if (huntRoll && this.huntT <= 0) this.prey = this.findPrey();
    if (this.prey && this.prey.alive) {
      const o = this.prey;
      const d = U.dist(hx, hy, o.head.x, o.head.y);
      if (d < 560) {
        const dtP = Math.max(0.05, now - this.pp.t);
        const pvx = d && this.pp.t ? (o.head.x - this.pp.x) / dtP : 0;
        const pvy = d && this.pp.t ? (o.head.y - this.pp.y) / dtP : 0;
        const lead = U.clamp(d / 340, 0.15, 0.75);
        const tx = o.head.x + U.clamp(pvx, -400, 400) * lead;
        const ty = o.head.y + U.clamp(pvy, -400, 400) * lead;
        aim = U.angleTo(hx, hy, tx, ty);
        this.aim = aim;
        this.tryBoost(d < 300 && s.score > 70 && Math.random() < 0.75, dt);
        this.pp.x = o.head.x; this.pp.y = o.head.y; this.pp.t = now;
        if (Math.random() < dt * 0.7) { this.huntT = U.rand(1.5, 3); this.prey = null; }
        return;
      }
      this.prey = null;
    }
    this.pp.t = 0;

    // 4) 找吃的
    const f = this.findFood();
    if (f) {
      aim = U.angleTo(hx, hy, f.x, f.y);
    } else {
      if (this.wanderT <= 0) this.pickWander();
      aim = U.angleTo(hx, hy, this.wander.x, this.wander.y);
    }

    // 抖动让它更像人
    aim += Math.sin(performance.now() * 0.002 + this.snake.id) * 0.12 * (1 - this.skill * 0.6);
    this.aim = aim;
    this.tryBoost(false, dt);
  };

  AI.prototype.tryBoost = function (want, dt) {
    const s = this.snake;
    if (this.boostCd > 0) { s.boosting = false; return; }
    if (want && s.score > 65 && Math.random() < 0.8) {
      if (this.boostT <= 0) this.boostT = U.rand(0.3, 0.75);
    }
    if (this.boostT > 0) {
      this.boostT -= dt;
      s.boosting = s.canBoost();
      if (this.boostT <= 0) { this.boostCd = U.rand(1.2, 3.5); s.boosting = false; }
    } else {
      s.boosting = false;
    }
  };

  AI.prototype.update = function (dt) {
    const s = this.snake;
    if (!s.alive) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.thinkDt + Math.random() * 0.06;
      this.think(dt);
    }
    this.lastHead.x = s.head.x;
    this.lastHead.y = s.head.y;
    s.targetAngle = this.aim;
  };

  SB.AI = AI;
})(window.SB);
