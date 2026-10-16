(function (SB) {
  'use strict';
  const U = SB.U;
  const C = SB.CONFIG;

  function Game() {
    this.food = new SB.FoodManager();
    this.particles = new SB.Particles();
    this.snakes = [];
    this.player = null;
    this.bodyGrid = new SB.SpatialGrid(C.BODY_CELL);
    this.cam = { x: C.WORLD_W / 2, y: C.WORLD_H / 2, zoom: 1 };
    this.leader = [];
    this.rank = 1;
    this._aiBuf = [];
    this._aiBuf2 = [];
    this._dead = [];
    this.respawns = [];
    this.leaderT = 0;
    this.foodT = 0;
    this.time = 0;
    this.onPlayerDeath = null;
    this.onFeed = null;
    this.onEat = null;
    this._aiPool = [];
  }

  Game.prototype._newSnake = function (opts) {
    const s = new SB.Snake(opts);
    if (!opts.isPlayer) s.ai = new SB.AI(s, this);
    this.snakes.push(s);
    return s;
  };

  Game.prototype.reset = function (playerName, playerSkin) {
    this.snakes.length = 0;
    this.respawns.length = 0;
    this.particles.clear();
    this.food.spawnInitial();
    this.time = 0;

    // 玩家
    this.player = this._newSnake({
      name: playerName || '我',
      skin: playerSkin || SB.SKINS[0],
      isPlayer: true
    });
    this.player.spawn(
      U.clamp(C.WORLD_W / 2 + U.rand(-300, 300), 200, C.WORLD_W - 200),
      U.clamp(C.WORLD_H / 2 + U.rand(-300, 300), 200, C.WORLD_H - 200),
      Math.random() * Math.PI * 2, C.START_SCORE
    );

    // AI
    const names = SB.AI_NAMES.slice();
    for (let i = 0; i < C.AI_COUNT; i++) {
      const nm = names.length ? names.splice((Math.random() * names.length) | 0, 1)[0] : ('AI-' + i);
      const snake = this._newSnake({ name: nm, skin: U.pick(SB.SKINS) });
      this._spawnSnake(snake, true);
    }

    this.cam.x = this.player.head.x;
    this.cam.y = this.player.head.y;
    this.cam.zoom = 1;
    this.updateLeader();
  };

  Game.prototype._spawnSnake = function (snake, initial) {
    const others = this.snakes.filter(s => s !== snake);
    const spot = U.safeSpot(C.WORLD_W, C.WORLD_H, others, 460);
    const score = initial ? U.rand(C.START_SCORE, C.START_SCORE + 40) : C.START_SCORE;
    snake.spawn(spot.x, spot.y, Math.random() * Math.PI * 2, score);
    if (snake.ai) {
      snake.ai.prey = null;
      snake.ai.escapeT = 0;
      snake.ai.boostT = 0;
      snake.ai.boostCd = U.rand(0.4, 2);
      snake.ai.pickWander();
    }
  };

  Game.prototype.dropFood = function (x, y, value, color) {
    const f = this.food.add(x, y, Math.max(1, Math.round(value)), color);
    f.ph = Math.random() * Math.PI * 2;
    return f;
  };

  Game.prototype.update = function (dt) {
    this.time += dt;

    // —— AI 决策 ——
    for (let i = 0; i < this.snakes.length; i++) {
      const s = this.snakes[i];
      if (s.alive && s.ai) s.ai.update(dt);
    }

    // —— 移动 ——
    for (let i = 0; i < this.snakes.length; i++) {
      const s = this.snakes[i];
      if (s.alive) s.update(dt, this);
    }

    // —— 吃食物 ——
    for (let i = 0; i < this.snakes.length; i++) {
      const s = this.snakes[i];
      if (!s.alive) continue;
      const gain = this.food.eatNear(s.head.x, s.head.y, s.radius);
      if (gain > 0) {
        s.addScore(gain);
        this.particles.eat(s.head.x, s.head.y, s.skin.a);
        if (s.isPlayer) {
          s._popT = (s._popT || 0) - dt;
          if (s._popT <= 0) {
            s._popT = 0.34;
            this.particles.text(
              s.head.x + U.rand(-16, 16),
              s.head.y - s.radius - 6,
              '+' + Math.round(gain),
              '#ffe066'
            );
          }
          if (this.onEat) this.onEat();
        }
      }
    }

    // —— 构建身体网格 ——
    const grid = this.bodyGrid;
    grid.clear();
    for (let i = 0; i < this.snakes.length; i++) {
      const s = this.snakes[i];
      if (!s.alive) continue;
      const pts = s.points;
      for (let j = 0; j < pts.length; j += 3) {
        const p = pts[j];
        grid.insert(p.x, p.y, { x: p.x, y: p.y, r: s.radius, s: s });
      }
      grid.insert(s.head.x, s.head.y, { x: s.head.x, y: s.head.y, r: s.radius, s: s });
    }

    // —— 碰撞 ——
    this._dead.length = 0;
    const snakes = this.snakes;

    // 头撞头
    for (let i = 0; i < snakes.length; i++) {
      const a = snakes[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < snakes.length; j++) {
        const b = snakes[j];
        if (!b.alive) continue;
        const rr = (a.radius + b.radius) * 0.78;
        if (U.dist2(a.head.x, a.head.y, b.head.x, b.head.y) < rr * rr) {
          this._markDead(a, b, false);
          this._markDead(b, a, false);
        }
      }
    }

    // 头撞身体
    for (let i = 0; i < snakes.length; i++) {
      const a = snakes[i];
      if (!a.alive) continue;
      const cand = grid.query(a.head.x, a.head.y, a.radius + 40, this._aiBuf);
      for (let k = 0; k < cand.length; k++) {
        const p = cand[k];
        if (p.s === a || !p.s.alive || a._deadMarked) continue;
        const rr = a.radius * 0.94 + p.r;
        if (U.dist2(a.head.x, a.head.y, p.x, p.y) < rr * rr) {
          this._markDead(a, p.s, true);
          break;
        }
      }
    }

    // —— 处理死亡 ——
    for (let i = 0; i < this._dead.length; i++) {
      const d = this._dead[i];
      if (d.snake.alive) this._kill(d.snake, d.killer, d.award);
    }

    // —— AI 补位 ——
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      const r = this.respawns[i];
      if (r.snake.alive) { this.respawns.splice(i, 1); continue; }
      if (this.time >= r.at) {
        this._spawnSnake(r.snake, false);
        this.respawns.splice(i, 1);
      }
    }

    // —— 食物补充 ——
    this.foodT -= dt;
    if (this.foodT <= 0) { this.foodT = 0.6; this.food.maintain(); }

    this.particles.update(dt);

    // —— 排行榜 ——
    this.leaderT -= dt;
    if (this.leaderT <= 0) { this.leaderT = C.LEADER_EVERY; this.updateLeader(); }

    this._updateCamera(dt);
  };

  Game.prototype._markDead = function (snake, killer, award) {
    if (!snake.alive || snake._deadMarked) return;
    snake._deadMarked = true;
    this._dead.push({ snake, killer: killer && killer !== snake ? killer : null, award });
  };

  Game.prototype._kill = function (snake, killer, award) {
    snake._deadMarked = false;
    snake.alive = false;
    snake.boosting = false;

    // 身体化作食物
    const pts = snake.points;
    const spacing = Math.max(14, snake.radius * 1.4);
    let acc = 0;
    const totalVal = snake.score * C.DEAD_FOOD_RATIO;
    const orbs = U.clamp(Math.round(pts.length * C.SEG_STEP / spacing), 6, 70);
    const per = U.clamp(totalVal / orbs, 0.6, 9);
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) acc += U.dist(pts[i].x, pts[i].y, pts[i - 1].x, pts[i - 1].y);
      if (acc >= spacing) {
        acc = 0;
        this.dropFood(pts[i].x + U.rand(-7, 7), pts[i].y + U.rand(-7, 7), per, snake.skin.a);
      }
      if (i % 6 === 0) {
        this.particles.burst(pts[i].x, pts[i].y, snake.skin.a, 3, 170);
      }
    }
    this.particles.burst(snake.head.x, snake.head.y, '#ffffff', 10, 300);

    snake.deathBy = killer ? killer.name : null;

    if (killer && killer.alive && award) {
      killer.kills++;
      killer.addScore(C.KILL_BONUS);
      if (this.onFeed) this.onFeed(killer, snake, true);
    } else if (killer && this.onFeed && !snake.isPlayer) {
      this.onFeed(killer, snake, false);
    }

    if (snake.isPlayer) {
      if (this.onPlayerDeath) this.onPlayerDeath(snake, killer);
    } else if (!snake.ai) {
      // 不该发生
    } else {
      this.respawns.push({ snake, at: this.time + U.rand(C.RESPAWN_MIN, C.RESPAWN_MAX) });
    }
  };

  Game.prototype.finalRank = function (score) {
    let r = 1;
    for (let i = 0; i < this.snakes.length; i++) {
      const s = this.snakes[i];
      if (s === this.player || !s.alive) continue;
      if (s.score > score) r++;
    }
    return r;
  };

  Game.prototype.updateLeader = function () {
    const arr = this.snakes.filter(s => s.alive).map(s => ({
      id: s.id, name: s.name, score: Math.floor(s.score), isPlayer: s.isPlayer, skin: s.skin
    }));
    arr.sort((a, b) => b.score - a.score);
    this.leader = arr.slice(0, 10);
    const p = this.player;
    if (p && p.alive) {
      let r = 1;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].isPlayer) { r = i + 1; break; }
      }
      this.rank = r;
    } else if (p) {
      this.rank = this.finalRank(p.score);
    }
  };

  Game.prototype._updateCamera = function (dt) {
    const p = this.player;
    if (!p) return;
    const tx = p.alive ? p.head.x : this.cam.x;
    const ty = p.alive ? p.head.y : this.cam.y;
    const k = 1 - Math.exp(-C.CAM_LERP * dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    const tz = U.clamp(C.ZOOM_BASE - (p.alive ? p.score : 0) / C.ZOOM_PER_SCORE, C.ZOOM_MIN, 1);
    this.cam.zoom += (tz - this.cam.zoom) * (1 - Math.exp(-3 * dt));
  };

  Game.prototype.totalSnakes = function () {
    let n = 0;
    for (let i = 0; i < this.snakes.length; i++) if (this.snakes[i].alive) n++;
    return n;
  };

  SB.Game = Game;
})(window.SB);
