(function (SB) {
  'use strict';
  const U = SB.U;
  const C = SB.CONFIG;

  const BG_OUT = '#05060e';
  const BG_IN = '#141a33';
  const GRID = 'rgba(255,255,255,0.045)';
  const GRID_MAJOR = 'rgba(255,255,255,0.075)';

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1;
    this.t = 0;
  }

  Renderer.prototype.resize = function (w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  };

  Renderer.prototype.worldToScreen = function (x, y, cam) {
    return {
      x: (x - cam.x) * cam.zoom + this.w / 2,
      y: (y - cam.y) * cam.zoom + this.h / 2
    };
  };

  Renderer.prototype.screenToWorld = function (x, y, cam) {
    return {
      x: (x - this.w / 2) / cam.zoom + cam.x,
      y: (y - this.h / 2) / cam.zoom + cam.y
    };
  };

  Renderer.prototype.draw = function (game, dt) {
    this.t += dt;
    const ctx = this.ctx;
    const cam = game.cam;
    const W = this.w, H = this.h;
    this._zoom = cam.zoom;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = BG_OUT;
    ctx.fillRect(0, 0, W, H);

    // 视口（世界坐标）
    const vw = W / cam.zoom, vh = H / cam.zoom;
    const vx0 = cam.x - vw / 2, vy0 = cam.y - vh / 2;
    const vx1 = vx0 + vw, vy1 = vy0 + vh;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this._drawWorld(ctx, vx0, vy0, vx1, vy1, cam.zoom);
    this._drawFood(ctx, game, vx0, vy0, vx1, vy1);

    // 小蛇在下、大蛇在上
    const order = game.snakes.filter(s => s.alive).sort((a, b) => a.radius - b.radius);
    for (let i = 0; i < order.length; i++) {
      this._drawSnake(ctx, order[i], cam, game);
    }

    game.particles.draw(ctx);
    ctx.restore();

    this._drawMinimap(ctx, game, W, H);
  };

  Renderer.prototype._drawWorld = function (ctx, vx0, vy0, vx1, vy1, camZoom) {
    const x0 = Math.max(0, vx0), y0 = Math.max(0, vy0);
    const x1 = Math.min(C.WORLD_W, vx1), y1 = Math.min(C.WORLD_H, vy1);
    if (x1 <= x0 || y1 <= y0) return;

    ctx.fillStyle = BG_IN;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // 网格
    const step = 120;
    ctx.lineWidth = 1 / camZoom;
    ctx.strokeStyle = GRID;
    ctx.beginPath();
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) {
      ctx.moveTo(x, y0); ctx.lineTo(x, y1);
    }
    for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) {
      ctx.moveTo(x0, y); ctx.lineTo(x1, y);
    }
    ctx.stroke();

    const mstep = 600;
    ctx.strokeStyle = GRID_MAJOR;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = Math.floor(x0 / mstep) * mstep; x <= x1; x += mstep) {
      ctx.moveTo(x, y0); ctx.lineTo(x, y1);
    }
    for (let y = Math.floor(y0 / mstep) * mstep; y <= y1; y += mstep) {
      ctx.moveTo(x0, y); ctx.lineTo(x1, y);
    }
    ctx.stroke();

    // 边界
    if (vx0 < 40 || vy0 < 40 || vx1 > C.WORLD_W - 40 || vy1 > C.WORLD_H - 40) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,70,60,0.28)';
      ctx.lineWidth = 26;
      ctx.strokeRect(0, 0, C.WORLD_W, C.WORLD_H);
      ctx.strokeStyle = 'rgba(255,90,70,0.95)';
      ctx.lineWidth = 7;
      ctx.strokeRect(0, 0, C.WORLD_W, C.WORLD_H);
      ctx.strokeStyle = 'rgba(255,190,150,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, C.WORLD_W, C.WORLD_H);
      ctx.restore();
    }
  };

  Renderer.prototype._drawFood = function (ctx, game, vx0, vy0, vx1, vy1) {
    const items = game.food.items;
    const pad = 40;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < items.length; i++) {
      const f = items[i];
      if (f.dead) continue;
      if (f.x < vx0 - pad || f.x > vx1 + pad || f.y < vy0 - pad || f.y > vy1 + pad) continue;
      const pulse = 1 + Math.sin(this.t * 3.4 + f.ph) * 0.11;
      const r = f.r * pulse;
      ctx.fillStyle = U.rgba(f.color, 0.13);
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 2.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = U.rgba(f.color, 0.5);
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 1.45, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.42, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  // 从 index 0(≈头部) 到 endIdx 的路径
  function traceTo(ctx, snake, endIdx) {
    const pts = snake.points;
    endIdx = Math.min(endIdx, pts.length - 1);
    ctx.beginPath();
    ctx.moveTo(snake.head.x, snake.head.y);
    if (endIdx < 1) { ctx.lineTo(pts[0].x, pts[0].y); return; }
    ctx.lineTo(pts[0].x, pts[0].y);
    for (let i = 1; i < endIdx; i++) {
      const p = pts[i], n = pts[i + 1];
      ctx.quadraticCurveTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2);
    }
    const a = pts[endIdx - 1], b = pts[endIdx];
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.lineTo(b.x, b.y);
  }

  // 两点之间的子路径
  function traceSlice(ctx, pts, i0, i1) {
    ctx.beginPath();
    ctx.moveTo(pts[i0].x, pts[i0].y);
    if (i1 - i0 < 2) { ctx.lineTo(pts[i1].x, pts[i1].y); return; }
    for (let i = i0; i < i1 - 1; i++) {
      const p = pts[i], n = pts[i + 1];
      ctx.quadraticCurveTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2);
    }
    const a = pts[i1 - 1], b = pts[i1];
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.lineTo(b.x, b.y);
  }

  // 找到尾巴渐细段的起点 index（从尾部往回 taperLen 距离）
  function taperStart(pts, taperLen) {
    let acc = 0;
    for (let i = pts.length - 1; i > 2; i--) {
      acc += U.dist(pts[i].x, pts[i].y, pts[i - 1].x, pts[i - 1].y);
      if (acc >= taperLen) return i;
    }
    return 2;
  }

  Renderer.prototype._drawSnake = function (ctx, snake, cam, game) {
    // 视口剔除（按采样点估算包围盒）
    const pts = snake.points;
    const pad = snake.radius * 3 + 60;
    let minx = snake.head.x - pad, maxx = snake.head.x + pad;
    let miny = snake.head.y - pad, maxy = snake.head.y + pad;
    for (let i = 4; i < pts.length; i += 12) {
      const p = pts[i];
      if (p.x < minx) minx = p.x; else if (p.x > maxx) maxx = p.x;
      if (p.y < miny) miny = p.y; else if (p.y > maxy) maxy = p.y;
    }
    const vw = this.w / cam.zoom, vh = this.h / cam.zoom;
    if (maxx < cam.x - vw / 2 || minx > cam.x + vw / 2 ||
        maxy < cam.y - vh / 2 || miny > cam.y + vh / 2) return;

    const skin = snake.skin;
    const r = snake.radius;
    const boostGlow = snake.boosting;

    // 尾部渐细段
    let k = pts.length > 14 ? taperStart(pts, r * 4.6) : 1;
    if (pts.length - k < 9) k = Math.max(1, pts.length - 9);
    const span = pts.length - k;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 光晕
    if (boostGlow || r > 20) {
      ctx.strokeStyle = U.rgba(skin.a, boostGlow ? 0.22 : 0.1);
      ctx.lineWidth = r * 2 + (boostGlow ? 22 : 12);
      traceTo(ctx, snake, k);
      ctx.stroke();
    }

    // 描边
    ctx.strokeStyle = skin.dark;
    ctx.lineWidth = r * 2 + 5;
    traceTo(ctx, snake, k);
    ctx.stroke();

    // 主体
    ctx.strokeStyle = skin.a;
    ctx.lineWidth = r * 2;
    traceTo(ctx, snake, k);
    ctx.stroke();

    // 纹路
    if (skin.pattern === 'stripe') {
      ctx.save();
      ctx.setLineDash([r * 1.5, r * 1.9]);
      ctx.lineCap = 'butt';
      ctx.strokeStyle = U.rgba(skin.b, 0.95);
      ctx.lineWidth = r * 2 - 0.5;
      traceTo(ctx, snake, k);
      ctx.stroke();
      ctx.restore();
    } else if (skin.pattern === 'bead') {
      ctx.save();
      ctx.setLineDash([0.6, r * 1.75]);
      ctx.lineCap = 'round';
      ctx.strokeStyle = U.rgba(skin.b, 0.85);
      ctx.lineWidth = r * 1.15;
      traceTo(ctx, snake, k);
      ctx.stroke();
      ctx.restore();
    }

    // 尾部渐细（先描边后主体，避免接缝）
    if (span >= 6) {
      const chunks = 9;
      const bounds = (c) => {
        const i0 = Math.min(pts.length - 2, k + Math.floor(span * c / chunks));
        const i1 = Math.min(pts.length - 1, k + Math.floor(span * (c + 1) / chunks));
        return [i0, Math.max(i0 + 1, i1)];
      };
      const widthAt = (c) => 1 - 0.86 * ((c + 1) / chunks);
      for (let c = 0; c < chunks; c++) {
        const b = bounds(c);
        ctx.strokeStyle = skin.dark;
        ctx.lineWidth = r * 2 * widthAt(c) + 5;
        traceSlice(ctx, pts, b[0], b[1]);
        ctx.stroke();
      }
      for (let c = 0; c < chunks; c++) {
        const b = bounds(c);
        ctx.strokeStyle = skin.a;
        ctx.lineWidth = r * 2 * widthAt(c);
        traceSlice(ctx, pts, b[0], b[1]);
        ctx.stroke();
      }
    }

    this._drawHead(ctx, snake, cam);
    this._drawName(ctx, snake, cam, game);
  };

  Renderer.prototype._drawHead = function (ctx, snake, cam) {
    const r = snake.radius;
    const h = snake.head;
    const a = snake.heading;
    const fx = Math.cos(a), fy = Math.sin(a);
    const px = -fy, py = fx;

    // 头部圆（略大于身体 + 深色描边）
    ctx.beginPath();
    ctx.fillStyle = snake.skin.dark;
    ctx.arc(h.x, h.y, r * 1.16, 0, Math.PI * 2);
    ctx.fill();

    const g = ctx.createRadialGradient(
      h.x + fx * r * 0.3 - px * r * 0.3, h.y + fy * r * 0.3 - py * r * 0.3, r * 0.15,
      h.x, h.y, r * 1.3
    );
    g.addColorStop(0, U.shade(snake.skin.a, 1.45));
    g.addColorStop(1, snake.skin.a);
    ctx.beginPath();
    ctx.fillStyle = g;
    ctx.arc(h.x, h.y, r * 1.06, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    const eyeF = 0.34, eyeS = 0.6;
    const er = Math.max(3.2, r * 0.42);
    const blink = snake.blink > 0;
    for (let s = -1; s <= 1; s += 2) {
      const ex = h.x + fx * r * eyeF + px * r * eyeS * s;
      const ey = h.y + fy * r * eyeF + py * r * eyeS * s;
      if (blink) {
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = Math.max(1.5, er * 0.34);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - px * er * 0.7, ey - py * er * 0.7);
        ctx.lineTo(ex + px * er * 0.7, ey + py * er * 0.7);
        ctx.stroke();
        continue;
      }
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();

      // 瞳孔朝向目标方向
      const ta = snake.targetAngle;
      const ox = Math.cos(ta) * er * 0.42, oy = Math.sin(ta) * er * 0.42;
      ctx.beginPath();
      ctx.fillStyle = '#15171f';
      ctx.arc(ex + ox, ey + oy, er * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.arc(ex + ox - er * 0.16, ey + oy - er * 0.16, er * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  Renderer.prototype._drawName = function (ctx, snake, cam, game) {
    const z = cam.zoom;
    const h = snake.head;
    const isLeader = game.leader.length && game.leader[0].id === snake.id;
    const isMe = snake.isPlayer;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate((h.x - cam.x) * cam.zoom + this.w / 2, (h.y - cam.y) * cam.zoom + this.h / 2);
    ctx.translate(0, -(snake.radius * z + 17));

    ctx.font = 'bold ' + (13 + (isMe ? 2 : 0)) + 'px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(snake.name, 0, 0);
    ctx.fillStyle = isMe ? '#7ef9ff' : (isLeader ? '#ffd54f' : 'rgba(255,255,255,0.92)');
    ctx.fillText(snake.name, 0, 0);

    if (isLeader) {
      ctx.font = '15px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillText('👑', 0, -17);
    }
    ctx.restore();
  };

  Renderer.prototype._drawMinimap = function (ctx, game, W, H) {
    const size = Math.min(150, Math.max(100, Math.floor(Math.min(W, H) * 0.19)));
    const x = 14, y = H - size - 14;
    const s = size / C.WORLD_W;

    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, size, size, 10);
    } else {
      ctx.rect(x, y, size, size);
    }
    ctx.fillStyle = 'rgba(8,10,22,0.7)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();
    ctx.clip();

    ctx.strokeStyle = 'rgba(255,90,70,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);

    for (let i = 0; i < game.snakes.length; i++) {
      const sn = game.snakes[i];
      if (!sn.alive) continue;
      const dx = x + sn.head.x * s;
      const dy = y + sn.head.y * s;
      const rr = sn.isPlayer ? 4.2 : 2.6;
      ctx.beginPath();
      ctx.fillStyle = sn.skin.a;
      ctx.arc(dx, dy, rr, 0, Math.PI * 2);
      ctx.fill();
      if (sn.isPlayer) {
        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.arc(dx, dy, rr + 2.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  SB.Renderer = Renderer;
})(window.SB);
