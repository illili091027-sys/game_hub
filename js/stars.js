/* 🌌 별을 남기는 밤
   들어오면 밤하늘이 펼쳐져요. 한 줄 소원을 적으면 별 하나가 하늘에 떠오르고, 다른 사람들의 소원 별도 볼 수 있어요.
   - 소원은 익명이에요. { id, t 글, x, y (0~1), c 색, owner, at }
   - 서버에 연결돼 있으면 모두가 같은 하늘(방 '_stars_', 키 'sky')을 봐요. 없으면 이 기기에만 저장돼요.
   - 별을 누르면 소원이 보여요. 가끔 다른 사람의 소원이 저절로 반짝 떠올라요.
   - 내 별들은 선으로 이어져서 '나만의 별자리'가 돼요. */

var SK = null, SK_RAF = null, SK_SYNC = null;
var SK_W = 1200, SK_H = 680, SK_LOCAL = 'gamehub_stars', SK_MAX = 400;
var SK_COLORS = [{ c: '#fff3b0', n: '노랑' }, { c: '#b3e5fc', n: '하늘' }, { c: '#f8bbd0', n: '분홍' }, { c: '#d1c4e9', n: '보라' }, { c: '#ffffff', n: '하양' }];
/* 아주 간단한 거친 말 가리기 */
var SK_BAD = ['시발', '씨발', 'ㅅㅂ', '병신', 'ㅂㅅ', '개새', '좆', '존나', 'ㅈㄴ', '미친놈', '꺼져', '닥쳐', '죽어', 'fuck', 'shit'];
function skClean(t) { t = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 40); SK_BAD.forEach(function (b) { t = t.split(b).join('♡'.repeat(Math.min(3, b.length))); }); return t; }

function skLocal() { try { var d = JSON.parse(localStorage.getItem(SK_LOCAL) || '{}') || {}; d.wishes = d.wishes || []; d.hidden = d.hidden || {}; if (!d.owner) d.owner = 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); return d; } catch (e) { return { wishes: [], hidden: {}, owner: 'o' + Date.now().toString(36) }; } }
function skLocalSave(d) { try { localStorage.setItem(SK_LOCAL, JSON.stringify(d)); } catch (e) {} }
function skServer() { return (typeof cloudServerUrl !== 'undefined' && cloudServerUrl) || (typeof loadSavedServerUrl === 'function' ? normalizeServerUrl(loadSavedServerUrl()) : ''); }
function skUrl() { return skServer() + '/api/state?room=_stars_&game=sky'; }
function skFetch() {
  if (!skServer()) return Promise.resolve(null);
  return fetch(skUrl(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { return j ? ((j.data && j.data.wishes) || []) : null; }).catch(function () { return null; });
}
function skPut(list) { return fetch(skUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wishes: list.slice(-SK_MAX), t: Date.now() }) }); }

function startStarsNight() {
  stopStarsNight();
  /* 세로 화면(폰)에서는 세로로 긴 밤하늘 */
  var portrait = window.innerWidth < 700;
  SK_W = portrait ? 600 : 1200;
  SK_H = portrait ? Math.round(600 * Math.max(1.1, Math.min(1.9, (window.innerHeight - 90) / window.innerWidth))) : 680;
  var L = skLocal(); skLocalSave(L);
  var bgImg = new Image(); bgImg.src = portrait ? 'img/bg/night-moon.jpg' : 'img/bg/night-grass.jpg';
  SK = { bgImg: bgImg, portrait: portrait, owner: L.owner, wishes: [], color: SK_COLORS[0].c, t: 0, open: null, auto: null, autoT: 4, shoots: [], rises: [], online: null, hover: -1 };
  /* 배경 별 (반짝이는 작은 별들) + 은하수 */
  SK.bg = []; for (var i = 0; i < 380; i++) SK.bg.push({ x: Math.random() * SK_W, y: Math.random() * SK_H * 0.86, r: Math.random() < 0.9 ? 0.6 + Math.random() * 0.8 : 1.4 + Math.random(), ph: Math.random() * 6, sp: 0.5 + Math.random() * 2 });
  SK.milky = []; for (i = 0; i < 900; i++) { var u = Math.random(), off = (Math.random() + Math.random() + Math.random() - 1.5) * 90; SK.milky.push({ x: u * SK_W, y: 80 + u * SK_H * 0.38 + off, r: Math.random() * 1.1, a: 0.08 + Math.random() * 0.25 }); }
  SK.town = []; var x = 0; while (x < SK_W) { var w = 30 + Math.random() * 60, h = 20 + Math.random() * 70; SK.town.push({ x: x, w: w, h: h, win: Math.random() }); x += w + Math.random() * 10; }
  document.getElementById('sk-root').innerHTML =
    '<div class="sk-box"><canvas id="sk-cv" class="sk-cv"></canvas>' +
      '<div class="sk-top"><span id="sk-count"></span><span id="sk-net"></span></div>' +
      '<div class="sk-card" id="sk-card" style="display:none"></div>' +
      '<div class="sk-input">' +
        '<div class="sk-cols">' + SK_COLORS.map(function (c) { return '<button class="sk-col" data-c="' + c.c + '" title="' + c.n + '" style="--c:' + c.c + '" onclick="skPick(\'' + c.c + '\')"></button>'; }).join('') + '</div>' +
        '<input id="sk-text" maxlength="40" placeholder="한 줄 소원을 적어요 (익명 · 40자)" autocomplete="off">' +
        '<button class="sk-go" onclick="skSubmit()">⭐ 별 띄우기</button>' +
      '</div>' +
      '<div class="sk-tools"><button onclick="skRandom()">🌠 소원 하나 읽기</button><button onclick="skMine()">✨ 내 별자리</button></div>' +
    '</div>';
  var box = document.querySelector('#sk-root .sk-box');
  box.style.maxWidth = 'calc((100dvh - 70px) * ' + SK_W + ' / ' + SK_H + ')';
  document.getElementById('sk-cv').style.aspectRatio = SK_W + ' / ' + SK_H;
  var cv = document.getElementById('sk-cv'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = SK_W * dpr; cv.height = SK_H * dpr; SK.dpr = dpr; SK.ctx = cv.getContext('2d');
  cv.addEventListener('pointerdown', function (e) { var p = skPt(cv, e), i = skHit(p); if (i >= 0) skOpen(i, false); else skClose(); });
  cv.addEventListener('pointermove', function (e) { var p = skPt(cv, e); SK.hover = skHit(p); cv.style.cursor = SK.hover >= 0 ? 'pointer' : 'default'; });
  var inp = document.getElementById('sk-text');
  inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); skSubmit(); } });
  skPick(SK.color);
  skSync();
  SK_SYNC = setInterval(skSync, 8000);
  var last = 0;
  (function loop(now) {
    SK_RAF = requestAnimationFrame(loop);
    if (!SK) return;
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; SK.t += dt;
    skStep(dt); skDraw();
  })(0);
}
function stopStarsNight() { if (SK_RAF) cancelAnimationFrame(SK_RAF); SK_RAF = null; clearInterval(SK_SYNC); SK_SYNC = null; SK = null; }
function skPt(cv, e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * SK_W / r.width, y: (e.clientY - r.top) * SK_H / r.height }; }
function skHit(p) { var best = -1, bd = 22; SK.wishes.forEach(function (w, i) { var d = Math.hypot(w.x * SK_W - p.x, w.y * SK_H - p.y); if (d < bd) { bd = d; best = i; } }); return best; }
function skPick(c) { SK.color = c; document.querySelectorAll('.sk-col').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-c') === c); }); }

function skSync() {
  skFetch().then(function (server) {
    if (!SK) return;
    SK.online = server !== null;
    var L = skLocal(), seen = {}, out = [];
    (server || []).concat(L.wishes).forEach(function (w) { if (w && w.id && !seen[w.id] && !L.hidden[w.id]) { seen[w.id] = 1; out.push(w); } });
    var openId = SK.open && SK.open.w.id;
    SK.wishes = out.map(function (w) { w.mine = w.owner === SK.owner; return w; });
    if (openId) { var j = SK.wishes.findIndex(function (w) { return w.id === openId; }); if (j < 0) skClose(); else SK.open.i = j; }
    document.getElementById('sk-count').textContent = '🌌 오늘 밤 하늘에 소원 ' + out.length + '개';
    document.getElementById('sk-net').textContent = SK.online ? '' : ' · 📴 서버에 연결되지 않아 이 기기에만 보여요';
  });
}
/* 빈 하늘 자리 고르기: 다른 별과 가장 먼 곳 */
function skPlace() {
  var best = null, bd = -1;
  for (var k = 0; k < 40; k++) {
    var x = 0.05 + Math.random() * 0.9, y = 0.07 + Math.random() * (SK.portrait ? 0.48 : 0.5), d = 9;
    SK.wishes.forEach(function (w) { d = Math.min(d, Math.hypot((w.x - x) * 1.76, w.y - y)); });
    if (d > bd) { bd = d; best = { x: x, y: y }; }
  }
  return best;
}
function skSubmit() {
  var inp = document.getElementById('sk-text'), t = skClean(inp.value);
  if (t.length < 2) { inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); inp.placeholder = '소원을 한 줄 적어 주세요 ✨'; return; }
  var pos = skPlace(), w = { id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: t, x: +pos.x.toFixed(4), y: +pos.y.toFixed(4), c: SK.color, owner: SK.owner, at: Date.now() };
  inp.value = '';
  var L = skLocal(); L.wishes.push(w); L.wishes = L.wishes.slice(-50); skLocalSave(L);
  if (typeof czChalk === 'function') czChalk('star-wish', 1, '소원 별 반짝', 3);
  /* 빛이 아래에서 올라가 별이 돼요 */
  SK.rises.push({ w: w, x0: SK_W / 2, y0: SK_H - 40, k: 0 });
  if (skServer()) {
    var push = function (tries) {
      return skFetch().then(function (list) {
        if (list === null) return;
        if (!list.some(function (x) { return x.id === w.id; })) list.push(w);
        return skPut(list).then(skFetch).then(function (l2) { if (l2 && !l2.some(function (x) { return x.id === w.id; }) && tries > 0) return push(tries - 1); });
      }).catch(function () {});
    };
    push(2);
  }
}
function skOpen(i, auto) {
  var w = SK.wishes[i]; if (!w) return;
  SK.open = { i: i, w: w, auto: auto, t: 0 };
  var c = document.getElementById('sk-card');
  c.innerHTML = '<div class="sk-wish">“' + esc(w.t) + '”</div><div class="sk-meta">' + (w.mine ? '✨ 내가 띄운 별' : '누군가의 별') + ' · ' + new Date(w.at).toLocaleDateString() + '</div>' +
    (auto ? '' : '<div class="sk-act">' + (w.mine ? '<button onclick="skRemove(\'' + w.id + '\')">내 별 지우기</button>' : '<button onclick="skHide(\'' + w.id + '\')">이 별 가리기</button>') +
      (typeof ADMIN_MODE !== 'undefined' && ADMIN_MODE && !w.mine ? '<button class="sk-admin" onclick="skAdminRemove(\'' + w.id + '\')">🛠 관리자: 지우기</button>' : '') + '</div>');
  var left = w.x * 100, top = w.y * 100;
  var m = SK_W < 900 ? 36 : 16; c.style.left = Math.max(m, Math.min(100 - m, left)) + '%'; c.style.top = top + '%';
  c.classList.toggle('below', w.y < 0.3); c.classList.toggle('auto', !!auto);
  c.style.display = 'block'; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
}
function skClose() { SK.open = null; var c = document.getElementById('sk-card'); if (c) c.style.display = 'none'; }
function skRandom() {
  var others = SK.wishes.map(function (w, i) { return i; }).filter(function (i) { return !SK.wishes[i].mine; });
  var pool = others.length ? others : SK.wishes.map(function (w, i) { return i; });
  if (!pool.length) return;
  skOpen(pool[Math.floor(Math.random() * pool.length)], false);
}
function skMine() {
  var mine = SK.wishes.map(function (w, i) { return i; }).filter(function (i) { return SK.wishes[i].mine; });
  if (!mine.length) { document.getElementById('sk-text').focus(); return; }
  SK.mineGlow = 3;
  var cur = SK.open ? mine.indexOf(SK.open.i) : -1;
  skOpen(mine[(cur + 1) % mine.length], false);
}
/* 🛠 관리자: 누구의 별이든 하늘에서 지워요 */
function skAdminRemove(id) {
  if (!(typeof ADMIN_MODE !== 'undefined' && ADMIN_MODE)) return;
  if (!confirm('관리자: 이 별을 모두의 하늘에서 지울까요?')) return;
  skClose(); SK.wishes = SK.wishes.filter(function (w) { return w.id !== id; });
  if (!skServer()) return;
  skFetch().then(function (list) { if (list) return skPut(list.filter(function (w) { return w.id !== id; })); }).then(skSync);
}
function skHide(id) { var L = skLocal(); L.hidden[id] = 1; skLocalSave(L); skClose(); skSync(); }
function skRemove(id) {
  if (!confirm('이 별을 하늘에서 지울까요?')) return;
  var L = skLocal(); L.wishes = L.wishes.filter(function (w) { return w.id !== id; }); skLocalSave(L); skClose();
  if (!skServer()) { skSync(); return; }
  skFetch().then(function (list) { if (list) return skPut(list.filter(function (w) { return !(w.id === id && w.owner === SK.owner); })); }).then(skSync);
}

function skStep(dt) {
  /* 별똥별 */
  if (Math.random() < dt * 0.12) SK.shoots.push({ x: Math.random() * SK_W * 0.8 + SK_W * 0.2, y: Math.random() * SK_H * 0.3, vx: -(500 + Math.random() * 300), vy: 200 + Math.random() * 150, life: 1 });
  SK.shoots.forEach(function (s) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 1.1; });
  SK.shoots = SK.shoots.filter(function (s) { return s.life > 0; });
  /* 올라가는 빛 → 별 탄생 */
  SK.rises.forEach(function (r) {
    r.k += dt / 1.6;
    if (r.k >= 1 && !r.done) {
      r.done = true; r.w.mine = true; r.w.born = SK.t;
      if (!SK.wishes.some(function (w) { return w.id === r.w.id; })) SK.wishes.push(r.w);
      document.getElementById('sk-count').textContent = '🌌 오늘 밤 하늘에 소원 ' + SK.wishes.length + '개';
      skOpen(SK.wishes.indexOf(r.w), false);
    }
  });
  SK.rises = SK.rises.filter(function (r) { return !r.done; });
  /* 가끔 다른 사람 소원이 저절로 떠올라요 */
  if (SK.open && SK.open.auto) { SK.open.t += dt; if (SK.open.t > 5) skClose(); }
  if (!SK.open && !SK.rises.length) {
    SK.autoT -= dt;
    if (SK.autoT <= 0 && SK.wishes.length) { SK.autoT = 7 + Math.random() * 4; var i = Math.floor(Math.random() * SK.wishes.length); skOpen(i, true); }
  }
  if (SK.mineGlow > 0) SK.mineGlow -= dt;
}
function skStar(x, ctx, cx, cy, r, col, glow) {
  var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 5 * glow);
  g.addColorStop(0, col); g.addColorStop(0.25, col.length === 7 ? col + '66' : col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 5 * glow, 0, 6.2832); ctx.fill();
  /* 반짝이 (십자 빛) */
  ctx.strokeStyle = col; ctx.globalAlpha *= 0.85; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(cx - r * 3.2 * glow, cy); ctx.lineTo(cx + r * 3.2 * glow, cy); ctx.moveTo(cx, cy - r * 3.2 * glow); ctx.lineTo(cx, cy + r * 3.2 * glow); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();
}
function skDraw() {
  var c = SK.ctx, t = SK.t, i; c.setTransform(SK.dpr, 0, 0, SK.dpr, 0, 0); c.globalAlpha = 1;
  var g = c.createLinearGradient(0, 0, 0, SK_H); g.addColorStop(0, '#050816'); g.addColorStop(0.55, '#14163a'); g.addColorStop(0.85, '#3a2a5c'); g.addColorStop(1, '#6b3f6e');
  c.fillStyle = g; c.fillRect(0, 0, SK_W, SK_H);
  /* 보내 준 밤하늘 풀밭 사진을 화면에 꽉 차게 */
  var im = SK.bgImg;
  if (im && im.complete && im.naturalWidth) { var k = Math.max(SK_W / im.naturalWidth, SK_H / im.naturalHeight), iw = im.naturalWidth * k, ih = im.naturalHeight * k; c.drawImage(im, (SK_W - iw) / 2, SK_H - ih, iw, ih); }
  SK.bg.forEach(function (s) { c.globalAlpha = 0.15 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)); c.fillStyle = '#fff'; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 6.2832); c.fill(); });
  c.globalAlpha = 1;
  /* 달 */
  if (!SK.portrait) {   /* 초승달: 은은한 빛 + 두 원이 겹치는 모양만 칠해요 */
    var mx = SK_W - 140, my = 110, R = 38, ox = 16, oy = -12, r2 = 34;
    var mg = c.createRadialGradient(mx, my, R * 0.6, mx, my, R * 2.4); mg.addColorStop(0, 'rgba(255,246,214,.28)'); mg.addColorStop(1, 'rgba(255,246,214,0)');
    c.fillStyle = mg; c.beginPath(); c.arc(mx, my, R * 2.4, 0, 6.2832); c.fill();
    var d = Math.hypot(ox, oy), a = (R * R - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, R * R - a * a)), bx = ox / d, by = oy / d;
    var p1 = { x: a * bx - h * by, y: a * by + h * bx }, p2 = { x: a * bx + h * by, y: a * by - h * bx };
    c.fillStyle = '#fff6d6'; c.beginPath();
    c.arc(mx, my, R, Math.atan2(p1.y, p1.x), Math.atan2(p2.y, p2.x), false);
    c.arc(mx + ox, my + oy, r2, Math.atan2(p2.y - oy, p2.x - ox), Math.atan2(p1.y - oy, p1.x - ox), true);
    c.fill();
  }

  /* 별똥별 */
  SK.shoots.forEach(function (s) { var lg = c.createLinearGradient(s.x, s.y, s.x - s.vx * 0.18, s.y - s.vy * 0.18); lg.addColorStop(0, 'rgba(255,255,255,' + s.life + ')'); lg.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = lg; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * 0.18, s.y - s.vy * 0.18); c.stroke(); });
  /* 나만의 별자리: 내 별들을 순서대로 이어요 */
  var mine = SK.wishes.filter(function (w) { return w.mine; }).sort(function (a, b) { return a.at - b.at; });
  if (mine.length > 1) {
    c.strokeStyle = 'rgba(255,236,150,' + (SK.mineGlow > 0 ? 0.75 : 0.3) + ')'; c.lineWidth = 1.3; c.setLineDash([4, 6]);
    c.beginPath(); mine.forEach(function (w, k) { var x = w.x * SK_W, y = w.y * SK_H; if (k) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke(); c.setLineDash([]);
  }
  /* 소원 별 */
  SK.wishes.forEach(function (w, idx) {
    var x = w.x * SK_W, y = w.y * SK_H, h = (w.id.charCodeAt(2) || 7) * 0.37;
    var tw = 0.75 + 0.25 * Math.sin(t * (1.2 + (h % 1.3)) + h), born = w.born ? Math.min(1, (t - w.born) / 0.8) : 1;
    var sel = (SK.open && SK.open.i === idx) || SK.hover === idx;
    c.globalAlpha = tw;
    skStar(null, c, x, y, (sel ? 2.8 : 2) * (born < 1 ? 1 + (1 - born) * 3 : 1), w.c || '#fff3b0', sel ? 1.6 : 1);
    c.globalAlpha = 1;
    if (w.mine) { c.strokeStyle = 'rgba(255,236,150,.55)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 11 + Math.sin(t * 2) * 1.5, 0, 6.2832); c.stroke(); }
  });
  /* 올라가는 소원 빛 */
  SK.rises.forEach(function (r) {
    var e = 1 - Math.pow(1 - r.k, 3), x = r.x0 + (r.w.x * SK_W - r.x0) * e, y = r.y0 + (r.w.y * SK_H - r.y0) * e - Math.sin(r.k * Math.PI) * 80;
    for (var k = 0; k < 10; k++) { var kk = Math.max(0, r.k - k * 0.02), ee = 1 - Math.pow(1 - kk, 3); c.globalAlpha = (1 - k / 10) * 0.6; c.fillStyle = r.w.c; c.beginPath(); c.arc(r.x0 + (r.w.x * SK_W - r.x0) * ee, r.y0 + (r.w.y * SK_H - r.y0) * ee - Math.sin(kk * Math.PI) * 80, 4 - k * 0.3, 0, 6.2832); c.fill(); }
    c.globalAlpha = 1; skStar(null, c, x, y, 3, r.w.c, 1.4);
  });

}
