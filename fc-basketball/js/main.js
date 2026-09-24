/* main.js : 入口 —— 画布初始化 / 固定步长主循环 / 场景切换 */
window.NB = window.NB || {};

window.addEventListener('load', function () {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  NB.Input.init();
  NB.Sprites.items = NB.Sprites.makeItems();   // 道具精灵缓存

  /* 浏览器自动播放限制：首次交互后初始化音频 */
  window.addEventListener('keydown', function () { NB.Audio.init(); });
  window.addEventListener('mousedown', function () { NB.Audio.init(); });

  let scene = new NB.Menu();
  let last = performance.now();
  let acc = 0;
  const STEP = 1000 / 60;

  function loop(ts) {
    requestAnimationFrame(loop);
    acc += ts - last;
    last = ts;
    if (acc > 250) acc = 250;

    while (acc >= STEP) {
      const r = scene.update();
      if (r instanceof NB.Match) scene = r;              // 菜单 -> 比赛
      else if (r === 'done') scene = new NB.Menu(scene.result);  // 比赛 -> 结算
      NB.Input.flush();
      acc -= STEP;
    }

    ctx.setTransform(NB.C.SCALE, 0, 0, NB.C.SCALE, 0, 0);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, NB.C.W, NB.C.H);
    scene.draw(ctx);
  }
  requestAnimationFrame(loop);
});
