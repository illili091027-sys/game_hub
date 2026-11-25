/* ---------------- 피자가게 사장님 (혼자 하기 · 경영 시뮬레이션) v2 ----------------
   도우 → 소스(붓칠) → 치즈(슈레드) → 토핑 → 오븐(타이밍) → 자르기(실제 조각 분할) → 전달 → 정산
   진행은 localStorage(gamehub_pzshop_v1)에 저장돼요. */
var PS = null, PS_RAF = null, PS_R = 150, PS_C = 180, PS_KEY = 'gamehub_pzshop_v1';
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
var PS_STEPS = ['도우', '소스', '치즈', '토핑', '굽기', '자르기', '전달'], PS_SI = { dough: 0, sauce: 1, cheese: 2, top: 3, oven: 4, cut: 5 };
var PS_MAIN = { sauce: '다음: 치즈 ▶', cheese: '다음: 토핑 ▶', top: '🔥 오븐에 넣기', oven: '🧤 꺼내기', cut: '📦 전달하기' };
var PS_HINT = { dough: '🫓 도우 버튼을 눌러 시작!', sauce: '🥄 누른 채 쓱쓱 문질러 소스를 발라요 (가장자리는 비워둬요)', cheese: '🧀 드래그해서 치즈를 솔솔 뿌려요', top: '토핑을 눌러 고르고 클릭·드래그로 올려요', oven: '🔥 초록 구간에서 꺼내요! (피자를 클릭해도 꺼내져요)', cut: '🔪 피자 한쪽 끝에서 반대쪽 끝까지 쭉 드래그!' };

function psPick(a) { return a[Math.floor(Math.random() * a.length)]; }
function psJ(w, a, b) { var c = w.charCodeAt(w.length - 1) - 44032; return w + ((c >= 0 && c % 28) ? a : b); }
function psSave() { try { localStorage.setItem(PS_KEY, JSON.stringify({ day: PS.day, money: PS.money, rep: PS.rep, up: PS.up, idx: PS.idx, earn: PS.earn, cost: PS.cost, tips: PS.tips })); } catch (e) {} }
function psUnlocked() { return Object.keys(PS_T).filter(function (k) { return PS_T[k].d <= PS.day; }); }
function psN() { return 4 + Math.min(PS.day, 6) + Math.floor(PS.rep / 30); }
function psNew() {
  var cv = document.createElement('canvas'); cv.width = cv.height = 360;
  var wob = [], bl = [], i; for (i = 0; i < 72; i++) wob.push(Math.random() * 5 - 2.5);
  for (i = 0; i < 28; i++) bl.push({ a: Math.random() * 6.28, d: Math.random() * 8 - 14, s: 1 + Math.random() * 2.2 });
  return { dough: false, scv: cv, sctx: cv.getContext('2d'), sh: [], cg: {}, tops: [], paid: {}, bk: 0, wob: wob, bl: bl, bub: [], pieces: null, t0: 0 };
}
function psSnd(t) {
  try {
    if (!PS.ac) PS.ac = new (window.AudioContext || window.webkitAudioContext)();
    var ac = PS.ac, n = ac.currentTime, g = ac.createGain(); if (ac.state === 'suspended') ac.resume(); g.connect(ac.destination);
    if (t === 'chop') {
      var b = ac.createBuffer(1, 4800, 24000), d = b.getChannelData(0); for (var i = 0; i < 4800; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 900);
      var s = ac.createBufferSource(), f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800; s.buffer = b; s.connect(f); f.connect(g); g.gain.value = .3; s.start(n);
    } else {
      var o = ac.createOscillator(); o.connect(g); o.type = t === 'ding' ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(t === 'ding' ? 880 : 320, n); o.frequency.exponentialRampToValueAtTime(t === 'ding' ? 1320 : 140, n + (t === 'ding' ? .3 : .07));
      g.gain.setValueAtTime(t === 'ding' ? .12 : .1, n); g.gain.exponentialRampToValueAtTime(.001, n + (t === 'ding' ? .45 : .09)); o.start(n); o.stop(n + .5);
    }
  } catch (e) {}
}

function startPizzaShop() {
  stopPizzaShop();
  var s = {}; try { s = JSON.parse(localStorage.getItem(PS_KEY) || 'null') || {}; } catch (e) {}
  PS = { day: s.day || 1, money: s.money == null ? 5000 : s.money, rep: s.rep == null ? 30 : s.rep, up: s.up || { oven: 0, knife: 0, deco: 0 },
    idx: s.idx || 0, earn: s.earn || 0, cost: s.cost || 0, tips: s.tips || 0, tool: 'sauce', stage: 'none', bk: 0, guide: 4, m: null, wr: 0 };
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
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (e) {}
  cancelAnimationFrame(PS_RAF); PS_RAF = null; if (PS) { clearTimeout(PS.tm); clearTimeout(PS.tm2); if (PS.upH) document.removeEventListener('pointerup', PS.upH); }
}

function psBuild() {
  var root = document.getElementById('ps-app');
  root.innerHTML =
    '<div class="ps-hud"><span id="ps-d"></span><b id="ps-m"></b><span id="ps-e"></span><span id="ps-r"></span></div>' +
    '<div class="ps-main">' +
    '<div class="ps-cust"><div class="ps-bub" id="ps-bub"></div><div class="ps-face" id="ps-face"></div><button class="btn btn-primary" id="ps-acc" onclick="psAccept()">주문 받기</button></div>' +
    '<div class="ps-bench" id="ps-bench"><canvas id="ps-cv" width="360" height="360"></canvas><div class="ps-msg" id="ps-msg"></div></div>' +
    '<div class="ps-oven"><div class="ps-steps" id="ps-steps"></div>' +
    '<div class="ps-gauge" id="ps-gauge"><b class="z1" id="ps-z1">덜 익음</b><b class="z2" id="ps-z2">딱 좋아요</b><b class="z3" id="ps-z3">탐</b><i id="ps-gm"></i></div><div class="ps-gl" id="ps-gl"></div>' +
    '<div class="ps-prog" id="ps-prog"></div>' +
    '<button class="btn btn-primary ps-act" id="ps-mainb" onclick="psMain()">…</button>' +
    '<div class="ps-gd" id="ps-gd"><button onclick="psGuide(4)">4</button><button onclick="psGuide(6)">6</button><button onclick="psGuide(8)">8</button><small>조각 가이드</small></div>' +
    '<button class="btn ps-act" onclick="psUndo()">↩ 이 단계 지우기</button><button class="btn ps-act" onclick="psTrash()">🗑 버리고 새로</button></div>' +
    '</div><div class="ps-tools" id="ps-tools"></div><div class="ps-over" id="ps-over"></div>' +
    '<button class="btn ps-fs" onclick="psLandscape()">⛶ 가로 전체화면</button>' +
    '<div class="ps-rot" id="ps-rot"><div style="font-size:54px">📱↻</div><b>폰을 가로로 돌려주세요!</b>' +
    '<button class="btn btn-primary" onclick="psLandscape()">가로로 전환</button>' +
    '<button class="btn" onclick="document.getElementById(\'ps-rot\').classList.add(\'skip\')">그냥 세로로 할래요</button></div>';
  PS.cv = document.getElementById('ps-cv'); PS.ctx = PS.cv.getContext('2d'); PS.cc = 0;
  for (var i = 0; i < 26; i++) for (var j = 0; j < 26; j++) if (Math.hypot(i * 14 + 7 - PS_C, j * 14 + 7 - PS_C) < PS_R - 22) PS.cc++;
  var cv = PS.cv;
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    var pt = psPt(e), p = PS.pizza, s = PS.stage; PS.m = pt; if (!p) return;
    if (s === 'dough') psDough();
    else if (s === 'sauce') { PS.paint = 1; psSauce(pt, true); }
    else if (s === 'cheese') { PS.paint = 1; PS.ls = pt; psCheese(pt); }
    else if (s === 'top') { PS.drag = pt; psPlace(pt); }
    else if (s === 'oven') psTake();
    else if (s === 'cut') PS.cs = { a: pt, b: pt, d: 0 };
  });
  cv.addEventListener('pointermove', function (e) {
    var pt = psPt(e), s = PS.stage; PS.m = pt;
    if (PS.paint && s === 'sauce') psSauce(pt, false);
    else if (PS.paint && s === 'cheese') { if (Math.hypot(pt.x - PS.ls.x, pt.y - PS.ls.y) > 8) { PS.ls = pt; psCheese(pt); } }
    else if (PS.drag && s === 'top' && Math.hypot(pt.x - PS.drag.x, pt.y - PS.drag.y) > 24) { PS.drag = pt; psPlace(pt); }
    else if (PS.cs) { PS.cs.d += Math.hypot(pt.x - PS.cs.b.x, pt.y - PS.cs.b.y); PS.cs.b = pt; }
  });
  cv.addEventListener('pointerleave', function () { if (!PS.cs && !PS.paint) PS.m = null; });
  PS.upH = function (e) {
    var pt = psPt(e);
    if (PS.cs && PS.stage === 'cut') psCutDo(PS.cs.a, pt);
    if (PS.dt && PS.stage === 'top' && PS_T[PS.dt] && document.elementFromPoint(e.clientX, e.clientY) === PS.cv) psPlace(pt);
    if (PS.paint || PS.drag) psProg();
    PS.paint = 0; PS.drag = null; PS.cs = null; PS.dt = null;
  };
  document.addEventListener('pointerup', PS.upH);
  psTools(); psHud();
}
function psPt(e) { var r = PS.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * 360 / r.width - PS_C, y: (e.clientY - r.top) * 360 / r.height - PS_C }; }
function psAllowed(k) { var s = PS.stage; return (s === 'dough' && k === 'dough') || (s === 'sauce' && k === 'sauce') || (s === 'cheese' && k === 'cheese') || (s === 'top' && !!PS_T[k]); }
function psTools() {
  var h = '<button class="ps-tb" data-k="dough" onpointerdown="psTool(\'dough\')">🫓<small>도우</small></button><button class="ps-tb" data-k="sauce" onpointerdown="psTool(\'sauce\')">🍅<small>소스</small></button><button class="ps-tb" data-k="cheese" onpointerdown="psTool(\'cheese\')">🧀<small>치즈</small></button>';
  Object.keys(PS_T).forEach(function (k) {
    var t = PS_T[k];
    h += t.d <= PS.day ? '<button class="ps-tb" data-k="' + k + '" onpointerdown="psTool(\'' + k + '\')">' + t.e + '<small>' + t.n + '</small></button>' : '<button class="ps-tb lock" disabled>🔒<small>' + t.d + '일차</small></button>';
  });
  document.getElementById('ps-tools').innerHTML = h; psUI();
}
function psTool(k) {
  if (!psAllowed(k)) return psMsg('지금은 ' + (PS_STEPS[PS_SI[PS.stage]] || '대기') + ' 단계예요');
  PS.tool = k; PS.dt = k; psUI(); if (k === 'dough') psDough();
}
function psSet(s) {
  PS.stage = s; if (s === 'dough') PS.tool = 'dough'; else if (s === 'sauce') PS.tool = 'sauce'; else if (s === 'cheese') PS.tool = 'cheese'; else if (s === 'top') PS.tool = psUnlocked()[0];
  psUI(); if (PS_HINT[s]) psMsg(PS_HINT[s]); psProg();
}
function psUI() {
  var s = PS.stage, si = PS_SI[s], h = '', i, b = document.querySelectorAll('#ps-tools .ps-tb');
  for (i = 0; i < PS_STEPS.length; i++) h += '<span class="' + (si === i || (s === 'cut' && i === 6 && PS.pizza && PS.pizza.pieces && PS.pizza.pieces.length > 1) ? 'on' : (si > i ? 'done' : '')) + '">' + (si > i ? '✔' : (i + 1)) + ' ' + PS_STEPS[i] + '</span>';
  document.getElementById('ps-steps').innerHTML = h;
  for (i = 0; i < b.length; i++) { var k = b[i].getAttribute('data-k'); b[i].classList.toggle('on', k === PS.tool && psAllowed(k)); b[i].classList.toggle('dis', !psAllowed(k)); }
  var mb = document.getElementById('ps-mainb'); mb.textContent = PS_MAIN[s] || (s === 'dough' ? '🫓 도우부터!' : '…'); mb.disabled = !PS_MAIN[s];
  document.getElementById('ps-gd').style.display = s === 'cut' ? '' : 'none';
  var g = document.querySelectorAll('#ps-gd button'); for (i = 0; i < g.length; i++) g[i].classList.toggle('on', +g[i].textContent === PS.guide);
  var w = PS_WIN[PS.up.oven]; document.getElementById('ps-z1').style.width = w[0] + '%'; document.getElementById('ps-z2').style.width = (w[1] - w[0]) + '%'; document.getElementById('ps-z3').style.width = (100 - w[1]) + '%';
  document.getElementById('ps-gauge').classList.toggle('live', s === 'oven');
}
function psGuide(n) { PS.guide = n; psUI(); }
function psHud() {
  document.getElementById('ps-d').textContent = '📅 ' + PS.day + '일차 · ' + Math.min(PS.idx + 1, psN()) + '/' + psN() + '번째 손님';
  document.getElementById('ps-m').textContent = '💰 ' + PS.money.toLocaleString() + '원';
  document.getElementById('ps-e').textContent = '오늘 매출 ' + (PS.earn + PS.tips).toLocaleString() + '원';
  document.getElementById('ps-r').textContent = '⭐ 평판 ' + PS.rep;
  var a = document.getElementById('ps-app'); if (a) a.setAttribute('data-deco', PS.up.deco);
}
function psMsg(t) { var m = document.getElementById('ps-msg'); if (m) { m.textContent = t; m.classList.remove('show'); void m.offsetWidth; m.classList.add('show'); } }
function psProg() {
  var p = PS.pizza, s = PS.stage, t = '';
  if (p) { if (s === 'sauce') t = '🍅 소스 ' + Math.round(psSauceCov(p) * 100) + '% (50%↑)'; else if (s === 'cheese') t = '🧀 치즈 ' + Math.round(psCheeseCov(p) * 100) + '% (50%↑)'; else if (s === 'top') t = '토핑 ' + p.tops.length + '개'; else if (s === 'cut') t = '🔪 ' + (p.pieces ? p.pieces.length : 1) + '조각'; }
  document.getElementById('ps-prog').textContent = t;
}
function psSpend(n) { PS.money = Math.max(0, PS.money - n); PS.cost += n; psHud(); }

/* ---- 주문 ---- */
function psOrder() {
  var d = PS.day, tp = psUnlocked().slice().sort(function () { return Math.random() - .5; }), a = tp[0], b = tp[1] || tp[0], c = tp[2] || tp[0], N = function (k) { return PS_T[k].n; };
  var modes = ['cheese', 'one', 'one'];
  if (d >= 2) modes.push('two', 'nocheese'); if (d >= 3) modes.push('half', 'few', 'half'); if (d >= 5) modes.push('combo');
  var m = psPick(modes), o = { cheese: true, L: [], R: [], few: false, pieces: psPick([4, 6, 8].slice(0, d < 2 ? 1 : d < 4 ? 2 : 3)) }, t;
  if (m === 'cheese') t = psPick(['치즈만 들어간 피자 한 판 주세요!', '기본 치즈 피자로 부탁해요~']);
  else if (m === 'one') { o.L = o.R = [a]; t = psPick([N(a) + ' 피자 한 판 주세요!', N(a) + ' 피자 하나요~']); }
  else if (m === 'two') { o.L = o.R = [a, b]; t = psJ(N(a), '과', '와') + ' ' + N(b) + ' 올린 피자 주세요.'; }
  else if (m === 'nocheese') { o.cheese = false; o.L = o.R = [a]; t = '치즈 없이 만들어 주세요! ' + N(a) + '만 올려서요.'; }
  else if (m === 'few') { o.few = true; o.L = o.R = [a]; t = N(a) + ' 토핑은 조금만 올려주세요. 많으면 느끼해요.'; }
  else if (m === 'half') { if (a === b) { b = psPick(psUnlocked()); } if (a === b) { o.L = o.R = [a]; t = N(a) + ' 피자 주세요!'; } else { o.L = [a]; o.R = [b]; t = '왼쪽 반은 ' + N(a) + ', 오른쪽 반은 ' + N(b) + ' 반반으로 부탁해요!'; } }
  else { o.L = o.R = [a, b, c]; t = N(a) + ', ' + N(b) + ', ' + N(c) + ' 전부 올린 푸짐한 피자요!'; }
  o.text = t + ' ' + o.pieces + '조각으로 잘라주세요.';
  o.price = 6000 + 1000 * new Set(o.L.concat(o.R)).size;
  return o;
}
function psNext() {
  if (PS.idx >= psN()) return psEndDay();
  var f = PS_FACES.slice(0, Math.min(PS_FACES.length, 3 + PS.day));
  PS.cust = { face: psPick(f), order: psOrder() }; PS.pizza = psNew(); PS.bk = 0; PS.m = null; psSet('wait');
  var face = document.getElementById('ps-face'); face.textContent = PS.cust.face; face.className = 'ps-face in';
  document.getElementById('ps-bub').textContent = PS.cust.order.text;
  document.getElementById('ps-acc').style.display = '';
  psMsg(PS.day === 1 && PS.idx === 0 ? '손님 말풍선을 읽고 [주문 받기]를 눌러요!' : '새 손님이 왔어요!'); psHud(); psSave();
}
function psAccept() { if (PS.stage !== 'wait') return; document.getElementById('ps-acc').style.display = 'none'; psSet('dough'); }

/* ---- 만들기 ---- */
function psDough() {
  var p = PS.pizza; if (PS.stage !== 'dough' || p.dough) return;
  p.dough = true; p.t0 = performance.now(); psSpend(500); psSnd('pop'); psMsg('도우 완성! 이제 소스를 발라요');
  clearTimeout(PS.tm2); PS.tm2 = setTimeout(function () { if (PS.stage === 'dough' && PS.pizza === p) psSet('sauce'); }, 700);
}
function psSauce(pt, first) {
  var p = PS.pizza, c = p.sctx, K = PS_C;
  if (!p.paid.sc) { p.paid.sc = 1; psSpend(300); }
  c.save(); c.beginPath(); c.arc(K, K, PS_R - 18, 0, 6.3); c.clip(); c.lineCap = c.lineJoin = 'round'; c.lineWidth = 34; c.strokeStyle = c.fillStyle = '#c8321f'; c.shadowColor = '#c8321f'; c.shadowBlur = 10;
  if (first || !p.lm) { c.beginPath(); c.arc(K + pt.x, K + pt.y, 17, 0, 6.3); c.fill(); p.lm = pt; p.pm = pt; }
  else {
    var mid = { x: (p.lm.x + pt.x) / 2, y: (p.lm.y + pt.y) / 2 };
    c.beginPath(); c.moveTo(K + p.pm.x, K + p.pm.y); c.quadraticCurveTo(K + p.lm.x, K + p.lm.y, K + mid.x, K + mid.y); c.stroke();
    c.shadowBlur = 0; c.strokeStyle = 'rgba(255,130,90,.22)'; c.lineWidth = 5; var o = Math.random() * 14 - 7;
    c.beginPath(); c.moveTo(K + p.pm.x + o, K + p.pm.y + o); c.lineTo(K + mid.x + o, K + mid.y + o); c.stroke();
    p.pm = mid; p.lm = pt;
  }
  c.restore();
}
function psSauceCov(p) {
  var d; try { d = p.sctx.getImageData(0, 0, 360, 360).data; } catch (e) { return 0; }
  var n = 0, t = 0, x, y; for (y = -PS_R; y <= PS_R; y += 9) for (x = -PS_R; x <= PS_R; x += 9) { if (Math.hypot(x, y) > PS_R - 22) continue; t++; if (d[((y + PS_C) * 360 + (x + PS_C)) * 4 + 3] > 100) n++; }
  return t ? n / t : 0;
}
function psCheese(pt) {
  var p = PS.pizza; if (!p.paid.ch) { p.paid.ch = 1; psSpend(400); }
  for (var k = 0; k < 3; k++) {
    var a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * 22, x = pt.x + Math.cos(a) * d, y = pt.y + Math.sin(a) * d;
    if (Math.hypot(x, y) > PS_R - 20 || p.sh.length > 760) continue;
    var ci = ((x + PS_C) / 14 | 0) + ((y + PS_C) / 14 | 0) * 26; if ((p.cg[ci] || 0) >= 5) continue; p.cg[ci] = (p.cg[ci] || 0) + 1;
    p.sh.push({ x: x, y: y, a: Math.random() * 3.14, l: 9 + Math.random() * 8, c: Math.random(), t: performance.now() });
  }
}
function psCheeseCov(p) { return Math.min(1, Object.keys(p.cg).length / PS.cc); }
function psPlace(pt) {
  var p = PS.pizza, k = PS.tool; if (PS.stage !== 'top' || !PS_T[k]) return;
  if (Math.hypot(pt.x, pt.y) > PS_R - 14 || p.tops.length > 70) return;
  p.tops.push({ k: k, x: pt.x, y: pt.y, a: Math.random() * 6.28, t0: performance.now() }); psSpend(PS_T[k].p / 4 | 0); psSnd('pop');
}
function psMain() {
  var p = PS.pizza, s = PS.stage, o = PS.cust && PS.cust.order, v;
  if (s === 'sauce') { v = psSauceCov(p); if (v < .5) return psMsg('소스를 더 발라주세요 (' + Math.round(v * 100) + '%)'); psSet('cheese'); }
  else if (s === 'cheese') { v = psCheeseCov(p); if (o.cheese && v < .5) return psMsg('치즈를 더 뿌려주세요 (' + Math.round(v * 100) + '%)'); if (!o.cheese && v >= .1) return psMsg('치즈를 빼 달라고 했어요! [이 단계 지우기]로 치워요'); psSet('top'); }
  else if (s === 'top') { p.bk = 0; PS.bk = 0; PS.bt = performance.now(); PS.dinged = 0; psSet('oven'); }
  else if (s === 'oven') psTake();
  else if (s === 'cut') psServe();
}
function psTake() {
  if (PS.stage !== 'oven') return; var p = PS.pizza; p.bk = PS.bk;
  var cc = document.createElement('canvas'); cc.width = cc.height = 360; var c = cc.getContext('2d'); c.translate(PS_C, PS_C); psDrawPizza(c, p, p.bk, performance.now(), true); p.cache = cc;
  psResetCuts(); psSet('cut');
  var b = document.getElementById('ps-bench'); b.classList.remove('slide'); void b.offsetWidth; b.classList.add('slide'); psSnd('pop');
}
function psResetCuts() { var poly = [], i; for (i = 0; i < 72; i++) poly.push([Math.cos(i / 72 * 6.2832) * (PS_R + 4), Math.sin(i / 72 * 6.2832) * (PS_R + 4)]); PS.pizza.pieces = [{ poly: poly, ox: 0, oy: 0, tx: 0, ty: 0 }]; PS.flash = null; }
function psUndo() {
  var p = PS.pizza, s = PS.stage; if (!p) return;
  if (s === 'sauce') { p.sctx.clearRect(0, 0, 360, 360); p.lm = null; } else if (s === 'cheese') { p.sh = []; p.cg = {}; } else if (s === 'top') p.tops = []; else if (s === 'cut') psResetCuts(); else return;
  psMsg('지웠어요 (재료비는 돌아오지 않아요)'); psProg();
}
function psTrash() { if (PS_SI[PS.stage] != null && PS.stage !== 'wait') { PS.pizza = psNew(); PS.bk = 0; psSet('dough'); psMsg('피자를 버리고 새로 시작해요 (재료비는 날아갔어요)'); } }

/* ---- 자르기: 실제 다각형 분할 ---- */
function psArea(P) { var a = 0, n = P.length, i; for (i = 0; i < n; i++) { var j = (i + 1) % n; a += P[i][0] * P[j][1] - P[j][0] * P[i][1]; } return a / 2; }
function psCent(P) { var x = 0, y = 0; P.forEach(function (v) { x += v[0]; y += v[1]; }); return [x / P.length, y / P.length]; }
function psSplit(P, q, u) {
  var L = [], Rr = [], n = P.length, i, s = P.map(function (v) { return u.x * (v[1] - q.y) - u.y * (v[0] - q.x); });
  if (!s.some(function (x) { return x > .5; }) || !s.some(function (x) { return x < -.5; })) return null;
  for (i = 0; i < n; i++) {
    var j = (i + 1) % n, vi = P[i], vj = P[j], si = s[i], sj = s[j];
    if (si >= 0) L.push(vi); if (si <= 0) Rr.push(vi);
    if ((si > 0 && sj < 0) || (si < 0 && sj > 0)) { var t = si / (si - sj), ip = [vi[0] + (vj[0] - vi[0]) * t, vi[1] + (vj[1] - vi[1]) * t]; L.push(ip); Rr.push(ip); }
  }
  return L.length > 2 && Rr.length > 2 ? [L, Rr] : null;
}
function psCutDo(a, b) {
  var p = PS.pizza; if (!p.pieces) return;
  var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy); if (L < 25) return;
  var ux = dx / L, uy = dy / L, bq = a.x * ux + a.y * uy, cq = a.x * a.x + a.y * a.y - PS_R * PS_R, disc = bq * bq - cq;
  if (disc <= 0) return psMsg('피자 위를 지나가도록 그어주세요');
  var t1 = -bq - Math.sqrt(disc), t2 = -bq + Math.sqrt(disc), ch = t2 - t1;
  if (ch < 60) return psMsg('피자 위를 지나가도록 그어주세요');
  if (Math.min(L, t2) - Math.max(0, t1) < ch * .85) return psMsg('끝까지 쭉! 반대쪽 끝까지 그어주세요');
  var q = PS.up.knife ? { x: 0, y: 0 } : { x: a.x + t1 * ux, y: a.y + t1 * uy }, u = { x: ux, y: uy }, out = [], did = false;
  p.pieces.forEach(function (pc) {
    var r = psSplit(pc.poly, q, u);
    if (r && Math.abs(psArea(r[0])) > 40 && Math.abs(psArea(r[1])) > 40) { did = true; r.forEach(function (poly) { out.push({ poly: poly, ox: pc.ox, oy: pc.oy, tx: 0, ty: 0 }); }); } else out.push(pc);
  });
  if (!did) return psMsg('이미 잘린 선이에요');
  if (out.length > 16) return psMsg('너무 많이 잘랐어요!');
  out.forEach(function (pc) { var c = psCent(pc.poly), g = Math.hypot(c[0], c[1]) || 1, l = Math.min(16, g * .13); pc.tx = c[0] / g * l; pc.ty = c[1] / g * l; });
  p.pieces = out; PS.flash = { a: { x: q.x - u.x * PS_R, y: q.y - u.y * PS_R }, b: { x: q.x + u.x * PS_R, y: q.y + u.y * PS_R }, t: performance.now() };
  psSnd('chop'); psMsg(out.length + '조각!'); psProg(); psUI();
}

/* ---- 평가·전달 ---- */
function psGrade(o, p) {
  var sauce = Math.min(1, psSauceCov(p) / .8), cc = psCheeseCov(p), cheese = o.cheese ? Math.min(1, cc / .8) : (cc < .1 ? 1 : .2), parts = [];
  ['L', 'R'].forEach(function (s) {
    var cnt = {}; p.tops.forEach(function (t) { if ((t.x < 0) === (s === 'L')) cnt[t.k] = (cnt[t.k] || 0) + 1; });
    var lo = o.few ? 2 : 5, hi = o.few ? 5 : 16;
    o[s].forEach(function (k) { var c = cnt[k] || 0; parts.push(c >= lo && c <= hi ? 1 : c > 0 ? .5 : 0); });
    Object.keys(cnt).forEach(function (k) { if (o[s].indexOf(k) < 0) parts.push(0); });
  });
  var top = parts.length ? parts.reduce(function (a, b) { return a + b; }, 0) / parts.length : 1;
  var n = p.pieces.length, ar = p.pieces.map(function (x) { return Math.abs(psArea(x.poly)); }), mean = ar.reduce(function (a, b) { return a + b; }, 0) / n;
  var sd = Math.sqrt(ar.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / n), ev = 1 - Math.min(1, sd / mean * 1.2);
  var cut = n === o.pieces ? .6 + .4 * ev : Math.abs(n - o.pieces) <= 2 ? .35 : n < 2 ? .05 : .15;
  var w = PS_WIN[PS.up.oven], v = p.bk, bake = v >= w[0] && v <= w[1] ? 1 : (v >= w[0] - 12 && v <= w[1] + 10 ? .6 : .2);
  return { acc: sauce * .15 + cheese * .2 + top * .3 + cut * .2 + bake * .15, sauce: sauce, cheese: cheese, top: top, cut: cut, bake: bake };
}
function psServe() {
  if (PS.stage !== 'cut') return; if (PS.pizza.pieces.length < 2) return psMsg('먼저 피자를 잘라주세요!');
  var o = PS.cust.order, g = psGrade(o, PS.pizza), acc = g.acc, star = acc >= .9 ? 3 : acc >= .7 ? 2 : acc >= .45 ? 1 : 0;
  var pay = Math.round(o.price * (.3 + .7 * acc) / 10) * 10, tip = [0, 0, Math.round(o.price * .1), Math.round(o.price * .3)][star];
  tip = Math.round(tip * (1 + PS.up.deco * .05)); PS.earn += pay; PS.tips += tip; PS.money += pay + tip; PS.rep = Math.max(0, Math.min(100, PS.rep + [-3, -1, 1, 2][star]));
  var why = g.top < .7 ? '토핑이 주문과 달라요' : g.cut < .8 ? '조각 수·모양이 아쉬워요' : g.bake < 1 ? '굽기가 아쉬워요' : g.sauce < .8 || g.cheese < .8 ? '소스·치즈가 부족해요' : '';
  var line = ['😠 이게 뭐예요… ', '😐 음, 그럭저럭이네요. ', '🙂 맛있어요! ', '😍 완벽해요! 팁 받으세요! '][star] + (star < 3 && why ? why + '. ' : '') + '+' + pay.toLocaleString() + (tip ? ' (팁 ' + tip.toLocaleString() + ')' : '') + '원';
  var face = document.getElementById('ps-face'); face.textContent = ['😠', '😐', '🙂', '😍'][star]; face.className = 'ps-face ' + (star >= 2 ? 'happy' : 'sad');
  document.getElementById('ps-bub').textContent = line; psMsg('정확도 ' + Math.round(acc * 100) + '%'); psSnd(star >= 2 ? 'ding' : 'pop');
  PS.idx++; psSet('busy'); psHud(); psSave(); clearTimeout(PS.tm); PS.tm = setTimeout(psNext, 2300);
}

/* ---- 하루 정산·업그레이드 ---- */
function psEndDay() { PS.rent = 1500 + PS.day * 100; PS.nu = Object.keys(PS_T).filter(function (k) { return PS_T[k].d === PS.day + 1; }).map(function (k) { return PS_T[k].e + PS_T[k].n; }); PS.idx = psN(); psSave(); psSet('over'); psShop(); }
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
function psBuy(k) { var u = PS_UP[k], lv = PS.up[k]; if (lv >= u.p.length || PS.money - PS.rent < u.p[lv]) return; PS.money -= u.p[lv]; PS.up[k]++; psSave(); psHud(); psShop(); psUI(); }
function psNextDay() {
  PS.money = Math.max(0, PS.money - (PS.rent || 0)); PS.day++; PS.idx = 0; PS.earn = PS.cost = PS.tips = 0; document.getElementById('ps-over').classList.remove('on');
  psTools(); psSave(); psNext();
}
function psResetSave() { if (!confirm('처음부터 다시 시작할까요?')) return; try { localStorage.removeItem(PS_KEY); } catch (e) {} startPizzaShop(); }

/* ---- 그리기 ---- */
function psLerp(a, b, f) { return a + (b - a) * f; }
function psTint(v) {
  var st = [[0, [243, 220, 174]], [40, [238, 196, 124]], [65, [217, 152, 62]], [85, [128, 74, 32]], [100, [38, 24, 12]]];
  v = Math.max(0, Math.min(100, v));
  for (var i = 1; i < st.length; i++) if (v <= st[i][0]) { var a = st[i - 1], b = st[i], f = (v - a[0]) / (b[0] - a[0]); return 'rgb(' + [0, 1, 2].map(function (j) { return Math.round(psLerp(a[1][j], b[1][j], f)); }).join(',') + ')'; }
  return 'rgb(38,24,12)';
}
function psShape(c, k) {
  var C = function (x, y, r) { c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); };
  if (k === 'pep') { c.fillStyle = '#c62828'; C(0, 0, 13); c.fillStyle = '#a81c1c'; C(-4, -3, 2.2); C(4, 2, 2); C(-1, 5, 1.8); c.strokeStyle = '#8f1414'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 12, 0, 6.3); c.stroke(); }
  else if (k === 'mush') { c.fillStyle = '#e8dcc6'; c.beginPath(); c.ellipse(0, -2, 12, 9, 0, Math.PI, 0); c.fill(); c.fillRect(-4, -2, 8, 11); c.fillStyle = '#cdbd9f'; c.fillRect(-4, 6, 8, 3); }
  else if (k === 'olive') { c.strokeStyle = '#263238'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 7, 0, 6.3); c.stroke(); }
  else if (k === 'onion') { c.strokeStyle = '#d9a7e0'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 11, 0, 4.2); c.stroke(); }
  else if (k === 'pepper') { c.strokeStyle = '#2e9a43'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 11, .3, 2.5); c.stroke(); }
  else if (k === 'bacon') { c.fillStyle = '#b5533c'; c.fillRect(-14, -4, 28, 8); c.fillStyle = '#f0b8a0'; c.fillRect(-14, -1, 28, 2); }
  else if (k === 'pine') { c.fillStyle = '#fdd835'; c.strokeStyle = '#e0a800'; c.lineWidth = 2; c.beginPath(); c.moveTo(-10, 8); c.lineTo(0, -10); c.lineTo(10, 8); c.closePath(); c.fill(); c.stroke(); }
}
/* 피자 한 판 (중심이 원점). v=굽기(0~100) */
function psDrawPizza(c, p, v, now, st) {
  var e = st ? 1 : Math.min(1, (now - p.t0) / 300), r = PS_R * (.65 + .35 * e), i, w = p.wob, melt = Math.max(0, Math.min(1, (v - 28) / 45));
  c.save(); c.globalAlpha = Math.min(1, e * 1.5);
  c.beginPath(); for (i = 0; i < 72; i++) { var a = i / 72 * 6.2832, rr = r + w[i]; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath();
  c.fillStyle = psTint(v + 12); c.fill();
  c.beginPath(); c.arc(0, 0, r - 15, 0, 6.3); c.fillStyle = psTint(v - 6); c.fill();
  c.strokeStyle = 'rgba(255,246,214,.4)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r - 6, 3.4, 4.9); c.stroke();
  c.fillStyle = 'rgba(110,60,20,' + Math.min(.5, .12 + v / 220) + ')'; p.bl.forEach(function (b) { c.beginPath(); c.arc(Math.cos(b.a) * (r + b.d - 2), Math.sin(b.a) * (r + b.d - 2), b.s, 0, 6.3); c.fill(); });
  c.drawImage(p.scv, -PS_C, -PS_C);
  if (p.sh.length) {
    if (melt > .05) { c.fillStyle = 'rgba(255,208,100,' + (.2 * melt) + ')'; p.sh.forEach(function (s) { c.beginPath(); c.arc(s.x, s.y, 5 + 8 * melt, 0, 6.3); c.fill(); }); }
    c.lineCap = 'round'; c.shadowColor = 'rgba(120,70,0,.3)'; c.shadowBlur = 1.5;
    p.sh.forEach(function (s) {
      var f = st ? 1 : Math.min(1, (now - s.t) / 180), br = Math.max(0, (v - 70) / 30) * (.4 + s.c * .6);
      c.strokeStyle = 'rgb(' + [psLerp(psLerp(255, 243, melt), 185, br), psLerp(psLerp(240, 190, melt), 116, br), psLerp(psLerp(176, 70, melt), 30, br)].map(Math.round).join(',') + ')';
      c.lineWidth = 2.4 + melt * 3 + s.c; c.globalAlpha = Math.min(1, e * 1.5) * f * (.95 - melt * .12);
      var dy = (1 - f) * -10, ca = Math.cos(s.a) * s.l / 2, sa = Math.sin(s.a) * s.l / 2;
      c.beginPath(); c.moveTo(s.x - ca, s.y - sa + dy); c.quadraticCurveTo(s.x + sa * .3, s.y - ca * .3 + dy, s.x + ca, s.y + sa + dy); c.stroke();
    });
    c.shadowBlur = 0; c.globalAlpha = Math.min(1, e * 1.5);
  }
  p.tops.forEach(function (t) {
    var f = st ? 1 : Math.min(1, (now - t.t0) / 170); c.save(); c.translate(t.x, t.y); c.rotate(t.a); c.scale(1 + .5 * (1 - f), 1 + .5 * (1 - f)); c.globalAlpha *= f;
    c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 3; c.shadowOffsetY = 2; psShape(c, t.k); c.restore();
  });
  if (v > 88) { c.fillStyle = 'rgba(20,10,0,' + Math.min(.5, (v - 88) / 22) + ')'; c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.fill(); }
  if (p.bub.length) p.bub.forEach(function (b) { var f = (now - b.t) / 700; if (f > 1) return; c.fillStyle = 'rgba(255,244,190,' + (.7 * (1 - f)) + ')'; c.beginPath(); c.arc(b.x, b.y, 2 + 6 * f, 0, 6.3); c.fill(); });
  c.restore();
}
function psTable(c) { c.fillStyle = '#e8c9a0'; c.fillRect(0, 0, 360, 360); c.fillStyle = 'rgba(120,70,30,.08)'; for (var y = 0; y < 360; y += 36) c.fillRect(0, y, 360, 2); }
function psFrame(now) {
  PS_RAF = requestAnimationFrame(psFrame);
  if (!PS || !PS.ctx) return;
  var c = PS.ctx, p = PS.pizza, s = PS.stage, win = PS_WIN[PS.up.oven], gm = document.getElementById('ps-gm'), gl = document.getElementById('ps-gl');
  if (s === 'oven') {
    PS.bk = Math.min(100, (now - PS.bt) / PS_DUR[PS.up.oven] * 100); p.bk = PS.bk;
    if (!PS.dinged && PS.bk >= win[0]) { PS.dinged = 1; psSnd('ding'); }
    if (PS.bk > 38 && PS.bk < 92 && p.sh.length && Math.random() < .15) { var a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * (PS_R - 30); p.bub.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, t: now }); if (p.bub.length > 14) p.bub.shift(); }
    gl.textContent = PS.bk < win[0] ? '덜 익는 중…' : PS.bk <= win[1] ? '✨ 지금이에요! 꺼내요!' : '🔥 타고 있어요!!'; gl.className = 'ps-gl' + (PS.bk >= win[0] && PS.bk <= win[1] ? ' go' : PS.bk > win[1] ? ' bad' : '');
  } else if (s !== 'cut') { gl.textContent = ''; }
  var gv = s === 'oven' ? PS.bk : (p && s === 'cut' ? p.bk : 0); if (gm) gm.style.left = gv + '%';
  var cur = s === 'sauce' || s === 'cheese' || s === 'cut' ? 'none' : (s === 'top' || s === 'oven' ? 'pointer' : 'default'); if (PS.cv.style.cursor !== cur) PS.cv.style.cursor = cur;
  if (s === 'cut' && p && p.pieces) return psDrawCut(c, p, now);
  psTable(c); if (!p) return;
  if (s === 'oven') {
    var g = c.createRadialGradient(180, 180, 40, 180, 180, 260); g.addColorStop(0, '#ff9a3c'); g.addColorStop(.5, '#b8481a'); g.addColorStop(1, '#3a140a'); c.fillStyle = g; c.fillRect(0, 0, 360, 360);
    c.fillStyle = 'rgba(255,200,80,' + (.07 + .05 * Math.sin(now / 90)) + ')'; c.fillRect(0, 0, 360, 360); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; for (var y = 12; y < 360; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(360, y); c.stroke(); }
  }
  c.save(); c.translate(PS_C, PS_C);
  if (!p.dough) { c.setLineDash([8, 8]); c.strokeStyle = 'rgba(120,70,30,.4)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, PS_R, 0, 6.3); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(120,70,30,.6)'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText(s === 'dough' ? '🫓 도우를 눌러 올려요' : '주문을 받아주세요', 0, 6); c.restore(); return; }
  var v = s === 'oven' ? PS.bk : p.bk, sc = Math.min(1, (now - p.t0) / 300);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.arc(4, 7, PS_R * (.65 + .35 * sc), 0, 6.3); c.fill();
  psDrawPizza(c, p, v, now, false);
  if (s === 'oven' && v > 92) for (var i = 0; i < 4; i++) { c.fillStyle = 'rgba(80,80,80,.22)'; c.beginPath(); c.arc(Math.sin(now / 300 + i * 2) * 30 + (i - 2) * 25, 40 - ((now / 14 + i * 45) % 170), 14 + i * 3, 0, 6.3); c.fill(); }
  c.restore(); psCursor(c, now);
}
function psCursor(c, now) {
  var m = PS.m, s = PS.stage; if (!m) return; var x = PS_C + m.x, y = PS_C + m.y;
  if (s === 'sauce') { c.strokeStyle = '#7b4a22'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 36, y - 36); c.stroke(); c.fillStyle = '#d8dde0'; c.beginPath(); c.arc(x, y, 14, 0, 6.3); c.fill(); c.fillStyle = '#c8321f'; c.beginPath(); c.arc(x, y, 10, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(x - 3, y - 3, 3, 0, 6.3); c.fill(); }
  else if (s === 'cheese') { c.font = '30px sans-serif'; c.textAlign = 'center'; c.fillText('🧀', x + 14, y - 14); if (PS.paint) { c.fillStyle = '#ffe9a0'; for (var i = 0; i < 4; i++) c.fillRect(x + Math.sin(now / 60 + i * 2) * 10, y - 6 + ((now / 8 + i * 9) % 22), 2, 5); } }
}
function psDrawCut(c, p, now) {
  c.fillStyle = '#c89a62'; c.fillRect(0, 0, 360, 360); c.strokeStyle = 'rgba(120,70,30,.18)'; c.lineWidth = 2; for (var y = 10; y < 360; y += 22) { c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(90, y - 5, 250, y + 6, 360, y); c.stroke(); }
  var poly = function (pc, dx, dy) { c.beginPath(); pc.poly.forEach(function (v, i) { c[i ? 'lineTo' : 'moveTo'](PS_C + pc.ox + dx + v[0], PS_C + pc.oy + dy + v[1]); }); c.closePath(); };
  p.pieces.forEach(function (pc) { pc.ox += (pc.tx - pc.ox) * .2; pc.oy += (pc.ty - pc.oy) * .2; poly(pc, 4, 7); c.fillStyle = 'rgba(0,0,0,.2)'; c.fill(); });
  p.pieces.forEach(function (pc) { c.save(); poly(pc, 0, 0); c.clip(); c.drawImage(p.cache, pc.ox, pc.oy); c.restore(); poly(pc, 0, 0); c.strokeStyle = 'rgba(110,60,20,.45)'; c.lineWidth = 1.5; c.stroke(); });
  var n = PS.guide / 2; c.setLineDash([6, 8]); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2;
  for (var k = 0; k < n; k++) { var a = k * Math.PI / n; c.beginPath(); c.moveTo(PS_C - Math.cos(a) * (PS_R + 10), PS_C - Math.sin(a) * (PS_R + 10)); c.lineTo(PS_C + Math.cos(a) * (PS_R + 10), PS_C + Math.sin(a) * (PS_R + 10)); c.stroke(); }
  c.setLineDash([]);
  if (PS.flash) { var f = (now - PS.flash.t) / 350; if (f < 1) { c.strokeStyle = 'rgba(255,255,255,' + (1 - f) + ')'; c.lineWidth = 5 * (1 - f) + 1; c.beginPath(); c.moveTo(PS_C + PS.flash.a.x, PS_C + PS.flash.a.y); c.lineTo(PS_C + PS.flash.b.x, PS_C + PS.flash.b.y); c.stroke(); } }
  var cs = PS.cs, m = PS.m; if (cs) { c.setLineDash([4, 6]); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(PS_C + cs.a.x, PS_C + cs.a.y); c.lineTo(PS_C + cs.b.x, PS_C + cs.b.y); c.stroke(); c.setLineDash([]); PS.wr = cs.d / 10; m = cs.b; }
  if (m) {
    var x = PS_C + m.x, y = PS_C + m.y, ang = cs ? Math.atan2(cs.b.y - cs.a.y, cs.b.x - cs.a.x) : -.8 + Math.sin(now / 400) * .08;
    c.lineCap = 'round'; c.strokeStyle = '#7b4a22'; c.lineWidth = 9; c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(ang) * 42, y - Math.sin(ang) * 42); c.stroke();
    c.fillStyle = '#e6eaec'; c.strokeStyle = '#7d878d'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 13, 0, 6.3); c.fill(); c.stroke();
    c.beginPath(); for (var j = 0; j < 4; j++) { c.moveTo(x, y); c.lineTo(x + Math.cos(PS.wr + j * 1.57) * 11, y + Math.sin(PS.wr + j * 1.57) * 11); } c.stroke();
  }
}
