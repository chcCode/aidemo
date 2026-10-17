// HUD：CS1.6 风格 雷达 / 血甲弹药 / 击杀播报 / 计分板 / 购买菜单
import { WEAPONS, BUY_TABLE } from './weapons.js';

const $ = id => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), radar: $('radar'), hp: $('hp'), ap: $('ap'), hpbox: $('hpbox'),
      clip: $('clip'), reserve: $('reserve'), wpnname: $('wpnname'), ammobox: $('ammobox'),
      money: $('money'), timer: $('timer'), ctScore: $('ctScore'), tScore: $('tScore'),
      killfeed: $('killfeed'), centermsg: $('centermsg'), hitmark: $('hitmark'),
      crosshair: $('crosshair'), vignette: $('vignette'), scopes: $('scopes'), scopelines: $('scopelines'),
      scoreboard: $('scoreboard'), sbCT: $('sbCT').querySelector('.sb-rows'),
      sbT: $('sbT').querySelector('.sb-rows'), sbCTn: $('sbCTn'), sbTn: $('sbTn'),
      buymenu: $('buymenu'), buyList: $('buyList'),
      deathscreen: $('deathscreen'), dsBy: $('dsBy'), dsWait: $('dsWait'),
      endscreen: $('endscreen'), endKills: $('endKills'), endDeaths: $('endDeaths'),
      endAcc: $('endAcc'), endHs: $('endHs'), endTitle: $('endTitle'), againBtn: $('againBtn'),
      dmgdir: $('dmgdir')
    };
    this.rctx = this.el.radar.getContext('2d');
    this.radarPolys = [];
    this._kfN = 0;
    this._dmgArcs = [];
    this._gap = 6;
  }

  setMap(map) {
    const data = map.data;
    const floorY = map.bounds.floorY;
    const polys = [];
    for (const g of data.meshes) {
      const P = g.positions, N = g.normals;
      for (let i = 0; i < P.length; i += 9) {
        const ny = (N[i + 1] + N[i + 4] + N[i + 7]) / 3;
        if (ny > 0.7) {
          const ay = (P[i + 1] + P[i + 4] + P[i + 7]) / 3;
          if (ay > floorY + 18) {
            polys.push({
              y: ay,
              pts: [[P[i], P[i + 2]], [P[i + 3], P[i + 5]], [P[i + 6], P[i + 8]]]
            });
          }
        }
      }
    }
    // 合并同高度块（直接绘制即可）
    this.radarPolys = polys;
    this.map = map;
  }

  // ---------- 雷达 ----------
  drawRadar(player, entities) {
    const ctx = this.rctx, S = this.el.radar.width;
    const b = this.map.bounds;
    const w = b.maxX - b.minX, hgt = b.maxZ - b.minZ;
    const scale = (S - 16) / Math.max(w, hgt);
    const cx = S / 2, cy = S / 2;
    const midX = (b.minX + b.maxX) / 2, midZ = (b.minZ + b.maxZ) / 2;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.yaw);
    const px = (x, z) => [(x - midX) * scale, (z - midZ) * scale];

    // 场地
    ctx.fillStyle = 'rgba(150,170,150,.25)';
    ctx.strokeStyle = 'rgba(180,220,180,.5)';
    ctx.lineWidth = 1.5;
    const [x0, y0] = px(b.minX, b.minZ), [x1, y1] = px(b.maxX, b.maxZ);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

    // 冰墙顶
    for (const p of this.radarPolys) {
      const t = Math.min(1, (p.y - b.floorY) / 120);
      ctx.fillStyle = `rgba(210,215,210,${0.35 + t * 0.4})`;
      ctx.beginPath();
      p.pts.forEach(([x, z], i) => {
        const [sx, sz] = px(x, z);
        i ? ctx.lineTo(sx, sz) : ctx.moveTo(sx, sz);
      });
      ctx.closePath(); ctx.fill();
    }

    // 单位
    for (const e of entities) {
      if (!e.alive) continue;
      const isP = e === player;
      const [sx, sz] = px(e.pos.x, e.pos.z);
      if (isP) {
        ctx.fillStyle = '#fff';
        ctx.save(); ctx.translate(sx, sz); ctx.rotate(-player.yaw);
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.6, 4); ctx.lineTo(0, 2.2); ctx.lineTo(-3.6, 4);
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else {
        const seen = e.team === player.team ? true : !!e._spotted;
        if (!seen) continue;
        ctx.fillStyle = e.team === 'CT' ? '#7db9ff' : '#ffb066';
        ctx.beginPath(); ctx.arc(sx, sz, 2.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---------- 常规刷新 ----------
  update(state) {
    const e = this.el;
    e.hp.textContent = Math.max(0, Math.ceil(state.hp));
    e.ap.textContent = Math.ceil(state.armor);
    e.hpbox.classList.toggle('low', state.hp <= 25);
    e.money.textContent = '$' + state.money;
    e.timer.textContent = state.timeText;
    e.ctScore.textContent = state.ctScore;
    e.tScore.textContent = state.tScore;
    if (state.weapon) {
      e.wpnname.textContent = state.weapon.name.toUpperCase();
      e.clip.textContent = state.weapon.melee ? '-' : state.weapon.clip;
      e.reserve.textContent = state.weapon.melee ? '-' : state.weapon.reserve;
      e.ammobox.classList.toggle('reload', !!state.reloading);
    }
    // 准星扩散
    const gap = 5 + Math.round((state.spread || 0) * 620);
    e.crosshair.style.setProperty('--gap', gap + 'px');
  }

  show(v) { this.el.hud.classList.toggle('hidden', !v); }

  killFeed(killer, kTeam, victim, vTeam, weapon, hs) {
    const div = document.createElement('div');
    div.className = 'kf';
    div.innerHTML = `<span class="${kTeam.toLowerCase()}">${esc(killer)}</span>` +
      `<span class="w">${esc(weapon)}${hs ? ' <span class="hs">☠</span>' : ''}</span>` +
      `<span class="${vTeam.toLowerCase()}">${esc(victim)}</span>`;
    this.el.killfeed.appendChild(div);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.firstChild.remove();
    setTimeout(() => { div.style.transition = 'opacity .5s'; div.style.opacity = '0'; setTimeout(() => div.remove(), 500); }, 6000);
  }

  hitmark(head) {
    const h = this.el.hitmark;
    h.classList.remove('show', 'hs');
    void h.offsetWidth;
    if (head) h.classList.add('hs');
    h.classList.add('show');
  }

  centerMsg(text, cls = '') {
    const c = this.el.centermsg;
    c.textContent = text;
    c.className = cls;
    void c.offsetWidth;
    c.classList.add('show');
  }

  vignette(on) { this.el.vignette.classList.toggle('on', on); }

  damageFrom(fromPos, player) {
    const dx = fromPos.x - player.pos.x, dz = fromPos.z - player.pos.z;
    const ang = Math.atan2(dx, -dz) + player.yaw;   // 屏幕系：0=正前
    let arc = this.el.dmgdir.querySelector('.arc');
    if (!arc) {
      arc = document.createElement('div');
      arc.className = 'arc';
      this.el.dmgdir.appendChild(arc);
    }
    arc.style.transform = `rotate(${ang}rad)`;
    arc.style.opacity = '1';
    clearTimeout(this._dmgT);
    this._dmgT = setTimeout(() => { arc.style.transition = 'opacity .7s'; arc.style.opacity = '0'; }, 220);
  }

  scope(level) {
    const on = level !== 0;
    for (const el of [this.el.scopes, this.el.scopelines]) {
      el.classList.toggle('hidden', !on);
      el.classList.toggle('lv2', level === 2);
    }
  }

  // ---------- 计分板 ----------
  scoreboard(show, entities, player, score) {
    this.el.scoreboard.classList.toggle('hidden', !show);
    if (!show) return;
    this.el.sbCTn.textContent = score.ct;
    this.el.sbTn.textContent = score.t;
    const build = (team, host) => {
      const list = entities.filter(e => e.team === team)
        .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      host.innerHTML = '<div class="sb-row head"><span>玩家</span><span>杀</span><span>死</span><span>爆头</span></div>' +
        list.map(e => `<div class="sb-row${e === player ? ' me' : ''}${!e.alive ? ' dead' : ''}">
          <span>${esc(e.name)}</span><span>${e.kills}</span><span>${e.deaths}</span><span>${e.headshots}</span></div>`).join('');
    };
    build('CT', this.el.sbCT);
    build('T', this.el.sbT);
  }

  // ---------- 购买菜单 ----------
  buyMenu(show, ctx) {
    this.el.buymenu.classList.toggle('hidden', !show);
    if (!show) return;
    const { team, money, hasPrimary } = ctx;
    this.el.buyList.innerHTML = BUY_TABLE.filter(b => b.teams.includes(team)).map(b => {
      const def = WEAPONS[b.id];
      const price = b.price !== undefined ? b.price : (def ? def.price : 0);
      const off = money < price || (def && def.slot === 1 && hasPrimary);
      return `<div class="bm-item${off ? ' off' : ''}"><span class="k">${b.key}</span><span>${b.label}</span><span class="p">$${price}</span></div>`;
    }).join('');
  }

  death(show, killerName, wait) {
    this.el.deathscreen.classList.toggle('hidden', !show);
    if (show) {
      this.el.dsBy.textContent = killerName ? `被 ${killerName} 击杀` : '';
      this.el.dsWait.textContent = `${Math.ceil(wait)} 秒后重生`;
    }
  }

  end(show, stats, title) {
    this.el.endscreen.classList.toggle('hidden', !show);
    if (show) {
      this.el.endTitle.textContent = title;
      this.el.endKills.textContent = stats.kills;
      this.el.endDeaths.textContent = stats.deaths;
      this.el.endAcc.textContent = (stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0) + '%';
      this.el.endHs.textContent = stats.headshots;
    }
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
