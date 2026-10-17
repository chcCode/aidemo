// 主程序：状态机 / 输入 / 命中判定 / 死斗玩法（复活、金钱、胜负）
import * as THREE from 'three';
import { GameMap } from './map.js';
import { Player } from './player.js';
import { WeaponSystem, WEAPONS, BUY_TABLE } from './weapons.js';
import { BotManager } from './bots.js';
import { Effects } from './effects.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';

const REWARD = {
  ak47: 300, m4a1: 300, sg552: 300, aug: 300, mp5navy: 600, mac10: 600, tmp: 600,
  p90: 300, awp: 100, m249: 300, m3: 900, xm1014: 900, deagle: 300, usp: 300,
  glock18: 300, knife: 1500
};
const ROUND_TIME = 300;    // 5 分钟
const SCORE_LIMIT = 30;

const $ = id => document.getElementById(id);
const UP = new THREE.Vector3(0, 1, 0);

// ---------- 全局 ----------
let renderer, scene, camera, clock;
let map, hud, fx, audio, player, ws, bots;
let entities = [];
let mode = 'loading';            // loading | menu | playing | paused | ended
let timeLeft = ROUND_TIME;
let score = { CT: 0, T: 0 };
let respawnAt = 0;
let matchOpt = { name: 'Player', team: 'CT', size: 5, skill: 1, sens: 2.2 };
let buyOpen = false, sbOpen = false;
let spotTick = 0;
let promptAt = 0;

const input = {
  fwd: false, back: false, left: false, right: false,
  jump: false, duck: false, walk: false,
  fire: false, fireClicked: false, usePressed: false,
  dx: 0, dy: 0, sensScale: 0.0008
};

const _ray = new THREE.Raycaster();
const _boxHead = new THREE.Box3(), _boxBody = new THREE.Box3();
const _hit = new THREE.Vector3(), _hit2 = new THREE.Vector3();

// ---------- 启动 ----------
async function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  $('viewport').appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(90, innerWidth / innerHeight, 1, 60000);
  scene.add(camera);
  clock = new THREE.Clock();

  map = new GameMap();
  await map.load((p, label) => {
    $('loadfill').style.width = Math.round(p * 100) + '%';
    $('loadtxt').textContent = label || '加载地图 fy_iceworld …';
  });
  scene.add(map.group);

  hud = new HUD();
  hud.setMap(map);
  fx = new Effects(scene);
  audio = new AudioSys();
  ws = new WeaponSystem(camera, audio, resolveShot, onEvent);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  bindMenu();
  bindInput();
  $('loading').classList.add('hidden');
  $('startscreen').classList.remove('hidden');
  mode = 'menu';
  renderer.setAnimationLoop(tick);

  // 调试钩子（测试截图用）
  window.__dbg = () => ({
    mode,
    locked: document.pointerLockElement === renderer.domElement,
    pos: player ? [+player.pos.x.toFixed(1), +player.pos.y.toFixed(1), +player.pos.z.toFixed(1)] : null,
    yaw: player ? +player.yaw.toFixed(3) : null,
    hp: player ? player.hp : null,
    ws: ws ? { id: ws.id, clip: ws.clip, reserve: ws.reserve, fire: input.fire, clicked: input.fireClicked, shots: player ? player.shots : -1, hits: player ? player.hits : -1 } : null,
    taken: map ? map.pickups.filter(p => p.taken).map(p => p.cls) : [],
    score,
    bots: bots ? bots.bots.map(b => ({
      n: b.name, t: b.team, a: b.alive, hp: b.hp,
      p: [+b.pos.x.toFixed(0), +b.pos.y.toFixed(0), +b.pos.z.toFixed(0)],
      w: b.weapon, k: b.kills
    })) : []
  });
  window.__look = (yaw, pitch) => { if (player) { player.yaw = yaw; player.pitch = pitch; } };
  window.__tp = (x, y, z) => { if (player) { player.pos.set(x, y, z); player.vel.set(0, 0, 0); } };
  window.__map = map;
  window.__THREE = THREE;
  window.__end = endMatch;
}

// ---------- 菜单 ----------
function bindMenu() {
  $('nameInput').value = matchOpt.name;
  const seg = (host, key, parse) => {
    host.querySelectorAll('button').forEach(b => b.onclick = () => {
      host.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      matchOpt[key] = parse ? parse(b.dataset.v) : b.dataset.v;
    });
  };
  seg($('teamPick'), 'team');
  seg($('sizePick'), 'size', Number);
  seg($('diffPick'), 'skill', Number);
  $('sensInput').oninput = e => {
    matchOpt.sens = Number(e.target.value) / 15.9;
    $('sensVal').textContent = matchOpt.sens.toFixed(2);
  };
  $('startBtn').onclick = startMatch;
  $('againBtn').onclick = startMatch;
  $('pausehint').onclick = () => { if (mode === 'paused') renderer.domElement.requestPointerLock(); };
}

// ---------- 比赛初始化 ----------
function startMatch() {
  matchOpt.name = $('nameInput').value.trim() || 'Player';
  audio.init();
  resetMatch();
  $('startscreen').classList.add('hidden');
  $('endscreen').classList.add('hidden');
  hud.show(true);
  mode = 'playing';
  renderer.domElement.requestPointerLock();
  audio.beep(true);
}

function resetMatch() {
  if (bots) for (const b of bots.bots) scene.remove(b.g);
  score = { CT: 0, T: 0 };
  timeLeft = ROUND_TIME;
  buyOpen = false; sbOpen = false;
  respawnAt = 0;
  promptAt = 0;

  player = new Player(camera, map, audio);
  player.name = matchOpt.name;
  player.team = matchOpt.team;
  player.onDamage = (dmg, fromPos) => hud.damageFrom(fromPos, player);
  input.sensScale = matchOpt.sens * 0.022 * Math.PI / 180;

  giveLoadout();

  bots = new BotManager(scene);
  const myTeam = matchOpt.team;
  const foeTeam = myTeam === 'CT' ? 'T' : 'CT';
  bots.fill(foeTeam, matchOpt.size, matchOpt.skill, map.spawns[foeTeam]);
  bots.fill(myTeam, matchOpt.size - 1, matchOpt.skill, map.spawns[myTeam]);
  entities = [player, ...bots.bots];

  spawnPlayer(true);
}

function giveLoadout() {
  const pistol = player.team === 'CT' ? 'usp' : 'glock18';
  ws.slots = { 1: null, 2: pistol, 3: 'knife' };
  ws.equip(pistol, true);
}

function spawnPlayer(first) {
  const list = map.spawns[player.team];
  let best = list[0], bestScore = -1;
  for (const sp of list) {
    let near = 1e9;
    for (const e of entities) if (e.alive && e !== player && e.team !== player.team) near = Math.min(near, e.pos.distanceTo(sp.p));
    const s = near + Math.random() * 400;
    if (s > bestScore) { bestScore = s; best = sp; }
  }
  player.spawn(best.p, best.yaw);
  if (!first) giveLoadout();
}

// ---------- 输入 ----------
function bindInput() {
  addEventListener('keydown', e => {
    if (mode !== 'playing' && mode !== 'paused') return;
    const k = e.code;
    if (k === 'Tab') { e.preventDefault(); sbOpen = true; return; }
    if (k === 'KeyB') { toggleBuy(); return; }
    if (buyOpen) {
      if (k === 'Escape') { toggleBuy(false); return; }
      const item = BUY_TABLE.find(b => b.key === e.key);
      if (item) { e.preventDefault(); tryBuy(item); return; }
    }
    switch (k) {
      case 'KeyW': input.fwd = true; break;
      case 'KeyS': input.back = true; break;
      case 'KeyA': input.left = true; break;
      case 'KeyD': input.right = true; break;
      case 'Space': input.jump = true; e.preventDefault(); break;
      case 'ControlLeft': case 'ControlRight': case 'KeyC': input.duck = true; break;
      case 'ShiftLeft': case 'ShiftRight': input.walk = true; break;
      case 'KeyR': ws.reload(); break;
      case 'KeyF': input.usePressed = true; break;
      case 'Digit1': ws.switchSlot(1); break;
      case 'Digit2': ws.switchSlot(2); break;
      case 'Digit3': ws.switchSlot(3); break;
      case 'KeyQ': ws.cycle(-1); break;
    }
  });
  addEventListener('keyup', e => {
    if (e.code === 'Tab') { e.preventDefault(); sbOpen = false; return; }
    switch (e.code) {
      case 'KeyW': input.fwd = false; break;
      case 'KeyS': input.back = false; break;
      case 'KeyA': input.left = false; break;
      case 'KeyD': input.right = false; break;
      case 'Space': input.jump = false; break;
      case 'ControlLeft': case 'ControlRight': case 'KeyC': input.duck = false; break;
      case 'ShiftLeft': case 'ShiftRight': input.walk = false; break;
    }
  });
  addEventListener('mousedown', e => {
    if (mode === 'paused') { renderer.domElement.requestPointerLock(); return; }
    if (mode !== 'playing') return;
    if (document.pointerLockElement !== renderer.domElement) { renderer.domElement.requestPointerLock(); return; }
    if (e.button === 0) { input.fire = true; input.fireClicked = true; }
    if (e.button === 2) ws.toggleScope();
  });
  addEventListener('mouseup', e => { if (e.button === 0) input.fire = false; });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('wheel', e => {
    if (mode === 'playing' && document.pointerLockElement === renderer.domElement)
      ws.cycle(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });
  addEventListener('mousemove', e => {
    if (document.pointerLockElement === renderer.domElement) {
      input.dx += e.movementX;
      input.dy += e.movementY;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== renderer.domElement) {
      if (mode === 'playing') {
        mode = 'paused';
        $('pausehint').classList.remove('hidden');
        hud.show(false);
        hud.scoreboard(false);
        toggleBuy(false);
        input.fire = false;
      }
    } else if (mode === 'paused') {
      mode = 'playing';
      $('pausehint').classList.add('hidden');
      hud.show(true);
    }
  });
}

function toggleBuy(force) {
  const want = force !== undefined ? force : !buyOpen;
  if (want && !map.inBuyZone(player.team, player.pos)) {
    hud.centerMsg('需在己方出生点购买', 'warn');
    audio.click();
    return;
  }
  buyOpen = want;
  refreshBuy();
}
function refreshBuy() {
  hud.buyMenu(buyOpen, {
    team: player.team, money: player.money,
    hasPrimary: !!ws.slots[1]
  });
}
function tryBuy(item) {
  const price = item.price !== undefined ? item.price : (WEAPONS[item.id] ? WEAPONS[item.id].price : 0);
  if (player.money < price) { audio.dryfire(); hud.centerMsg('金钱不足', 'warn'); return; }
  if (item.id === 'kevlar' || item.id === 'kevlarhelm') {
    player.armor = 100;
    if (item.id === 'kevlarhelm') player.helmet = true;
  } else {
    const def = WEAPONS[item.id];
    ws.give(item.id);
    ws.equip(item.id);
  }
  player.money -= price;
  audio.buy();
  hud.centerMsg('已购买 ' + item.label, 'ok');
  refreshBuy();
}

// ---------- 命中判定（玩家 / Bot 共用）----------
function resolveShot(origin, dir, def, shooter) {
  const now = performance.now() / 1000;
  const range = def.melee ? def.range : 12000;
  _ray.set(origin.clone(), dir.clone());
  _ray.far = range;
  _ray.near = 0;

  const wHits = _ray.intersectObjects(map.meshes, false);
  const wDist = wHits.length ? wHits[0].distance : Infinity;
  let wPoint = wHits.length ? wHits[0].point.clone() : null;

  let best = null, bestDist = Infinity, bestHead = false;
  let bestPoint = null;
  for (const e of entities) {
    if (!e.alive || e === shooter || e.team === shooter.team) continue;
    e.hitboxes({ head: _boxHead, body: _boxBody });
    const p1 = _ray.ray.intersectBox(_boxHead, _hit);
    const p2 = _ray.ray.intersectBox(_boxBody, _hit2);
    if (p1) {
      const d = p1.distanceTo(origin);
      if (d < bestDist && d <= wDist) { best = e; bestDist = d; bestHead = true; bestPoint = p1.clone(); }
    }
    if (p2) {
      const d = p2.distanceTo(origin);
      if (d < bestDist && d <= wDist) { best = e; bestDist = d; bestHead = false; bestPoint = p2.clone(); }
    }
  }

  shooter.shots++;
  const endPoint = best ? bestPoint : wPoint;
  if (endPoint) fx.tracer(origin, endPoint, origin.distanceTo(endPoint));

  if (best) {
    let dmg = def.dmg;
    if (bestHead) dmg *= def.hs || 4;
    const fall = THREE.MathUtils.clamp(1 - Math.max(0, bestDist - 500) / 2600, 0.6, 1);
    dmg = Math.round(dmg * fall);
    best.damage(dmg, shooter, bestHead, now);
    shooter.hits++;
    if (bestHead) shooter.headshots++;
    fx.blood(bestPoint, dir);
    audio.hit && shooter === player && audio.hit(bestHead);
    if (!best.alive) onKill(shooter, best, def, bestHead);
    else if (best === player) hud.damageFrom(origin, player);
    return { kind: 'bot', head: bestHead, dist: bestDist };
  }
  if (wHits.length) {
    const h = wHits[0];
    fx.decal(h.point, h.face ? h.face.normal : UP);
    fx.spark(h.point);
    return { kind: 'world', dist: h.distance };
  }
  return { kind: null };
}

function onKill(killer, victim, def, hs) {
  const now = performance.now() / 1000;
  if (killer !== victim) {
    killer.kills++;
    score[killer.team]++;
    const rw = REWARD[def.id] || 300;
    if (killer === player) {
      player.money = Math.min(16000, player.money + rw);
      hud.centerMsg(hs ? `爆头击杀 +$${rw}` : `击杀 +$${rw}`, 'ok');
    }
    hud.killFeed(killer.name, killer.team, victim.name, victim.team, def.name, hs);
  } else {
    hud.killFeed(victim.name, victim.team, victim.name, victim.team, '坠落', false);
  }
  if (victim === player) {
    hud.death(true, killer === player ? '' : killer.name, 3);
    respawnAt = now + 3;
  } else {
    audio.death();
  }
  checkWin();
}

function checkWin() {
  if (mode !== 'playing') return;
  if (score.CT >= SCORE_LIMIT || score.T >= SCORE_LIMIT) endMatch();
}

function endMatch() {
  mode = 'ended';
  hud.show(false);
  hud.scoreboard(false);
  toggleBuy(false);
  hud.death(false);
  hud.vignette(false);
  document.exitPointerLock();
  const foe = player.team === 'CT' ? 'T' : 'CT';
  const won = score[player.team] > score[foe];
  const draw = score.CT === score.T;
  hud.end(true, player, draw ? '平局' : won ? '胜利！' : '失败');
  $('pausehint').classList.add('hidden');
}

// ---------- 拾取 ----------
function checkPickups() {
  if (!player.alive) return;
  const now = performance.now() / 1000;
  let near = null, nearD = 50;
  for (const pk of map.pickups) {
    if (pk.taken) continue;
    const d = Math.hypot(pk.pos.x - player.pos.x, pk.pos.z - player.pos.z);
    const dy = Math.abs(pk.pos.y - player.pos.y);
    if (d < nearD && dy < 70) { near = pk; nearD = d; }
  }
  if (!near) return;
  const def = WEAPONS[near.cls];
  if (!ws.slots[def.slot]) {
    takeGun(near);
  } else if (ws.slots[def.slot] !== near.cls) {
    if (input.usePressed) takeGun(near);
    else if (now > promptAt) {
      promptAt = now + 1.2;
      hud.centerMsg(`F 换取 ${def.name}`, '');
    }
  }
}

function takeGun(pk) {
  const def = WEAPONS[pk.cls];
  pk.taken = true;
  pk.mesh.visible = false;
  ws.give(pk.cls);
  ws.equip(pk.cls);
  audio.pickup();
  hud.centerMsg('取得 ' + def.name, 'ok');
}

// ---------- 雷达暴露 ----------
function updateSpotted(now) {
  if (now < spotTick) return;
  spotTick = now + 0.15;
  if (!player.alive) return;
  const eye = player.eye().clone();
  for (const e of entities) {
    if (e === player || !e.alive || e.team === player.team) continue;
    const c = e.chest().clone();
    if (eye.distanceTo(c) < 3200 && map.losClear(eye, c)) e._spottedAt = now;
    e._spotted = !!(e._spottedAt && now - e._spottedAt < 3);
  }
}

// ---------- 帧循环 ----------
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now() / 1000;

  if (mode === 'playing') {
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; endMatch(); return; }

    const def = WEAPONS[ws.id];
    const spd = { speed: def.speed * (ws.scoped === 2 ? 0.35 : ws.scoped === 1 ? 0.55 : 1) };

    if (player.alive) {
      player.update(dt, input, spd);
      player.applyPunch(ws.punch);
      ws.update(dt, input, player);
      checkPickups();
    } else {
      player.cam.position.set(player.pos.x, player.pos.y + 30, player.pos.z);
      player.cam.rotation.order = 'YXZ';
      player.cam.rotation.y = player.yaw;
      player.cam.rotation.x = -0.15;
      if (now >= respawnAt) {
        spawnPlayer(false);
        hud.death(false);
        audio.beep(true);
      } else {
        hud.el.dsWait.textContent = Math.ceil(respawnAt - now) + ' 秒后重生';
      }
    }
    input.fireClicked = false;
    input.usePressed = false;

    bots.update(dt, {
      map, now, entities, audio, up: UP,
      playerEye: player.eye().clone(),
      resolveShot
    });
    updateSpotted(now);
    fx.update(dt);

    hud.update({
      hp: player.hp, armor: player.armor, money: player.money,
      timeText: fmtTime(timeLeft), ctScore: score.CT, tScore: score.T,
      weapon: {
        name: def.name, clip: ws.clip, reserve: ws.reserve,
        melee: !!def.melee, reloading: ws.reloadEnd > now
      },
      spread: player.alive ? ws._spread(player, def) : 0.01
    });
    hud.drawRadar(player, entities);
    hud.scoreboard(sbOpen, entities, player, score);
    if (buyOpen) refreshBuy();
    hud.el.crosshair.classList.toggle('hidden', !!ws.scoped);
    hud.vignette(player.hp <= 40 && player.alive);
  }

  renderer.render(scene, camera);
}

function fmtTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + String(r).padStart(2, '0');
}

// ---------- WeaponSystem 回调 ----------
function onEvent(ev, data) {
  if (ev === 'hitmarker') hud.hitmark(data.head);
  else if (ev === 'scope') hud.scope(data);
}

init();
