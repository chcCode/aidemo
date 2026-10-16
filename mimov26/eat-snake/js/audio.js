(function (SB) {
  'use strict';

  let ctx = null;
  let enabled = true;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function blip(freq, dur, type, gain, slideTo) {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.12, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  let lastEat = 0;
  const Audio = {
    unlock() { ac(); },
    eat() {
      const now = performance.now();
      if (now - lastEat < 70) return;
      lastEat = now;
      blip(520 + Math.random() * 160, 0.09, 'sine', 0.07, 760);
    },
    kill() {
      blip(300, 0.14, 'square', 0.09, 620);
      setTimeout(() => blip(640, 0.16, 'square', 0.08, 900), 90);
    },
    die() {
      blip(420, 0.55, 'sawtooth', 0.1, 70);
      blip(300, 0.5, 'triangle', 0.07, 55);
    },
    ui() { blip(700, 0.07, 'triangle', 0.07, 940); },
    setEnabled(v) { enabled = v; },
    get enabled() { return enabled; }
  };

  SB.Audio = Audio;
})(window.SB);
