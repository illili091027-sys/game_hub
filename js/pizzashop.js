/* ---------------- 피자가게 사장님 (혼자 하기 · 경영 시뮬레이션) ----------------
   손님 주문 → 도우·소스·치즈·토핑 → 오븐 → 자르기 → 전달 → 정산·업그레이드
   진행은 이 기기에 저장돼요 (localStorage: gamehub_pzshop_v1) */
var PS = null, PS_RAF = null, PS_R = 150, PS_C = 180, PS_G = 14;
var PS_KEY = 'gamehub_pzshop_v1';
var PS_T = {
  pep: { n: '페퍼로니', e: '🔴', d: 1, p: 60 }, mush: { n: '버섯', e: '🍄', d: 1, p: 50 },
  olive: { n: '올리브', e: '⚫', d: 2, p: 40 }, onion: { n: '양파', e: '🧅', d: 3, p: 30 },
  pepper: { n: '피망', e: '🫑', d: 4, p: 40 }, bacon: { n: '베이컨', e: '🥓', d: 5, p: 80 },
  pine: { n: '파인애플', e: '🍍', d: 6, p: 50 }
};
var PS_FACES = ['🙂', '👩', '👴', '🧑‍🎤', '👧', '🐱', '🐻', '🤖', '🧛', '👽'];
var PS_UP = {
  oven: { n: '🔥 고급 오븐', d: '굽는 시간 단축 + 적정 구간 넓힘', p: [3000, 6000] },
  knife: { n: '🔪 정렬 칼', d: '칼자국이 항상 중심을 지나요', p: [2500] },
  deco: { n: '🏠 가게 인테리어', d: '분위기 변경 + 팁 보너스', p: [2000, 4000, 7000] }
};
var PS_DUR = [9000, 8000, 7000], PS_WIN = [[62, 82], [58, 86], [54, 90]];

function psPick(a) { return a[Math.floor(Math.random() * a.length)]; }
function psJ(w, a, b) { var c = w.charCodeAt(w.length - 1) - 44032; return w + ((c >= 0 && c % 28) ? a : b); }
function psSave() { try { localStorage.setItem(PS_KEY, JSON.stringify({ day: PS.day, money: PS.money, rep: PS.rep, up: PS.up, idx: PS.idx, earn: PS.earn, cost: PS.cost, tips: PS.tips })); } catch (e) {} }
function psUnlocked() { return Object.keys(PS_T).filter(function (k) { return PS_T[k].d <= PS.day; }); }
function psN() { return 4 + Math.min(PS.day, 6) + Math.floor(PS.rep / 30); }
function psNew() { return { dough: false, sc: [], ch: [], tops: [], cuts: [], bk: 0, paid: {} }; }

function startPizzaShop() {
  stopPizzaShop();
  var s = {}; try { s = JSON.parse(localStorage.getItem(PS_KEY) || 'null') || {}; } catch (e) {}
  PS = { day: s.day || 1, money: s.money == null ? 5000 : s.money, rep: s.rep == null ? 30 : s.rep, up: s.up || { oven: 0, knife: 0, deco: 0 },
    idx: s.idx || 0, earn: s.earn || 0, cost: s.cost || 0, tips: s.tips || 0, tool: 'sauce', stage: 'none', bk: 0 };
  psBuild(); psNext();
  try { if (window.matchMedia('(pointer:coarse)').matches) psLandscape(); } catch (e) {}
  PS_RAF = requestAnimationFrame(psFrame);
}
function psLandscape() {
  try {
    var el = document.documentElement, f = el.requestFullscreen ? el.requestFullscreen() : (el.webkitRequestFullscreen && el.webkitRequestFullscreen());
    Promise.resolve(f).then(function () { if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape'); }).catch(function () {});
  } catch (e) {}
}
function stopPizzaShop() {
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (e) {} cancelAnimationFrame(PS_RAF); PS_RAF = null; if (PS) { clearTimeout(PS.tm); if (PS.upH) document.removeEventListener('pointerup', PS.upH); } }

function psBuild() {
  var root = document.getElementById('ps-app');
  root.innerHTML =
    '<div class="ps-hud"><span id="ps-d"></span><b id="ps-m"></b><span id="ps-e"></span><span id="ps-r"></span></div>' +
    '<div class="ps-main">' +
    '<div class="ps-cust"><div class="ps-bub" id="ps-bub"></div><div class="ps-face" id="ps-face"></div>' +
    '<button class="btn btn-primary" id="ps-acc" onclick="psAccept()">주문 받기</button></div>' +
    '<div class="ps-bench"><canvas id="ps-cv" width="360" height="360"></canvas><div class="ps-msg" id="ps-msg"></div></div>' +
    '<div class="ps-oven"><div class="ps-bar"><u id="ps-bw"></u><i id="ps-bi"></i></div>' +
    '<button class="btn ps-act" onclick="psBake()">🔥 오븐에 넣기</button><button class="btn ps-act" onclick="psTake()">🧤 꺼내기</button>' +
    '<button class="btn ps-act" onclick="psUndo()">↩ 칼자국 지우기</button>' +
    '<button class="btn btn-primary ps-act" onclick="psServe()">📦 전달하기</button><button class="btn ps-act" onclick="psTrash()">🗑 버리기</button></div>' +
    '</div><div class="ps-tools" id="ps-tools"></div><div class="ps-over" id="ps-over"></div>' +
    '<button class="btn ps-fs" onclick="psLandscape()">⛶ 가로 전체화면</button>' +
    '<div class="ps-rot" id="ps-rot"><div style="font-size:54px">📱↻</div><b>폰을 가로로 돌려주세요!</b>' +
    '<button class="btn btn-primary" onclick="psLandscape()">가로로 전환</button>' +
    '<button class="btn" onclick="document.getElementById(\'ps-rot\').classList.add(\'skip\')">그냥 세로로 할래요</button></div>';
  PS.cv = document.getElementById('ps-cv'); PS.ctx = PS.cv.getContext('2d');
  PS.cells = 0;
  for (var i = 0; i < PS_G; i++) for (var j = 0; j < PS_G; j++) if (psIn(i, j)) PS.cells++;
  var cv = PS.cv;
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault(); var pt = psPt(e), p = PS.pizza; if (!p) return;
    if (PS.stage === 'make') {
      if (PS.tool === 'dough') psDough();
      else if (PS.tool === 'sauce' || PS.tool === 'cheese') { PS.paint = true; psPaint(pt); }
      else { PS.drag = pt; psPlace(pt); }
    } else if (PS.stage === 'cut') PS.cs = pt;
  });
  cv.addEventListener('pointermove', function (e) {
    var pt = psPt(e);
    if (PS.paint) psPaint(pt);
    else if (PS.drag && Math.hypot(pt.x - PS.drag.x, pt.y - PS.drag.y) > 24) { PS.drag = pt; psPlace(pt); }
  });
  PS.upH = function (e) {
    var pt = psPt(e);
    if (PS.cs && PS.stage === 'cut') psCut(PS.cs, pt);
    if (PS.dt && document.elementFromPoint(e.clientX, e.clientY) === PS.cv && PS.stage === 'make') { if (PS.dt === 'dough') psDough(); else if (PS_T[PS.dt]) psPlace(pt); }
    PS.paint = false; PS.drag = null; PS.cs = null; PS.dt = null;
  };
  document.addEventListener('pointerup', PS.upH);
  psTools(); psHud();
}
function psTools() {
  var h = '<button class="ps-tb" onpointerdown="psTool(\'dough\')">🫓<small>도우</small></button><button class="ps-tb" onpointerdown="psTool(\'sauce\')">🍅<small>소스</small></button><button class="ps-tb" onpointerdown="psTool(\'cheese\')">🧀<small>치즈</small></button>';
  Object.keys(PS_T).forEach(function (k) {
    var t = PS_T[k];
    h += t.d <= PS.day ? '<button class="ps-tb" id="ps-t-' + k + '" onpointerdown="psTool(\'' + k + '\')">' + t.e + '<small>' + t.n + '</small></button>' : '<button class="ps-tb lock" disabled>🔒<small>' + t.d + '일차</small></button>';
  });
  document.getElementById('ps-tools').innerHTML = h; psMark();
}
function psTool(k) {
  PS.tool = k; PS.dt = k; psMark();
  if (k === 'dough' && PS.stage === 'make') psDough();
}
function psMark() { var b = document.querySelectorAll('#ps-tools .ps-tb'); for (var i = 0; i < b.length; i++) b[i].classList.remove('on'); var m = { dough: 0, sauce: 1, cheese: 2 }; var el = m[PS.tool] != null ? b[m[PS.tool]] : document.getElementById('ps-t-' + PS.tool); if (el) el.classList.add('on'); }
function psHud() {
  document.getElementById('ps-d').textContent = '📅 ' + PS.day + '일차 · ' + Math.min(PS.idx + 1, psN()) + '/' + psN() + '번째 손님';
  document.getElementById('ps-m').textContent = '💰 ' + PS.money.toLocaleString() + '원';
  document.getElementById('ps-e').textContent = '오늘 매출 ' + (PS.earn + PS.tips).toLocaleString() + '원';
  document.getElementById('ps-r').textContent = '⭐ 평판 ' + PS.rep;
  var a = document.getElementById('ps-app'); if (a) a.setAttribute('data-deco', PS.up.deco);
}
function psMsg(t) { var m = document.getElementById('ps-msg'); if (m) { m.textContent = t; m.classList.remove('show'); void m.offsetWidth; m.classList.add('show'); } }
function psPt(e) { var r = PS.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * 360 / r.width - PS_C, y: (e.clientY - r.top) * 360 / r.height - PS_C }; }
function psIn(i, j) { var s = 2 * PS_R / PS_G, x = (i + .5) * s - PS_R, y = (j + .5) * s - PS_R; return Math.hypot(x, y) < PS_R - 8; }
function psSpend(n) { PS.money = Math.max(0, PS.money - n); PS.cost += n; psHud(); }

/* ---- 주문 ---- */
function psOrder() {
  var d = PS.day, tp = psUnlocked().slice().sort(function () { return Math.random() - .5; }), a = tp[0], b = tp[1] || tp[0], c = tp[2] || tp[0], N = function (k) { return PS_T[k].n; };
  var modes = ['cheese', 'one', 'one'];
  if (d >= 2) modes.push('two', 'nocheese'); if (d >= 3) modes.push('half', 'few', 'half'); if (d >= 5) modes.push('combo');
  var m = psPick(modes), o = { cheese: true, L: [], R: [], few: false, pieces: psPick([2, 4, 6].slice(0, d < 2 ? 1 : d < 4 ? 2 : 3)) }, t;
  if (m === 'cheese') t = psPick(['치즈만 들어간 피자 한 판 주세요!', '기본 치즈 피자로 부탁해요~']);
  else if (m === 'one') { o.L = o.R = [a]; t = psPick([N(a) + ' 피자 한 판 주세요!', N(a) + ' 피자 하나요~']); }
  else if (m === 'two') { o.L = o.R = [a, b]; t = psJ(N(a), '과', '와') + ' ' + N(b) + ' 올린 피자 주세요.'; }
  else if (m === 'nocheese') { o.cheese = false; o.L = o.R = [a]; t = '치즈 없이 만들어 주세요! ' + N(a) + '만 올려서요.'; }
  else if (m === 'few') { o.few = true; o.L = o.R = [a]; t = N(a) + ' 토핑은 조금만 올려주세요. 많으면 느끼해요.'; }
  else if (m === 'half') { if (a === b) { b = psPick(psUnlocked()); } if (a === b) { o.L = o.R = [a]; t = N(a) + ' 피자 주세요!'; } else { o.L = [a]; o.R = [b]; t = '왼쪽 반은 ' + N(a) + ', 오른쪽 반은 ' + N(b) + ' 반반으로 부탁해요!'; } }
  else { o.L = o.R = [a, b, c]; t = N(a) + ', ' + N(b) + ', ' + N(c) + ' 전부 올린 푸짐한 피자요!'; }
  o.text = t + ' 조각은 ' + o.pieces + '조각으로요.';
  o.price = 6000 + 1000 * new Set(o.L.concat(o.R)).size;
  return o;
}
function psNext() {
  if (PS.idx >= psN()) return psEndDay();
  var f = PS_FACES.slice(0, Math.min(PS_FACES.length, 3 + PS.day));
  PS.cust = { face: psPick(f), order: psOrder() }; PS.pizza = psNew(); PS.stage = 'wait'; PS.bk = 0;
  var face = document.getElementById('ps-face'); face.textContent = PS.cust.face; face.className = 'ps-face in';
  document.getElementById('ps-bub').textContent = PS.cust.order.text;
  document.getElementById('ps-acc').style.display = '';
  psMsg(PS.day === 1 && PS.idx === 0 ? '손님 말풍선을 읽고 [주문 받기]를 눌러요!' : '새 손님이 왔어요!'); psHud(); psSave();
}
function psAccept() { if (PS.stage !== 'wait') return; PS.stage = 'make'; document.getElementById('ps-acc').style.display = 'none'; PS.tool = 'dough'; psMark(); psMsg('🫓 도우를 눌러 시작! 소스·치즈는 쓱쓱 문지르고, 토핑은 끌어서 올려요'); }

/* ---- 만들기 ---- */
function psDough() { var p = PS.pizza; if (PS.stage !== 'make' || p.dough) return; p.dough = true; p.t0 = performance.now(); psSpend(500); psMsg('도우 완성! 이제 소스를 문질러요'); PS.tool = 'sauce'; psMark(); }
function psPaint(pt) {
  var p = PS.pizza; if (!p.dough || PS.stage !== 'make') return; var L = PS.tool === 'sauce' ? p.sc : p.ch, s = 2 * PS_R / PS_G;
  if (!p.paid[PS.tool]) { p.paid[PS.tool] = 1; psSpend(PS.tool === 'sauce' ? 300 : 400); }
  for (var i = 0; i < PS_G; i++) for (var j = 0; j < PS_G; j++) if (psIn(i, j) && Math.hypot((i + .5) * s - PS_R - pt.x, (j + .5) * s - PS_R - pt.y) < 22) L[i * PS_G + j] = 1;
}
function psCov(L) { var n = 0; for (var i = 0; i < PS_G * PS_G; i++) if (L[i]) n++; return n / PS.cells; }
function psPlace(pt) {
  var p = PS.pizza, k = PS.tool; if (!PS_T[k] || PS.stage !== 'make') return;
  if (!p.dough) return psMsg('먼저 도우를 올려주세요!');
  if (Math.hypot(pt.x, pt.y) > PS_R - 14 || p.tops.length > 70) return;
  p.tops.push({ k: k, x: pt.x, y: pt.y, a: Math.random() * 6.28, t0: performance.now() }); psSpend(PS_T[k].p / 4 | 0);
}
function psBake() {
  var p = PS.pizza; if (PS.stage !== 'make') return psMsg('만들기 단계에서만 오븐에 넣을 수 있어요');
  if (!p.dough) return psMsg('도우부터 올려주세요!');
  PS.stage = 'oven'; PS.bt = performance.now(); psMsg('🔥 굽는 중! 초록 구간에서 꺼내요');
}
function psTake() { if (PS.stage !== 'oven') return psMsg('오븐에 넣은 피자가 없어요'); PS.pizza.bk = PS.bk; PS.stage = 'cut'; psMsg('🔪 피자 위를 드래그해서 잘라요 (' + PS.cust.order.pieces + '조각 주문)'); }
function psCut(a, b) {
  var p = PS.pizza, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy); if (len < 120) return;
  var ang = Math.atan2(dy, dx), off = Math.abs(a.x * dy - a.y * dx) / len;
  if (PS.up.knife) off = 0; else if (off > 50) return psMsg('가운데를 지나게 그어주세요');
  ang = ((ang % Math.PI) + Math.PI) % Math.PI;
  for (var i = 0; i < p.cuts.length; i++) { var df = Math.abs(p.cuts[i] - ang); if (Math.min(df, Math.PI - df) < .3) return psMsg('다른 방향으로 그어주세요'); }
  if (p.cuts.length >= 3) return psMsg('최대 6조각까지예요');
  p.cuts.push(ang); psMsg('현재 ' + p.cuts.length * 2 + '조각');
}
function psUndo() { if (PS.stage === 'cut') { PS.pizza.cuts = []; psMsg('칼자국을 지웠어요'); } }
function psTrash() { if (PS.stage === 'make' || PS.stage === 'oven' || PS.stage === 'cut') { PS.pizza = psNew(); PS.stage = 'make'; PS.bk = 0; PS.tool = 'dough'; psMark(); psMsg('피자를 버리고 새로 시작해요 (재료비는 날아갔어요)'); } }

/* ---- 평가·전달 ---- */
function psGrade(o, p) {
  var sauce = Math.min(1, psCov(p.sc) / .8), cc = psCov(p.ch), cheese = o.cheese ? Math.min(1, cc / .8) : (cc < .1 ? 1 : .2), parts = [];
  ['L', 'R'].forEach(function (s) {
    var cnt = {}; p.tops.forEach(function (t) { if ((t.x < 0) === (s === 'L')) cnt[t.k] = (cnt[t.k] || 0) + 1; });
    var lo = o.few ? 2 : 5, hi = o.few ? 5 : 16;
    o[s].forEach(function (k) { var c = cnt[k] || 0; parts.push(c >= lo && c <= hi ? 1 : c > 0 ? .5 : 0); });
    Object.keys(cnt).forEach(function (k) { if (o[s].indexOf(k) < 0) parts.push(0); });
  });
  var top = parts.length ? parts.reduce(function (a, b) { return a + b; }, 0) / parts.length : 1;
  var cut = p.cuts.length * 2 === o.pieces ? 1 : (p.cuts.length ? .4 : .1);
  var w = PS_WIN[PS.up.oven], v = p.bk, bake = v >= w[0] && v <= w[1] ? 1 : (v >= w[0] - 12 && v <= w[1] + 10 ? .6 : .2);
  return { acc: sauce * .15 + cheese * .2 + top * .35 + cut * .15 + bake * .15, sauce: sauce, cheese: cheese, top: top, cut: cut, bake: bake };
}
function psServe() {
  if (PS.stage !== 'cut') return psMsg('오븐에서 꺼내 자른 뒤에 전달할 수 있어요');
  var o = PS.cust.order, g = psGrade(o, PS.pizza), acc = g.acc, star = acc >= .9 ? 3 : acc >= .7 ? 2 : acc >= .45 ? 1 : 0;
  var pay = Math.round(o.price * (.3 + .7 * acc) / 10) * 10, tip = [0, 0, Math.round(o.price * .1), Math.round(o.price * .3)][star];
  tip = Math.round(tip * (1 + PS.up.deco * .05)); PS.earn += pay; PS.tips += tip; PS.money += pay + tip; PS.rep = Math.max(0, Math.min(100, PS.rep + [-3, -1, 1, 2][star]));
  var why = g.top < .7 ? '토핑이 주문과 달라요' : g.cut < 1 ? '조각 수가 달라요' : g.bake < 1 ? '굽기가 아쉬워요' : g.sauce < .8 || g.cheese < .8 ? '소스·치즈가 부족해요' : '';
  var line = ['😠 이게 뭐예요… ', '😐 음, 그럭저럭이네요. ', '🙂 맛있어요! ', '😍 완벽해요! 팁 받으세요! '][star] + (star < 3 && why ? why + '. ' : '') + '+' + pay.toLocaleString() + (tip ? ' (팁 ' + tip.toLocaleString() + ')' : '') + '원';
  var face = document.getElementById('ps-face'); face.textContent = ['😠', '😐', '🙂', '😍'][star]; face.className = 'ps-face ' + (star >= 2 ? 'happy' : 'sad');
  document.getElementById('ps-bub').textContent = line; psMsg('정확도 ' + Math.round(acc * 100) + '%');
  PS.stage = 'busy'; PS.idx++; psHud(); psSave(); clearTimeout(PS.tm); PS.tm = setTimeout(psNext, 2300);
}

/* ---- 하루 정산·업그레이드 ---- */
function psEndDay() {
  PS.stage = 'over'; var rent = 1500 + PS.day * 100;
  var nu = Object.keys(PS_T).filter(function (k) { return PS_T[k].d === PS.day + 1; }).map(function (k) { return PS_T[k].e + PS_T[k].n; });
  PS.rent = rent; PS.nu = nu; psSaveEnd(); psShop();
}
function psSaveEnd() { PS.idx = psN(); psSave(); }
function psShop() {
  var avail = PS.money - PS.rent, sales = PS.earn + PS.tips, net = sales - PS.cost - PS.rent, h = '<div class="ps-card"><h3>🌙 ' + PS.day + '일차 정산</h3><table>' +
    '<tr><td>피자 매출</td><td>' + PS.earn.toLocaleString() + '원</td></tr><tr><td>팁</td><td>' + PS.tips.toLocaleString() + '원</td></tr>' +
    '<tr><td>재료비</td><td>-' + PS.cost.toLocaleString() + '원</td></tr><tr><td>가게 월세</td><td>-' + PS.rent.toLocaleString() + '원</td></tr>' +
    '<tr class="tot"><td>오늘 순이익</td><td>' + (net >= 0 ? '+' : '') + net.toLocaleString() + '원</td></tr></table>' +
    '<p>💰 월세 정산 후 ' + Math.max(0, avail).toLocaleString() + '원 · ⭐ 평판 ' + PS.rep + '</p>' + (PS.nu.length ? '<p class="new">내일 새 토핑 해금: ' + PS.nu.join(' ') + '</p>' : '') + '<div class="ps-shop">';
  Object.keys(PS_UP).forEach(function (k) {
    var u = PS_UP[k], lv = PS.up[k], max = lv >= u.p.length, pr = max ? 0 : u.p[lv];
    h += '<button class="btn" ' + (max || avail < pr ? 'disabled' : '') + ' onclick="psBuy(\'' + k + '\')"><b>' + u.n + ' Lv.' + lv + '</b><small>' + u.d + '</small><em>' + (max ? '최대' : pr.toLocaleString() + '원') + '</em></button>';
  });
  h += '</div><button class="btn btn-primary" onclick="psNextDay()">다음 날 시작 ▶</button></div>';
  var ov = document.getElementById('ps-over'); ov.innerHTML = h; ov.classList.add('on');
}
function psBuy(k) { var u = PS_UP[k], lv = PS.up[k]; if (lv >= u.p.length || PS.money - PS.rent < u.p[lv]) return; PS.money -= u.p[lv]; PS.up[k]++; psSave(); psHud(); psShop(); }
function psNextDay() {
  PS.money = Math.max(0, PS.money - (PS.rent || 0)); PS.day++; PS.idx = 0; PS.earn = PS.cost = PS.tips = 0; document.getElementById('ps-over').classList.remove('on');
  psTools(); psSave(); psNext();
}
function psResetSave() { if (!confirm('처음부터 다시 시작할까요?')) return; try { localStorage.removeItem(PS_KEY); } catch (e) {} startPizzaShop(); }

/* ---- 그리기 ---- */
function psTint(v) {
  var st = [[0, [243, 220, 174]], [40, [238, 194, 122]], [65, [217, 149, 60]], [85, [120, 70, 30]], [100, [35, 22, 12]]];
  for (var i = 1; i < st.length; i++) if (v <= st[i][0]) { var a = st[i - 1], b = st[i], f = (v - a[0]) / (b[0] - a[0]); return 'rgb(' + [0, 1, 2].map(function (j) { return Math.round(a[1][j] + (b[1][j] - a[1][j]) * f); }).join(',') + ')'; }
  return 'rgb(35,22,12)';
}
function psShape(c, k) {
  var C = function (x, y, r) { c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); };
  if (k === 'pep') { c.fillStyle = '#c62828'; C(0, 0, 13); c.fillStyle = '#9e1414'; C(-4, -3, 2); C(4, 2, 2); C(-1, 5, 2); }
  else if (k === 'mush') { c.fillStyle = '#e8dcc6'; c.beginPath(); c.ellipse(0, -2, 12, 9, 0, Math.PI, 0); c.fill(); c.fillRect(-4, -2, 8, 11); }
  else if (k === 'olive') { c.strokeStyle = '#263238'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 7, 0, 6.3); c.stroke(); }
  else if (k === 'onion') { c.strokeStyle = '#d9a7e0'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 11, 0, 4.2); c.stroke(); }
  else if (k === 'pepper') { c.strokeStyle = '#2e9a43'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 11, .3, 2.5); c.stroke(); }
  else if (k === 'bacon') { c.fillStyle = '#b5533c'; c.fillRect(-14, -4, 28, 8); c.fillStyle = '#f0b8a0'; c.fillRect(-14, -1, 28, 2); }
  else if (k === 'pine') { c.fillStyle = '#fdd835'; c.strokeStyle = '#e0a800'; c.lineWidth = 2; c.beginPath(); c.moveTo(-10, 8); c.lineTo(0, -10); c.lineTo(10, 8); c.closePath(); c.fill(); c.stroke(); }
}
function psFrame(now) {
  PS_RAF = requestAnimationFrame(psFrame);
  if (!PS || !PS.ctx) return;
  var c = PS.ctx, p = PS.pizza, win = PS_WIN[PS.up.oven];
  if (PS.stage === 'oven') PS.bk = Math.min(100, (now - PS.bt) / PS_DUR[PS.up.oven] * 100);
  var bi = document.getElementById('ps-bi'), bw = document.getElementById('ps-bw');
  if (bi) { bi.style.width = (PS.stage === 'oven' ? PS.bk : (p && p.bk) || 0) + '%'; bw.style.left = win[0] + '%'; bw.style.width = (win[1] - win[0]) + '%'; }
  c.clearRect(0, 0, 360, 360);
  c.fillStyle = '#e8c9a0'; c.fillRect(0, 0, 360, 360); c.fillStyle = 'rgba(120,70,30,.08)'; for (var y = 0; y < 360; y += 36) c.fillRect(0, y, 360, 2);
  if (!p) return;
  c.save(); c.translate(PS_C, PS_C);
  if (!p.dough) { c.setLineDash([8, 8]); c.strokeStyle = 'rgba(120,70,30,.4)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, PS_R, 0, 6.3); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(120,70,30,.6)'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText(PS.stage === 'make' ? '🫓 도우를 눌러 올려요' : '주문을 받아주세요', 0, 6); c.restore(); return; }
  var v = PS.stage === 'oven' ? PS.bk : p.bk, sc = Math.min(1, (now - p.t0) / 250), r = PS_R * (.6 + .4 * sc);
  c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.arc(4, 6, r, 0, 6.3); c.fill();
  c.fillStyle = psTint(v); c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.fill();
  c.fillStyle = 'rgba(255,240,200,.35)'; c.beginPath(); c.arc(0, 0, r - 12, 0, 6.3); c.fill();
  var s = 2 * PS_R / PS_G;
  for (var i = 0; i < PS_G; i++) for (var j = 0; j < PS_G; j++) { var k = i * PS_G + j, x = (i + .5) * s - PS_R, y2 = (j + .5) * s - PS_R;
    if (p.sc[k]) { c.fillStyle = 'rgba(200,50,30,.85)'; c.beginPath(); c.arc(x, y2, s * .75, 0, 6.3); c.fill(); }
    if (p.ch[k]) { c.fillStyle = 'rgba(255,215,94,.8)'; c.beginPath(); c.arc(x, y2, s * .6, 0, 6.3); c.fill(); } }
  p.tops.forEach(function (t) { var sz = Math.min(1, (now - t.t0) / 150); c.save(); c.translate(t.x, t.y); c.rotate(t.a); c.scale(sz, sz); psShape(c, t.k); c.restore(); });
  if (v > 88) { c.fillStyle = 'rgba(20,10,0,' + Math.min(.45, (v - 88) / 25) + ')'; c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.fill(); }
  c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 3;
  p.cuts.forEach(function (a) { c.beginPath(); c.moveTo(-Math.cos(a) * PS_R, -Math.sin(a) * PS_R); c.lineTo(Math.cos(a) * PS_R, Math.sin(a) * PS_R); c.stroke(); });
  c.restore();
}
