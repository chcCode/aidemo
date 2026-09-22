/**
 * 广州地标建模：程序化生成 17 处经典景点与建筑。
 * 挂到 window.GZLandmarks，包含数据 DATA 与构建方法 build。
 */
window.GZLandmarks = (function () {
  'use strict';

  /**
   * 地标数据：pos 为 [x, z]，view 为观景相机相对偏移 [dx, dy, dz]。
   */
  var DATA = [
    {
      id: 'canton-tower', name: '广州塔', cat: '现代地标', pos: [80, 190],
      view: [220, 150, 380],
      desc: '昵称"小蛮腰"，塔高 600 米，2010 年建成，是中国第一高塔。塔身采用扭转的椭圆形网格结构，入夜后彩灯流转，为珠江南岸的城市地标。'
    },
    {
      id: 'ctf', name: '广州东塔（周大福金融中心）', cat: '现代地标', pos: [130, -220],
      view: [200, 160, 260],
      desc: '高 530 米，共 111 层，是广州第一高楼，集超甲级写字楼、酒店与商业于一体。'
    },
    {
      id: 'ifc', name: '广州西塔（IFC）', cat: '现代地标', pos: [-140, -240],
      view: [-200, 150, 260],
      desc: '广州国际金融中心，高 441 米，2010 年竣工，菱形斜交网格外立面是其标志，与东塔隔花城广场相望。'
    },
    {
      id: 'huacheng', name: '花城广场', cat: '现代地标', pos: [0, -180],
      view: [0, 180, 320],
      desc: '广州城市中轴线，北起珠江新城，南望广州塔，两侧云集大剧院、博物馆、图书馆等文化建筑，被誉为"城市客厅"。'
    },
    {
      id: 'opera', name: '广州大剧院', cat: '现代地标', pos: [90, -330],
      view: [150, 100, 180],
      desc: '由建筑大师扎哈·哈迪德设计，形如珠江边被江水冲刷的"圆润双砾"，2010 年落成，是华南地区最高艺术殿堂。'
    },
    {
      id: 'museum', name: '广东省博物馆', cat: '现代地标', pos: [-70, -330],
      view: [-150, 100, 180],
      desc: '新馆 2010 年开放，外形酷似精雕细琢的"月光宝盒"，馆藏涵盖历史、艺术、自然等各类珍品。'
    },
    {
      id: 'haixinsha', name: '海心沙', cat: '现代地标', pos: [10, 60],
      view: [150, 90, 220],
      desc: '珠江江心小岛，2010 年广州亚运会开闭幕式举办地，帆屏舞台与广州塔隔江相望。'
    },
    {
      id: 'liede', name: '猎德大桥', cat: '现代地标', pos: [430, 120],
      view: [220, 90, 200],
      desc: '2009 年通车，横跨珠江的自锚式悬索桥，白色桥塔形如贝壳，是拍摄广州塔的经典机位。'
    },
    {
      id: 'ersha', name: '二沙岛', cat: '现代地标', pos: [-190, 55],
      view: [170, 100, 190],
      desc: '珠江中的江心绿岛，岛上有星海音乐厅、广东美术馆，绿树成荫，是广州的文化艺术之岛。'
    },
    {
      id: 'gz-bridge', name: '广州大桥', cat: '现代地标', pos: [260, 85],
      view: [160, 90, 180],
      desc: '1985 年通车，连接广州大道南北两岸，是珠江新城与海珠区之间的重要通道。'
    },
    {
      id: 'haizhu-bridge', name: '海珠桥', cat: '历史人文', pos: [-600, 95],
      view: [140, 80, 180],
      desc: '1933 年建成通车，是广州市第一座跨江大桥，曾毁于战火后重建，见证了羊城的百年变迁。'
    },
    {
      id: 'memorial', name: '中山纪念堂', cat: '历史人文', pos: [-720, -520],
      view: [160, 110, 200],
      desc: '1931 年建成，由建筑师吕彦直设计，八角攒尖宝蓝色琉璃瓦顶，为纪念孙中山先生而建，是广州近代建筑杰作。'
    },
    {
      id: 'chen-clan', name: '陈家祠', cat: '历史人文', pos: [-1020, -320],
      view: [130, 90, 160],
      desc: '清光绪二十年（1894 年）建成的合族祠，以"三雕两塑一铸一画"装饰艺术闻名，被誉为岭南建筑艺术的明珠。'
    },
    {
      id: 'cathedral', name: '石室圣心大教堂', cat: '历史人文', pos: [-830, -60],
      view: [120, 90, 160],
      desc: '1863 年奠基、1888 年落成，全球四座全石结构哥特式教堂之一，花岗岩砌筑，有"远东巴黎圣母院"之称。'
    },
    {
      id: 'shamian', name: '沙面岛', cat: '历史人文', pos: [-1080, 165],
      view: [150, 80, 160],
      desc: '珠江冲积而成的椭圆形小岛，曾为英法租界，岛上保留 150 多座欧陆风情建筑，古树参天。'
    },
    {
      id: 'beijing-road', name: '北京路步行街', cat: '历史人文', pos: [-520, -380],
      view: [110, 80, 150],
      desc: '广州城建之始的千年古道，路面下叠压着自唐代至民国的十一层路面遗址，如今是繁华的商业步行街。'
    },
    {
      id: 'shangxiajiu', name: '上下九步行街', cat: '历史人文', pos: [-980, -140],
      view: [120, 70, 150],
      desc: '西关风情的骑楼商业街，连绵千米，汇聚老字号美食与粤韵市井文化。'
    },
    {
      id: 'five-rams', name: '五羊雕像', cat: '历史人文', pos: [-680, -720],
      view: [110, 80, 150],
      desc: '1959 年由尹积昌等人创作，坐落于越秀公园木壳岗，五只石羊口衔稻穗，是广州"羊城"之名的城市象征。'
    },
    {
      id: 'zhenhai', name: '镇海楼', cat: '历史人文', pos: [-600, -660],
      view: [110, 80, 150],
      desc: '明洪武十三年（1380 年）建于越秀山，五层红楼俗称"五层楼"，现为广州博物馆，登楼可俯瞰羊城。'
    },
    {
      id: 'baiyun', name: '白云山', cat: '自然风光', pos: [300, -1150],
      view: [350, 260, 420],
      desc: '南粤名山，自古有"羊城第一秀"之称，主峰摩星岭海拔 382 米，雨后白云缭绕山间，故名白云山。'
    }
  ];

  var byId = {};
  DATA.forEach(function (d) { byId[d.id] = d; });

  /* ---------------- 材质工具 ---------------- */

  function lambert(color, opts) {
    var params = { color: color };
    if (opts) Object.keys(opts).forEach(function (k) { params[k] = opts[k]; });
    return new THREE.MeshLambertMaterial(params);
  }

  function glass(color, opacity) {
    return new THREE.MeshPhongMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      shininess: 120,
      specular: 0xaaccff
    });
  }

  function addBox(group, w, h, d, x, y, z, mat) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }

  function addCylinder(group, rTop, rBottom, h, x, y, z, mat, segments) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments || 24), mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }

  /** 四坡屋顶（四棱锥压扁旋转 45°，可做重檐）。 */
  function addHipRoof(group, w, d, h, x, y, z, mat) {
    var r = Math.sqrt(w * w + d * d) / 2;
    var m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), mat);
    m.rotation.y = Math.PI / 4;
    m.scale.set(w / (r * Math.SQRT2) * Math.SQRT2, 1, d / (r * Math.SQRT2) * Math.SQRT2);
    m.scale.set(w / r / Math.SQRT2 * 1.0, 1, d / r / Math.SQRT2 * 1.0);
    // 直接按椭圆锥缩放：x 方向 w/2/r，z 方向 d/2/r
    m.scale.set(w / (2 * r) * Math.SQRT2, 1, d / (2 * r) * Math.SQRT2);
    m.position.set(x, y + h / 2, z);
    group.add(m);
    return m;
  }

  /* ---------------- 各地标建模 ---------------- */

  /** 广州塔：扭转双曲面网格 + 核心筒 + 天线。 */
  function buildCantonTower() {
    var g = new THREE.Group();
    var H = 460;
    var waistT = 0.62;
    var baseR = 34, waistR = 15, topR = 21;

    function radiusAt(t) {
      if (t < waistT) {
        var k = (t - waistT) / waistT;
        return waistR + (baseR - waistR) * k * k;
      }
      var k2 = (t - waistT) / (1 - waistT);
      return waistR + (topR - waistR) * k2 * k2;
    }

    // 核心筒（半透明混凝土柱）
    var coreMat = lambert(0xcfd4d8, { transparent: true, opacity: 0.55 });
    var core = new THREE.Mesh(new THREE.CylinderGeometry(topR * 0.55, baseR * 0.6, H, 24), coreMat);
    core.position.y = H / 2;
    g.add(core);

    // 双向螺旋钢构网格
    var latticeMat = new THREE.MeshStandardMaterial({
      color: 0xd8dde2, metalness: 0.55, roughness: 0.35,
      emissive: 0x000000, emissiveIntensity: 1
    });
    var COLS = 18, SEGS = 36, TWIST = 0.95;
    for (var dir = -1; dir <= 1; dir += 2) {
      for (var i = 0; i < COLS; i++) {
        var a0 = (i / COLS) * Math.PI * 2;
        var pts = [];
        for (var s = 0; s <= SEGS; s++) {
          var t = s / SEGS;
          var ang = a0 + dir * TWIST * t;
          var r = radiusAt(t);
          pts.push(new THREE.Vector3(r * Math.cos(ang), t * H, r * Math.sin(ang)));
        }
        var tube = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), SEGS, 0.7, 5, false),
          latticeMat
        );
        g.add(tube);
      }
    }
    // 环梁
    [0, 0.2, 0.4, 0.62, 0.8, 1].forEach(function (t) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(radiusAt(t), 0.9, 6, 40), latticeMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = t * H;
      g.add(ring);
    });

    // 顶部天线与观景平台
    addCylinder(g, 1.2, 2.2, 70, 0, H + 35, 0, latticeMat, 10);
    addCylinder(g, topR * 1.05, topR * 1.05, 6, 0, H - 8, 0, lambert(0xb8bec4), 24);
    // 基座广场
    addCylinder(g, 60, 66, 4, 0, 2, 0, lambert(0xb0a998), 36);

    return { group: g, height: H + 70, night: { latticeMat: latticeMat, coreMat: coreMat } };
  }

  /** 双子塔：方锥形玻璃塔身。 */
  function buildTwinTower(h, w, color, crownH) {
    var g = new THREE.Group();
    var r = w / Math.SQRT2;
    var bodyMat = glass(color, 0.92);
    var body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, h, 4, 1), bodyMat);
    body.rotation.y = Math.PI / 4;
    body.position.y = h / 2;
    g.add(body);
    var edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(r * 0.82, r, h, 4, 1)),
      new THREE.LineBasicMaterial({ color: 0xe8f2fa, transparent: true, opacity: 0.5 })
    );
    edges.rotation.y = Math.PI / 4;
    edges.position.y = h / 2;
    g.add(edges);
    if (crownH > 0) {
      addBox(g, w * 0.5, crownH, w * 0.5, 0, h + crownH / 2, 0, bodyMat);
    }
    addCylinder(g, w * 0.9, w, 6, 0, 3, 0, lambert(0x9aa2aa), 4);
    return { group: g, height: h + crownH, night: { glassMat: bodyMat } };
  }

  /** 中山纪念堂：八角重檐攒尖顶。 */
  function buildMemorialHall() {
    var g = new THREE.Group();
    var wallMat = lambert(0xf2ede2);
    var roofMat = lambert(0x2b5cab);
    var redMat = lambert(0xa03528);
    // 八角台基与墙体
    addCylinder(g, 58, 62, 6, 0, 3, 0, lambert(0xcac2b2), 8);
    addCylinder(g, 50, 52, 22, 0, 17, 0, wallMat, 8);
    // 红色廊柱
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      addCylinder(g, 1.6, 1.6, 20, 47 * Math.cos(a), 16, 47 * Math.sin(a), redMat, 10);
    }
    // 重檐八角攒尖顶
    var roof1 = new THREE.Mesh(new THREE.ConeGeometry(62, 22, 8), roofMat);
    roof1.position.y = 39;
    g.add(roof1);
    addCylinder(g, 30, 34, 12, 0, 52, 0, wallMat, 8);
    var roof2 = new THREE.Mesh(new THREE.ConeGeometry(38, 18, 8), roofMat);
    roof2.position.y = 67;
    g.add(roof2);
    // 金宝顶
    addCylinder(g, 0.5, 3, 8, 0, 80, 0, lambert(0xd8a83a), 8);
    return { group: g, height: 84 };
  }

  /** 陈家祠：三进院落、灰墙黛瓦岭南厅堂。 */
  function buildChenClan() {
    var g = new THREE.Group();
    var wallMat = lambert(0x9a938a);
    var roofMat = lambert(0x3f3f46);
    var trimMat = lambert(0x6e4a35);
    // 围墙
    addBox(g, 96, 6, 66, 0, 3, 0, wallMat);
    // 三进正厅
    var halls = [[-28, 15, 13], [0, 17, 15], [28, 15, 13]];
    halls.forEach(function (hh) {
      var hw = 34, hd = 18;
      addBox(g, hw, hh[1], hd, hh[0], hh[1] / 2 + 3, 0, wallMat);
      // 重檐
      addHipRoof(g, hw + 14, hd + 12, 5, hh[0], hh[1] + 3, 0, roofMat);
      addHipRoof(g, hw + 6, hd + 5, 6, hh[0], hh[1] + 8, 0, roofMat);
      // 屋脊灰塑装饰条
      addBox(g, hw * 0.7, 1.6, 2, hh[0], hh[1] + 14.5, 0, trimMat);
    });
    // 门前广场
    addBox(g, 100, 1, 30, 0, 0.5, 48, lambert(0xb8b0a2));
    return { group: g, height: 34 };
  }

  /** 石室圣心大教堂：花岗岩哥特双塔。 */
  function buildCathedral() {
    var g = new THREE.Group();
    var stone = lambert(0xb5aa96);
    var dark = lambert(0x4a4238);
    // 中厅
    addBox(g, 26, 26, 60, 0, 13, -8, stone);
    addHipRoof(g, 28, 62, 12, 0, 26, -8, dark);
    // 双钟塔
    [-11, 11].forEach(function (x) {
      addBox(g, 10, 40, 10, x, 20, 26, stone);
      var spire = new THREE.Mesh(new THREE.ConeGeometry(6.4, 22, 4), dark);
      spire.rotation.y = Math.PI / 4;
      spire.position.set(x, 51, 26);
      g.add(spire);
    });
    // 玫瑰窗
    var rose = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24), lambert(0x33465e));
    rose.position.set(0, 26, 23.2);
    g.add(rose);
    // 飞扶壁
    for (var i = 0; i < 4; i++) {
      var z = -26 + i * 14;
      addBox(g, 3, 14, 2, -15, 12, z, stone);
      addBox(g, 3, 14, 2, 15, 12, z, stone);
    }
    // 十字架
    addBox(g, 1, 8, 1, 0, 66, 26, stone);
    addBox(g, 4.5, 1, 1, 0, 65, 26, stone);
    return { group: g, height: 66 };
  }

  /** 沙面岛：欧陆风情小岛。 */
  function buildShamian() {
    var g = new THREE.Group();
    // 岛屿基座
    var island = new THREE.Mesh(new THREE.CylinderGeometry(95, 100, 5, 32), lambert(0xc9bd9b));
    island.scale.z = 0.55;
    island.position.y = 1;
    g.add(island);
    var green = new THREE.Mesh(new THREE.CylinderGeometry(88, 88, 5.4, 32), lambert(0x7fa663));
    green.scale.z = 0.5;
    green.position.y = 1.2;
    g.add(green);
    // 殖民建筑（粉彩墙面 + 孟莎屋顶）
    var colors = [0xf0e2c0, 0xe6cfa8, 0xdde4c8, 0xf2d8c8, 0xe8e0d0, 0xd8e0e8];
    var roofMat = lambert(0x5a5049);
    for (var i = 0; i < 6; i++) {
      var x = -60 + i * 24;
      var z = (i % 2 === 0) ? -14 : 14;
      var w = 16 + (i % 3) * 3;
      var h = 12 + (i % 2) * 4;
      addBox(g, w, h, 12, x, h / 2 + 3, z, lambert(colors[i]));
      addHipRoof(g, w + 4, 15, 5, x, h + 3, z, roofMat);
    }
    return { group: g, height: 24 };
  }

  /** 骑楼商业街（北京路/上下九共用）。 */
  function buildArcadeStreet(len, colorful) {
    var g = new THREE.Group();
    // 步行街路面
    addBox(g, 24, 1, len, 0, 0.5, 0, lambert(0xcfc8ba));
    var palette = colorful
      ? [0xe8b8c8, 0xc8d8b0, 0xf0d8a0, 0xb8d0e0, 0xe0c0a8, 0xd8c8e0]
      : [0xd9c2a0, 0xcbb494, 0xd0b898, 0xc4ad8c, 0xd9c2a0, 0xcbb494];
    var n = Math.floor(len / 26);
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 0; i < n; i++) {
        var z = -len / 2 + 13 + i * 26;
        var h = 13 + ((i * 7) % 3) * 2.5;
        var mat = lambert(palette[(i + (side > 0 ? 3 : 0)) % palette.length]);
        // 主体（底层后退形成骑楼廊）
        addBox(g, 12, h, 24, side * 20, h / 2 + 3, z, mat);
        // 廊柱
        for (var k = -1; k <= 1; k++) {
          addCylinder(g, 0.7, 0.7, 5, side * 13.5, 2.5, z + k * 9, lambert(0xefe8da), 8);
        }
        // 坡屋顶
        addHipRoof(g, 13, 25, 3.5, side * 20, h + 3, z, lambert(0x4a4038));
      }
    }
    return { group: g, height: 22 };
  }

  /** 五羊雕像（抽象风格化）。 */
  function buildFiveRams() {
    var g = new THREE.Group();
    var stone = lambert(0xcfc5b0);
    // 岩石基座
    var rock = new THREE.Mesh(new THREE.IcosahedronGeometry(14, 0), lambert(0x8d8578));
    rock.position.y = 8;
    rock.scale.set(1.2, 0.8, 1);
    g.add(rock);

    function ram(x, z, s, headUp) {
      var rg = new THREE.Group();
      var body = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 10), stone);
      body.scale.set(1.15, 1, 1.45);
      body.position.y = 5.5;
      rg.add(body);
      var head = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), stone);
      head.position.set(0, headUp ? 9.5 : 7.5, headUp ? 4.2 : 5.6);
      rg.add(head);
      // 双角
      [-1, 1].forEach(function (sx) {
        var horn = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.6, 6), stone);
        horn.position.set(sx * 1.1, (headUp ? 10.8 : 8.8), (headUp ? 3.6 : 5.2));
        horn.rotation.x = -0.5;
        rg.add(horn);
      });
      // 腿
      [[-1.6, 1.8], [1.6, 1.8], [-1.6, -1.8], [1.6, -1.8]].forEach(function (p) {
        addCylinder(rg, 0.5, 0.6, 3.4, p[0], 1.7, p[1], stone, 6);
      });
      rg.position.set(x, 12, z);
      rg.scale.setScalar(s);
      return rg;
    }

    g.add(ram(0, 0, 1.5, true));       // 主羊昂首
    g.add(ram(-9, 4, 1.0, false));
    g.add(ram(8, 5, 0.95, false));
    g.add(ram(-4, -7, 0.9, false));
    g.add(ram(6, -5, 0.85, false));
    return { group: g, height: 34 };
  }

  /** 镇海楼：五层红色楼阁。 */
  function buildZhenhaiTower() {
    var g = new THREE.Group();
    var red = lambert(0x9e3a2c);
    var roofMat = lambert(0x37404c);
    addBox(g, 40, 5, 26, 0, 2.5, 0, lambert(0xb8b0a2)); // 石台基
    var w = 32, d = 20;
    for (var i = 0; i < 5; i++) {
      var y = 5 + i * 9;
      addBox(g, w, 7.5, d, 0, y + 3.75, 0, red);
      addHipRoof(g, w + 8, d + 8, 4.5, 0, y + 7.5, 0, roofMat);
      w *= 0.88;
      d *= 0.88;
    }
    return { group: g, height: 55 };
  }

  /** 海心沙：亚运帆屏舞台小岛。 */
  function buildHaixinsha() {
    var g = new THREE.Group();
    var island = new THREE.Mesh(new THREE.CylinderGeometry(62, 66, 4, 32), lambert(0x86ab6a));
    island.scale.z = 0.55;
    island.position.y = 1.2;
    g.add(island);
    // 白色风帆屏幕（两片弧形帆）
    var sailMat = lambert(0xf4f6f8, { side: THREE.DoubleSide });
    [-14, 14].forEach(function (x) {
      var sail = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 22, 16, 1, true, 0, Math.PI * 0.55), sailMat);
      sail.position.set(x, 12, -6);
      sail.rotation.y = Math.PI * 0.7;
      g.add(sail);
    });
    return { group: g, height: 26 };
  }

  /** 猎德大桥：自锚式悬索桥。 */
  function buildLiedeBridge() {
    var g = new THREE.Group();
    var white = lambert(0xe8ecf0);
    var deckMat = lambert(0x6a7076);
    var LEN = 260, W = 16;
    // 桥面（沿 Z 方向跨江）
    addBox(g, W, 3, LEN, 0, 12, 0, deckMat);
    // 引桥墩
    for (var i = -3; i <= 3; i++) {
      if (i === 0) continue;
      addBox(g, 4, 12, 4, 0, 6, i * 36, deckMat);
    }
    var cableMat = new THREE.LineBasicMaterial({ color: 0xf2f5f8 });
    // 双塔 + 主缆 + 吊索
    [-46, 46].forEach(function (z0) {
      // 贝壳形桥塔（两根内倾柱 + 横梁）
      [-6, 6].forEach(function (x) {
        var leg = addBox(g, 3, 52, 3, x, 38, z0, white);
        leg.rotation.z = -x * 0.012;
      });
      addBox(g, 16, 3, 3, 0, 60, z0, white);
      // 主缆（塔顶到桥面两端的悬链线，用二次贝塞尔近似）
      [-W / 2 + 1, W / 2 - 1].forEach(function (x) {
        [-1, 1].forEach(function (dir) {
          var curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(x, 60, z0),
            new THREE.Vector3(x, 26, z0 + dir * 55),
            new THREE.Vector3(x, 14, z0 + dir * 115)
          );
          var pts = curve.getPoints(20);
          var geo = new THREE.BufferGeometry().setFromPoints(pts);
          g.add(new THREE.Line(geo, cableMat));
          // 吊索
          for (var j = 2; j < 10; j += 2) {
            var p = curve.getPoint(j / 10);
            var hg = new THREE.BufferGeometry().setFromPoints([
              p, new THREE.Vector3(x, 13.5, p.z)
            ]);
            g.add(new THREE.Line(hg, cableMat));
          }
        });
      });
    });
    return { group: g, height: 64 };
  }

  /** 广东省博物馆：黑色"月光宝盒"。 */
  function buildMuseum() {
    var g = new THREE.Group();
    var body = addBox(g, 64, 30, 44, 0, 15, 0, lambert(0x1d1d24));
    var edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({ color: 0x8a8f9a })
    );
    edges.position.copy(body.position);
    g.add(edges);
    // 表面镂空凹槽
    for (var i = 0; i < 5; i++) {
      addBox(g, 66, 1.2, 2, 0, 6 + i * 5, -22.2, lambert(0x3a3f4c));
    }
    return { group: g, height: 32 };
  }

  /** 广州大剧院：圆润双砾。 */
  function buildOperaHouse() {
    var g = new THREE.Group();
    var mat = glass(0x9aa4ac, 0.95);
    var big = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 18), mat);
    big.scale.set(1.35, 0.5, 1);
    big.position.set(-14, 8, 0);
    big.rotation.y = 0.5;
    g.add(big);
    var small = new THREE.Mesh(new THREE.SphereGeometry(20, 20, 14), mat);
    small.scale.set(1.25, 0.55, 1);
    small.position.set(30, 6, 14);
    small.rotation.y = -0.4;
    g.add(small);
    addCylinder(g, 60, 64, 2.5, 5, 1.2, 5, lambert(0xb8b4ac), 32);
    return { group: g, height: 24 };
  }

  /** 花城广场：中轴绿带 + 喷泉。 */
  function buildHuacheng() {
    var g = new THREE.Group();
    addBox(g, 90, 1.2, 300, 0, 0.6, 0, lambert(0x77a25e));
    addBox(g, 16, 1.4, 300, 0, 0.7, 0, lambert(0xcfc8ba)); // 中央步道
    var water = lambert(0x7fb8dd);
    [-90, 0, 90].forEach(function (z) {
      addCylinder(g, 12, 12, 1.8, 0, 1.2, z, water, 24);
    });
    return { group: g, height: 6 };
  }

  /** 二沙岛：江心绿岛 + 星海音乐厅。 */
  function buildErsha() {
    var g = new THREE.Group();
    var island = new THREE.Mesh(new THREE.CylinderGeometry(110, 115, 5, 36), lambert(0x86ab6a));
    island.scale.z = 0.42;
    island.position.y = 1.2;
    g.add(island);
    // 星海音乐厅：白色贝壳穹顶
    var shell = new THREE.Mesh(
      new THREE.SphereGeometry(26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      lambert(0xf0f2f0, { side: THREE.DoubleSide })
    );
    shell.scale.set(1.3, 0.6, 1);
    shell.position.set(-25, 3, 0);
    g.add(shell);
    // 广东美术馆：深色方盒
    addBox(g, 30, 12, 18, 38, 8, -5, lambert(0x2e2e34));
    return { group: g, height: 22 };
  }

  /** 海珠桥：钢桁架拱桥。 */
  function buildHaizhuBridge() {
    var g = new THREE.Group();
    var steel = lambert(0x5f6f68);
    var deckMat = lambert(0x7a7e82);
    var LEN = 220, W = 14;
    addBox(g, W, 3, LEN, 0, 12, 0, deckMat);
    for (var i = -2; i <= 2; i++) {
      addBox(g, 4, 12, 4, 0, 6, i * 44, deckMat);
    }
    // 钢拱肋（两跨）与吊杆
    [-1, 1].forEach(function (sx) {
      [-55, 55].forEach(function (zc) {
        var curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(sx * (W / 2 - 1), 13, zc - 50),
          new THREE.Vector3(sx * (W / 2 - 1), 34, zc),
          new THREE.Vector3(sx * (W / 2 - 1), 13, zc + 50)
        );
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.9, 6, false), steel));
        for (var j = 1; j < 8; j++) {
          var p = curve.getPoint(j / 8);
          addBox(g, 0.5, p.y - 13, 0.5, p.x, (p.y + 13) / 2, p.z, steel);
        }
      });
    });
    return { group: g, height: 36 };
  }

  /** 广州大桥：混凝土梁桥。 */
  function buildGzBridge() {
    var g = new THREE.Group();
    var mat = lambert(0x9aa0a4);
    var LEN = 230, W = 18;
    addBox(g, W, 3.5, LEN, 0, 11, 0, mat);
    for (var i = -3; i <= 3; i++) {
      addBox(g, 5, 11, 5, 0, 5.5, i * 32, mat);
    }
    [-W / 2 + 0.5, W / 2 - 0.5].forEach(function (x) {
      addBox(g, 0.8, 1.5, LEN, x, 14, 0, lambert(0xc8ccce));
    });
    return { group: g, height: 16 };
  }

  /** 白云山：群峰。 */
  function buildBaiyun() {
    var g = new THREE.Group();
    var mat = new THREE.MeshLambertMaterial({ color: 0x5d8f4e, flatShading: true });
    var peaks = [
      [0, 0, 320, 190], [-260, 60, 240, 140], [240, 80, 260, 155],
      [-120, -160, 200, 120], [160, -140, 210, 128], [420, -40, 180, 100]
    ];
    peaks.forEach(function (p) {
      var cone = new THREE.Mesh(new THREE.ConeGeometry(p[2], p[3], 7), mat);
      cone.position.set(p[0], p[3] / 2 - 4, p[1]);
      cone.rotation.y = p[0] * 0.01;
      g.add(cone);
    });
    // 摩星岭标志塔
    addCylinder(g, 2, 4, 26, 0, 195, 0, lambert(0xe8e4da), 8);
    return { group: g, height: 210 };
  }

  /* ---------------- 文字标签 ---------------- */

  function makeLabel(text) {
    var font = 'bold 44px "Microsoft YaHei", "PingFang SC", sans-serif';
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    ctx.font = font;
    var w = Math.ceil(ctx.measureText(text).width) + 36;
    canvas.width = w;
    canvas.height = 64;
    ctx = canvas.getContext('2d');
    ctx.font = font;
    ctx.fillStyle = 'rgba(10, 16, 26, 0.55)';
    ctx.beginPath();
    ctx.moveTo(8, 4);
    ctx.lineTo(w - 8, 4);
    ctx.arcTo(w - 4, 4, w - 4, 12, 8);
    ctx.lineTo(w - 4, 52);
    ctx.arcTo(w - 4, 60, w - 12, 60, 8);
    ctx.lineTo(8, 60);
    ctx.arcTo(4, 60, 4, 52, 8);
    ctx.lineTo(4, 12);
    ctx.arcTo(4, 4, 12, 4, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, 33);
    var tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(w * 0.32, 64 * 0.32, 1);
    return sprite;
  }

  /* ---------------- 构建入口 ---------------- */

  var BUILDERS = {
    'canton-tower': buildCantonTower,
    'ctf': function () { return buildTwinTower(380, 46, 0x86a8c8, 26); },
    'ifc': function () { return buildTwinTower(320, 44, 0x92b2cc, 0); },
    'huacheng': buildHuacheng,
    'opera': buildOperaHouse,
    'museum': buildMuseum,
    'haixinsha': buildHaixinsha,
    'liede': buildLiedeBridge,
    'ersha': buildErsha,
    'gz-bridge': buildGzBridge,
    'haizhu-bridge': buildHaizhuBridge,
    'memorial': buildMemorialHall,
    'chen-clan': buildChenClan,
    'cathedral': buildCathedral,
    'shamian': buildShamian,
    'beijing-road': function () { return buildArcadeStreet(170, false); },
    'shangxiajiu': function () { return buildArcadeStreet(190, true); },
    'five-rams': buildFiveRams,
    'zhenhai': buildZhenhaiTower,
    'baiyun': buildBaiyun
  };

  /**
   * 构建全部地标并加入场景。
   *
   * Args:
   *   scene: THREE.Scene。
   * Returns:
   *   {group, clickables, night} —— group 为总组；clickables 为可点击对象；
   *   night 收集需要日夜切换的材质引用。
   */
  function build(scene) {
    var group = new THREE.Group();
    var clickables = [];
    var night = {};

    DATA.forEach(function (d) {
      var builder = BUILDERS[d.id];
      if (!builder) return;
      var res = builder();
      var g = res.group;
      g.position.set(d.pos[0], 0, d.pos[1]);
      d.height = res.height;
      if (res.night) {
        Object.keys(res.night).forEach(function (k) { night[d.id + '.' + k] = res.night[k]; });
      }
      // 标签
      var label = makeLabel(d.name);
      label.position.set(0, res.height + 22, 0);
      g.add(label);
      // 全部子对象标记 landmarkId，供点击拾取
      g.traverse(function (child) {
        child.userData.landmarkId = d.id;
        if (child.isMesh || child.isSprite || child.isLine) clickables.push(child);
      });
      group.add(g);
    });

    scene.add(group);
    return { group: group, clickables: clickables, night: night };
  }

  return {
    DATA: DATA,
    byId: byId,
    build: build
  };
})();
