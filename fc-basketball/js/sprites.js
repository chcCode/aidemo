/* sprites.js : 像素字体 / 角色帧生成 / 球与道具精灵
 * 所有图形均由代码逐像素生成（无外部图片），运行时缓存到 offscreen canvas。
 */
window.NB = window.NB || {};

/* ================= 5x7 像素字体 ================= */
NB.Font = (function () {
  const G = {
    '0': ['01110','10001','10011','10101','11001','10001','01110'],
    '1': ['00100','01100','00100','00100','00100','00100','01110'],
    '2': ['01110','10001','00001','00110','01000','10000','11111'],
    '3': ['11111','00010','00100','00010','00001','10001','01110'],
    '4': ['00010','00110','01010','10010','11111','00010','00010'],
    '5': ['11111','10000','11110','00001','00001','10001','01110'],
    '6': ['00110','01000','10000','11110','10001','10001','01110'],
    '7': ['11111','00001','00010','00100','01000','01000','01000'],
    '8': ['01110','10001','10001','01110','10001','10001','01110'],
    '9': ['01110','10001','10001','01111','00001','00010','01100'],
    'A': ['01110','10001','10001','11111','10001','10001','10001'],
    'B': ['11110','10001','10001','11110','10001','10001','11110'],
    'C': ['01110','10001','10000','10000','10000','10001','01110'],
    'D': ['11100','10010','10001','10001','10001','10010','11100'],
    'E': ['11111','10000','10000','11110','10000','10000','11111'],
    'F': ['11111','10000','10000','11110','10000','10000','10000'],
    'G': ['01110','10001','10000','10111','10001','10001','01111'],
    'H': ['10001','10001','10001','11111','10001','10001','10001'],
    'I': ['01110','00100','00100','00100','00100','00100','01110'],
    'J': ['00111','00010','00010','00010','00010','10010','01100'],
    'K': ['10001','10010','10100','11000','10100','10010','10001'],
    'L': ['10000','10000','10000','10000','10000','10000','11111'],
    'M': ['10001','11011','10101','10101','10001','10001','10001'],
    'N': ['10001','10001','11001','10101','10011','10001','10001'],
    'O': ['01110','10001','10001','10001','10001','10001','01110'],
    'P': ['11110','10001','10001','11110','10000','10000','10000'],
    'Q': ['01110','10001','10001','10001','10101','10010','01101'],
    'R': ['11110','10001','10001','11110','10100','10010','10001'],
    'S': ['01111','10000','10000','01110','00001','00001','11110'],
    'T': ['11111','00100','00100','00100','00100','00100','00100'],
    'U': ['10001','10001','10001','10001','10001','10001','01110'],
    'V': ['10001','10001','10001','10001','10001','01010','00100'],
    'W': ['10001','10001','10001','10101','10101','10101','01010'],
    'X': ['10001','10001','01010','00100','01010','10001','10001'],
    'Y': ['10001','10001','01010','00100','00100','00100','00100'],
    'Z': ['11111','00001','00010','00100','01000','10000','11111'],
    ' ': ['00000','00000','00000','00000','00000','00000','00000'],
    ':': ['00000','00100','00100','00000','00100','00100','00000'],
    '-': ['00000','00000','00000','11111','00000','00000','00000'],
    '!': ['00100','00100','00100','00100','00100','00000','00100'],
    '.': ['00000','00000','00000','00000','00000','00110','00110'],
    '/': ['00001','00010','00010','00100','01000','01000','10000'],
    '>': ['00100','00010','00001','00010','00100','00000','00000'],
    '<': ['00100','01000','10000','01000','00100','00000','00000'],
    '+': ['00000','00100','00100','11111','00100','00100','00000'],
    '*': ['00000','10101','01110','11111','01110','10101','00000'],
    "'": ['00100','00100','01000','00000','00000','00000','00000'],
    '?': ['01110','10001','00001','00110','00100','00000','00100'],
  };

  function draw(ctx, str, x, y, color, scale) {
    scale = scale || 1;
    ctx.fillStyle = color;
    const s = String(str).toUpperCase();
    for (let i = 0; i < s.length; i++) {
      const g = G[s[i]] || G[' '];
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 5; c++) {
          if (g[r][c] === '1') ctx.fillRect(x + i * 6 * scale + c * scale, y + r * scale, scale, scale);
        }
      }
    }
  }
  function width(str, scale) { scale = scale || 1; return String(str).length * 6 * scale - scale; }
  function drawCenter(ctx, str, cx, y, color, scale) {
    draw(ctx, str, Math.round(cx - width(str, scale) / 2), y, color, scale);
  }
  return { draw, width, drawCenter };
})();

/* ================= 精灵生成 ================= */
NB.Sprites = (function () {
  function mkCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
  }
  function P(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }

  /* ---------- 角色帧 ----------
   * 画布统一 28x28，角色中心 x=14，脚底 y=27，朝右绘制（朝左由绘制端翻转）。
   * opt: { legs, arms, tilt }
   *   legs: stand | runA | runB | air | kick | sit | lie
   *   arms: down | up | hold | shoot | dunk | punch | flail
   */
  function drawBody(c, pal, opt) {
    const tilt = opt.tilt || 0;

    if (opt.legs === 'lie') {          // 倒地：横躺，头在左
      P(c, 3, 18, 7, 7, pal.skin);                 // 脸
      P(c, 2, 16, 9, 3, pal.hair);                 // 头发
      P(c, 2, 19, 2, 5, pal.hair);
      P(c, 5, 21, 2, 1, '#202020');                // 闭眼
      P(c, 8, 21, 2, 1, '#202020');
      P(c, 11, 18, 9, 6, pal.shirt);               // 躯干
      P(c, 11, 20, 9, 1, pal.pants);               // 条纹
      P(c, 20, 18, 5, 3, pal.pants);               // 腿
      P(c, 20, 22, 5, 3, pal.pants);
      P(c, 24, 17, 3, 4, pal.shoes);               // 鞋
      P(c, 24, 21, 3, 4, pal.shoes);
      return;
    }

    /* ---- 腿（y 19~27） ---- */
    switch (opt.legs) {
      case 'runA':
        P(c, 12, 19, 5, 3, pal.pants); P(c, 15, 21, 3, 3, pal.pants); P(c, 15, 24, 4, 3, pal.shoes);
        P(c, 9, 19, 4, 3, pal.pants);  P(c, 8, 22, 3, 2, pal.pants);  P(c, 7, 24, 4, 3, pal.shoes);
        break;
      case 'runB':
        P(c, 9, 19, 5, 3, pal.pants);  P(c, 10, 21, 3, 3, pal.pants); P(c, 9, 24, 4, 3, pal.shoes);
        P(c, 15, 19, 4, 3, pal.pants); P(c, 17, 22, 3, 2, pal.pants); P(c, 17, 24, 4, 3, pal.shoes);
        break;
      case 'air':
        P(c, 10, 19, 4, 4, pal.pants); P(c, 15, 19, 4, 4, pal.pants);
        P(c, 10, 23, 4, 2, pal.shoes); P(c, 15, 23, 4, 2, pal.shoes);
        break;
      case 'kick':
        P(c, 14, 20, 7, 3, pal.pants); P(c, 21, 20, 4, 3, pal.shoes);   // 右腿前踢
        P(c, 10, 19, 4, 4, pal.pants); P(c, 10, 23, 4, 2, pal.shoes);
        break;
      case 'sit':
        P(c, 10, 19, 4, 4, pal.pants); P(c, 13, 22, 7, 3, pal.pants); P(c, 20, 22, 4, 3, pal.shoes);
        break;
      default: // stand
        P(c, 10, 19, 3, 5, pal.pants); P(c, 15, 19, 3, 5, pal.pants);
        P(c, 9, 24, 4, 3, pal.shoes);  P(c, 15, 24, 4, 3, pal.shoes);
    }

    /* ---- 躯干（y 12~18） ---- */
    P(c, 9 + tilt, 12, 10, 7, pal.shirt);
    P(c, 9 + tilt, 14, 10, 1, pal.pants);          // 条纹
    P(c, 12 + tilt, 12, 4, 1, pal.pants);          // 领口

    /* ---- 手臂 ---- */
    switch (opt.arms) {
      case 'up':                                   // 高举（举道具/胜利）
        P(c, 8 + tilt, 5, 2, 7, pal.shirt);  P(c, 8 + tilt, 3, 2, 2, pal.skin);
        P(c, 18 + tilt, 5, 2, 7, pal.shirt); P(c, 18 + tilt, 3, 2, 2, pal.skin);
        break;
      case 'hold':                                 // 持球（双手举过头顶）
        P(c, 8 + tilt, 6, 2, 6, pal.shirt);  P(c, 8 + tilt, 4, 2, 2, pal.skin);
        P(c, 18 + tilt, 6, 2, 6, pal.shirt); P(c, 18 + tilt, 4, 2, 2, pal.skin);
        break;
      case 'shoot':                                // 投篮（全力上伸）
        P(c, 8 + tilt, 4, 2, 8, pal.shirt);  P(c, 8 + tilt, 2, 2, 2, pal.skin);
        P(c, 18 + tilt, 4, 2, 8, pal.shirt); P(c, 18 + tilt, 2, 2, 2, pal.skin);
        break;
      case 'dunk':                                 // 扣篮（右臂上伸）
        P(c, 18 + tilt, 4, 2, 8, pal.shirt); P(c, 18 + tilt, 2, 2, 2, pal.skin);
        P(c, 7 + tilt, 12, 2, 4, pal.shirt); P(c, 7 + tilt, 16, 2, 3, pal.skin);
        break;
      case 'punch':                                // 出拳（右臂前伸）
        P(c, 19 + tilt, 13, 6, 2, pal.shirt); P(c, 25 + tilt, 13, 2, 2, pal.skin);
        P(c, 7 + tilt, 12, 2, 4, pal.shirt);  P(c, 7 + tilt, 16, 2, 3, pal.skin);
        break;
      case 'flail':                                // 挥舞（受击/跳跃）
        P(c, 6 + tilt, 8, 2, 5, pal.shirt);  P(c, 6 + tilt, 6, 2, 2, pal.skin);
        P(c, 20 + tilt, 8, 2, 5, pal.shirt); P(c, 20 + tilt, 6, 2, 2, pal.skin);
        break;
      default:                                     // down
        P(c, 7 + tilt, 12, 2, 4, pal.shirt);  P(c, 7 + tilt, 16, 2, 3, pal.skin);
        P(c, 19 + tilt, 12, 2, 4, pal.shirt); P(c, 19 + tilt, 16, 2, 3, pal.skin);
    }

    /* ---- 头（x 9~18, y 3~11） ---- */
    const hx = 9 + tilt, hy = 3;
    P(c, hx, hy, 10, 3, pal.hair);                 // 头发
    P(c, hx, hy + 3, 2, 2, pal.hair);
    P(c, hx + 8, hy + 3, 2, 2, pal.hair);
    P(c, hx + 1, hy + 3, 8, 5, pal.skin);          // 脸
    P(c, hx + 3, hy + 4, 2, 3, '#ffffff');         // 眼白
    P(c, hx + 4, hy + 5, 1, 2, '#101010');         // 瞳
    P(c, hx + 7, hy + 4, 2, 3, '#ffffff');
    P(c, hx + 8, hy + 5, 1, 2, '#101010');
    P(c, hx + 5, hy + 7, 3, 1, '#c06060');         // 嘴
  }

  const FRAME_DEFS = {
    idle:     { legs: 'stand', arms: 'down' },
    run0:     { legs: 'runA',  arms: 'down' },
    run1:     { legs: 'runB',  arms: 'down' },
    jump:     { legs: 'air',   arms: 'flail' },
    hold:     { legs: 'stand', arms: 'hold' },
    holdrun0: { legs: 'runA',  arms: 'hold' },
    holdrun1: { legs: 'runB',  arms: 'hold' },
    holdjump: { legs: 'air',   arms: 'hold' },
    shoot:    { legs: 'stand', arms: 'shoot', tilt: -1 },
    dunk:     { legs: 'air',   arms: 'dunk' },
    punch:    { legs: 'stand', arms: 'punch', tilt: 1 },
    kick:     { legs: 'kick',  arms: 'flail' },
    hit:      { legs: 'stand', arms: 'flail', tilt: -1 },
    down:     { legs: 'lie',   arms: 'down' },
    dizzy:    { legs: 'sit',   arms: 'down' },
    win:      { legs: 'stand', arms: 'up' },
    carry:    { legs: 'stand', arms: 'up' },
    carryrun0:{ legs: 'runA',  arms: 'up' },
    carryrun1:{ legs: 'runB',  arms: 'up' },
  };

  function makePlayer(pal) {
    const frames = {};
    for (const name in FRAME_DEFS) {
      const cv = mkCanvas(28, 28);
      drawBody(cv.getContext('2d'), pal, FRAME_DEFS[name]);
      frames[name] = cv;
    }
    return frames;
  }

  /* ---------- 篮球（2 帧旋转） ---------- */
  function makeBall() {
    const frames = [];
    for (let f = 0; f < 2; f++) {
      const cv = mkCanvas(8, 8);
      const c = cv.getContext('2d');
      P(c, 2, 0, 4, 1, '#e87818'); P(c, 1, 1, 6, 1, '#e87818');
      P(c, 0, 2, 8, 4, '#e87818'); P(c, 1, 6, 6, 1, '#e87818'); P(c, 2, 7, 4, 1, '#e87818');
      P(c, 2, 1, 2, 1, '#f8a848');                                  // 高光
      if (f === 0) {
        P(c, 0, 4, 8, 1, '#802800'); P(c, 4, 0, 1, 8, '#802800');
      } else {
        P(c, 1, 1, 1, 1, '#802800'); P(c, 2, 2, 1, 1, '#802800'); P(c, 5, 5, 1, 1, '#802800'); P(c, 6, 6, 1, 1, '#802800');
        P(c, 6, 1, 1, 1, '#802800'); P(c, 5, 2, 1, 1, '#802800'); P(c, 2, 5, 1, 1, '#802800'); P(c, 1, 6, 1, 1, '#802800');
      }
      frames.push(cv);
    }
    return frames;
  }

  /* ---------- 道具 ---------- */
  function makeItems() {
    const o = {};
    { // STONE 石头 8x6
      const cv = mkCanvas(8, 6), c = cv.getContext('2d');
      P(c, 1, 1, 6, 4, '#909098'); P(c, 0, 2, 8, 2, '#909098');
      P(c, 2, 1, 2, 1, '#c8c8d0');
      P(c, 1, 4, 6, 1, '#585860');
      o.STONE = cv;
    }
    { // TIRE 轮胎 10x10
      const cv = mkCanvas(10, 10), c = cv.getContext('2d');
      P(c, 2, 0, 6, 1, '#202028'); P(c, 0, 2, 10, 6, '#202028'); P(c, 2, 9, 6, 1, '#202028');
      P(c, 1, 1, 8, 8, '#202028');
      P(c, 3, 3, 4, 4, '#686878');
      P(c, 4, 4, 2, 2, '#202028');
      o.TIRE = cv;
    }
    { // BIN 垃圾桶 10x12
      const cv = mkCanvas(10, 12), c = cv.getContext('2d');
      P(c, 0, 0, 10, 3, '#787880');                  // 桶口
      P(c, 1, 3, 8, 8, '#9898a0');                   // 桶身
      P(c, 3, 3, 1, 8, '#686870'); P(c, 6, 3, 1, 8, '#686870');
      P(c, 1, 10, 8, 1, '#585860');
      o.BIN = cv;
    }
    { // BANANA 香蕉皮 8x5
      const cv = mkCanvas(8, 5), c = cv.getContext('2d');
      P(c, 1, 1, 6, 2, '#f8d838'); P(c, 2, 3, 4, 1, '#f8d838');
      P(c, 0, 0, 2, 2, '#c8a818'); P(c, 6, 0, 2, 1, '#c8a818');
      o.BANANA = cv;
    }
    return o;
  }

  return { makePlayer, makeBall, makeItems };
})();
