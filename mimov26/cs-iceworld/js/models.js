// 程序化模型：枪械 / 角色（单位 = GoldSrc 单位，玩家高 72）
import * as THREE from 'three';

const MAT = {};
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!MAT[key]) MAT[key] = new THREE.MeshLambertMaterial({ color, ...opts });
  return MAT[key];
}
export const MATS = { mat };

function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = false; m.receiveShadow = false;
  return m;
}
function cyl(r1, r2, h, color, x = 0, y = 0, z = 0, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat(color));
  m.position.set(x, y, z);
  return m;
}

const BLACK = 0x1c1d20, DARK = 0x2a2c30, STEEL = 0x4a4d52, WOOD = 0x6a4526, WOOD2 = 0x7d5433;

// 枪械外形参数（枪口朝 -Z）
const GUN = {
  knife:    { type: 'knife', len: 26 },
  usp:      { type: 'pistol', len: 15, barrelR: 1.6 },
  glock18:  { type: 'pistol', len: 13, barrelR: 1.5 },
  deagle:   { type: 'pistol', len: 16, barrelR: 2.0 },
  mp5navy:  { type: 'smg', len: 30, mag: 'str' },
  tmp:      { type: 'smg', len: 26, mag: 'str' },
  p90:      { type: 'smg', len: 30, mag: 'bull' },
  mac10:    { type: 'smg', len: 24, mag: 'str' },
  ak47:     { type: 'rifle', len: 42, mag: 'curve', wood: true },
  m4a1:     { type: 'rifle', len: 40, mag: 'str', carry: true },
  sg552:    { type: 'rifle', len: 38, mag: 'str' },
  aug:      { type: 'rifle', len: 40, mag: 'str', scope: true },
  awp:      { type: 'rifle', len: 56, mag: 'str', scope: true, green: true },
  m3:       { type: 'shotgun', len: 40, tube: true },
  xm1014:   { type: 'shotgun', len: 44, tube: true, mag: 'box' },
  m249:     { type: 'mg', len: 46, drum: true }
};

export function buildGun(id) {
  const g = new THREE.Group();
  const s = GUN[id] || GUN.usp;
  const bodyCol = s.green ? 0x3d4a2e : (s.wood ? 0x2b2c2e : BLACK);

  if (s.type === 'knife') {
    g.add(box(3, 5, 10, 0x3a3d42, 0, 0, 2));                       // 柄
    const blade = box(2.2, 4.5, 16, 0xb9bdc4, 0, 0.4, -10);        // 刃
    g.add(blade);
    return g;
  }
  if (s.type === 'pistol') {
    g.add(box(3.6, 5.5, s.len, DARK, 0, 3, -s.len * 0.25));        // 套筒
    g.add(box(3.2, 9, 5.5, BLACK, 0, -2.5, 3));                     // 握把
    g.add(cyl(s.barrelR, s.barrelR, 5, STEEL, 0, 3.5, -s.len * 0.55, 6).rotateX(Math.PI / 2));
    return g;
  }
  // 长枪统一结构：枪身 + 握把 + 弹匣 + 枪托 + 枪管
  const L = s.len;
  g.add(box(4.4, 7, L * 0.5, bodyCol, 0, 2, -L * 0.08));            // 机匣
  g.add(box(3.6, 8.5, 5, BLACK, 0, -3.5, L * 0.12));                // 握把
  g.add(cyl(1.5, 1.5, L * 0.45, STEEL, 0, 3.6, -L * 0.42, 6).rotateX(Math.PI / 2)); // 枪管

  if (s.mag === 'curve') {
    const m = box(3.6, 12, 6, 0x7a6238, 0, -6.5, -L * 0.02);
    m.rotation.x = -0.35; g.add(m);                                  // AK 弯弹匣
  } else if (s.mag === 'str') {
    g.add(box(3.4, 13, 5.5, BLACK, 0, -7, -L * 0.02));              // 直弹匣
  } else if (s.mag === 'bull') {
    g.add(box(6, 10, 9, 0x35373b, 0, -5, -2));                      // P90 弹匣
  } else if (s.mag === 'box') {
    g.add(box(7, 8, 9, 0x35373b, 0, -5, -1));
  }
  if (s.drum) g.add(box(9, 10, 12, 0x3a3d42, 0, -6, -2));           // M249 弹箱
  if (s.tube) g.add(cyl(2, 2, L * 0.35, BLACK, 0, 0.5, -L * 0.35, 6).rotateX(Math.PI / 2));
  if (s.scope) { g.add(cyl(3, 3, 14, BLACK, 0, 8, -4, 8).rotateX(Math.PI / 2)); }
  if (s.carry) g.add(box(3, 3.5, 14, BLACK, 0, 7.2, -2));           // M4 提把
  if (s.wood) {
    g.add(box(4, 5.5, 13, WOOD, 0, 1, L * 0.22));                   // 木托
    g.add(box(4, 4.5, 10, WOOD2, 0, 4.6, -L * 0.24));               // 护木
  } else {
    g.add(box(4, 6, 12, DARK, 0, 0.5, L * 0.26));                   // 枪托
  }
  return g;
}

// 地面拾取枪（躺在雪地上）
export function buildPickup(id) {
  const g = buildGun(id);
  g.rotation.x = Math.PI / 2;       // 平放
  g.rotation.z = Math.PI / 6;
  const wrap = new THREE.Group();
  wrap.add(g);
  wrap.position.y = 3;
  return wrap;
}

// ============ 角色 ============
export function buildCharacter(team) {
  const ct = team === 'CT';
  const shirt = ct ? 0x33476e : 0x7d6a45;
  const pants = ct ? 0x27344f : 0x5b5038;
  const gear = ct ? 0x1d2637 : 0x4a4230;
  const skin = 0xc9a07a;

  const root = new THREE.Group();
  const body = new THREE.Group();          // 躯干（死亡时整体倾倒）
  root.add(body);

  // 腿（可摆动）
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-6, 34, 0); legR.position.set(6, 34, 0);
  legL.add(box(9, 34, 11, pants, 0, -17, 0));
  legR.add(box(9, 34, 11, pants, 0, -17, 0));
  legL.add(box(9, 5, 15, 0x1b1b1d, 0, -32, 2));   // 鞋
  legR.add(box(9, 5, 15, 0x1b1b1d, 0, -32, 2));
  root.add(legL, legR);

  // 躯干
  const torso = box(22, 30, 13, shirt, 0, 49, 0);
  body.add(torso);
  body.add(box(24, 10, 14, gear, 0, 56, 0));       // 战术背心上沿
  body.add(box(20, 8, 15, gear, 0, 42, 0));        // 弹挂
  // 手臂
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-13, 60, 0); armR.position.set(13, 60, 0);
  armL.add(box(7, 24, 8, shirt, 0, -11, 0));
  armR.add(box(7, 24, 8, shirt, 0, -11, 0));
  armL.add(box(6, 6, 7, skin, 0, -23, 0));
  armR.add(box(6, 6, 7, skin, 0, -23, 0));
  armL.rotation.x = -0.9; armR.rotation.x = -1.0;
  armR.rotation.y = -0.25;
  body.add(armL, armR);

  // 头 + 头盔
  const head = new THREE.Group();
  head.position.set(0, 74, 0);
  head.add(box(11, 11, 11, skin, 0, 0, 0));
  head.add(box(12.5, 6.5, 12.5, ct ? 0x243252 : 0x6b5a3c, 0, 3.4, 0));  // 头盔/头巾
  head.add(box(11.5, 3, 12, ct ? 0x1a2438 : 0x55462e, 0, 0.5, 0.4));
  body.add(head);

  // 手中枪
  const gun = buildGun('ak47');
  gun.position.set(6, 47, -16);
  gun.rotation.x = 0.05;
  body.add(gun);

  return { root, body, legL, legR, armL, armR, head, gun };
}
