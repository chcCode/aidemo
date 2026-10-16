(function (SB) {
  'use strict';

  const UI = {
    boostHeld: false,
    selectedSkin: SB.SKINS[0],
    onStart: null,
    onRestart: null,
    els: {},
    _boardKey: ''
  };

  UI.init = function () {
    const $ = (id) => document.getElementById(id);
    this.els = {
      hud: $('hud'), start: $('startScreen'), death: $('deathScreen'),
      score: $('scoreVal'), rank: $('rankVal'), kills: $('killVal'),
      board: $('boardList'), name: $('nameInput'), skins: $('skinPicker'),
      startBtn: $('startBtn'), respawnBtn: $('respawnBtn'),
      boost: $('boostBtn'), feed: $('killFeed'), hint: $('hint'),
      dScore: $('dScore'), dRank: $('dRank'), dKills: $('dKills'), dBeat: $('dBeat'),
      killer: $('killerLine'), sound: $('soundBtn')
    };

    // 皮肤选择
    const picker = this.els.skins;
    SB.SKINS.forEach((skin, i) => {
      const el = document.createElement('div');
      el.className = 'skin-item' + (i === 0 ? ' sel' : '');
      el.title = skin.name;
      el.style.background = skin.pattern === 'solid'
        ? `radial-gradient(circle at 32% 28%, ${skin.a}, ${skin.b})`
        : `repeating-linear-gradient(45deg, ${skin.a} 0 7px, ${skin.b} 7px 14px)`;
      el.innerHTML = '<span class="check">✓</span>';
      el.addEventListener('click', () => {
        picker.querySelectorAll('.skin-item').forEach(n => n.classList.remove('sel'));
        el.classList.add('sel');
        UI.selectedSkin = skin;
        SB.Audio.unlock(); SB.Audio.ui();
      });
      picker.appendChild(el);
    });

    this.els.startBtn.addEventListener('click', () => {
      SB.Audio.unlock(); SB.Audio.ui();
      const nm = (this.els.name.value || '').trim().slice(0, SB.CONFIG.MAX_NAME_LEN);
      if (this.onStart) this.onStart(nm || '我', UI.selectedSkin);
    });

    this.els.respawnBtn.addEventListener('click', () => {
      SB.Audio.unlock(); SB.Audio.ui();
      if (this.onRestart) this.onRestart();
    });

    // 加速键
    const b = this.els.boost;
    const down = (e) => { e.preventDefault(); UI.boostHeld = true; b.classList.add('active'); SB.Audio.unlock(); };
    const up = () => { UI.boostHeld = false; b.classList.remove('active'); };
    b.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    this.els.sound.addEventListener('click', () => {
      const on = !SB.Audio.enabled;
      SB.Audio.setEnabled(on);
      this.els.sound.classList.toggle('off', !on);
      if (on) { SB.Audio.unlock(); SB.Audio.ui(); }
    });

    const tip = document.getElementById('footTip');
    if (tip) tip.textContent = SB.CONFIG.AI_COUNT + ' 条 AI 蛇已就位，你能排第几？';
  };

  UI.showStart = function () {
    this.els.start.classList.remove('hidden');
    this.els.death.classList.add('hidden');
    this.els.hud.classList.add('hidden');
    this.boostHeld = false;
    this.els.boost.classList.remove('active');
  };

  UI.showHud = function () {
    this.els.start.classList.add('hidden');
    this.els.death.classList.add('hidden');
    this.els.hud.classList.remove('hidden');
    this._boardKey = '';
  };

  UI.showDeath = function (stats) {
    this.els.death.classList.remove('hidden');
    this.els.hud.classList.add('hidden');
    this.els.dScore.textContent = stats.score;
    this.els.dRank.textContent = stats.rank;
    this.els.dKills.textContent = stats.kills;
    this.els.dBeat.textContent = stats.beat + '%';
    this.els.killer.innerHTML = stats.killer ? ('被 <b>' + escapeHtml(stats.killer) + '</b> 撞毁了') : '';
    this.boostHeld = false;
    this.els.boost.classList.remove('active');
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  UI.update = function (game) {
    if (this.els.hud.classList.contains('hidden')) return;
    const p = game.player;
    this.els.score.textContent = p ? Math.floor(p.score) : 0;
    this.els.rank.textContent = game.rank;
    this.els.kills.textContent = p ? p.kills : 0;

    // 排行榜（内容变化才重绘）
    let key = '';
    for (let i = 0; i < game.leader.length; i++) {
      const l = game.leader[i];
      key += l.id + ':' + l.score + (l.isPlayer ? ':me' : '') + ';';
    }
    if (key !== this._boardKey) {
      this._boardKey = key;
      let html = '';
      for (let i = 0; i < game.leader.length; i++) {
        const l = game.leader[i];
        html += '<li class="' + (l.isPlayer ? 'me' : '') + '">' +
          '<span class="rk">' + (i + 1) + '</span>' +
          '<span class="nm">' + escapeHtml(l.name) + '</span>' +
          '<span class="sc">' + l.score + '</span></li>';
      }
      this.els.board.innerHTML = html;
    }
  };

  UI.toast = function (text, good) {
    const feed = this.els.feed;
    const el = document.createElement('div');
    el.className = 'toast' + (good ? ' good' : '');
    el.textContent = text;
    feed.appendChild(el);
    while (feed.children.length > 4) feed.removeChild(feed.firstChild);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
  };

  SB.UI = UI;
})(window.SB);
