# CS 1.6 · fy_iceworld（田字雪地）— 网页复刻

基于原版 `fy_iceworld.bsp` **1:1 解析**还原的浏览器版反恐精英死斗模式。
纯静态网页，无构建步骤，无外部素材依赖（贴图/音效/模型全部程序化或取自原版 BSP）。

![tech](https://img.shields.io/badge/three.js-r160-black) ![map](https://img.shields.io/badge/map-fy__iceworld--BSP--v30-green)

## 运行

```powershell
cd cs-iceworld
python -m http.server 8124 --bind 127.0.0.1
# 浏览器打开 http://127.0.0.1:8124/index.html
```

> 必须通过 HTTP 访问（ES Module + fetch 不支持 file://）。

## 玩法

- **单机死斗**：5v5（可选 3v3 / 7v7 / 11v11），3 个难度档
- 先达 **30 杀** 或 **5 分钟** 判胜负；死亡 3 秒后原地重生
- 出生在己方半场（T 南 / CT 北），主武器掉落于场地两侧，走过去**自动拾取**，F 换枪
- `B` 在出生点购买（AK/M4/AWP/MP5/P90… + 防弹衣），击杀得 $300（狙击 $100 / 霰弹 $900 / 刀 $1500）

### 键位

| 键 | 功能 | 键 | 功能 |
|---|---|---|---|
| WASD | 移动 | 鼠标左键 | 开火 |
| 空格 | 跳跃 | 鼠标右键 | 开镜（AUG/AWP） |
| Ctrl / C | 下蹲 | R | 换弹 |
| Shift | 静步 | 1/2/3 · 滚轮 · Q | 切枪 |
| B | 购买菜单 | TAB | 计分板 |
| F | 换取地上枪械 | ESC | 释放鼠标 |

## 地图数据来源

全部取自原版 `fy_iceworld.bsp`（GoldSrc BSP v30，208KB）：

- **几何**：316 个面 → 775 个渲染三角形（含 UV、逐面法线、绕序修正）
- **贴图**：`lv_marble` 256×256 从 BSP 内嵌 miptex + 调色板精确解码；
  `snow` / `c_stone1` 为外置 WAD 不可得，构建期程序化生成等尺寸 PNG 兜底
- **实体**：12 个 T 出生点（`info_player_deathmatch`）、12 个 CT 出生点
  （`info_player_start`）、24 把地面枪（`armoury_entity`）、购买区、灯光
- **坐标**：GoldSrc `(x,y,z)` → three.js `(x,z,-y)`；`yaw = deg(angle-90)`

重新生成地图数据：

```powershell
node tools/build-map.js   # 输出 data/map.json + data/textures/*.png
```

## 项目结构

```
cs-iceworld/
├── index.html            # 入口（importmap → three）
├── css/style.css         # CS1.6 风格界面
├── lib/three.module.js   # three.js r160（本地化）
├── data/
│   ├── map.json          # BSP 解析产物（几何/出生点/枪位）
│   └── textures/         # 0=lv_marble(原版) 1=snow 2=c_stone1(程序化)
├── js/
│   ├── main.js           # 状态机 · 输入 · 命中判定 · 死斗规则
│   ├── map.js            # 地图加载 · Raycaster 碰撞/视线
│   ├── player.js         # GoldSrc 风格移动（摩擦/加速/空 strafe）
│   ├── bots.js           # Bot AI（感知节流/瞄准转向/走位/复活）
│   ├── weapons.js        # 16 种武器 CS1.6 数值 · 后坐力 · 视图模型
│   ├── models.js         # 程序化枪械/角色模型
│   ├── effects.js        # 弹痕/曳光/血雾/火花
│   ├── audio.js          # WebAudio 程序化音效（无素材）
│   └── hud.js            # 雷达/计分板/买枪/击杀播报
└── tools/
    ├── build-map.js      # BSP 解析器 + PNG 编码器（纯 Node）
    └── bsp/maps/fy_iceworld.bsp
```

## 技术要点

- **碰撞**：对地图网格做 Raycaster 圆柱探测（半径 13、高 72、3 档高度探测、轴分离滑动）
- **命中**：射线 vs 准星扩散 → 命中盒（头 15u / 身体），头部 ×4 爆头，距离衰减
- **移动**：Quake/HL 的 friction(4) / accelerate(5.5) / 空中 accelerate(10, wish≤30)，可空 strafe
- **Bot**：3 档技能表（反应/散布/瞄准速率/射程），0.12s 感知节流 + LOS 判定，
  远拉近打 + 横向 strafe + burst 开火 + 巡逻换点
- **雷达**：从 BSP 几何提取墙顶多边形实时绘制，随视角旋转，队友常显、敌人暴露 3 秒显示
