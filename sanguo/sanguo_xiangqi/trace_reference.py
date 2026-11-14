# -*- coding: utf-8 -*-
"""从棋盘照片提取干净线稿，输出与实物几何一致的棋盘图。

产出：
  board_reference_traced.png   纯线稿（无标注、无边距），供程序 / 开发直接使用
  board_topology.png           线稿 + 标题图例，作为文档主图
  board_topology.svg           同一线稿的 SVG 容器（内嵌位图，便于文档引用）

与旧版 board_abstract_topology.* 的区别：
  旧版是「逻辑拓扑抽象示意」，用三个窄扇形 + 双层六边形近似，不按实物比例；
  本脚本直接从照片提取线条，形状、分区、线条走向与实物逐线一致。
"""
import base64
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = r'C:\Users\Administrator\Pictures\1794503245273--1957710062.jpg'
ROOT = r'C:\Users\Administrator\WorkBuddy\2026-11-13-17-06-27\sanguo_xiangqi'
os.makedirs(ROOT, exist_ok=True)

# 由黑像素行列投影测得的棋盘内框（原图 1400x1400）
BOX = (166, 253, 1290, 1216)

# ---------- 1. 背景校正 + 线条提取 ----------
gray = Image.open(SRC).convert('L').crop(BOX)
bg = gray.filter(ImageFilter.GaussianBlur(22))
g = np.asarray(gray).astype(np.float32)
b = np.asarray(bg).astype(np.float32)

# 比局部背景暗多少 -> 线条/墨迹强度；同时要求像素本身偏暗，排除纸面亮斑
diff = b - g
alpha = np.clip((diff - 22.0) / 48.0, 0.0, 1.0)
alpha *= np.clip((165.0 - g) / 45.0, 0.0, 1.0)

PAPER = np.array([203, 166, 92], dtype=np.float32)
INK = np.array([26, 25, 22], dtype=np.float32)
rgb = PAPER[None, None, :] * (1.0 - alpha[..., None]) + INK[None, None, :] * alpha[..., None]
traced = Image.fromarray(rgb.astype(np.uint8), 'RGB')

SCALE = 1.2
traced = traced.resize((int(traced.width * SCALE), int(traced.height * SCALE)), Image.LANCZOS)
traced.save(os.path.join(ROOT, 'board_reference_traced.png'))


def font(size):
    for p in (r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simhei.ttf',
              r'C:\Windows\Fonts\simsun.ttc'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


# ---------- 2. 文档主图：线稿 + 图例 ----------
PL, PR, PT, PB = 42, 42, 84, 168
W, H = traced.size
canvas = Image.new('RGB', (W + PL + PR, H + PT + PB), '#FAF6EC')
canvas.paste(traced, (PL, PT))
d = ImageDraw.Draw(canvas)
d.rectangle([PL - 1, PT - 1, PL + W, PT + H], outline='#3A3226', width=2)
d.text((canvas.width / 2, 42), '三国象棋棋盘（按实物照片逐线描摹）',
       fill='#3A3226', font=font(30), anchor='mm')

legend = [
    '三方阵营：各九路五线，共 135 个落子点；十字标记为炮位与兵位，虚线 X 为九宫',
    '中央六边形 + 三块「野」区：无网格，属河界带，不设落子点',
    '四角：羌族 / 乌丸 / 南蛮 / 山越，为禁区，不可落子、不可穿越',
    '本图几何与实物一致；跨河逻辑连线与点位编号见 board_abstract_topology.png 与 board_spec.json',
]
y = PT + H + 26
for i, text in enumerate(legend):
    d.text((PL + 4, y + i * 27), text, fill='#3A3226', font=font(19))
canvas.save(os.path.join(ROOT, 'board_topology.png'))

# ---------- 3. SVG 容器（内嵌位图，保证单独打开也能显示） ----------
with open(os.path.join(ROOT, 'board_topology.png'), 'rb') as fp:
    b64 = base64.b64encode(fp.read()).decode('ascii')
cw, ch = canvas.size
svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
    'viewBox="0 0 %d %d" width="%d" height="%d">\n'
    '<title>三国象棋棋盘（按实物照片逐线描摹）</title>\n'
    '<image x="0" y="0" width="%d" height="%d" xlink:href="data:image/png;base64,%s"/>\n'
    '</svg>\n'
) % (cw, ch, cw, ch, cw, ch, b64)
with open(os.path.join(ROOT, 'board_topology.svg'), 'w', encoding='utf-8') as fp:
    fp.write(svg)

print('OK traced=%dx%d canvas=%dx%d' % (W, H, cw, ch))
print('OUTPUT', ROOT)
