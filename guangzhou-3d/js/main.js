/**
 * 广州 3D 漫游主程序：场景、相机控制、UI、日夜切换、小地图。
 */
(function () {
  'use strict';

  var DATA = GZLandmarks.DATA;
  var byId = GZLandmarks.byId;

  /* ---------------- 渲染器与场景 ---------------- */

  var canvas = document.getElementById('scene');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 8000);

  // 光照
  var hemi = new THREE.HemisphereLight(0xcfe5ff, 0x8a9070, 0.75);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff2dd, 1.0);
  sun.position.set(600, 900, 400);
  scene.add(sun);
  var ambient = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambient);

  /* ---------------- 城市与地标 ---------------- */

  var city = GZCity.build(scene);
  var landmarks = GZLandmarks.build(scene);

  /* ---------------- 相机漫游控制 ---------------- */

  var OVERVIEW = { pos: new THREE.Vector3(0, 430, 1080), look: new THREE.Vector3(0, 60, -120) };

  var yaw = 0;
  var pitch = -0.32;
  var keys = {};
  var dragging = false;      // 左键环视
  var zoomDragging = false;  // 中键拖拽缩放
  var dragMoved = 0;
  var lastX = 0, lastY = 0;

  camera.position.copy(OVERVIEW.pos);
  applyRotation();

  function applyRotation() {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
  }

  function forwardDir() {
    return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }

  /** 限制相机活动范围。 */
  function clampPosition() {
    camera.position.x = Math.max(-1600, Math.min(1600, camera.position.x));
    camera.position.z = Math.max(-1600, Math.min(1600, camera.position.z));
    camera.position.y = Math.max(6, Math.min(900, camera.position.y));
  }

  /** 沿视线方向推拉镜头（缩放）。 */
  function dolly(amount) {
    fly = null; // 手动缩放时打断飞行动画
    camera.position.addScaledVector(forwardDir(), amount);
    clampPosition();
  }

  canvas.addEventListener('mousedown', function (e) {
    if (e.button === 1) {
      // 中键：拖拽缩放
      zoomDragging = true;
      lastY = e.clientY;
      e.preventDefault();
      return;
    }
    dragging = true;
    dragMoved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener('mousemove', function (e) {
    if (zoomDragging) {
      var dyz = e.clientY - lastY;
      lastY = e.clientY;
      dolly(-dyz * 1.6); // 上推拉近，下拉拉远
      return;
    }
    if (!dragging) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    yaw -= dx * 0.0032;
    pitch -= dy * 0.0032;
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
    applyRotation();
  });

  window.addEventListener('mouseup', function (e) {
    if (e.button === 1) {
      zoomDragging = false;
      return;
    }
    if (dragging && dragMoved < 6 && e.target === canvas) {
      pickLandmark(e.clientX, e.clientY);
    }
    dragging = false;
  });

  // 滚轮缩放：上滚拉近，下滚拉远
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = Math.max(-120, Math.min(120, e.deltaY));
    dolly(-delta * 0.6);
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (e.code === 'KeyN') toggleDayNight();
  });

  window.addEventListener('keyup', function (e) {
    keys[e.code] = false;
  });

  function updateMovement(dt) {
    var speed = (keys.ShiftLeft || keys.ShiftRight) ? 260 : 80;
    var f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    var r = new THREE.Vector3(-f.z, 0, f.x);
    var move = new THREE.Vector3();
    if (keys.KeyW || keys.ArrowUp) move.add(f);
    if (keys.KeyS || keys.ArrowDown) move.sub(f);
    if (keys.KeyD || keys.ArrowRight) move.add(r);
    if (keys.KeyA || keys.ArrowLeft) move.sub(r);
    if (keys.Space) move.y += 1;
    if (keys.KeyC) move.y -= 1;
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      camera.position.add(move);
      clampPosition();
    }
  }

  /* ---------------- 飞行传送 ---------------- */

  var fly = null; // {fromPos, toPos, fromLook, toLook, t}

  function flyTo(toPos, toLook) {
    var fromLook = camera.position.clone().add(forwardDir().multiplyScalar(120));
    fly = {
      fromPos: camera.position.clone(),
      toPos: toPos.clone(),
      fromLook: fromLook,
      toLook: toLook.clone(),
      t: 0
    };
  }

  function updateFly(dt) {
    if (!fly) return;
    fly.t += dt / 1.6;
    var k = Math.min(1, fly.t);
    k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOut
    camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
    var look = new THREE.Vector3().lerpVectors(fly.fromLook, fly.toLook, k);
    var dir = look.sub(camera.position).normalize();
    yaw = Math.atan2(-dir.x, -dir.z);
    pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    applyRotation();
    if (fly.t >= 1) fly = null;
  }

  /* ---------------- 点击拾取 ---------------- */

  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();

  function pickLandmark(cx, cy) {
    mouse.x = (cx / window.innerWidth) * 2 - 1;
    mouse.y = -(cy / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var hits = raycaster.intersectObjects(landmarks.clickables, false);
    if (hits.length === 0) return;
    var id = hits[0].object.userData.landmarkId;
    if (id && byId[id]) selectLandmark(id, false);
  }

  /* ---------------- UI：地标列表与信息卡片 ---------------- */

  var listEl = document.getElementById('landmark-list');
  var infoCard = document.getElementById('info-card');
  var infoName = document.getElementById('info-name');
  var infoCat = document.getElementById('info-cat');
  var infoDesc = document.getElementById('info-desc');
  var activeItem = null;

  var CATS = ['现代地标', '历史人文', '自然风光'];
  CATS.forEach(function (cat) {
    var title = document.createElement('div');
    title.className = 'group-title';
    title.textContent = '— ' + cat + ' —';
    listEl.appendChild(title);
    DATA.forEach(function (d) {
      if (d.cat !== cat) return;
      var btn = document.createElement('button');
      btn.className = 'landmark-item';
      btn.textContent = d.name;
      btn.dataset.id = d.id;
      btn.addEventListener('click', function () {
        selectLandmark(d.id, true);
      });
      listEl.appendChild(btn);
    });
  });

  function selectLandmark(id, doFly) {
    var d = byId[id];
    infoName.textContent = d.name;
    infoCat.textContent = d.cat;
    infoDesc.textContent = d.desc;
    infoCard.classList.remove('hidden');
    if (activeItem) activeItem.classList.remove('active');
    activeItem = listEl.querySelector('[data-id="' + id + '"]');
    if (activeItem) activeItem.classList.add('active');
    if (doFly) {
      var h = d.height || 40;
      flyTo(
        new THREE.Vector3(d.pos[0] + d.view[0], d.view[1], d.pos[1] + d.view[2]),
        new THREE.Vector3(d.pos[0], h * 0.55, d.pos[1])
      );
    }
  }

  document.getElementById('info-close').addEventListener('click', function () {
    infoCard.classList.add('hidden');
    if (activeItem) activeItem.classList.remove('active');
    activeItem = null;
  });

  document.getElementById('btn-overview').addEventListener('click', function () {
    flyTo(OVERVIEW.pos, OVERVIEW.look);
  });

  /* ---------------- 日夜切换 ---------------- */

  var isDay = true;
  var dayNightBtn = document.getElementById('btn-daynight');

  var SKY = {
    day: { bg: 0xbcd9f5, fog: [900, 3400], hemi: 0.75, sun: 1.0, ambient: 0.25, emissive: 0 },
    night: { bg: 0x0a1026, fog: [700, 3000], hemi: 0.18, sun: 0.12, ambient: 0.12, emissive: 1.0 }
  };

  scene.fog = new THREE.Fog(SKY.day.bg, SKY.day.fog[0], SKY.day.fog[1]);
  scene.background = new THREE.Color(SKY.day.bg);

  function toggleDayNight() {
    isDay = !isDay;
    var cfg = isDay ? SKY.day : SKY.night;
    scene.background.setHex(cfg.bg);
    scene.fog.color.setHex(cfg.bg);
    scene.fog.near = cfg.fog[0];
    scene.fog.far = cfg.fog[1];
    hemi.intensity = cfg.hemi;
    sun.intensity = cfg.sun;
    ambient.intensity = cfg.ambient;
    city.buildingMat.emissiveIntensity = cfg.emissive;
    city.riverMat.color.setHex(isDay ? 0x9fc6e0 : 0x2a4a66);
    city.groundMat.color.setHex(isDay ? 0x93a883 : 0x3d4a3a);
    // 广州塔夜景彩灯
    var lattice = landmarks.night['canton-tower.latticeMat'];
    if (lattice) lattice.emissive.setHex(isDay ? 0x000000 : 0xffffff);
    var core = landmarks.night['canton-tower.coreMat'];
    if (core) core.opacity = isDay ? 0.55 : 0.3;
    dayNightBtn.textContent = isDay ? '切换到夜晚' : '切换到白天';
  }

  dayNightBtn.addEventListener('click', toggleDayNight);

  /* ---------------- 小地图 ---------------- */

  var minimap = document.getElementById('minimap');
  var mmCtx = minimap.getContext('2d');
  var MM = 180;

  function toMap(x, z) {
    return [(x + 1700) / 3400 * MM, (z + 1700) / 3400 * MM];
  }

  function drawMinimapStatic() {
    mmCtx.fillStyle = '#22303f';
    mmCtx.fillRect(0, 0, MM, MM);
    // 珠江
    mmCtx.strokeStyle = '#4d7fa0';
    mmCtx.lineWidth = 7;
    mmCtx.lineCap = 'round';
    mmCtx.beginPath();
    var pts = [[-1600, 280], [-1100, 170], [-700, 110], [-300, 60], [0, 40], [300, 90], [700, 160], [1100, 140], [1600, 220]];
    pts.forEach(function (p, i) {
      var m = toMap(p[0], p[1]);
      if (i === 0) mmCtx.moveTo(m[0], m[1]);
      else mmCtx.lineTo(m[0], m[1]);
    });
    mmCtx.stroke();
    // 白云山
    var b = toMap(300, -1150);
    mmCtx.fillStyle = '#3f6b3a';
    mmCtx.beginPath();
    mmCtx.arc(b[0], b[1], 14, 0, Math.PI * 2);
    mmCtx.fill();
    // 地标点
    DATA.forEach(function (d) {
      var m = toMap(d.pos[0], d.pos[1]);
      mmCtx.fillStyle = '#ffd97a';
      mmCtx.beginPath();
      mmCtx.arc(m[0], m[1], 2.4, 0, Math.PI * 2);
      mmCtx.fill();
    });
  }

  function drawMinimapCamera() {
    var m = toMap(camera.position.x, camera.position.z);
    mmCtx.fillStyle = '#ff5a4e';
    mmCtx.beginPath();
    mmCtx.arc(m[0], m[1], 3.6, 0, Math.PI * 2);
    mmCtx.fill();
    // 朝向线
    var f = forwardDir();
    mmCtx.strokeStyle = '#ff5a4e';
    mmCtx.lineWidth = 1.6;
    mmCtx.beginPath();
    mmCtx.moveTo(m[0], m[1]);
    mmCtx.lineTo(m[0] + f.x * 12, m[1] + f.z * 12);
    mmCtx.stroke();
  }

  /* ---------------- 主循环 ---------------- */

  var clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;

    updateMovement(dt);
    updateFly(dt);

    // 珠江水面流动
    city.riverTex.offset.x = t * 0.03;

    // 珠江游船
    city.boats.update(dt, t, isDay);

    // 夜晚广州塔彩灯变色
    if (!isDay) {
      var lattice = landmarks.night['canton-tower.latticeMat'];
      if (lattice) lattice.emissive.setHSL((t * 0.06) % 1, 0.75, 0.5);
    }

    drawMinimapStatic();
    drawMinimapCamera();

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
})();
