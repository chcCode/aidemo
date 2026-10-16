(function (SB) {
  'use strict';

  function Particles() {
    this.list = [];
  }

  Particles.prototype.spawn = function (p) {
    p.maxLife = p.life;
    this.list.push(p);
  };

  Particles.prototype.eat = function (x, y, color) {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = SB.U.rand(40, 130);
      this.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: SB.U.rand(0.22, 0.42), r: SB.U.rand(1.6, 3.4),
        color, type: 'dot'
      });
    }
  };

  Particles.prototype.burst = function (x, y, color, n, power) {
    n = n || 16;
    power = power || 240;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = SB.U.rand(power * 0.25, power);
      this.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: SB.U.rand(0.4, 0.9), r: SB.U.rand(2, 5.5),
        color, type: 'dot', drag: 0.9
      });
    }
  };

  Particles.prototype.trail = function (x, y, dir, color) {
    const a = dir + Math.PI + SB.U.rand(-0.5, 0.5);
    const s = SB.U.rand(30, 110);
    this.spawn({
      x: x + SB.U.rand(-4, 4), y: y + SB.U.rand(-4, 4),
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: SB.U.rand(0.25, 0.5), r: SB.U.rand(2.5, 5),
      color, type: 'dot', drag: 0.92
    });
  };

  Particles.prototype.text = function (x, y, str, color) {
    this.spawn({
      x, y, vx: 0, vy: -46, life: 0.85, r: 0,
      color: color || '#ffe066', type: 'text', str, drag: 1
    });
  };

  Particles.prototype.update = function (dt) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list[i] = list[list.length - 1]; list.pop(); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.drag && p.drag !== 1) {
        const f = Math.pow(p.drag, dt * 60);
        p.vx *= f; p.vy *= f;
      }
    }
  };

  Particles.prototype.draw = function (ctx) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, Math.min(1, t * 1.4));
      if (p.type === 'text') {
        ctx.font = 'bold 17px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeText(p.str, p.x, p.y - (1 - t) * 26);
        ctx.fillStyle = p.color;
        ctx.fillText(p.str, p.x, p.y - (1 - t) * 26);
      } else {
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.r * (0.35 + t * 0.65), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  Particles.prototype.clear = function () { this.list.length = 0; };

  SB.Particles = Particles;
})(window.SB);
