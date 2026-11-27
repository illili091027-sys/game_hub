/* 🛞 바퀴 레이스 (온라인, 1~10명)
   내가 그린 모양이 진짜 바퀴가 되어 달려요. Matter.js(js/matter.min.js) 물리 엔진 사용.
   - 방장이 스테이지를 고르면 모두 같은 코스를 달려요. 각자 자기 바퀴를 그려서 기록(시간)으로 겨뤄요.
   - 상태 키: roomKey('wheelrace') = { stage, round }  (방장만 씀. round 가 바뀌면 모두 동시에 3·2·1 출발)
              roomKey('wr_' + 내id)  = { stage, r, q, 차/바퀴 위치, 바퀴 모양, prog, fin }  (각자 0.2초마다 씀)
   - 친구들 차는 같은 코스 위에 반투명 '고스트'로 함께 달려요(서로 부딪히진 않아요).
   - 코인·자동차·바퀴색·스테이지 기록은 localStorage 'gamehub_wheelrace' 에 저장돼요. */

var WR_W = 900, WR_H = 420, WR = null, WR_RAF = null, WR_NET = null, WR_KEYH = null, WR_NET_N = 0;
var WR_SAVE_KEY = 'gamehub_wheelrace';
var WR_CARS = [{ n: '빨강이', c: '#ef5350', p: 0 }, { n: '노랑 택시', c: '#ffca28', p: 60 }, { n: '파랑 번개', c: '#42a5f5', p: 150 }, { n: '핑크 몽글', c: '#f48fb1', p: 300 }];
var WR_TAGS = ['#1e88e5', '#8e24aa', '#00897b', '#f4511e', '#d81b60', '#3949ab', '#6d4c41', '#43a047', '#00acc1', '#fb8c00'];
function wrTagColor(id) {
  if (/^bot\d/.test(id)) return ['#1e88e5', '#d81b60', '#fb8c00'][(+id.slice(3) - 1) % 3];
  var i = (roomPlayersList || []).map(function (p) { return p.id; }).indexOf(id); return WR_TAGS[(i < 0 ? 0 : i) % WR_TAGS.length]; }
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
/* 마우스/터치로 그린 선(raw)을 그대로 바퀴로 써요. 안을 채우지 않고, 열린 선이면 열린 선 그대로예요.
   실패하면 문자열(안내 문구)을 돌려줘요. 결과: { pts, closed } */
function wrMakeWheel(raw) {
  if (!raw || raw.length < 4) return '조금 더 길게 그려 주세요!';
  var i, n = raw.length, minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  raw.forEach(function (p) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); });
  var size = Math.max(maxx - minx, maxy - miny);
  if (size < 30) return '너무 작아요! 더 크게 그려 주세요.';
  /* 끝점이 시작점 바로 옆이면 닫힌 모양, 아니면 그린 그대로 열린 선 */
  var closed = Math.hypot(raw[n - 1].x - raw[0].x, raw[n - 1].y - raw[0].y) < Math.max(14, size * 0.12);
  var pts = closed ? raw.concat([raw[0]]) : raw.slice(), segLen = [], total = 0;
  for (i = 0; i < pts.length - 1; i++) { var l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); segLen.push(l); total += l; }
  if (total < 30) return '조금 더 길게 그려 주세요!';
  /* 선을 따라 일정한 간격으로 점 뽑기 (모양은 그대로 유지) */
  var N = Math.max(8, Math.min(48, Math.round(total / 7))), cnt = closed ? N : N + 1, step = total / N, out = [], acc = 0, k = 0;
  for (i = 0; i < cnt; i++) {
    var target = Math.min(total, i * step);
    while (k < segLen.length - 1 && acc + segLen[k] < target) { acc += segLen[k]; k++; }
    var t = segLen[k] ? Math.min(1, (target - acc) / segLen[k]) : 0;
    out.push({ x: pts[k].x + (pts[k + 1].x - pts[k].x) * t, y: pts[k].y + (pts[k + 1].y - pts[k].y) * t });
  }
  /* 선의 무게중심(길이 기준) = 바퀴 축 */
  var L = 0, cx = 0, cy = 0, M = out.length, segs = closed ? M : M - 1;
  for (i = 0; i < segs; i++) { var a = out[i], b = out[(i + 1) % M], ll = Math.hypot(b.x - a.x, b.y - a.y); L += ll; cx += (a.x + b.x) / 2 * ll; cy += (a.y + b.y) / 2 * ll; }
  cx /= L; cy /= L;
  var rel = out.map(function (p) { return { x: p.x - cx, y: p.y - cy }; }), ext = 0;
  rel.forEach(function (p) { ext = Math.max(ext, Math.hypot(p.x, p.y)); });
  if (ext < 1) return '모양을 다시 그려 주세요!';
  var sc = Math.max(13, Math.min(46, ext * 0.4)) / ext;         /* 그린 크기가 곧 바퀴 크기 (반지름 13~46) */
  return { pts: rel.map(function (p) { return { x: +(p.x * sc).toFixed(2), y: +(p.y * sc).toFixed(2) }; }), closed: closed };
}
function wrCirclePts(R) { var o = []; for (var i = 0; i < 28; i++) { var a = i / 28 * Math.PI * 2; o.push({ x: +(Math.cos(a) * R).toFixed(2), y: +(Math.sin(a) * R).toFixed(2) }); } return o; }
function wrWheelInfo(w) {
  var pts = w.pts, R = 0, mn = 1e9, len = 0, N = pts.length;
  pts.forEach(function (p, i) { var d = Math.hypot(p.x, p.y); R = Math.max(R, d); mn = Math.min(mn, d); if (w.closed || i < N - 1) { var q = pts[(i + 1) % N]; len += Math.hypot(q.x - p.x, q.y - p.y); } });
  return { R: R, round: Math.round(mn / R * 100), len: len, closed: !!w.closed };
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
  go(x + 500, y); go(x, y - 400); segs.push(cur);   /* 결승선 뒤 평지 + 끝 벽 */
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
var WR_LINE = 6;   /* 바퀴 선 두께 */
function wrMakeWheelBody(w, x, y) {
  var M = Matter, parts = [], pts = w.pts, N = pts.length, segs = w.closed ? N : N - 1;
  for (var i = 0; i < segs; i++) {
    var p = pts[i], q = pts[(i + 1) % N], l = Math.hypot(q.x - p.x, q.y - p.y);
    if (l < 0.5) continue;
    parts.push(M.Bodies.rectangle(x + (p.x + q.x) / 2, y + (p.y + q.y) / 2, l + WR_LINE * 0.6, WR_LINE, { angle: Math.atan2(q.y - p.y, q.x - p.x), chamfer: { radius: WR_LINE / 2 - 0.5 } }));
  }
  var b = M.Body.create({ parts: parts, friction: 1, frictionStatic: 1.2, restitution: 0.05, frictionAir: 0.002 });
  b.parts.forEach(function (pt) { pt.friction = 1; pt.frictionStatic = 1.2; pt.restitution = 0.05; });
  var R = wrWheelInfo(w).R;
  M.Body.setMass(b, 0.0013 * Math.PI * R * R * 0.85);         /* 큰 바퀴일수록 무거워요 */
  /* 선 모양 그대로의 회전 관성 (축에서 먼 선일수록 무겁게 돌아요) */
  var r2 = 0; pts.forEach(function (p) { r2 += p.x * p.x + p.y * p.y; }); r2 /= N;
  M.Body.setInertia(b, b.mass * Math.max(r2, R * R * 0.3));
  return b;
}

/* 자동차에 바퀴를 (다시) 달아요. 달리는 도중에도 멈추지 않고 바로 바뀌어요.
   reset = { x, y(지면 높이) } 를 주면 그 자리에 똑바로 다시 세워요. */
function wrAttachWheels(reset, rc) {
  var M = Matter, W = rc || WR, world = WR.engine.world, car = W.car, newR = W.wheelInfo.R, av = 0;
  if (W.wl) { av = W.wl.angularVelocity; M.Composite.remove(world, [W.cl, W.cr, W.wl, W.wr]); }
  if (reset) {
    M.Body.setAngle(car, 0); M.Body.setAngularVelocity(car, 0); M.Body.setVelocity(car, { x: 0, y: 0 });
    M.Body.setPosition(car, { x: reset.x, y: reset.y - newR - 4 - W.anc[0].y });
    av = 0;
  } else if (W.curR && newR > W.curR) {
    M.Body.setPosition(car, { x: car.position.x, y: car.position.y - (newR - W.curR) - 3 });
  }
  var ca = Math.cos(car.angle), sa = Math.sin(car.angle), made = W.anc.map(function (a) {
    var off = { x: a.x * ca - a.y * sa, y: a.x * sa + a.y * ca };
    var wb = wrMakeWheelBody(W.wheel, car.position.x + off.x, car.position.y + off.y);
    wrCarFilter(wb);
    M.Body.setVelocity(wb, { x: car.velocity.x, y: car.velocity.y }); M.Body.setAngularVelocity(wb, av);
    var con = M.Constraint.create({ bodyA: car, pointA: off, bodyB: wb, pointB: { x: 0, y: 0 }, length: 0, stiffness: 0.55, damping: 0.25 });
    return { b: wb, c: con };
  });
  W.wl = made[0].b; W.wr = made[1].b; W.cl = made[0].c; W.cr = made[1].c; W.curR = newR;
  M.Composite.add(world, [W.wl, W.wr, W.cl, W.cr]);
}

/* 떨어지거나 뒤집히면 멈추지 않고 x 근처 땅 위에 다시 세워요 */
function wrRespawn(x, why, rc) {
  var tr = WR.track, gy = null, xx = Math.max(WR.startX, x), R = rc || WR;
  while (xx > WR.startX && (gy = wrGroundY(tr.segs, xx)) === null) xx -= 20;
  if (gy === null) { xx = WR.startX; gy = wrGroundY(tr.segs, xx) || 0; }
  wrAttachWheels({ x: xx, y: gy }, R);
  R.flip = 0; R.stuck = 0; R.safeY = gy;
  if (!rc) { WR.toast = why; WR.toastT = 110; }
}
/* 자동차끼리는 부딪히지 않고 땅·장애물에만 닿아요 (모든 차: category 2, mask 1) */
function wrCarFilter(b) { [b].concat(b.parts).forEach(function (p) { p.collisionFilter.group = 0; p.collisionFilter.category = 0x0002; p.collisionFilter.mask = 0x0001; }); }
/* 차체 만들기 (나 · 봇 공용) */
function wrMakeCarBody(sx, sy) {
  var M = Matter;
  var base = M.Bodies.rectangle(sx, sy - 10, 84, 18, { chamfer: { radius: 6 } });
  var cab = M.Bodies.rectangle(sx - 8, sy - 27, 46, 16, { chamfer: { radius: 5 } });
  var car = M.Body.create({ parts: [base, cab], friction: 0.5, frictionAir: 0.004 });
  M.Body.setDensity(car, 0.0016); wrCarFilter(car);
  return { car: car, base: base, cab: cab };
}

/* ---------- 🤖 봇 (Scribble Rider처럼 지형을 보고 바퀴를 바꿔 그려요) ---------- */
var WR_BOT_DEF = [
  { name: '🤖 번개봇', c: '#42a5f5', wc: '#1565c0', pref: 'circle', react: 10, miss: 0.08, maxW: 0.165 },
  { name: '🤖 몽글봇', c: '#f48fb1', wc: '#ad1457', pref: 'hex', react: 22, miss: 0.18, maxW: 0.158 },
  { name: '🤖 씽씽봇', c: '#ffca28', wc: '#ef6c00', pref: 'oval', react: 34, miss: 0.28, maxW: 0.152 }
];
function wrPolyPts(n, R, sx, sy, rot) { var o = []; for (var i = 0; i < n; i++) { var a = (rot || 0) + i / n * Math.PI * 2; o.push({ x: +(Math.cos(a) * R * (sx || 1)).toFixed(2), y: +(Math.sin(a) * R * (sy || 1)).toFixed(2) }); } return o; }
function wrBotWheel(kind) {
  if (kind === 'small') return { pts: wrPolyPts(20, 14), closed: true };
  if (kind === 'big') return { pts: wrPolyPts(28, 40), closed: true };
  if (kind === 'hex') return { pts: wrPolyPts(6, 27), closed: true };
  if (kind === 'oval') return { pts: wrPolyPts(24, 30, 1, 0.72), closed: true };
  if (kind === 'tri') return { pts: wrPolyPts(3, 32, 1, 1, -Math.PI / 2), closed: true };
  if (kind === 'arc') return { pts: wrPolyPts(18, 30).slice(0, 13), closed: false };
  return { pts: wrPolyPts(28, 26), closed: true };
}
function wrBotSetWheel(b, kind) {
  if (b.kind === kind) return;
  b.kind = kind; b.wheel = wrBotWheel(kind); b.wheelInfo = wrWheelInfo(b.wheel); b.cool = 50;
  wrAttachWheels(null, b);
}
/* 앞쪽 지형을 보고 원하는 바퀴 고르기 */
function wrBotThink(b) {
  var tr = WR.track, x0 = b.car.position.x, g0 = wrGroundY(tr.segs, x0), want = b.pref, i;
  var low = tr.ceils.some(function (c) { return c.x1 > x0 - 40 && c.x0 < x0 + 260; });
  if (low) want = 'small';
  else {
    var rise = 0, gap = false;
    for (i = 40; i <= 280; i += 20) { var g = wrGroundY(tr.segs, x0 + i); if (g === null) gap = true; else if (g0 !== null) rise = Math.max(rise, g0 - g); }
    if (gap || rise > 26 || tr.gates.some(function (gt) { return gt.x > x0 && gt.x < x0 + 220; })) want = 'big';
  }
  if (Math.random() < b.miss) want = ['circle', 'hex', 'oval', 'tri', 'big'][Math.floor(Math.random() * 5)];   /* 가끔 실수도 해요 */
  return want;
}
function wrMakeBots(list) {
  WR.bots = [];
  if (myPlayerId !== roomHostId) return;                          /* 봇은 방장 화면에서 움직이고, 친구들은 고스트로 봐요 */
  (list || []).forEach(function (bi, i) {
    var d = WR_BOT_DEF[i % WR_BOT_DEF.length], R = 26, sx = WR.startX, sy = -R - 2, cb = wrMakeCarBody(sx, sy);
    var b = { id: bi.id, name: bi.name, c: d.c, wc: d.wc, pref: d.pref, react: d.react, miss: d.miss, maxW: d.maxW, car: cb.car, wl: null, curR: 0,
      anc: WR.anc, kind: '', think: d.react, cool: 0, safeY: 0, flip: 0, stuck: 0, lastX: sx, fin: 0 };
    Matter.Composite.add(WR.engine.world, b.car);
    b.kind = d.pref; b.wheel = wrBotWheel(d.pref); b.wheelInfo = wrWheelInfo(b.wheel);
    wrAttachWheels({ x: sx, y: wrGroundY(WR.track.segs, sx) || 0 }, b);
    WR.bots.push(b);
  });
}
function wrBotStep(b) {
  var cp = b.car.position;
  if (b.fin) { [b.car, b.wl, b.wr].forEach(function (x) { Matter.Body.setVelocity(x, { x: x.velocity.x * 0.95, y: x.velocity.y }); Matter.Body.setAngularVelocity(x, x.angularVelocity * 0.93); }); return; }
  wrDrive(b);
  if (b.cool > 0) b.cool--;
  if (--b.think <= 0) { b.think = b.react + Math.floor(Math.random() * 12); var w = wrBotThink(b); if (b.cool <= 0) wrBotSetWheel(b, w); }
  var gy = wrGroundY(WR.track.segs, cp.x);
  if (gy !== null && cp.y < gy + 5) b.safeY = gy;
  if (Math.cos(b.car.angle) < -0.3) b.flip++; else b.flip = 0;
  if (Math.abs(cp.x - b.lastX) < 0.25) b.stuck++; else { b.stuck = 0; b.lastX = cp.x; }
  if (cp.x >= WR.track.finishX) b.fin = Math.max(1, Math.round(WR.rt));
  else if (cp.y > b.safeY + 320 || cp.y > WR.track.killY) wrRespawn(cp.x - 160, '', b);
  else if (b.flip > 60) wrRespawn(cp.x, '', b);
  else if (b.stuck > 80) { b.stuck = 0; b.cool = 0; wrBotSetWheel(b, ['big', 'tri', 'hex', 'oval', 'small', 'circle'][Math.floor(Math.random() * 6)]); }
}
/* 자동으로 앞으로! 바퀴가 무거울수록(큰 바퀴일수록) 천천히 힘을 받아요 */
function wrDrive(rc) {
  [rc.wl, rc.wr].forEach(function (w) {
    var maxW = rc.maxW || 0.17;
    if (w.angularVelocity < maxW) w.torque += w.inertia * 1.9e-4 * Math.max(0, 1 - w.angularVelocity / maxW);
  });
}
function wrBotProg(b) { return b.fin ? 1 : Math.max(0, Math.min(1, (b.car.position.x - WR.startX) / (WR.track.finishX - WR.startX))); }

function wrLoadStage(idx) {
  var M = Matter, def = WR_STAGES[idx];
  WR.stage = idx; WR.state = WR.round ? 'count' : 'wait'; WR.cd = 180; WR.ghosts = {}; WR.finRank = 0; WR.goT = 0; WR.toast = ''; WR.toastT = 0; WR.wl = null; WR.curR = 0; WR.t = 0; WR.got = 0; WR.flip = 0; WR.stuck = 0; WR.lastX = 0; WR.jumpCd = 0; WR.msg = '';
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
  var R = WR.wheelInfo.R, sx = 120, sy = -R - 2, cb = wrMakeCarBody(sx, sy), car = cb.car, base = cb.base, cab = cb.cab;
  M.Composite.add(world, car);
  WR.car = car; WR.startX = sx;
  WR.anc = [{ x: sx - 32 - car.position.x, y: sy - car.position.y }, { x: sx + 32 - car.position.x, y: sy - car.position.y }];
  WR.offB = { x: base.position.x - car.position.x, y: base.position.y - car.position.y };
  WR.offC = { x: cab.position.x - car.position.x, y: cab.position.y - car.position.y };
  wrAttachWheels();
  WR.safeY = 0; WR.lastX = sx; WR.rt = 0;
  wrMakeBots(WR.botList);
  WR.cam = { x: sx - WR_W * 0.3, y: sy - WR_H * 0.62 };
  tr.coins.forEach(function (c) { c.got = false; });
}

/* 한 프레임(1/60초) 진행 */
function wrStep() {
  var M = Matter, W = WR;
  if (W.toastT > 0) W.toastT--;
  if (W.goT > 0) W.goT--;
  if (W.state === 'count') { if (--W.cd <= 0) { W.state = 'run'; W.goT = 45; W.lastX = W.car.position.x; } }
  if (W.state === 'run' || W.state === 'done') { W.rt += 1000 / 60; (W.bots || []).forEach(wrBotStep); }
  if (W.state === 'run') {
    W.t += 1000 / 60; W.jumpCd = Math.max(0, W.jumpCd - 1);
    wrDrive(W);
    var cp = W.car.position;
    W.track.coins.forEach(function (c) { if (!c.got && Math.hypot(c.x - cp.x, c.y - cp.y) < 40) { c.got = true; W.got++; } });
    var gy = wrGroundY(W.track.segs, cp.x);
    if (gy !== null && cp.y < gy + 5) W.safeY = gy;
    if (Math.cos(W.car.angle) < -0.3) W.flip++; else W.flip = 0;
    if (Math.abs(cp.x - W.lastX) < 0.25) W.stuck++; else { W.stuck = 0; W.lastX = cp.x; }
    if (cp.x >= W.track.finishX) wrFinish();
    else if (cp.y > W.safeY + 320 || cp.y > W.track.killY) wrRespawn(cp.x - 160, '구덩이에 빠졌어요! 조금 뒤에서 계속 가요');
    else if (W.flip > 60) wrRespawn(cp.x, '뒤집혀서 다시 세웠어요!');
    else if (W.stuck > 150) { W.toast = '걸렸어요! 다른 바퀴를 그려 봐요 ✏️'; W.toastT = 20; }
  }
  if (W.state === 'done') [W.car, W.wl, W.wr].forEach(function (b) { Matter.Body.setVelocity(b, { x: b.velocity.x * 0.95, y: b.velocity.y }); Matter.Body.setAngularVelocity(b, b.angularVelocity * 0.93); });
  W.track.gates.forEach(function (g) { var s = (Math.sin(W.t / 1000 * 0.9 + g.ph) + 1) / 2; M.Body.setPosition(g.body, { x: g.x, y: g.y - 60 - s * 150 }); });
  M.Engine.update(W.engine, 1000 / 60);
  var fx = W.car.position.x, fy = W.car.position.y, fv = Math.max(0, W.car.velocity.x);
  if (W.state === 'done') {                                       /* 도착하면 아직 달리는 친구를 따라가며 구경해요 */
    var best = null, now = performance.now();
    Object.keys(W.ghosts).forEach(function (id) { var g = W.ghosts[id]; if (g.fin) return; var ps = wrGhostPose(g, now); if (ps && (!best || ps.x > best.x)) best = ps; });
    (W.bots || []).forEach(function (b) { if (!b.fin && (!best || b.car.position.x > best.x)) best = { x: b.car.position.x, y: b.car.position.y }; });
    if (best) { fx = best.x; fy = best.y; fv = 4; }
  }
  var tx = fx - WR_W * 0.3 + fv * 8, ty = fy - WR_H * 0.62;
  W.cam.x += (tx - W.cam.x) * 0.1; W.cam.y += (ty - W.cam.y) * 0.08;
}

function wrProg() { return WR ? Math.max(0, Math.min(1, (WR.car.position.x - WR.startX) / (WR.track.finishX - WR.startX))) : 0; }

function wrFinish() {
  WR.state = 'done'; var ms = Math.round(WR.t), S = WR.save, key = String(WR.stage), nb = !S.best[key] || ms < S.best[key];
  var ahead = 0, total = 1;
  Object.keys(WR.ghosts).forEach(function (id) { total++; var g = WR.ghosts[id]; if (g.fin && g.fin < ms) ahead++; });
  (WR.bots || []).forEach(function (b) { total++; if (b.fin && b.fin < ms) ahead++; });
  WR.finRank = ahead + 1; WR.finMs = ms; WR.finNew = nb;
  WR.earn = (WR.stage + 1) * 10 + WR.got * 5 + (total > 1 ? (total - WR.finRank) * 10 : 0);
  if (nb) S.best[key] = ms;
  S.coins += WR.earn; wrSaveStore(); wrPublish(true);
  wrUiRefresh();
}
function wrDoneHtml() {
  var host = myPlayerId === roomHostId, medal = ['🥇', '🥈', '🥉'][WR.finRank - 1] || '🏁';
  var list = (WR.rows || []).map(function (r, i) {
    return '<div class="wr-res' + (r.id === myPlayerId ? ' me' : '') + '"><span>' + (i + 1) + '등</span><i style="background:' + r.c + '"></i><b>' + esc(r.name || '?') + '</b><em>' + (r.fin ? (r.fin / 1000).toFixed(2) + '초' : '달리는 중 ' + Math.round(r.prog * 100) + '%') + '</em></div>';
  }).join('');
  return '<div class="wr-ov-card"><div class="wr-ov-t">' + medal + ' ' + WR.finRank + '등으로 도착!</div>' +
    '<div class="wr-ov-s">기록 <b>' + (WR.finMs / 1000).toFixed(2) + '초</b>' + (WR.finNew ? ' · 👑 내 최고 기록' : '') + ' · 코인 +' + WR.earn + '</div>' +
    '<div class="wr-res-list">' + list + '</div>' +
    '<div class="wr-ov-b">' + (host ? '<button class="btn btn-primary" onclick="wrRetry()">🔁 한 판 더</button>' + (WR.stage < WR_STAGES.length - 1 ? '<button class="btn btn-ghost" onclick="wrHostStage(' + (WR.stage + 1) + ')">다음 코스 ▶</button>' : '') : '<span class="wr-ov-wait">방장이 다음 판을 시작하면 바로 출발해요</span>') + '</div></div>';
}

/* ---------- 화면 조작 ---------- */
/* 새 레이스(방장만): round 를 올리면 모두 동시에 3·2·1 출발해요 */
function wrNewRace(stage) {
  if (!WR || myPlayerId !== roomHostId) return;
  WR.round = (WR.round || 0) + 1;
  var n = WR.save.bots === false ? 0 : Math.max(0, 4 - (roomPlayersList || []).length);   /* 모자란 자리는 봇으로 채워 4대가 같이 달려요 */
  WR.botList = []; for (var i = 0; i < n; i++) WR.botList.push({ id: 'bot' + (i + 1), name: WR_BOT_DEF[i].name });
  DBset(roomKey('wheelrace'), { stage: stage, round: WR.round, bots: WR.botList, at: Date.now() });
  wrLoadStage(stage); wrPublish(true); wrUiRefresh();
}
function wrRetry() { if (WR) wrNewRace(WR.stage); }
function wrToggleBots() { if (!WR || myPlayerId !== roomHostId) return; WR.save.bots = WR.save.bots === false; wrSaveStore(); wrNewRace(WR.stage); }
function wrJump() {
  if (!WR || WR.state !== 'run' || WR.jumpCd > 0) return;
  WR.jumpCd = 70; Matter.Body.setVelocity(WR.car, { x: WR.car.velocity.x, y: Math.min(WR.car.velocity.y, 0) - 7 });
}
function wrSetWheel(w) {
  WR.wheel = { pts: w.pts, closed: !!w.closed }; WR.wheelInfo = wrWheelInfo(WR.wheel); WR.save.wheel2 = WR.wheel; wrSaveStore();
  if (WR.car) wrAttachWheels();                                 /* 멈추지 않고 바로 교체 */
  wrUiRefresh();
}
function wrDrawClear() { WR.raw = []; WR.drawErr = ''; }
function wrDefaultWheel() { wrSetWheel({ pts: wrCirclePts(26), closed: true }); WR.drawErr = ''; }
function wrHostStage(i) { wrNewRace(i); }
function wrPickCar(i) {
  var S = WR.save, c = WR_CARS[i];
  if (S.owned.indexOf(i) === -1) { if (S.coins < c.p) { WR.drawErr = '코인이 부족해요! (' + c.p + ' 필요)'; wrUiRefresh(); return; } S.coins -= c.p; S.owned.push(i); }
  S.car = i; wrSaveStore(); wrUiRefresh();
}
function wrPickColor(c) { WR.save.color = c; wrSaveStore(); wrUiRefresh(); }
function wrToggleShop() { WR.shop = !WR.shop; wrUiRefresh(); }

/* ---------- 온라인 동기화 ---------- */
function wrR(v) { return Math.round(v * 10) / 10; }
function wrPayload(rc, done, fin, c, wc) {
  var wp = []; rc.wheel.pts.forEach(function (p) { wp.push(wrR(p.x), wrR(p.y)); });
  var car = rc.car;
  return {
    stage: WR.stage, r: WR.round || 0, q: (rc.seq = (rc.seq || 0) + 1),
    x: wrR(car.position.x), y: wrR(car.position.y), a: +car.angle.toFixed(3),
    w1: [wrR(rc.wl.position.x), wrR(rc.wl.position.y), +rc.wl.angle.toFixed(2)], w2: [wrR(rc.wr.position.x), wrR(rc.wr.position.y), +rc.wr.angle.toFixed(2)],
    wp: wp, wcl: rc.wheel.closed ? 1 : 0, wc: wc, c: c,
    prog: done ? 1 : +((car.position.x - WR.startX) / (WR.track.finishX - WR.startX)).toFixed(3), fin: done ? fin : 0
  };
}
function wrPublish() {
  if (!WR || !WR.car) return;
  var done = WR.state === 'done';
  DBset(roomKey('wr_' + myPlayerId), wrPayload(WR, done, WR.finMs, WR_CARS[WR.save.car].c, WR.save.color));
  (WR.bots || []).forEach(function (b) { DBset(roomKey('wr_' + b.id), wrPayload(b, !!b.fin, b.fin, b.c, b.wc)); });
}
function wrNetTick() {
  if (!WR) return;
  WR_NET_N++;
  wrPublish();
  if (WR_NET_N % 3 === 1) DBget(roomKey('wheelrace')).then(function (st) {   /* 방장이 고른 코스·판 번호 */
    if (!WR || !st || typeof st.stage !== 'number' || st.stage < 0 || st.stage >= WR_STAGES.length) return;
    var rd = st.round || 0;
    if (rd !== WR.round || st.stage !== WR.stage) { WR.round = rd; WR.botList = st.bots || []; wrLoadStage(st.stage); wrUiRefresh(); }
  });
  var host = myPlayerId === roomHostId, bl = WR.botList || [];
  var pids = (roomPlayersList || []).map(function (p) { return p.id; }).concat(host ? [] : bl.map(function (b) { return b.id; }));
  DBgetPrefix('wr_', pids).then(function (all) {
    if (!WR) return;
    var now = performance.now(), names = {};
    (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; });
    if (!host) bl.forEach(function (b) { names[b.id] = b.name; });
    Object.keys(WR.ghosts).forEach(function (id) { if (!all[id] || !names[id]) delete WR.ghosts[id]; });
    Object.keys(all).forEach(function (id) {
      if (id === myPlayerId || !names[id]) return;
      var d = all[id];
      if (!d || d.stage !== WR.stage || (d.r || 0) !== (WR.round || 0) || typeof d.x !== 'number') { delete WR.ghosts[id]; return; }
      var g = WR.ghosts[id] || (WR.ghosts[id] = { buf: [] });
      g.name = names[id]; g.tag = wrTagColor(id); g.c = d.c || '#999'; g.wc = d.wc || '#455a64'; g.prog = d.prog || 0; g.fin = d.fin || 0;
      if (d.wp && d.wp.length >= 6) { var pts = []; for (var i = 0; i + 1 < d.wp.length; i += 2) pts.push({ x: d.wp[i], y: d.wp[i + 1] }); g.wheel = { pts: pts, closed: !!d.wcl }; }
      if (d.q !== g.q) { g.q = d.q; g.buf.push({ t: now, x: d.x, y: d.y, a: d.a, w1: d.w1, w2: d.w2 }); if (g.buf.length > 8) g.buf.shift(); }
    });
    var rows = (roomPlayersList || []).map(function (p) {
      if (p.id === myPlayerId) return { id: p.id, name: p.name, prog: WR.state === 'done' ? 1 : wrProg(), fin: WR.state === 'done' ? WR.finMs : 0, c: wrTagColor(p.id) };
      var g = WR.ghosts[p.id];
      return { id: p.id, name: p.name, prog: g ? g.prog : 0, fin: g ? g.fin : 0, c: wrTagColor(p.id) };
    });
    bl.forEach(function (bi) {
      var b = (WR.bots || []).filter(function (x) { return x.id === bi.id; })[0], g = WR.ghosts[bi.id];
      rows.push({ id: bi.id, name: bi.name, prog: b ? wrBotProg(b) : g ? g.prog : 0, fin: b ? b.fin : g ? g.fin : 0, c: wrTagColor(bi.id) });
    });
    rows.sort(function (a, b) { if (a.fin && b.fin) return a.fin - b.fin; if (a.fin) return -1; if (b.fin) return 1; return b.prog - a.prog; });
    WR.rows = rows;
    renderRankBoard('wr-rank', rows.map(function (r) { return { name: r.name, isMe: r.id === myPlayerId, label: r.fin ? '🏁 ' + (r.fin / 1000).toFixed(2) + '초' : '🛞 ' + Math.round(r.prog * 100) + '%' }; }));
    if (WR.state === 'done') wrUiRefresh();
  });
}
/* 친구 차 위치: 0.3초 전 모습을 두 샘플 사이에서 부드럽게 이어 그려요 */
function wrGhostPose(g, now) {
  var b = g.buf; if (!b.length) return null;
  var rt = now - 320, i = b.length - 1;
  if (rt >= b[i].t) return b[i];
  while (i > 0 && b[i - 1].t > rt) i--;
  if (i === 0) return b[0];
  var A = b[i - 1], B = b[i], k = (rt - A.t) / (B.t - A.t || 1);
  function L(u, v) { return u + (v - u) * k; }
  return { x: L(A.x, B.x), y: L(A.y, B.y), a: L(A.a, B.a), w1: [L(A.w1[0], B.w1[0]), L(A.w1[1], B.w1[1]), L(A.w1[2], B.w1[2])], w2: [L(A.w2[0], B.w2[0]), L(A.w2[1], B.w2[1]), L(A.w2[2], B.w2[2])] };
}
/* 지금 내 등수 */
function wrLiveRank() {
  var W = WR, mine = W.state === 'done' ? 1 : wrProg(), ahead = 0, total = 1;
  Object.keys(W.ghosts).forEach(function (id) {
    var g = W.ghosts[id]; total++;
    if (W.state === 'done') { if (g.fin && g.fin < W.finMs) ahead++; }
    else if (g.fin || g.prog > mine) ahead++;
  });
  (W.bots || []).forEach(function (b) {
    total++;
    if (W.state === 'done') { if (b.fin && b.fin < W.finMs) ahead++; }
    else if (b.fin || wrBotProg(b) > mine) ahead++;
  });
  return { rank: ahead + 1, total: total };
}

/* ---------- 화면(DOM) ---------- */
function startWheelRaceGame() {
  stopWheelRaceGame();
  var save = wrSaveLoad();
  var sw = save.wheel2;
  WR = { save: save, raw: [], drawErr: '', shop: false, rows: [], acc: 0, spin: 0, wheel: (sw && sw.pts && sw.pts.length > 3) ? { pts: sw.pts, closed: !!sw.closed } : { pts: wrCirclePts(26), closed: true } };
  WR.wheelInfo = wrWheelInfo(WR.wheel);
  document.getElementById('wr-root').innerHTML =
    '<div class="wr-bar"><span>🪙 <b id="wr-coins">0</b></span><span id="wr-stagename"></span>' +
      '<div class="wr-track"><div class="wr-track-line"></div><div id="wr-dots"></div><span class="wr-flag">🏁</span></div><span>⏱ <b id="wr-time">0.00</b></span></div>' +
    '<div class="wr-board"><canvas id="wr-canvas" class="wr-canvas"></canvas><div id="wr-ov" class="wr-ov" style="display:none"></div></div>' +
    '<div class="wr-bottom">' +
      '<div class="wr-pad-draw"><canvas id="wr-draw" width="240" height="240" class="wr-drawcv"></canvas><div class="wr-pad-hint">✏️ 여기에 바퀴를 그려요</div></div>' +
      '<div class="wr-pad-side"><canvas id="wr-prev" width="120" height="120" class="wr-prevcv"></canvas><div id="wr-info" class="wr-info"></div>' +
        '<div class="wr-colors" id="wr-colors"></div></div>' +
      '<div class="wr-ctrl">' +
        '<div id="wr-stages" class="wr-stages"></div>' +
        '<div id="wr-err" class="wr-err"></div>' +
        '<div class="wr-btns"><button class="btn btn-ghost" onclick="wrDefaultWheel()">⚪ 기본 원</button>' +
          '<button class="btn btn-ghost" id="wr-jump" onclick="wrJump()">🦘 점프</button><button class="btn btn-ghost" id="wr-again" onclick="wrRetry()">🔁 새 레이스</button><button class="btn btn-ghost" id="wr-bots" onclick="wrToggleBots()">🤖 봇</button>' +
          '<button class="btn btn-ghost" onclick="wrToggleShop()">🎨 꾸미기</button></div>' +
        '<div id="wr-shop" class="wr-shop" style="display:none"></div>' +
        '<div class="wr-rank-wrap"><div class="wr-rank-title">🏆 이번 코스 순위</div><div id="wr-rank"></div></div>' +
        '<p class="wr-help">💡 그린 선 그대로 바퀴가 돼요. 달리는 중에 다시 그리면 바로 바뀌어요! (스페이스: 점프 · 방장 R: 새 레이스)</p>' +
      '</div>' +
    '</div>';
  var cv = document.getElementById('wr-canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = WR_W * dpr; cv.height = WR_H * dpr; WR.dpr = dpr;
  WR.ctx = cv.getContext('2d'); WR.dctx = document.getElementById('wr-draw').getContext('2d'); WR.pctx = document.getElementById('wr-prev').getContext('2d');
  wrSetupDraw();
  WR.round = 0; wrLoadStage(0);
  /* 방장은 들어오자마자 새 판을 열어요 → 모두 함께 3·2·1 */
  var starter = (myPlayerId === roomHostId) ? DBget(roomKey('wheelrace')).then(function (st) { if (!WR) return; WR.round = (st && st.round) || 0; wrNewRace(0); }) : Promise.resolve();
  starter.then(function () { WR_NET_N = 0; wrNetTick(); WR_NET = setInterval(wrNetTick, 200); });
  WR_KEYH = function (e) {
    if (!WR || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if (e.code === 'Space') { e.preventDefault(); wrJump(); }
    else if ((e.key === 'r' || e.key === 'R') && myPlayerId === roomHostId) wrRetry();
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
  clearInterval(WR_NET); WR_NET = null;
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
  }).join('') + '<div class="wr-hint">' + esc(WR_STAGES[WR.stage].hint) + (host ? ' · 코스를 누르면 모두 새로 출발해요' : ' · 코스는 방장이 골라요') + '</div>';
  var inf = WR.wheelInfo;
  $('wr-info').innerHTML = '반지름 <b>' + inf.R.toFixed(0) + '</b> · 둥근 <b>' + inf.round + '%</b><br>' + (inf.closed ? '닫힌 모양' : '열린 선');
  $('wr-colors').innerHTML = WR_COLORS.map(function (c) { return '<button class="wr-cdot' + (c === S.color ? ' on' : '') + '" style="background:' + c + '" onclick="wrPickColor(\'' + c + '\')"></button>'; }).join('');
  $('wr-err').textContent = WR.drawErr || '';
  var sh = $('wr-shop'); sh.style.display = WR.shop ? 'flex' : 'none';
  if (WR.shop) sh.innerHTML = '<div class="wr-shop-t">🚗 자동차 (코인으로 잠금 해제)</div>' + WR_CARS.map(function (c, i) {
    var own = S.owned.indexOf(i) !== -1;
    return '<button class="wr-car' + (S.car === i ? ' on' : '') + '" onclick="wrPickCar(' + i + ')"><i style="background:' + c.c + '"></i>' + c.n + '<small>' + (S.car === i ? '사용 중' : own ? '장착' : '🪙 ' + c.p) + '</small></button>';
  }).join('');
  var ov = $('wr-ov');
  if (WR.state === 'done') { ov.innerHTML = wrDoneHtml(); ov.style.display = 'flex'; } else ov.style.display = 'none';
  $('wr-again').style.display = host ? '' : 'none';
  $('wr-bots').style.display = host ? '' : 'none';
  $('wr-bots').textContent = WR.save.bots === false ? '🤖 봇 대결 꺼짐' : '🤖 봇 대결 켜짐';
}
function wrHudTick() {
  var t = document.getElementById('wr-time'); if (t) t.textContent = (WR.t / 1000).toFixed(2);
  var d = document.getElementById('wr-dots');
  if (d && WR.rows) d.innerHTML = WR.rows.map(function (r) { return '<span class="wr-dot' + (r.id === myPlayerId ? ' me' : '') + '" style="left:' + (r.fin ? 100 : r.prog * 100) + '%;background:' + r.c + '" title="' + esc(r.name) + '">' + esc(Array.from(String(r.name || '?').replace(/^🤖\s*/, '') || '?')[0]) + '</span>'; }).join('');
}

/* ---------- 그리기 ---------- */
function wrPath(ctx, w) { ctx.beginPath(); w.pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); if (w.closed) ctx.closePath(); }
/* 그린 선 그대로 (안은 비워 둬요) */
function wrDrawWheelAt(ctx, w, color, angle, lw) {
  lw = lw || WR_LINE;
  ctx.save(); ctx.rotate(angle); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  wrPath(ctx, w); ctx.lineWidth = lw + 3; ctx.strokeStyle = '#263238'; ctx.stroke();
  ctx.lineWidth = lw - 1; ctx.strokeStyle = color; ctx.stroke();
  ctx.beginPath(); ctx.arc(w.pts[0].x, w.pts[0].y, lw * 0.35, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fillStyle = '#263238'; ctx.fill();
  ctx.restore();
}
function wrDrawPreview() {
  var c = WR.pctx, S = WR.save, inf = WR.wheelInfo;
  c.clearRect(0, 0, 120, 120); c.save(); c.translate(60, 60); var k = 50 / Math.max(inf.R, 20); c.scale(k, k);
  wrDrawWheelAt(c, WR.wheel, S.color, WR.spin * 2.2); c.restore();
  var d = WR.dctx; d.clearRect(0, 0, 240, 240);
  d.strokeStyle = 'rgba(0,0,0,.07)'; d.lineWidth = 1; d.beginPath(); d.moveTo(120, 0); d.lineTo(120, 240); d.moveTo(0, 120); d.lineTo(240, 120); d.stroke();
  if (WR.raw.length > 1) { d.beginPath(); WR.raw.forEach(function (p, i) { if (i) d.lineTo(p.x, p.y); else d.moveTo(p.x, p.y); }); d.strokeStyle = '#ff7043'; d.lineWidth = 5; d.lineCap = 'round'; d.lineJoin = 'round'; d.stroke(); }
  else { d.save(); d.translate(120, 120); d.globalAlpha = 0.3; var kk = 100 / Math.max(inf.R, 20); d.scale(kk, kk); wrPath(d, WR.wheel); d.lineWidth = 5 / kk; d.lineCap = 'round'; d.lineJoin = 'round'; d.strokeStyle = S.color; d.stroke(); d.restore(); }
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
  /* 친구들 차 (반투명 고스트 + 이름표) */
  var now = performance.now(), offs = [];
  Object.keys(W.ghosts).forEach(function (id) {
    var g = W.ghosts[id], ps = wrGhostPose(g, now); if (!ps) return;
    var sx = ps.x - cx, sy = ps.y - cy;
    if (sx < -60 || sx > WR_W + 60) { offs.push({ g: g, dx: ps.x - W.car.position.x, sy: sy }); return; }
    ctx.globalAlpha = 0.55;
    wrDrawCar(ctx, { x: ps.x, y: ps.y, a: ps.a }, [{ x: ps.w1[0], y: ps.w1[1], a: ps.w1[2] }, { x: ps.w2[0], y: ps.w2[1], a: ps.w2[2] }], g.c, g.wheel || W.wheel, g.wc);
    ctx.globalAlpha = 1;
    wrNameTag(ctx, ps.x, ps.y - 62, g.name, g.tag);
  });
  (W.bots || []).forEach(function (b) {
    var p = b.car.position, sx = p.x - cx, sy = p.y - cy;
    if (sx < -60 || sx > WR_W + 60) { offs.push({ g: { name: b.name, tag: wrTagColor(b.id) }, dx: p.x - W.car.position.x, sy: sy }); return; }
    ctx.globalAlpha = 0.6;
    wrDrawCar(ctx, { x: p.x, y: p.y, a: b.car.angle }, [b.wl, b.wr].map(function (w) { return { x: w.position.x, y: w.position.y, a: w.angle }; }), b.c, b.wheel, b.wc);
    ctx.globalAlpha = 1;
    wrNameTag(ctx, p.x, p.y - 62, b.name, wrTagColor(b.id));
  });
  /* 내 차 */
  var car = W.car, S = W.save;
  wrDrawCar(ctx, { x: car.position.x, y: car.position.y, a: car.angle }, [W.wl, W.wr].map(function (w) { return { x: w.position.x, y: w.position.y, a: w.angle }; }), WR_CARS[S.car].c, W.wheel, S.color);
  if (Object.keys(W.ghosts).length || (W.bots || []).length) wrNameTag(ctx, car.position.x, car.position.y - 62, '나', wrTagColor(myPlayerId));
  ctx.restore();
  /* 화면 밖 친구들 화살표 */
  ctx.font = 'bold 13px sans-serif'; ctx.textBaseline = 'middle';
  var usedY = [];
  offs.forEach(function (o) {
    var right = o.dx > 0, y = Math.max(96, Math.min(WR_H - 30, o.sy - 40));
    while (usedY.some(function (u) { return u.r === right && Math.abs(u.y - y) < 30; })) y += 30;
    usedY.push({ r: right, y: y }); var x = right ? WR_W - 8 : 8, label = o.g.name + ' ' + (right ? '+' : '-') + Math.round(Math.abs(o.dx) / 10) + 'm';
    var tw = ctx.measureText(label).width + 30;
    ctx.fillStyle = o.g.tag; rr(ctx, right ? x - tw : x, y - 13, tw, 26, 13); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = right ? 'right' : 'left'; ctx.fillText((right ? '' : '◀ ') + label + (right ? ' ▶' : ''), right ? x - 8 : x + 8, y + 1);
  });
  /* 실시간 등수 */
  if (W.state !== 'wait') {
    var lr = wrLiveRank();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 44px sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#fff';
    var rk = lr.rank + '등'; ctx.strokeText(rk, 16, 58); ctx.fillStyle = lr.rank === 1 ? '#f9a825' : '#37474f'; ctx.fillText(rk, 16, 58);
    var rw = ctx.measureText(rk).width;
    ctx.font = 'bold 20px sans-serif'; ctx.lineWidth = 4; ctx.strokeText('/ ' + lr.total + '명', 24 + rw, 56); ctx.fillStyle = '#546e7a'; ctx.fillText('/ ' + lr.total + '명', 24 + rw, 56);
  }
  /* 진행 바 */
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, 0, WR_W, 6); ctx.fillStyle = '#ff7043'; ctx.fillRect(0, 0, WR_W * wrProg(), 6);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (W.state === 'wait') { ctx.font = 'bold 24px sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.strokeText('방장이 레이스를 열면 다 같이 출발해요…', WR_W / 2, WR_H * 0.4); ctx.fillStyle = '#37474f'; ctx.fillText('방장이 레이스를 열면 다 같이 출발해요…', WR_W / 2, WR_H * 0.4); }
  if (W.state === 'count' || W.goT > 0) {
    var label = W.state === 'count' ? String(Math.ceil(W.cd / 60)) : '출발!', fr = W.state === 'count' ? (W.cd % 60) / 60 : W.goT / 45;
    ctx.save(); ctx.translate(WR_W / 2, WR_H * 0.42); var sc = 1 + (1 - fr) * 0.25; ctx.scale(sc, sc);
    ctx.font = 'bold ' + (W.state === 'count' ? 120 : 90) + 'px sans-serif'; ctx.lineWidth = 10; ctx.strokeStyle = '#fff'; ctx.strokeText(label, 0, 0);
    ctx.fillStyle = W.state === 'count' ? '#ff7043' : '#43a047'; ctx.fillText(label, 0, 0); ctx.restore();
    if (W.state === 'count') { ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText('출발 전에 바퀴를 그려도 돼요!', WR_W / 2, WR_H * 0.42 + 90); }
  }
  if (W.toastT > 0 && W.toast) {
    ctx.font = 'bold 20px sans-serif'; var tw = ctx.measureText(W.toast).width + 36;
    ctx.fillStyle = 'rgba(38,50,56,.8)'; rr(ctx, WR_W / 2 - tw / 2, 22, tw, 40, 20); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(W.toast, WR_W / 2, 43);
  }
  ctx.textBaseline = 'alphabetic';
}
function wrDrawCar(ctx, body, wheels, color, wheel, wcolor) {
  var W = WR, ob = W.offB, oc = W.offC;
  ctx.save(); ctx.translate(body.x, body.y); ctx.rotate(body.a);
  ctx.lineWidth = 3; ctx.strokeStyle = '#263238'; ctx.fillStyle = color;
  rr(ctx, ob.x - 42, ob.y - 9, 84, 18, 7); ctx.fill(); ctx.stroke();
  rr(ctx, oc.x - 23, oc.y - 8, 46, 16, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e1f5fe'; rr(ctx, oc.x - 18, oc.y - 5, 15, 10, 3); ctx.fill(); rr(ctx, oc.x + 1, oc.y - 5, 15, 10, 3); ctx.fill();
  ctx.fillStyle = '#fff59d'; ctx.beginPath(); ctx.arc(ob.x + 38, ob.y, 4, 0, 7); ctx.fill();
  ctx.restore();
  wheels.forEach(function (w) { ctx.save(); ctx.translate(w.x, w.y); wrDrawWheelAt(ctx, wheel, wcolor, w.a); ctx.restore(); });
}
function wrNameTag(ctx, x, y, name, color) {
  ctx.save(); ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  var t = String(name || '?').slice(0, 8), w = ctx.measureText(t).width + 16;
  ctx.fillStyle = color; rr(ctx, x - w / 2, y - 11, w, 22, 11); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 5, y + 10); ctx.lineTo(x + 5, y + 10); ctx.lineTo(x, y + 16); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(t, x, y + 1); ctx.restore();
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
