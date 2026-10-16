(function (SB) {
  'use strict';
  const U = SB.U;
  const C = SB.CONFIG;

  let nextId = 1;

  function Snake(opts) {
    this.id = nextId++;
    this.name = opts.name || ('蛇' + this.id);
    this.skin = opts.skin || SB.SKINS[0];
    this.isPlayer = !!opts.isPlayer;
    this.ai = null;

    this.alive = true;
    this._deadMarked = false;
    this.head = { x: 0, y: 0 };
    this.heading = 0;
    this.targetAngle = 0;
    this.points = [];
    this.pathLen = 0;
    this.acc = 0;

    this.score = C.START_SCORE;
    this.kills = 0;
    this.radius = 12;
    this.targetLen = 100;
    this.boosting = false;
    this.boostCd = 0;
    this._boostDrop = 0;

    this.maxSpeed = C.BASE_SPEED;
    this.bornAt = performance.now();
    this.deathBy = null;
    this._eyeBlink = Math.random() * 4;
    this.blink = 0;
  }

  Snake.prototype.radiusFor = function (score) {
    return 11.5 + Math.min(21, Math.sqrt(Math.max(0, score)) * 0.78);
  };

  Snake.prototype.lenFor = function (score) {
    return Math.min(C.LEN_MAX, C.LEN_BASE + Math.max(0, score) * C.SCORE_TO_LEN);
  };

  Snake.prototype.spawn = function (x, y, angle, score) {
    this.alive = true;
    this._deadMarked = false;
    this.score = score == null ? C.START_SCORE : score;
    this.kills = 0;
    this.deathBy = null;
    this.boosting = false;
    this.heading = this.targetAngle = angle;
    this.head.x = x; this.head.y = y;
    this.points.length = 0;
    this.pathLen = 0;
    this.acc = 0;
    this.radius = this.radiusFor(this.score);
    this.targetLen = this.lenFor(this.score);
    const back = angle + Math.PI;
    for (let i = 1; i <= 8; i++) {
      this.points.push({ x: x + Math.cos(back) * i * C.SEG_STEP, y: y + Math.sin(back) * i * C.SEG_STEP });
    }
    this.pathLen = 8 * C.SEG_STEP;
    this.bornAt = performance.now();
    this._eyeBlink = Math.random() * 4;
  };

  Snake.prototype.addScore = function (n) {
    this.score += n;
    this.radius = this.radiusFor(this.score);
    this.targetLen = this.lenFor(this.score);
  };

  Snake.prototype.canBoost = function () {
    return this.score > C.MIN_BOOST_SCORE;
  };

  Snake.prototype.update = function (dt, game) {
    if (!this.alive) return;

    const sizeF = 1 - Math.min(0.2, this.score / 6000);
    const turn = C.TURN_RATE * (1 - C.TURN_PENALTY * (1 - sizeF));
    this.heading = U.steer(this.heading, this.targetAngle, turn * dt);

    let boosting = this.boosting && this.canBoost();
    if (this.boosting && !this.canBoost()) this.boosting = false;
    this.boostCd = Math.max(0, this.boostCd - dt);

    const speed = this.maxSpeed * sizeF * (boosting ? C.BOOST_MULT : 1);
    const dx = Math.cos(this.heading) * speed * dt;
    const dy = Math.sin(this.heading) * speed * dt;

    const r = this.radius;
    const nx = U.clamp(this.head.x + dx, r, C.WORLD_W - r);
    const ny = U.clamp(this.head.y + dy, r, C.WORLD_H - r);
    const moved = Math.hypot(nx - this.head.x, ny - this.head.y);
    this.head.x = nx; this.head.y = ny;

    // 记录路径点
    this.acc += moved;
    if (this.acc >= C.SEG_STEP) {
      this.acc = 0;
      this.points.unshift({ x: this.head.x, y: this.head.y });
      this.pathLen += C.SEG_STEP;
    } else if (this.points.length) {
      this.points[0].x = this.head.x;
      this.points[0].y = this.head.y;
    }

    // 裁掉过长的尾巴
    while (this.pathLen > this.targetLen && this.points.length > 3) {
      const last = this.points.pop();
      const prev = this.points[this.points.length - 1];
      this.pathLen -= U.dist(last.x, last.y, prev.x, prev.y);
      if (this.pathLen < 0) this.pathLen = 0;
    }

    // 加速消耗
    if (boosting) {
      this.addScore(-C.BOOST_SCORE_PER_SEC * dt);
      this._boostDrop += dt;
      if (this._boostDrop >= C.BOOST_DROP_INTERVAL) {
        this._boostDrop = 0;
        const tail = this.points[this.points.length - 1] || this.head;
        game.dropFood(tail.x + U.rand(-6, 6), tail.y + U.rand(-6, 6), 1, this.skin.a);
        game.particles.trail(tail.x, tail.y, this.heading, this.skin.a);
      }
    } else {
      this._boostDrop = C.BOOST_DROP_INTERVAL;
    }

    // 眨眼
    this._eyeBlink -= dt;
    if (this._eyeBlink <= 0) { this.blink = 0.12; this._eyeBlink = U.rand(2.5, 6); }
    if (this.blink > 0) this.blink -= dt;
  };

  // 路径点（供碰撞 / 渲染使用），点间距 SEG_STEP
  Snake.prototype.eachBodyPoint = function (fn, step) {
    const pts = this.points;
    for (let i = 0; i < pts.length; i += (step || 1)) fn(pts[i], i);
  };

  Snake.prototype.thickness = function () { return this.radius * 2; };

  SB.Snake = Snake;
})(window.SB);
