/* touch.js : 移动端虚拟摇杆 + 虚拟按钮
 * 通过向 NB.Input.keys / NB.Input.pressed 写入 Touch* 虚拟键码，
 * 与键盘输入完全同构，游戏逻辑零改动。
 * 仅在触摸设备上启用（PC 端不显示控件）。
 */
window.NB = window.NB || {};

(function () {
  const DEAD = 12;    // 摇杆死区 px
  const RANGE = 34;   // 摇杆头最大偏移 px

  NB.Touch = {
    enabled: false,
    _stickId: null,   // 摇杆当前跟踪的触摸点 identifier
    _dir: { l: false, r: false, u: false, d: false },

    init() {
      /* 触摸设备自动启用；也可用 ?touch=1 在 PC 上强制开启（调试/预览布局） */
      const force = /[?&]touch=1/.test(location.search);
      const isTouch = force || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      if (!isTouch) return;
      this.enabled = true;
      document.body.classList.add('touch');

      this._bindStick(document.getElementById('tc-stick'));
      this._bindBtn('tc-shoot', 'TouchShoot');
      this._bindBtn('tc-jump', 'TouchJump');
      this._bindBtn('tc-pass', 'TouchPass');
      this._bindBtn('tc-start', 'TouchStart');

      /* 阻止游戏区域触摸引起的页面滚动/橡皮筋 */
      document.addEventListener('touchmove', function (e) {
        if (e.target.closest('#tc-stick') || e.target.closest('#tc-btns') ||
            e.target.closest('#tc-start') || e.target.id === 'game') {
          e.preventDefault();
        }
      }, { passive: false });
      /* 阻止双击缩放 */
      document.addEventListener('dblclick', function (e) { e.preventDefault(); });
    },

    /* 方向写入：推入新方向时产生一次按下沿（供菜单翻页） */
    _setDir(key, code, on) {
      if (on && !this._dir[key]) NB.Input.pressed[code] = true;
      this._dir[key] = on;
      NB.Input.keys[code] = on;
    },

    _bindStick(el) {
      if (!el) return;
      const knob = document.getElementById('tc-knob');
      const reset = () => {
        this._stickId = null;
        knob.style.transform = 'translate(0px, 0px)';
        this._setDir('l', 'TouchLeft', false);
        this._setDir('r', 'TouchRight', false);
        this._setDir('u', 'TouchUp', false);
        this._setDir('d', 'TouchDown', false);
      };
      const move = (t) => {
        const r = el.getBoundingClientRect();
        let dx = t.clientX - (r.left + r.width / 2);
        let dy = t.clientY - (r.top + r.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > RANGE) { dx = dx / len * RANGE; dy = dy / len * RANGE; }
        knob.style.transform = 'translate(' + Math.round(dx) + 'px,' + Math.round(dy) + 'px)';
        this._setDir('l', 'TouchLeft', dx < -DEAD);
        this._setDir('r', 'TouchRight', dx > DEAD);
        this._setDir('u', 'TouchUp', dy < -DEAD);
        this._setDir('d', 'TouchDown', dy > DEAD);
      };
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this._stickId === null) {
          const t = e.changedTouches[0];
          this._stickId = t.identifier;
          move(t);
        }
      }, { passive: false });
      el.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier === this._stickId) move(t);
        }
      }, { passive: false });
      const end = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === this._stickId) reset();
        }
      };
      el.addEventListener('touchend', end);
      el.addEventListener('touchcancel', end);
    },

    _bindBtn(id, code) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!NB.Input.keys[code]) NB.Input.pressed[code] = true;   // 按下沿
        NB.Input.keys[code] = true;
        el.classList.add('active');
      }, { passive: false });
      const end = (e) => {
        e.preventDefault();
        NB.Input.keys[code] = false;
        el.classList.remove('active');
      };
      el.addEventListener('touchend', end);
      el.addEventListener('touchcancel', end);
    },
  };

  window.addEventListener('load', function () { NB.Touch.init(); });
})();
