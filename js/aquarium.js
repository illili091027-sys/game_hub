/* 🐠 어항: 물고기를 그려서 넣으면, 다른 친구들이 그린 물고기와 한 수조에서 같이 헤엄쳐요.
   - 물고기 그림은 선(획) 데이터로 저장해요: { id, name, by, owner, s: [{c 색, w 굵기, p [x,y,x,y…]}], at }
   - 서버에 연결돼 있으면 모두가 같은 수조(방 '_aquarium_', 키 'fishtank')를 봐요. 방 코드와 상관없어요.
   - 서버가 없으면 이 기기에 저장한 물고기만 보여요 (localStorage 'gamehub_aquarium').
   - 내가 그린 물고기는 ★표시, '내 물고기 찾기'로 따라가 볼 수 있어요. 내 물고기만 뺄 수 있어요. */

var AQ = null, AQ_RAF = null, AQ_SYNC = null;
var AQ_DW = 400, AQ_DH = 240;          /* 그리기 칸 크기 */
var AQ_TW = 1000, AQ_TH = 560;         /* 수조 크기 */
var AQ_LOCAL = 'gamehub_aquarium', AQ_MAX = 150;
var AQ_COLORS = ['#ff7043', '#ffca28', '#66bb6a', '#29b6f6', '#5c6bc0', '#ab47bc', '#ec407a', '#8d6e63', '#212121', '#ffffff'];
var AQ_SIZES = [4, 8, 14];
/* 🐙 수조에 원래 사는 바다 친구들 (보내 준 그림 img/pets/sea행-열.png, 10마리만 남김)
   f: 그림 속 머리 방향 (1 오른쪽, -1 왼쪽, 0 정면이라 안 뒤집어요) · b: 바닥 친구 (모래 위) · s: 크기 */
var AQ_SEA = [
  { i: 'sea2-1', n: '돌고래', f: -1, s: 66 }, { i: 'sea2-4', n: '해파리', f: 0, s: 52 }, { i: 'sea4-3', n: '고래', f: 0, s: 64 },
  { i: 'sea6-2', n: '흰동가리', f: -1, s: 50 }, { i: 'sea7-1', n: '복어', f: -1, s: 52 }, { i: 'sea7-2', n: '해마', f: 0, s: 58 },
  { i: 'sea3-2', n: '문어', f: 0, s: 56 },
  { i: 'sea2-3', n: '꽃게', f: 0, s: 44, b: 1, walk: 1 }, { i: 'sea7-5', n: '거북이', f: 1, s: 40, b: 1, walk: 1 }, { i: 'sea8-3', n: '불가사리', f: 0, s: 42, b: 1 }
];

/* ---------- 저장 ---------- */
function aqLocal() { try { var d = JSON.parse(localStorage.getItem(AQ_LOCAL) || '{}') || {}; d.fish = d.fish || []; if (!d.owner) d.owner = 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); return d; } catch (e) { return { fish: [], owner: 'o' + Date.now().toString(36) }; } }
function aqLocalSave(d) { try { localStorage.setItem(AQ_LOCAL, JSON.stringify(d)); } catch (e) {} }
function aqServer() {
  var u = (typeof cloudServerUrl !== 'undefined' && cloudServerUrl) || (typeof loadSavedServerUrl === 'function' ? normalizeServerUrl(loadSavedServerUrl()) : '');
  return u || '';
}
function aqUrl() { return aqServer() + '/api/state?room=_aquarium_&game=fishtank'; }
function aqFetch() {
  if (!aqServer()) return Promise.resolve(null);
  return fetch(aqUrl(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { return (j && j.data && j.data.fish) ? j.data.fish : (j ? [] : null); }).catch(function () { return null; });
}
function aqPut(list) {
  return fetch(aqUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fish: list.slice(-AQ_MAX), t: Date.now() }) });
}
/* 서버 목록 + 내 기기 목록 합치기 (같은 id는 하나만) */
function aqMerge(server) {
  var L = aqLocal(), seen = {}, out = [];
  (server || []).concat(L.fish).forEach(function (f) { if (f && f.id && !seen[f.id] && !(L.hidden || {})[f.id]) { seen[f.id] = 1; out.push(f); } });
  return out;
}

/* ---------- 시작 · 끝 ---------- */
function startAquarium() {
  stopAquarium();
  var L = aqLocal(); aqLocalSave(L);
  var bgs = ['img/bg/underwater-cartoon.jpg', 'img/bg/underwater-real.jpg'].map(function (u) { var im = new Image(); im.src = u; return im; });
  AQ = { bgs: bgs, bgi: 0, tab: 'tank', strokes: [], cur: null, color: AQ_COLORS[0], size: 1, fish: [], swim: [], food: [], bubbles: [], online: null, focus: -1, names: true, owner: L.owner, t: 0 };
  document.getElementById('aq-root').innerHTML =
    '<div class="aq-tabs"><button id="aq-t-tank" onclick="aqTab(\'tank\')">🐠 수조 보기</button><button id="aq-t-draw" onclick="aqTab(\'draw\')">🎨 물고기 그리기</button>' +
      '<span class="aq-count" id="aq-count"></span></div>' +
    '<div id="aq-tank" class="aq-pane">' +
      '<div class="aq-tankbox"><canvas id="aq-tcv" class="aq-tcv"></canvas><div class="aq-pop" id="aq-pop" style="display:none"></div></div>' +
      '<div class="aq-tbar"><button class="btn btn-ghost" onclick="aqFindMine()">⭐ 내 물고기 찾기</button><button class="btn btn-ghost" id="aq-names" onclick="aqToggleNames()">🏷 이름 끄기</button>' +
        '<button class="btn btn-ghost" onclick="AQ.bgi = 1 - AQ.bgi">🌊 배경 바꾸기</button><button class="btn btn-ghost" id="aq-sea" onclick="aqToggleSea()">🐙 바다 친구들 숨기기</button><button class="btn btn-ghost" onclick="aqSync(true)">🔄 새로고침</button><span class="aq-tip">💡 물을 누르면 먹이를 줘요</span></div>' +
      '<div class="aq-status" id="aq-status"></div>' +
    '</div>' +
    '<div id="aq-draw" class="aq-pane" style="display:none">' +
      '<div class="aq-drawwrap"><canvas id="aq-dcv" class="aq-dcv" width="' + AQ_DW + '" height="' + AQ_DH + '"></canvas><div class="aq-guide">머리는 오른쪽 → 보게 그려요</div></div>' +
      '<div class="aq-tools">' +
        '<div class="aq-pal">' + AQ_COLORS.map(function (c) { return '<button class="aq-col" data-c="' + c + '" style="background:' + c + '" onclick="aqPick(\'' + c + '\')"></button>'; }).join('') + '</div>' +
        '<div class="aq-sizes">' + AQ_SIZES.map(function (w, i) { return '<button class="aq-size" data-i="' + i + '" onclick="aqSize(' + i + ')"><i style="width:' + (w + 2) + 'px;height:' + (w + 2) + 'px"></i></button>'; }).join('') +
          '<button class="btn btn-ghost" onclick="aqUndo()">↶ 되돌리기</button><button class="btn btn-ghost" onclick="aqClear()">🗑 지우기</button></div>' +
        '<div class="aq-submit"><input id="aq-name" maxlength="12" placeholder="물고기 이름 (예: 뽀글이)"><button class="btn btn-primary" onclick="aqSubmit()">🐟 수조에 넣기!</button></div>' +
        '<div class="aq-err" id="aq-err"></div>' +
      '</div>' +
    '</div>';
  var tc = document.getElementById('aq-tcv'), dpr = Math.min(2, window.devicePixelRatio || 1);
  tc.width = AQ_TW * dpr; tc.height = AQ_TH * dpr; AQ.dpr = dpr; AQ.tctx = tc.getContext('2d'); AQ.dctx = document.getElementById('aq-dcv').getContext('2d');
  aqSetupDraw(); aqSetupTank(tc);
  for (var i = 0; i < 26; i++) AQ.bubbles.push(aqNewBubble(true));
  AQ.weeds = []; for (i = 0; i < 9; i++) AQ.weeds.push({ x: 40 + i * 115 + Math.random() * 40, h: 90 + Math.random() * 120, c: ['#2e7d32', '#43a047', '#558b2f'][i % 3], ph: Math.random() * 6 });
  AQ.sea = AQ_SEA.map(function (d, k) {
    var im = new Image(); im.src = 'img/pets/' + d.i + '.png';
    return { d: d, im: im, x: 60 + Math.random() * (AQ_TW - 120), y: d.b ? AQ_TH - 18 - Math.random() * 14 : 70 + Math.random() * (AQ_TH - 230),
      vx: d.b ? (d.walk ? (Math.random() < 0.5 ? -1 : 1) * 12 : 0) : (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 18), ty: 70 + Math.random() * (AQ_TH - 230), ph: Math.random() * 6 };
  });
  AQ.seaOn = true;
  aqTab('tank'); aqPick(AQ.color); aqSize(1);
  aqSync(true);
  AQ_SYNC = setInterval(function () { aqSync(false); }, 10000);
  var last = 0;
  (function loop(now) {
    AQ_RAF = requestAnimationFrame(loop);
    if (!AQ) return;
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    AQ.t += dt;
    if (AQ.tab === 'tank') { aqStep(dt); aqDrawTank(); } else aqDrawPad();
  })(0);
}
function stopAquarium() {
  if (AQ_RAF) cancelAnimationFrame(AQ_RAF); AQ_RAF = null;
  clearInterval(AQ_SYNC); AQ_SYNC = null; AQ = null;
}
function aqTab(t) {
  AQ.tab = t;
  document.getElementById('aq-tank').style.display = t === 'tank' ? '' : 'none';
  document.getElementById('aq-draw').style.display = t === 'draw' ? '' : 'none';
  document.getElementById('aq-t-tank').classList.toggle('on', t === 'tank');
  document.getElementById('aq-t-draw').classList.toggle('on', t === 'draw');
}

/* ---------- 서버와 맞추기 ---------- */
function aqSync(force) {
  aqFetch().then(function (server) {
    if (!AQ) return;
    AQ.online = server !== null;
    aqSetFish(aqMerge(server));
    var st = document.getElementById('aq-status');
    if (st) st.textContent = AQ.online ? '🌊 모두의 수조예요. 친구들이 그린 물고기가 같이 헤엄쳐요 (10초마다 새 물고기 확인)' : '📴 서버에 연결되지 않아서 이 기기에서 그린 물고기만 보여요';
  });
}
function aqSetFish(list) {
  var have = {}; AQ.swim.forEach(function (s) { have[s.f.id] = s; });
  var next = [];
  list.forEach(function (f) {
    if (have[f.id]) { next.push(have[f.id]); return; }
    var sp = aqSprite(f); if (!sp) return;
    var fresh = AQ.fish.length > 0;                            /* 처음 이후 새로 들어온 물고기는 위에서 퐁당 */
    next.push({ f: f, sp: sp, x: Math.random() * AQ_TW, y: fresh ? -40 : 60 + Math.random() * (AQ_TH - 200), vx: (Math.random() < 0.5 ? -1 : 1) * (28 + Math.random() * 30), vy: 0,
      ty: 70 + Math.random() * (AQ_TH - 220), ph: Math.random() * 6, scale: 0.8 + Math.random() * 0.4, splash: fresh ? 1 : 0, mine: f.owner === AQ.owner });
  });
  AQ.swim = next; AQ.fish = list;
  document.getElementById('aq-count').textContent = '🐟 ' + list.length + '마리';
}

/* 획 데이터 → 물고기 그림(잘라낸 작은 캔버스) */
function aqSprite(f) {
  if (!f.s || !f.s.length) return null;
  var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  f.s.forEach(function (st) { for (var i = 0; i + 1 < st.p.length; i += 2) { minx = Math.min(minx, st.p[i] - st.w); maxx = Math.max(maxx, st.p[i] + st.w); miny = Math.min(miny, st.p[i + 1] - st.w); maxy = Math.max(maxy, st.p[i + 1] + st.w); } });
  var w = Math.max(10, maxx - minx), h = Math.max(10, maxy - miny), k = Math.min(1, 130 / w, 90 / h);
  var c = document.createElement('canvas'); c.width = Math.ceil(w * k * 2); c.height = Math.ceil(h * k * 2);
  var x = c.getContext('2d'); x.scale(k * 2, k * 2); x.translate(-minx, -miny);
  aqPaint(x, f.s);
  return { c: c, w: w * k, h: h * k };
}
function aqPaint(x, strokes) {
  x.lineCap = 'round'; x.lineJoin = 'round';
  strokes.forEach(function (st) {
    var p = st.p; if (!p.length) return;
    x.strokeStyle = st.c; x.lineWidth = st.w; x.beginPath(); x.moveTo(p[0], p[1]);
    if (p.length === 2) x.lineTo(p[0] + 0.1, p[1]);
    for (var i = 2; i + 1 < p.length; i += 2) x.lineTo(p[i], p[i + 1]);
    x.stroke();
  });
}

/* ---------- 그리기 ---------- */
function aqPick(c) { AQ.color = c; document.querySelectorAll('.aq-col').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-c') === c); }); }
function aqSize(i) { AQ.size = i; document.querySelectorAll('.aq-size').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-i') === i); }); }
function aqUndo() { AQ.strokes.pop(); }
function aqClear() { AQ.strokes = []; }
function aqSetupDraw() {
  var cv = document.getElementById('aq-dcv');
  function pt(e) { var r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * AQ_DW / r.width), Math.round((e.clientY - r.top) * AQ_DH / r.height)]; }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} var p = pt(e); AQ.cur = { c: AQ.color, w: AQ_SIZES[AQ.size], p: [p[0], p[1]] }; AQ.strokes.push(AQ.cur); document.getElementById('aq-err').textContent = ''; });
  cv.addEventListener('pointermove', function (e) { if (!AQ || !AQ.cur) return; var p = pt(e), q = AQ.cur.p; if (Math.hypot(p[0] - q[q.length - 2], p[1] - q[q.length - 1]) >= 3) q.push(p[0], p[1]); });
  var up = function () { if (AQ) AQ.cur = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}
function aqDrawPad() {
  var x = AQ.dctx; x.clearRect(0, 0, AQ_DW, AQ_DH);
  x.fillStyle = '#fff'; x.fillRect(0, 0, AQ_DW, AQ_DH);
  x.strokeStyle = 'rgba(41,182,246,.12)'; x.lineWidth = 1;
  for (var i = 20; i < AQ_DW; i += 20) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, AQ_DH); x.stroke(); }
  for (i = 20; i < AQ_DH; i += 20) { x.beginPath(); x.moveTo(0, i); x.lineTo(AQ_DW, i); x.stroke(); }
  if (!AQ.strokes.length) { x.fillStyle = 'rgba(0,0,0,.12)'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.fillText('🐟 →  여기에 물고기를 그려요', AQ_DW / 2, AQ_DH / 2 + 8); }
  aqPaint(x, AQ.strokes);
}
function aqSubmit() {
  var err = document.getElementById('aq-err'), len = 0;
  AQ.strokes.forEach(function (s) { len += s.p.length / 2; });
  if (len < 25) { err.textContent = '조금 더 그려 주세요! 🐟'; return; }
  var name = (document.getElementById('aq-name').value || '').trim().slice(0, 12) || '이름 없는 물고기';
  var who = (typeof me !== 'undefined' && me.name && me.name !== '나') ? me.name : '익명';
  var f = { id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, by: who, owner: AQ.owner, at: Date.now(),
    s: AQ.strokes.map(function (s) { return { c: s.c, w: s.w, p: s.p.slice() }; }) };
  var L = aqLocal(); L.fish.push(f); L.fish = L.fish.slice(-30); aqLocalSave(L);
  err.textContent = '넣는 중…';
  var done = function (ok) {
    if (!AQ) return;
    AQ.strokes = []; document.getElementById('aq-name').value = ''; err.textContent = '';
    aqTab('tank'); aqSync(true);
    if (typeof czChalk === 'function') setTimeout(function () { czChalk('aq-fish', 1, '물고기 퐁당!', 3); }, 1800);   /* 퐁당 알림 뒤에 분필 알림 */
    if (typeof coinToast === 'function') coinToast(ok ? '🐟 ' + name + ' 퐁당! 모두의 수조에 들어갔어요' : '🐟 ' + name + ' 퐁당! (서버가 없어서 이 기기에만 저장)');
    setTimeout(function () { aqFindMine(f.id); }, 1200);
  };
  if (!aqServer()) { done(false); return; }
  /* 가장 최신 목록에 내 물고기를 붙여서 저장 (동시에 넣어도 사라지지 않게 한 번 더 확인) */
  var push = function (tries) {
    return aqFetch().then(function (list) {
      if (list === null) return false;
      if (!list.some(function (x) { return x.id === f.id; })) list.push(f);
      return aqPut(list).then(function () { return aqFetch(); }).then(function (l2) {
        if (l2 && l2.some(function (x) { return x.id === f.id; })) return true;
        return tries > 0 ? push(tries - 1) : false;
      });
    }).catch(function () { return false; });
  };
  push(2).then(done);
}
/* 내 물고기 빼기 (내 기기에서 넣은 것만) */
function aqRemove(id) {
  if (!confirm('이 물고기를 수조에서 뺄까요?')) return;
  var L = aqLocal(); L.fish = L.fish.filter(function (f) { return f.id !== id; }); aqLocalSave(L);
  document.getElementById('aq-pop').style.display = 'none';
  if (!aqServer()) { aqSync(true); return; }
  aqFetch().then(function (list) { if (list) return aqPut(list.filter(function (f) { return !(f.id === id && f.owner === AQ.owner); })); }).then(function () { aqSync(true); });
}

/* 🛠 관리자: 누구의 물고기든 모두의 수조에서 지워요 */
function aqAdminRemove(id) {
  if (!(typeof ADMIN_MODE !== 'undefined' && ADMIN_MODE)) return;
  if (!confirm('관리자: 이 물고기를 모두의 수조에서 지울까요?')) return;
  document.getElementById('aq-pop').style.display = 'none';
  AQ.swim = AQ.swim.filter(function (s) { return s.f.id !== id; });
  if (!aqServer()) return;
  aqFetch().then(function (list) { if (list) return aqPut(list.filter(function (f) { return f.id !== id; })); }).then(function () { aqSync(true); });
}

/* ---------- 수조 ---------- */
function aqNewBubble(any) { return { x: Math.random() * AQ_TW, y: any ? Math.random() * AQ_TH : AQ_TH + 10, r: 2 + Math.random() * 5, v: 20 + Math.random() * 40, ph: Math.random() * 6 }; }
function aqSetupTank(cv) {
  cv.addEventListener('pointerdown', function (e) {
    var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * AQ_TW / r.width, y = (e.clientY - r.top) * AQ_TH / r.height;
    var hit = null;
    AQ.swim.forEach(function (s) { var sw = s.sp.w * s.scale / 2, sh = s.sp.h * s.scale / 2; if (Math.abs(x - s.x) < sw && Math.abs(y - s.y) < sh) hit = s; });
    if (hit) { aqShowPop(hit); return; }
    var sea = null; if (AQ.seaOn) AQ.sea.forEach(function (r) { var h = r.d.s; if (Math.abs(x - r.x) < h * 0.6 && Math.abs(y - (r.d.b ? r.y - h / 2 : r.y)) < h * 0.6) sea = r; });
    if (sea) { var pp = document.getElementById('aq-pop'); pp.innerHTML = '<b>🐚 ' + sea.d.n + '</b><span>수조에 원래 사는 바다 친구예요</span>'; pp.style.display = 'flex'; AQ.focus = -1; return; }
    document.getElementById('aq-pop').style.display = 'none';
    for (var i = 0; i < 5; i++) AQ.food.push({ x: x + (Math.random() - 0.5) * 30, y: Math.max(4, y - 10 + Math.random() * 10), v: 26 + Math.random() * 14 });   /* 먹이 톡톡 */
  });
}
function aqShowPop(s) {
  var p = document.getElementById('aq-pop'), f = s.f;
  p.innerHTML = '<b>' + (s.mine ? '⭐ ' : '') + esc(f.name) + '</b><span>' + esc(f.by || '익명') + ' 님의 물고기 · ' + new Date(f.at).toLocaleDateString() + '</span>' +
    (s.mine ? '<button class="btn btn-ghost" onclick="aqRemove(\'' + f.id + '\')">수조에서 빼기</button>' : '') +
    (typeof ADMIN_MODE !== 'undefined' && ADMIN_MODE && !s.mine ? '<button class="btn btn-ghost aq-admin" onclick="aqAdminRemove(\'' + f.id + '\')">🛠 관리자: 지우기</button>' : '');
  p.style.display = 'flex'; AQ.focus = AQ.swim.indexOf(s);
}
function aqFindMine(id) {
  var mine = AQ.swim.filter(function (s) { return id ? s.f.id === id : s.mine; });
  if (!mine.length) { if (typeof coinToast === 'function') coinToast('아직 내 물고기가 없어요. 그리러 가요! 🎨'); return; }
  var cur = AQ.swim[AQ.focus], i = mine.indexOf(cur);
  aqShowPop(mine[(i + 1) % mine.length]);
}
function aqToggleSea() { AQ.seaOn = !AQ.seaOn; document.getElementById('aq-sea').textContent = AQ.seaOn ? '🐙 바다 친구들 숨기기' : '🐙 바다 친구들 보이기'; }
function aqToggleNames() { AQ.names = !AQ.names; document.getElementById('aq-names').textContent = AQ.names ? '🏷 이름 끄기' : '🏷 이름 켜기'; }
function aqStep(dt) {
  AQ.food.forEach(function (f) { f.y = Math.min(AQ_TH - 46, f.y + f.v * dt); f.age = (f.age || 0) + dt; });
  AQ.food = AQ.food.filter(function (f) { return !f.eaten && f.age < 14; });
  AQ.swim.forEach(function (s, idx) {
    if (s.splash > 0) { s.splash = Math.max(0, s.splash - dt * 0.8); s.y += (s.ty - s.y) * dt * 1.6; }
    var target = null, best = 1e9;
    AQ.food.forEach(function (f) { var d = Math.hypot(f.x - s.x, f.y - s.y); if (d < 260 && d < best) { best = d; target = f; } });
    if (target) {                                                   /* 먹이 쪽으로 쌩 */
      var dir = target.x > s.x ? 1 : -1;
      s.vx += (dir * 90 - s.vx) * dt * 2.5; s.y += (target.y - s.y) * dt * 1.8;
      if (best < 18) target.eaten = true;
    } else {
      var sp = (s.vx > 0 ? 1 : -1) * (28 + (idx % 5) * 7);
      s.vx += (sp - s.vx) * dt * 0.8;
      if (Math.random() < dt * 0.08) s.vx = -s.vx * 0.4;                          /* 가끔 방향을 바꿔요 */
      if (Math.random() < dt * 0.15) s.ty = 60 + Math.random() * (AQ_TH - 210);
      s.y += (s.ty - s.y) * dt * 0.35;
    }
    s.x += s.vx * dt;
    var half = s.sp.w * s.scale / 2;
    if (s.x < half && s.vx < 0) s.vx = Math.abs(s.vx); if (s.x > AQ_TW - half && s.vx > 0) s.vx = -Math.abs(s.vx);
    s.ph += dt * (3 + Math.abs(s.vx) / 30);
  });
  AQ.sea.forEach(function (r) {
    r.ph += dt * 2;
    if (r.d.b) { if (r.d.walk) { r.x += r.vx * dt; if (r.x < 40 || r.x > AQ_TW - 40) r.vx = -r.vx; if (Math.random() < dt * 0.05) r.vx = -r.vx; } return; }
    r.x += r.vx * dt; if (Math.random() < dt * 0.1) r.ty = 70 + Math.random() * (AQ_TH - 230); r.y += (r.ty - r.y) * dt * 0.3;
    var h = r.d.s; if ((r.x < h && r.vx < 0) || (r.x > AQ_TW - h && r.vx > 0)) r.vx = -r.vx;
    if (Math.random() < dt * 0.04) r.vx = -r.vx;
  });
  AQ.bubbles.forEach(function (b, i) { b.y -= b.v * dt; b.ph += dt * 2; if (b.y < -10) AQ.bubbles[i] = aqNewBubble(false); });
}
function aqDrawTank() {
  var x = AQ.tctx, t = AQ.t, i; x.setTransform(AQ.dpr, 0, 0, AQ.dpr, 0, 0);
  var im = AQ.bgs[AQ.bgi];
  if (im.complete && im.naturalWidth) { var k = Math.max(AQ_TW / im.naturalWidth, AQ_TH / im.naturalHeight), iw = im.naturalWidth * k, ih = im.naturalHeight * k; x.drawImage(im, (AQ_TW - iw) / 2, AQ_TH - ih, iw, ih); }
  else { var g = x.createLinearGradient(0, 0, 0, AQ_TH); g.addColorStop(0, '#4fc3f7'); g.addColorStop(1, '#01579b'); x.fillStyle = g; x.fillRect(0, 0, AQ_TW, AQ_TH); }
  x.save(); x.globalCompositeOperation = 'lighter';                          /* 물속 빛줄기 */
  for (i = 0; i < 6; i++) { var lx = (i * 190 + Math.sin(t * 0.3 + i) * 50) % (AQ_TW + 200) - 100; x.fillStyle = 'rgba(255,255,255,.03)'; x.beginPath(); x.moveTo(lx, 0); x.lineTo(lx + 70, 0); x.lineTo(lx + 210, AQ_TH); x.lineTo(lx + 110, AQ_TH); x.fill(); }
  x.restore();
  if (AQ.bgi === 1) {   /* 바닷속 사진엔 모래가 없어서 살짝 깔아요 */
    x.fillStyle = 'rgba(240,220,170,.9)'; x.beginPath(); x.moveTo(0, AQ_TH); for (i = 0; i <= AQ_TW; i += 40) x.lineTo(i, AQ_TH - 30 - Math.sin(i / 90) * 8); x.lineTo(AQ_TW, AQ_TH); x.fill();
  }
  /* 수초 */
  AQ.weeds.forEach(function (w) {
    x.strokeStyle = w.c; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(w.x, AQ_TH - 22);
    for (var k = 1; k <= 6; k++) x.lineTo(w.x + Math.sin(t * 1.2 + w.ph + k * 0.6) * k * 4, AQ_TH - 22 - w.h * k / 6);
    x.stroke();
  });
  /* 먹이 */
  x.fillStyle = '#8d6e63'; AQ.food.forEach(function (f) { x.beginPath(); x.arc(f.x, f.y, 3.2, 0, 6.2832); x.fill(); });
  /* 바다 친구들 (그린 물고기보다 뒤) */
  if (AQ.seaOn) AQ.sea.forEach(function (r) {
    if (!(r.im.complete && r.im.naturalWidth)) return;
    var h = r.d.s, w = h * r.im.naturalWidth / r.im.naturalHeight, flip = r.d.f && (r.vx > 0 ? 1 : -1) !== r.d.f;
    var bob = r.d.b ? (r.d.walk ? -Math.abs(Math.sin(r.ph * 3)) * 2 : 0) : Math.sin(r.ph) * 5;
    x.save(); x.translate(r.x, r.y + bob); if (flip) x.scale(-1, 1);
    if (r.d.i === 'sea8-4') x.rotate(Math.sin(t * 1.2 + r.ph) * 0.06);
    x.drawImage(r.im, -w / 2, r.d.b ? -h : -h / 2, w, h); x.restore();
  });
  /* 물고기 */
  AQ.swim.forEach(function (s, idx) {
    var w = s.sp.w * s.scale, h = s.sp.h * s.scale, face = s.vx >= 0 ? 1 : -1;
    var bob = Math.sin(s.ph * 0.5) * 4, wig = Math.sin(s.ph) * 0.07;
    x.save(); x.translate(s.x, s.y + bob); x.scale(face, 1);
    x.transform(1, wig * 0.6, 0, 1, 0, 0);                                    /* 꼬리 흔들흔들 */
    x.shadowColor = 'rgba(255,255,255,.7)'; x.shadowBlur = 6;                     /* 물과 색이 비슷해도 잘 보이게 */
    if (s.mine || idx === AQ.focus) { x.shadowColor = idx === AQ.focus ? '#fff59d' : 'rgba(255,255,255,.9)'; x.shadowBlur = idx === AQ.focus ? 22 : 12; }
    x.drawImage(s.sp.c, -w / 2, -h / 2, w, h);
    x.restore();
    if (AQ.names || idx === AQ.focus) {
      x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'top';
      var label = (s.mine ? '⭐ ' : '') + s.f.name, tw = x.measureText(label).width + 12;
      x.fillStyle = idx === AQ.focus ? 'rgba(255,193,7,.9)' : 'rgba(0,40,80,.45)'; x.beginPath(); x.roundRect ? x.roundRect(s.x - tw / 2, s.y + h / 2 + 2, tw, 17, 8) : x.rect(s.x - tw / 2, s.y + h / 2 + 2, tw, 17); x.fill();
      x.fillStyle = '#fff'; x.fillText(label, s.x, s.y + h / 2 + 4);
    }
    if (s.splash > 0.6) { x.strokeStyle = 'rgba(255,255,255,' + (s.splash - 0.6) * 2 + ')'; x.lineWidth = 3; x.beginPath(); x.ellipse(s.x, 8, 60 * (1 - s.splash) + 20, 8, 0, 0, 6.2832); x.stroke(); }
  });
  /* 공기방울 */
  x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.5;
  AQ.bubbles.forEach(function (b) { x.beginPath(); x.arc(b.x + Math.sin(b.ph) * 4, b.y, b.r, 0, 6.2832); x.stroke(); });
  if (!AQ.swim.length && !AQ.seaOn) { x.fillStyle = 'rgba(255,255,255,.85)'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('아직 물고기가 없어요. 🎨 첫 물고기를 그려 봐요!', AQ_TW / 2, AQ_TH / 2); }
}
