# -*- coding: utf-8 -*-
"""三国象棋（三方鼎立棋盘版）棋盘拓扑生成器。

产出：
  board_spec.json                 机器可读的棋盘 / 棋子 / 规则规格
  board_abstract_topology.svg     逻辑拓扑抽象示意（非实物比例，不作为文档主图）
  board_abstract_topology.png     同一抽象示意的位图版

注意：文档主图 board_topology.png / board_topology.svg 由 trace_reference.py
从棋盘照片逐线描摹生成，与实物几何一致；本脚本只生成「逻辑抽象图」与规格 JSON。

自检：135 个落子点、228 条阵内边、12 条跨河纵线、48 枚棋子。
"""
import json
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = r'C:\Users\Administrator\WorkBuddy\2026-11-13-17-06-27\sanguo_xiangqi'
os.makedirs(ROOT, exist_ok=True)

SIDES = ['A', 'B', 'C']
SIDE_INFO = {
    'A': {'name': '下（南）', 'color': '红', 'angle_deg': 270},
    'C': {'name': '右上（东北）', 'color': '绿', 'angle_deg': 30},
    'B': {'name': '左上（西北）', 'color': '黑', 'angle_deg': 150},
}
NEXT_CCW = {'A': 'C', 'C': 'B', 'B': 'A'}
FILES, RANKS = 9, 5


def pid(s, f, r):
    return '%s%d%d' % (s, f, r)


# ---------- 1. 点、边 ----------
points = [pid(s, f, r) for s in SIDES for r in range(RANKS) for f in range(FILES)]

intra_edges = []
for s in SIDES:
    for r in range(RANKS):
        for f in range(FILES - 1):
            intra_edges.append([pid(s, f, r), pid(s, f + 1, r)])
    for f in range(FILES):
        for r in range(RANKS - 1):
            intra_edges.append([pid(s, f, r), pid(s, f, r + 1)])

river_edges = []
for s in SIDES:
    t = NEXT_CCW[s]
    for f in range(5, 9):
        river_edges.append({
            'from': pid(s, f, 4),
            'to': pid(t, 8 - f, 4),
            'kind': 'straight_cross_river',
            'step': 1,
            'allowed': ['R', 'N', 'C', 'P'],
            'note': '河界算一格；中间不设落子点',
        })

center_edges = [
    {'from': pid(s, 4, 4), 'to': pid(NEXT_CCW[s], 4, 4),
     'kind': 'center_line', 'step': 1,
     'allowed': ['R', 'N', 'C', 'P'],
     'note': '三条中路会于中央鼎点；135 点模型下为两两互联的虚拟汇合'}
    for s in SIDES
]

patent_dashed = []
for s in SIDES:
    t = NEXT_CCW[s]
    for i, f in enumerate(range(1, 5)):
        patent_dashed.append({
            'from': pid(s, f, 4),
            'to': pid(t, 4 - i, 3),
            'kind': 'soldier_dashed',
            'step': 1,
            'allowed': ['P'],
            'note': '仅供兵卒勇过河后往返另外两方阵地，不得经虚线退回本方',
        })

# ---------- 2. 区域 ----------
zones = []
for s in SIDES:
    zones.append({
        'id': 'camp_' + s, 'type': 'camp', 'side': s,
        'playable': True, 'point_count': 45,
        'note': '九路五线，纵线放射状指向棋盘中心；含九宫、炮位、兵位',
    })
zones += [
    {'id': 'wild_1', 'type': 'river_wild', 'playable': False,
     'note': '上方梯形「野」区：隔开左上与右上两方'},
    {'id': 'wild_2', 'type': 'river_wild', 'playable': False,
     'note': '左下三角「野」区：隔开左上与下方两方'},
    {'id': 'wild_3', 'type': 'river_wild', 'playable': False,
     'note': '右下三角「野」区：隔开右上与下方两方'},
    {'id': 'center_ding', 'type': 'center', 'playable': False,
     'note': '中央六边形；三条中路汇合处，默认不设落子点'},
    {'id': 'barbarian_1', 'type': 'forbidden', 'playable': False, 'label': '羌族'},
    {'id': 'barbarian_2', 'type': 'forbidden', 'playable': False, 'label': '乌丸'},
    {'id': 'barbarian_3', 'type': 'forbidden', 'playable': False, 'label': '南蛮'},
    {'id': 'barbarian_4', 'type': 'forbidden', 'playable': False, 'label': '山越'},
]

# ---------- 3. 棋子与开局 ----------
PIECE_TYPES = {
    'K': '帅/将（魏、蜀、吴）', 'A': '士/仕', 'E': '相/象',
    'N': '马', 'R': '车', 'C': '炮', 'P': '兵/卒/勇',
}
INITIAL = [
    ('R', [(0, 0), (8, 0)]), ('N', [(1, 0), (7, 0)]),
    ('E', [(2, 0), (6, 0)]), ('A', [(3, 0), (5, 0)]),
    ('K', [(4, 0)]), ('C', [(1, 2), (7, 2)]),
    ('P', [(0, 3), (2, 3), (4, 3), (6, 3), (8, 3)]),
]
placement = []
for s in SIDES:
    for t, cells in INITIAL:
        for f, r in cells:
            placement.append({'side': s, 'type': t, 'at': pid(s, f, r)})

special_points = {}
for s in SIDES:
    special_points[s] = {
        'palace': [pid(s, f, r) for f in (3, 4, 5) for r in (0, 1, 2)],
        'cannon_marks': [pid(s, 1, 2), pid(s, 7, 2)],
        'soldier_marks': [pid(s, f, 3) for f in (0, 2, 4, 6, 8)],
        'defense_line': [pid(s, f, 3) for f in range(FILES)],
        'border_line': [pid(s, f, 4) for f in range(FILES)],
    }

# ---------- 4. 规格 JSON ----------
spec = {
    'spec_version': '1.0',
    'game': '三国象棋（三方鼎立棋盘版）',
    'basis': '依据用户提供的棋盘照片整理；规则参考 CN87205572U、鼎弈、三国演弈等公开资料',
    'evidence_levels': {
        'L1': '棋盘照片可直接确认',
        'L2': '公开资料通行规则',
        'L3': '本规格给出的实现建议（可配置）',
        'L4': '需产品方确认',
    },
    'board': {
        'frame': 'rectangular_frame',
        'frame_note': '照片内框约 1116×953 px（宽高比约 1.17），为横向矩形，可能源于印刷比例或拍摄透视；逻辑拓扑不依赖外框形状',
        'symmetry': '120_degree_rotational',
        'symmetry_note': '仅三方网格部分呈 120° 旋转对称；矩形外框与四角留白不参与该对称，故整体不是严格几何对称',
        'shape_note': '实物中三方网格是连续拼接、彼此相通的一整片：从外框一直铺到三方国境线(r=4)，相邻两方在左/右/上三个腰部紧贴相接、线条贯通；三方 r=4 折线首尾相连围成闭合大六边形轮廓，中央小六边形的三条交替边即其中三段。三块「野」区只是大、小六边形之间的窄缝隙(腰部宽约 72-75 px，约占棋盘宽 5%)，不是把棋盘切成三块孤岛。每方横线是逐点相连的折线；四角只是小三角留白。旧版 board_abstract_topology.* 用窄扇形 + 双层六边形近似仅为表达点位拓扑，不按实物比例',
        'geometry_source': '棋盘照片；主图 board_topology.png 由该照片逐线描摹生成，几何以主图为准；真实点位像素坐标见 board_real_coords.json',
        'connectivity_note': '三方相通：相邻两方在三个腰部直接相接，且各有 4 条边路纵线端点两两对接(共 12 条 river_edges)，另有 3 条中路线汇于中央鼎点，合计 15 条连接线，v2.0 起全部印在棋盘上。v1.2 的参数化扇形重绘误把三方画成孤岛，已废弃',
        'rule_source_locked': 'CN87205572U 专利说明书全文；不是三国演弈棋，无汉帝/结盟/弑君/黄棋',
        'piece_chars': {
            'A': {'name': '蜀', 'color': '红', 'king': '蜀', 'pawn': '兵'},
            'B': {'name': '魏', 'color': '黑', 'king': '魏', 'pawn': '卒'},
            'C': {'name': '吴', 'color': '黄', 'king': '吴', 'pawn': '勇'},
        },
        'turn_order_patent': ['B', 'A', 'C'],
        'printed_link_count': 15,
        'playable_builds': {
            'web_single_file': 'play/三国象棋_试玩版.html',
            'web_source': 'play/index.html + board-data.js / engine.js / render.js',
            'wechat_miniprogram': '../sanguo-mini/',
        },
        'diagram_files': {
            'board_topology.png': '文档主图，与实物几何一致（trace_reference.py 生成）',
            'board_reference_traced.png': '纯线稿，无标注无边距，供程序直接使用',
            'board_abstract_topology.png': '逻辑拓扑抽象示意，非实物比例，仅用于说明跨河连线与分区',
            'board_player_view.png': '玩家开局棋盘：照片线稿为底 + 48 子 + 15 条连接线已印出',
            'board_player_views.png': '三方各自坐下时的视角对照',
            'board_connectivity.png': '连通关系标注：国境线相接、三个腰部、15 条连接线',
            'board_point_ids.png': '照片线稿上 135 个点的 f/r 编号对照',
            'board_real_coords.json': '135 个点的真实照片像素坐标（1348x1155）+ 48 枚初始摆子 + 15 条连接线',
            'play/三国象棋_试玩版.html': '可玩的单文件网页试玩版，玩家对两个 AI',
            '../sanguo-mini/': '可玩的微信小程序工程，规则与网页版共用',
        },
        'side_order_ccw': ['A', 'C', 'B'],
        'sides': SIDE_INFO,
        'files_per_side': FILES,
        'ranks_per_side': RANKS,
        'playable_point_count': 135,
        'point_id_format': '{side}{file}{rank}，例 A40 = A 方中路底线',
        'rank_semantics': 'r=0 底线（帅所在），r=4 国境线；本方前进方向 = r 增大 = 指向棋盘中心',
        'file_semantics': 'f=0..8 为本方视角从左到右；f=4 为中路',
        'points': points,
        'intra_edges': intra_edges,
        'river_edges': river_edges,
        'center_edges': center_edges,
        'optional_edge_groups': {
            'patent_1987_soldier_dashed': {
                'enabled': False,
                'edges': patent_dashed,
                'note': '12 根虚线；仅兵卒勇可用，不得退回本方；其它棋子禁用',
            },
            'center_ding_point': {
                'enabled': False,
                'point': 'X00',
                'edges': [{'from': pid(s, 4, 4), 'to': 'X00'} for s in SIDES],
                'note': '启用后棋盘为 136 点；三条中路各一步到中央鼎点',
            },
        },
        'zones': zones,
        'special_points': special_points,
        'forbidden_zone_rule': '四角四夷区不可落子、不可穿越；马若在边角无法构成完整「日」字则该跳法无效',
    },
    'pieces': {
        'types': PIECE_TYPES,
        'per_side': 16,
        'total': 48,
        'initial_placement': placement,
        'note': '摆法与中国象棋完全相同；图中「十」字标记即炮位与兵位',
    },
    'rules': {
        'baseline': '中国象棋走法',
        'flags': {
            'horse_leg_block': False,
            'elephant_eye_block': False,
            'elephant_cross_river': False,
            'advisor_cross_river': False,
            'general_diagonal': False,
            'soldier_sideways_in_own_camp': True,
            'soldier_backward_after_river': True,
            'soldier_promote_at_enemy_base': False,
            'cannon_first_turn_no_cross_border': False,
            'cross_river_pieces': ['R', 'N', 'C', 'P'],
            'check_side_moves_first': True,
            'third_party_frozen_during_check': True,
            'stalemate_passes_turn': True,
            'defeated_pieces': 'frozen_obstacle',
            'alliance_enabled': False,
            'han_faction_enabled': False,
        },
        'turn_order': ['A', 'C', 'B'],
        'first_side': 'A',
        'check_resolution': '一方被将时由被将方立即应将；两方同时被将则按正常顺序；第三方停走且其棋子不可被吃、不可被穿越',
        'win': '将死或吃掉主帅使该方出局；最后仅存一方为胜；可配置积分制（一统天下 3 分、和棋各 1 分）',
    },
    'open_questions': [
        '中央「野」区是否设落子点：照片无网格，默认 135 点；是否启用中央「鼎」点（136 点）',
        '跨河纵线是否印出：照片中央区无连线，本规格按「河界算一格」处理为逻辑边',
        '12 条跨河连线是全体车马炮兵可用，还是仅兵卒勇可用的虚线（专利 1987 版）',
        '四角四夷区是否兼作俘虏区',
        '是否启用汉方、结盟点、弑君（三国演弈棋规则；照片未见相应点位）',
        '每方 16 子还是古版 18 子（增旗、火）',
        '兵到对方底线是否升变为车',
        '被将死方余子：原地冻结 / 由胜者收编 / 直接移除',
        '先手方与轮换方向（顺时针或逆时针）',
        '是否启用「三座山」地形限制与中线左右过河限制',
    ],
}

with open(os.path.join(ROOT, 'board_spec.json'), 'w', encoding='utf-8') as fp:
    json.dump(spec, fp, ensure_ascii=False, indent=2)

# ---------- 5. 几何与绘图数据 ----------
CX, CY = 500, 500
D0, D4 = 300, 140      # 底线 / 前线到中心的距离
L0, L4 = 250, 82       # 底线 / 前线的半长
COLORS = {'A': '#C0392B', 'C': '#2E7D52', 'B': '#2C3E50'}
R_BIG, R_SMALL = 165, 78


def pos(s, f, r):
    th = math.radians(SIDE_INFO[s]['angle_deg'])
    ux, uy = math.cos(th), -math.sin(th)
    vx, vy = uy, -ux
    d = D0 + (D4 - D0) * r / 4.0
    l = L0 + (L4 - L0) * r / 4.0
    k = (f - 4) / 4.0
    return (CX + d * ux + k * l * vx, CY + d * uy + k * l * vy)


def hexpts(radius):
    return [(CX + radius * math.cos(math.radians(a)),
             CY + radius * math.sin(math.radians(a))) for a in range(0, 360, 60)]


BIG, SMALL = hexpts(R_BIG), hexpts(R_SMALL)
CORNERS = [
    ([(40, 40), (240, 40), (40, 240)], (105, 105), '禁区'),
    ([(960, 40), (760, 40), (960, 240)], (895, 105), '禁区'),
    ([(40, 960), (240, 960), (40, 760)], (105, 895), '禁区'),
    ([(960, 960), (760, 960), (960, 760)], (895, 895), '禁区'),
]
LEGEND = [
    '逻辑抽象示意（非实物比例）：三方阵营九路五线网格，共 135 个落子点',
    '灰色虚线：跨河逻辑连线（12 条纵线对接 + 3 条中路），照片未印出',
    '短虚线：九宫对角线；十字标记：炮位与兵位',
    '角落三角：四夷禁区，不可落子、不可穿越',
]


def fmt(p):
    return '%.1f,%.1f' % p


# ---------- 6. SVG ----------
svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1080" width="1000" height="1080">',
       '<rect width="1000" height="1080" fill="#FAF6EC"/>',
       '<rect x="40" y="40" width="920" height="920" fill="#F2E3C0" stroke="#3A3226" stroke-width="4"/>']
for poly, label_pos, label in CORNERS:
    svg.append('<polygon points="%s" fill="#E3CDA0" stroke="#8A7A55" stroke-width="1.5" stroke-dasharray="6 5"/>'
               % ' '.join(fmt(p) for p in poly))
    svg.append('<text x="%d" y="%d" font-size="17" fill="#6B5B38" text-anchor="middle" font-family="Microsoft YaHei, SimHei, sans-serif">%s</text>'
               % (label_pos[0], label_pos[1], label))
svg.append('<polygon points="%s" fill="#EBD8A8" stroke="#3A3226" stroke-width="2.5"/>' % ' '.join(fmt(p) for p in BIG))
svg.append('<polygon points="%s" fill="#E0C88E" stroke="#3A3226" stroke-width="2"/>' % ' '.join(fmt(p) for p in SMALL))
for i in (0, 2, 4):
    svg.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#8A7A55" stroke-width="1.5"/>'
               % (SMALL[i][0], SMALL[i][1], BIG[i][0], BIG[i][1]))
for e in river_edges + center_edges:
    a, b = e['from'], e['to']
    pa, pb = pos(a[0], int(a[1]), int(a[2])), pos(b[0], int(b[1]), int(b[2]))
    svg.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#9A8A66" stroke-width="1.2" stroke-dasharray="5 5" opacity="0.8"/>'
               % (pa[0], pa[1], pb[0], pb[1]))
for s in SIDES:
    col = COLORS[s]
    for f in range(FILES):
        p0, p4 = pos(s, f, 0), pos(s, f, 4)
        svg.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.7"/>'
                   % (p0[0], p0[1], p4[0], p4[1], col))
    for r in range(RANKS):
        p0, p8 = pos(s, 0, r), pos(s, 8, r)
        svg.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.7"/>'
                   % (p0[0], p0[1], p8[0], p8[1], col))
    a1, a2, b1, b2 = pos(s, 3, 0), pos(s, 5, 2), pos(s, 5, 0), pos(s, 3, 2)
    svg.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.2" stroke-dasharray="6 4"/>'
               % (a1[0], a1[1], a2[0], a2[1], col))
    svg.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.2" stroke-dasharray="6 4"/>'
               % (b1[0], b1[1], b2[0], b2[1], col))
    for f, r in [(1, 2), (7, 2), (0, 3), (2, 3), (4, 3), (6, 3), (8, 3)]:
        x, y = pos(s, f, r)
        for dx, dy in ((-8, -8), (8, 8), (-8, 8), (8, -8)):
            svg.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.2"/>'
                       % (x + dx * 0.35, y + dy * 0.35, x + dx, y + dy, col))
    for f in range(FILES):
        for r in range(RANKS):
            x, y = pos(s, f, r)
            svg.append('<circle cx="%.1f" cy="%.1f" r="2.2" fill="%s"/>' % (x, y, col))
    lx, ly = pos(s, 4, 0)
    svg.append('<text x="%.0f" y="%.0f" font-size="20" fill="%s" text-anchor="middle" font-family="Microsoft YaHei, SimHei, sans-serif">%s 方</text>'
               % (lx, ly + 32, col, s))
svg.append('<text x="500" y="80" font-size="24" fill="#3A3226" text-anchor="middle" font-family="Microsoft YaHei, SimHei, sans-serif">三国象棋 逻辑拓扑抽象示意（非实物比例）</text>')
svg.append('<text x="500" y="492" font-size="18" fill="#5A4A2A" text-anchor="middle" font-family="Microsoft YaHei, SimHei, sans-serif">中央野区</text>')
svg.append('<text x="500" y="516" font-size="16" fill="#5A4A2A" text-anchor="middle" font-family="Microsoft YaHei, SimHei, sans-serif">河界 · 无落子点</text>')
for i, text in enumerate(LEGEND):
    svg.append('<text x="60" y="%d" font-size="16" fill="#3A3226" font-family="Microsoft YaHei, SimHei, sans-serif">%s</text>'
               % (988 + i * 21, text))
svg.append('</svg>')
with open(os.path.join(ROOT, 'board_abstract_topology.svg'), 'w', encoding='utf-8') as fp:
    fp.write('\n'.join(svg))

# ---------- 7. PNG 预览 ----------
def get_font(size):
    for p in (r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simhei.ttf', r'C:\Windows\Fonts\simsun.ttc'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def dashed(draw, p1, p2, fill, width=2, dash=9, gap=6):
    x1, y1 = p1
    x2, y2 = p2
    dist = math.hypot(x2 - x1, y2 - y1)
    if dist == 0:
        return
    ux, uy = (x2 - x1) / dist, (y2 - y1) / dist
    t = 0.0
    while t < dist:
        e = min(t + dash, dist)
        draw.line([(x1 + ux * t, y1 + uy * t), (x1 + ux * e, y1 + uy * e)], fill=fill, width=width)
        t = e + gap


img = Image.new('RGB', (1000, 1080), '#FAF6EC')
d = ImageDraw.Draw(img)
d.rectangle([40, 40, 960, 960], fill='#F2E3C0', outline='#3A3226', width=4)
for poly, label_pos, label in CORNERS:
    d.polygon(poly, fill='#E3CDA0')
    for i in range(3):
        dashed(d, poly[i], poly[(i + 1) % 3], '#8A7A55', 2)
    d.text(label_pos, label, fill='#6B5B38', font=get_font(17), anchor='mm')
d.polygon(BIG, fill='#EBD8A8', outline='#3A3226', width=3)
d.polygon(SMALL, fill='#E0C88E', outline='#3A3226', width=2)
for i in (0, 2, 4):
    d.line([SMALL[i], BIG[i]], fill='#8A7A55', width=2)
for e in river_edges + center_edges:
    a, b = e['from'], e['to']
    dashed(d, pos(a[0], int(a[1]), int(a[2])), pos(b[0], int(b[1]), int(b[2])), '#9A8A66', 2, 6, 5)
for s in SIDES:
    col = COLORS[s]
    for f in range(FILES):
        d.line([pos(s, f, 0), pos(s, f, 4)], fill=col, width=2)
    for r in range(RANKS):
        d.line([pos(s, 0, r), pos(s, 8, r)], fill=col, width=2)
    dashed(d, pos(s, 3, 0), pos(s, 5, 2), col, 2, 6, 4)
    dashed(d, pos(s, 5, 0), pos(s, 3, 2), col, 2, 6, 4)
    for f, r in [(1, 2), (7, 2), (0, 3), (2, 3), (4, 3), (6, 3), (8, 3)]:
        x, y = pos(s, f, r)
        for dx, dy in ((-8, -8), (8, 8), (-8, 8), (8, -8)):
            d.line([(x + dx * 0.35, y + dy * 0.35), (x + dx, y + dy)], fill=col, width=2)
    for f in range(FILES):
        for r in range(RANKS):
            x, y = pos(s, f, r)
            d.ellipse([x - 2.2, y - 2.2, x + 2.2, y + 2.2], fill=col)
    lx, ly = pos(s, 4, 0)
    d.text((lx, ly + 32), s + ' 方', fill=col, font=get_font(20), anchor='mm')
d.text((500, 80), '三国象棋 逻辑拓扑抽象示意（非实物比例）', fill='#3A3226', font=get_font(24), anchor='mm')
d.text((500, 492), '中央野区', fill='#5A4A2A', font=get_font(18), anchor='mm')
d.text((500, 516), '河界 · 无落子点', fill='#5A4A2A', font=get_font(16), anchor='mm')
for i, text in enumerate(LEGEND):
    d.text((60, 988 + i * 21), text, fill='#3A3226', font=get_font(16))
img.save(os.path.join(ROOT, 'board_abstract_topology.png'))

# ---------- 8. 自检 ----------
assert len(points) == 135
assert len(intra_edges) == 228
assert len(river_edges) == 12
assert len(center_edges) == 3
assert len(patent_dashed) == 12
assert len(placement) == 48
assert len(set(points)) == 135
for s in SIDES:
    assert len([p for p in placement if p['side'] == s]) == 16
import xml.etree.ElementTree as ET
ET.parse(os.path.join(ROOT, 'board_abstract_topology.svg'))
print('OK  points=%d intra=%d river=%d center=%d placement=%d' %
      (len(points), len(intra_edges), len(river_edges), len(center_edges), len(placement)))
print('OUTPUT', ROOT)
