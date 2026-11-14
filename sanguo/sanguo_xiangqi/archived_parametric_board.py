# -*- coding: utf-8 -*-
"""【已废弃 / 仅留档，不要用于交付】参数化扇形重绘开局棋盘。

废弃原因：该几何把三方画成被大片野区隔开的三块孤岛，而实物照片上
三方网格是连续拼接、彼此相通的一整片。正确实现见 render_real_board.py
（直接以照片描摹线稿为底图、把棋子摆到实测交点上）。

本脚本保留只为记录当时的错误模型；所有输出改加 parametric_ 前缀，
避免重跑时覆盖正确主图。详见规格文档 2.1.2。

产出：
  board_parametric_view.png       参数化开局图（错误几何，仅供参考）
  board_parametric_views.png      三方各自视角
  board_parametric_point_ids.png  点位编号
  board_parametric_coords.json    参数化渲染坐标
"""
import json
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = r'C:\Users\Administrator\WorkBuddy\2026-11-13-17-06-27\sanguo_xiangqi'
os.makedirs(ROOT, exist_ok=True)

W, H = 1400, 1200
OX, OY = 700.0, 600.0
FRAME = (30, 20, 1370, 1180)
PAPER = '#CBA65C'       # 棋盘底色
HEX_FILL = '#C0964C'     # 中央六边形（略深，便于看清轮廓）
WILD = '#E2CD9E'         # 野区 / 四角留白（浅）
INK = '#231F19'
COLORS = {'A': '#B03228', 'B': '#2C3E50', 'C': '#2E7D52'}
NAMES = {'A': 'A 方（下）', 'B': 'B 方（左上）', 'C': 'C 方（右上）'}
ROT = {'A': 0.0, 'B': 120.0, 'C': -120.0}   # 生成 B/C 时把 A 绕中心旋转的角度
TEXT_ROT = {'A': 0.0, 'B': -120.0, 'C': 120.0}  # 棋面文字朝向（保证本方视角下为正）

FILES, RANKS = 9, 5
PIECE_R = 23


def font(size):
    for p in (r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simhei.ttf',
              r'C:\Windows\Fonts\simsun.ttc'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def rotate_point(p, deg, origin=(OX, OY)):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    x, y = p[0] - origin[0], p[1] - origin[1]
    return (origin[0] + x * c - y * s, origin[1] + x * s + y * c)


# ---------- 1. 中央六边形 ----------
# 顶点方向 0/60/120/180/240/300 度；上下为平边，左右为尖角
HEX_R = 190.0
HEX = [(OX + HEX_R * math.cos(math.radians(a)),
        OY + HEX_R * math.sin(math.radians(a))) for a in range(0, 360, 60)]


# ---------- 2. 三方 9x5 点位 ----------
def base_A():
    """A 方（正下）45 点：底线是一条水平直线，前线是向中央收拢的折线。

    另外两方由这 45 点绕中心旋转 ±120 度得到，因此三方底线都是直线段，
    斜切过左上 / 右上角，四角自然留出三角空白。
    """
    p0, p4 = {}, {}
    # 前线（国境线）是折线：中央尖角最靠近中心，两端向外下张开
    left_end, apex, right_end = (420.0, 870.0), (700.0, 775.0), (980.0, 870.0)
    for f in range(FILES):
        p0[f] = (OX + (f - 4) * 85.0, FRAME[3])
        if f <= 4:
            k = f / 4.0
            p4[f] = (left_end[0] + (apex[0] - left_end[0]) * k,
                     left_end[1] + (apex[1] - left_end[1]) * k)
        else:
            k = (f - 4) / 4.0
            p4[f] = (apex[0] + (right_end[0] - apex[0]) * k,
                     apex[1] + (right_end[1] - apex[1]) * k)
    out = {}
    for f in range(FILES):
        for r in range(RANKS):
            k = r / 4.0
            out[(f, r)] = (p0[f][0] * (1 - k) + p4[f][0] * k,
                           p0[f][1] * (1 - k) + p4[f][1] * k)
    return out


BASE = base_A()
POINTS = {s: {fr: rotate_point(p, ROT[s]) for fr, p in BASE.items()}
          for s in ('A', 'B', 'C')}

PALACE = {}
for s in ('A', 'B', 'C'):
    PALACE[s] = [POINTS[s][(3, 0)], POINTS[s][(5, 2)],
                 POINTS[s][(5, 0)], POINTS[s][(3, 2)]]
CROSS_MARKS = [(1, 2), (7, 2), (0, 3), (2, 3), (4, 3), (6, 3), (8, 3)]

# ---------- 3. 开局摆子 ----------
BACK = ['车', '马', '相', '仕', '帅', '仕', '相', '马', '车']
PIECES = []
for s in ('A', 'B', 'C'):
    for f in range(FILES):
        PIECES.append((s, f, 0, BACK[f]))
    for f in (1, 7):
        PIECES.append((s, f, 2, '炮'))
    for f in (0, 2, 4, 6, 8):
        PIECES.append((s, f, 3, '兵'))
assert len(PIECES) == 48


# ---------- 4. 绘制 ----------
def dashed(draw, p1, p2, fill, width=2, dash=9, gap=7):
    x1, y1 = p1
    x2, y2 = p2
    dist = math.hypot(x2 - x1, y2 - y1)
    if dist == 0:
        return
    ux, uy = (x2 - x1) / dist, (y2 - y1) / dist
    t = 0.0
    while t < dist:
        e = min(t + dash, dist)
        draw.line([(x1 + ux * t, y1 + uy * t), (x1 + ux * e, y1 + uy * e)],
                  fill=fill, width=width)
        t = e + gap


def wild_polygons():
    """三块野梯形：从外框中段各延伸一段，分别接到六边形的上边、左下边、右下边。

    六边形剩下的三条边（下边、左上边、右上边）正对三个阵营的前线。
    """
    top_y, bot_y = FRAME[1], FRAME[3]
    left_x, right_x = FRAME[0], FRAME[2]
    # 上：上边中点左右各 70
    up = [(OX - 70, top_y), (OX + 70, top_y), HEX[5], HEX[4]]
    # 左下：左边框 y=987 上下各 70
    ll = [(left_x, 987 - 70), HEX[3], HEX[2], (left_x, 987 + 70)]
    # 右下：右边框 y=987 上下各 70
    rr = [(right_x, 987 - 70), HEX[0], HEX[1], (right_x, 987 + 70)]
    return [up, ll, rr]


WILDS = wild_polygons()
C = 245
CORNERS = [
    [(FRAME[0], FRAME[1]), (FRAME[0] + C, FRAME[1]), (FRAME[0], FRAME[1] + C)],
    [(FRAME[2], FRAME[1]), (FRAME[2] - C, FRAME[1]), (FRAME[2], FRAME[1] + C)],
    [(FRAME[0], FRAME[3]), (FRAME[0] + C, FRAME[3]), (FRAME[0], FRAME[3] - C)],
    [(FRAME[2], FRAME[3]), (FRAME[2] - C, FRAME[3]), (FRAME[2], FRAME[3] - C)],
]


def draw_board(d, with_ids=False):
    # 三方网格
    for s in ('A', 'B', 'C'):
        pts = POINTS[s]
        for f in range(FILES):
            d.line([pts[(f, 0)], pts[(f, 4)]], fill=INK, width=2)
        for r in range(RANKS):
            for f in range(FILES - 1):
                d.line([pts[(f, r)], pts[(f + 1, r)]], fill=INK, width=2)
        dashed(d, PALACE[s][0], PALACE[s][1], INK, 2, 8, 6)
        dashed(d, PALACE[s][2], PALACE[s][3], INK, 2, 8, 6)
        for f, r in CROSS_MARKS:
            x, y = pts[(f, r)]
            for dx, dy in ((-9, -9), (9, 9), (-9, 9), (9, -9)):
                d.line([(x + dx * 0.35, y + dy * 0.35), (x + dx, y + dy)],
                       fill=INK, width=2)
    # 野区（覆盖可能外溢的网格线）
    for poly in WILDS:
        d.polygon(poly, fill=WILD, outline=INK)
    # 中央六边形（最后填充，保证轮廓完整清晰）
    d.polygon(HEX, fill=HEX_FILL, outline=INK, width=3)
    # 四角禁区
    for poly in CORNERS:
        d.polygon(poly, fill=WILD, outline=INK)
    if with_ids:
        fnt = font(13)
        for s in ('A', 'B', 'C'):
            for (f, r), p in POINTS[s].items():
                d.text((p[0] + 6, p[1] - 14), '%d%d' % (f, r), fill=COLORS[s], font=fnt)


def put_rotated_text(img, text, xy, fnt, fill, angle):
    bbox = fnt.getbbox(text)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tile = Image.new('RGBA', (tw + 24, th + 24), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((12 - bbox[0], 12 - bbox[1]), text, font=fnt, fill=fill)
    tile = tile.rotate(angle, expand=True, resample=Image.BICUBIC)
    img.paste(tile, (int(xy[0] - tile.width / 2), int(xy[1] - tile.height / 2)), tile)


def draw_piece(img, x, y, char, color, angle):
    d = ImageDraw.Draw(img)
    r = PIECE_R
    d.ellipse([x - r - 3, y - r - 3, x + r + 3, y + r + 3], fill=INK)
    d.ellipse([x - r, y - r, x + r, y + r], fill='#F6E9CB', outline=color, width=3)
    d.ellipse([x - r + 6, y - r + 6, x + r - 6, y + r - 6], outline=color, width=1)
    put_rotated_text(img, char, (x, y), font(26), color, angle)


def make_board(with_pieces=True, with_ids=False):
    img = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(img)
    d.rectangle(FRAME, outline=INK, width=4)
    draw_board(d, with_ids=with_ids)
    if with_pieces:
        for s, f, r, ch in PIECES:
            x, y = POINTS[s][(f, r)]
            draw_piece(img, x, y, ch, COLORS[s], TEXT_ROT[s])
    return img


def add_caption(img, title, lines, top=64, bottom=150):
    PL, PR = 40, 40
    canvas = Image.new('RGB', (img.width + PL + PR, img.height + top + bottom), '#FAF6EC')
    canvas.paste(img, (PL, top))
    d = ImageDraw.Draw(canvas)
    d.rectangle([PL - 1, top - 1, PL + img.width, top + img.height], outline=INK, width=2)
    d.text((canvas.width / 2, 34), title, fill=INK, font=font(30), anchor='mm')
    y = top + img.height + 20
    for i, t in enumerate(lines):
        d.text((PL + 4, y + i * 26), t, fill=INK, font=font(18))
    return canvas


MAIN_LINES = [
    '每方 16 子：底线 车马相仕帅仕相马车，第 3 行两炮，第 4 行五兵；共 48 子',
    '棋面文字按各玩家朝向旋转：A 方正，B 方 -120 度，C 方 +120 度（本方视角下为正）',
    '中央六边形与三块「野」梯形为河界带（无落子点）；四角三角为四夷禁区',
    '本图按对实物照片的理解参数化重绘，用于核对布局与摆法；像素级复刻见 board_topology.png',
]

main = make_board()
add_caption(main, '三国象棋 · 玩家看到的开局棋盘（全局俯视 / A 方视角）',
            MAIN_LINES).save(os.path.join(ROOT, 'board_parametric_view.png'))

add_caption(make_board(with_pieces=False, with_ids=True),
            '三国象棋 · 点位编号对照（f = 路 0-8，r = 线 0-4）',
            ['每方 9 路 x 5 线 = 45 点，共 135 点；r=0 为本方底线，r=4 为国境线',
             '编号示例：40 = 中路底线（帅位），12 = 左炮位，03 = 左端兵位',
             '颜色仅用于区分三方，不代表实物棋子颜色']).save(
    os.path.join(ROOT, 'board_parametric_point_ids.png'))

# ---------- 5. 三方各自视角 ----------
import numpy as np

PAPER_RGB = np.array([203, 166, 92])
TILE = 620
tiles = []
for s in ('A', 'B', 'C'):
    deg = {'A': 0.0, 'B': 120.0, 'C': -120.0}[s]
    v = main.rotate(deg, expand=True, resample=Image.BICUBIC, fillcolor=PAPER)
    # 裁掉旋转产生的三角形留白
    arr = np.asarray(v).astype(int)
    mask = np.abs(arr - PAPER_RGB).sum(axis=2) > 40
    ys, xs = np.where(mask)
    if len(xs):
        pad = 10
        v = v.crop((max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad),
                    min(v.width, int(xs.max()) + pad), min(v.height, int(ys.max()) + pad)))
    k = min(TILE / v.width, TILE / v.height)
    v = v.resize((int(v.width * k), int(v.height * k)), Image.LANCZOS)
    tile = Image.new('RGB', (TILE, TILE), PAPER)
    tile.paste(v, ((TILE - v.width) // 2, (TILE - v.height) // 2))
    tiles.append((s, tile))

VW, VH = TILE * 3 + 40 * 4, TILE + 160
board3 = Image.new('RGB', (VW, VH), '#FAF6EC')
d3 = ImageDraw.Draw(board3)
for i, (s, tile) in enumerate(tiles):
    x = 40 + i * (TILE + 40)
    board3.paste(tile, (x, 66))
    d3.rectangle([x - 1, 65, x + TILE, 66 + TILE], outline=INK, width=2)
    d3.text((x + TILE / 2, 38), NAMES[s] + ' 视角', fill=COLORS[s], font=font(24), anchor='mm')
d3.text((VW / 2, VH - 42),
        '把棋盘转到该玩家坐下的方向：本方棋子在下、棋面文字为正；另两方的字是斜的',
        fill=INK, font=font(20), anchor='mm')
board3.save(os.path.join(ROOT, 'board_parametric_views.png'))

# ---------- 6. 坐标导出 ----------
coords = {
    'note': '参数化重绘棋盘的渲染坐标（画布 1400x1200），非照片像素坐标；仅用于渲染对齐',
    'canvas': [W, H], 'center': [OX, OY], 'frame': list(FRAME),
    'hexagon': [[round(x, 1), round(y, 1)] for x, y in HEX],
    'wild_polygons': [[[round(x, 1), round(y, 1)] for x, y in p] for p in WILDS],
    'corners': [[[round(x, 1), round(y, 1)] for x, y in p] for p in CORNERS],
    'points': {'%s%d%d' % (s, f, r): [round(p[0], 1), round(p[1], 1)]
               for s in ('A', 'B', 'C') for (f, r), p in POINTS[s].items()},
}
with open(os.path.join(ROOT, 'board_parametric_coords.json'), 'w', encoding='utf-8') as fp:
    json.dump(coords, fp, ensure_ascii=False, indent=2)

print('OK pieces=%d points=%d wilds=%d' % (len(PIECES), len(coords['points']), len(WILDS)))
print('OUTPUT', ROOT)
