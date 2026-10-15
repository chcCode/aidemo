// 太阳系星球运行预览
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

(function () {
    // ============ 场景初始化 ============
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 80, 160);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 20;
    controls.maxDistance = 600;
    controls.enableZoom = false;

    const homeDist = camera.position.distanceTo(controls.target);
    let zoomTarget = homeDist;
    let smoothDist = zoomTarget;

    function zoomBy(scale) {
        zoomTarget = THREE.MathUtils.clamp(zoomTarget * scale, controls.minDistance, controls.maxDistance);
    }

    renderer.domElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomBy(Math.exp(e.deltaY * 0.0011));
    }, { passive: false });

    let middleDrag = false;
    let lastMiddleY = 0;
    renderer.domElement.addEventListener('pointerdown', (e) => {
        if (e.button === 1) {
            middleDrag = true;
            lastMiddleY = e.clientY;
        }
    });
    window.addEventListener('pointermove', (e) => {
        if (!middleDrag) return;
        const dy = e.clientY - lastMiddleY;
        lastMiddleY = e.clientY;
        zoomBy(Math.exp(dy * 0.012));
    });
    window.addEventListener('pointerup', (e) => {
        if (e.button === 1) middleDrag = false;
    });

    let pinchStart = 0;
    renderer.domElement.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            pinchStart = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, { passive: true });
    renderer.domElement.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && pinchStart > 0) {
            const d = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (d > 0) zoomBy(d / pinchStart);
            pinchStart = d;
        }
    }, { passive: true });

    // ============ 全局参数 ============
    let orbitSpeedMul = 1.0;   // 公转速度倍数
    let spinSpeedMul = 1.0;    // 自转速度倍数
    let timeScale = 10;        // 时间倍率
    let showOrbits = true;
    let elapsed = 0;           // 累计时间（受 timeScale 影响）

    // ============ 星空背景 ============
    function createStarfield() {
        const starsGeo = new THREE.BufferGeometry();
        const count = 6000;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = 800 + Math.random() * 600;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
            const c = 0.7 + Math.random() * 0.3;
            colors[i * 3] = c;
            colors[i * 3 + 1] = c;
            colors[i * 3 + 2] = c;
        }
        starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starsGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const starsMat = new THREE.PointsMaterial({
            size: 1.6, vertexColors: true, transparent: true, opacity: 0.9,
            sizeAttenuation: true, depthWrite: false
        });
        scene.add(new THREE.Points(starsGeo, starsMat));
    }
    createStarfield();

    // ============ 灯光 ============
    const ambientLight = new THREE.AmbientLight(0x8899bb, 0.55);
    scene.add(ambientLight);
    const sunLight = new THREE.PointLight(0xfff2dd, 5.5, 0, 0.5);
    scene.add(sunLight);

    // ============ 太阳 ============
    const sunGroup = new THREE.Group();
    scene.add(sunGroup);

    // 太阳核心
    const sunGeo = new THREE.SphereGeometry(8, 64, 64);
    const sunMat = new THREE.MeshBasicMaterial({
        color: 0xffcc33
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunGroup.add(sunMesh);

    // 太阳表面纹理（用噪声模拟）
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = 512;
    sunCanvas.height = 512;
    const sctx = sunCanvas.getContext('2d');
    function drawSunTexture() {
        const grad = sctx.createRadialGradient(256, 256, 0, 256, 256, 256);
        grad.addColorStop(0, '#fff7a0');
        grad.addColorStop(0.3, '#ffd700');
        grad.addColorStop(0.7, '#ff9500');
        grad.addColorStop(1, '#ff6600');
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, 512, 512);
        // 斑点
        for (let i = 0; i < 300; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const r = Math.random() * 18 + 4;
            const a = Math.random() * 0.35;
            sctx.fillStyle = `rgba(${180 + Math.random() * 70},${80 + Math.random() * 60},0,${a})`;
            sctx.beginPath();
            sctx.arc(x, y, r, 0, Math.PI * 2);
            sctx.fill();
        }
    }
    drawSunTexture();
    const sunTex = new THREE.CanvasTexture(sunCanvas);
    sunMesh.material = new THREE.MeshBasicMaterial({ map: sunTex });

    // 太阳光晕
    const glowGeo = new THREE.SphereGeometry(9.6, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00, transparent: true, opacity: 0.25, side: THREE.BackSide
    });
    sunGroup.add(new THREE.Mesh(glowGeo, glowMat));

    // 太阳耀斑粒子环
    const flareGeo = new THREE.SphereGeometry(8.7, 32, 32);
    const flareMat = new THREE.MeshBasicMaterial({
        color: 0xffee88, transparent: true, opacity: 0.15, side: THREE.BackSide
    });
    sunGroup.add(new THREE.Mesh(flareGeo, flareMat));

    // ============ 程序化贴图工具 ============
    function makeCanvasTexture(drawFn, w = 256, h = 256) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        drawFn(ctx, w, h);
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    function noiseTexture(baseColor, spotColors, spotCount, spotSize) {
        return makeCanvasTexture((ctx, w, h) => {
            ctx.fillStyle = baseColor;
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < spotCount; i++) {
                const col = spotColors[Math.floor(Math.random() * spotColors.length)];
                const x = Math.random() * w;
                const y = Math.random() * h;
                const r = Math.random() * spotSize + 2;
                ctx.fillStyle = col;
                ctx.globalAlpha = 0.3 + Math.random() * 0.5;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        });
    }

    function stripeTexture(baseColor, stripeColors, stripeCount, horizontal = true) {
        return makeCanvasTexture((ctx, w, h) => {
            ctx.fillStyle = baseColor;
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < stripeCount; i++) {
                const col = stripeColors[Math.floor(Math.random() * stripeColors.length)];
                ctx.fillStyle = col;
                ctx.globalAlpha = 0.35 + Math.random() * 0.4;
                if (horizontal) {
                    const y = Math.random() * h;
                    const hh = Math.random() * 24 + 6;
                    ctx.fillRect(0, y, w, hh);
                } else {
                    const x = Math.random() * w;
                    const ww = Math.random() * 24 + 6;
                    ctx.fillRect(x, 0, ww, h);
                }
            }
            ctx.globalAlpha = 1;
        });
    }

    // ============ 行星数据 ============
    // 半径 / 轨道半径 / 公转周期(相对) / 自转速度 / 颜色 / 描述
    const planetsData = [
        {
            name: '水星', en: 'Mercury',
            radius: 1.1, realRadius: 0.77, orbit: 16, realOrbit: 16, period: 0.24, spin: 0.004,
            color: 0xb0b0b0,
            texture: () => noiseTexture('#8a8a8a', ['#6e6e6e', '#a5a5a5', '#5c5c5c'], 400, 8),
            desc: '距太阳最近的行星，昼夜温差极大，表面布满陨石坑。'
        },
        {
            name: '金星', en: 'Venus',
            radius: 1.9, realRadius: 1.9, orbit: 24, realOrbit: 42, period: 0.62, spin: -0.002,
            color: 0xe6c27a,
            texture: () => stripeTexture('#d4a94e', ['#f0d78c', '#b8860b', '#e8c878'], 60),
            desc: '太阳系中最热的行星，被浓厚二氧化碳大气层覆盖。'
        },
        {
            name: '地球', en: 'Earth',
            radius: 2.0, realRadius: 2.0, orbit: 33, realOrbit: 56, period: 1.0, spin: 0.02,
            color: 0x4d90e0,
            texture: () => makeCanvasTexture((ctx, w, h) => {
                // 海洋
                ctx.fillStyle = '#1a5fa8';
                ctx.fillRect(0, 0, w, h);
                // 陆地
                const continents = [
                    [60, 80, 55], [150, 60, 45], [200, 150, 50],
                    [90, 180, 40], [220, 210, 35], [30, 140, 30]
                ];
                continents.forEach(([cx, cy, cr]) => {
                    ctx.fillStyle = '#2d7a35';
                    ctx.beginPath();
                    for (let a = 0; a < Math.PI * 2; a += 0.3) {
                        const rr = cr * (0.7 + Math.random() * 0.5);
                        const px = cx + Math.cos(a) * rr;
                        const py = cy + Math.sin(a) * rr * 0.7;
                        if (a === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                });
                // 云层
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                for (let i = 0; i < 60; i++) {
                    const x = Math.random() * w, y = Math.random() * h;
                    ctx.beginPath();
                    ctx.ellipse(x, y, Math.random() * 30 + 8, Math.random() * 12 + 4, Math.random() * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                // 极地冰盖
                ctx.fillStyle = 'rgba(240,248,255,0.85)';
                ctx.fillRect(0, 0, w, 18);
                ctx.fillRect(0, h - 18, w, 18);
            }),
            desc: '我们赖以生存的家园，拥有液态水与生命。'
        },
        {
            name: '火星', en: 'Mars',
            radius: 1.5, realRadius: 1.06, orbit: 42, realOrbit: 74, period: 1.88, spin: 0.019,
            color: 0xc1440e,
            texture: () => noiseTexture('#b34a1f', ['#8c3513', '#d06a35', '#6e2a10', '#e08050'], 500, 10),
            desc: '红色星球，拥有太阳系最高的火山——奥林帕斯山。'
        },
        {
            name: '木星', en: 'Jupiter',
            radius: 5.5, realRadius: 21.9, orbit: 62, realOrbit: 126, period: 11.86, spin: 0.045,
            color: 0xd8a56a,
            texture: () => stripeTexture('#c9956b', ['#e8c8a0', '#a67b52', '#f0dcc0', '#8b6244', '#d4b08c'], 40),
            desc: '太阳系最大的行星，大红斑是一场持续数百年的风暴。'
        },
        {
            name: '土星', en: 'Saturn',
            radius: 4.6, realRadius: 18.3, orbit: 82, realOrbit: 152, period: 29.46, spin: 0.04,
            color: 0xead6a6,
            texture: () => stripeTexture('#e0cc9a', ['#f5e8c8', '#c9b078', '#fff4d8', '#b89e64'], 35),
            desc: '以壮观的环系闻名，环由冰块和岩石碎片组成。',
            ring: { inner: 6.2, outer: 10.5, color: 0xd8c8a0 }
        },
        {
            name: '天王星', en: 'Uranus',
            radius: 3.2, realRadius: 8.0, orbit: 102, realOrbit: 181, period: 84.01, spin: -0.03,
            color: 0x9fd8e8,
            texture: () => stripeTexture('#7fd0e0', ['#a8e4f0', '#68bcd0', '#c0eef8'], 30),
            desc: '一颗"躺着"自转的冰巨星，轴倾角达 98 度。'
        },
        {
            name: '海王星', en: 'Neptune',
            radius: 3.1, realRadius: 7.7, orbit: 120, realOrbit: 200, period: 164.8, spin: 0.032,
            color: 0x4470e0,
            texture: () => stripeTexture('#3a5fd0', ['#5a80f0', '#2a48b0', '#7aa0ff'], 30),
            desc: '太阳系最外侧的行星，拥有太阳系最快的风速。'
        }
    ];

    // ============ 创建行星 ============
    const planetMeshes = [];
    const orbitLines = [];

    planetsData.forEach((p, idx) => {
        // 行星组（用于公转）
        const pivot = new THREE.Group();
        scene.add(pivot);

        // 行星网格
        const geo = new THREE.SphereGeometry(p.radius, 48, 48);
        const mat = new THREE.MeshStandardMaterial({
            map: p.texture(),
            roughness: 0.85,
            metalness: 0.05,
            emissive: new THREE.Color(p.color).multiplyScalar(0.18)
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.x = p.orbit;
        mesh.userData = { index: idx, data: p, pivot };
        pivot.add(mesh);

        // 土星环
        if (p.ring) {
            const ringGeo = new THREE.RingGeometry(p.ring.inner, p.ring.outer, 96);
            // 环纹理
            const ringTex = makeCanvasTexture((ctx, w, h) => {
                const grad = ctx.createLinearGradient(0, 0, w, 0);
                grad.addColorStop(0, 'rgba(210,190,150,0)');
                grad.addColorStop(0.15, 'rgba(230,210,170,0.7)');
                grad.addColorStop(0.4, 'rgba(200,180,140,0.5)');
                grad.addColorStop(0.6, 'rgba(240,225,190,0.8)');
                grad.addColorStop(0.85, 'rgba(210,195,160,0.6)');
                grad.addColorStop(1, 'rgba(210,190,150,0)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, h);
                // 卡西尼缝
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(w * 0.62, 0, w * 0.05, h);
            }, 512, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                map: ringTex, side: THREE.DoubleSide, transparent: true, opacity: 0.9
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2 - 0.35;
            ring.rotation.y = 0.2;
            mesh.add(ring);
        }

        // 月球（地球卫星）
        if (p.name === '地球') {
            const moonPivot = new THREE.Group();
            mesh.add(moonPivot);
            const moonGeo = new THREE.SphereGeometry(0.5, 24, 24);
            const moonTex = noiseTexture('#9a9a9a', ['#7a7a7a', '#b0b0b0', '#666'], 300, 5);
            const moonMat = new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1 });
            const moon = new THREE.Mesh(moonGeo, moonMat);
            moon.position.x = 3.5;
            moonPivot.add(moon);
            mesh.userData.moonPivot = moonPivot;
        }

        // 轨道线
        const orbitCurve = new THREE.EllipseCurve(0, 0, p.orbit, p.orbit, 0, Math.PI * 2, false, 0);
        const pts = orbitCurve.getPoints(180);
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(
            pts.map(pt => new THREE.Vector3(pt.x, 0, pt.y))
        );
        const orbitMat = new THREE.LineBasicMaterial({
            color: 0x555577, transparent: true, opacity: 0.45
        });
        const orbitLine = new THREE.Line(orbitGeo, orbitMat);
        scene.add(orbitLine);
        orbitLines.push(orbitLine);

        planetMeshes.push({ pivot, mesh, data: p, index: idx, orbitLine });

        // 初始随机相位
        pivot.rotation.y = Math.random() * Math.PI * 2;
    });

    // ============ 小行星带 ============
    function createAsteroidBelt() {
        const count = 800;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 51 + Math.random() * 6;
            positions[i * 3] = Math.cos(angle) * r;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
            positions[i * 3 + 2] = Math.sin(angle) * r;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color: 0x998877, size: 0.35, transparent: true, opacity: 0.7 });
        const belt = new THREE.Points(geo, mat);
        scene.add(belt);
        return belt;
    }
    const asteroidBelt = createAsteroidBelt();

    // ============ UI 交互 ============
    // 速度滑块
    const orbitSpeedEl = document.getElementById('orbit-speed');
    const spinSpeedEl = document.getElementById('spin-speed');
    const timeScaleEl = document.getElementById('time-scale');

    orbitSpeedEl.addEventListener('input', () => {
        orbitSpeedMul = orbitSpeedEl.value / 30;
        document.getElementById('orbit-speed-val').textContent = orbitSpeedMul.toFixed(1) + 'x';
    });
    spinSpeedEl.addEventListener('input', () => {
        spinSpeedMul = spinSpeedEl.value / 50;
        document.getElementById('spin-speed-val').textContent = spinSpeedMul.toFixed(1) + 'x';
    });
    timeScaleEl.addEventListener('input', () => {
        timeScale = parseInt(timeScaleEl.value);
        document.getElementById('time-scale-val').textContent = timeScale + 'x';
    });

    // 轨道线开关
    const btnToggle = document.getElementById('btn-toggle-orbits');
    btnToggle.addEventListener('click', () => {
        showOrbits = !showOrbits;
        orbitLines.forEach(l => l.visible = showOrbits);
        btnToggle.textContent = showOrbits ? '隐藏轨道线' : '显示轨道线';
    });

    // 比例切换（示意 <-> 真实）
    let realScaleMode = false;
    const BELT_SCALE = 98 / 54;
    const btnScale = document.getElementById('btn-toggle-scale');

    function displayedRadius(p) {
        return realScaleMode ? p.realRadius : p.radius;
    }

    function applyScaleMode() {
        planetMeshes.forEach(pm => {
            const p = pm.data;
            pm.mesh.scale.setScalar(displayedRadius(p) / p.radius);
            const oRatio = realScaleMode ? p.realOrbit / p.orbit : 1;
            pm.mesh.position.x = p.orbit * oRatio;
            pm.orbitLine.scale.setScalar(oRatio);
        });
        asteroidBelt.scale.setScalar(realScaleMode ? BELT_SCALE : 1);
        controls.maxDistance = realScaleMode ? 800 : 600;
        btnScale.textContent = realScaleMode ? '切换示意比例' : '切换真实比例';
        if (focusedIndex >= 0) {
            const p = planetMeshes[focusedIndex].data;
            zoomTarget = THREE.MathUtils.clamp(displayedRadius(p) * 7 + 10, controls.minDistance, controls.maxDistance);
        }
    }

    btnScale.addEventListener('click', () => {
        realScaleMode = !realScaleMode;
        applyScaleMode();
    });

    // 图例
    const legendList = document.getElementById('legend-list');
    const legendItems = [];
    planetsData.forEach((p, i) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<span class="legend-color" style="background:#${p.color.toString(16).padStart(6, '0')}"></span>${p.name} ${p.en}`;
        item.addEventListener('click', () => focusPlanet(i));
        legendList.appendChild(item);
        legendItems.push(item);
    });

    // 聚焦行星
    const planetInfoEl = document.getElementById('planet-info');
    let focusedIndex = -1;

    function focusPlanet(idx) {
        focusedIndex = idx;
        const p = planetsData[idx];
        document.getElementById('planet-name').textContent = `${p.name} ${p.en}`;
        document.getElementById('planet-desc').textContent = p.desc;
        planetInfoEl.style.display = 'block';
        legendItems.forEach((el, i) => el.style.opacity = i === idx ? 1 : 0.5);
        zoomTarget = THREE.MathUtils.clamp(displayedRadius(p) * 7 + 10, controls.minDistance, controls.maxDistance);
    }

    function unfocus() {
        focusedIndex = -1;
        planetInfoEl.style.display = 'none';
        legendItems.forEach(el => el.style.opacity = 1);
        zoomTarget = homeDist;
    }

    // 点击行星聚焦
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    renderer.domElement.addEventListener('pointerdown', (e) => {
        downPos = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
        if (e.button !== 0) return;
        const dx = e.clientX - downPos.x;
        const dy = e.clientY - downPos.y;
        if (dx * dx + dy * dy > 25) return; // 拖拽而非点击

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const meshes = planetMeshes.map(pm => pm.mesh);
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
            const idx = hits[0].object.userData.index;
            focusPlanet(idx);
        } else {
            unfocus();
        }
    });

    // ============ 窗口调整 ============
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ============ 动画循环 ============
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const dt = clock.getDelta();
        elapsed += dt * timeScale;

        // 太阳自转
        sunMesh.rotation.y += dt * 0.05 * spinSpeedMul;
        glowMat.opacity = 0.2 + Math.sin(elapsed * 0.5) * 0.08;

        // 行星公转 & 自转
        planetMeshes.forEach(pm => {
            // 公转
            const angularSpeed = (Math.PI * 2) / (pm.data.period * 60); // period 以地球年为单位，一年60秒基准
            pm.pivot.rotation.y += angularSpeed * dt * orbitSpeedMul * (timeScale / 10);
            // 自转
            pm.mesh.rotation.y += pm.data.spin * dt * 60 * spinSpeedMul;
            // 月球
            if (pm.mesh.userData.moonPivot) {
                pm.mesh.userData.moonPivot.rotation.y += dt * 0.8 * orbitSpeedMul * (timeScale / 10);
            }
        });

        // 小行星带缓慢旋转
        asteroidBelt.rotation.y += dt * 0.02 * orbitSpeedMul * (timeScale / 10);

        // 聚焦跟随
        controls.update();

        if (focusedIndex >= 0) {
            const pm = planetMeshes[focusedIndex];
            const worldPos = new THREE.Vector3();
            pm.mesh.getWorldPosition(worldPos);
            controls.target.lerp(worldPos, 0.08);
        }

        smoothDist += (zoomTarget - smoothDist) * (1 - Math.exp(-dt * 12));
        const camDir = camera.position.clone().sub(controls.target);
        if (camDir.lengthSq() > 1e-8) {
            camDir.normalize();
            camera.position.copy(controls.target).addScaledVector(camDir, smoothDist);
        }

        renderer.render(scene, camera);
    }

    animate();
})();
