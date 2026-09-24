/* audio.js : Web Audio 8-bit 音效合成（无外部音频文件） */
window.NB = window.NB || {};

NB.Audio = {
  ctx: null,

  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* 不支持则静音 */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(f0, dur, type, vol, f1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise(dur, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(g); g.connect(this.ctx.destination);
    s.start(t);
  },

  cursor()  { this.tone(660, 0.05, 'square', 0.06); },
  select()  { this.tone(440, 0.06, 'square', 0.07); setTimeout(() => this.tone(880, 0.09, 'square', 0.07), 60); },
  jump()    { this.tone(220, 0.12, 'square', 0.06, 520); },
  shoot()   { this.tone(500, 0.06, 'square', 0.05, 700); },
  pass()    { this.tone(380, 0.05, 'square', 0.05, 520); },
  bounce()  { this.tone(160, 0.04, 'triangle', 0.09, 90); },
  rim()     { this.tone(320, 0.08, 'square', 0.06, 240); },
  hit()     { this.noise(0.08, 0.14); this.tone(140, 0.08, 'sawtooth', 0.08, 60); },
  down()    { this.noise(0.15, 0.12); this.tone(90, 0.18, 'sawtooth', 0.08, 40); },
  pick()    { this.tone(520, 0.05, 'square', 0.06, 760); },
  throwIt() { this.tone(300, 0.07, 'square', 0.05, 180); },
  dunk()    { this.noise(0.2, 0.16); this.tone(200, 0.25, 'sawtooth', 0.1, 50); },
  score()   { this.tone(660, 0.09, 'square', 0.07); setTimeout(() => this.tone(880, 0.14, 'square', 0.07), 90); },
  whistle() { this.tone(2100, 0.18, 'square', 0.05); setTimeout(() => this.tone(2100, 0.25, 'square', 0.05), 200); },
  buzzer()  { this.tone(320, 0.9, 'sawtooth', 0.1, 300); },
  tick()    { this.tone(990, 0.04, 'square', 0.05); },
};
