/* input.js : 键盘输入 -> 虚拟 FC 手柄
 * 1P: A/D 移动  W/S 上下  J=投篮/攻击  K=跳跃  L=传球
 * 2P: 方向键移动  ,=投篮/攻击  .=跳跃  /=传球
 * Enter = Start
 */
window.NB = window.NB || {};

NB.Input = {
  keys: {},     // 按住状态
  pressed: {},  // 本逻辑帧刚按下（沿触发）

  init() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  },

  flush() { this.pressed = {}; },

  /* 读取虚拟手柄。P 后缀为按下沿（单发），否则为按住。
   * 1P 合并触屏输入（Touch* 虚拟键码由 touch.js 写入）。 */
  pad(idx) {
    const k = this.keys, p = this.pressed;
    if (idx === 0) {
      return {
        left:  !!k.KeyA || !!k.TouchLeft,
        right: !!k.KeyD || !!k.TouchRight,
        up:    !!k.KeyW || !!k.TouchUp,
        down:  !!k.KeyS || !!k.TouchDown,
        shoot: !!k.KeyJ || !!k.TouchShoot,
        jump:  !!k.KeyK || !!k.TouchJump,
        pass:  !!k.KeyL || !!k.TouchPass,
        shootP: !!p.KeyJ || !!p.TouchShoot,
        jumpP:  !!p.KeyK || !!p.TouchJump,
        passP:  !!p.KeyL || !!p.TouchPass,
      };
    }
    return {
      left: !!k.ArrowLeft, right: !!k.ArrowRight, up: !!k.ArrowUp, down: !!k.ArrowDown,
      shoot: !!k.Comma, jump: !!k.Period, pass: !!k.Slash,
      shootP: !!p.Comma, jumpP: !!p.Period, passP: !!p.Slash,
    };
  },

  /* 菜单用（键盘 + 触屏摇杆/按钮通用） */
  menuUp()    { return !!(this.pressed.KeyW || this.pressed.ArrowUp || this.pressed.TouchUp); },
  menuDown()  { return !!(this.pressed.KeyS || this.pressed.ArrowDown || this.pressed.TouchDown); },
  menuLeft()  { return !!(this.pressed.KeyA || this.pressed.ArrowLeft || this.pressed.TouchLeft); },
  menuRight() { return !!(this.pressed.KeyD || this.pressed.ArrowRight || this.pressed.TouchRight); },
  menuOk()    { return !!(this.pressed.Enter || this.pressed.KeyJ || this.pressed.TouchShoot || this.pressed.TouchStart); },
  menuOk2()   { return !!(this.pressed.Comma || this.pressed.Enter || this.pressed.TouchStart); },  // 2P 确认
  startP()    { return !!(this.pressed.Enter || this.pressed.TouchStart); },
};
