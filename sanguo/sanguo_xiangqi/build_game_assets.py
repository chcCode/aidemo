# -*- coding: utf-8 -*-
"""把实物棋盘标定结果编译成小程序 / 网页版共用的 board-data.js。

依据：CN87205572U《三国象棋》专利全文 + 用户棋盘照片的 135 点实测坐标。

产出：
  sanguo-mini/utils/board-data.js    小程序数据层
  sanguo_xiangqi/play/board-data.js  网页试玩版数据层（内容相同）
"""
import json
import math
import os

ROOT = r'C:\Users\Administrator\WorkBuddy\2026-11-13-17-06-27'
SRC = os.path.join(ROOT, 'sanguo_xiangqi', 'board_real_coords.json')
OUTS = [
    os.path.join(ROOT, 'sanguo-mini', 'utils', 'board-data.js'),
    os.path.join(ROOT, 'sanguo_xiangqi', 'play', 'board-data.js'),
]

d = json.load(open(SRC, encoding='utf-8'))
W, H = d['canvas']
P = d['points']                       # 'A00' -> [x, y]
OX, OY = W / 2.0, H / 2.0
SIDES = 'ABC'
FILES, RANKS = 9, 5


def pid(s, f, r):
    return '%s%d%d' % (s, f, r)


def xy(k):
    return P[k]


# ---------- 1. 阵营网格边（228 条） ----------
edges = []
for s in SIDES:
    for f in range(FILES):
        for r in range(RANKS - 1):
            edges.append([pid(s, f, r), pid(s, f, r + 1)])       # 纵线
    for r in range(RANKS):
        for f in range(FILES - 1):
            edges.append([pid(s, f, r), pid(s, f + 1, r)])       # 横线（折线逐段）
assert len(edges) == 228

# ---------- 2. 12 条边路虚线 + 3 条中路线 ----------
cross = [list(pair) for pair in d['link_pairs']]
assert len(cross) == 12
center = [[pid(s, 4, 4), pid(t, 4, 4)] for s, t in
          (('A', 'B'), ('B', 'C'), ('C', 'A'))]
# 中线在棋盘上画成从各国 r=4 中点汇到中央「鼎」点的三条线
center_spokes = [[pid(s, 4, 4), [round(OX, 1), round(OY, 1)]] for s in SIDES]

# 跨区邻接表（无向，15 条），供规则引擎使用
adj = {}
for a, b in cross + center:
    adj.setdefault(a, []).append(b)
    adj.setdefault(b, []).append(a)

# ---------- 3. 开局 48 子（专利字样） ----------
# 黑方魏：魏/士/象/车/马/炮/卒；红方蜀：蜀/士/象/车/马/炮/兵；黄方吴：吴/士/象/车/马/炮/勇
SIDE_INFO = {
    'A': {'name': '蜀', 'color': '#B03228', 'textColor': '#8E241C',
          'king': '蜀', 'pawn': '兵', 'position': '下方', 'note': '红方'},
    'B': {'name': '魏', 'color': '#26313F', 'textColor': '#1D2733',
          'king': '魏', 'pawn': '卒', 'position': '左上', 'note': '黑方'},
    'C': {'name': '吴', 'color': '#8A6A00', 'textColor': '#6B5200',
          'king': '吴', 'pawn': '勇', 'position': '右上', 'note': '黄方'},
}
BACK = ['车', '马', '象', '士', 'KING', '士', '象', '马', '车']
initial = []
for s in SIDES:
    info = SIDE_INFO[s]
    for f in range(FILES):
        t = info['king'] if BACK[f] == 'KING' else BACK[f]
        initial.append({'p': pid(s, f, 0), 's': s, 't': t})
    for f in (1, 7):
        initial.append({'p': pid(s, f, 2), 's': s, 't': '炮'})
    for f in (0, 2, 4, 6, 8):
        initial.append({'p': pid(s, f, 3), 's': s, 't': info['pawn']})
assert len(initial) == 48

# ---------- 4. 棋盘装饰几何 ----------
# 中央六边形：照片上是约 1/6 盘宽的小六边形，上下两条边水平
R_HEX = 105.0
hex_pts = [[round(OX + R_HEX * math.cos(math.radians(a)), 1),
            round(OY + R_HEX * math.sin(math.radians(a)), 1)]
           for a in (0, 60, 120, 180, 240, 300)]

# 三块「野」区与四角禁区在实物上是与纸同色的无网格留白，不额外填色；
# 三方国境线（r=4 折线）本身就把中央空白区围出来，填色反而会画成错误的大三角。
wilds = []
corners = []

# 炮位 / 兵位「十」字标记
marks = []
for s in SIDES:
    for f in (1, 7):
        marks.append(pid(s, f, 2))
    for f in (0, 2, 4, 6, 8):
        marks.append(pid(s, f, 3))

# 九宫虚线 X：f 3..5、r 0..2
palace = {}
for s in SIDES:
    palace[s] = [
        [pid(s, 3, 0), pid(s, 5, 2)],
        [pid(s, 5, 0), pid(s, 3, 2)],
    ]

data = {
    'version': '2.0-patent-CN87205572U',
    'canvas': [W, H],
    'center': [round(OX, 1), round(OY, 1)],
    'points': P,
    'edges': edges,
    'cross': cross,               # 12 条边路虚线（要印出来）
    'center_links': center,       # 3 条中路线（逻辑）
    'center_spokes': center_spokes,  # 3 条汇向鼎点的绘制线
    'cross_adj': adj,             # 跨区邻接，规则引擎用
    'sides': SIDE_INFO,
    'turn_order': ['B', 'A', 'C'],   # 专利：黑(魏)、红(蜀)、黄(吴) 依次走棋
    'initial': initial,
    'hex': hex_pts,
    'wilds': wilds,
    'corners': corners,
    'marks': marks,
    'palace': palace,
    'rules': {
        'dashed_for_pawns_only': False,   # 专利原文：其它棋子不能利用虚线；默认关闭以便 AI 可进攻
        'pawn_promote_at_baseline': True,  # 到对方底线升变为车
        'pawn_no_back': True,
        'horse_leg': True,               # 蹩马腿（与中国象棋相同）
        'elephant_eye': True,            # 塞象眼（与中国象棋相同）
        'elephant_cannot_cross': True,
        'king_stays_palace': True,
        'frozen_loser_pieces': True,     # 败方余子原地冻结，任另两方吃掉
    },
}

js = '/* 自动生成，请勿手改；来源 board_real_coords.json + 专利 CN87205572U */\n'
js += 'var SanguoBoardData = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
js += "if (typeof module !== 'undefined' && module.exports) { module.exports = SanguoBoardData; }\n"

for out in OUTS:
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as fp:
        fp.write(js)
    print('written', out, os.path.getsize(out), 'bytes')

print('OK points=%d edges=%d cross=%d center=%d initial=%d marks=%d'
      % (len(P), len(edges), len(cross), len(center), len(initial), len(marks)))
