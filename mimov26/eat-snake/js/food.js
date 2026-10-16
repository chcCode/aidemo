(function (SB) {
  'use strict';
  const U = SB.U;
  const C = SB.CONFIG;

  function FoodManager() {
    this.items = [];
    this.grid = new SB.SpatialGrid(C.FOOD_CELL);
    this._dirty = true;
    this._queryBuf = [];
  }

  FoodManager.prototype.add = function (x, y, value, color) {
    const r = U.rand(C.FOOD_MIN_R, C.FOOD_MAX_R) * (value >= 3 ? 1.25 : 1);
    const f = {
      x, y, r,
      value: value || U.randInt(1, 2),
      color: color || U.pick(SB.FOOD_COLORS),
      ph: Math.random() * Math.PI * 2
    };
    this.items.push(f);
    this._dirty = true;
    return f;
  };

  FoodManager.prototype.spawnInitial = function () {
    this.items.length = 0;
    for (let i = 0; i < C.FOOD_COUNT; i++) {
      this.add(
        U.rand(40, C.WORLD_W - 40),
        U.rand(40, C.WORLD_H - 40),
        U.randInt(1, 3)
      );
    }
    this._dirty = true;
  };

  FoodManager.prototype._rebuild = function () {
    this.grid.clear();
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const f = items[i];
      if (f.dead) { items[i] = items[items.length - 1]; items.pop(); continue; }
      this.grid.insert(f.x, f.y, f);
    }
    this._dirty = false;
  };

  // 返回 (x,y,r) 范围内的食物（数组内部复用）
  FoodManager.prototype.query = function (x, y, r) {
    if (this._dirty) this._rebuild();
    return this.grid.query(x, y, r, this._queryBuf);
  };

  // 蛇头吃食物，返回吃掉的总分
  FoodManager.prototype.eatNear = function (hx, hy, hr) {
    if (this._dirty) this._rebuild();
    const grab = hr + 3;
    const near = this.grid.query(hx, hy, grab + C.FOOD_MAX_R, this._queryBuf);
    let gain = 0;
    for (let i = 0; i < near.length; i++) {
      const f = near[i];
      if (f.dead) continue;
      const rr = grab + f.r;
      if (U.dist2(hx, hy, f.x, f.y) < rr * rr) {
        f.dead = true;
        gain += f.value;
        this._dirty = true;
      }
    }
    return gain;
  };

  FoodManager.prototype.maintain = function () {
    let n = 0;
    for (let i = 0; i < this.items.length; i++) if (!this.items[i].dead) n++;

    // 蛇死亡掉落会累积，超过上限时回收多余光点
    const cap = C.FOOD_COUNT * 1.35;
    if (n > cap) {
      const want = Math.floor(n - C.FOOD_COUNT);
      let removed = 0;
      for (let i = this.items.length - 1; i >= 0 && removed < want; i--) {
        const f = this.items[i];
        if (!f.dead) { f.dead = true; removed++; }
      }
      this._dirty = true;
      n -= removed;
    }

    let guard = 400;
    while (n < C.FOOD_COUNT && guard-- > 0) {
      this.add(
        U.rand(40, C.WORLD_W - 40),
        U.rand(40, C.WORLD_H - 40),
        U.randInt(1, 3)
      );
      n++;
    }
  };

  FoodManager.prototype.count = function () {
    let n = 0;
    for (let i = 0; i < this.items.length; i++) if (!this.items[i].dead) n++;
    return n;
  };

  SB.FoodManager = FoodManager;
})(window.SB);
