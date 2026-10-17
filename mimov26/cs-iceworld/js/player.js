// 玩家控制器：GoldSrc 风格移动（摩擦/加速/空中加速/蹲/走/跳）+ 伤害
import * as THREE from 'three';

const GRAVITY = 800;
const JUMP_VEL = 268;
const FRICTION = 4;
const ACCEL = 5.5;
const AIR_ACCEL = 10;
const AIR_WISH_SPEED = 30;
const STOP_SPEED = 80;

const _wish = new THREE.Vector3(), _v = new THREE.Vector3();

export class Player {
  constructor(camera, map, audio) {
    this.cam = camera;
    this.map = map;
    this.audio = audio;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.hp = 100; this.armor = 0; this.helmet = false;
    this.alive = true;
    this.isBot = false;
    this.team = 'CT';
    this.name = 'Player';
    this.money = 800;
    this.kills = 0; this.deaths = 0; this.shots = 0; this.hits = 0; this.headshots = 0;
    this.radius = 13; this.height = 72; this.eyeH = 64;
    this.duckH = 54; this.duckEye = 46;
    this.ducked = false;
    this.onGround = true;
    this.speedRatio = 0;
    this.stepDist = 0;
    this.onDamage = null;    // (amount, fromPos, attacker)
    this.onDeath = null;     // (attacker)
    this.punch = new THREE.Vector2();   // 由武器系统叠加到相机
    this.spawnProtect = 0;
  }

  spawn(sp, yawDeg) {
    this.pos.set(sp.x, sp.y - 36, sp.z);
    this.vel.set(0, 0, 0);
    this.yaw = THREE.MathUtils.degToRad(yawDeg) - Math.PI / 2;
    this.pitch = 0;
    this.hp = 100;
    this.alive = true;
    this.ducked = false;
    this.onGround = true;
    this.spawnProtect = performance.now() / 1000 + 0.3;
  }

  eye() { return _v.copy(this.pos).setY(this.pos.y + (this.ducked ? this.duckEye : this.eyeH)); }
  chest() { return _v.copy(this.pos).setY(this.pos.y + 46); }

  hitboxes(out) {
    const p = this.pos;
    const h = this.ducked ? this.duckH : this.height;
    out.head.min.set(p.x - 7, p.y + h - 14, p.z - 7);
    out.head.max.set(p.x + 7, p.y + h + 1, p.z + 7);
    out.body.min.set(p.x - 12, p.y + 10, p.z - 8);
    out.body.max.set(p.x + 12, p.y + h - 14, p.z + 8);
    return out;
  }

  update(dt, input, weaponDef) {
    if (!this.alive) return;
    const map = this.map;

    // ---- 望向 ----
    this.yaw -= input.dx * input.sensScale;
    this.pitch -= input.dy * input.sensScale;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    input.dx = 0; input.dy = 0;

    // ---- 蹲 ----
    const wantDuck = input.duck;
    if (wantDuck !== this.ducked) {
      if (!wantDuck) {
        // 站起检查头顶
        const gy = map.groundAt(this.pos.x, this.pos.z, this.pos.y + this.duckH + 4, 20);
        if (gy === null || gy < this.pos.y + this.duckH + 2) this.ducked = true;   // 头顶有挡，保持蹲
        else this.ducked = false;
      } else this.ducked = true;
    }

    // ---- 速度参数（CS1.6 maxspeed）----
    const wSpeed = (weaponDef && weaponDef.speed) || 250;
    let maxSpeed = wSpeed;
    if (this.ducked) maxSpeed *= 0.34;
    if (input.walk && !this.ducked) maxSpeed *= 0.52;

    // ---- 输入方向 ----
    let fwd = 0, side = 0;
    if (input.fwd) fwd += 1;
    if (input.back) fwd -= 1;
    if (input.left) side -= 1;
    if (input.right) side += 1;
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    _wish.set(-sinY * fwd + cosY * side, 0, -cosY * fwd - sinY * side);
    if (_wish.lengthSq() > 0) _wish.normalize();

    const wishSpeed = (fwd || side) ? maxSpeed : 0;

    // ---- 摩擦（地面）----
    if (this.onGround) {
      const speed = Math.hypot(this.vel.x, this.vel.z);
      if (speed > 0) {
        const control = Math.max(speed, STOP_SPEED);
        const drop = control * FRICTION * dt;
        const newSpeed = Math.max(0, speed - drop) / speed;
        this.vel.x *= newSpeed; this.vel.z *= newSpeed;
      }
    }

    // ---- 加速 ----
    if (wishSpeed > 0) {
      const cur = this.vel.x * _wish.x + this.vel.z * _wish.z;
      let add = wishSpeed - cur;
      if (add > 0) {
        let accelSpeed;
        if (this.onGround) {
          accelSpeed = Math.min(ACCEL * wishSpeed * dt, add);
        } else {
          const airWish = Math.min(wishSpeed, AIR_WISH_SPEED);
          const curAir = this.vel.x * _wish.x + this.vel.z * _wish.z;
          const addAir = airWish - curAir;
          if (addAir > 0) accelSpeed = Math.min(AIR_ACCEL * airWish * dt, addAir);
          else accelSpeed = 0;
        }
        this.vel.x += accelSpeed * _wish.x;
        this.vel.z += accelSpeed * _wish.z;
      }
    }

    // ---- 跳跃（按住连跳，同 CS）----
    if (input.jump && this.onGround) {
      this.vel.y = JUMP_VEL;
      this.onGround = false;
      this.audio && this.audio.step(0.1);
    }

    // ---- 重力 ----
    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -1200) this.vel.y = -1200;

    // ---- 水平移动（碰撞滑动）----
    const delta = _v.set(this.vel.x * dt, 0, this.vel.z * dt);
    const h = this.ducked ? this.duckH : this.height;
    const res = map.slide(this.pos, delta, this.radius, h);
    this.pos.copy(res.pos);
    if (res.blocked) { /* 滑墙已处理 */ }

    // ---- 垂直 / 地面 ----
    const newY = this.pos.y + this.vel.y * dt;
    const probeFrom = Math.max(this.pos.y, newY) + (this.onGround ? 20 : 2);
    const gY = map.groundAt(this.pos.x, this.pos.z, probeFrom, Math.abs(this.vel.y * dt) + 26);
    if (gY !== null && newY <= gY + 1 && (this.pos.y - gY) < 26) {
      this.pos.y = gY;
      this.vel.y = 0;
      this.onGround = true;
    } else if (gY !== null && Math.abs(newY - gY) < 0.8) {
      this.pos.y = gY;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.pos.y = newY;
      this.onGround = false;
    }
    if (this.pos.y < -2000) { this.hp = 0; this.alive = false; }   // 兜底防掉出地图

    // ---- 速度比（扩散用）----
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.speedRatio = Math.min(1.2, hs / 250);

    // ---- 脚步 ----
    if (this.onGround && hs > 40) {
      this.stepDist += hs * dt;
      const stride = this.ducked ? 100 : (input.walk ? 120 : 88);
      if (this.stepDist > stride) {
        this.stepDist = 0;
        this.audio && this.audio.step(this.ducked || input.walk ? 0.06 : 0.14);
      }
    } else this.stepDist = 70;

    // ---- 相机同步 ----
    this.cam.position.set(this.pos.x, this.pos.y + (this.ducked ? this.duckEye : this.eyeH), this.pos.z);
    this.cam.rotation.order = 'YXZ';
    this.cam.rotation.y = this.yaw;
    this.cam.rotation.x = this.pitch;
  }

  applyPunch(punch) {
    // 由 main 在相机设置后叠加
    this.cam.rotation.x += punch.x;
    this.cam.rotation.y += punch.y;
    this.cam.rotation.z = punch.y * 0.2;
  }

  damage(amount, attacker, head, now) {
    if (!this.alive) return;
    let dmg = amount;
    if (this.armor > 0) {
      const absorbed = dmg * 0.5;
      dmg -= absorbed;
      this.armor = Math.max(0, this.armor - absorbed * 0.5);
    }
    this.hp -= dmg;
    this.audio && this.audio.hurt();
    this.onDamage && this.onDamage(dmg, attacker && attacker.pos ? attacker.pos : this.pos, attacker, head);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.deaths++;
      this.audio && this.audio.death();
      this.onDeath && this.onDeath(attacker);
    }
  }
}
