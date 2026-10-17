// Bot AI：索敌 / 走位 / 开火 / 复活（与玩家共用 CS 速度与武器数据）
import * as THREE from 'three';
import { buildCharacter, buildGun } from './models.js';
import { WEAPONS } from './weapons.js';

const NAMES = ['Corey', 'Anna', 'Ridgway', 'Zane', 'Walter', 'Yahn', 'Zach', 'Wolf',
  'Steele', 'Ritch', 'Rick', 'Rex', 'Quintin', 'Perry', 'Oleg', 'Nikki', 'Mike', 'Louis',
  'Lucas', 'Kahn', 'Jon', 'Jim', 'Jerry', 'Ivan', 'Hector', 'Gunter', 'Franz', 'Etan',
  'Doug', 'Colin', 'Chad', 'Boris', 'Brett', 'Arno', 'Adam', 'Vince', 'Otto', 'Nate'];

const PRIMARIES = ['ak47', 'm4a1', 'awp', 'mp5navy', 'p90', 'sg552', 'aug', 'm249', 'xm1014', 'mac10', 'tmp', 'm3'];
const SKILL = [
  { react: 0.55, err: 0.085, errMove: 0.05, burst: [2, 4], pause: [0.55, 1.2], aimRate: 5.5, view: 2600 },
  { react: 0.32, err: 0.045, errMove: 0.028, burst: [3, 6], pause: [0.35, 0.9], aimRate: 9, view: 4000 },
  { react: 0.16, err: 0.022, errMove: 0.014, burst: [4, 8], pause: [0.2, 0.6], aimRate: 14, view: 9000 }
];

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Bot {
  constructor(name, team, skillIdx, id) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.skillIdx = skillIdx;
    this.skill = SKILL[skillIdx];
    this.hp = 100; this.armor = 0; this.helmet = false;
    this.alive = false;
    this.isBot = true;
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.radius = 13; this.height = 72; this.eyeH = 64;
    this.onGround = true; this.speedRatio = 0;

    this.model = buildCharacter(team);
    this.g = this.model.root;
    this.walkPhase = 0;

    this.weapon = 'ak47'; this.clip = 30;
    this.target = null; this.targetSince = 0; this.nextShot = 0;
    this.burstLeft = 0; this.burstPauseUntil = 0;
    this.patrol = new THREE.Vector3(); this.patrolAt = 0;
    this.strafeDir = 0; this.strafeUntil = 0;
    this.respawnAt = 0; this.deadAt = 0;
    this.reloadUntil = 0;
    this.kills = 0; this.deaths = 0; this.shots = 0; this.hits = 0; this.headshots = 0;
    this._nextPercept = 0;
  }

  spawn(sp, yawDeg, rand) {
    this.pos.set(sp.x, sp.y - 36, sp.z);       // 出生点原点 = 玩家中心，落脚点 = 地面
    this.yaw = THREE.MathUtils.degToRad(yawDeg) - Math.PI / 2;
    this.hp = 100; this.armor = 0;
    this.alive = true;
    this.deadAt = 0;
    this.target = null;
    this.g.visible = true;
    this.g.rotation.set(0, this.yaw, 0);
    this.g.position.copy(this.pos);
    const w = PRIMARIES[Math.floor(rand() * PRIMARIES.length)];
    this.weapon = w;
    this.clip = WEAPONS[w].mag;
    this.reloadUntil = 0;
    this.burstPauseUntil = performance.now() / 1000 + 0.4;
    this._placeGun();
  }

  _placeGun() {
    const old = this.model.gun;
    if (old && old.parent) old.parent.remove(old);
    const g = buildGun(this.weapon);
    g.position.set(6, 47, -16);
    g.rotation.set(0.05, 0, 0);
    this.model.body.add(g);
    this.model.gun = g;
  }

  die(now) {
    if (!this.alive) return;
    this.alive = false;
    this.deadAt = now;
    this.deaths++;
    this.respawnAt = now + 3;
    this.target = null;
  }

  damage(amount, attacker, head, now) {
    if (!this.alive) return;
    let dmg = amount;
    if (this.armor > 0) {
      const ab = dmg * 0.5;
      dmg -= ab;
      this.armor = Math.max(0, this.armor - ab * 0.5);
    }
    this.hp -= dmg;
    if (this.hp <= 0) this.die(now);
  }

  eye() { return _a.copy(this.pos).setY(this.pos.y + this.eyeH); }
  chest() { return _b.copy(this.pos).setY(this.pos.y + 46); }

  hitboxes(out) {
    const p = this.pos;
    out.head.min.set(p.x - 7, p.y + 65, p.z - 7);
    out.head.max.set(p.x + 7, p.y + 80, p.z + 7);
    out.body.min.set(p.x - 12, p.y + 18, p.z - 8);
    out.body.max.set(p.x + 12, p.y + 65, p.z + 8);
    return out;
  }

  update(dt, ctx) {
    const { map, now } = ctx;
    if (!this.alive) {
      const t = now - this.deadAt;
      if (t < 1.2) {
        this.g.rotation.x = -Math.min(Math.PI / 2, t * 3.2);
        this.g.position.y = this.pos.y - t * 4;
      } else if (t > 1.6) {
        this.g.visible = false;
      }
      if (now >= this.respawnAt) ctx.manager.respawn(this, ctx);
      return;
    }

    if (now >= this._nextPercept) {
      this._nextPercept = now + 0.12;
      this._perceive(ctx);
    }

    const def = WEAPONS[this.weapon];
    let wishX = 0, wishZ = 0;
    const tgt = this.target;
    const canSee = tgt && tgt.alive;

    if (canSee) {
      const aim = _v.copy(tgt.chest()).sub(this.eye());
      const dist = aim.length();
      const wantYaw = Math.atan2(-aim.x, -aim.z);
      let dYaw = wantYaw - this.yaw;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      const rate = this.skill.aimRate * dt;
      this.yaw += THREE.MathUtils.clamp(dYaw, -rate, rate);
      const wantPitch = Math.atan2(aim.y, Math.hypot(aim.x, aim.z));
      this.pitch += (THREE.MathUtils.clamp(wantPitch, -1.2, 1.2) - this.pitch) * Math.min(1, rate);

      // 移动策略：远拉近 / 近卡点或后撤 / 横向晃身
      if (now >= this.strafeUntil) {
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
        this.strafeUntil = now + 0.5 + Math.random() * 1.1;
      }
      const fwd = (dist > 900) ? 1 : (dist < 260 ? -0.55 : 0.15);
      const side = this.strafeDir * (dist < 1400 ? 0.9 : 0.35);
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const rx = -fz, rz = fx;
      wishX = fx * fwd + rx * side;
      wishZ = fz * fwd + rz * side;

      // 开火
      const aimed = Math.abs(dYaw) < 0.09 && Math.abs(wantPitch - this.pitch) < 0.1;
      if (aimed && now >= this.nextShot && now >= this.burstPauseUntil && now >= this.reloadUntil) {
        if (this.clip <= 0) {
          this.reloadUntil = now + (def.reload || 2.5);
        } else if (this.burstLeft <= 0) {
          const [b0, b1] = this.skill.burst;
          this.burstLeft = b0 + Math.floor(Math.random() * (b1 - b0 + 1));
        } else {
          this._shoot(ctx, tgt, dist);
          this.burstLeft--;
          if (this.burstLeft <= 0) {
            const [p0, p1] = this.skill.pause;
            this.burstPauseUntil = now + p0 + Math.random() * (p1 - p0);
          }
        }
      }
      if (this.reloadUntil && now >= this.reloadUntil) {
        this.reloadUntil = 0;
        this.clip = def.mag;
      }
    } else {
      // 巡逻：走向本队对面半场
      if (now >= this.patrolAt) {
        const b = map.bounds;
        const f = this.team === 'CT' ? (Math.random() * 0.45 + 0.25) : (Math.random() * 0.45 + 0.25);
        this.patrol.set(
          THREE.MathUtils.lerp(b.minX + 120, b.maxX - 120, Math.random()),
          this.pos.y,
          this.team === 'CT'
            ? THREE.MathUtils.lerp(b.minZ + 150, b.maxZ * 0.4, f)
            : THREE.MathUtils.lerp(b.maxZ - 150, b.minZ * 0.6 + b.maxZ * 0.4, f)
        );
        this.patrolAt = now + 2.5 + Math.random() * 3;
      }
      _v.copy(this.patrol).sub(this.pos);
      if (_v.lengthSq() > 100) {
        const wantYaw = Math.atan2(-_v.x, -_v.z);
        let dYaw = wantYaw - this.yaw;
        while (dYaw > Math.PI) dYaw -= Math.PI * 2;
        while (dYaw < -Math.PI) dYaw += Math.PI * 2;
        this.yaw += THREE.MathUtils.clamp(dYaw, -3.5 * dt, 3.5 * dt);
        wishX = -Math.sin(this.yaw); wishZ = -Math.cos(this.yaw);
        this.pitch += (0 - this.pitch) * Math.min(1, dt * 3);
      }
    }

    // 位移 + 碰撞
    const maxSpeed = (def ? def.speed : 250) * 0.92;
    const len = Math.hypot(wishX, wishZ);
    let vx = 0, vz = 0;
    if (len > 0.01) { vx = wishX / len * maxSpeed; vz = wishZ / len * maxSpeed; }
    this.speedRatio = Math.min(1, Math.hypot(vx, vz) / 250);
    const delta = _v.set(vx * dt, 0, vz * dt);
    const res = map.slide(this.pos, delta, this.radius, this.height);
    this.pos.copy(res.pos);

    // 重力 / 落地
    const gY = map.groundAt(this.pos.x, this.pos.z, this.pos.y + 22, 50);
    if (gY !== null) {
      this.pos.y = Math.max(this.pos.y - 700 * dt, gY);
      if (this.pos.y <= gY + 0.6) { this.pos.y = gY; this.onGround = true; }
    } else {
      this.onGround = false;
      this.pos.y -= 700 * dt;
    }

    // 模型同步
    this.g.position.copy(this.pos);
    this.g.rotation.y = this.yaw;
    if (this.speedRatio > 0.05) {
      this.walkPhase += dt * (6 + this.speedRatio * 9);
      const sw = Math.sin(this.walkPhase) * 0.7 * this.speedRatio;
      this.model.legL.rotation.x = sw;
      this.model.legR.rotation.x = -sw;
    } else {
      this.model.legL.rotation.x *= 0.82;
      this.model.legR.rotation.x *= 0.82;
    }
  }

  _perceive(ctx) {
    const { entities, map, now } = ctx;
    let best = null, bestD = this.skill.view;
    const eye = this.eye();
    for (const e of entities) {
      if (!e.alive || e.team === this.team || e === this) continue;
      const c = e.chest();
      const d = eye.distanceTo(c);
      if (d > bestD) continue;
      if (!map.losClear(eye, c)) continue;
      best = e; bestD = d;
    }
    if (best !== this.target) {
      this.target = best;
      if (best) this.targetSince = now;
      this.burstPauseUntil = Math.max(this.burstPauseUntil, now + (best ? this.skill.react : 0));
    }
  }

  _shoot(ctx, tgt, dist) {
    const def = WEAPONS[this.weapon];
    this.clip--;
    this.shots++;
    this.nextShot = performance.now() / 1000 + 60 / def.rpm;
    const origin = this.eye().clone();
    const dir = tgt.chest().sub(this.eye()).normalize().clone();
    let err = this.skill.err * (1 + dist / 1400) + this.skill.errMove * this.speedRatio + (def.spread || 0.001) * 2;
    if (!this.onGround) err += 0.05;
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * err;
    const right = _a.crossVectors(dir, UP).normalize();
    const up = _b.crossVectors(right, dir).normalize();
    dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    ctx.resolveShot(origin, dir, def, this);
    if (ctx.audio) ctx.audio.shot(this.weapon, ctx.playerEye ? origin.distanceTo(ctx.playerEye) : 0);
  }
}

export class BotManager {
  constructor(scene, rand = Math.random) {
    this.scene = scene;
    this.bots = [];
    this.rand = rand;
    this._id = 1;
  }

  fill(team, count, skillIdx, spawnList) {
    for (let i = 0; i < count; i++) {
      const name = NAMES[(this._id * 7 + i * 3) % NAMES.length];
      const b = new Bot('BOT ' + name, team, skillIdx, this._id++);
      this.bots.push(b);
      this.scene.add(b.g);
      const sp = spawnList[i % spawnList.length];
      b.spawn(sp.p, sp.yaw, this.rand);
    }
  }

  respawn(bot, ctx) {
    const list = ctx.map.spawns[bot.team];
    let best = list[0], bestScore = -1;
    for (const sp of list) {
      let near = 1e9;
      for (const e of ctx.entities) {
        if (e.alive && e.team !== bot.team) near = Math.min(near, e.pos.distanceTo(sp.p));
      }
      const score = near + this.rand() * 400;
      if (score > bestScore) { bestScore = score; best = sp; }
    }
    bot.spawn(best.p, best.yaw, this.rand);
  }

  update(dt, ctx) {
    ctx.manager = this;
    for (const b of this.bots) b.update(dt, ctx);
  }
}
