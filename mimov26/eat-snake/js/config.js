window.SB = window.SB || {};

SB.CONFIG = {
  WORLD_W: 4600,
  WORLD_H: 4600,

  FOOD_COUNT: 980,
  FOOD_CELL: 90,
  FOOD_MIN_R: 5,
  FOOD_MAX_R: 8.5,
  FOOD_DROP_SPACING: 24,

  AI_COUNT: 19,

  START_SCORE: 14,
  SCORE_TO_LEN: 1.55,
  LEN_BASE: 66,
  LEN_MAX: 4200,

  BASE_SPEED: 196,
  BOOST_MULT: 1.72,
  TURN_RATE: 3.5,
  TURN_PENALTY: 0.55,

  SEG_STEP: 4,
  BODY_CELL: 70,

  BOOST_SCORE_PER_SEC: 15,
  BOOST_DROP_INTERVAL: 0.09,
  MIN_BOOST_SCORE: 6,

  DEAD_FOOD_RATIO: 0.72,
  KILL_BONUS: 6,

  CAM_LERP: 7.5,
  ZOOM_BASE: 1.0,
  ZOOM_PER_SCORE: 9000,
  ZOOM_MIN: 0.62,

  RESPAWN_MIN: 1.8,
  RESPAWN_MAX: 4.2,
  LEADER_EVERY: 0.4,
  MAX_NAME_LEN: 8
};

SB.SKINS = [
  { id: 'lime',   name: '青柠',   a: '#7ed321', b: '#3fa30d', dark: '#2c7a06', pattern: 'solid'  },
  { id: 'flame',  name: '烈焰',   a: '#ff5722', b: '#c62828', dark: '#8e1c1c', pattern: 'stripe' },
  { id: 'ocean',  name: '深海',   a: '#29b6f6', b: '#0277bd', dark: '#01579b', pattern: 'solid'  },
  { id: 'grape',  name: '电光',   a: '#ab47bc', b: '#6a1b9a', dark: '#4a148c', pattern: 'bead'   },
  { id: 'sun',    name: '阳光',   a: '#ffd600', b: '#ff8f00', dark: '#e65100', pattern: 'stripe' },
  { id: 'mint',   name: '薄荷',   a: '#26c6da', b: '#00838f', dark: '#006064', pattern: 'bead'   },
  { id: 'rose',   name: '樱花',   a: '#ff80ab', b: '#d81b60', dark: '#ad1457', pattern: 'solid'  },
  { id: 'gold',   name: '鎏金',   a: '#ffb300', b: '#8d6e63', dark: '#4e342e', pattern: 'stripe' },
  { id: 'ghost',  name: '暗夜',   a: '#78909c', b: '#263238', dark: '#101418', pattern: 'bead'   },
  { id: 'leaf',   name: '翠叶',   a: '#9ccc65', b: '#00897b', dark: '#00695c', pattern: 'stripe' }
];

SB.AI_NAMES = [
  '贪吃蛇本蛇', '小青', '大胃王', '闪电侠', '爱吃糖', '蛇精病', '追风少年',
  '一口吞', '莽夫', '绕柱走', '老司机', '菜就多练', '不服来战', '环游世界',
  '闪电五连鞭', '打野专家', '佛系玩家', '切后排', '蛇皮走位', '无敌风火轮',
  '干饭蛇', '小钢炮', '风筝王', '贴脸输出', '百折不挠', '浪里白条'
];

SB.FOOD_COLORS = [
  '#ff5252', '#ff6e40', '#ffd740', '#69f0ae',
  '#40c4ff', '#e040fb', '#ff4081', '#b2ff59'
];
