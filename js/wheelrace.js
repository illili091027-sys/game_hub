/* 🛞 바퀴 레이스 (온라인, 1~10명)
   내가 그린 모양이 진짜 바퀴가 되어 달려요. Matter.js(js/matter.min.js) 물리 엔진 사용.
   - 방장이 스테이지를 고르면 모두 같은 코스를 달려요. 각자 자기 바퀴를 그려서 기록(시간)으로 겨뤄요.
   - 상태 키: roomKey('wheelrace') = { stage }  (방장만 씀)
              roomKey('wr_' + 내id)  = { stage, prog, fin }  (각자 씀: 진행률 0~1, 완주 시간 ms)
   - 코인·자동차·바퀴색·스테이지 기록은 localStorage 'gamehub_wheelrace' 에 저장돼요. */

var WR_W = 900, WR_H = 420, WR = null, WR_RAF = null, WR_POLL = null, WR_PUB = null, WR_KEYH = null;
var WR_SAVE_KEY = 'gamehub_wheelrace';
var WR_CARS = [{ n: '빨강이', c: '#ef5350', p: 0 }, { n: '노랑 택시', c: '#ffca28', p: 60 }, { n: '파랑 번개', c: '#42a5f5', p: 150 }, { n: '핑크 몽글', c: '#f48fb1', p: 300 }];
var WR_COLORS = ['#455a64', '#ff7043', '#26a69a', '#ab47bc', '#ffd54f', '#5c6bc0'];

/* 코스 만들기 문법: f 평지 | s 경사(길이, 높이변화) | b 울퉁불퉁(길이, 크기) | st 계단(칸수, 폭, 높이)
   g 구덩이(폭) | w 벽(높이, 폭) | m 오르내리는 문 | t 좁은 통로(길이, 천장 높이) */
var WR_STAGES = [
  { name: '동네 한 바퀴', hint: '평지와 작은 언덕 · 동그란 바퀴가 안정적!', ops: [['f', 500], ['b', 300, 6], ['f', 200], ['s', 300, -50], ['f', 300], ['s', 300, 50], ['f', 400], ['b', 240, 7], ['f', 400]] },
  { name: '가파른 언덕', hint: '오르막과 내리막 · 바퀴가 클수록 힘차게!', ops: [['f', 400], ['s', 500, -150], ['f', 200], ['s', 400, 120], ['f', 200], ['s', 600, -200], ['f', 200], ['s', 500, 230], ['f', 500]] },
  { name: '계단 거리', hint: '계단을 넘으려면 큰 바퀴가 유리해요', ops: [['f', 400], ['st', 4, 130, 18], ['f', 200], ['st', 4, 150, 28], ['f', 200], ['s', 400, 150], ['f', 400]] },
  { name: '점프대와 구덩이', hint: '구덩이를 뛰어넘어요 · 🦘 점프 버튼도 써 봐요', ops: [['f', 400], ['s', 220, -50], ['g', 40], ['f', 300], ['s', 220, -50], ['g', 60], ['f', 300], ['s', 160, -60], ['g', 90], ['f', 500]] },
  { name: '울퉁불퉁 산길', hint: '덜컹덜컹 · 네모 바퀴도 의외로 갈 수 있어요', ops: [['f', 300], ['b', 600, 14], ['f', 150], ['w', 20, 60], ['b', 500, 16], ['f', 150], ['w', 26, 60], ['b', 400, 12], ['s', 300, -80], ['b', 400, 14], ['f', 400]] },
  { name: '무빙 게이트', hint: '오르내리는 문 타이밍을 봐요 · 좁은 통로엔 작은 바퀴', ops: [['f', 400], ['m'], ['f', 400], ['m'], ['f', 250], ['t', 550, 80], ['f', 100], ['b', 300, 8], ['m'], ['f', 400], ['s', 300, -80], ['f', 300], ['w', 20, 60], ['f', 500]] },
  { name: '끝판왕 코스', hint: '모든 지형이 한꺼번에! 바퀴를 바꿔 가며 도전', ops: [['f', 300], ['s', 400, -100], ['b', 400, 12], ['g', 70], ['f', 250], ['st', 3, 120, 22], ['f', 200], ['m'], ['f', 300], ['t', 450, 84], ['s', 400, 140], ['b', 400, 16], ['w', 22, 60], ['f', 300], ['s', 300, -80], ['g', 80], ['f', 500]] }
];

/* ---------- 저장 ---------- */
function wrSaveLoad() {
  var d = {};
  try { d = JSON.parse(localStorage.getItem(WR_SAVE_KEY) || '{}') || {}; } catch (e) {}
  d.coins = d.coins || 0; d.best = d.best || {}; d.owned = d.owned || [0]; d.car = d.car || 0; d.color = d.color || WR_COLORS[0];
  return d;
}
function wrSaveStore() { try { localStorage.setItem(WR_SAVE_KEY, JSON.stringify(WR.save)); } catch (e) {} }

/* ---------- 바퀴 도형 변환 ---------- */
/* 마우스/터치로 그린 점들(raw)을 닫힌 도형으로 바꿔요. 실패하면 문자열(안내 문구)을 돌려줘요. */
function wrMakeWheel(raw) {
  if (!raw || raw.length < 8) return '조금 더 길게 그려 주세요!';
  var i, n = raw.length, minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  raw.forEach(function (p) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); });
  if (Math.min(maxx - minx, maxy - miny) < 26) return '너무 작아요! 더 크게 그려 주세요.';
  var pts = raw.concat([raw[0]]), segLen = [], total = 0;      /* 끝점을 시작점에 이어서 자동으로 닫기 */
  for (i = 0; i < n; i++) { var l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); segLen.push(l); total += l; }
  var N = 30, out = [], step = total / N, acc = 0, k = 0;     /* 일정한 간격으로 30개 점 뽑기 */
  for (i = 0; i < N; i++) {
    var target = i * step;
    while (k < n - 1 && acc + segLen[k] < target) { acc += segLen[k]; k++; }
    var t = segLen[k] ? (target - acc) / segLen[k] : 0;
    out.push({ x: pts[k].x + (pts[k + 1].x - pts[k].x) * t, y: pts[k].y + (pts[k + 1].y - pts[k].y) * t });
  }
  var sm = out.map(function (p, j) { var a = out[(j + N - 1) % N], b = out[(j + 1) % N]; return { x: a.x * 0.2 + p.x * 0.6 + b.x * 0.2, y: a.y * 0.2 + p.y * 0.6 + b.y * 0.2 }; });
  var A = 0, cx = 0, cy = 0;                                    /* 면적 중심(무게중심) 구하기 */
  for (i = 0; i < N; i++) { var p1 = sm[i], p2 = sm[(i + 1) % N], cr = p1.x * p2.y - p2.x * p1.y; A += cr; cx += (p1.x + p2.x) * cr; cy += (p1.y + p2.y) * cr; }
  if (Math.abs(A) < 1) return '모양이 너무 납작해요!';
  cx /= 3 * A; cy /= 3 * A;
  var rel = sm.map(function (p) { return { x: p.x - cx, y: p.y - cy }; });
  var ext = 0, mn = 1e9;
  rel.forEach(function (p) { var d = Math.hypot(p.x, p.y); ext = Math.max(ext, d); mn = Math.min(mn, d); });
  var sc = Math.max(13, Math.min(46, ext * 0.4)) / ext;         /* 그린 크기가 곧 바퀴 크기 (반지름 13~46) */
  return { pts: rel.map(function (p) { return { x: +(p.x * sc).toFixed(2), y: +(p.y * sc).toFixed(2) }; }), R: +(ext * sc).toFixed(1), round: Math.round(mn / ext * 100) };
}
function wrCirclePts(R) { var o = []; for (var i = 0; i < 28; i++) { var a = i / 28 * Math.PI * 2; o.push({ x: +(Math.cos(a) * R).toFixed(2), y: +(Math.sin(a) * R).toFixed(2) }); } return o; }
function wrWheelInfo(pts) {
  var R = 0, mn = 1e9, area = 0, N = pts.length;
  pts.forEach(function (p, i) { var d = Math.hypot(p.x, p.y); R = Math.max(R, d); mn = Math.min(mn, d); var q = pts[(i + 1) % N]; area += Math.abs(p.x * q.y - q.x * p.y) / 2; });
  return { R: R, round: Math.round(mn / R * 100), mass: area };
}

/* ---------- 코스 ---------- */
function wrBuildTrack(def) {
  var x = 0, y = 0, segs = [], cur = [[-1500, 0], [0, 0]], gates = [], ceils = [], coins = [], i;
  function go(nx, ny) { x = nx; y = ny; cur.push([x, y]); }
  def.ops.forEach(function (o) {
    var t = o[0], base;
    if (t === 'f') go(x + o[1], y);
    else if (t === 's') go(x + o[1], y + o[2]);
    else if (t === 'b') { base = y; var n = Math.round(o[1] / 30); for (i = 1; i <= n; i++) go(x + 30, i === n ? base : base + o[2] * (((i * 37) % 7) - 3) / 3); }
    else if (t === 'st') { for (i = 0; i < o[1]; i++) { go(x, y - o[3]); go(x + o[2], y); y = y; } }
    else if (t === 'g') { segs.push(cur); x += o[1]; cur = [[x, y]]; }
    else if (t === 'w') { var ww = o[2] || 60; go(x, y - o[1]); go(x + ww, y - o[1]); go(x + ww, y); }
    else if (t === 'm') { gates.push({ x: x, y: y, ph: gates.length * 1.7 }); }
    else if (t === 't') { ceils.push({ x0: x, x1: x + o[1], y: y - o[2] }); }
  });
  go(x + 300, y); segs.push(cur);
  /* 일직선으로 이어진 점은 하나로 합쳐요 → 바퀴가 이음매에 걸려 덜컹대는 것을 막아요 */
  segs = segs.map(function (s) {
    var r = [s[0]];
    for (var j = 1; j < s.length - 1; j++) { var a = r[r.length - 1], b = s[j], c = s[j + 1]; if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1) r.push(b); }
    r.push(s[s.length - 1]); return r;
  });
  var finishX = x - 150, maxY = -1e9;
  segs.forEach(function (s) { s.forEach(function (p) { maxY = Math.max(maxY, p[1]); }); });
  var tr = { segs: segs, gates: gates, ceils: ceils, coins: coins, finishX: finishX, killY: maxY + 600 };
  for (var cx = 500; cx < finishX - 100; cx += 230) {
    var gy = wrGroundY(segs, cx), nearGate = gates.some(function (g) { return Math.abs(g.x - cx) < 80; });
    if (gy !== null && !nearGate) coins.push({ x: cx, y: gy - 80, got: false });
  }
  return tr;
}
function wrGroundY(segs, px) {
  var best = null;
  segs.forEach(function (s) { for (var j = 0; j < s.length - 1; j++) { var a = s[j], b = s[j + 1]; if (b[0] > a[0] && px >= a[0] && px <= b[0]) { var y = a[1] + (b[1] - a[1]) * (px - a[0]) / (b[0] - a[0]); if (best === null || y < best) best = y; } } });
  return best;
}

/* ---------- 물리 월드 ---------- */
function wrMakeWheelBody(pts, x, y, color) {
  var M = Matter, parts = [], N = pts.length;
  for (var i = 0; i < N; i++) {
    var p = pts[i], q = pts[(i + 1) % N];
    if (Math.abs(p.x * q.y - q.x * p.y) < 0.5) continue;        /* 면적 없는 삼각형은 버려요 */
    parts.push(M.Bodies.fromVertices(x + (p.x + q.x) / 3, y + (p.y + q.y) / 3, [[{ x: 0, y: 0 }, { x: p.x, y: p.y }, { x: q.x, y: q.y }]]));
  }
  var w = M.Body.create({ parts: parts, friction: 1, frictionStatic: 1.2, restitution: 0.05, frictionAir: 0.002 });
  w.parts.forEach(function (pt) { pt.friction = 1; pt.frictionStatic = 1.2; pt.restitution = 0.05; });
  M.Body.setDensity(w, 0.0013);
  return w;
}

function wrLoadStage(idx) {
  var M = Matter, def = WR_STAGES[idx];
  WR.stage = idx; WR.state = 'ready'; WR.t = 0; WR.got = 0; WR.flip = 0; WR.stuck = 0; WR.lastX = 0; WR.jumpCd = 0; WR.msg = '';
  WR.engine = M.Engine.create({ positionIterations: 10, velocityIterations: 8 });
  WR.engine.gravity.y = 1.25;
  var tr = WR.track = wrBuildTrack(def), world = WR.engine.world;
  tr.segs.forEach(function (s) {
    for (var j = 0; j < s.length - 1; j++) {
      var a = s[j], b = s[j + 1];
      if (b[0] - a[0] < 1) continue;
      var v = [{ x: a[0] - 1, y: a[1] }, { x: b[0] + 1, y: b[1] }, { x: b[0] + 1, y: b[1] + 90 }, { x: a[0] - 1, y: a[1] + 90 }];
      var cx = (v[0].x + v[1].x + v[2].x + v[3].x) / 4, cy = (v[0].y + v[1].y + v[2].y + v[3].y) / 4;
      var body = M.Bodies.fromVertices(cx, cy, [v], { isStatic: true, friction: 1, frictionStatic: 1.2, restitution: 0 });
      M.Composite.add(world, body);
    }
  });
  tr.gates.forEach(function (g) { g.body = M.Bodies.rectangle(g.x, g.y - 60, 30, 120, { isStatic: true, friction: 0.2 }); M.Composite.add(world, g.body); });
  tr.ceils.forEach(function (c) { c.body = M.Bodies.rectangle((c.x0 + c.x1) / 2, c.y - 100, c.x1 - c.x0, 200, { isStatic: true, friction: 0.2 }); M.Composite.add(world, c.body); });
  /* 자동차: 차체 + 지붕, 바퀴 2개를 핀으로 연결 (살짝 출렁이는 서스펜션) */
  var pts = WR.wheel.pts, R = WR.wheelInfo.R, sx = 120, sy = -R - 2, grp = M.Body.nextGroup(true);
  var base = M.Bodies.rectangle(sx, sy - 10, 84, 18, { chamfer: { radius: 6 }, collisionFilter: { group: grp } });
  var cab = M.Bodies.rectangle(sx - 8, sy - 27, 46, 16, { chamfer: { radius: 5 }, collisionFilter: { group: grp } });
  var car = M.Body.create({ parts: [base, cab], friction: 0.5, frictionAir: 0.004 });
  M.Body.setDensity(car, 0.0016);
  var wl = wrMakeWheelBody(pts, sx - 32, sy), wr = wrMakeWheelBody(pts, sx + 32, sy);
  [wl, wr].forEach(function (w) { w.collisionFilter.group = grp; w.parts.forEach(function (p) { p.collisionFilter.group = grp; }); });
  car.collisionFilter.group = grp;
  M.Composite.add(world, [car, wl, wr,
    M.Constraint.create({ bodyA: car, pointA: { x: wl.position.x - car.position.x, y: wl.position.y - car.position.y }, bodyB: wl, pointB: { x: 0, y: 0 }, length: 0, stiffness: 0.55, damping: 0.25 }),
    M.Constraint.create({ bodyA: car, pointA: { x: wr.position.x - car.position.x, y: wr.position.y - car.position.y }, bodyB: wr, pointB: { x: 0, y: 0 }, length: 0, stiffness: 0.55, damping: 0.25 })]);
  WR.offB = { x: base.position.x - car.position.x, y: base.position.y - car.position.y };
  WR.offC = { x: cab.position.x - car.position.x, y: cab.position.y - car.position.y };
  WR.car = car; WR.wl = wl; WR.wr = wr; WR.startX = sx;
  WR.cam = { x: sx - WR_W * 0.3, y: sy - WR_H * 0.62 };
  tr.coins.forEach(function (c) { c.got = false; });
}

/* 한 프레임(1/60초) 진행 */
function wrStep() {
  var M = Matter, W = WR;
  if (W.state === 'run') {
    W.t += 1000 / 60; W.jumpCd = Math.max(0, W.jumpCd - 1);
    [W.wl, W.wr].forEach(function (w) {                          /* 바퀴를 굴리는 힘: 바퀴가 무거울수록(큰 바퀴일수록) 천천히 힘을 받아요 */
      var maxW = 0.17;
      if (w.angularVelocity < maxW) w.torque += w.inertia * 1.9e-4 * Math.max(0, 1 - w.angularVelocity / maxW);
    });
    W.track.gates.forEach(function (g) { var s = (Math.sin(W.t / 1000 * 0.9 + g.ph) + 1) / 2; M.Body.setPosition(g.body, { x: g.x, y: g.y - 60 - s * 150 }); });
    var cp = W.car.position;
    W.track.coins.forEach(function (c) { if (!c.got && Math.hypot(c.x - cp.x, c.y - cp.y) < 40) { c.got = true; W.got++; } });
    if (Math.cos(W.car.angle) < -0.3) W.flip++; else W.flip = 0;
    if (Math.abs(cp.x - W.lastX) < 0.25) W.stuck++; else { W.stuck = 0; W.lastX = cp.x; }
    if (cp.x >= W.track.finishX) wrFinish();
    else if (cp.y > W.track.killY) wrFail('구덩이에 빠졌어요!');
    else if (W.flip > 70) wrFail('뒤집혔어요!');
    else if (W.stuck > 300) wrFail('걸려서 못 움직여요!');
  }
  M.Engine.update(W.engine, 1000 / 60);
  var tx = W.car.position.x - WR_W * 0.3 + Math.max(0, W.car.velocity.x) * 8, ty = W.car.position.y - WR_H * 0.62;
  W.cam.x += (tx - W.cam.x) * 0.1; W.cam.y += (ty - W.cam.y) * 0.08;
}

function wrProg() { return WR ? Math.max(0, Math.min(1, (WR.car.position.x - WR.startX) / (WR.track.finishX - WR.startX))) : 0; }

function wrFinish() {
  WR.state = 'done'; var ms = Math.round(WR.t), earn = (WR.stage + 1) * 10 + WR.got * 5, S = WR.save, key = String(WR.stage), nb = !S.best[key] || ms < S.best[key];
  if (nb) S.best[key] = ms;
  S.coins += earn; wrSaveStore(); wrPublish(true);
  WR.msg = '<div class="wr-ov-t">🏁 도착!</div><div>기록 <b>' + (ms / 1000).toFixed(2) + '초</b>' + (nb ? ' · 👑 새 최고 기록' : '') + '</div><div>코인 +' + earn + ' (모은 코인 ' + WR.got + '개)</div>' +
    '<div class="wr-ov-b"><button class="btn btn-primary" onclick="wrRetry()">↻ 바퀴 바꿔 다시</button>' + (myPlayerId === roomHostId && WR.stage < WR_STAGES.length - 1 ? '<button class="btn btn-ghost" onclick="wrHostStage(' + (WR.stage + 1) + ')">다음 스테이지 ▶</button>' : '') + '</div>';
  wrUiRefresh();
}
function wrFail(why) {
  if (WR.state !== 'run') return;
  WR.state = 'fail';
  WR.msg = '<div class="wr-ov-t">💥 ' + why + '</div><div>바퀴 모양을 바꿔서 다시 도전해요!</div><div class="wr-ov-b"><button class="btn btn-primary" onclick="wrRetry(true)">↻ 바로 재도전</button></div>';
  wrPublish();
}

/* ---------- 화면 조작 ---------- */
function wrRetry(go) { if (!WR) return; wrLoadStage(WR.stage); if (go) WR.state = 'run'; wrPublish(); wrUiRefresh(); }
function wrStart() { if (!WR) return; if (WR.state !== 'ready') wrLoadStage(WR.stage); WR.state = 'run'; wrUiRefresh(); }
function wrJump() {
  if (!WR || WR.state !== 'run' || WR.jumpCd > 0) return;
  WR.jumpCd = 70; Matter.Body.setVelocity(WR.car, { x: WR.car.velocity.x, y: Math.min(WR.car.velocity.y, 0) - 7 });
}
function wrSetWheel(w) {
  WR.wheel = w; WR.wheelInfo = wrWheelInfo(w.pts); WR.save.wheel = w.pts; wrSaveStore();
  wrLoadStage(WR.stage); wrUiRefresh(); wrPublish();
}
function wrDrawClear() { WR.raw = []; WR.drawErr = ''; }
function wrDefaultWheel() { wrSetWheel({ pts: wrCirclePts(26) }); WR.drawErr = ''; }
function wrHostStage(i) {
  if (myPlayerId !== roomHostId) return;
  DBset(roomKey('wheelrace'), { stage: i, at: Date.now() });
  if (WR.stage !== i) { wrLoadStage(i); wrPublish(); wrUiRefresh(); }
}
function wrPickCar(i) {
  var S = WR.save, c = WR_CARS[i];
  if (S.owned.indexOf(i) === -1) { if (S.coins < c.p) { WR.drawErr = '코인이 부족해요! (' + c.p + ' 필요)'; wrUiRefresh(); return; } S.coins -= c.p; S.owned.push(i); }
  S.car = i; wrSaveStore(); wrUiRefresh();
}
function wrPickColor(c) { WR.save.color = c; wrSaveStore(); wrUiRefresh(); }
function wrToggleShop() { WR.shop = !WR.shop; wrUiRefresh(); }

/* ---------- 온라인 동기화 ---------- */
function wrPublish(force) {
  if (!WR || playMode !== 'online') return;
  var t = Date.now(); if (!force && WR.lastPub && t - WR.lastPub < 450) return; WR.lastPub = t;
  DBset(roomKey('wr_' + myPlayerId), { stage: WR.stage, prog: WR.state === 'done' ? 1 : +wrProg().toFixed(3), fin: WR.state === 'done' ? Math.round(WR.t) : 0, c: WR_CARS[WR.save.car].c });
}
function wrPoll() {
  if (!WR) return;
  DBget(roomKey('wheelrace')).then(function (st) {
    if (!WR || !st || typeof st.stage !== 'number') return;
    if (st.stage !== WR.stage && st.stage >= 0 && st.stage < WR_STAGES.length) { wrLoadStage(st.stage); wrPublish(true); wrUiRefresh(); }
  });
  var pids = (roomPlayersList || []).map(function (p) { return p.id; });
  DBgetPrefix('wr_', pids).then(function (all) {
    if (!WR) return;
    var rows = (roomPlayersList || []).map(function (p) {
      var d = (p.id === myPlayerId) ? { stage: WR.stage, prog: WR.state === 'done' ? 1 : wrProg(), fin: WR.state === 'done' ? Math.round(WR.t) : 0, c: WR_CARS[WR.save.car].c } : all[p.id];
      var ok = d && d.stage === WR.stage;
      return { id: p.id, name: p.name, prog: ok ? d.prog || 0 : 0, fin: ok ? d.fin || 0 : 0, c: (d && d.c) || '#999' };
    });
    rows.sort(function (a, b) { if (a.fin && b.fin) return a.fin - b.fin; if (a.fin) return -1; if (b.fin) return 1; return b.prog - a.prog; });
    WR.rows = rows;
    renderRankBoard('wr-rank', rows.map(function (r) { return { name: r.name, isMe: r.id === myPlayerId, label: r.fin ? '🏁 ' + (r.fin / 1000).toFixed(2) + '초' : '🛞 ' + Math.round(r.prog * 100) + '%' }; }));
  });
}

/* ---------- 화면(DOM) ---------- */
function startWheelRaceGame() {
  stopWheelRaceGame();
  var save = wrSaveLoad();
  WR = { save: save, raw: [], drawErr: '', shop: false, rows: [], acc: 0, spin: 0, wheel: { pts: (save.wheel && save.wheel.length > 5) ? save.wheel : wrCirclePts(26) } };
  WR.wheelInfo = wrWheelInfo(WR.wheel.pts);
  document.getElementById('wr-root').innerHTML =
    '<div class="wr-bar"><span>🪙 <b id="wr-coins">0</b></span><span id="wr-stagename"></span><span>⏱ <b id="wr-time">0.00</b></span></div>' +
    '<div class="wr-track"><div class="wr-track-line"></div><div id="wr-dots"></div><span class="wr-flag">🏁</span></div>' +
    '<div class="wr-board"><canvas id="wr-canvas" class="wr-canvas"></canvas><div id="wr-ov" class="wr-ov" style="display:none"></div></div>' +
    '<div id="wr-stages" class="wr-stages"></div>' +
    '<div class="wr-pad">' +
      '<div class="wr-pad-draw"><canvas id="wr-draw" width="240" height="240" class="wr-drawcv"></canvas><div class="wr-pad-hint">✏️ 여기에 바퀴를 그려요</div></div>' +
      '<div class="wr-pad-side"><canvas id="wr-prev" width="120" height="120" class="wr-prevcv"></canvas><div id="wr-info" class="wr-info"></div>' +
        '<div class="wr-colors" id="wr-colors"></div></div></div>' +
    '<div id="wr-err" class="wr-err"></div>' +
    '<div class="wr-btns"><button class="btn btn-ghost" onclick="wrDrawClear();wrUiRefresh()">🗑 지우기</button><button class="btn btn-ghost" onclick="wrDefaultWheel()">⚪ 기본 원</button>' +
      '<button class="btn btn-primary" id="wr-go" onclick="wrStart()">🏁 출발!</button><button class="btn btn-ghost" onclick="wrRetry()">↻ 처음 위치</button>' +
      '<button class="btn btn-ghost" id="wr-jump" onclick="wrJump()">🦘 점프</button><button class="btn btn-ghost" onclick="wrToggleShop()">🎨 꾸미기</button></div>' +
    '<div id="wr-shop" class="wr-shop" style="display:none"></div>' +
    '<div class="wr-rank-wrap"><div class="wr-rank-title">🏆 이번 코스 순위</div><div id="wr-rank"></div></div>' +
    '<p class="wr-help">💡 바퀴를 그리면 바로 자동차에 달려요. 크기·모양에 따라 달리는 느낌이 완전히 달라요! (스페이스: 점프 · R: 재도전)</p>';
  var cv = document.getElementById('wr-canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = WR_W * dpr; cv.height = WR_H * dpr; WR.dpr = dpr;
  WR.ctx = cv.getContext('2d'); WR.dctx = document.getElementById('wr-draw').getContext('2d'); WR.pctx = document.getElementById('wr-prev').getContext('2d');
  wrSetupDraw();
  wrLoadStage(0);
  var starter = (myPlayerId === roomHostId) ? DBset(roomKey('wheelrace'), { stage: 0, at: Date.now() }) : Promise.resolve();
  starter.then(function () { wrPoll(); WR_POLL = setInterval(wrPoll, 800); });
  WR_PUB = setInterval(function () { if (WR && WR.state === 'run') wrPublish(); }, 500);
  WR_KEYH = function (e) {
    if (!WR || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if (e.code === 'Space') { e.preventDefault(); if (WR.state === 'ready') wrStart(); else wrJump(); }
    else if (e.key === 'r' || e.key === 'R') wrRetry(WR.state !== 'ready');
  };
  document.addEventListener('keydown', WR_KEYH);
  wrUiRefresh();
  var last = 0;
  (function loop(now) {
    WR_RAF = requestAnimationFrame(loop);
    if (!WR) return;
    var dt = Math.min(100, now - (last || now)); last = now; WR.acc += dt;
    var n = 0; while (WR.acc >= 1000 / 60 && n < 4) { wrStep(); WR.acc -= 1000 / 60; n++; }
    if (WR.acc > 100) WR.acc = 0;
    WR.spin += dt / 1000;
    wrDraw(); wrDrawPreview(); wrHudTick();
  })(0);
}
function stopWheelRaceGame() {
  if (WR_RAF) cancelAnimationFrame(WR_RAF); WR_RAF = null;
  clearInterval(WR_POLL); clearInterval(WR_PUB); WR_POLL = WR_PUB = null;
  if (WR_KEYH) document.removeEventListener('keydown', WR_KEYH); WR_KEYH = null;
  WR = null;
}

function wrSetupDraw() {
  var cv = document.getElementById('wr-draw'), drawing = false;
  function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * 240 / r.width, y: (e.clientY - r.top) * 240 / r.height }; }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} drawing = true; WR.raw = [pt(e)]; WR.drawErr = ''; });
  cv.addEventListener('pointermove', function (e) { if (drawing) { var p = pt(e), l = WR.raw[WR.raw.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 2) WR.raw.push(p); } });
  function up() {
    if (!drawing) return; drawing = false;
    var res = wrMakeWheel(WR.raw);
    if (typeof res === 'string') { WR.drawErr = res; WR.raw = []; wrUiRefresh(); }
    else { WR.raw = []; WR.drawErr = ''; wrSetWheel(res); }
  }
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', function () { drawing = false; WR.raw = []; });
}

function wrUiRefresh() {
  if (!WR) return;
  var S = WR.save, $ = function (id) { return document.getElementById(id); }, host = myPlayerId === roomHostId;
  $('wr-coins').textContent = S.coins;
  $('wr-stagename').textContent = (WR.stage + 1) + '. ' + WR_STAGES[WR.stage].name;
  $('wr-stages').innerHTML = WR_STAGES.map(function (s, i) {
    var b = S.best[String(i)];
    return '<button class="wr-chip' + (i === WR.stage ? ' on' : '') + '"' + (host ? ' onclick="wrHostStage(' + i + ')"' : ' disabled') + '>' + (i + 1) + (b ? '<small>' + (b / 1000).toFixed(1) + 's</small>' : '') + '</button>';
  }).join('') + '<div class="wr-hint">' + esc(WR_STAGES[WR.stage].hint) + (host ? '' : ' · 스테이지는 방장이 골라요') + '</div>';
  var inf = WR.wheelInfo;
  $('wr-info').innerHTML = '반지름 <b>' + inf.R.toFixed(0) + '</b><br>둥근 정도 <b>' + inf.round + '%</b><br>무게 <b>' + (inf.mass / 100).toFixed(0) + '</b>';
  $('wr-colors').innerHTML = WR_COLORS.map(function (c) { return '<button class="wr-cdot' + (c === S.color ? ' on' : '') + '" style="background:' + c + '" onclick="wrPickColor(\'' + c + '\')"></button>'; }).join('');
  $('wr-err').textContent = WR.drawErr || '';
  var sh = $('wr-shop'); sh.style.display = WR.shop ? 'flex' : 'none';
  if (WR.shop) sh.innerHTML = '<div class="wr-shop-t">🚗 자동차 (코인으로 잠금 해제)</div>' + WR_CARS.map(function (c, i) {
    var own = S.owned.indexOf(i) !== -1;
    return '<button class="wr-car' + (S.car === i ? ' on' : '') + '" onclick="wrPickCar(' + i + ')"><i style="background:' + c.c + '"></i>' + c.n + '<small>' + (S.car === i ? '사용 중' : own ? '장착' : '🪙 ' + c.p) + '</small></button>';
  }).join('');
  var ov = $('wr-ov');
  if (WR.msg && (WR.state === 'done' || WR.state === 'fail')) { ov.innerHTML = WR.msg; ov.style.display = 'flex'; } else ov.style.display = 'none';
  $('wr-go').disabled = WR.state === 'run';
}
function wrHudTick() {
  var t = document.getElementById('wr-time'); if (t) t.textContent = (WR.t / 1000).toFixed(2);
  var d = document.getElementById('wr-dots');
  if (d && WR.rows) d.innerHTML = WR.rows.map(function (r) { return '<span class="wr-dot' + (r.id === myPlayerId ? ' me' : '') + '" style="left:' + (r.fin ? 100 : r.prog * 100) + '%;background:' + r.c + '" title="' + esc(r.name) + '">' + esc((r.name || '?').slice(0, 1)) + '</span>'; }).join('');
}

/* ---------- 그리기 ---------- */
function wrPoly(ctx, pts) { ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath(); }
function wrDrawWheelAt(ctx, pts, color, angle) {
  ctx.save(); ctx.rotate(angle);
  wrPoly(ctx, pts); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#263238'; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fillStyle = '#eceff1'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(pts[0].x * 0.8, pts[0].y * 0.8); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}
function wrDrawPreview() {
  var c = WR.pctx, S = WR.save, inf = WR.wheelInfo;
  c.clearRect(0, 0, 120, 120); c.save(); c.translate(60, 60); var k = 52 / Math.max(inf.R, 20); c.scale(k, k);
  wrDrawWheelAt(c, WR.wheel.pts, S.color, WR.spin * 2.2); c.restore();
  var d = WR.dctx; d.clearRect(0, 0, 240, 240);
  d.strokeStyle = 'rgba(0,0,0,.07)'; d.lineWidth = 1; d.beginPath(); d.moveTo(120, 0); d.lineTo(120, 240); d.moveTo(0, 120); d.lineTo(240, 120); d.stroke();
  if (WR.raw.length > 1) { d.beginPath(); WR.raw.forEach(function (p, i) { if (i) d.lineTo(p.x, p.y); else d.moveTo(p.x, p.y); }); d.strokeStyle = '#ff7043'; d.lineWidth = 5; d.lineCap = 'round'; d.lineJoin = 'round'; d.stroke(); d.setLineDash([6, 6]); d.lineTo(WR.raw[0].x, WR.raw[0].y); d.lineWidth = 2; d.stroke(); d.setLineDash([]); }
  else { d.save(); d.translate(120, 120); d.globalAlpha = 0.25; var kk = 100 / Math.max(inf.R, 20); d.scale(kk, kk); wrPoly(d, WR.wheel.pts); d.fillStyle = S.color; d.fill(); d.restore(); }
}
function wrDraw() {
  var ctx = WR.ctx, W = WR, tr = W.track, cx = W.cam.x, cy = W.cam.y, i;
  ctx.setTransform(W.dpr, 0, 0, W.dpr, 0, 0);
  var g = ctx.createLinearGradient(0, 0, 0, WR_H); g.addColorStop(0, '#8fd3ff'); g.addColorStop(1, '#e8f7ff'); ctx.fillStyle = g; ctx.fillRect(0, 0, WR_W, WR_H);
  ctx.fillStyle = '#fff176'; ctx.beginPath(); ctx.arc(780, 70, 30, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  for (i = 0; i < 6; i++) { var bx = ((i * 330 - cx * 0.2) % 1980 + 1980) % 1980 - 150, by = 50 + (i * 47) % 90; ctx.beginPath(); ctx.arc(bx, by, 22, 0, 7); ctx.arc(bx + 26, by + 6, 28, 0, 7); ctx.arc(bx + 56, by, 20, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#b9e6a8'; ctx.beginPath(); ctx.moveTo(0, WR_H);
  for (var x = 0; x <= WR_W; x += 30) ctx.lineTo(x, 300 - cy * 0.1 + Math.sin((x + cx * 0.3) / 110) * 36 + Math.sin((x + cx * 0.3) / 47) * 10);
  ctx.lineTo(WR_W, WR_H); ctx.fill();
  ctx.save(); ctx.translate(-cx, -cy);
  /* 지형 */
  tr.segs.forEach(function (s) {
    if (s[s.length - 1][0] < cx - 50 || s[0][0] > cx + WR_W + 50) return;
    ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); for (var j = 1; j < s.length; j++) ctx.lineTo(s[j][0], s[j][1]);
    var last = s[s.length - 1]; ctx.lineTo(last[0], last[1] + 900); ctx.lineTo(s[0][0], s[0][1] + 900); ctx.closePath(); ctx.fillStyle = '#a9794f'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); for (j = 1; j < s.length; j++) ctx.lineTo(s[j][0], s[j][1]);
    ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#5fc45a'; ctx.stroke();
  });
  tr.ceils.forEach(function (c) { ctx.fillStyle = '#78909c'; ctx.fillRect(c.x0, c.y - 200, c.x1 - c.x0, 200); ctx.fillStyle = '#ffca28'; for (var xx = c.x0; xx < c.x1; xx += 40) ctx.fillRect(xx, c.y - 8, 20, 8); });
  tr.gates.forEach(function (gt) {
    var b = gt.body, p = b.position; ctx.fillStyle = '#ef5350'; ctx.fillRect(p.x - 15, p.y - 60, 30, 120);
    ctx.fillStyle = '#fff'; for (var yy = -60; yy < 60; yy += 24) ctx.fillRect(p.x - 15, p.y + yy, 30, 10);
  });
  /* 결승선 */
  var fx = tr.finishX, fy = wrGroundY(tr.segs, fx); if (fy !== null) { ctx.fillStyle = '#455a64'; ctx.fillRect(fx - 3, fy - 130, 6, 130); for (var r = 0; r < 4; r++) for (var q = 0; q < 4; q++) { ctx.fillStyle = (r + q) % 2 ? '#fff' : '#212121'; ctx.fillRect(fx + 3 + q * 14, fy - 130 + r * 14, 14, 14); } }
  /* 코인 */
  tr.coins.forEach(function (c) { if (c.got) return; var bob = Math.sin(W.spin * 4 + c.x) * 3; ctx.beginPath(); ctx.arc(c.x, c.y + bob, 11, 0, 7); ctx.fillStyle = '#ffd54f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#f9a825'; ctx.stroke(); ctx.fillStyle = '#f9a825'; ctx.fillRect(c.x - 2, c.y + bob - 5, 4, 10); });
  /* 자동차 */
  var car = W.car, S = W.save, cc = WR_CARS[S.car].c;
  ctx.save(); ctx.translate(car.position.x, car.position.y); ctx.rotate(car.angle);
  var ob = W.offB, oc = W.offC;
  ctx.lineWidth = 3; ctx.strokeStyle = '#263238'; ctx.fillStyle = cc;
  rr(ctx, ob.x - 42, ob.y - 9, 84, 18, 7); ctx.fill(); ctx.stroke();
  rr(ctx, oc.x - 23, oc.y - 8, 46, 16, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e1f5fe'; rr(ctx, oc.x - 18, oc.y - 5, 15, 10, 3); ctx.fill(); rr(ctx, oc.x + 1, oc.y - 5, 15, 10, 3); ctx.fill();
  ctx.fillStyle = '#fff59d'; ctx.beginPath(); ctx.arc(ob.x + 38, ob.y, 4, 0, 7); ctx.fill();
  ctx.restore();
  [W.wl, W.wr].forEach(function (w) { ctx.save(); ctx.translate(w.position.x, w.position.y); wrDrawWheelAt(ctx, W.wheel.pts, S.color, w.angle); ctx.restore(); });
  ctx.restore();
  /* 진행 바 */
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, 0, WR_W, 6); ctx.fillStyle = '#ff7043'; ctx.fillRect(0, 0, WR_W * wrProg(), 6);
  if (W.state === 'ready') { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('바퀴를 그리고 🏁 출발!을 눌러요', WR_W / 2, 60); }
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
