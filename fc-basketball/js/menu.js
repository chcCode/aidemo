/* menu.js : 标题 / 模式 / 队伍 / 场地选择 / 结算 */
window.NB = window.NB || {};

(function () {
  const C = NB.C, A = NB.Audio, F = NB.Font, I = NB.Input;

  const MODES = ['1P VS CPU', '2P VS CPU', '1P VS 2P'];
  const MODE_IDS = ['1p', '2p', 'vs'];
  const STAGE_INFO = {
    ROOFTOP: 'NORMAL COURT',
    GYM: 'NORMAL COURT',
    ICE: 'SLIPPERY FLOOR!',
    BEACH: 'SLOW SAND...',
    FACTORY: 'CONVEYOR BELT!',
  };

  class Menu {
    constructor(result) {
      this.t = 0;
      this.state = result ? 'result' : 'title';
      this.result = result || null;
      this.mode = 0;
      this.sel = { team1: 0, team2: 1, stage: 0 };
      this.teamPhase = 0;          // 0: 1P 选队  1: 2P 选队
    }

    update() {
      this.t++;
      switch (this.state) {
        case 'title':
          if (I.menuOk()) { A.select(); this.state = 'mode'; }
          break;

        case 'mode':
          if (I.menuUp())   { this.mode = (this.mode + MODES.length - 1) % MODES.length; A.cursor(); }
          if (I.menuDown()) { this.mode = (this.mode + 1) % MODES.length; A.cursor(); }
          if (I.menuOk())   { A.select(); this.state = 'team'; this.teamPhase = 0; }
          break;

        case 'team': {
          const key = this.teamPhase === 0 ? 'team1' : 'team2';
          let s = this.sel[key];
          if (I.menuLeft())  { s = (s + 5) % 6; A.cursor(); }
          if (I.menuRight()) { s = (s + 1) % 6; A.cursor(); }
          if (I.menuUp())    { s = (s + 3) % 6; A.cursor(); }
          if (I.menuDown())  { s = (s + 3) % 6; A.cursor(); }
          this.sel[key] = s;
          const ok = this.teamPhase === 0 ? I.menuOk() : I.menuOk2();
          if (ok) {
            A.select();
            if (this.teamPhase === 0 && this.mode === 2) {
              this.teamPhase = 1;                       // 对战模式：2P 选队
              if (this.sel.team2 === this.sel.team1) this.sel.team2 = (this.sel.team1 + 1) % 6;
            } else {
              if (this.mode !== 2) {                    // CPU 随机选不同队
                let c; do { c = Math.floor(Math.random() * 6); } while (c === this.sel.team1);
                this.sel.team2 = c;
              }
              this.state = 'stage';
            }
          }
          break;
        }

        case 'stage':
          if (I.menuLeft())  { this.sel.stage = (this.sel.stage + NB.Stages.length - 1) % NB.Stages.length; A.cursor(); }
          if (I.menuRight()) { this.sel.stage = (this.sel.stage + 1) % NB.Stages.length; A.cursor(); }
          if (I.menuUp())    { this.sel.stage = (this.sel.stage + NB.Stages.length - 1) % NB.Stages.length; A.cursor(); }
          if (I.menuDown())  { this.sel.stage = (this.sel.stage + 1) % NB.Stages.length; A.cursor(); }
          if (I.menuOk()) {
            A.select();
            return new NB.Match({
              mode: MODE_IDS[this.mode],
              teamL: this.sel.team1,
              teamR: this.sel.team2,
              stage: this.sel.stage,
            });
          }
          break;

        case 'result':
          if (I.menuOk()) { A.select(); this.state = 'title'; this.result = null; }
          break;
      }
      return null;
    }

    /* ---------------- 绘制 ---------------- */
    draw(ctx) {
      ctx.fillStyle = '#101028';
      ctx.fillRect(0, 0, C.W, C.H);
      switch (this.state) {
        case 'title':  this._drawTitle(ctx); break;
        case 'mode':   this._drawMode(ctx); break;
        case 'team':   this._drawTeam(ctx); break;
        case 'stage':  this._drawStage(ctx); break;
        case 'result': this._drawResult(ctx); break;
      }
    }

    _drawTitle(ctx) {
      /* 装饰：顶部条纹 */
      ctx.fillStyle = '#e83820';
      ctx.fillRect(0, 0, C.W, 6);
      ctx.fillStyle = '#f8d838';
      ctx.fillRect(0, 6, C.W, 2);

      F.drawCenter(ctx, 'NEKKETSU', C.W / 2, 44, '#e83820', 3);
      F.drawCenter(ctx, 'STREET BASKET', C.W / 2, 76, '#f8d838', 2);
      F.drawCenter(ctx, 'GANBARE DUNK HEROES', C.W / 2, 100, '#5898f8', 1);

      /* 装饰篮球 */
      const ball = NB.Sprites.makeBall()[Math.floor(this.t / 20) % 2];
      const by = 128 + Math.abs(Math.sin(this.t * 0.06)) * -24;
      ctx.drawImage(ball, C.W / 2 - 4, Math.round(by));

      if (Math.floor(this.t / 24) % 2 === 0) {
        F.drawCenter(ctx, 'PUSH START', C.W / 2, 176, '#ffffff', 1);
      }
      F.drawCenter(ctx, 'FC REMIX 2026', C.W / 2, 216, '#585878', 1);
    }

    _drawMode(ctx) {
      F.drawCenter(ctx, 'GAME MODE', C.W / 2, 48, '#f8d838', 2);
      for (let i = 0; i < MODES.length; i++) {
        const y = 96 + i * 22;
        if (i === this.mode) {
          F.draw(ctx, '>', 66, y, '#e83820', 1);
          F.drawCenter(ctx, MODES[i], C.W / 2, y, '#ffffff', 1);
        } else {
          F.drawCenter(ctx, MODES[i], C.W / 2, y, '#787888', 1);
        }
      }
      F.drawCenter(ctx, 'W/S SELECT  ENTER OK', C.W / 2, 200, '#585878', 1);
    }

    _drawTeam(ctx) {
      const title = this.teamPhase === 0 ? 'SELECT TEAM 1P' : 'SELECT TEAM 2P';
      F.drawCenter(ctx, title, C.W / 2, 22, '#f8d838', 1);

      for (let i = 0; i < NB.TEAMS.length; i++) {
        const col = i % 3, row = Math.floor(i / 3);
        const x = 14 + col * 80, y = 44 + row * 78;
        const team = NB.TEAMS[i];
        const curSel = this.teamPhase === 0 ? this.sel.team1 : this.sel.team2;

        /* 选中框 */
        if (i === curSel) {
          ctx.fillStyle = this.teamPhase === 0 ? '#e83820' : '#2858c8';
          ctx.fillRect(x - 3, y - 3, 74, 68);
        }
        ctx.fillStyle = '#181830';
        ctx.fillRect(x - 1, y - 1, 70, 64);

        F.drawCenter(ctx, team.name, x + 34, y + 4, team.pal.shirt, 1);
        /* 已选标记 */
        if (i === this.sel.team1 && (this.teamPhase === 1 || this.state !== 'team')) {
          F.draw(ctx, '1P', x + 2, y + 4, '#e83820', 1);
        }

        /* 两名球员：迷你头像 + 属性 */
        for (let pi = 0; pi < 2; pi++) {
          const pd = team.players[pi];
          const py = y + 16 + pi * 24;
          /* 迷你头 */
          const pal = pi === 0 ? team.pal : team.pal2;
          ctx.fillStyle = pal.hair; ctx.fillRect(x + 3, py, 8, 3);
          ctx.fillStyle = pal.skin; ctx.fillRect(x + 4, py + 3, 6, 5);
          ctx.fillStyle = pal.shirt; ctx.fillRect(x + 4, py + 8, 6, 3);
          F.draw(ctx, pd.name, x + 13, py + 1, '#c8c8d8', 1);
          /* 属性条 SP JP PW SH */
          const stats = [pd.sp, pd.jp, pd.pw, pd.sh];
          const labels = ['S', 'J', 'P', 'T'];
          for (let si = 0; si < 4; si++) {
            const sx = x + 13 + si * 14;
            F.draw(ctx, labels[si], sx, py + 9, '#686878', 1);
            for (let bi = 0; bi < 5; bi++) {
              ctx.fillStyle = bi < stats[si] ? '#58c858' : '#303038';
              ctx.fillRect(sx + 4 + bi * 2 - 2, py + 11, 1, 4);
            }
          }
        }
      }
      if (this.teamPhase === 1) F.drawCenter(ctx, '2P: ARROWS + [,]', C.W / 2, 214, '#585878', 1);
    }

    _drawStage(ctx) {
      F.drawCenter(ctx, 'SELECT STAGE', C.W / 2, 40, '#f8d838', 2);
      for (let i = 0; i < NB.Stages.length; i++) {
        const y = 76 + i * 24;
        const st = NB.Stages[i];
        if (i === this.sel.stage) {
          F.draw(ctx, '>', 44, y, '#e83820', 1);
          F.draw(ctx, st.name, 58, y, '#ffffff', 1);
          F.draw(ctx, STAGE_INFO[st.id] || '', 150, y, '#5898f8', 1);
        } else {
          F.draw(ctx, st.name, 58, y, '#787888', 1);
        }
      }
      F.drawCenter(ctx, 'ENTER OK', C.W / 2, 210, '#585878', 1);
    }

    _drawResult(ctx) {
      const r = this.result;
      F.drawCenter(ctx, 'GAME SET', C.W / 2, 52, '#f8d838', 2);
      F.drawCenter(ctx, r.teamL.name + ' ' + r.scoreL, C.W / 2, 96, '#f85858', 1);
      F.drawCenter(ctx, '-', C.W / 2, 112, '#ffffff', 1);
      F.drawCenter(ctx, r.teamR.name + ' ' + r.scoreR, C.W / 2, 128, '#5898f8', 1);
      if (r.winner >= 0) {
        const wt = r.winner === 0 ? r.teamL : r.teamR;
        F.drawCenter(ctx, 'WINNER ' + wt.name + '!', C.W / 2, 158, '#58f858', 1);
      } else {
        F.drawCenter(ctx, 'DRAW GAME', C.W / 2, 158, '#58f858', 1);
      }
      if (Math.floor(this.t / 24) % 2 === 0) {
        F.drawCenter(ctx, 'PUSH START', C.W / 2, 196, '#ffffff', 1);
      }
    }
  }

  NB.Menu = Menu;
})();
