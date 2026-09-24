/* stages.js : 场地定义（摩擦 / 跳跃修正 / 机关 / 背景绘制）
 * draw(ctx, cam, t) 在「世界坐标系」（已平移 -cam）中调用，
 * 需要视差的远景层自行用 cam * 系数补偿。
 */
window.NB = window.NB || {};

(function () {
  const C = NB.C;

  function sky(ctx, cam, color) {
    ctx.fillStyle = color;
    ctx.fillRect(cam, 0, C.W, C.GROUND_Y);
  }
  function ground(ctx, color, lineColor) {
    ctx.fillStyle = color;
    ctx.fillRect(0, C.GROUND_Y, C.FIELD_W, C.H - C.GROUND_Y);
    /* 中线与中圈 */
    ctx.fillStyle = lineColor;
    ctx.fillRect(C.FIELD_W / 2 - 1, C.GROUND_Y + 2, 2, C.H - C.GROUND_Y - 4);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(C.FIELD_W / 2, C.GROUND_Y + 16, 12, 0, Math.PI * 2);
    ctx.stroke();
    /* 端线 */
    ctx.fillRect(4, C.GROUND_Y + 2, 2, C.H - C.GROUND_Y - 4);
    ctx.fillRect(C.FIELD_W - 6, C.GROUND_Y + 2, 2, C.H - C.GROUND_Y - 4);
  }
  function cloud(ctx, x, y) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 18, 5); ctx.fillRect(x + 3, y - 3, 10, 3); ctx.fillRect(x + 5, y + 5, 8, 2);
  }
  function building(ctx, x, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, C.GROUND_Y - h, 34, h);
    ctx.fillStyle = '#f8e888';
    for (let wy = C.GROUND_Y - h + 4; wy < C.GROUND_Y - 6; wy += 9) {
      for (let wx = x + 4; wx < x + 30; wx += 8) ctx.fillRect(wx, wy, 4, 5);
    }
  }

  NB.Stages = [
    /* ========== 屋顶（标准场地） ========== */
    {
      id: 'ROOFTOP', name: 'ROOFTOP',
      friction: 0.2, jumpMul: 1, conveyors: [],
      draw(ctx, cam, t) {
        sky(ctx, cam, '#3898f8');
        /* 太阳 */
        ctx.fillStyle = '#f8e838';
        ctx.fillRect(cam + 200, 30, 14, 14);
        /* 云（视差 0.3 + 漂移） */
        for (let i = 0; i < 5; i++) {
          const cx = ((i * 110 + t * 0.15) % 560) - 40 + cam * 0.7;
          cloud(ctx, cx, 26 + (i % 3) * 18);
        }
        /* 远景楼群（视差 0.5） */
        const off = Math.floor(cam * 0.5 / 48) * 48;
        for (let i = -1; i < 8; i++) {
          building(ctx, off + i * 48 + cam * 0.5, 40 + ((i * 37) % 3) * 14, '#6868a0');
        }
        /* 铁丝网 */
        ctx.fillStyle = '#484858';
        for (let x = 0; x < C.FIELD_W; x += 8) ctx.fillRect(x, C.GROUND_Y - 14, 1, 14);
        ctx.fillRect(0, C.GROUND_Y - 14, C.FIELD_W, 1);
        ground(ctx, '#989898', '#e8e8e8');
      },
    },

    /* ========== 体育馆（标准场地） ========== */
    {
      id: 'GYM', name: 'GYMNASIUM',
      friction: 0.25, jumpMul: 1, conveyors: [],
      draw(ctx, cam, t) {
        sky(ctx, cam, '#584838');
        /* 观众席（两层色块点阵） */
        for (let row = 0; row < 4; row++) {
          for (let i = 0; i < 64; i++) {
            const cols = ['#e83820', '#2848c8', '#f8d838', '#38c838', '#f8f8f8'];
            ctx.fillStyle = cols[(i * 7 + row * 3) % cols.length];
            const bob = ((i + row) % 5 === 0) ? Math.floor(Math.sin(t * 0.1 + i) * 1) : 0;
            ctx.fillRect(cam * 0.85 + i * 8 + (row % 2) * 4, 52 + row * 10 + bob, 5, 6);
          }
        }
        /* 横幅 */
        ctx.fillStyle = '#c82838';
        ctx.fillRect(cam + 58, 24, 140, 14);
        NB.Font.drawCenter(ctx, 'GANBARE DUNK HEROES', cam + 128, 28, '#f8f8f8', 1);
        /* 墙壁与窗 */
        ctx.fillStyle = '#c8a060';
        ctx.fillRect(cam, 96, C.W, C.GROUND_Y - 96);
        ctx.fillStyle = '#a8d8f8';
        for (let i = 0; i < 4; i++) ctx.fillRect(cam * 0.9 + 30 + i * 64, 104, 28, 24);
        ground(ctx, '#d8a858', '#f8f8f8');
        /* 木地板纹理 */
        ctx.fillStyle = '#c89848';
        for (let x = 0; x < C.FIELD_W; x += 16) ctx.fillRect(x, C.GROUND_Y, 1, C.H - C.GROUND_Y);
      },
    },

    /* ========== 冰场（低摩擦，滑行） ========== */
    {
      id: 'ICE', name: 'ICE RINK',
      friction: 0.03, jumpMul: 1, conveyors: [],
      draw(ctx, cam, t) {
        sky(ctx, cam, '#a8d8f8');
        for (let i = 0; i < 4; i++) {
          const cx = ((i * 130 + t * 0.1) % 560) - 40 + cam * 0.7;
          cloud(ctx, cx, 24 + (i % 2) * 16);
        }
        /* 雪山（视差 0.5） */
        const off = Math.floor(cam * 0.5 / 90) * 90;
        for (let i = -1; i < 5; i++) {
          const bx = off + i * 90 + cam * 0.5;
          ctx.fillStyle = '#e8f4f8';
          ctx.beginPath();
          ctx.moveTo(bx, C.GROUND_Y);
          ctx.lineTo(bx + 45, C.GROUND_Y - 60);
          ctx.lineTo(bx + 90, C.GROUND_Y);
          ctx.fill();
        }
        /* 松树 */
        for (let i = 0; i < 8; i++) {
          const tx = i * 64 + 20;
          ctx.fillStyle = '#286838';
          ctx.fillRect(tx, C.GROUND_Y - 18, 12, 12);
          ctx.fillRect(tx + 2, C.GROUND_Y - 24, 8, 6);
          ctx.fillStyle = '#684828';
          ctx.fillRect(tx + 4, C.GROUND_Y - 6, 4, 6);
        }
        ground(ctx, '#d8ecf8', '#88b8d8');
        /* 冰面反光 */
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 10; i++) ctx.fillRect((i * 53 + 17) % C.FIELD_W, C.GROUND_Y + 8 + (i % 3) * 7, 8, 1);
      },
    },

    /* ========== 沙滩（高摩擦，跳跃降低） ========== */
    {
      id: 'BEACH', name: 'BEACH',
      friction: 0.38, jumpMul: 0.92, conveyors: [],
      draw(ctx, cam, t) {
        sky(ctx, cam, '#38b8f8');
        ctx.fillStyle = '#f8e838';
        ctx.fillRect(cam + 40, 22, 16, 16);
        for (let i = 0; i < 4; i++) {
          const cx = ((i * 120 + t * 0.12) % 560) - 40 + cam * 0.7;
          cloud(ctx, cx, 40 + (i % 2) * 14);
        }
        /* 海（视差 0.6，波浪动画） */
        ctx.fillStyle = '#2868c8';
        ctx.fillRect(cam * 0.6 - 40, 120, C.W + 80, C.GROUND_Y - 120);
        ctx.fillStyle = '#58a8e8';
        for (let i = 0; i < 12; i++) {
          const wx = cam * 0.6 - 40 + ((i * 47 + t * 0.4) % (C.W + 80));
          ctx.fillRect(wx, 126 + (i % 4) * 14, 14, 2);
        }
        /* 椰子树 */
        for (const tx of [60, C.FIELD_W - 80]) {
          ctx.fillStyle = '#684828';
          ctx.fillRect(tx, C.GROUND_Y - 34, 5, 34);
          ctx.fillStyle = '#289838';
          ctx.fillRect(tx - 9, C.GROUND_Y - 40, 23, 6);
          ctx.fillRect(tx - 5, C.GROUND_Y - 46, 15, 6);
        }
        ground(ctx, '#e8d898', '#c8b878');
      },
    },

    /* ========== 工地（传送带机关） ========== */
    {
      id: 'FACTORY', name: 'FACTORY',
      friction: 0.2, jumpMul: 1,
      conveyors: [
        { x0: 130, x1: 205, dir: -1 },
        { x0: 275, x1: 350, dir: 1 },
      ],
      draw(ctx, cam, t) {
        sky(ctx, cam, '#585868');
        /* 烟囱与烟 */
        for (const bx of [70, 380]) {
          ctx.fillStyle = '#783828';
          ctx.fillRect(bx, C.GROUND_Y - 80, 16, 80);
          ctx.fillStyle = '#989898';
          const sy = C.GROUND_Y - 88 - (t * 0.6 % 26);
          ctx.fillRect(bx + 3, sy, 10, 6);
          ctx.fillRect(bx + 5, sy - 12, 12, 7);
        }
        /* 吊车架 */
        ctx.fillStyle = '#c8a828';
        ctx.fillRect(cam * 0.8 + 40, 40, 6, 60);
        ctx.fillRect(cam * 0.8 + 40, 40, 90, 5);
        ctx.fillRect(cam * 0.8 + 116, 45, 2, 16);
        ctx.fillStyle = '#484848';
        ctx.fillRect(cam * 0.8 + 110, 61, 14, 8);
        /* 铁架背景 */
        ctx.fillStyle = '#484858';
        for (let x = 0; x < C.FIELD_W; x += 40) ctx.fillRect(x, C.GROUND_Y - 30, 3, 30);
        ctx.fillRect(0, C.GROUND_Y - 30, C.FIELD_W, 3);
        ground(ctx, '#787048', '#a8a068');
        /* 传送带（滚动箭头动画） */
        for (const cv of this.conveyors) {
          ctx.fillStyle = '#383838';
          ctx.fillRect(cv.x0, C.GROUND_Y + 1, cv.x1 - cv.x0, 6);
          ctx.fillStyle = '#f8d838';
          const off = (t * 0.8 * cv.dir) % 12;
          for (let x = cv.x0 + 4; x < cv.x1 - 4; x += 12) {
            const ax = x + off;
            if (ax < cv.x0 + 2 || ax > cv.x1 - 6) continue;
            if (cv.dir > 0) { ctx.fillRect(ax, C.GROUND_Y + 3, 3, 2); ctx.fillRect(ax + 2, C.GROUND_Y + 2, 1, 4); }
            else            { ctx.fillRect(ax, C.GROUND_Y + 3, 3, 2); ctx.fillRect(ax - 1, C.GROUND_Y + 2, 1, 4); }
          }
        }
      },
    },
  ];
})();
