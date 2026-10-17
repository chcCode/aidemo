// 特效池：弹痕 / 曳光 / 血雾 / 撞击火花
import * as THREE from 'three';

function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(20,18,16,0.95)');
  g.addColorStop(0.55, 'rgba(40,36,32,0.75)');
  g.addColorStop(1, 'rgba(60,55,50,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 14; i++) {
    x.fillStyle = `rgba(10,8,6,${0.3 + Math.random() * 0.5})`;
    const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 22;
    x.beginPath(); x.arc(32 + Math.cos(a) * r, 32 + Math.sin(a) * r, 1 + Math.random() * 3, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    // 弹痕
    this.decals = [];
    this.decalI = 0;
    const dtex = blobTexture();
    const dgeo = new THREE.PlaneGeometry(5, 5);
    const dmat = new THREE.MeshBasicMaterial({
      map: dtex, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    });
    for (let i = 0; i < 80; i++) {
      const m = new THREE.Mesh(dgeo, dmat);
      m.visible = false; m.renderOrder = 3;
      scene.add(m); this.decals.push(m);
    }
    // 曳光
    this.tracers = [];
    const tgeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Line(tgeo, new THREE.LineBasicMaterial({
        color: 0xffe9a0, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      m.visible = false; m.frustumCulled = false;
      scene.add(m); this.tracers.push({ mesh: m, life: 0 });
    }
    // 粒子（血/火花通用）
    this.parts = [];
    const pgeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    for (let i = 0; i < 120; i++) {
      const m = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 }));
      m.visible = false;
      scene.add(m);
      this.parts.push({ mesh: m, vel: new THREE.Vector3(), life: 0, grav: 600 });
    }
  }

  _next(arr, key) {
    arr._i = ((arr._i || 0) + 1) % arr.length;
    return arr[arr._i];
  }

  decal(point, normal, size = 4) {
    const d = this.decals[this.decalI = (this.decalI + 1) % this.decals.length];
    d.visible = true;
    d.position.copy(point).addScaledVector(normal, 0.35);
    d.lookAt(point.clone().addScaledVector(normal, 1));
    d.scale.setScalar(size / 4 * (0.8 + Math.random() * 0.5));
    d.rotation.z = Math.random() * Math.PI;
  }

  tracer(from, to, dist) {
    if (dist < 80) return;
    const t = this.tracers.find(c => c.life <= 0) || this.tracers[0];
    const pos = t.mesh.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.mesh.visible = true;
    t.mesh.material.opacity = 0.85;
    t.life = 0.07;
  }

  _particle(point, color, n, speed, size, grav = 600) {
    for (let k = 0; k < n; k++) {
      const p = this.parts.find(x => x.life <= 0);
      if (!p) return;
      p.mesh.visible = true;
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(size);
      p.mesh.position.copy(point);
      p.vel.set(Math.random() - 0.5, Math.random() * 0.7, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      p.life = 0.35 + Math.random() * 0.3;
      p.grav = grav;
    }
  }
  blood(point, dir) {
    this._particle(point, 0xa01818, 10, 90, 1.6, 500);
    const p = point.clone().addScaledVector(dir, -2);
    this._particle(p, 0x701010, 5, 40, 1.2, 500);
  }
  spark(point, normal) {
    this._particle(point, 0xd8d0b8, 6, 60, 1.1, 700);
  }

  update(dt) {
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.mesh.material.opacity = Math.max(0, t.life / 0.07);
        if (t.life <= 0) t.mesh.visible = false;
      }
    }
    for (const p of this.parts) {
      if (p.life > 0) {
        p.life -= dt;
        p.vel.y -= p.grav * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.material.opacity = Math.max(0, p.life * 2.5);
        p.mesh.rotation.x += dt * 8; p.mesh.rotation.y += dt * 6;
        if (p.life <= 0) p.mesh.visible = false;
      }
    }
  }
}
