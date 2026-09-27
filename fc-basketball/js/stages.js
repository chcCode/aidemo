/* stages.js : 场地定义（摩擦 / 跳跃修正 / 机关 / 背景绘制）
 * 伪 3D：地面为 [FAR_Y, NEAR_Y] 的透视平面（远端在上、近端在下），
 * 标线纵向压扁（椭圆中圈）以强化俯视立体感。
 * draw(ctx, cam, t) 在「世界坐标系」（已平移 -cam）中调用，
 * 需要视差的远景层自行用 cam * 系数补偿。
 */
window.NB = window.NB || {};

(function () {
  const C = NB.C;
  const FY = C.FAR_Y, NY = C.NEAR_Y;          // 地面远端/近端屏幕 y

  function sky(ctx, cam, color) {
    ctx.fillStyle = color;
    ctx.fillRect(cam, 0, C.W, FY);
  }

  /* 透视地面：平面 + 端线/边线/中线/中圈（纵向压扁） */
  function ground(ctx, color, lineColor) {
    ctx.fillStyle = color;
    ctx.fillRect(0, FY, C.FIELD_W, NY - FY);
    /* 近端以外的场边（屏幕底部） */
    ctx.fillStyle = shade(color, 0.7);
    ctx.fillRect(0, NY, C.FIELD_W, C.H - NY);

    ctx.fillStyle = lineColor;
    /* 远/近边线 */
    ctx.fillRect(4, FY, C.FIELD_W - 8, 1);
    ctx.fillRect(4, NY - 1, C.FIELD_W - 8, 1);
    /* 端线 */
    ctx.fillRect(4, FY, 2, NY - FY);
    ctx.fillRect(C.FIELD_W - 6, FY, 2, NY - FY);
    /* 中线 */
    ctx.fillRect(C.FIELD_W / 2 - 1, FY, 2, NY - FY);
    /* 中圈（椭圆，纵向压扁显透视） */
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(C.FIELD_W / 2, (FY + NY) / 2, 22, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    /* 禁区弧（两端小椭圆） */
    ctx.beginPath();
    ctx.ellipse(30, (FY + NY) / 2, 14, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(C.FIELD_W - 30, (FY + NY) / 2, 14, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* 颜色变暗 */
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.floor(((n >> 16) & 255) * k), g = Math.floor(((n >> 8) & 255) * k), b = Math.floor((n & 255) * k);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function cloud(ctx, x, y) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 18, 5); ctx.fillRect(x + 3, y - 3, 10, 3); ctx.fillRect(x + 5, y + 5, 8, 2);
  }
  function building(ctx, x, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, FY - h, 34, h);
    ctx.fillStyle = '#f8e888';
    for (let wy = FY - h + 4; wy < FY - 6; wy += 9) {
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
        ctx.fillRect(cam + 200, 26, 14, 14);
        /* 云（视差 + 漂移） */
        for (let i = 0; i < 5; i++) {
          const cx = ((i * 110 + t * 0.15) % 560) - 40 + cam * 0.7;
          cloud(ctx, cx, 22 + (i % 3) * 16);
        }
        /* 远景楼群（视差 0.5） */
        const off = Math.floor(cam * 0.5 / 48) * 48;
        for (let i = -1; i < 8; i++) {
          building(ctx, off + i * 48 + cam * 0.5, 34 + ((i * 37) % 3) * 12, '#6868a0');
        }
        /* 铁丝网（场地远端边缘） */
        ctx.fillStyle = '#484858';
        for (let x = 0; x < C.FIELD_W; x += 8) ctx.fillRect(x, FY - 12, 1, 12);
        ctx.fillRect(0, FY - 12, C.FIELD_W, 1);
        ground(ctx, '#989898', '#e8e8e8');
      },
    },

    /* ========== 体育馆（标准场地） ========== */
    {
      id: 'GYM', name: 'GYMNASIUM',
      friction: 0.25, jumpMul: 1, conveyors: [],
      draw(ctx, cam, t) {
        sky(ctx, cam, '#584838');
        /* 观众席（点阵，起伏动画） */
        for (let row = 0; row < 4; row++) {
          for (let i = 0; i < 64; i++) {
            const cols = ['#e83820', '#2848c8', '#f8d838', '#38c838', '#f8f8f8'];
            ctx.fillStyle = cols[(i * 7 + row * 3) % cols.length];
            const bob = ((i + row) % 5 === 0) ? Math.floor(Math.sin(t * 0.1 + i) * 1) : 0;
            ctx.fillRect(cam * 0.85 + i * 8 + (row % 2) * 4, 40 + row * 9 + bob, 5, 6);
          }
        }
        /* 横幅 */
        ctx.fillStyle = '#c82838';
        ctx.fillRect(cam + 58, 16, 140, 13);
        NB.Font.drawCenter(ctx, 'GANBARE DUNK HEROES', cam + 128, 19, '#f8f8f8', 1);
        /* 墙壁与窗 */
        ctx.fillStyle = '#c8a060';
        ctx.fillRect(cam, 80, C.W, FY - 80);
        ctx.fillStyle = '#a8d8f8';
        for (let i = 0; i < 4; i++) ctx.fillRect(cam * 0.9 + 30 + i * 64, 86, 28, 22);
        ground(ctx, '#d8a858', '#f8f8f8');
        /* 木地板纹理（沿纵深方向的板缝） */
        ctx.fillStyle = '#c89848';
        for (let x = 0; x < C.FIELD_W; x += 16) ctx.fillRect(x, FY, 1, NY - FY);
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
          cloud(ctx, cx, 20 + (i % 2) * 14);
        }
        /* 雪山（视差 0.5） */
        const off = Math.floor(cam * 0.5 / 90) * 90;
        for (let i = -1; i < 5; i++) {
          const bx = off + i * 90 + cam * 0.5;
          ctx.fillStyle = '#e8f4f8';
          ctx.beginPath();
          ctx.moveTo(bx, FY);
          ctx.lineTo(bx + 45, FY - 52);
          ctx.lineTo(bx + 90, FY);
          ctx.fill();
        }
        /* 松树 */
        for (let i = 0; i < 8; i++) {
          const tx = i * 64 + 20;
          ctx.fillStyle = '#286838';
          ctx.fillRect(tx, FY - 16, 12, 11);
          ctx.fillRect(tx + 2, FY - 22, 8, 6);
          ctx.fillStyle = '#684828';
          ctx.fillRect(tx + 4, FY - 5, 4, 5);
        }
        ground(ctx, '#d8ecf8', '#88b8d8');
        /* 冰面反光 */
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 12; i++) {
          ctx.fillRect((i * 53 + 17) % C.FIELD_W, FY + 8 + (i * 13) % (NY - FY - 10), 8, 1);
        }
      },
    },

    /* ========== 沙滩（高摩擦，跳跃降低） ========== */
    {
      id: 'BEACH', name: 'BEACH',
      friction: 0.38, jumpMul: 0.92, conveyors: [],
      draw(ctx, cam, t) {
        sky(ctx, cam, '#38b8f8');
        ctx.fillStyle = '#f8e838';
        ctx.fillRect(cam + 40, 18, 16, 16);
        for (let i = 0; i < 4; i++) {
          const cx = ((i * 120 + t * 0.12) % 560) - 40 + cam * 0.7;
          cloud(ctx, cx, 34 + (i % 2) * 13);
        }
        /* 海（视差 0.6，波浪动画） */
        ctx.fillStyle = '#2868c8';
        ctx.fillRect(cam * 0.6 - 40, 96, C.W + 80, FY - 96);
        ctx.fillStyle = '#58a8e8';
        for (let i = 0; i < 12; i++) {
          const wx = cam * 0.6 - 40 + ((i * 47 + t * 0.4) % (C.W + 80));
          ctx.fillRect(wx, 100 + (i % 3) * 9, 14, 2);
        }
        /* 椰子树 */
        for (const tx of [60, C.FIELD_W - 80]) {
          ctx.fillStyle = '#684828';
          ctx.fillRect(tx, FY - 30, 5, 30);
          ctx.fillStyle = '#289838';
          ctx.fillRect(tx - 9, FY - 36, 23, 6);
          ctx.fillRect(tx - 5, FY - 42, 15, 6);
        }
        ground(ctx, '#e8d898', '#c8b878');
      },
    },

    /* ========== 工地（传送带机关，纵深矩形区域） ========== */
    {
      id: 'FACTORY', name: 'FACTORY',
      friction: 0.2, jumpMul: 1,
      conveyors: [
        { x0: 130, x1: 205, y0: 12, y1: 40, dir: -1 },
        { x0: 275, x1: 350, y0: 48, y1: 76, dir: 1 },
      ],
      draw(ctx, cam, t) {
        sky(ctx, cam, '#585868');
        /* 烟囱与烟 */
        for (const bx of [70, 380]) {
          ctx.fillStyle = '#783828';
          ctx.fillRect(bx, FY - 72, 16, 72);
          ctx.fillStyle = '#989898';
          const sy = FY - 80 - (t * 0.6 % 24);
          ctx.fillRect(bx + 3, sy, 10, 6);
          ctx.fillRect(bx + 5, sy - 11, 12, 7);
        }
        /* 吊车架 */
        ctx.fillStyle = '#c8a828';
        ctx.fillRect(cam * 0.8 + 40, 34, 6, FY - 64);
        ctx.fillRect(cam * 0.8 + 40, 34, 90, 5);
        ctx.fillRect(cam * 0.8 + 116, 39, 2, 14);
        ctx.fillStyle = '#484848';
        ctx.fillRect(cam * 0.8 + 110, 53, 14, 8);
        /* 铁架背景 */
        ctx.fillStyle = '#484858';
        for (let x = 0; x < C.FIELD_W; x += 40) ctx.fillRect(x, FY - 26, 3, 26);
        ctx.fillRect(0, FY - 26, C.FIELD_W, 3);
        ground(ctx, '#787048', '#a8a068');
        /* 传送带（地面上的纵深矩形，滚动箭头动画） */
        for (const cv of this.conveyors) {
          const sy0 = NB.proj.sy(cv.y0, 0), sy1 = NB.proj.sy(cv.y1, 0);
          ctx.fillStyle = '#383838';
          ctx.fillRect(cv.x0, sy0, cv.x1 - cv.x0, sy1 - sy0);
          ctx.fillStyle = '#f8d838';
          const off = (t * 0.8 * cv.dir) % 12;
          for (let x = cv.x0 + 4; x < cv.x1 - 4; x += 12) {
            const ax = x + off;
            if (ax < cv.x0 + 2 || ax > cv.x1 - 6) continue;
            const ay = (sy0 + sy1) / 2;
            if (cv.dir > 0) { ctx.fillRect(ax, ay - 1, 3, 2); ctx.fillRect(ax + 2, ay - 2, 1, 4); }
            else            { ctx.fillRect(ax, ay - 1, 3, 2); ctx.fillRect(ax - 1, ay - 2, 1, 4); }
          }
        }
      },
    },
  ];
})();
