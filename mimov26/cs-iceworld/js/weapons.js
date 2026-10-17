// 武器系统：数据、开火、后坐力、切枪/换弹、视图模型
import * as THREE from 'three';
import { buildGun } from './models.js';

export const WEAPONS = {
  knife:   { name: '匕首', slot: 3, melee: true, speed: 250, price: 0, dmg: 40, range: 48, deploy: 0.45 },
  usp:     { name: 'USP', slot: 2, type: 'pistol', dmg: 34, rpm: 392, mag: 12, reserve: 100, speed: 250, price: 0, spread: 0.0012, moveSpread: 0.022, recoilPitch: 0.012, recoilYaw: 0.004, deploy: 0.5, reload: 2.2, len: 15 },
  glock18: { name: 'Glock-18', slot: 2, type: 'pistol', dmg: 26, rpm: 400, mag: 20, reserve: 120, speed: 250, price: 200, spread: 0.0016, moveSpread: 0.024, recoilPitch: 0.010, recoilYaw: 0.004, deploy: 0.5, reload: 2.2, len: 13 },
  deagle:  { name: 'Desert Eagle', slot: 2, type: 'pistol', dmg: 54, rpm: 267, mag: 7, reserve: 35, speed: 230, price: 650, spread: 0.0014, moveSpread: 0.03, recoilPitch: 0.026, recoilYaw: 0.008, deploy: 0.6, reload: 2.2, len: 16 },
  mp5navy: { name: 'MP5', slot: 1, type: 'smg', dmg: 26, rpm: 800, mag: 30, reserve: 120, speed: 230, price: 1500, auto: true, spread: 0.0018, moveSpread: 0.012, recoilPitch: 0.009, recoilYaw: 0.004, deploy: 0.7, reload: 2.7, len: 30 },
  tmp:     { name: 'TMP', slot: 1, type: 'smg', dmg: 26, rpm: 750, mag: 30, reserve: 120, speed: 230, price: 1250, auto: true, spread: 0.002, moveSpread: 0.012, recoilPitch: 0.009, recoilYaw: 0.004, deploy: 0.7, reload: 2.7, len: 26 },
  p90:     { name: 'P90', slot: 1, type: 'smg', dmg: 26, rpm: 857, mag: 50, reserve: 100, speed: 245, price: 2750, auto: true, spread: 0.0022, moveSpread: 0.011, recoilPitch: 0.008, recoilYaw: 0.004, deploy: 0.8, reload: 3.4, len: 30 },
  mac10:   { name: 'MAC-10', slot: 1, type: 'smg', dmg: 26, rpm: 800, mag: 30, reserve: 100, speed: 240, price: 1050, auto: true, spread: 0.0024, moveSpread: 0.012, recoilPitch: 0.009, recoilYaw: 0.005, deploy: 0.7, reload: 2.7, len: 24 },
  ak47:    { name: 'AK-47', slot: 1, type: 'rifle', dmg: 36, rpm: 600, mag: 30, reserve: 90, speed: 221, price: 2500, auto: true, spread: 0.0009, moveSpread: 0.045, recoilPitch: 0.019, recoilYaw: 0.007, deploy: 1.0, reload: 2.45, len: 42, hs: 4, armorPen: 0.775 },
  m4a1:    { name: 'M4A1', slot: 1, type: 'rifle', dmg: 33, rpm: 666, mag: 30, reserve: 90, speed: 225, price: 3100, auto: true, spread: 0.0008, moveSpread: 0.04, recoilPitch: 0.016, recoilYaw: 0.006, deploy: 1.0, reload: 3.05, len: 40, hs: 4, armorPen: 0.7 },
  sg552:   { name: 'SG 552', slot: 1, type: 'rifle', dmg: 33, rpm: 545, mag: 30, reserve: 90, speed: 215, price: 2000, auto: true, spread: 0.001, moveSpread: 0.045, recoilPitch: 0.018, recoilYaw: 0.007, deploy: 1.0, reload: 2.9, len: 38, hs: 4, armorPen: 0.72 },
  aug:     { name: 'AUG', slot: 1, type: 'rifle', dmg: 33, rpm: 666, mag: 30, reserve: 90, speed: 215, price: 3500, auto: true, spread: 0.0008, moveSpread: 0.04, recoilPitch: 0.015, recoilYaw: 0.006, deploy: 1.0, reload: 3.3, len: 40, scope: true, fovScope: 45, hs: 4, armorPen: 0.72 },
  awp:     { name: 'AWP', slot: 1, type: 'sniper', dmg: 115, rpm: 41, mag: 10, reserve: 30, speed: 200, price: 4750, spread: 0.0001, moveSpread: 0.09, recoilPitch: 0.03, recoilYaw: 0.01, deploy: 1.2, reload: 3.6, len: 56, scope: true, fovScope: 18, fovScope2: 8, hs: 4, armorPen: 0.975, bolt: true },
  m3:      { name: 'M3', slot: 1, type: 'shotgun', dmg: 14, pellets: 9, rpm: 130, mag: 8, reserve: 32, speed: 230, price: 1700, spread: 0.028, moveSpread: 0.01, recoilPitch: 0.05, recoilYaw: 0.01, deploy: 1.0, reload: 3.0, len: 40, hs: 2 },
  xm1014:  { name: 'XM1014', slot: 1, type: 'shotgun', dmg: 14, pellets: 8, rpm: 171, mag: 7, reserve: 32, speed: 230, price: 3000, auto: true, spread: 0.03, moveSpread: 0.01, recoilPitch: 0.045, recoilYaw: 0.01, deploy: 1.0, reload: 3.0, len: 44, hs: 2 },
  m249:    { name: 'M249', slot: 1, type: 'mg', dmg: 32, rpm: 750, mag: 100, reserve: 200, speed: 220, price: 5750, auto: true, spread: 0.0045, moveSpread: 0.06, recoilPitch: 0.011, recoilYaw: 0.005, deploy: 1.3, reload: 4.6, len: 46, hs: 4, armorPen: 0.8 }
};
for (const k in WEAPONS) if (!WEAPONS[k].hs) WEAPONS[k].hs = 4;

// 购买菜单
export const BUY_TABLE = [
  { key: '1', id: 'ak47', label: 'AK-47', teams: ['T'] },
  { key: '2', id: 'm4a1', label: 'M4A1', teams: ['CT'] },
  { key: '3', id: 'awp', label: 'AWP 狙击枪', teams: ['T', 'CT'] },
  { key: '4', id: 'sg552', label: 'SG 552', teams: ['T'] },
  { key: '5', id: 'aug', label: 'AUG', teams: ['CT'] },
  { key: '6', id: 'mp5navy', label: 'MP5', teams: ['T', 'CT'] },
  { key: '7', id: 'p90', label: 'P90', teams: ['T', 'CT'] },
  { key: '8', id: 'mac10', label: 'MAC-10', teams: ['T'] },
  { key: '9', id: 'tmp', label: 'TMP', teams: ['CT'] },
  { key: '0', id: 'm3', label: 'M3 霰弹枪', teams: ['T', 'CT'] },
  { key: '-', id: 'xm1014', label: 'XM1014', teams: ['T', 'CT'] },
  { key: '=', id: 'm249', label: 'M249', teams: ['T', 'CT'] },
  { key: 'F1', id: 'deagle', label: '沙漠之鹰', teams: ['T', 'CT'], price: 650 },
  { key: 'F2', id: 'kevlar', label: '凯夫拉防弹衣', teams: ['T', 'CT'], price: 650 },
  { key: 'F3', id: 'kevlarhelm', label: '防弹衣+头盔', teams: ['T', 'CT'], price: 1000 }
];

const _dir = new THREE.Vector3(), _o = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _right = new THREE.Vector3();

export class WeaponSystem {
  /**
   * onFire(origin, dir, def, shooter) -> {kind:'bot'|'world'|null, head?:bool, dist?:number}
   * onEvent(type, payload)
   */
  constructor(camera, audio, onFire, onEvent) {
    this.cam = camera;
    this.audio = audio;
    this.onFire = onFire;
    this.onEvent = onEvent;
    this.slots = { 1: null, 2: 'usp', 3: 'knife' };
    this.cur = null;
    this.id = 'usp';
    this.clip = 0; this.reserve = 0;
    this.punch = new THREE.Vector2();
    this.recoilIdx = 0;
    this.lastShot = -10;
    this.fireHeld = false;
    this.reloadEnd = 0;
    this.switchEnd = 0;
    this.deployEnd = 0;
    this.scoped = 0;               // 0/1/2
    this.baseFov = 90;

    // 视图模型
    this.vm = new THREE.Group();
    this.vm.position.set(0, 0, 0);
    camera.add(this.vm);
    this.gunGroup = null;
    this.muzzle = new THREE.Object3D();
    this.flash = this._makeFlash();
    this.muzzle.add(this.flash);
    this.vm.add(this.muzzle);
    this._vmKick = 0; this._vmKickPitch = 0;
    this._bob = 0; this._walkAmt = 0;
    this._reloadDip = 0; this._switchDip = 0;
    this._scopeHide = false;

    this.equip('usp', true);
  }

  _makeFlash() {
    const g = new THREE.Group();
    const mat1 = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), mat1);
    const p2 = p1.clone(); p2.rotation.y = Math.PI / 2;
    const p3 = new THREE.Mesh(new THREE.ConeGeometry(2.6, 9, 6, 1, true), mat1);
    p3.rotation.x = -Math.PI / 2; p3.position.z = -4;
    g.add(p1, p2, p3);
    g.visible = false;
    this._flashMats = mat1;
    this._flashParts = [p1, p2, p3];
    return g;
  }

  _buildVm(id) {
    if (this.gunGroup) this.vm.remove(this.gunGroup);
    const g = buildGun(id);
    g.scale.setScalar(0.42);
    const def = WEAPONS[id];
    g.position.set(6.4, -6.2, -11);
    g.rotation.set(0.06, -0.10, 0.02);
    this.vm.add(g);
    this.gunGroup = g;
    this.muzzle.position.set(6.4 - Math.sin(0.10) * (def.len * 0.5 * 0.42), -6.2 + 1.5, -11 - Math.cos(0.10) * (def.len * 0.5 * 0.42));
  }

  give(id, force = false) {
    const def = WEAPONS[id];
    if (!def) return false;
    if (def.slot === 2) {
      this.slots[2] = id;
      if (force) this.equip(id, true);
      return true;
    }
    if (def.slot === 3) { this.slots[3] = id; return true; }
    this.slots[1] = id;
    if (force || this.cur === null) this.equip(id, true);
    return true;
  }

  equip(id, instant = false) {
    const def = WEAPONS[id];
    if (!def) return;
    this.cur = def; this.id = id;
    this.clip = def.mag || 0;
    this.reserve = def.reserve || 0;
    this.scoped = 0;
    this.onEvent && this.onEvent('scope', 0);
    this._buildVm(id);
    if (!instant) {
      this.switchEnd = performance.now() / 1000 + def.deploy;
      this._switchDip = 1;
      this.audio.click(800, 0.25, 0.05);
    }
    this.onEvent && this.onEvent('weapon', { id, name: def.name, clip: this.clip, reserve: this.reserve });
  }

  switchSlot(n) {
    const id = this.slots[n];
    if (!id || id === this.id) return;
    this.equip(id);
  }
  cycle(dirn) {
    const order = [this.slots[1], this.slots[2], this.slots[3]].filter(Boolean);
    if (order.length < 2) return;
    let i = order.indexOf(this.id);
    i = (i + dirn + order.length) % order.length;
    this.equip(order[i]);
  }

  reload() {
    const def = this.cur;
    if (!def || def.melee || def.mag == null) return;
    if (this.clip >= def.mag || this.reserve <= 0) return;
    if (this.reloadEnd > performance.now() / 1000) return;
    this.reloadEnd = performance.now() / 1000 + def.reload;
    this._reloadDip = 1;
    this.scoped = 0; this.onEvent && this.onEvent('scope', 0);
    this.audio.reload(this.id);
    this.onEvent && this.onEvent('reload', { id: this.id, start: true });
  }

  toggleScope() {
    const def = this.cur;
    if (!def || !def.scope) return;
    if (def.fovScope2) this.scoped = (this.scoped + 1) % 3;
    else this.scoped = this.scoped ? 0 : 1;
    this.audio.click(this.scoped ? 600 : 900, 0.2, 0.03);
    this.onEvent && this.onEvent('scope', this.scoped);
  }

  get movingSpread() { return this._walkAmt; }

  update(dt, input, player) {
    const now = performance.now() / 1000;
    const def = this.cur;

    // 开镜 FOV
    const wantFov = this.scoped === 0 ? this.baseFov
      : (this.scoped === 2 && def.fovScope2 ? def.fovScope2 : def.fovScope);
    if (Math.abs(this.cam.fov - wantFov) > 0.05) {
      this.cam.fov += (wantFov - this.cam.fov) * Math.min(1, dt * 18);
      this.cam.updateProjectionMatrix();
    }
    this._scopeHide = this.scoped > 0;

    // 后坐力恢复（CS 风格 punch 回弹）
    this.punch.multiplyScalar(Math.max(0, 1 - dt * 7.5));
    if (this.punch.lengthSq() < 1e-8) this.punch.set(0, 0);

    // 移动/静止扩散恢复
    this._walkAmt += ((player ? player.speedRatio : 0) - this._walkAmt) * Math.min(1, dt * 10);
    if (now - this.lastShot > 0.35 && this.recoilIdx > 0) this.recoilIdx = 0;

    // 换弹完成
    if (this.reloadEnd && now >= this.reloadEnd) {
      this.reloadEnd = 0;
      const need = def.mag - this.clip;
      const take = Math.min(need, this.reserve);
      this.clip += take; this.reserve -= take;
      this.onEvent && this.onEvent('weapon', { id: this.id, name: def.name, clip: this.clip, reserve: this.reserve });
      this.onEvent && this.onEvent('reload', { id: this.id, start: false });
    }

    // 开火
    const canAct = now >= this.switchEnd && !this.reloadEnd;
    if (canAct && input.fire) {
      const interval = 60 / def.rpm;
      if (def.melee) {
        if (now - this.lastShot >= 0.4) this._melee(player);
      } else if (def.auto || input.fireClicked) {
        if (now - this.lastShot >= interval) this._shoot(player, now);
      }
    }
    if (!input.fire) this.fireHeld = false;

    // 视图模型动画
    const speed = player ? player.speedRatio : 0;
    this._bob += dt * (4 + speed * 9);
    const bobAmt = speed * (this.scoped ? 0 : 1);
    this._vmKick = Math.max(0, this._vmKick - dt * 9);
    this._vmKickPitch = Math.max(0, this._vmKickPitch - dt * 9);
    this._reloadDip = Math.max(0, this._reloadDip - dt / Math.max(0.3, (def.reload || 1) * 0.8));
    this._switchDip = Math.max(0, this._switchDip - dt / Math.max(0.2, def.deploy * 0.7));

    if (this.gunGroup) {
      const bobY = Math.sin(this._bob * 2) * 0.35 * bobAmt;
      const bobX = Math.cos(this._bob) * 0.4 * bobAmt;
      this.gunGroup.position.set(
        6.4 + bobX,
        -6.2 + bobY - this._reloadDip * 5.5 - this._switchDip * 10 + this._vmKick * -0.6,
        -11 + this._vmKick * 1.6
      );
      this.gunGroup.rotation.set(
        0.06 + this._vmKickPitch * 0.5 + this._reloadDip * 0.9,
        -0.10 - this._reloadDip * 0.4,
        0.02 + bobX * 0.05
      );
      this.gunGroup.visible = !this._scopeHide;
      // 更新枪口位置
      const def2 = WEAPONS[this.id];
      this.muzzle.position.set(
        this.gunGroup.position.x,
        this.gunGroup.position.y + 1.5,
        this.gunGroup.position.z - def2.len * 0.5 * 0.42
      );
    }
    // 闪光衰减
    if (this.flash.visible) {
      this._flashT -= dt;
      if (this._flashT <= 0) this.flash.visible = false;
    }
  }

  _spread(player, def) {
    let s = def.spread || 0.001;
    const moving = player ? player.speedRatio : 0;
    s += (def.moveSpread || 0.02) * moving;
    if (player && !player.onGround) s += 0.055;
    if (player && player.ducked) s *= 0.75;
    if (this.scoped) s *= 0.08;
    if (player && player.onGround && player.speedRatio < 0.05) s *= 0.6;   // 急停更准
    return s;
  }

  _shoot(player, now) {
    const def = this.cur;
    if (this.clip <= 0) {
      this.audio.dryfire();
      this.lastShot = now;
      if (this.reserve > 0 && !def.melee) this.reload();
      return;
    }
    this.clip--;
    this.lastShot = now;
    this.fireHeld = true;
    this.recoilIdx++;
    this.onEvent && this.onEvent('weapon', { id: this.id, name: def.name, clip: this.clip, reserve: this.reserve });

    // 后坐力 punch
    const idx = this.recoilIdx;
    const climb = Math.min(idx, 8);
    const pitch = climb * (def.recoilPitch || 0.014) + Math.max(0, idx - 8) * (def.recoilPitch || 0.014) * 0.35;
    const yaw = idx > 3 ? Math.sin(idx * 0.85 + 1.1) * (def.recoilYaw || 0.005) * Math.min(1, (idx - 3) / 6) : 0;
    this.punch.x += pitch; this.punch.y += yaw;

    this.cam.getWorldDirection(_dir);
    _o.copy(this.cam.getWorldPosition(new THREE.Vector3()));
    const origin = _o.clone();
    const spread = this._spread(player, def);
    const pellets = def.pellets || 1;
    const results = [];
    for (let i = 0; i < pellets; i++) {
      const d = _dir.clone();
      if (spread > 0) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spread;
        _right.crossVectors(d, _up).normalize();
        const up = new THREE.Vector3().crossVectors(_right, d).normalize();
        d.addScaledVector(_right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      }
      const res = this.onFire(origin, d, def, player);
      if (res) results.push(res);
    }

    this.audio.shot(this.id);
    this._vmKick = Math.min(1.2, this._vmKick + 0.7);
    this._vmKickPitch = Math.min(1, this._vmKickPitch + 0.55);
    this._flashT = 0.05;
    this.flash.visible = !this._scopeHide;
    this.flash.rotation.z = Math.random() * Math.PI;
    const fs = def.type === 'sniper' ? 1.5 : def.type === 'pistol' ? 0.7 : 1;
    this.flash.scale.setScalar(fs * (0.8 + Math.random() * 0.5));

    // 命中反馈
    const botHit = results.find(r => r.kind === 'bot');
    if (botHit) this.onEvent && this.onEvent('hitmarker', { head: !!botHit.head });
    this.onEvent && this.onEvent('shot', { origin, results, weapon: this.id, def });
  }

  _melee(player) {
    const def = this.cur;
    this.lastShot = performance.now() / 1000;
    this.cam.getWorldDirection(_dir);
    const origin = this.cam.getWorldPosition(new THREE.Vector3());
    const res = this.onFire(origin, _dir.clone(), { ...def, range: def.range }, player);
    this.audio.shot('knife');
    this._vmKick = 1; this._vmKickPitch = 0.7;
    if (res && res.kind === 'bot') this.onEvent && this.onEvent('hitmarker', { head: !!res.head, melee: true });
    this.onEvent && this.onEvent('shot', { origin, results: res ? [res] : [], weapon: 'knife', def });
  }
}
