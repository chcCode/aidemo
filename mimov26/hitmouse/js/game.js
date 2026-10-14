/* =========================================================
   金山打字通 · 打地鼠 —— 游戏主逻辑
   ========================================================= */
(() => {
  'use strict';

  /* ---------------- 难度配置 ---------------- */
  const DIFFS = {
    easy:   { name: '初级', time: 60, lives: 6, spawn: 1750, stay: 2800, maxMoles: 1 },
    normal: { name: '中级', time: 50, lives: 5, spawn: 1250, stay: 2150, maxMoles: 2 },
    hard:   { name: '高级', time: 40, lives: 4, spawn: 950,  stay: 1650, maxMoles: 3 },
  };
  const LEVEL_STEP = 900;     // 每 900 分升一关
  const MAX_LEVEL  = 12;
  const HOLE_COUNT = 9;
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /* ---------------- DOM ---------------- */
  const $ = (s) => document.querySelector(s);
  const field     = $('#field');
  const stage     = $('#stage');
  const fxLayer   = $('#fxLayer');
  const appWindow = $('#appWindow');

  const hudScore = $('#hudScore'), hudTime = $('#hudTime'), hudLives = $('#hudLives'),
        hudCombo = $('#hudCombo'), hudLevel = $('#hudLevel'), hudExp = $('#hudExp'),
        hudDiff  = $('#hudDiff');

  const ovStart = $('#ovStart'), ovOver = $('#ovOver'), ovPause = $('#ovPause'), ovTune = $('#ovTune');
  const levelBanner = $('#levelBanner');
  const sbHint = $('#sbHint'), sbHit = $('#sbHit'), sbMiss = $('#sbMiss');

  /* ---------------- 地鼠 SVG ---------------- */
  function moleSVG(i) {
    const g = `mg${i}`, s = `ms${i}`;
    return `
<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="${g}" cx="36%" cy="26%" r="80%">
      <stop offset="0" stop-color="#c08a52"/>
      <stop offset="55%" stop-color="#9a672f"/>
      <stop offset="100%" stop-color="#6d421b"/>
    </radialGradient>
    <radialGradient id="${s}" cx="40%" cy="30%" r="75%">
      <stop offset="0" stop-color="#f3d3a8"/>
      <stop offset="100%" stop-color="#d3a067"/>
    </radialGradient>
  </defs>

  <!-- 耳朵 -->
  <circle cx="26" cy="33" r="16.5" fill="#7a4a22"/>
  <circle cx="26" cy="33" r="8.5" fill="#b07b4d"/>
  <circle cx="94" cy="33" r="16.5" fill="#7a4a22"/>
  <circle cx="94" cy="33" r="8.5" fill="#b07b4d"/>

  <!-- 身体 -->
  <ellipse cx="60" cy="80" rx="47" ry="53" fill="url(#${g})"/>
  <ellipse cx="43" cy="52" rx="20" ry="15" fill="rgba(255,255,255,.14)"/>

  <!-- 肚皮 -->
  <ellipse cx="60" cy="96" rx="32" ry="33" fill="url(#${s})"/>

  <!-- 爪子 -->
  <ellipse cx="22" cy="117" rx="17" ry="12.5" fill="#8b5a2b"/>
  <ellipse cx="98" cy="117" rx="17" ry="12.5" fill="#8b5a2b"/>
  <g stroke="#f5e9d5" stroke-width="2.6" stroke-linecap="round">
    <path d="M9 112 l0 7"/><path d="M15.5 110 l0 8"/><path d="M22 109 l0 8"/>
    <path d="M98 109 l0 8"/><path d="M104.5 110 l0 8"/><path d="M111 112 l0 7"/>
  </g>

  <!-- 正常表情 -->
  <g class="face-normal">
    <ellipse cx="44" cy="60" rx="7.5" ry="8.5" fill="#1b1208"/>
    <ellipse cx="76" cy="60" rx="7.5" ry="8.5" fill="#1b1208"/>
    <circle cx="46.5" cy="57" r="2.6" fill="#fff"/>
    <circle cx="78.5" cy="57" r="2.6" fill="#fff"/>
    <ellipse cx="60" cy="76" rx="11" ry="7.5" fill="#4a2c14"/>
    <ellipse cx="56" cy="73" rx="3.4" ry="2.2" fill="rgba(255,255,255,.55)"/>
    <path d="M60 83 q-8 9 -17 5 M60 83 q8 9 17 5" stroke="#4a2c14" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <rect x="49" y="88" width="9.5" height="15" rx="2.4" fill="#fffdf6" stroke="#cbbfa8" stroke-width="1"/>
    <rect x="60.5" y="88" width="9.5" height="15" rx="2.4" fill="#fffdf6" stroke="#cbbfa8" stroke-width="1"/>
    <g stroke="rgba(74,44,20,.55)" stroke-width="1.8" stroke-linecap="round">
      <path d="M34 76 L14 71"/><path d="M34 82 L15 85"/>
      <path d="M86 76 L106 71"/><path d="M86 82 L105 85"/>
    </g>
  </g>

  <!-- 命中表情 -->
  <g class="face-hit">
    <g stroke="#22160a" stroke-width="4.4" stroke-linecap="round">
      <path d="M38 54 L50 66 M50 54 L38 66"/>
      <path d="M70 54 L82 66 M82 54 L70 66"/>
    </g>
    <ellipse cx="60" cy="84" rx="13" ry="11" fill="#3a2310"/>
    <path d="M47 84 q13 -8 26 0" fill="#c9566a"/>
    <rect x="50" y="76" width="9" height="9" rx="2" fill="#fffdf6"/>
    <rect x="61" y="76" width="9" height="9" rx="2" fill="#fffdf6"/>
    <ellipse cx="44" cy="74" rx="13" ry="7" fill="rgba(255,110,110,.5)"/>
    <ellipse cx="76" cy="74" rx="13" ry="7" fill="rgba(255,110,110,.5)"/>
  </g>
</svg>`;
  }

  const HAMMER_SVG = `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(-18 60 60)">
    <rect x="53" y="42" width="13" height="66" rx="6" fill="#c98c4b" stroke="#7d5326" stroke-width="3"/>
    <rect x="20" y="14" width="80" height="34" rx="9" fill="#9aa3ad" stroke="#4d545c" stroke-width="4"/>
    <rect x="20" y="14" width="80" height="12" rx="6" fill="#cfd6dd" opacity=".85"/>
    <circle cx="60" cy="31" r="6" fill="#6f777f"/>
  </g>
</svg>`;

  /* ---------------- 建立 9 个洞 ---------------- */
  const holes = [];
  for (let i = 0; i < HOLE_COUNT; i++) {
    const h = document.createElement('div');
    h.className = 'hole';
    h.dataset.idx = i;
    h.innerHTML = `
      <div class="rim"></div>
      <div class="pit"></div>
      <div class="mole-slot">
        <div class="mole">${moleSVG(i)}
          <span class="cd-num">0.0</span>
          <span class="badge">
            <svg class="cd" viewBox="0 0 100 100" aria-hidden="true">
              <circle class="cd-bg" cx="50" cy="50" r="45"/>
              <circle class="cd-fg" cx="50" cy="50" r="45"/>
            </svg>
            <em class="ltr">A</em>
          </span>
        </div>
        <div class="stars"><i></i><i></i><i></i><i></i></div>
        <span class="esc">跑啦！</span>
      </div>
      <div class="lip"></div>
      <div class="tuft l"></div>
      <div class="tuft r"></div>`;
    field.appendChild(h);
    holes.push({
      el: h,
      mole: h.querySelector('.mole'),
      badge: h.querySelector('.badge'),
      ltr: h.querySelector('.ltr'),
      cdNum: h.querySelector('.cd-num'),
      cdFg: h.querySelector('.cd-fg'),
      state: 'idle',       // idle | up | hit | miss
      letter: '',
      freeAt: 0,
      expiresAt: 0,
      upAt: 0,
      stay: 0,
      hitAt: 0,
      missAt: 0,
    });
  }

  /* ---------------- 游戏状态 ---------------- */
  const S = {
    mode: 'menu',          // menu | running | paused | over
    diffKey: 'normal',
    score: 0, timeLeft: 0, lives: 0, maxLives: 0,
    combo: 0, maxCombo: 0, level: 1,
    hit: 0, miss: 0,
    nextSpawnAt: 0, lastTick: -1,
    raf: 0, lastFrame: 0, pausedAt: 0,
  };

  const bestKey = (k) => `kst-mole-best-${k}`;
  const getBest = (k) => { try { return +(localStorage.getItem(bestKey(k)) || 0); } catch (e) { return 0; } };
  const setBest = (k, v) => { try { localStorage.setItem(bestKey(k), v); } catch (e) { /* ignore */ } };

  /* ---------------- 出现时间微调（null = 跟随难度自动缩放） ---------------- */
  const TUNE_KEY = 'kst-mole-tune';
  const TUNE = { stay: null, spawn: null };
  try {
    const o = JSON.parse(localStorage.getItem(TUNE_KEY) || 'null');
    if (o) {
      if (Number.isFinite(o.stay))  TUNE.stay  = Math.min(5000, Math.max(500, o.stay));
      if (Number.isFinite(o.spawn)) TUNE.spawn = Math.min(3000, Math.max(250, o.spawn));
    }
  } catch (e) { /* ignore */ }
  const saveTune = () => { try { localStorage.setItem(TUNE_KEY, JSON.stringify(TUNE)); } catch (e) { /* ignore */ } };

  const diff = () => DIFFS[S.diffKey];

  /* ---------------- 视觉辅助 ---------------- */
  function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 140);
  }

  function renderHUD() {
    hudScore.textContent = S.score;
    hudTime.textContent = Math.ceil(S.timeLeft);
    hudTime.classList.toggle('danger', S.timeLeft <= 10 && S.mode === 'running');

    hudLives.innerHTML = '';
    for (let i = 0; i < S.maxLives; i++) {
      const hp = document.createElement('span');
      hp.className = 'hp' + (i < S.lives ? '' : ' off');
      hp.textContent = '❤';
      hudLives.appendChild(hp);
    }

    hudCombo.textContent = S.combo;
    hudCombo.classList.toggle('hot', S.combo >= 5);
    hudLevel.textContent = S.level;
    hudExp.style.width = ((S.score % LEVEL_STEP) / LEVEL_STEP * 100).toFixed(1) + '%';
    hudDiff.textContent = diff().name;

    sbHit.textContent = `命中：${S.hit}`;
    sbMiss.textContent = `逃脱：${S.miss}`;
  }

  function stagePos(el) {
    const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height * 0.30 };
  }

  function floatScore(holeEl, text, cls = '') {
    const p = stagePos(holeEl);
    const d = document.createElement('div');
    d.className = 'float-score ' + cls;
    d.textContent = text;
    d.style.left = p.x + 'px';
    d.style.top = p.y + 'px';
    fxLayer.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  function spawnHammer(holeEl) {
    const p = stagePos(holeEl);
    const d = document.createElement('div');
    d.className = 'hammer';
    d.innerHTML = HAMMER_SVG;
    d.style.left = p.x + 'px';
    d.style.top = p.y + 'px';
    fxLayer.appendChild(d);
    setTimeout(() => d.remove(), 360);
  }

  function comboPop(text) {
    const d = document.createElement('div');
    d.className = 'combo-pop';
    d.textContent = text;
    stage.appendChild(d);
    setTimeout(() => d.remove(), 950);
  }

  function showBanner(text) {
    levelBanner.textContent = text;
    levelBanner.classList.remove('show');
    void levelBanner.offsetWidth;
    levelBanner.classList.add('show');
  }

  function shake() {
    stage.classList.remove('shake');
    void stage.offsetWidth;
    stage.classList.add('shake');
  }

  function hint(text) {
    sbHint.textContent = text;
    sbHint.classList.remove('hint-flash');
    void sbHint.offsetWidth;
    sbHint.classList.add('hint-flash');
  }

  /* ---------------- 地鼠生成 ---------------- */
  function baseStay()  { return Math.max(750, diff().stay - (S.level - 1) * 150); }
  function baseSpawn() { return Math.max(430, diff().spawn - (S.level - 1) * 72); }
  function curStay()   { return TUNE.stay  != null ? Math.max(500, TUNE.stay)  : baseStay(); }
  function curSpawn()  { return TUNE.spawn != null ? Math.max(250, TUNE.spawn) : baseSpawn(); }
  function curMaxMoles(){ return Math.min(4, diff().maxMoles + Math.floor((S.level - 1) / 3)); }

  function activeUpCount() { return holes.filter(h => h.state === 'up').length; }

  function spawnMole(now) {
    const idle = holes.filter(h => h.state === 'idle');
    if (!idle.length) return;
    const used = holes.filter(h => h.state === 'up').map(h => h.letter);
    const pool = [...LETTERS].filter(c => !used.includes(c));
    if (!pool.length) return;

    const stay = curStay();
    const h = idle[Math.floor(Math.random() * idle.length)];
    h.letter = pool[Math.floor(Math.random() * pool.length)];
    h.ltr.textContent = h.letter;
    h.state = 'up';
    h.upAt = now;
    h.stay = stay;
    h.expiresAt = now + stay;
    h.cdFg.style.strokeDashoffset = '0';
    h.cdNum.classList.remove('urgent');
    h.el.classList.remove('down', 'hit', 'miss');
    h.el.classList.add('up');
    SFX.pop();
  }

  /* 地鼠头顶倒计时：剩余秒数 + 字母外圈消耗环 */
  const CD_LEN = 282.743; // 2 * PI * 45
  function updateCountdown(h, now) {
    const remain = Math.max(0, h.expiresAt - now);
    const p = h.stay > 0 ? remain / h.stay : 0;
    const col = p > 0.5 ? '#5dff78' : p > 0.25 ? '#ffd23c' : '#ff5f5f';
    h.mole.style.setProperty('--cd', col);
    h.cdFg.style.strokeDashoffset = (CD_LEN * (1 - p)).toFixed(1);
    h.cdNum.textContent = (remain / 1000).toFixed(1);
    h.cdNum.classList.toggle('urgent', p <= 0.25);
  }

  function resetHoles() {
    holes.forEach(h => {
      h.state = 'idle';
      h.el.classList.remove('up', 'hit', 'miss', 'down');
    });
  }

  /* ---------------- 打击 ---------------- */
  function hitMole(h, now) {
    h.state = 'hit';
    h.hitAt = now;
    h.el.classList.remove('up', 'miss', 'down');
    h.el.classList.add('hit');

    S.combo++;
    S.hit++;
    S.maxCombo = Math.max(S.maxCombo, S.combo);

    const mult = 1 + Math.min(Math.floor(S.combo / 5), 4) * 0.5;
    const crit = S.combo > 0 && S.combo % 10 === 0;
    let pts = Math.round(100 * mult * (crit ? 2 : 1));

    S.score += pts;
    SFX.hit(S.combo);
    floatScore(h.el, '+' + pts, crit ? 'crit' : '');
    spawnHammer(h.el);
    bump(hudScore);

    if (S.combo > 0 && S.combo % 5 === 0) {
      comboPop(`连击 x${S.combo}!`);
      SFX.combo();
    }
    checkLevel();
    renderHUD();
  }

  function missMole(h, now) {
    h.state = 'miss';
    h.missAt = now;
    h.el.classList.remove('up');
    h.el.classList.add('miss');

    S.combo = 0;
    S.miss++;
    S.lives--;
    SFX.miss();
    shake();
    floatScore(h.el, '-1 ❤', 'pen');
    hint(`哎呀，${h.letter} 跑掉了！生命 -1（剩余 ${Math.max(0, S.lives)} 条）`);
    renderHUD();

    if (S.lives <= 0) gameOver('life');
  }

  function wrongKey(letter) {
    S.combo = 0;
    S.score = Math.max(0, S.score - 20);
    SFX.error();
    bump(hudScore);
    const d = document.createElement('div');
    d.className = 'float-score pen';
    d.textContent = '按错 -20';
    d.style.left = '50%';
    d.style.top = '72%';
    fxLayer.appendChild(d);
    setTimeout(() => d.remove(), 900);
    hint(`按错啦！场上只有 ${lettersOnBoard().join('、') || '还没有地鼠'}，快找对应字母！`);
    renderHUD();
  }

  function lettersOnBoard() {
    return [...new Set(holes.filter(h => h.state === 'up').map(h => h.letter))];
  }

  function checkLevel() {
    const nl = Math.min(MAX_LEVEL, 1 + Math.floor(S.score / LEVEL_STEP));
    if (nl > S.level) {
      S.level = nl;
      showBanner(`第 ${S.level} 关`);
      SFX.level();
      hint(`升级！地鼠更快了，当前最多同时出现 ${curMaxMoles()} 只！`);
    }
  }

  /* ---------------- 流程控制 ---------------- */
  function startGame() {
    const d = diff();
    S.score = 0;
    S.timeLeft = d.time;
    S.lives = S.maxLives = d.lives;
    S.combo = 0; S.maxCombo = 0; S.level = 1;
    S.hit = 0; S.miss = 0;
    S.nextSpawnAt = performance.now() + 500;
    S.lastTick = -1;
    S.mode = 'running';
    resetHoles();
    fxLayer.innerHTML = '';

    ovStart.classList.add('hidden');
    ovOver.classList.add('hidden');
    ovPause.classList.add('hidden');
    ovTune.classList.add('hidden');
    $('#recordTip').classList.add('hidden');

    hudTime.classList.remove('danger');
    renderHUD();
    hint('开始！按下地鼠头上的字母，把它打回洞里！');
    SFX.start();
    showBanner(`第 1 关`);

    S.lastFrame = performance.now();
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(loop);
  }

  function gameOver(reason) {
    if (S.mode === 'over') return;
    S.mode = 'over';
    cancelAnimationFrame(S.raf);
    resetHoles();

    const prevBest = getBest(S.diffKey);
    const isRecord = S.score > prevBest;
    if (isRecord) setBest(S.diffKey, S.score);

    $('#resScore').textContent = S.score;
    $('#resHit').textContent = S.hit;
    $('#resMiss').textContent = S.miss;
    $('#resCombo').textContent = S.maxCombo;
    $('#resLevel').textContent = S.level;
    $('#resBest').textContent = Math.max(prevBest, S.score);
    $('#recordTip').classList.toggle('hidden', !isRecord);

    ovOver.classList.remove('hidden');
    hint(reason === 'life' ? '生命用完啦！点击「再来一局」重新挑战。' : '时间到！看看你的成绩吧。');
    isRecord ? SFX.fanfare() : SFX.over();
    renderHUD();
  }

  function backToMenu() {
    S.mode = 'menu';
    cancelAnimationFrame(S.raf);
    resetHoles();
    fxLayer.innerHTML = '';
    S.score = 0;
    S.timeLeft = diff().time;
    S.lives = S.maxLives = diff().lives;
    S.combo = 0; S.maxCombo = 0; S.level = 1;
    S.hit = 0; S.miss = 0;
    ovOver.classList.add('hidden');
    ovPause.classList.add('hidden');
    ovTune.classList.add('hidden');
    ovStart.classList.remove('hidden');
    hudTime.classList.remove('danger');
    $('#startBest').innerHTML = `本机最高分：<b>${getBest(S.diffKey)}</b>（${DIFFS[S.diffKey].name}）`;
    renderHUD();
    hint('选择难度后点击「开始游戏」，或按 Enter 直接开始。');
  }

  function togglePause(force) {
    if (S.mode !== 'running' && S.mode !== 'paused') return;
    const toPause = force !== undefined ? force : S.mode === 'running';
    if (toPause) {
      S.mode = 'paused';
      S.pausedAt = performance.now();
      ovPause.classList.remove('hidden');
      hint('已暂停 — 按 P 继续');
    } else {
      // 补偿暂停时长：否则暂停前出洞的地鼠一恢复就会因超时全部逃脱
      const shift = performance.now() - S.pausedAt;
      if (shift > 0) holes.forEach(h => { if (h.state === 'up') h.expiresAt += shift; });
      S.mode = 'running';
      ovPause.classList.add('hidden');
      ovTune.classList.add('hidden');
      S.lastFrame = performance.now();
      S.nextSpawnAt = performance.now() + 600;
      hint('继续！打起精神来～');
    }
  }

  /* ---------------- 出现时间微调面板 ---------------- */
  const tuneStayIn  = $('#tuneStay'),  tuneSpawnIn  = $('#tuneSpawn'),
        tuneStayVal = $('#tuneStayVal'), tuneSpawnVal = $('#tuneSpawnVal'),
        tuneMenuInfo = $('#tuneMenuInfo');
  let tuneOpenedRunning = false;

  const sec = (ms) => (ms / 1000).toFixed(1) + 's';

  function refreshTuneUI() {
    const ds = baseStay(), dsp = baseSpawn();
    tuneStayIn.value  = TUNE.stay  != null ? TUNE.stay  : ds;
    tuneSpawnIn.value = TUNE.spawn != null ? TUNE.spawn : dsp;
    tuneStayVal.textContent  = TUNE.stay  != null ? `自定义 ${sec(TUNE.stay)}`  : `跟随难度 ${sec(ds)}`;
    tuneSpawnVal.textContent = TUNE.spawn != null ? `自定义 ${sec(TUNE.spawn)}` : `跟随难度 ${sec(dsp)}`;
    tuneStayVal.classList.toggle('custom',  TUNE.stay  != null);
    tuneSpawnVal.classList.toggle('custom', TUNE.spawn != null);
    tuneMenuInfo.textContent = (TUNE.stay == null && TUNE.spawn == null)
      ? '跟随难度'
      : `停留${sec(curStay())}·间隔${sec(curSpawn())}`;
  }

  function applyTune() {
    saveTune();
    refreshTuneUI();
    if (S.mode === 'running' || S.mode === 'menu') hint(`出现时间：停留 ${sec(curStay())} ｜ 出洞间隔 ${sec(curSpawn())}`);
  }

  function resetTune() {
    TUNE.stay = null;
    TUNE.spawn = null;
    saveTune();
    refreshTuneUI();
  }

  function openTune() {
    tuneOpenedRunning = S.mode === 'running';
    if (tuneOpenedRunning) togglePause(true);
    refreshTuneUI();
    ovTune.classList.remove('hidden');
  }

  function closeTune() {
    ovTune.classList.add('hidden');
    if (tuneOpenedRunning) togglePause(false);
    tuneOpenedRunning = false;
    applyTune();
  }

  tuneStayIn.addEventListener('input', () => {
    TUNE.stay = +tuneStayIn.value;
    refreshTuneUI();
    SFX.tick(1040);
  });
  tuneSpawnIn.addEventListener('input', () => {
    TUNE.spawn = +tuneSpawnIn.value;
    refreshTuneUI();
    SFX.tick(660);
  });
  $('#tuneDone').addEventListener('click', closeTune);
  $('#tuneReset').addEventListener('click', () => { resetTune(); SFX.pop(); });

  /* ---------------- 主循环 ---------------- */
  function loop(now) {
    S.raf = requestAnimationFrame(loop);
    if (S.mode !== 'running') return;

    const dt = Math.min(120, now - S.lastFrame);
    S.lastFrame = now;

    /* 倒计时 */
    S.timeLeft -= dt / 1000;
    if (S.timeLeft <= 0) {
      S.timeLeft = 0;
      renderHUD();
      gameOver('time');
      return;
    }
    const sec = Math.ceil(S.timeLeft);
    if (sec !== S.lastTick) {
      S.lastTick = sec;
      if (sec <= 5 && sec > 0) SFX.tick();
      renderHUD();
    }

    /* 出洞 */
    if (now >= S.nextSpawnAt && activeUpCount() < curMaxMoles()) {
      spawnMole(now);
      S.nextSpawnAt = now + curSpawn() * (0.72 + Math.random() * 0.62);
    }

    /* 状态机 + 地鼠倒计时 */
    for (const h of holes) {
      if (h.state === 'up') {
        updateCountdown(h, now);
        if (now >= h.expiresAt) {
          missMole(h, now);
          if (S.mode !== 'running') return;
        }
      } else if (h.state === 'hit' && now - h.hitAt >= 470) {
        h.state = 'idle';
        h.el.classList.remove('hit');
        h.el.classList.add('down');
      } else if (h.state === 'miss' && now - h.missAt >= 640) {
        h.state = 'idle';
        h.el.classList.remove('miss');
        h.el.classList.add('down');
      }
    }
  }

  /* ---------------- 输入 ---------------- */
  function handleKey(e) {
    if (e.ctrlKey && e.key.toLowerCase() === 'r') { e.preventDefault(); startGame(); return; }
    const k = e.key;

    if (k === 'Enter') {
      if (S.mode === 'menu' || S.mode === 'over') { e.preventDefault(); startGame(); }
      return;
    }
    if (k === 'Escape') {
      if (!ovTune.classList.contains('hidden')) { e.preventDefault(); closeTune(); return; }
      if (S.mode === 'running' || S.mode === 'paused') { e.preventDefault(); backToMenu(); }
      return;
    }
    if (k === 'p' || k === 'P') { e.preventDefault(); togglePause(); return; }
    if (k === 'm' || k === 'M') {
      const m = SFX.toggleMute();
      hint(m ? '声音已关闭（按 M 恢复）' : '声音已开启');
      return;
    }
    if (S.mode !== 'running') return;

    const key = (k || '').toUpperCase();
    if (!/^[A-Z]$/.test(key) || e.ctrlKey || e.altKey) return;
    e.preventDefault();

    const target = holes
      .filter(h => h.state === 'up' && h.letter === key)
      .sort((a, b) => a.expiresAt - b.expiresAt)[0];

    if (target) hitMole(target, performance.now());
    else wrongKey(key);
  }

  document.addEventListener('keydown', handleKey);

  /* 鼠标 / 触屏点击地鼠 */
  field.addEventListener('pointerdown', (e) => {
    if (S.mode !== 'running') return;
    const holeEl = e.target.closest('.hole');
    if (!holeEl) return;
    const h = holes[+holeEl.dataset.idx];
    if (h && h.state === 'up') hitMole(h, performance.now());
  });

  /* ---------------- 菜单 & 按钮 ---------------- */
  document.querySelectorAll('.menu').forEach(m => {
    m.querySelector('.menu-label').addEventListener('click', (e) => {
      e.stopPropagation();
      const open = m.classList.contains('open');
      document.querySelectorAll('.menu').forEach(x => x.classList.remove('open'));
      m.classList.toggle('open', !open);
    });
  });
  document.addEventListener('click', () =>
    document.querySelectorAll('.menu').forEach(x => x.classList.remove('open')));

  document.querySelectorAll('.menu-op').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.act;
      if (a === 'restart') startGame();
      else if (a === 'pause') togglePause();
      else if (a.startsWith('diff-')) {
        S.diffKey = a.slice(5);
        syncDiffButtons();
        backToMenu();
        startGame();
      }
      else if (a === 'mute') {
        const m = SFX.toggleMute();
        hint(m ? '声音已关闭' : '声音已开启');
      }
      else if (a === 'tune') openTune();
      else if (a === 'tune-preset-fast') { TUNE.stay = 1200; TUNE.spawn = 600;  applyTune(); SFX.pop(); }
      else if (a === 'tune-preset-slow') { TUNE.stay = 3500; TUNE.spawn = 1600; applyTune(); SFX.pop(); }
      else if (a === 'tune-reset') { resetTune(); applyTune(); SFX.pop(); }
      else if (a === 'rules') hint('规则：地鼠出洞 → 按头顶字母打中；漏打扣 1 生命；连击有加分加成！');
      else if (a === 'keys') hint('按键：A–Z 打地鼠 ｜ P 暂停 ｜ M 静音 ｜ Enter 开始 ｜ Esc 返回菜单');
    });
  });

  function syncDiffButtons() {
    document.querySelectorAll('.diff-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.diff === S.diffKey));
    hudDiff.textContent = DIFFS[S.diffKey].name;
    if (S.mode === 'menu') {
      S.timeLeft = diff().time;
      S.lives = S.maxLives = diff().lives;
      renderHUD();
    }
    $('#startBest').innerHTML = `本机最高分：<b>${getBest(S.diffKey)}</b>（${DIFFS[S.diffKey].name}）`;
    refreshTuneUI();
  }

  document.querySelectorAll('.diff-btn').forEach(b => {
    b.addEventListener('click', () => {
      S.diffKey = b.dataset.diff;
      syncDiffButtons();
      SFX.pop();
    });
  });

  $('#btnStart').addEventListener('click', startGame);
  $('#btnAgain').addEventListener('click', startGame);
  $('#btnMenu').addEventListener('click', backToMenu);
  $('#btnResume').addEventListener('click', () => togglePause(false));

  /* 标题栏按钮 */
  $('#btnMin').addEventListener('click', () => appWindow.classList.add('minimized'));
  $('#btnMax').addEventListener('click', () => appWindow.classList.toggle('maximized'));
  $('#btnClose').addEventListener('click', () => {
    if (S.mode === 'running') togglePause(true);
    appWindow.classList.add('minimized');
  });
  document.querySelector('.desktop').addEventListener('click', (e) => {
    if (e.target.closest('.app-window')) return;
    appWindow.classList.remove('minimized');
  });

  /* 切后台自动暂停 */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.mode === 'running') togglePause(true);
  });

  /* ---------------- 初始化 ---------------- */
  syncDiffButtons();
  refreshTuneUI();
  backToMenu();
})();
