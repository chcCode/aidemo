(function (SB) {
  'use strict';
  const U = SB.U;
  const C = SB.CONFIG;

  const canvas = document.getElementById('game');
  const renderer = new SB.Renderer(canvas);
  const game = new SB.Game();

  let mode = 'menu';                     // menu | playing
  let lastProfile = { name: '', skin: SB.SKINS[0] };
  let deathTimer = 0;

  const input = {
    mx: 0, my: 0,
    active: true,
    rightHeld: false,
    keys: Object.create(null),
    boostKey: false
  };

  /* ---------------- 尺寸 ---------------- */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.resize(window.innerWidth, window.innerHeight, dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------------- 输入 ---------------- */
  window.addEventListener('pointermove', (e) => {
    input.mx = e.clientX;
    input.my = e.clientY;
    if (e.pointerType === 'touch' || e.pointerType === 'mouse') input.active = true;
  }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    SB.Audio.unlock();
    input.mx = e.clientX;
    input.my = e.clientY;
    input.active = true;
    if (e.button === 2) input.rightHeld = true;
  });

  window.addEventListener('pointerup', (e) => {
    if (e.button === 2) input.rightHeld = false;
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    input.keys[e.code] = true;
    if (e.code === 'Space') { input.boostKey = true; e.preventDefault(); }
    if (e.code === 'Enter' && mode === 'menu') document.getElementById('startBtn').click();
  });
  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
    if (e.code === 'Space') input.boostKey = false;
  });

  window.addEventListener('blur', () => {
    input.keys = Object.create(null);
    input.boostKey = false;
    input.rightHeld = false;
    SB.UI.boostHeld = false;
    const b = document.getElementById('boostBtn');
    if (b) b.classList.remove('active');
  });

  function keyboardDir() {
    const k = input.keys;
    let x = 0, y = 0;
    if (k['KeyW'] || k['ArrowUp']) y -= 1;
    if (k['KeyS'] || k['ArrowDown']) y += 1;
    if (k['KeyA'] || k['ArrowLeft']) x -= 1;
    if (k['KeyD'] || k['ArrowRight']) x += 1;
    return (x || y) ? { x, y } : null;
  }

  function applyPlayerControl() {
    if (mode !== 'playing') return;
    const p = game.player;
    if (!p || !p.alive) return;

    const kd = keyboardDir();
    if (kd) {
      p.targetAngle = Math.atan2(kd.y, kd.x);
    } else if (input.active) {
      const wp = renderer.screenToWorld(input.mx, input.my, game.cam);
      const d = U.dist(p.head.x, p.head.y, wp.x, wp.y);
      if (d > 14) p.targetAngle = U.angleTo(p.head.x, p.head.y, wp.x, wp.y);
    }

    p.boosting = SB.UI.boostHeld || input.rightHeld || input.boostKey;
  }

  /* ---------------- 流程 ---------------- */
  function startGame(name, skin) {
    lastProfile = { name, skin };
    mode = 'playing';
    game.reset(name, skin);
    SB.UI.showHud();
    SB.UI.toast('存活到最后，冲上排行榜！', true);
    if (deathTimer) { clearTimeout(deathTimer); deathTimer = 0; }
  }

  function enterMenu() {
    mode = 'menu';
    game.reset('贪吃蛇', U.pick(SB.SKINS));
    if (game.player) game.player.ai = new SB.AI(game.player, game);
    SB.UI.showStart();
  }

  SB.UI.onStart = startGame;
  SB.UI.onRestart = function () {
    startGame(lastProfile.name || '我', lastProfile.skin || SB.SKINS[0]);
  };

  game.onPlayerDeath = function (snake, killer) {
    SB.Audio.die();
    if (mode !== 'playing') {
      // 展示模式：原地复活继续跑
      game._spawnSnake(snake, false);
      if (!snake.ai) snake.ai = new SB.AI(snake, game);
      return;
    }
    const rank = game.finalRank(snake.score);
    const total = game.snakes.length;
    const beat = U.clamp(Math.round((1 - rank / Math.max(total, 1)) * 100), 0, 99);
    if (killer) SB.UI.toast('你被「' + killer.name + '」击败了');
    if (deathTimer) clearTimeout(deathTimer);
    deathTimer = setTimeout(() => {
      deathTimer = 0;
      if (mode !== 'playing') return;
      SB.UI.showDeath({
        score: Math.floor(snake.score),
        rank,
        kills: snake.kills,
        beat,
        killer: killer ? killer.name : ''
      });
    }, 850);
  };

  game.onFeed = function (killer, victim, awarded) {
    if (awarded && killer.isPlayer) {
      SB.Audio.kill();
      SB.UI.toast('击杀了「' + victim.name + '」  +6', true);
    }
  };

  game.onEat = function () { SB.Audio.eat(); };

  /* ---------------- 主循环 ---------------- */
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;

    applyPlayerControl();
    game.update(dt);
    renderer.draw(game, dt);
    SB.UI.update(game);

    requestAnimationFrame(frame);
  }

  /* ---------------- 启动 ---------------- */
  SB.UI.init();
  enterMenu();
  input.mx = window.innerWidth / 2;
  input.my = window.innerHeight / 2;
  SB.game = game;
  SB.renderer = renderer;
  SB.getMode = function () { return mode; };
  requestAnimationFrame(frame);
})(window.SB);
