/* ============================================================
 * 热血篮球 FC —— Nekketsu Street Basket 风格复刻（伪 3D 版）
 * constants.js : 全局常量 / 三维投影 / 队伍数据
 *
 * 坐标系（伪三维）：
 *   x : 场地横向   0 ~ FIELD_W（左 -> 右）
 *   y : 场地纵深   0 ~ FIELD_D（0=远端/屏幕上方，FIELD_D=近端/屏幕下方）
 *   z : 高度       0=地面，向上为正（跳跃、球飞行）
 * 屏幕投影：sy = FAR_Y + y*SLOPE - z；精灵按 scale(y) 近大远小。
 * ============================================================ */
window.NB = window.NB || {};

/* ---------- 基础常量 ---------- */
NB.C = {
  W: 256, H: 240, SCALE: 3,   // 逻辑分辨率（FC 256x240）与整数倍放大
  FIELD_W: 480,               // 场地横向宽度（约两屏，横向卷轴）
  FIELD_D: 88,                // 场地纵深
  FAR_Y: 124,                 // 远端地面屏幕 y
  NEAR_Y: 214,                // 近端地面屏幕 y
  GRAVITY: 0.45,              // z 轴重力 px/f^2
  HUD_H: 22,                  // 顶部记分牌高度

  MATCH_TIME: 180,            // 常规时间（秒）
  OT_TIME: 30,                // 加时（金球制）

  P_W: 12, P_D: 8, P_H: 26,   // 球员碰撞盒：宽 / 纵深 / 高
  BALL_R: 4,                  // 球半径

  /* 篮架：左右两端、纵深居中，立柱上 3 层篮筐（下 2 分 / 中 3 分 / 上 4 分） */
  HOOP: {
    POLE_L: 12,               // 左立柱 x
    POLE_R: 480 - 12,         // 右立柱 x
    MID_Y: 44,                // 篮架纵深（场地中央）
    RIM_R: 7,                 // 筐口平面半径
    BOARD_W: 3,               // 篮板厚度
    LEVELS: [
      { z: 36,  score: 2 },
      { z: 72,  score: 3 },
      { z: 108, score: 4 },
    ],
  },

  ITEM_TYPES: ['STONE', 'TIRE', 'BIN', 'BANANA'],
  ITEM_MIN: 700, ITEM_MAX: 1300,  // 道具刷新间隔（帧）
  MAX_ITEMS: 2,
};

/* 篮架几何（左架筐朝右 / 右架镜像） */
NB.C.HOOP_GEO = (function () {
  const H = NB.C.HOOP;
  function side(poleX, dir) {
    const boardX = poleX + dir * 2;              // 篮板内沿 x
    const rimX = boardX + dir * (H.BOARD_W + H.RIM_R);  // 筐心 x
    return { poleX, boardX, rimX, dir };
  }
  return { left: side(H.POLE_L, 1), right: side(H.POLE_R, -1) };
})();

/* ---------- 伪 3D 投影 ----------
 * sx：世界 x（绘制层统一减 cam）
 * sy：世界 (y 纵深, z 高度) -> 屏幕 y
 * scale：按纵深近大远小
 */
NB.proj = {
  sy(y, z) {
    return NB.C.FAR_Y + y * (NB.C.NEAR_Y - NB.C.FAR_Y) / NB.C.FIELD_D - z;
  },
  scale(y) {
    return 0.8 + 0.3 * (y / NB.C.FIELD_D);
  },
};

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
