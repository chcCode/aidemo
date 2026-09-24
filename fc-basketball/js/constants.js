/* ============================================================
 * 热血篮球 FC —— Nekketsu Street Basket 风格复刻
 * constants.js : 全局常量与队伍数据
 * ============================================================ */
window.NB = window.NB || {};

/* ---------- 基础常量 ---------- */
NB.C = {
  W: 256, H: 240, SCALE: 3,   // 逻辑分辨率（FC 256x240）与整数倍放大
  FIELD_W: 480,               // 场地逻辑宽度（约两屏，横向卷轴）
  GROUND_Y: 208,              // 地面 y 坐标
  GRAVITY: 0.45,              // 重力加速度 px/f^2
  HUD_H: 22,                  // 顶部记分牌高度

  MATCH_TIME: 180,            // 常规时间（秒）
  OT_TIME: 30,                // 加时（金球制）

  P_W: 12, P_H: 26,           // 球员碰撞盒
  BALL_R: 4,                  // 球半径

  /* 篮架：左右对称，立柱上 3 层篮筐（下 2 分 / 中 3 分 / 上 4 分） */
  HOOP: {
    POLE_L: 12,               // 左立柱中心 x
    POLE_R: 480 - 12,         // 右立柱中心 x
    BOARD_W: 3,               // 篮板厚度
    RIM_LEN: 12,              // 筐口挑出长度（筐口宽）
    LEVELS: [
      { y: 172, score: 2 },
      { y: 136, score: 3 },
      { y: 100, score: 4 },
    ],
  },

  ITEM_TYPES: ['STONE', 'TIRE', 'BIN', 'BANANA'],
  ITEM_MIN: 700, ITEM_MAX: 1300,  // 道具刷新间隔（帧）
  MAX_ITEMS: 2,
};

/* 由篮架常量推导出的几何（左架 / 右架镜像） */
NB.C.HOOP_GEO = (function () {
  const H = NB.C.HOOP, G = NB.C;
  function side(poleX, dir) {           // dir: +1 左架（筐朝右） / -1 右架
    const boardX = poleX + dir * 2;     // 篮板内沿 x
    const rimX1 = dir > 0 ? boardX + H.BOARD_W : boardX - H.RIM_LEN;
    const rimX2 = rimX1 + H.RIM_LEN;    // 筐口 [rimX1, rimX2]
    return { poleX, boardX, rimX1, rimX2, rimCX: (rimX1 + rimX2) / 2 };
  }
  return { left: side(H.POLE_L, 1), right: side(H.POLE_R, -1) };
})();

/* ---------- 队伍数据 ----------
 * sp 速度 / jp 跳跃 / pw 力量 / sh 投篮（1~5）
 * pal/pal2: 两名球员的配色（skin 肤色 hair 发色 shirt 队服 pants 球裤 shoes 鞋）
 */
NB.TEAMS = [
  {
    id: 'NEK', name: 'NEKKETSU', short: 'NEK',
    pal:  { skin: '#f8c890', hair: '#482818', shirt: '#e83820', pants: '#ffffff', shoes: '#402818' },
    pal2: { skin: '#f0b888', hair: '#181818', shirt: '#e83820', pants: '#ffffff', shoes: '#402818' },
    players: [
      { name: 'KUNIO', sp: 3, jp: 3, pw: 3, sh: 3 },
      { name: 'GODA',  sp: 2, jp: 2, pw: 5, sh: 2 },
    ],
  },
  {
    id: 'HAN', name: 'HANAZONO', short: 'HAN',
    pal:  { skin: '#f8c890', hair: '#282828', shirt: '#2848c8', pants: '#ffffff', shoes: '#282828' },
    pal2: { skin: '#f8c890', hair: '#683818', shirt: '#2848c8', pants: '#ffffff', shoes: '#282828' },
    players: [
      { name: 'RIKI', sp: 2, jp: 3, pw: 5, sh: 2 },
      { name: 'SAWA', sp: 5, jp: 3, pw: 2, sh: 3 },
    ],
  },
  {
    id: 'REI', name: 'REIHO', short: 'REI',
    pal:  { skin: '#f0c098', hair: '#402860', shirt: '#7828a8', pants: '#e8e8e8', shoes: '#281828' },
    pal2: { skin: '#f0c098', hair: '#402860', shirt: '#7828a8', pants: '#e8e8e8', shoes: '#281828' },
    players: [
      { name: 'RYU1', sp: 3, jp: 4, pw: 3, sh: 4 },
      { name: 'RYU2', sp: 4, jp: 4, pw: 2, sh: 3 },
    ],
  },
  {
    id: 'TAI', name: 'TAIYO', short: 'TAI',
    pal:  { skin: '#e8a868', hair: '#c85018', shirt: '#f8a818', pants: '#402810', shoes: '#402810' },
    pal2: { skin: '#e8a868', hair: '#881808', shirt: '#f8a818', pants: '#402810', shoes: '#402810' },
    players: [
      { name: 'KEN',  sp: 3, jp: 5, pw: 2, sh: 3 },
      { name: 'TARO', sp: 2, jp: 2, pw: 4, sh: 5 },
    ],
  },
  {
    id: 'USA', name: 'USA', short: 'USA',
    pal:  { skin: '#f8d0a8', hair: '#d8b838', shirt: '#2858c8', pants: '#c82828', shoes: '#282828' },
    pal2: { skin: '#a86840', hair: '#181818', shirt: '#2858c8', pants: '#c82828', shoes: '#282828' },
    players: [
      { name: 'JOHNNY', sp: 4, jp: 5, pw: 3, sh: 3 },
      { name: 'MIKE',   sp: 2, jp: 2, pw: 5, sh: 3 },
    ],
  },
  {
    id: 'RUS', name: 'RUSSIA', short: 'RUS',
    pal:  { skin: '#f8d0b0', hair: '#b8b8b8', shirt: '#c82838', pants: '#2838a8', shoes: '#282828' },
    pal2: { skin: '#f8d0b0', hair: '#483820', shirt: '#c82838', pants: '#2838a8', shoes: '#282828' },
    players: [
      { name: 'IVAN',   sp: 2, jp: 3, pw: 5, sh: 2 },
      { name: 'SERGEI', sp: 5, jp: 4, pw: 2, sh: 4 },
    ],
  },
];
