// 地图：加载原版 BSP 解析结果、渲染、碰撞、射线、视线
import * as THREE from 'three';
import { buildPickup } from './models.js';

const _o = new THREE.Vector3(), _d = new THREE.Vector3();

export class GameMap {
  constructor() {
    this.meshes = [];        // 可碰撞/可命中的静态网格
    this.spawns = { T: [], CT: [] };
    this.pickups = [];
    this.ray = new THREE.Raycaster();
    this.bounds = null;      // {minX,maxX,minZ,maxZ}（three 坐标）
    this.group = new THREE.Group();
  }

  async load(onProgress) {
    onProgress && onProgress(0.1, '解析 map.json …');
    const data = await (await fetch('data/map.json')).json();

    onProgress && onProgress(0.3, '加载贴图 …');
    const loader = new THREE.TextureLoader();
    const materials = [];
    for (const t of data.textures) {
      const tex = loader.load('data/' + t.file);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.flipY = false;                 // GoldSrc UV 约定
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      materials.push(new THREE.MeshLambertMaterial({ map: tex }));
    }

    onProgress && onProgress(0.6, '构建几何 …');
    let total = 0;
    for (const g of data.meshes) total += g.positions.length;
    const allPos = new Float32Array(total);
    const allUv = new Float32Array((total / 3) * 2);
    const allNor = new Float32Array(total);
    const groups = [];   // 按材质分组绘制
    let po = 0, uo = 0, no = 0;
    const starts = [];
    for (const g of data.meshes) {
      allPos.set(g.positions, po);
      allUv.set(g.uvs, uo);
      allNor.set(g.normals, no);
      const count = g.positions.length / 3;
      starts.push({ start: po / 3, count, mat: g.tex });
      po += g.positions.length; uo += g.uvs.length; no += g.normals.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(allPos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(allUv, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(allNor, 3));
    for (const s of starts) geo.addGroup(s.start, s.count, s.mat);
    geo.computeBoundingSphere();

    const world = new THREE.Mesh(geo, materials);
    world.name = 'world';
    this.group.add(world);
    this.meshes.push(world);

    // 出生点
    this.spawns.T = data.spawns.T.map(s => ({ p: new THREE.Vector3(...s.p), yaw: s.yaw }));
    this.spawns.CT = data.spawns.CT.map(s => ({ p: new THREE.Vector3(...s.p), yaw: s.yaw }));

    // 地面枪械
    onProgress && onProgress(0.8, '摆放枪械 …');
    for (const pk of data.pickups) {
      const mesh = buildPickup(pk.cls);
      mesh.position.set(pk.p[0], pk.p[1], pk.p[2]);
      mesh.rotation.y = THREE.MathUtils.degToRad(pk.yaw);
      this.group.add(mesh);
      this.pickups.push({ cls: pk.cls, pos: mesh.position.clone(), mesh, taken: false });
    }

    const w = data.world;
    this.bounds = { minX: w.mins[0], maxX: w.maxs[0], minZ: -w.maxs[1], maxZ: -w.mins[1], floorY: -255 };
    this.data = data;

    this._buildSky();

    // 灯光：原版为白天平光（无阴影）
    const hemi = new THREE.HemisphereLight(0xeaf2ff, 0xc9ccd2, 1.35);
    const dir = new THREE.DirectionalLight(0xfff4e2, 0.65);
    dir.position.set(200, 420, -140);
    const dir2 = new THREE.DirectionalLight(0xd8e6ff, 0.3);
    dir2.position.set(-300, 300, 300);
    this.group.add(hemi, dir, dir2);

    onProgress && onProgress(1, '完成');
    return this;
  }

  _buildSky() {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1024;
    const x = c.getContext('2d');
    const H = c.height, W = c.width, hz = H * 0.5;
    // 天空渐变
    const g = x.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#1b4a94');
    g.addColorStop(0.45, '#4b7fbe');
    g.addColorStop(0.8, '#8fb4d8');
    g.addColorStop(1, '#c9dceb');
    x.fillStyle = g; x.fillRect(0, 0, W, hz);
    // 地平线下：雪雾
    const g2 = x.createLinearGradient(0, hz, 0, H);
    g2.addColorStop(0, '#d8e6f1');
    g2.addColorStop(1, '#eef3f7');
    x.fillStyle = g2; x.fillRect(0, hz, W, H - hz);
    // 云（可平铺）
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) {
      const cx = rnd() * W, cy = hz * (0.18 + rnd() * 0.7);
      const rw = 60 + rnd() * 200, rh = 16 + rnd() * 44;
      const a = 0.10 + rnd() * 0.35;
      const cg = x.createRadialGradient(cx, cy, 0, cx, cy, rw);
      cg.addColorStop(0, `rgba(255,255,255,${a})`);
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = cg;
      x.save(); x.translate(cx, cy); x.scale(1, rh / rw); x.translate(-cx, -cy);
      x.beginPath(); x.arc(cx, cy, rw, 0, Math.PI * 2); x.fill(); x.restore();
      // 平铺副本
      x.save(); x.translate(cx - W, cy); x.scale(1, rh / rw); x.translate(-(cx - W), -cy);
      x.beginPath(); x.arc(cx - W, cy, rw, 0, Math.PI * 2); x.fillStyle = cg; x.fill(); x.restore();
    }
    // 雪山剪影（环绕地平线）
    x.fillStyle = '#dfe9f2';
    x.beginPath(); x.moveTo(0, hz + 8);
    for (let px = 0; px <= W; px += 16) {
      const t = px / W;
      const h = 40 + 70 * Math.abs(Math.sin(t * Math.PI * 6.3)) + 34 * Math.sin(t * Math.PI * 17.1) + 20 * Math.sin(t * Math.PI * 41.7 + 1.7);
      x.lineTo(px, hz - Math.max(8, h));
    }
    x.lineTo(W, hz + 8); x.closePath(); x.fill();
    // 山体阴影
    x.fillStyle = 'rgba(150,175,205,.55)';
    x.beginPath(); x.moveTo(0, hz + 8);
    for (let px = 0; px <= W; px += 16) {
      const t = px / W;
      const h = 40 + 70 * Math.abs(Math.sin(t * Math.PI * 6.3)) + 34 * Math.sin(t * Math.PI * 17.1) + 20 * Math.sin(t * Math.PI * 41.7 + 1.7);
      x.lineTo(px, hz - Math.max(8, h) * 0.55);
    }
    x.lineTo(W, hz + 8); x.closePath(); x.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(24000, 32, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false })
    );
    sky.name = 'sky';
    this.sky = sky;
    this.group.add(sky);
  }

  // ---------- 射线 ----------
  raycast(origin, dir, far = 100000) {
    _o.copy(origin); _d.copy(dir).normalize();
    this.ray.set(_o, _d);
    this.ray.far = far;
    const hits = this.ray.intersectObjects(this.meshes, false);
    if (!hits.length) return null;
    const h = hits[0];
    return { distance: h.distance, point: h.point, normal: h.face ? h.face.normal : null, object: h.object };
  }

  // 从 fromY 向下探测地面高度（x,z 固定）。返回最高命中 y，无命中返回 null
  groundAt(x, z, fromY, maxDist = 64) {
    _o.set(x, fromY, z); _d.set(0, -1, 0);
    this.ray.set(_o, _d);
    this.ray.far = maxDist;
    const hits = this.ray.intersectObjects(this.meshes, false);
    return hits.length ? hits[0].point.y : null;
  }

  losClear(from, to) {
    _d.copy(to).sub(from);
    const dist = _d.length();
    if (dist < 1) return true;
    _d.divideScalar(dist);
    const hit = this.raycast(from, _d, dist - 6);
    return !hit;
  }

  // ---------- 圆柱体滑动碰撞（半径 r，高 height，origin = 脚底中心）----------
  slide(pos, delta, r, height) {
    const out = pos.clone();
    const res = { blocked: false, wall: null };
    for (const axis of ['x', 'z']) {
      const d = delta[axis];
      if (d === 0) continue;
      const sign = Math.sign(d);
      let limit = Math.abs(d);
      const heights = [r * 0.6, height * 0.55, height - 6];
      const offs = axis === 'x' ? [0, -(r - 5), (r - 5)] : [0, -(r - 5), (r - 5)];
      for (const hy of heights) {
        if (hy > height - 1) continue;
        for (const off of offs) {
          _o.copy(out);
          if (axis === 'x') { _o.z += off; } else { _o.x += off; }
          _o.y += hy;
          _d.set(axis === 'x' ? sign : 0, 0, axis === 'z' ? sign : 0);
          const hit = this.raycast(_o, _d, limit + r);
          if (hit && hit.distance < limit + r) {
            const stop = hit.distance - r;
            if (stop < limit) { limit = stop; res.wall = hit; }
          }
        }
      }
      if (limit < Math.abs(d) - 1e-6) res.blocked = true;
      out[axis] += sign * Math.max(0, limit);
    }
    res.pos = out;
    return res;
  }

  // 是否在室内购买区（靠近本队出生端）
  inBuyZone(team, pos) {
    const list = this.spawns[team];
    for (const s of list) {
      if (pos.distanceToSquared(s.p) < 480 * 480) return true;
    }
    return false;
  }
}
