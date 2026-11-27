/* 🌿 힐링 놀이 모음 (cozy)
   ① 🐈 고양이 낮잠 협회  catnap  : 자는 고양이들에게 이름을 지어 주고 이불·베개를 놓아 줘요. (모두 같이 보는 방)
   ③ 🐹 햄스터 출근시키기 hamster : 하루 한 번 출근 도장 → 일하고 퇴근하면 작은 월급
   ④ 🦆 오리 산책시키기  duckwalk : 누른 곳으로 오리가 뒤뚱뒤뚱. 연못 · 빗물 웅덩이 · 빵 부스러기
   한 번에 하나만 켜져요 (CZ). 그림은 전부 캔버스로 직접 그려요. */

var CZ = null;
function stopCozy() { if (!CZ) return; if (CZ.raf) cancelAnimationFrame(CZ.raf); (CZ.timers || []).forEach(clearInterval); CZ = null; }
function czLS(k, d) { try { return JSON.parse(localStorage.getItem('gamehub_' + k) || 'null') || d; } catch (e) { return d; } }
function czLSset(k, v) { try { localStorage.setItem('gamehub_' + k, JSON.stringify(v)); } catch (e) {} }
function czToday() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
/* 캔버스 + 위에 얹는 HTML 만들기 */
function czSetup(rootId, game, W, H, overlay) {
  stopCozy();
  CZ = { game: game, W: W, H: H, t: 0, timers: [] };
  var root = document.getElementById(rootId);
  root.innerHTML = '<div class="cz-box" style="max-width:calc((100dvh - 78px) * ' + W + ' / ' + H + ')"><canvas class="cz-cv" style="aspect-ratio:' + W + '/' + H + '"></canvas>' + (overlay || '') + '</div>';
  var cv = root.querySelector('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; CZ.cv = cv; CZ.ctx = cv.getContext('2d'); CZ.dpr = dpr; CZ.root = root;
  return CZ;
}
function czLoop(step, draw) {
  var last = 0, me = CZ;
  (function loop(now) {
    if (CZ !== me) return;
    me.raf = requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; me.t += dt;
    step(dt); me.ctx.setTransform(me.dpr, 0, 0, me.dpr, 0, 0); draw(me.ctx, me.t);
  })(0);
}
function czPt(e) { var r = CZ.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * CZ.W / r.width, y: (e.clientY - r.top) * CZ.H / r.height }; }
function czRR(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function czText(c, t, x, y, size, col, stroke) { c.font = 'bold ' + size + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; if (stroke) { c.lineWidth = 4; c.strokeStyle = stroke; c.strokeText(t, x, y); } c.fillStyle = col; c.fillText(t, x, y); }
/* 보내 준 그림 불러오기 (한 번만) */
var CZ_IMG = {};
function czImg(name) { if (!CZ_IMG[name]) { var im = new Image(); im.src = 'img/pets/' + name + '.png'; CZ_IMG[name] = im; } return CZ_IMG[name]; }
function czOk(im) { return im && im.complete && im.naturalWidth > 0; }
/* 그림을 발끝(아래 가운데) 기준으로 그려요. h = 화면 높이, flip = 좌우 뒤집기 */
function czSprite(c, name, x, y, h, flip, sy) {
  var im = czImg(name); if (!czOk(im)) return { w: h, h: h };
  var w = h * im.naturalWidth / im.naturalHeight;
  c.save(); c.translate(x, y); if (flip) c.scale(-1, 1); c.scale(1, sy || 1); c.drawImage(im, -w / 2, -h, w, h); c.restore();
  return { w: w, h: h };
}
/* 🖍️ 힐링 놀이 분필: 소소하게, 종류마다 하루 max번까지 (soloCoin은 3배로 줘요 → 1 = 분필 3개) */
function czChalk(kind, amount, reason, max) {
  if (typeof soloCoin !== 'function') return;
  var day = czToday(), log = czLS('heal_chalk', {});
  if (log.d !== day) log = { d: day };
  var n = log[kind] || 0; if (n >= (max || 3)) return;
  log[kind] = n + 1; czLSset('heal_chalk', log);
  soloCoin(amount, reason);
}
function czServer() { return (typeof cloudServerUrl !== 'undefined' && cloudServerUrl) || (typeof loadSavedServerUrl === 'function' ? normalizeServerUrl(loadSavedServerUrl()) : ''); }

/* =====================================================================
   ① 🐈 고양이 낮잠 협회
   ===================================================================== */
var CN_CATS = [      /* 보내 준 고양이 그림 중 8마리 (img/pets/cat행-열.png) */
  { id: 'c1', x: 150, y: 500, img: 'cat3-4' },
  { id: 'c2', x: 345, y: 535, img: 'cat1-1' },
  { id: 'c3', x: 545, y: 505, img: 'cat2-1' },
  { id: 'c4', x: 745, y: 540, img: 'cat4-3' },
  { id: 'c5', x: 905, y: 500, img: 'cat5-2' },
  { id: 'c6', x: 300, y: 345, img: 'cat2-2' },
  { id: 'c7', x: 500, y: 345, img: 'cat1-3' },
  { id: 'c8', x: 700, y: 345, img: 'cat3-2' }
];
var CN_BLANKETS = [{ k: '', n: '없음' }, { k: 'pink', c: '#f8bbd0', c2: '#f48fb1', p: 'dot' }, { k: 'blue', c: '#bbdefb', c2: '#64b5f6', p: 'stripe' }, { k: 'mint', c: '#c8e6c9', c2: '#81c784', p: 'check' }, { k: 'lemon', c: '#fff9c4', c2: '#fbc02d', p: 'dot' }, { k: 'lilac', c: '#e1bee7', c2: '#ba68c8', p: 'stripe' }];
var CN_PILLOWS = [{ k: '', n: '없음' }, { k: 'white', c: '#ffffff' }, { k: 'peach', c: '#ffccbc' }, { k: 'sky', c: '#b3e5fc' }, { k: 'sun', c: '#ffe082' }];
function cnUrl() { return czServer() + '/api/state?room=_catnap_&game=cats'; }
function cnFetch() {
  if (!czServer()) return Promise.resolve(null);
  return fetch(cnUrl(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { return j ? ((j.data && j.data.cats) || {}) : null; }).catch(function () { return null; });
}
function startCatNap() {
  czSetup('cn-root', 'catnap', 1000, 600,
    '<div class="cz-hud"><span id="cn-info">🐈 고양이 낮잠 협회 · 고양이를 눌러 보세요</span></div>' +
    '<div class="cz-panel" id="cn-panel" style="display:none"></div>');
  CZ.data = czLS('catnap', {}); CZ.sel = null; CZ.hearts = []; CZ.zz = [];
  CZ.cv.addEventListener('pointerdown', function (e) {
    var p = czPt(e), hit = null;
    CN_CATS.forEach(function (c) { if (Math.abs(p.x - c.x) < 70 && p.y > c.y - 110 && p.y < c.y + 30) hit = c; });
    if (hit) cnOpen(hit.id); else cnClose();
  });
  cnSync();
  CZ.timers.push(setInterval(cnSync, 8000));
  czLoop(function (dt) {
    CZ.hearts.forEach(function (h) { h.y -= 40 * dt; h.a -= dt * 0.7; }); CZ.hearts = CZ.hearts.filter(function (h) { return h.a > 0; });
    CN_CATS.forEach(function (c, i) { if (Math.random() < dt * 0.35) CZ.zz.push({ x: c.x + 10, y: c.y - 110, a: 1, ph: Math.random() * 6, s: 14 + Math.random() * 6 }); });
    CZ.zz.forEach(function (z) { z.y -= 18 * dt; z.x += Math.sin(CZ.t * 2 + z.ph) * 0.4 - 6 * dt; z.a -= dt * 0.4; }); CZ.zz = CZ.zz.filter(function (z) { return z.a > 0; });
  }, cnDraw);
}
function cnSync() {
  cnFetch().then(function (srv) {
    if (!CZ || CZ.game !== 'catnap') return;
    if (srv) { CZ.data = srv; CZ.online = true; czLSset('catnap', srv); } else CZ.online = false;
    var pats = 0, named = 0; CN_CATS.forEach(function (c) { var d = CZ.data[c.id] || {}; pats += d.pats || 0; if (d.name) named++; });
    document.getElementById('cn-info').textContent = '🐈 고양이 낮잠 협회 · 이름 있는 고양이 ' + named + '/' + CN_CATS.length + ' · 쓰다듬은 횟수 ' + pats + (CZ.online ? ' · 모두 같이 돌봐요' : ' · 📴 이 기기에만 저장');
    if (CZ.sel) cnPanel();
  });
}
/* 고양이 하나 바꾸기: 최신 상태를 받아서 고친 뒤 저장 (같이 고쳐도 덮어쓰지 않게) */
function cnUpdate(id, fn) {
  var apply = function (all) { all = all || {}; var d = all[id] || {}; fn(d); d.at = Date.now(); all[id] = d; return all; };
  CZ.data = apply(CZ.data); czLSset('catnap', CZ.data); cnPanel();
  if (!czServer()) return;
  /* 차례대로 저장해요 (빨리 여러 번 눌러도 앞의 변경이 사라지지 않게) */
  CZ.q = (CZ.q || Promise.resolve()).then(function () {
    return cnFetch().then(function (srv) {
      if (srv === null) return;
      var all = apply(srv);
      return fetch(cnUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cats: all, t: Date.now() }) });
    });
  }).catch(function () {}).then(function () { if (CZ && CZ.game === 'catnap') cnSync(); });
}
function cnOpen(id) { CZ.sel = id; cnPanel(); }
function cnClose() { CZ.sel = null; document.getElementById('cn-panel').style.display = 'none'; }
function cnPanel() {
  var id = CZ.sel, d = CZ.data[id] || {}, el = document.getElementById('cn-panel'); if (!id) return;
  var keepFocus = document.activeElement && document.activeElement.id === 'cn-name';
  if (keepFocus) return;
  el.innerHTML = '<div class="cz-ptitle">' + (d.name ? '🐈 ' + esc(d.name) : '🐈 이름 없는 고양이') + '<button class="cz-x" onclick="cnClose()">✕</button></div>' +
    '<div class="cz-row"><input id="cn-name" maxlength="10" placeholder="이름 지어 주기" value="' + esc(d.name || '') + '"><button class="btn btn-primary" onclick="cnName()">이름 짓기</button></div>' +
    '<div class="cz-lab">🛏 이불 덮어 주기</div><div class="cz-opts">' + CN_BLANKETS.map(function (b) { return '<button class="cz-opt' + ((d.blanket || '') === b.k ? ' on' : '') + '" onclick="cnSet(\'blanket\',\'' + b.k + '\')">' + (b.k ? '<i style="background:' + b.c + ';border-color:' + b.c2 + '"></i>' : '없음') + '</button>'; }).join('') + '</div>' +
    '<div class="cz-lab">🛋 베개 놓아 주기</div><div class="cz-opts">' + CN_PILLOWS.map(function (b) { return '<button class="cz-opt' + ((d.pillow || '') === b.k ? ' on' : '') + '" onclick="cnSet(\'pillow\',\'' + b.k + '\')">' + (b.k ? '<i style="background:' + b.c + '"></i>' : '없음') + '</button>'; }).join('') + '</div>' +
    (typeof ADMIN_MODE !== 'undefined' && ADMIN_MODE ? '<div class="cz-row"><button class="btn btn-ghost cz-admin" onclick="cnAdminReset()">🛠 관리자: 이름 · 이불 · 베개 지우기</button></div>' : '') +
    '<div class="cz-row"><button class="btn btn-ghost" onclick="cnPat()">🤲 살살 쓰다듬기</button><span class="cz-small">쓰다듬은 횟수 ' + (d.pats || 0) + (d.by ? ' · 이름 지은 사람: ' + esc(d.by) : '') + '</span></div>';
  el.style.display = '';
  var inp = document.getElementById('cn-name'); inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) cnName(); };
}
function cnName() {
  var v = (document.getElementById('cn-name').value || '').trim().slice(0, 10); if (!v) return;
  if (typeof skClean === 'function') v = skClean(v).slice(0, 10);
  document.getElementById('cn-name').blur();
  var who = (typeof me !== 'undefined' && me.name && me.name !== '나') ? me.name : '익명';
  cnUpdate(CZ.sel, function (d) { d.name = v; d.by = who; });
  czChalk('cat-name', 1, '고양이 이름 지어 줬어요', 3);
}
function cnSet(k, v) { cnUpdate(CZ.sel, function (d) { d[k] = v; }); if (v) czChalk('cat-item', 1, k === 'blanket' ? '이불을 덮어 줬어요' : '베개를 놓아 줬어요', 3); }
/* 🛠 관리자: 이 고양이를 처음 상태로 (이름 · 이불 · 베개 · 쓰다듬기 기록) */
function cnAdminReset() {
  if (!(typeof ADMIN_MODE !== 'undefined' && ADMIN_MODE) || !CZ.sel) return;
  if (!confirm('관리자: 이 고양이의 이름 · 이불 · 베개를 모두 지울까요?')) return;
  cnUpdate(CZ.sel, function (d) { delete d.name; delete d.by; delete d.blanket; delete d.pillow; delete d.pats; });
}
function cnPat() {
  var c = CN_CATS.filter(function (x) { return x.id === CZ.sel; })[0];
  for (var i = 0; i < 4; i++) CZ.hearts.push({ x: c.x + (Math.random() - 0.5) * 60, y: c.y - 50, a: 1, s: 16 + Math.random() * 10 });
  cnUpdate(CZ.sel, function (d) { d.pats = (d.pats || 0) + 1; });
  CZ.patN = (CZ.patN || 0) + 1; if (CZ.patN % 5 === 0) czChalk('cat-pat', 1, '골골골… 쓰다듬기', 4);
}
/* 낙서 그림체 식빵 고양이 (굵은 외곽선 · 파스텔 단색 · 감은 눈) */
var CN_INK = '#2b2622';
function cnLoaf(c) {
  c.beginPath();
  c.moveTo(-58, 2);
  c.quadraticCurveTo(-62, -30, -48, -40);
  c.lineTo(-47, -60); c.lineTo(-30, -46);
  c.quadraticCurveTo(-18, -50, -6, -46);
  c.lineTo(5, -60); c.lineTo(10, -38);
  c.bezierCurveTo(32, -38, 58, -30, 60, 2);
  c.bezierCurveTo(62, 26, 40, 30, 0, 30);
  c.bezierCurveTo(-40, 30, -58, 28, -58, 2);
  c.closePath();
}
function cnDrawCat(c, cat, d, t) {
  var br = 1 + Math.sin(t * 1.6 + cat.x) * 0.03, x = cat.x, y = cat.y, H = 104;
  var P = CN_PILLOWS.filter(function (p) { return p.k === (d.pillow || ''); })[0], B = CN_BLANKETS.filter(function (b) { return b.k === (d.blanket || ''); })[0];
  var im = czImg(cat.img), W = czOk(im) ? H * im.naturalWidth / im.naturalHeight : H * 1.3;
  c.fillStyle = 'rgba(80,50,20,.14)'; c.beginPath(); c.ellipse(x, y - 2, W * 0.5, 9, 0, 0, 6.2832); c.fill();
  /* 베개 (머리 밑) */
  if (P && P.k) { c.fillStyle = P.c; czRR(c, x - W * 0.62, y - H * 0.3, W * 0.56, H * 0.34, 14); c.fill(); c.strokeStyle = CN_INK; c.lineWidth = 3; c.stroke(); }
  czSprite(c, cat.img, x, y, H, false, br);                       /* 숨 쉬면 들썩 */
  /* 이불 (몸 뒤쪽을 덮어요) */
  if (B && B.k) {
    var bx = x - W * 0.04, by = y - H * 0.62 * br, bw = W * 0.56, bh = H * 0.62 * br + 4;
    var blanket = function () { c.beginPath(); c.moveTo(bx, by + 10); c.quadraticCurveTo(bx + bw * 0.5, by - 8, bx + bw, by + 14); c.lineTo(bx + bw + 4, by + bh); c.lineTo(bx - 6, by + bh); c.quadraticCurveTo(bx - 12, by + bh * 0.5, bx, by + 10); c.closePath(); };
    blanket(); c.fillStyle = B.c; c.fill();
    c.save(); blanket(); c.clip(); c.fillStyle = B.c2; c.strokeStyle = B.c2; c.lineWidth = 5;
    if (B.p === 'dot') for (var dx = bx; dx < bx + bw + 10; dx += 14) for (var dy = by - 10; dy < by + bh; dy += 14) { c.beginPath(); c.arc(dx + ((dy - by) % 28 < 14 ? 7 : 0), dy, 2.6, 0, 6.2832); c.fill(); }
    if (B.p === 'stripe') for (dx = bx - 40; dx < bx + bw + 20; dx += 14) { c.beginPath(); c.moveTo(dx, by - 10); c.lineTo(dx + 24, by + bh); c.stroke(); }
    if (B.p === 'check') { c.globalAlpha = 0.55; for (dx = bx; dx < bx + bw; dx += 16) c.fillRect(dx, by - 10, 7, bh + 20); for (dy = by; dy < by + bh; dy += 16) c.fillRect(bx - 10, dy, bw + 20, 7); c.globalAlpha = 1; }
    c.restore(); blanket(); c.strokeStyle = CN_INK; c.lineWidth = 3.2; c.stroke();
  }
  /* 이름표 */
  var nm = d.name || '', sel = CZ.sel === cat.id;
  c.font = 'bold 14px sans-serif'; var w = Math.max(70, c.measureText(nm || '이름 지어 주세요').width + 22);
  c.fillStyle = sel ? '#ff8a65' : nm ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.6)'; czRR(c, x - w / 2, y + 6, w, 24, 12); c.fill();
  c.strokeStyle = CN_INK; c.lineWidth = 2; c.stroke();
  czText(c, nm || '이름 지어 주세요', x, y + 18, nm ? 14 : 12, sel ? '#fff' : nm ? '#4e342e' : '#8d6e63');
}

function cnDraw(c, t) {
  var W = CZ.W, H = CZ.H;
  c.fillStyle = '#f6e3c8'; c.fillRect(0, 0, W, 400);
  c.fillStyle = '#eed5b2'; for (var i = 0; i < W; i += 60) c.fillRect(i, 0, 30, 400);              /* 벽지 줄무늬 */
  /* 창문과 햇살 */
  c.fillStyle = '#bfe6ff'; czRR(c, 400, 50, 220, 160, 10); c.fill();
  c.fillStyle = '#fff59d'; c.beginPath(); c.arc(570, 95, 22, 0, 6.2832); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(450, 150, 16, 0, 6.2832); c.arc(472, 142, 20, 0, 6.2832); c.arc(495, 150, 15, 0, 6.2832); c.fill();
  c.strokeStyle = '#a1887f'; c.lineWidth = 10; czRR(c, 400, 50, 220, 160, 10); c.stroke(); c.beginPath(); c.moveTo(510, 50); c.lineTo(510, 210); c.moveTo(400, 130); c.lineTo(620, 130); c.stroke();
  c.fillStyle = 'rgba(255,236,170,' + (0.22 + Math.sin(t * 0.4) * 0.04) + ')'; c.beginPath(); c.moveTo(405, 210); c.lineTo(615, 210); c.lineTo(760, 600); c.lineTo(300, 600); c.fill();
  /* 선반 · 화분 · 시계 */
  c.fillStyle = '#8d6e63'; c.fillRect(110, 170, 180, 12); c.fillStyle = '#e57373'; czRR(c, 130, 140, 30, 30, 6); c.fill(); c.fillStyle = '#66bb6a'; c.beginPath(); c.arc(145, 128, 18, 0, 6.2832); c.fill();
  c.fillStyle = '#90caf9'; c.fillRect(200, 130, 16, 40); c.fillStyle = '#ffcc80'; c.fillRect(220, 135, 14, 35); c.fillStyle = '#ce93d8'; c.fillRect(238, 125, 18, 45);
  c.fillStyle = '#fff'; c.beginPath(); c.arc(820, 110, 34, 0, 6.2832); c.fill(); c.strokeStyle = '#8d6e63'; c.lineWidth = 5; c.stroke();
  c.lineWidth = 3; c.beginPath(); c.moveTo(820, 110); c.lineTo(820 + Math.cos(t * 0.05) * 22, 110 + Math.sin(t * 0.05) * 22); c.moveTo(820, 110); c.lineTo(820 + Math.cos(t * 0.6) * 28, 110 + Math.sin(t * 0.6) * 28); c.stroke();
  /* 소파(위쪽 두 고양이 자리) */
  c.fillStyle = '#c5a3d9'; czRR(c, 200, 250, 600, 110, 30); c.fill(); c.fillStyle = '#b58ccb'; czRR(c, 180, 300, 640, 80, 26); c.fill();
  c.fillStyle = '#a77bbd'; czRR(c, 160, 270, 50, 120, 20); c.fill(); czRR(c, 790, 270, 50, 120, 20); c.fill();
  /* 바닥 · 러그 */
  c.fillStyle = '#c8a27a'; c.fillRect(0, 400, W, 200);
  c.strokeStyle = 'rgba(120,80,40,.25)'; c.lineWidth = 2; for (i = 420; i < H; i += 36) { c.beginPath(); c.moveTo(0, i); c.lineTo(W, i); c.stroke(); }
  c.fillStyle = '#ef9a9a'; c.beginPath(); c.ellipse(500, 520, 420, 70, 0, 0, 6.2832); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 4; c.setLineDash([10, 8]); c.beginPath(); c.ellipse(500, 520, 395, 58, 0, 0, 6.2832); c.stroke(); c.setLineDash([]);
  CN_CATS.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (cat) { cnDrawCat(c, cat, CZ.data[cat.id] || {}, t); });
  CZ.zz.forEach(function (z) { c.globalAlpha = Math.max(0, z.a); czText(c, 'z', z.x, z.y, z.s, '#5c6bc0', '#fff'); }); c.globalAlpha = 1;
  CZ.hearts.forEach(function (h) { c.globalAlpha = Math.max(0, h.a); czText(c, '💗', h.x, h.y, h.s, '#e91e63'); }); c.globalAlpha = 1;
}

/* =====================================================================
   ③ 🐹 햄스터 출근시키기
   ===================================================================== */
var HM_WORK_SEC = 60;
function startHamster() {
  czSetup('hm-root', 'hamster', 1000, 560,
    '<div class="cz-hud"><span id="hm-info"></span></div>' +
    '<div class="cz-bar"><button id="hm-btn" onclick="hmAct()"></button></div>' +
    '<div class="hm-cal" id="hm-cal"></div>');
  var S = czLS('hamster', { days: {}, seeds: 0 }); CZ.S = S;
  var td = S.days[czToday()] || {};
  CZ.h = { x: 150, y: 430, st: td.out ? 'sleep' : td.in ? 'work' : 'home', walk: 0, stampT: 0 };
  if (CZ.h.st === 'work') CZ.h.x = 760;
  CZ.pops = [];
  hmUi(); hmCal();
  czLoop(hmStep, hmDraw);
}
function hmDay() { return CZ.S.days[czToday()] || (CZ.S.days[czToday()] = {}); }
function hmLeft() { var d = hmDay(); return d.in ? Math.max(0, HM_WORK_SEC - (Date.now() - d.in) / 1000) : HM_WORK_SEC; }
function hmUi() {
  var h = CZ.h, b = document.getElementById('hm-btn'), d = hmDay(), info = document.getElementById('hm-info');
  b.disabled = false;
  if (h.st === 'home') { b.textContent = '🏢 출근하기'; info.textContent = '🐹 햄찌가 출근 준비 중이에요 · 해바라기씨 월급 ' + CZ.S.seeds + '개'; }
  else if (h.st === 'go' || h.st === 'stamp' || h.st === 'back') { b.textContent = h.st === 'back' ? '🏠 퇴근하는 중…' : '🚶 출근하는 중…'; b.disabled = true; }
  else if (h.st === 'work') { var l = hmLeft(); b.textContent = l > 0 ? '⌨️ 일하는 중… ' + Math.ceil(l) + '초' : '🌇 퇴근하기'; b.disabled = l > 0; info.textContent = '🐹 오늘 출근 도장 쾅! · 출근 ' + new Date(d.in).toLocaleTimeString().slice(0, -3); }
  else { b.textContent = '😴 오늘 업무 끝! 내일 또 출근해요'; b.disabled = true; info.textContent = '🐹 퇴근 완료 · 해바라기씨 월급 ' + CZ.S.seeds + '개 · 이번 달 출근 ' + hmMonthCount() + '일'; }
}
function hmMonthCount() { var p = new Date(), k = p.getFullYear() + '-' + (p.getMonth() + 1) + '-', n = 0; Object.keys(CZ.S.days).forEach(function (d) { if (d.indexOf(k) === 0 && CZ.S.days[d].in) n++; }); return n; }
function hmCal() {
  var p = new Date(), y = p.getFullYear(), m = p.getMonth(), days = new Date(y, m + 1, 0).getDate(), first = new Date(y, m, 1).getDay(), out = '<div class="hm-cal-t">📅 ' + (m + 1) + '월 출근부</div><div class="hm-grid">';
  ['일', '월', '화', '수', '목', '금', '토'].forEach(function (d) { out += '<b>' + d + '</b>'; });
  for (var i = 0; i < first; i++) out += '<span></span>';
  for (i = 1; i <= days; i++) { var r = CZ.S.days[y + '-' + (m + 1) + '-' + i]; out += '<span class="' + (r && r.out ? 'ok' : r && r.in ? 'half' : '') + (i === p.getDate() ? ' today' : '') + '">' + (r && r.in ? '🐹' : i) + '</span>'; }
  document.getElementById('hm-cal').innerHTML = out + '</div>';
}
function hmAct() {
  var h = CZ.h, d = hmDay();
  if (h.st === 'home' && !d.in) { h.st = 'go'; }
  else if (h.st === 'work' && hmLeft() <= 0) { h.st = 'back'; d.out = Date.now(); CZ.S.seeds += 10; czLSset('hamster', CZ.S);
    CZ.pops.push({ t: '월급 🌻 +10', x: h.x, y: h.y - 90, a: 2 }); CZ.payT = 2.5;
    if (typeof soloCoin === 'function') soloCoin(5, '햄찌 월급', 'hamster-' + czToday());
    hmCal(); }
  hmUi();
}
function hmStep(dt) {
  var h = CZ.h;
  if (h.st === 'go') { h.x += 120 * dt; h.walk += dt; if (h.x >= 700) { h.x = 700; h.st = 'stamp'; h.stampT = 0; } }
  else if (h.st === 'stamp') { h.stampT += dt; if (h.stampT > 0.5 && !hmDay().in) { hmDay().in = Date.now(); czLSset('hamster', CZ.S); CZ.pops.push({ t: '쾅! 출근', x: 650, y: 200, a: 1.5 }); hmCal(); }
    if (h.stampT > 1.3) { h.x += 120 * dt; if (h.x >= 760) { h.x = 760; h.st = 'work'; } } }
  else if (h.st === 'back') { h.x -= 140 * dt; h.walk += dt; if (h.x <= 150) { h.x = 150; h.st = 'sleep'; } }
  CZ.pops.forEach(function (p) { p.y -= 25 * dt; p.a -= dt; }); CZ.pops = CZ.pops.filter(function (p) { return p.a > 0; });
  if (CZ.payT > 0) CZ.payT -= dt;
  if (Math.floor(CZ.t * 4) !== CZ.lastUi) { CZ.lastUi = Math.floor(CZ.t * 4); hmUi(); }
}
/* 낙서 그림체 찹쌀떡 햄스터 (가는 외곽선 · 크림색) */
/* 보내 준 햄찌 그림으로: 집에선 멍, 출근길엔 옆모습, 회사에선 안경 햄찌, 퇴근하면 쿨쿨 */
var HM_SPR = { home: 'ham2-2', go: 'ham3-1', back: 'ham3-1', stamp: 'ham1-3', work: 'ham1-3', sleep: 'ham2-2', pay: 'ham2-2' };
function hmHam(c, x, y, t, st, face) {
  var walking = st === 'go' || st === 'back', hop = walking ? Math.abs(Math.sin(t * 12)) * 10 : 0;
  var name = (CZ.payT > 0 && st === 'back') ? HM_SPR.pay : HM_SPR[st] || HM_SPR.home;
  var sy = st === 'sleep' ? 1 + Math.sin(t * 1.6) * 0.03 : st === 'work' ? 1 + Math.abs(Math.sin(t * 9)) * 0.03 : 1;
  c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.ellipse(x, y + 32, 44, 7, 0, 0, 6.2832); c.fill();
  var sz = czSprite(c, name, x, y + 34 - hop, st === 'sleep' ? 78 : 96, face < 0, sy);
  /* 출근 가방 */
  if (walking) { var bx = x + (face > 0 ? 34 : -60); c.fillStyle = '#a1785a'; czRR(c, bx, y + 6 - hop, 26, 20, 4); c.fill(); c.strokeStyle = '#333'; c.lineWidth = 2.2; c.stroke(); c.beginPath(); c.arc(bx + 13, y + 6 - hop, 5, Math.PI, 0); c.stroke(); }
}

function hmDraw(c, t) {
  var W = CZ.W, H = CZ.H, h = CZ.h, i;
  var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffe9c7'); g.addColorStop(1, '#ffd59a'); c.fillStyle = g; c.fillRect(0, 0, 420, H);
  g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#e3f2fd'); g.addColorStop(1, '#cfe3f3'); c.fillStyle = g; c.fillRect(420, 0, W - 420, H);
  c.fillStyle = '#bcaaa4'; c.fillRect(410, 0, 20, H);
  czText(c, '🏠 햄찌네 집', 210, 40, 22, '#8d6e63'); czText(c, '🏢 햄찌 주식회사', 710, 40, 22, '#546e7a');
  /* 집: 침대 · 쳇바퀴 · 해바라기씨 그릇 */
  c.fillStyle = '#c5e1a5'; c.fillRect(0, 470, 420, 90); c.fillStyle = '#d7ccc8'; c.fillRect(430, 470, W - 430, 90);
  c.fillStyle = '#ffab91'; czRR(c, 60, 410, 180, 60, 20); c.fill(); c.fillStyle = '#fff'; czRR(c, 70, 400, 60, 30, 12); c.fill();
  c.strokeStyle = '#90a4ae'; c.lineWidth = 6; c.beginPath(); c.arc(330, 380, 60, 0, 6.2832); c.stroke(); c.lineWidth = 2;
  for (i = 0; i < 8; i++) { var a = i / 8 * 6.2832 + t * 0.2; c.beginPath(); c.moveTo(330, 380); c.lineTo(330 + Math.cos(a) * 60, 380 + Math.sin(a) * 60); c.stroke(); }
  c.fillStyle = '#78909c'; c.fillRect(326, 380, 8, 90);
  c.fillStyle = '#ffe082'; c.beginPath(); c.ellipse(300, 470, 34, 10, 0, 0, 6.2832); c.fill(); c.fillStyle = '#5d4037'; for (i = 0; i < 6; i++) { c.beginPath(); c.ellipse(282 + i * 7, 466, 3, 5, 0.4, 0, 6.2832); c.fill(); }
  /* 회사: 출근 기록기 · 책상 · 컴퓨터 */
  c.fillStyle = '#90a4ae'; czRR(c, 620, 150, 70, 100, 8); c.fill(); c.fillStyle = '#263238'; c.fillRect(632, 165, 46, 22); czText(c, new Date().toTimeString().slice(0, 5), 655, 177, 14, '#69f0ae');
  c.fillStyle = '#fff'; c.fillRect(640, 200, 30, 40);
  if (hmDay().in) { c.strokeStyle = '#e53935'; c.lineWidth = 2.5; c.beginPath(); c.arc(655, 220, 11, 0, 6.2832); c.stroke(); czText(c, '출', 655, 220, 11, '#e53935'); }
  if (h.st === 'stamp' && h.stampT < 0.7) { var sy = 140 + Math.min(1, h.stampT / 0.5) * 60; c.fillStyle = '#e53935'; czRR(c, 640, sy - 30, 30, 26, 4); c.fill(); c.fillStyle = '#5d4037'; c.fillRect(650, sy - 50, 10, 22); }
  c.fillStyle = '#8d6e63'; c.fillRect(700, 420, 220, 16); c.fillRect(712, 436, 10, 34); c.fillRect(900, 436, 10, 34);
  c.fillStyle = '#37474f'; czRR(c, 780, 330, 110, 76, 6); c.fill(); c.fillRect(828, 406, 14, 14);
  c.fillStyle = h.st === 'work' ? '#80deea' : '#546e7a'; c.fillRect(788, 338, 94, 60);
  if (h.st === 'work') { c.fillStyle = '#006064'; for (i = 0; i < 5; i++) c.fillRect(796, 346 + i * 10, 20 + ((Math.floor(t * 3) + i * 7) % 6) * 10, 4); }
  c.fillStyle = '#ffe082'; c.beginPath(); c.arc(940, 400, 16, 0, 6.2832); c.fill(); c.fillStyle = '#66bb6a'; c.fillRect(936, 404, 8, 16);
  /* 창밖 */
  c.fillStyle = '#b3e5fc'; czRR(c, 470, 90, 120, 90, 6); c.fill(); c.strokeStyle = '#90a4ae'; c.lineWidth = 5; czRR(c, 470, 90, 120, 90, 6); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(500 + (t * 8) % 120, 120, 12, 0, 6.2832); c.fill();
  /* 일 진행 막대 */
  if (h.st === 'work') { var k = 1 - hmLeft() / HM_WORK_SEC; c.fillStyle = 'rgba(0,0,0,.12)'; czRR(c, 700, 280, 220, 14, 7); c.fill(); c.fillStyle = '#66bb6a'; czRR(c, 700, 280, Math.max(14, 220 * k), 14, 7); c.fill(); czText(c, k >= 1 ? '퇴근 가능!' : '오늘 할 일 ' + Math.round(k * 100) + '%', 810, 262, 14, '#455a64'); }
  var st = h.st === 'home' ? 'home' : h.st, face = h.st === 'back' ? -1 : 1, hy = h.st === 'work' ? 384 : 430;
  hmHam(c, h.x, hy, t, st, face);
  if (h.st === 'sleep') { czText(c, 'z', h.x + 40, 390 - (t * 10) % 30, 18, '#5c6bc0', '#fff'); czText(c, 'Z', h.x + 55, 370 - (t * 10 + 15) % 30, 22, '#5c6bc0', '#fff'); }
  CZ.pops.forEach(function (p) { c.globalAlpha = Math.min(1, p.a); czText(c, p.t, p.x, p.y, 22, '#e65100', '#fff'); }); c.globalAlpha = 1;
}

/* =====================================================================
   ④ 🦆 오리 산책시키기
   ===================================================================== */
function startDuckWalk() {
  czSetup('dw-root', 'duckwalk', 1000, 600,
    '<div class="cz-hud"><span id="dw-info"></span></div>' +
    '<div class="cz-bar"><button id="dw-rain" onclick="dwRain()">🌧 비</button></div>');
  var S = czLS('duckwalk', { crumbs: 0, rain: false }); CZ.S = S;
  CZ.d = { x: 520, y: 380, tx: 520, ty: 380, ang: 0, face: 1, walk: 0, wet: 0, inPond: false, inPud: -1 };
  CZ.pond = { x: 230, y: 190, rx: 170, ry: 110 };
  CZ.puds = [{ x: 640, y: 470, rx: 60, ry: 26 }, { x: 860, y: 230, rx: 48, ry: 20 }, { x: 420, y: 520, rx: 40, ry: 16 }];
  CZ.crumbs = []; for (var i = 0; i < 9; i++) dwCrumb();
  CZ.trail = []; CZ.kids = Math.min(4, Math.floor(S.crumbs / 5)); CZ.steps = []; CZ.fx = []; CZ.rain = []; CZ.mark = null;
  CZ.trees = [[60, 520], [940, 80], [960, 520], [560, 70], [80, 400]];
  CZ.cv.addEventListener('pointerdown', function (e) { var p = czPt(e); CZ.d.tx = p.x; CZ.d.ty = p.y; CZ.mark = { x: p.x, y: p.y, a: 1 }; });
  dwUi();
  czLoop(dwStep, dwDraw);
}
function dwCrumb() { var x, y, k = 0; do { x = 80 + Math.random() * 840; y = 80 + Math.random() * 460; k++; } while (k < 30 && Math.hypot((x - 230) / 180, (y - 190) / 120) < 1); CZ.crumbs.push({ x: x, y: y, r: 3 + Math.random() * 3, rot: Math.random() * 6 }); }
function dwRain() { CZ.S.rain = !CZ.S.rain; czLSset('duckwalk', CZ.S); dwUi(); }
function dwUi() {
  document.getElementById('dw-rain').textContent = CZ.S.rain ? '☀️ 비 그치기' : '🌧 비 내리기';
  document.getElementById('dw-info').textContent = '🦆 누른 곳으로 뒤뚱뒤뚱 · 빵 ' + CZ.S.crumbs + '개 냠냠' + (CZ.kids ? ' · 아기 오리 ' + CZ.kids + '마리가 따라와요' : ' · 빵 5개마다 아기 오리가 와요');
}
function dwInE(p, e) { return Math.hypot((p.x - e.x) / e.rx, (p.y - e.y) / e.ry) < 1; }
function dwStep(dt) {
  var d = CZ.d, dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy);
  d.inPond = dwInE(d, CZ.pond);
  var pud = -1; CZ.puds.forEach(function (p, i) { if (dwInE(d, p)) pud = i; });
  if (pud >= 0 && d.inPud !== pud) { for (var i = 0; i < 14; i++) { var a = Math.random() * 6.283; CZ.fx.push({ x: d.x, y: d.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 40, a: 0.8, k: 'drop' }); } CZ.fx.push({ x: d.x, y: d.y - 40, a: 1.2, k: 'text', t: '첨벙!' }); d.wet = 1; }
  d.inPud = pud;
  if (d.inPond) d.wet = 1;
  if (dist > 4) {
    var sp = d.inPond ? 110 : 85;
    d.x += dx / dist * Math.min(dist, sp * dt); d.y += dy / dist * Math.min(dist, sp * dt);
    var ta = Math.atan2(dy, dx), da = ((ta - d.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI; d.ang += da * Math.min(1, dt * 8);
    if (Math.abs(dx) > 2) d.face = dx > 0 ? 1 : -1;
    d.walk += dt * (d.inPond ? 4 : 10);
    if (!d.inPond && d.wet > 0.05 && Math.floor(d.walk / 1.6) !== d.lastStep) { d.lastStep = Math.floor(d.walk / 1.6); var side = d.lastStep % 2 ? 1 : -1; CZ.steps.push({ x: d.x + Math.cos(d.ang + Math.PI / 2) * 6 * side, y: d.y + Math.sin(d.ang + Math.PI / 2) * 6 * side, ang: d.ang, a: d.wet }); }
    if (d.inPond && Math.random() < dt * 8) CZ.fx.push({ x: d.x, y: d.y, a: 1, k: 'ring', r: 10 });
    CZ.trail.unshift({ x: d.x, y: d.y, ang: d.ang, face: d.face }); if (CZ.trail.length > 200) CZ.trail.pop();
  }
  if (!d.inPond) d.wet = Math.max(0, d.wet - dt * 0.12);
  CZ.crumbs.forEach(function (c) { if (Math.hypot(c.x - d.x, c.y - d.y) < 20) { c.gone = true; CZ.S.crumbs++; CZ.fx.push({ x: c.x, y: c.y - 30, a: 1, k: 'text', t: '냠!' }); var k = Math.min(4, Math.floor(CZ.S.crumbs / 5)); if (k > CZ.kids) { CZ.kids = k; CZ.fx.push({ x: d.x, y: d.y - 60, a: 2, k: 'text', t: '아기 오리가 왔어요! 🐥' }); czChalk('duck-kid', 1, '아기 오리가 따라와요', 4); } else if (CZ.S.crumbs % 10 === 0) czChalk('duck-crumb', 1, '빵 냠냠 산책', 3); czLSset('duckwalk', CZ.S); dwUi(); } });
  var before = CZ.crumbs.length; CZ.crumbs = CZ.crumbs.filter(function (c) { return !c.gone; });
  if (CZ.crumbs.length < 9 && Math.random() < dt * 0.25) dwCrumb();
  CZ.steps.forEach(function (s) { s.a -= dt * 0.12; }); CZ.steps = CZ.steps.filter(function (s) { return s.a > 0; });
  CZ.fx.forEach(function (f) { f.a -= dt; if (f.k === 'drop') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; } if (f.k === 'ring') f.r += 30 * dt; if (f.k === 'text') f.y -= 20 * dt; }); CZ.fx = CZ.fx.filter(function (f) { return f.a > 0; });
  if (CZ.mark) { CZ.mark.a -= dt * 1.2; if (CZ.mark.a <= 0) CZ.mark = null; }
  if (CZ.S.rain) { for (i = 0; i < 6; i++) CZ.rain.push({ x: Math.random() * 1100, y: -20, v: 600 + Math.random() * 200 }); if (Math.random() < dt * 20) { var p = CZ.puds[Math.floor(Math.random() * 3)], aa = Math.random() * 6.283, rr = Math.random(); CZ.fx.push({ x: p.x + Math.cos(aa) * p.rx * rr * 0.8, y: p.y + Math.sin(aa) * p.ry * rr * 0.8, a: 0.6, k: 'ring', r: 2 }); } }
  CZ.rain.forEach(function (r) { r.y += r.v * dt; r.x -= r.v * 0.2 * dt; }); CZ.rain = CZ.rain.filter(function (r) { return r.y < 620; });
}
/* 낙서 그림체 노란 오리 (옆모습, 주황 외곽선) */
/* 보내 준 노란 오리 그림 (오른쪽을 봐요 → 왼쪽으로 갈 땐 뒤집기) */
function dwDuck(c, x, y, face, walk, scale, swim, umb) {
  var H = 72 * scale, hop = swim ? Math.sin(walk * 0.8) * 1.5 : -Math.abs(Math.sin(walk)) * 5 * scale, tilt = swim ? 0 : Math.sin(walk) * 0.07;
  c.fillStyle = 'rgba(0,0,0,.13)'; if (!swim) { c.beginPath(); c.ellipse(x, y + 2, 30 * scale, 6 * scale, 0, 0, 6.2832); c.fill(); }
  if (!swim) { c.strokeStyle = '#f5a000'; c.lineWidth = 4 * scale; c.lineCap = 'round'; var f = Math.sin(walk) * 5 * scale; c.beginPath(); c.moveTo(x - 6 * scale, y - 6 * scale); c.lineTo(x - 6 * scale + f, y + 2); c.moveTo(x + 6 * scale, y - 6 * scale); c.lineTo(x + 6 * scale - f, y + 2); c.stroke(); }
  c.save(); c.translate(x, y - 4 * scale + hop); c.rotate(tilt);
  czSprite(c, 'duck1-1', 0, 0, H, face < 0);
  c.restore();
  if (swim) { c.fillStyle = 'rgba(80,170,230,.8)'; c.fillRect(x - 46 * scale, y - 20 * scale, 92 * scale, 24 * scale); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 46 * scale, y - 20 * scale); c.quadraticCurveTo(x - 23 * scale, y - 25 * scale, x, y - 20 * scale); c.quadraticCurveTo(x + 23 * scale, y - 15 * scale, x + 46 * scale, y - 20 * scale); c.stroke(); }
  if (umb) { c.save(); c.translate(x, y - H - 4 + hop); c.fillStyle = '#ff8a80'; c.strokeStyle = '#e57373'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 32, Math.PI, 0); c.quadraticCurveTo(24, -4, 16, 0); c.quadraticCurveTo(8, -4, 0, 0); c.quadraticCurveTo(-8, -4, -16, 0); c.quadraticCurveTo(-24, -4, -32, 0); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 24); c.stroke(); c.restore(); }
}

function dwDraw(c, t) {
  var W = CZ.W, H = CZ.H, S = CZ.S, d = CZ.d, i;
  var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, S.rain ? '#7fa36b' : '#9ccc65'); g.addColorStop(1, S.rain ? '#5f8650' : '#7cb342'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = S.rain ? 'rgba(40,70,30,.35)' : 'rgba(51,105,30,.35)'; c.lineWidth = 2;
  for (i = 0; i < 90; i++) { var gx = (i * 137) % W, gy = (i * 89) % H; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 3, gy - 8); c.moveTo(gx + 4, gy); c.lineTo(gx + 6, gy - 7); c.stroke(); }
  /* 오솔길 */
  c.strokeStyle = S.rain ? '#b9a98c' : '#e8d8b0'; c.lineWidth = 46; c.lineCap = 'round'; c.beginPath(); c.moveTo(-20, 560); c.bezierCurveTo(300, 420, 600, 600, 1020, 330); c.stroke();
  /* 연못 */
  var P = CZ.pond; c.fillStyle = '#8d9f6a'; c.beginPath(); c.ellipse(P.x, P.y, P.rx + 10, P.ry + 10, 0, 0, 6.2832); c.fill();
  var pg = c.createRadialGradient(P.x - 40, P.y - 30, 10, P.x, P.y, P.rx); pg.addColorStop(0, '#81d4fa'); pg.addColorStop(1, '#0288d1'); c.fillStyle = pg; c.beginPath(); c.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, 6.2832); c.fill();
  [[150, 150], [300, 230], [200, 250]].forEach(function (l) { c.fillStyle = '#66bb6a'; c.beginPath(); c.arc(l[0], l[1], 14, 0.3, 6); c.lineTo(l[0], l[1]); c.fill(); });
  c.fillStyle = '#f8bbd0'; c.beginPath(); c.arc(300, 230, 5, 0, 6.2832); c.fill();
  /* 빗물 웅덩이 */
  CZ.puds.forEach(function (p) { var k = S.rain ? 1.15 : 1; c.fillStyle = 'rgba(120,160,190,.75)'; c.beginPath(); c.ellipse(p.x, p.y, p.rx * k, p.ry * k, 0, 0, 6.2832); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(p.x - p.rx * 0.3, p.y - p.ry * 0.3, p.rx * 0.35, p.ry * 0.25, 0, 0, 6.2832); c.fill(); });
  /* 발자국 (젖은 발) */
  CZ.steps.forEach(function (s) { c.save(); c.translate(s.x, s.y); c.rotate(s.ang); c.fillStyle = 'rgba(60,90,120,' + Math.min(0.5, s.a * 0.5) + ')'; c.beginPath(); c.moveTo(4, 0); c.lineTo(-3, -4); c.lineTo(-1, 0); c.lineTo(-3, 4); c.closePath(); c.fill(); c.restore(); });
  /* 빵 부스러기 */
  CZ.crumbs.forEach(function (b) { c.save(); c.translate(b.x, b.y); c.rotate(b.rot); c.fillStyle = '#d7a55b'; c.beginPath(); c.ellipse(0, 0, b.r * 1.4, b.r, 0, 0, 6.2832); c.fill(); c.fillStyle = '#f3d9a4'; c.beginPath(); c.ellipse(-1, -1, b.r * 0.7, b.r * 0.5, 0, 0, 6.2832); c.fill(); c.restore(); });
  if (CZ.mark) { c.strokeStyle = 'rgba(255,255,255,' + CZ.mark.a + ')'; c.lineWidth = 3; c.beginPath(); c.arc(CZ.mark.x, CZ.mark.y, 18 * (1.5 - CZ.mark.a * 0.5), 0, 6.2832); c.stroke(); }
  CZ.fx.forEach(function (f) { if (f.k === 'ring') { c.strokeStyle = 'rgba(255,255,255,' + Math.max(0, f.a * 0.7) + ')'; c.lineWidth = 2; c.beginPath(); c.ellipse(f.x, f.y, f.r, f.r * 0.5, 0, 0, 6.2832); c.stroke(); } });
  /* 아기 오리들 → 엄마 오리 */
  for (i = CZ.kids; i >= 1; i--) { var tr = CZ.trail[Math.min(CZ.trail.length - 1, i * 22)]; if (!tr) continue; dwDuck(c, tr.x, tr.y, tr.face, d.walk + i, 0.55, dwInE(tr, CZ.pond), false); }
  dwDuck(c, d.x, d.y, d.face, d.walk, 1, d.inPond, S.rain);
  CZ.fx.forEach(function (f) { if (f.k === 'drop') { c.fillStyle = 'rgba(180,220,255,' + f.a + ')'; c.beginPath(); c.arc(f.x, f.y, 3, 0, 6.2832); c.fill(); } if (f.k === 'text') { c.globalAlpha = Math.min(1, f.a); czText(c, f.t, f.x, f.y, 18, '#fff', '#5d4037'); c.globalAlpha = 1; } });
  /* 나무 (위에서 본 모습) */
  CZ.trees.forEach(function (tr, k) { c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.arc(tr[0] + 10, tr[1] + 12, 62, 0, 6.2832); c.fill(); c.fillStyle = S.rain ? '#3e6b34' : '#4caf50'; c.beginPath(); c.arc(tr[0], tr[1], 60, 0, 6.2832); c.fill(); c.fillStyle = S.rain ? '#4f7f42' : '#66bb6a'; c.beginPath(); c.arc(tr[0] - 16, tr[1] - 14, 34 + Math.sin(t + k) * 2, 0, 6.2832); c.fill(); });
  /* 비 */
  if (S.rain) { c.fillStyle = 'rgba(40,60,90,.18)'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(220,235,255,.55)'; c.lineWidth = 1.4; CZ.rain.forEach(function (r) { c.beginPath(); c.moveTo(r.x, r.y); c.lineTo(r.x - 4, r.y + 16); c.stroke(); }); }
}
