# -*- coding: utf-8 -*-
"""在「照片描摹线稿」上摆子，生成玩家真正看到的开局棋盘。

关键点：棋盘几何完全来自实物照片（board_reference_traced.png），
三方网格连续拼接、在三个腰部接点相通，不再用参数化扇形近似。
135 个落子点来自对线稿的长直线求交（detect_pts.py 的结果），
按每方 9 路 x 5 线编号后摆入 48 枚棋子。

产出：
  board_player_view.png      真实棋盘开局图（A 方视角，48 子）
  board_player_views.png     三方各自视角
  board_point_ids.png        真实线稿 + 点位编号
  board_real_coords.json     135 点的照片像素坐标（供开发对齐）
  board_connectivity.png     连通关系标注（三方网格相接处 + 跨区对接线）
"""
import itertools
import json
import math
import os
from collections import defaultdict

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = r'C:\Users\Administrator\WorkBuddy\2026-11-13-17-06-27\sanguo_xiangqi'
os.makedirs(ROOT, exist_ok=True)
TRACED = os.path.join(ROOT, 'board_reference_traced.png')


def detect_intersections(path):
    """长直线（>=110 px）两两求交并聚类，得到网格交点候选。

    艺术字笔画短，几乎不产生长线段，因此比逐点模板匹配稳健。
    只依赖 trace_reference.py 产出的线稿，脚本自包含。
    """
    import cv2
    im = cv2.imread(path)
    hh, ww = im.shape[:2]
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    bw = (g < 115).astype(np.uint8) * 255
    ls = cv2.HoughLinesP(bw, 1, np.pi / 720, threshold=55,
                         minLineLength=110, maxLineGap=16)
    segs = []
    for x1, y1, x2, y2 in np.asarray(ls).reshape(-1, 4):
        x1, y1, x2, y2 = map(float, (x1, y1, x2, y2))
        ang = math.degrees(math.atan2(y2 - y1, x2 - x1)) % 180.0
        segs.append((x1, y1, x2, y2, ang))

    def cross(s1, s2):
        x1, y1, x2, y2, _ = s1
        x3, y3, x4, y4, _ = s2
        d1 = (x2 - x1, y2 - y1)
        d2 = (x4 - x3, y4 - y3)
        den = d1[0] * d2[1] - d1[1] * d2[0]
        if abs(den) < 1e-6:
            return None
        t = ((x3 - x1) * d2[1] - (y3 - y1) * d2[0]) / den
        u = ((x3 - x1) * d1[1] - (y3 - y1) * d1[0]) / den
        if not (-0.12 <= t <= 1.12 and -0.12 <= u <= 1.12):
            return None
        return (x1 + t * d1[0], y1 + t * d1[1])

    cand = []
    for i in range(len(segs)):
        for j in range(i + 1, len(segs)):
            da = abs(segs[i][4] - segs[j][4])
            da = min(da, 180 - da)
            if da < 22:
                continue
            p = cross(segs[i], segs[j])
            if p and 5 < p[0] < ww - 5 and 5 < p[1] < hh - 5:
                cand.append(p)

    buckets = {}
    for x, y in cand:
        buckets.setdefault((int(x // 11), int(y // 11)), []).append((x, y))
    clusters = [(sum(p[0] for p in v) / len(v),
                 sum(p[1] for p in v) / len(v), len(v))
                for v in buckets.values()]
    merged = []
    for cx, cy, n in sorted(clusters, key=lambda t: -t[2]):
        if all(math.hypot(cx - mx, cy - my) > 13 for mx, my, _ in merged):
            merged.append((cx, cy, n))
    return merged


base = Image.open(TRACED).convert('RGB')
W, H = base.size
OX, OY = W / 2.0, H / 2.0
# 底线的落子点几乎贴着照片边缘，直接画棋子会被裁掉；加一圈同色纸边
PAD = 48
PADDED = Image.new('RGB', (W + 2 * PAD, H + 2 * PAD), '#CBA65C')
PADDED.paste(base, (PAD, PAD))


def rp(key):
    """把照片像素坐标换算到加了纸边的渲染画布坐标。"""
    x, y = POINTS[key]
    return (x + PAD, y + PAD)
raw = detect_intersections(TRACED)                        # [x, y, votes]

PAPER = '#CBA65C'
INK = '#231F19'
# 专利 CN87205572U：黑方魏（左上）、红方蜀（下方）、黄方吴（右上）
COLORS = {'A': '#B03228', 'B': '#26313F', 'C': '#8A6A00'}
NAMES = {'A': '蜀（红，下方）', 'B': '魏（黑，左上）', 'C': '吴（黄，右上）'}
TEXT_ROT = {'A': 0.0, 'B': -120.0, 'C': 120.0}
# 把某方的点旋转到「下方阵营」姿态所需的角度
ROT_TO_A = {'A': 0.0, 'B': -120.0, 'C': 120.0}
PIECE_R = 29          # 棋子半径（最小落子点间距约 70.7，直径 58 仍留间隙）
PIECE_FONT = 34       # 棋面字号
FILES, RANKS = 9, 5


def font(size):
    for p in (r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simhei.ttf',
              r'C:\Windows\Fonts\simsun.ttc'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def rotate(p, deg, origin=(OX, OY)):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    dx, dy = p[0] - origin[0], p[1] - origin[1]
    return (origin[0] + dx * c - dy * s, origin[1] + dx * s + dy * c)


def sector(x, y, shift):
    a = (math.degrees(math.atan2(y - OY, x - OX)) + shift) % 360
    if 30 <= a < 150:
        return 'A'
    if 150 <= a < 270:
        return 'B'
    return 'C'


def find_col(items, bp):
    """沿纵线找与底线种子共线的点。照片的纵线是放射直线，同列 5 点严格共线。

    items 元素为 (x', y', 原图坐标)。返回按 y' 降序（外 -> 内）的三元组列表。
    """
    best = None
    for q in items:
        dx, dy = q[0] - bp[0], q[1] - bp[1]
        if dy > -30:
            continue
        L = math.hypot(dx, dy)
        if L < 40 or abs(math.degrees(math.atan2(dx, -dy))) > 42:
            continue
        ux, uy = dx / L, dy / L
        inl = [it for it in items
               if abs((it[0] - bp[0]) * uy - (it[1] - bp[1]) * ux) < 7.5
               and it[1] <= bp[1] + 6]
        if best is None or len(inl) > len(best):
            best = inl
    return sorted(best, key=lambda p: -p[1]) if best else []


def pick_five(col):
    """同列取 5 个纵向等间距最好的点，剔除野区艺术字造成的孤立误检点。"""
    if len(col) < 5:
        return None, 1e6
    if len(col) == 5:
        return col, 0.0
    best, err = None, 1e9
    for combo in itertools.combinations(range(len(col)), 5):
        sel = [col[i] for i in combo]
        e = float(np.std(np.diff([p[1] for p in sel])))
        if e < err:
            err, best = e, sel
    return best, err


def calibrate(shift):
    sec = {'A': [], 'B': [], 'C': []}
    for x, y, votes in raw:
        s = sector(x, y, shift)
        rp = rotate((x, y), ROT_TO_A[s])
        sec[s].append((rp[0], rp[1], (x, y)))
    out, score, detail = {}, 0.0, {}
    for s in ('A', 'B', 'C'):
        items = sec[s]
        maxy = max(p[1] for p in items)
        bottom = sorted([p for p in items if p[1] > maxy - 25], key=lambda p: p[0])
        if len(bottom) != 9:
            bottom = sorted(sorted(items, key=lambda p: -p[1])[:9], key=lambda p: p[0])
        detail[s] = {'total': len(items), 'bottom': len(bottom),
                     'bottom_y': [round(p[1]) for p in bottom]}
        if len(bottom) != 9:
            return None, 1e9, detail
        for f, bp in enumerate(bottom):
            col = find_col(items, bp)
            chosen, err = pick_five(col)
            if chosen is None:
                return None, 1e9, detail
            score += err
            for r, p in enumerate(chosen):
                out[(s, f, r)] = p[2]      # 原图像素坐标
        score += abs(len(items) - 45) * 3
    return out, score, detail


best_shift, best_pts, best_score, best_detail = None, None, 1e9, None
for sh in np.arange(-14, 15, 1.0):
    pts, sc, det = calibrate(float(sh))
    if pts is not None and sc < best_score:
        best_shift, best_pts, best_score, best_detail = float(sh), pts, sc, det

print('best shift', best_shift, 'score', round(best_score, 1))
print('detail', best_detail)
assert best_pts is not None and len(best_pts) == 135, '标定失败：未得到 135 点'
POINTS = best_pts

# ---------- 开局摆子（专利 CN87205572U 字样） ----------
# 黑方魏：魏一 士二 象二 车二 马二 炮二 卒五
# 红方蜀：蜀一 士二 象二 车二 马二 炮二 兵五
# 黄方吴：吴一 士二 象二 车二 马二 炮二 勇五
KING = {'A': '蜀', 'B': '魏', 'C': '吴'}
PAWN = {'A': '兵', 'B': '卒', 'C': '勇'}
BACK = ['车', '马', '象', '士', 'KING', '士', '象', '马', '车']
PIECES = []
for s in ('A', 'B', 'C'):
    for f in range(FILES):
        PIECES.append((s, f, 0, KING[s] if BACK[f] == 'KING' else BACK[f]))
    for f in (1, 7):
        PIECES.append((s, f, 2, '炮'))
    for f in (0, 2, 4, 6, 8):
        PIECES.append((s, f, 3, PAWN[s]))
assert len(PIECES) == 48


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
    put_rotated_text(img, char, (x, y), font(PIECE_FONT), color, angle)


# 12 条跨区对接线：每对相邻国 4 条，边路纵线端点两两相连，三方因此相通
LINK_PAIRS = []
for i in range(4):
    LINK_PAIRS += [(('A', i, 4), ('B', 8 - i, 4)),
                   (('A', 8 - i, 4), ('C', i, 4)),
                   (('B', i, 4), ('C', 8 - i, 4))]
WAIST = [LINK_PAIRS[0], LINK_PAIRS[1], LINK_PAIRS[2]]
# 3 条中路线：三方中路国境点汇向中央「鼎」点
CENTER_SPOKES = [(s, 4, 4) for s in ('A', 'B', 'C')]
CENTER_LINKS = [(('A', 4, 4), ('B', 4, 4)),
                (('B', 4, 4), ('C', 4, 4)),
                (('C', 4, 4), ('A', 4, 4))]
ALL_LINKS = LINK_PAIRS + CENTER_LINKS


def dashed(draw, p1, p2, fill, width=3, dash=10, gap=7):
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


def make_board(with_pieces=True, with_ids=False, connectivity=False, print_links=True):
    img = PADDED.copy()
    # 按用户要求把连接线印在棋盘上：12 条边路虚线 + 3 条中路线
    if print_links:
        d = ImageDraw.Draw(img)
        for a, b in LINK_PAIRS:
            dashed(d, rp(a), rp(b), '#9E2B20', 3, 10, 7)
        for a in CENTER_SPOKES:
            dashed(d, rp(a), (OX + PAD, OY + PAD), '#6B4A12', 3, 7, 5)
    if connectivity:
        d = ImageDraw.Draw(img)
        # 三方国境线（r=4）：网格本身在三个腰部紧贴相接
        for s in ('A', 'B', 'C'):
            d.line([rp((s, f, 4)) for f in range(FILES)], fill='#2F6FB5', width=4)
        # 三个腰部接点
        for a, b in WAIST:
            p, q = rp(a), rp(b)
            mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
            d.ellipse([mx - 15, my - 15, mx + 15, my + 15],
                      outline='#1B6E3C', width=3)
    if with_ids:
        d = ImageDraw.Draw(img)
        fnt = font(13)
        for s in ('A', 'B', 'C'):
            for f in range(FILES):
                for r in range(RANKS):
                    x, y = rp((s, f, r))
                    d.text((x + 4, y - 15), '%d%d' % (f, r), fill=COLORS[s], font=fnt)
    if with_pieces:
        for s, f, r, ch in PIECES:
            x, y = rp((s, f, r))
            draw_piece(img, x, y, ch, COLORS[s], TEXT_ROT[s])
    return img


def add_caption(img, title, lines, top=66, bottom=180):
    PL = PR = 36
    canvas = Image.new('RGB', (img.width + PL + PR, img.height + top + bottom), '#FAF6EC')
    canvas.paste(img, (PL, top))
    d = ImageDraw.Draw(canvas)
    d.rectangle([PL - 1, top - 1, PL + img.width, top + img.height], outline=INK, width=2)
    d.text((canvas.width / 2, 34), title, fill=INK, font=font(32), anchor='mm')
    y = top + img.height + 18
    for i, t in enumerate(lines):
        d.text((PL + 4, y + i * 28), t, fill=INK, font=font(19))
    return canvas


MAIN_LINES = [
    '底图取自实物照片描摹线稿：三方网格连续拼接、在三个腰部接点相通，未被空白隔断',
    '红色虚线 = 12 条边路过河线；金色点线 = 3 条中路线汇于中央「鼎」点，共 15 条连接线已印出',
    '字样按专利 CN87205572U：魏（黑，左上）、蜀（红，下方）、吴（黄，右上）；卒／兵／勇各五枚',
    '每方 16 子：底线 车马象士主帅士象马车，第 3 行两炮，第 4 行五兵；棋面文字按各玩家朝向旋转',
    '中央六边形与三块「野」区为河界带（无落子点）；四角三角为四夷禁区',
]
main_img = make_board()
add_caption(main_img, '三国象棋 · 玩家看到的真实开局棋盘（连接线已印出 · 48 子）',
            MAIN_LINES, bottom=200).save(os.path.join(ROOT, 'board_player_view.png'))

add_caption(make_board(with_pieces=False, with_ids=True, print_links=False),
            '三国象棋 · 真实线稿点位编号（f = 路 0-8，r = 线 0-4）',
            ['每方 9 路 x 5 线 = 45 点，共 135 点；点位由线稿长直线求交得到',
             'r=0 为本方底线，r=4 为靠中央的国境线；颜色仅用于区分三方']).save(
    os.path.join(ROOT, 'board_point_ids.png'))

add_caption(make_board(with_pieces=False, connectivity=True),
            '三国象棋 · 三方网格连通关系（连成一片、彼此相通）',
            ['蓝线 = 三方各自的国境线（r=4）；绿圈 = 三个腰部接点，网格在此紧贴相接',
             '红虚线 = 12 条边路过河线，相邻两方边路纵线端点两两相连',
             '金点线 = 3 条中路线，由三方中路汇于中央六边形中心的「鼎」点',
             '这 15 条连接线现已直接印在开局棋盘上；点位见 board_real_coords.json']).save(
    os.path.join(ROOT, 'board_connectivity.png'))

# ---------- 三方视角 ----------
TILE = 560
tiles = []
PAPER_RGB = np.array([203, 166, 92])
for s in ('A', 'B', 'C'):
    deg = {'A': 0.0, 'B': 120.0, 'C': -120.0}[s]
    v = main_img.rotate(deg, expand=True, resample=Image.BICUBIC, fillcolor=PAPER)
    arr = np.asarray(v).astype(int)
    mask = np.abs(arr - PAPER_RGB).sum(axis=2) > 45
    ys, xs = np.where(mask)
    if len(xs):
        pad = 8
        v = v.crop((max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad),
                    min(v.width, int(xs.max()) + pad), min(v.height, int(ys.max()) + pad)))
    k = min(TILE / v.width, TILE / v.height)
    v = v.resize((int(v.width * k), int(v.height * k)), Image.LANCZOS)
    tile = Image.new('RGB', (TILE, TILE), PAPER)
    tile.paste(v, ((TILE - v.width) // 2, (TILE - v.height) // 2))
    tiles.append((s, tile))

VW, VH = TILE * 3 + 40 * 4, TILE + 140
board3 = Image.new('RGB', (VW, VH), '#FAF6EC')
d3 = ImageDraw.Draw(board3)
for i, (s, tile) in enumerate(tiles):
    x = 40 + i * (TILE + 40)
    board3.paste(tile, (x, 62))
    d3.rectangle([x - 1, 61, x + TILE, 62 + TILE], outline=INK, width=2)
    d3.text((x + TILE / 2, 34), NAMES[s] + ' 视角', fill=COLORS[s], font=font(23), anchor='mm')
d3.text((VW / 2, VH - 36),
        '整张棋盘（含照片线稿）一起旋转到该玩家坐下的方向：本方在下、棋面文字为正',
        fill=INK, font=font(19), anchor='mm')
board3.save(os.path.join(ROOT, 'board_player_views.png'))

# ---------- 真实像素坐标 ----------
coords = {
    'note': '照片描摹线稿 board_reference_traced.png 的像素坐标；由长直线求交标定，供渲染对齐',
    'source_image': 'board_reference_traced.png',
    'canvas': [W, H],
    'render_offset': [PAD, PAD],
    'render_canvas': [W + 2 * PAD, H + 2 * PAD],
    'sector_angle_shift': best_shift,
    'link_pairs': [['%s%d%d' % a, '%s%d%d' % b] for a, b in LINK_PAIRS],
    'center_links': [['%s%d%d' % a, '%s%d%d' % b] for a, b in CENTER_LINKS],
    'center_spokes': [['%s%d%d' % a, [round(OX, 1), round(OY, 1)]] for a in CENTER_SPOKES],
    'printed_links': len(ALL_LINKS),
    'points': {'%s%d%d' % (s, f, r): [round(POINTS[(s, f, r)][0], 1),
                                      round(POINTS[(s, f, r)][1], 1)]
               for s in ('A', 'B', 'C') for f in range(FILES) for r in range(RANKS)},
    'initial_pieces': [{'side': s, 'file': f, 'rank': r, 'char': ch}
                       for s, f, r, ch in PIECES],
}
with open(os.path.join(ROOT, 'board_real_coords.json'), 'w', encoding='utf-8') as fp:
    json.dump(coords, fp, ensure_ascii=False, indent=2)

print('OK pieces=%d points=%d links=%d shift=%s'
      % (len(PIECES), len(coords['points']), len(ALL_LINKS), best_shift))
