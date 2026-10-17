// WebAudio 程序化音效（无外部素材）
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._noise = null;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    // 白噪声缓冲
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
  }
  _src(vol = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._noise;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g);
    return { s, g };
  }
  _env(g, t0, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
  }
  _osc(type, f0, f1, peak, dec, t0) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dec);
    const g = this.ctx.createGain();
    this._env(g, t0, 0.005, peak, dec);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dec + 0.05);
  }

  shot(id, dist = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const far = Math.min(1, dist / 2400);
    const vol = (1 - far * 0.8);
    const spec = {
      ak47: [1600, 0.34, 200], m4a1: [2000, 0.30, 240], awp: [1200, 0.5, 140],
      m249: [1500, 0.36, 180], m3: [900, 0.4, 120], xm1014: [950, 0.38, 130],
      deagle: [1400, 0.36, 170], usp: [2200, 0.22, 320], glock18: [2400, 0.2, 350],
      mp5navy: [2300, 0.2, 340], tmp: [2400, 0.18, 360], p90: [2300, 0.2, 340],
      mac10: [2350, 0.19, 350], sg552: [1900, 0.28, 250], aug: [1900, 0.28, 250],
      knife: [3000, 0.05, 900]
    }[id] || [2000, 0.26, 280];

    // 爆裂噪声
    const { s, g } = this._src(1);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.setValueAtTime(spec[0], t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(180, spec[0] * 0.12), t + spec[1]);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 120;
    s.connect(bp); bp.connect(hp); hp.connect(g); g.connect(this.master);
    this._env(g, t, 0.003, spec[2] * 0.5 * vol, spec[1]);
    s.start(t); s.stop(t + spec[1] + 0.1);
    // 低频冲击
    this._osc('sine', spec[0] * 0.1, 55, 0.55 * vol, spec[1] * 0.9, t);
    // 远处混响尾音
    if (far > 0.05) {
      const r = this.ctx.createConvolver();
      const rl = this.ctx.sampleRate * 0.5, rb = this.ctx.createBuffer(1, rl, this.ctx.sampleRate);
      const rd = rb.getChannelData(0);
      for (let i = 0; i < rl; i++) rd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.4);
      r.buffer = rb;
      const { s: s2, g: g2 } = this._src(1);
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      s2.connect(lp); lp.connect(r); r.connect(g2); g2.connect(this.master);
      g2.gain.value = 0.5 * far;
      s2.start(t); s2.stop(t + 0.6);
    }
  }

  dryfire() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { s, g } = this._src(1);
    const hp = this.ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3200; hp.Q.value = 2;
    s.connect(hp); hp.connect(g); g.connect(this.master);
    this._env(g, t, 0.001, 0.25, 0.03);
    s.start(t); s.stop(t + 0.06);
  }
  click(f = 1800, vol = 0.3, dec = 0.04) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { s, g } = this._src(1);
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 3;
    s.connect(bp); bp.connect(g); g.connect(this.master);
    this._env(g, t, 0.001, vol, dec);
    s.start(t); s.stop(t + dec + 0.03);
  }
  reload(id) {
    if (!this.ctx) return;
    this.click(900, 0.3, 0.05);                       // 拔弹匣
    setTimeout(() => this.click(1400, 0.35, 0.05), 420);
    setTimeout(() => this.click(2600, 0.4, 0.06), 900);
  }
  pickup() { this.click(2200, 0.35, 0.07); setTimeout(() => this.click(3000, 0.3, 0.05), 60); }
  step(vol = 0.16) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { s, g } = this._src(1);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 700 + Math.random() * 500;
    s.connect(lp); lp.connect(g); g.connect(this.master);
    this._env(g, t, 0.002, vol, 0.07 + Math.random() * 0.03);
    s.start(t); s.stop(t + 0.14);
  }
  hit(head = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (head) this._osc('square', 1500, 2600, 0.32, 0.12, t);
    else this.click(1100, 0.3, 0.04);
  }
  hurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('sawtooth', 300, 140, 0.35, 0.22, t);
    const { s, g } = this._src(1);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    s.connect(lp); lp.connect(g); g.connect(this.master);
    this._env(g, t, 0.01, 0.3, 0.2);
    s.start(t); s.stop(t + 0.3);
  }
  death() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('sawtooth', 240, 70, 0.4, 0.7, t);
  }
  beep(hi = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('square', hi ? 1400 : 900, hi ? 1400 : 900, 0.18, 0.12, t);
  }
  buy() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('triangle', 900, 1600, 0.25, 0.1, t);
    setTimeout(() => this._osc('triangle', 1300, 2000, 0.2, 0.1, this.ctx.currentTime), 70);
  }
  explode() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { s, g } = this._src(1);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, t);
    lp.frequency.exponentialRampToValueAtTime(150, t + 0.6);
    s.connect(lp); lp.connect(g); g.connect(this.master);
    this._env(g, t, 0.01, 0.7, 0.7);
    s.start(t); s.stop(t + 0.8);
    this._osc('sine', 90, 40, 0.7, 0.7, t);
  }
}
