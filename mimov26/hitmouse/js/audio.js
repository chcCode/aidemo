/* =========================================================
   简易 WebAudio 音效引擎（无外部音频文件）
   ========================================================= */
const SFX = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, to = null, type = 'sine', dur = 0.15, vol = 0.3, delay = 0 }) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  function noise({ dur = 0.18, vol = 0.35, freq = 900, q = 1, delay = 0 }) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0);
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() { muted = !muted; return muted; },

    /* 地鼠钻出 */
    pop() {
      tone({ freq: 340, to: 760, type: 'sine', dur: 0.13, vol: 0.18 });
      noise({ dur: 0.1, vol: 0.07, freq: 1600 });
    },
    /* 打中 */
    hit(combo = 1) {
      noise({ dur: 0.14, vol: 0.5, freq: 420, q: 0.8 });
      tone({ freq: 180, to: 70, type: 'square', dur: 0.12, vol: 0.22 });
      const base = 720 + Math.min(combo, 20) * 34;
      tone({ freq: base, type: 'triangle', dur: 0.1, vol: 0.26, delay: 0.05 });
      tone({ freq: base * 1.5, type: 'sine', dur: 0.14, vol: 0.2, delay: 0.1 });
    },
    /* 漏打逃脱 */
    miss() {
      tone({ freq: 520, to: 190, type: 'sawtooth', dur: 0.3, vol: 0.2 });
      tone({ freq: 260, to: 120, type: 'square', dur: 0.26, vol: 0.13, delay: 0.06 });
    },
    /* 按错键 */
    error() {
      tone({ freq: 200, to: 150, type: 'sawtooth', dur: 0.16, vol: 0.17 });
    },
    /* 升级 */
    level() {
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.16, vol: 0.24, delay: i * 0.085 }));
    },
    /* 连击里程碑 */
    combo() {
      [880, 1174, 1568].forEach((f, i) =>
        tone({ freq: f, type: 'square', dur: 0.09, vol: 0.13, delay: i * 0.06 }));
    },
    /* 倒计时滴答 */
    tick() {
      tone({ freq: 1180, type: 'square', dur: 0.05, vol: 0.12 });
    },
    /* 游戏开始 */
    start() {
      [392, 523, 659, 784].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.14, vol: 0.24, delay: i * 0.08 }));
    },
    /* 游戏结束 */
    over() {
      [659, 587, 523, 392, 311].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.24, vol: 0.24, delay: i * 0.16 }));
      noise({ dur: 0.5, vol: 0.1, freq: 300, delay: 0.5 });
    },
    /* 打破纪录 */
    fanfare() {
      [523, 659, 784, 1046, 1318].forEach((f, i) =>
        tone({ freq: f, type: 'square', dur: 0.18, vol: 0.16, delay: i * 0.1 }));
    }
  };
})();
