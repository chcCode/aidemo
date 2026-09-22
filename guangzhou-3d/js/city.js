/**
 * 城市基底：地面、珠江、道路、公园、通用建筑群。
 * 挂到 window.GZCity，供 main.js 调用。
 */
window.GZCity = (function () {
  'use strict';

  /** 种子伪随机数（保证城市布局每次加载一致）。 */
  function makeRandom(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /** 珠江中心线控制点（x, z），自西向东。 */
  var RIVER_POINTS = [
    [-1600, 280], [-1100, 170], [-700, 110], [-300, 60],
    [0, 40], [300, 90], [700, 160], [1100, 140], [1600, 220]
  ];
  var RIVER_WIDTH = 150;

  function riverCurve() {
    return new THREE.CatmullRomCurve3(
      RIVER_POINTS.map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); })
    );
  }

  /** 预采样河道点，用于建筑避让。 */
  var riverSamples = null;
  function distToRiver(x, z) {
    if (!riverSamples) riverSamples = riverCurve().getPoints(150);
    var min = Infinity;
    for (var i = 0; i < riverSamples.length; i++) {
      var dx = riverSamples[i].x - x;
      var dz = riverSamples[i].z - z;
      var d = dx * dx + dz * dz;
      if (d < min) min = d;
    }
    return Math.sqrt(min);
  }

  /** 水面纹理（横向波纹）。 */
  function makeWaterTexture() {
    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2e6b7a';
    ctx.fillRect(0, 0, 256, 128);
    var rand = makeRandom(42);
    for (var i = 0; i < 90; i++) {
      var y = rand() * 128;
      var w = 20 + rand() * 80;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.04 + rand() * 0.1) + ')';
      ctx.lineWidth = 1 + rand() * 1.5;
      ctx.beginPath();
      ctx.moveTo(rand() * 256, y);
      ctx.lineTo(rand() * 256 + w, y);
      ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /** 珠江带状几何。 */
  function buildRiver(scene) {
    var curve = riverCurve();
    var segments = 220;
    var positions = [];
    var uvs = [];
    var indices = [];
    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      var p = curve.getPoint(t);
      var tan = curve.getTangent(t);
      var nx = -tan.z;
      var nz = tan.x;
      var len = Math.sqrt(nx * nx + nz * nz) || 1;
      nx /= len;
      nz /= len;
      positions.push(p.x + nx * RIVER_WIDTH / 2, 0.6, p.z + nz * RIVER_WIDTH / 2);
      positions.push(p.x - nx * RIVER_WIDTH / 2, 0.6, p.z - nz * RIVER_WIDTH / 2);
      uvs.push(t * 24, 0, t * 24, 1);
      if (i < segments) {
        var a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    var tex = makeWaterTexture();
    var mat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      map: tex,
      transparent: true,
      opacity: 0.96,
      shininess: 35,
      specular: 0x446677
    });
    var mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return { mesh: mesh, mat: mat, tex: tex };
  }

  /** 两岸堤岸（沿河偏移的石质条带）。 */
  function buildEmbankments(scene) {
    var curve = riverCurve();
    var mat = new THREE.MeshLambertMaterial({ color: 0xb0aa9c, side: THREE.DoubleSide });
    [-1, 1].forEach(function (side) {
      var segments = 220;
      var positions = [];
      var indices = [];
      var off = RIVER_WIDTH / 2 + 5;
      var w = 8;
      for (var i = 0; i <= segments; i++) {
        var t = i / segments;
        var p = curve.getPoint(t);
        var tan = curve.getTangent(t);
        var nx = -tan.z;
        var nz = tan.x;
        var len = Math.sqrt(nx * nx + nz * nz) || 1;
        nx /= len;
        nz /= len;
        var cx = p.x + side * off * nx;
        var cz = p.z + side * off * nz;
        positions.push(cx + nx * w / 2, 1.2, cz + nz * w / 2);
        positions.push(cx - nx * w / 2, 1.2, cz - nz * w / 2);
        if (i < segments) {
          var a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      scene.add(new THREE.Mesh(geo, mat));
    });
  }

  /** 珠江游船：沿江往返行驶，夜间亮灯。 */
  function buildBoats(scene) {
    var curve = riverCurve();
    var group = new THREE.Group();
    var boats = [];
    var hullMat = new THREE.MeshLambertMaterial({ color: 0xf0f2f4 });
    var cabinMat = new THREE.MeshLambertMaterial({
      color: 0xdfe8ee, emissive: 0xffe9a8, emissiveIntensity: 0
    });
    var trimMat = new THREE.MeshLambertMaterial({ color: 0xc0392b });

    for (var i = 0; i < 3; i++) {
      var b = new THREE.Group();
      // 船体
      var hull = new THREE.Mesh(new THREE.BoxGeometry(6, 2.5, 16), hullMat);
      hull.position.y = 1.2;
      b.add(hull);
      // 船头
      var bow = new THREE.Mesh(new THREE.ConeGeometry(3, 6, 4), hullMat);
      bow.rotation.x = Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.scale.set(1, 0.45, 1);
      bow.position.set(0, 1.2, 11);
      b.add(bow);
      // 双层船舱
      var cab1 = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 12), cabinMat);
      cab1.position.y = 3.5;
      b.add(cab1);
      var cab2 = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 9), cabinMat);
      cab2.position.y = 5.6;
      b.add(cab2);
      // 红色顶棚
      var roof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 10), trimMat);
      roof.position.y = 6.8;
      b.add(roof);
      group.add(b);
      boats.push({
        mesh: b,
        t: 0.15 + i * 0.3,
        speed: (i % 2 === 0 ? 1 : -1) * (0.006 + i * 0.0015),
        phase: i * 2.1
      });
    }
    scene.add(group);

    function update(dt, time, isDay) {
      cabinMat.emissiveIntensity = isDay ? 0 : 1.0;
      boats.forEach(function (bt) {
        bt.t += bt.speed * dt;
        if (bt.t > 0.98) bt.t = 0.02;
        if (bt.t < 0.02) bt.t = 0.98;
        var p = curve.getPoint(bt.t);
        var tan = curve.getTangent(bt.t);
        bt.mesh.position.set(p.x, 0.9 + Math.sin(time * 1.8 + bt.phase) * 0.25, p.z);
        bt.mesh.rotation.y = Math.atan2(tan.x, tan.z) + (bt.speed < 0 ? Math.PI : 0);
        bt.mesh.rotation.z = Math.sin(time * 1.5 + bt.phase) * 0.02;
      });
    }
    return { group: group, update: update };
  }

  /** 地面。 */
  function buildGround(scene) {
    var geo = new THREE.PlaneGeometry(3400, 3400);
    var mat = new THREE.MeshLambertMaterial({ color: 0x93a883 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0;
    scene.add(mesh);
    return mat;
  }

  /** 公园绿地（圆形深绿地块）。 */
  function buildParks(scene) {
    var parks = [
      [-650, -700, 200],  // 越秀公园
      [250, -260, 90],    // 珠江公园
      [700, -420, 130],   // 天河公园
      [-350, 350, 110],   // 海珠方向绿地
      [500, 400, 120]
    ];
    var mat = new THREE.MeshLambertMaterial({ color: 0x6d9c58 });
    parks.forEach(function (p) {
      var m = new THREE.Mesh(new THREE.CircleGeometry(p[2], 40), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(p[0], 0.25, p[1]);
      scene.add(m);
    });
  }

  /** 道路网。 */
  function buildRoads(scene) {
    var mat = new THREE.MeshLambertMaterial({ color: 0x565a60 });
    function addRoad(x, z, w, l, alongX) {
      var geo = new THREE.PlaneGeometry(alongX ? l : w, alongX ? w : l);
      var m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.3, z);
      scene.add(m);
    }
    // 河北岸：东西向主干道
    addRoad(-400, -110, 22, 2200, true);  // 沿江路/中山路旁
    addRoad(-300, -320, 26, 2400, true);  // 中山路
    addRoad(100, -520, 24, 2200, true);   // 天河路
    // 河北岸：南北向
    addRoad(-880, -320, 20, 700, false);  // 康王路
    addRoad(-520, -350, 20, 700, false);  // 北京路附近
    addRoad(0, -350, 24, 700, false);     // 广州大道
    addRoad(450, -350, 20, 600, false);
    // 河南岸
    addRoad(100, 320, 22, 1800, true);
    addRoad(150, 550, 20, 1400, true);
  }

  /**
   * 建筑立面纹理（白天用 map，夜晚用 emissiveMap 亮窗）。
   * Returns: {dayTex, nightTex}
   */
  function makeFacadeTextures() {
    var cols = 6, rows = 14;
    var day = document.createElement('canvas');
    day.width = 128;
    day.height = 256;
    var dctx = day.getContext('2d');
    dctx.fillStyle = '#8e9aa8';
    dctx.fillRect(0, 0, 128, 256);
    var night = document.createElement('canvas');
    night.width = 128;
    night.height = 256;
    var nctx = night.getContext('2d');
    nctx.fillStyle = '#000000';
    nctx.fillRect(0, 0, 128, 256);
    var rand = makeRandom(7);
    var cw = 128 / cols, ch = 256 / rows;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        dctx.fillStyle = rand() > 0.5 ? '#5d6b7a' : '#4c5866';
        dctx.fillRect(c * cw + 3, r * ch + 3, cw - 6, ch - 6);
        if (rand() > 0.55) {
          nctx.fillStyle = rand() > 0.3 ? '#ffd27a' : '#9fd0ff';
          nctx.fillRect(c * cw + 3, r * ch + 3, cw - 6, ch - 6);
        }
      }
    }
    var dayTex = new THREE.CanvasTexture(day);
    var nightTex = new THREE.CanvasTexture(night);
    return { dayTex: dayTex, nightTex: nightTex };
  }

  /** 地标净空区（通用建筑避让）。 */
  var CLEARINGS = [
    [80, 190, 130], [10, 60, 90], [0, -180, 90], [-140, -240, 80],
    [130, -220, 80], [-70, -330, 70], [90, -330, 70], [430, 120, 110],
    [-720, -520, 100], [-1020, -320, 90], [-830, -60, 80], [-1080, 165, 120],
    [-520, -380, 70], [-980, -140, 80], [-680, -720, 220], [-600, -660, 80],
    [300, -1150, 380], [260, 85, 100], [-600, 95, 100]
  ];

  function inClearing(x, z) {
    for (var i = 0; i < CLEARINGS.length; i++) {
      var dx = x - CLEARINGS[i][0];
      var dz = z - CLEARINGS[i][1];
      if (dx * dx + dz * dz < CLEARINGS[i][2] * CLEARINGS[i][2]) return true;
    }
    return false;
  }

  /**
   * 通用建筑群（InstancedMesh，一次绘制调用）。
   * Returns: 建筑材质（用于日夜切换亮窗）。
   */
  function buildBuildings(scene) {
    var tex = makeFacadeTextures();
    var geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0); // 底部对齐地面
    var mat = new THREE.MeshLambertMaterial({
      map: tex.dayTex,
      emissive: 0xffffff,
      emissiveMap: tex.nightTex,
      emissiveIntensity: 0
    });

    // 区域定义：[xMin, xMax, zMin, zMax, 网格步长, 最小高, 最大高, 放置概率]
    var regions = [
      [-280, 280, -400, -60, 62, 70, 210, 0.85],    // 珠江新城 CBD
      [-1180, -320, -580, -60, 56, 22, 62, 0.7],    // 老城区
      [320, 1050, -540, -80, 64, 40, 130, 0.6],     // 天河东部
      [-750, 950, 170, 720, 66, 18, 62, 0.5],       // 河南岸
      [-1300, -700, 240, 700, 70, 15, 45, 0.45]     // 西南
    ];

    var placements = [];
    var rand = makeRandom(2026);
    regions.forEach(function (rg) {
      for (var x = rg[0]; x <= rg[1]; x += rg[4]) {
        for (var z = rg[2]; z <= rg[3]; z += rg[4]) {
          if (rand() > rg[7]) continue;
          var jx = x + (rand() - 0.5) * rg[4] * 0.5;
          var jz = z + (rand() - 0.5) * rg[4] * 0.5;
          if (distToRiver(jx, jz) < RIVER_WIDTH / 2 + 30) continue;
          if (inClearing(jx, jz)) continue;
          var h = rg[5] + rand() * (rg[6] - rg[5]);
          var w = 18 + rand() * 22;
          var d = 18 + rand() * 22;
          placements.push([jx, jz, w, h, d, rand()]);
        }
      }
    });

    var mesh = new THREE.InstancedMesh(geo, mat, placements.length);
    var dummy = new THREE.Object3D();
    var color = new THREE.Color();
    for (var i = 0; i < placements.length; i++) {
      var p = placements[i];
      dummy.position.set(p[0], 0, p[1]);
      dummy.scale.set(p[2], p[3], p[4]);
      dummy.rotation.y = (Math.floor(p[5] * 4) * Math.PI) / 2;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      var tint = 0.75 + p[5] * 0.25;
      color.setRGB(tint, tint, tint * (0.95 + p[5] * 0.05));
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    return mat;
  }

  /**
   * 构建整个城市基底。
   * Returns: {riverTex, riverMat, buildingMat, groundMat}
   */
  function build(scene) {
    var groundMat = buildGround(scene);
    buildParks(scene);
    buildRoads(scene);
    var river = buildRiver(scene);
    buildEmbankments(scene);
    var boats = buildBoats(scene);
    var buildingMat = buildBuildings(scene);
    return {
      riverTex: river.tex,
      riverMat: river.mat,
      buildingMat: buildingMat,
      groundMat: groundMat,
      boats: boats,
      distToRiver: distToRiver
    };
  }

  return {
    build: build,
    makeFacadeTextures: makeFacadeTextures,
    distToRiver: distToRiver,
    riverCurve: riverCurve,
    RIVER_WIDTH: RIVER_WIDTH
  };
})();
