/* ---------------- 땅따먹기 (온라인, 2~10명, 실시간 · paper.io 방식) ----------------
   캐릭터는 멈추지 않고 계속 앞으로 가요. 마우스(또는 화살표/WASD, 휴대폰은 화면 끌기)로
   가고 싶은 방향을 가리키면 그쪽으로 부드럽게 휘어져요(칸 단위로 꺾이지 않아요).
   내 땅 밖으로 나가면 꼬리(선)가 생기고, 다시 내 땅으로 돌아오면 꼬리로 둘러싼 공간이 전부 내 땅!
   밖에 나가 있을 때 다른 사람이 내 꼬리를 지나가면(또는 내가 내 꼬리를 밟으면) 탈락.
   - 땅은 120×120 칸 격자로 계산하고(둘러싸기 계산이 정확해요), 움직임과 선은 부드럽게 그려요.
   - 내 움직임/땅 계산은 내 화면이 직접 하고, roomKey('ld_'+내id)에 0.18초마다 올려요.
   - 땅이 겹치면 '나중에' 차지한 사람 것. 순서는 기기 시계가 아니라 서로 본 값보다 항상 크게
     매기는 번호(cap)로 정해서, 시계가 틀린 기기에서 땅이 안 먹어지던 문제를 없앴어요. */
var LD_G = 120;                // 판 크기 (120×120칸)
var LD_SPEED = 8.2;            // 칸/초
var LD_TURN = 4.4;             // 초당 최대 회전(라디안) → 회전 반지름 약 1.9칸 (U턴해도 내 꼬리에 안 닿아요)
var LD_ROUND_MS = 210000;      // 3분 30초
var LD_RESPAWN_MS = 3000;
var LD_COLORS = ['#ef5350', '#42a5f5', '#43a047', '#ffa726', '#ab47bc', '#26c6da', '#c0ca33', '#ec407a', '#ffca28', '#26a69a'];
var LD_MIN = 2, LD_MAX = 10;
var LD_VIEW = 30;              // 화면에 보이는 칸 수(짧은 쪽)

var LD = null;           // 내 게임 상태
var LD_MAIN = null;      // 방 공용 상태 roomKey('land')
var LD_OTHERS = {};      // 다른 사람들 최신 상태 {pid: data}
var LD_DISP = {};        // 다른 사람이 화면에 그려지는 위치 {pid: {x,y,a}}
var LD_RAF = null, LD_POLL = null, LD_NET = null;
var LD_CANVAS = null, LD_CTX = null, LD_DPR = 1;
var LD_PICK = null;
var LD_KILL_AT = {};

function ldKey() { return roomKey('land'); }
/* 팀전: 같은 팀이면 true (팀전이 아니면 항상 false) */
function ldMate(pid) { var T = LD_MAIN && LD_MAIN.teams; return !!(T && pid !== myPlayerId && T[pid] != null && T[pid] === T[myPlayerId]); }
var LD_TEAM_MASK = null;   /* 팀원들 땅을 합친 것 */
function ldMyKey() { return roomKey('ld_' + myPlayerId); }
function ldIdx(x, y) { return y * LD_G + x; }

function stopLandGame() {
  cancelAnimationFrame(LD_RAF); LD_RAF = null;
  clearInterval(LD_POLL); LD_POLL = null;
  clearInterval(LD_NET); LD_NET = null;
}

function startLandGame() {
  stopLandGame();
  LD = null; LD_MAIN = null; LD_OTHERS = {}; LD_DISP = {};
  LD_CANVAS = document.getElementById('ld-canvas');
  LD_CTX = LD_CANVAS.getContext('2d');
  document.getElementById('ld-result').style.display = 'none';
  var n = (roomPlayersList || []).length;
  if (n < LD_MIN || n > LD_MAX) {
    document.getElementById('ld-msg').textContent = '땅따먹기는 ' + LD_MIN + '~' + LD_MAX + '명이 필요해요. 지금 ' + n + '명이에요.';
    return;
  }
  var myChar = (charLoadChoice() || {}).id || null;
  LD_PICK = myChar;
  charRenderPicker('ld-char-pick', myChar, function (id) { LD_PICK = id; if (LD) LD.char = id; });
  document.getElementById('ld-pick-box').style.display = '';
  var starter = myPlayerId === roomHostId ? ldHostInit() : Promise.resolve();
  starter.then(function () {
    ldPollMain();
    LD_POLL = setInterval(ldPollMain, 1000);
    LD_NET = setInterval(ldNetTick, 180);
    LD_RAF = requestAnimationFrame(ldFrame);
  });
}

function ldHostInit() {
  var order = shuffleArray((roomPlayersList || []).map(function (p) { return p.id; }));
  var names = {}, spawns = {};
  (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; });
  /* 팀전(게임 테이블에서 켰을 때): 같은 팀은 같은 색, 가까이에서 시작 */
  var tc = typeof tblTeamConfig === 'function' ? tblTeamConfig() : null;
  var teams = null;
  if (tc) { teams = {}; order.forEach(function (pid) { teams[pid] = tc.assign[pid] || 0; }); }
  order.forEach(function (pid, i) {
    var a, color;
    if (teams) {
      var t = teams[pid], mates = order.filter(function (q) { return teams[q] === t; }), k = mates.indexOf(pid);
      a = (t / tc.n) * Math.PI * 2 + (k - (mates.length - 1) / 2) * 0.32;
      color = TEAM_COLORS[t % TEAM_COLORS.length];
    } else { a = (i / order.length) * Math.PI * 2; color = LD_COLORS[i % LD_COLORS.length]; }
    spawns[pid] = { x: Math.round(LD_G / 2 + Math.cos(a) * LD_G * 0.3), y: Math.round(LD_G / 2 + Math.sin(a) * LD_G * 0.3), color: color, a: a + Math.PI / 2 };
  });
  var startAt = Date.now() + 9000; // 캐릭터 고를 시간
  return DBset(ldKey(), { gameId: Date.now(), order: order, names: names, spawns: spawns, startAt: startAt, endAt: startAt + LD_ROUND_MS, phase: 'play', teams: teams, teamN: tc ? tc.n : 0 });
}
function ldHostRestart() { if (myPlayerId === roomHostId) ldHostInit().then(ldPollMain); }

function ldPollMain() {
  DBget(ldKey()).then(function (st) {
    if (!st || !st.order) return;
    var isNew = !LD_MAIN || LD_MAIN.gameId !== st.gameId;
    LD_MAIN = st;
    if (isNew) ldInitMine(st);
    if (myPlayerId === roomHostId && st.phase === 'play' && Date.now() > st.endAt + 1500) ldHostFinish(st);
    if (st.phase === 'end') ldShowResult(st);
  });
}

function ldInitMine(st) {
  var sp = st.spawns[myPlayerId] || { x: 15, y: 15, color: LD_COLORS[0], a: 0 };
  LD = {
    gameId: st.gameId, color: sp.color, char: LD_PICK || (charLoadChoice() || {}).id || null,
    mask: new Uint8Array(LD_G * LD_G), trail: [], trailIdx: new Int32Array(LD_G * LD_G).fill(-1), pts: [],
    x: sp.x + 0.5, y: sp.y + 0.5, a: sp.a || 0, ta: sp.a || 0, cellId: ldIdx(sp.x, sp.y),
    alive: true, deadUntil: 0, cap: 1, hits: [], kills: 0, deaths: 0, killedBy: null,
    recentTrail: null
  };
  LD_PROCESSED = {}; LD_OWNER_DIRTY = true; LD_DISP = {};
  ldFillCircle(sp.x, sp.y, 3.3);
  LD.cap = ldNextCap();
  document.getElementById('ld-result').style.display = 'none';
  document.getElementById('ld-pick-box').style.display = '';
}

function ldFillCircle(cx, cy, r) {
  for (var y = Math.floor(cy - r); y <= cy + r; y++) for (var x = Math.floor(cx - r); x <= cx + r; x++) {
    if (x >= 0 && y >= 0 && x < LD_G && y < LD_G && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) LD.mask[ldIdx(x, y)] = 1;
  }
}

/* 땅 차지 번호: 지금까지 본 모든 사람 번호보다 크게 → '나중에 차지한 사람'이 기기 시계와 상관없이 정확 */
function ldNextCap() {
  var m = Date.now();
  Object.keys(LD_OTHERS).forEach(function (pid) { var c = LD_OTHERS[pid].cap || 0; if (c >= m) m = c + 1; });
  if (LD && LD.cap >= m) m = LD.cap + 1;
  return m;
}

/* ---- 조종 ---- */
var LD_CTRL = { mode: 'keys', keys: {}, mx: null, my: null, touch: null };
function ldAngDiff(a, b) { var d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function ldSetTarget(a) { if (LD && LD.alive) LD.ta = a; }
/* 화살표/WASD: 누르고 있는 키를 합쳐서 8방향 (↑+→ = 오른쪽 위 대각선) */
function ldKeysTarget() {
  var k = LD_CTRL.keys, dx = (k.r ? 1 : 0) - (k.l ? 1 : 0), dy = (k.d ? 1 : 0) - (k.u ? 1 : 0);
  if (dx || dy) ldSetTarget(Math.atan2(dy, dx));
}
/* 마우스 모드: 화면에서 내 캐릭터 → 마우스 쪽을 향해요 (매 프레임 다시 계산) */
function ldMouseTarget() {
  if (LD_CTRL.mode !== 'mouse' || LD_CTRL.mx == null || !ldDraw.head) return;
  var r = LD_CANVAS.getBoundingClientRect();
  var hx = r.left + ldDraw.head.x / LD_DPR, hy = r.top + ldDraw.head.y / LD_DPR;
  var dx = LD_CTRL.mx - hx, dy = LD_CTRL.my - hy;
  if (dx * dx + dy * dy > 64) ldSetTarget(Math.atan2(dy, dx));
}
/* 예전 방향 버튼(↑↓←→)도 그대로 써요 */
function ldSetDir(dx, dy) { LD_CTRL.mode = 'keys'; ldSetTarget(Math.atan2(dy, dx)); }

/* ---- 내 움직임 ---- */
function ldMove(dt) {
  ldMouseTarget();
  var d = ldAngDiff(LD.a, LD.ta), maxT = LD_TURN * dt;
  LD.a += Math.max(-maxT, Math.min(maxT, d));
  /* 한 프레임에 0.25칸씩 나눠서 움직여요 → 칸을 건너뛰지 않아요 */
  var dist = LD_SPEED * dt, steps = Math.max(1, Math.ceil(dist / 0.25));
  for (var s = 0; s < steps && LD.alive; s++) {
    var nx = LD.x + Math.cos(LD.a) * dist / steps, ny = LD.y + Math.sin(LD.a) * dist / steps;
    /* 벽: 밖으로 못 나가고 벽을 따라 미끄러져요 */
    nx = Math.max(0.05, Math.min(LD_G - 0.05, nx));
    ny = Math.max(0.05, Math.min(LD_G - 0.05, ny));
    LD.x = nx; LD.y = ny;
    var cx = Math.floor(nx), cy = Math.floor(ny), id = ldIdx(cx, cy);
    if (id !== LD.cellId) {
      var px = LD.cellId % LD_G, py = (LD.cellId - px) / LD_G;
      /* 대각선으로 칸을 넘으면 사이 칸도 하나 거쳐요 (꼬리가 끊기지 않고 이어진 벽이 되게) */
      if (px !== cx && py !== cy) ldEnterCell(ldIdx(cx, py));
      if (LD.alive) ldEnterCell(id);
    }
    if (LD.trail.length) {
      var lp = LD.pts[LD.pts.length - 1];
      if (!lp || Math.abs(lp[0] - nx) + Math.abs(lp[1] - ny) > 0.45) LD.pts.push([nx, ny]);
    }
  }
}

function ldEnterCell(id) {
  LD.cellId = id;
  var ti = LD.trailIdx[id];
  if (ti >= 0 && ti < LD.trail.length - 3) { ldDie(null, '내 꼬리를 밟았어요'); return; }
  ldCheckHit(id);
  if (LD.mask[id] || (LD_TEAM_MASK && LD_TEAM_MASK[id])) {   /* 팀원 땅에 돌아와도 둘러싸기 완성 */
    if (LD.trail.length) ldCapture();
  } else if (ti < 0) {
    if (!LD.trail.length) LD.pts = [[LD.x, LD.y]];
    LD.trailIdx[id] = LD.trail.length;
    LD.trail.push(id);
  }
}

/* 내가 다른 사람 꼬리 칸을 지나갔을 때: "누구의 몇 번 칸"을 기록(hit)해서 올려요.
   상대 화면이 그 칸이 지금도 자기 꼬리인지 확인한 뒤에만 탈락시켜요. (내가 본 위치 = 판정 위치) */
function ldCheckHit(id) {
  Object.keys(LD_OTHERS).forEach(function (pid) {
    var d = LD_OTHERS[pid];
    if (!d.alive || !d.trailSet || !d.trailSet[id] || ldMate(pid)) return;   /* 팀원 꼬리는 밟아도 안 끊겨요 */
    if (Date.now() - (LD_KILL_AT[pid] || 0) < 1500) return;
    LD_KILL_AT[pid] = Date.now();
    LD.hits.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), to: pid, cell: id });
    if (LD.hits.length > 20) LD.hits.shift();
    ldPublish(true);
  });
}

/* 꼬리를 땅으로 바꾸고, 바깥과 연결되지 않은(둘러싸인) 칸도 전부 내 땅으로 */
function ldCapture() {
  var G = LD_G, mask = LD.mask;
  var tm = new Uint8Array(G * G);
  LD.trail.forEach(function (id) { tm[id] = 1; mask[id] = 1; });
  /* 팀전: 팀원 땅도 벽으로 같이 써요 */
  var wall = mask;
  if (LD_TEAM_MASK) { wall = new Uint8Array(G * G); for (var w = 0; w < G * G; w++) wall[w] = mask[w] || LD_TEAM_MASK[w]; }
  LD.recentTrail = { mask: tm, until: Date.now() + 450 }; /* 방금 닫은 꼬리: 0.45초 안에 끊긴 건 인정 */
  var outside = new Uint8Array(G * G);
  var stack = [];
  for (var i = 0; i < G; i++) {
    [ldIdx(i, 0), ldIdx(i, G - 1), ldIdx(0, i), ldIdx(G - 1, i)].forEach(function (id) {
      if (!wall[id] && !outside[id]) { outside[id] = 1; stack.push(id); }
    });
  }
  while (stack.length) {
    var id = stack.pop();
    var x = id % G, y = (id - x) / G;
    if (x > 0 && !wall[id - 1] && !outside[id - 1]) { outside[id - 1] = 1; stack.push(id - 1); }
    if (x < G - 1 && !wall[id + 1] && !outside[id + 1]) { outside[id + 1] = 1; stack.push(id + 1); }
    if (y > 0 && !wall[id - G] && !outside[id - G]) { outside[id - G] = 1; stack.push(id - G); }
    if (y < G - 1 && !wall[id + G] && !outside[id + G]) { outside[id + G] = 1; stack.push(id + G); }
  }
  for (var j = 0; j < G * G; j++) if (!outside[j]) mask[j] = 1;
  ldClearTrail();
  LD.cap = ldNextCap();
  LD_OWNER_DIRTY = true;
  ldPublish(true);
}

function ldClearTrail() {
  for (var i = 0; i < LD.trail.length; i++) LD.trailIdx[LD.trail[i]] = -1;
  LD.trail = []; LD.pts = [];
}

function ldDie(byPid, why) {
  if (!LD.alive) return;
  if (typeof playFart === 'function') playFart();
  LD.alive = false;
  LD.deaths++;
  LD.killedBy = byPid;
  LD.deadUntil = Date.now() + LD_RESPAWN_MS;
  LD.mask = new Uint8Array(LD_G * LD_G);
  ldClearTrail();
  LD.recentTrail = null;
  LD.cap = ldNextCap();
  LD_OWNER_DIRTY = true;
  if (why) ldToast('💥 ' + why);
  ldPublish(true);
}

function ldRespawn() {
  // 다른 사람 땅이 적은 곳을 골라 다시 시작
  var best = null, bestScore = -1;
  for (var t = 0; t < 40; t++) {
    var x = 6 + Math.floor(Math.random() * (LD_G - 12)), y = 6 + Math.floor(Math.random() * (LD_G - 12));
    var free = 0;
    for (var yy = y - 4; yy <= y + 4; yy++) for (var xx = x - 4; xx <= x + 4; xx++) if (LD_OWNER[ldIdx(xx, yy)] < 0) free++;
    if (free > bestScore) { bestScore = free; best = { x: x, y: y }; }
  }
  LD.x = best.x + 0.5; LD.y = best.y + 0.5; LD.cellId = ldIdx(best.x, best.y);
  LD.a = LD.ta = Math.atan2(LD_G / 2 - best.y, LD_G / 2 - best.x);
  LD.alive = true; LD.killedBy = null;
  ldFillCircle(best.x, best.y, 3.3);
  LD.cap = ldNextCap();
  LD_OWNER_DIRTY = true;
  ldPublish(true);
}

/* ---- 네트워크 ---- */
function ldB64(mask) {
  var bytes = new Uint8Array(Math.ceil(mask.length / 8));
  for (var i = 0; i < mask.length; i++) if (mask[i]) bytes[i >> 3] |= (1 << (i & 7));
  var s = '';
  for (var j = 0; j < bytes.length; j++) s += String.fromCharCode(bytes[j]);
  return btoa(s);
}
function ldUnB64(b64) {
  var s = atob(b64 || ''), mask = new Uint8Array(LD_G * LD_G);
  for (var i = 0; i < mask.length; i++) { var c = s.charCodeAt(i >> 3) || 0; if (c & (1 << (i & 7))) mask[i] = 1; }
  return mask;
}
var LD_LAST_PUB = 0, LD_PUB_BUSY = false, LD_PUB_AGAIN = false, LD_FETCH_BUSY = false;
var LD_PROCESSED = {};
var LD_OWNER = new Int8Array(LD_G * LD_G).fill(-1), LD_OWNER_LIST = [], LD_OWNER_DIRTY = true;
var LD_MM_AT = 0;
var LD_MASK_CACHE = { cap: -1, b64: '' };

/* 렉 줄이기: 이전 요청이 아직 안 끝났으면 새 요청을 쌓지 않아요 */
function ldPublish(force) {
  if (!LD || !LD_MAIN) return;
  var now = Date.now();
  if (!force && now - LD_LAST_PUB < 160) return;
  if (LD_PUB_BUSY) { LD_PUB_AGAIN = true; return; }
  LD_LAST_PUB = now;
  /* 땅 모양은 바뀔 때만 다시 만들어요 */
  if (LD_MASK_CACHE.cap !== LD.cap || LD_MASK_CACHE.dirty) {
    var score = 0;
    for (var i = 0; i < LD.mask.length; i++) score += LD.mask[i];
    LD.score = score;
    LD_MASK_CACHE = { cap: LD.cap, b64: ldB64(LD.mask) };
  }
  /* 선 모양(부드러운 점)은 너무 길면 듬성듬성하게 */
  var pts = LD.pts, step = Math.max(1, Math.ceil(pts.length / 260)), sp = [];
  for (var k = 0; k < pts.length; k += step) sp.push(Math.round(pts[k][0] * 10) / 10, Math.round(pts[k][1] * 10) / 10);
  LD_PUB_BUSY = true;
  DBset(ldMyKey(), {
    gameId: LD.gameId, name: me.name, color: LD.color, char: LD.char,
    x: Math.round(LD.x * 100) / 100, y: Math.round(LD.y * 100) / 100, a: Math.round(LD.a * 1000) / 1000,
    alive: LD.alive, t: now,
    mask: LD_MASK_CACHE.b64, cap: LD.cap, trail: LD.trail.slice(-700), pts: sp, hits: LD.hits.slice(),
    score: LD.score || 0, kills: LD.kills, deaths: LD.deaths, killedBy: LD.killedBy
  }).then(function () {
    LD_PUB_BUSY = false;
    if (LD_PUB_AGAIN) { LD_PUB_AGAIN = false; ldPublish(true); }
  }, function () { LD_PUB_BUSY = false; });
}

function ldNetTick() {
  if (!LD_MAIN || !LD) return;
  if (!(typeof TBL !== 'undefined' && TBL.spectate)) ldPublish(false);
  if (LD_FETCH_BUSY) return;
  LD_FETCH_BUSY = true;
  var others = LD_MAIN.order.filter(function (p) { return p !== myPlayerId; });
  DBgetPrefix('ld_', others).then(function (all) {
    LD_FETCH_BUSY = false;
    var now = Date.now();
    Object.keys(all).forEach(function (pid) {
      var d = all[pid];
      if (!d || d.gameId !== LD_MAIN.gameId || d.a == null) return;
      var prev = LD_OTHERS[pid];
      if (prev && prev.t === d.t) return;
      d.maskArr = (prev && prev.mask === d.mask && prev.maskArr) ? prev.maskArr : ldUnB64(d.mask);
      d.trailSet = {};
      (d.trail || []).forEach(function (id) { d.trailSet[id] = 1; });
      d.recvAt = now;
      /* 그 사람이 나를 끊었다고 확정되면(상대 화면이 판정) 내 '꼬리 끊기' 횟수 +1 */
      if (prev && (d.deaths || 0) > (prev.deaths || 0) && d.killedBy === myPlayerId) {
        LD.kills++;
        ldToast('⚔️ ' + (d.name || '') + '님의 꼬리를 끊었어요!');
      }
      if (prev && prev.alive !== d.alive) delete LD_DISP[pid];
      LD_OTHERS[pid] = d;
      if (!prev || prev.mask !== d.mask || prev.cap !== d.cap) LD_OWNER_DIRTY = true;
    });
    ldResolveConflicts();
  }).catch(function () { LD_FETCH_BUSY = false; });
  ldUpdateBoard();
}

/* 다른 사람 위치 예측: 받은 위치에서 그 사람이 보던 방향으로 계속 간다고 보고 앞으로 이어 그려요.
   (예전처럼 0.4초 늦은 모습을 그리면, 화면에선 안 닿았는데 죽는 것처럼 보였어요) */
function ldOtherPredict(d, now) {
  var e = Math.min(0.4, Math.max(0, (now - d.recvAt) / 1000 + 0.06));
  var x = d.x + Math.cos(d.a) * LD_SPEED * e, y = d.y + Math.sin(d.a) * LD_SPEED * e;
  return { x: Math.max(0, Math.min(LD_G, x)), y: Math.max(0, Math.min(LD_G, y)), a: d.a };
}
function ldOtherDisplay(pid, d, now, dt) {
  var p = ldOtherPredict(d, now), s = LD_DISP[pid];
  if (!s || Math.abs(s.x - p.x) + Math.abs(s.y - p.y) > 6) s = LD_DISP[pid] = { x: p.x, y: p.y, a: p.a };
  /* 예측 위치를 부드럽게 따라가요 (갑자기 튀지 않게) */
  var k = Math.min(1, dt * 9);
  s.x += (p.x - s.x) * k; s.y += (p.y - s.y) * k;
  s.a += ldAngDiff(s.a, p.a) * k;
  return s;
}

/* 다른 사람과의 충돌/땅 뺏김 판정 (내 화면에서 나에 대해서만 판단) */
function ldResolveConflicts() {
  if (!LD || Date.now() < LD_MAIN.startAt) return;
  var now = Date.now();
  Object.keys(LD_OTHERS).forEach(function (pid) {
    var d = LD_OTHERS[pid];
    // 1) 누가 "내 꼬리 칸을 지나갔다"고 기록했고, 그 칸이 지금도(또는 방금 전까지) 내 꼬리면 탈락
    (d.hits || []).forEach(function (h) {
      if (h.to !== myPlayerId || LD_PROCESSED[h.id]) return;
      LD_PROCESSED[h.id] = 1;
      var rt = LD.recentTrail;
      var onMine = LD.trailIdx[h.cell] >= 0 || (rt && now < rt.until && rt.mask[h.cell]);
      if (LD.alive && onMine) ldDie(pid, (d.name || '누군가') + '님이 내 꼬리를 끊었어요!');
    });
    // 2) 그 사람이 나보다 나중에 땅을 차지했으면 겹친 칸은 그 사람 것
    if (LD.alive && d.alive !== false && d.cap > LD.cap && d.maskArr && !ldMate(pid)) {   /* 팀원끼리는 땅을 안 빼앗아요 */
      var changed = false;
      for (var i = 0; i < LD.mask.length; i++) if (LD.mask[i] && d.maskArr[i]) { LD.mask[i] = 0; changed = true; }
      if (changed) {
        LD_OWNER_DIRTY = true;
        LD_MASK_CACHE.dirty = true;
        var left = 0;
        for (var k = 0; k < LD.mask.length && !left; k++) left = LD.mask[k];
        if (!left) ldDie(pid, (d.name || '누군가') + '님에게 땅을 모두 빼앗겼어요!');
      }
    }
  });
}

/* 칸 주인 표를 한 번에 계산해 두고(땅이 바뀔 때만), 그릴 때는 표만 봐요 → 렉 감소 */
function ldRebuildOwners() {
  LD_OWNER_DIRTY = false;
  LD_OWNER_LIST = Object.keys(LD_OTHERS).filter(function (p) { return LD_OTHERS[p].alive !== false; })
    .sort(function (a, b) { return (LD_OTHERS[a].cap || 0) - (LD_OTHERS[b].cap || 0); });
  LD_OWNER.fill(-1);
  var mineDone = false;
  var paintMine = function () { if (LD) for (var j = 0; j < LD.mask.length; j++) if (LD.mask[j]) LD_OWNER[j] = 0; mineDone = true; };
  LD_OWNER_LIST.forEach(function (pid, k) {
    var od = LD_OTHERS[pid];
    if (!mineDone && LD && LD.cap < (od.cap || 0)) paintMine();
    var m = od.maskArr;
    if (!m) return;
    for (var i = 0; i < m.length; i++) if (m[i]) LD_OWNER[i] = k + 1;
  });
  if (!mineDone) paintMine();
  /* 팀원 땅 합치기 */
  LD_TEAM_MASK = null;
  if (LD_MAIN && LD_MAIN.teams) {
    LD_TEAM_MASK = new Uint8Array(LD_G * LD_G);
    Object.keys(LD_OTHERS).forEach(function (pid) {
      var m = LD_OTHERS[pid].maskArr;
      if (!ldMate(pid) || !m || LD_OTHERS[pid].alive === false) return;
      for (var i = 0; i < m.length; i++) if (m[i]) LD_TEAM_MASK[i] = 1;
    });
  }
  LD_MM_AT = 0;
}
function ldOwnerColor(o) {
  if (o === 0) return LD.color;
  var pid = LD_OWNER_LIST[o - 1];
  return (pid && LD_OTHERS[pid] && LD_OTHERS[pid].color) || '#ccc';
}

var LD_TOAST_T = null;
function ldToast(msg) {
  var el = document.getElementById('ld-toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(LD_TOAST_T);
  LD_TOAST_T = setTimeout(function () { el.classList.remove('show'); }, 1800);
}

/* ---- 화면 ---- */
function ldFrame(ts) {
  LD_RAF = requestAnimationFrame(ldFrame);
  if (!LD || !LD_MAIN || !document.getElementById('land').classList.contains('active')) { ldFrame.last = ts; return; }
  var now = Date.now();
  var dt = ldFrame.last ? Math.min(0.05, (ts - ldFrame.last) / 1000) : 0.016;
  ldFrame.last = ts;
  var started = now >= LD_MAIN.startAt;
  var ended = now >= LD_MAIN.endAt || LD_MAIN.phase === 'end';
  document.getElementById('ld-pick-box').style.display = started ? 'none' : '';
  if (!started) document.getElementById('ld-count').textContent = Math.ceil((LD_MAIN.startAt - now) / 1000);
  if (started && !ended) {
    if (typeof TBL !== 'undefined' && TBL.spectate) { /* 구경: 안 움직여요 */ }
    else if (LD.alive) ldMove(dt);
    else if (now >= LD.deadUntil) ldRespawn();
  }
  if (LD_OWNER_DIRTY) ldRebuildOwners();
  var remain = Math.max(0, Math.ceil((LD_MAIN.endAt - now) / 1000));
  document.getElementById('ld-time').textContent = started ? (Math.floor(remain / 60) + ':' + ('0' + remain % 60).slice(-2)) : '준비';
  ldDraw(dt);
}

function ldResize() {
  var rect = LD_CANVAS.getBoundingClientRect();
  LD_DPR = window.devicePixelRatio || 1;
  var w = Math.round(rect.width * LD_DPR), h = Math.round(rect.height * LD_DPR);
  if (LD_CANVAS.width !== w || LD_CANVAS.height !== h) { LD_CANVAS.width = w; LD_CANVAS.height = h; }
}

function ldShade(hex, f) {
  var c = ldHexRgb(hex);
  return 'rgb(' + Math.round(c[0] * f) + ',' + Math.round(c[1] * f) + ',' + Math.round(c[2] * f) + ')';
}

function ldDraw(dt) {
  ldResize();
  var ctx = LD_CTX, W = LD_CANVAS.width, H = LD_CANVAS.height;
  var now = Date.now();
  var cell = Math.min(W, H) / LD_VIEW;
  var hx = LD.x, hy = LD.y;
  /* 구경 중: 1등(가장 땅이 넓은) 친구를 따라가요 */
  if (typeof TBL !== 'undefined' && TBL.spectate) {
    var best = null;
    Object.keys(LD_OTHERS).forEach(function (pid) { var d = LD_OTHERS[pid]; if (d.alive && (!best || (d.score || 0) > (best.score || 0))) best = d; });
    if (best) { var bp = ldOtherPredict(best, now); hx = bp.x; hy = bp.y; }
  }
  /* 카메라: 캐릭터를 부드럽게 따라가요 */
  var tx = hx * cell - W / 2, ty = hy * cell - H / 2;
  var cs = ldDraw.cam;
  if (!cs || Math.abs(cs.x - tx) > W || Math.abs(cs.y - ty) > H || cs.cell !== cell) cs = ldDraw.cam = { x: tx, y: ty, cell: cell };
  var ck = Math.min(1, (dt || 0.016) * 12);
  cs.x += (tx - cs.x) * ck; cs.y += (ty - cs.y) * ck;
  var camX = cs.x, camY = cs.y;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#dfe6ee';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(-camX, -camY);
  ctx.fillStyle = '#f5f8fb';
  ctx.fillRect(0, 0, LD_G * cell, LD_G * cell);
  var x0 = Math.max(0, Math.floor(camX / cell) - 1), x1 = Math.min(LD_G, Math.ceil((camX + W) / cell) + 1);
  var y0 = Math.max(0, Math.floor(camY / cell) - 1), y1 = Math.min(LD_G, Math.ceil((camY + H) / cell) + 1);
  /* 바닥 무늬 (옅은 격자) */
  ctx.strokeStyle = 'rgba(0,0,0,0.035)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (var gx = x0 - x0 % 4; gx <= x1; gx += 4) { ctx.moveTo(gx * cell, y0 * cell); ctx.lineTo(gx * cell, y1 * cell); }
  for (var gy = y0 - y0 % 4; gy <= y1; gy += 4) { ctx.moveTo(x0 * cell, gy * cell); ctx.lineTo(x1 * cell, gy * cell); }
  ctx.stroke();
  /* 땅: 아래쪽 테두리를 진하게 칠해서 살짝 두께감 (paper.io 느낌) */
  var lip = Math.max(2, cell * 0.28);
  var shades = {};
  for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
    var o = LD_OWNER[ldIdx(x, y)];
    if (o < 0) continue;
    var below = y + 1 < LD_G ? LD_OWNER[ldIdx(x, y + 1)] : -2;
    if (below !== o) {
      ctx.fillStyle = shades[o] || (shades[o] = ldShade(ldOwnerColor(o), 0.72));
      ctx.fillRect(x * cell, y * cell + cell - 0.5, cell + 0.6, lip);
    }
  }
  for (var y2 = y0; y2 < y1; y2++) for (var x2 = x0; x2 < x1; x2++) {
    var o2 = LD_OWNER[ldIdx(x2, y2)];
    if (o2 < 0) continue;
    ctx.fillStyle = ldOwnerColor(o2);
    ctx.fillRect(x2 * cell, y2 * cell, cell + 0.6, cell + 0.6);
  }
  /* 꼬리: 부드러운 선으로 */
  function drawTrail(pts, flat, color, endX, endY) {
    var n = flat ? pts.length / 2 : pts.length;
    if (!n) return;
    ctx.beginPath();
    for (var k = 0; k < n; k++) {
      var px = flat ? pts[k * 2] : pts[k][0], py = flat ? pts[k * 2 + 1] : pts[k][1];
      if (k === 0) ctx.moveTo(px * cell, py * cell); else ctx.lineTo(px * cell, py * cell);
    }
    ctx.lineTo(endX * cell, endY * cell);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.globalAlpha = 0.55; ctx.strokeStyle = color; ctx.lineWidth = cell * 0.62; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  var disp = {};
  Object.keys(LD_OTHERS).forEach(function (pid) {
    var d = LD_OTHERS[pid];
    if (!d.alive) return;
    var p = disp[pid] = ldOtherDisplay(pid, d, now, dt || 0.016);
    if (d.trail && d.trail.length && d.pts && d.pts.length) drawTrail(d.pts, true, d.color, p.x, p.y);
  });
  if (LD.alive && LD.trail.length && !(typeof TBL !== 'undefined' && TBL.spectate)) drawTrail(LD.pts, false, LD.color, hx, hy);
  ctx.strokeStyle = '#8796ab'; ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, LD_G * cell, LD_G * cell);
  // 캐릭터
  var hs = cell;
  function drawHead(px, py, ang, color, charId, name, isMe) {
    var cx = px * cell, cy = py * cell;
    ctx.fillStyle = ldShade(color, 0.75);
    ctx.beginPath(); ctx.arc(cx, cy + hs * 0.18, hs * 0.92, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, hs * 0.12);
    ctx.beginPath(); ctx.arc(cx, cy, hs * 0.92, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    /* 가는 방향 표시(작은 화살촉) */
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * hs * 1.45, cy + Math.sin(ang) * hs * 1.45);
    ctx.lineTo(cx + Math.cos(ang + 0.45) * hs * 1.05, cy + Math.sin(ang + 0.45) * hs * 1.05);
    ctx.lineTo(cx + Math.cos(ang - 0.45) * hs * 1.05, cy + Math.sin(ang - 0.45) * hs * 1.05);
    ctx.closePath(); ctx.fill();
    var img = charId ? charImage(charId) : null;
    if (img && img.complete && img.naturalWidth) {
      var s2 = hs * 1.7, r = img.naturalWidth / img.naturalHeight;
      var flip = Math.cos(ang) > 0.15;
      ctx.save();
      ctx.translate(cx, cy - hs * 0.08);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -(s2 * Math.min(1, r)) / 2, -(s2 / Math.max(1, r)) / 2, s2 * Math.min(1, r), s2 / Math.max(1, r));
      ctx.restore();
    }
    ctx.font = 'bold ' + Math.round(Math.max(11 * LD_DPR, hs * 0.62)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(name + (isMe ? '(나)' : ''), cx, cy - hs * 1.3);
    ctx.fillStyle = '#263238';
    ctx.fillText(name + (isMe ? '(나)' : ''), cx, cy - hs * 1.3);
  }
  Object.keys(LD_OTHERS).forEach(function (pid) {
    var d = LD_OTHERS[pid], p = disp[pid];
    if (!d.alive || !p) return;
    drawHead(p.x, p.y, p.a, d.color, d.char, d.name || '', false);
  });
  var spec = typeof TBL !== 'undefined' && TBL.spectate;
  if (LD.alive && !spec) drawHead(hx, hy, LD.a, LD.color, LD.char, me.name, true);
  ldDraw.head = { x: hx * cell - camX, y: hy * cell - camY };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!LD.alive) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = 'bold ' + Math.round(H / 14) + 'px sans-serif';
    ctx.fillText('으앙! 탈락…', W / 2, H / 2 - 10 * LD_DPR);
    ctx.font = Math.round(H / 26) + 'px sans-serif';
    ctx.fillText(Math.max(0, Math.ceil((LD.deadUntil - now) / 1000)) + '초 뒤 다시 시작', W / 2, H / 2 + 24 * LD_DPR);
  }
  if (now - LD_MM_AT > 300) { LD_MM_AT = now; ldDrawMinimap(); }
}

/* 작은 지도: 칸마다 사각형을 그리지 않고 한 번에 픽셀로 찍어서 렉 없이 */
var LD_MM_IMG = null, LD_MM_CV = null;
function ldHexRgb(c) { var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c || '') || [0, 'cc', 'cc', 'cc']; return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]; }
function ldDrawMinimap() {
  var mm = document.getElementById('ld-minimap');
  var ctx = mm.getContext('2d');
  if (!LD_MM_CV || LD_MM_CV.width !== LD_G) { LD_MM_CV = document.createElement('canvas'); LD_MM_CV.width = LD_MM_CV.height = LD_G; LD_MM_IMG = LD_MM_CV.getContext('2d').createImageData(LD_G, LD_G); }
  var d = LD_MM_IMG.data, cols = {};
  for (var id = 0; id < LD_G * LD_G; id++) {
    var o = LD_OWNER[id], q = id * 4;
    if (o < 0) { d[q] = 247; d[q + 1] = 249; d[q + 2] = 252; d[q + 3] = 255; continue; }
    var c = cols[o] || (cols[o] = ldHexRgb(ldOwnerColor(o)));
    d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255;
  }
  LD_MM_CV.getContext('2d').putImageData(LD_MM_IMG, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(LD_MM_CV, 0, 0, mm.width, mm.height);
  var s = mm.width / LD_G;
  ctx.fillStyle = '#263238';
  if (LD.alive) { ctx.beginPath(); ctx.arc(LD.x * s, LD.y * s, 3, 0, Math.PI * 2); ctx.fill(); }
}

function ldUpdateBoard() {
  if (!LD_MAIN) return;
  var total = LD_G * LD_G;
  var rows = (typeof TBL !== 'undefined' && TBL.spectate) ? [] : [{ pid: myPlayerId, name: me.name, color: LD.color, score: LD.score || 0 }];
  Object.keys(LD_OTHERS).forEach(function (pid) { var d = LD_OTHERS[pid]; rows.push({ pid: pid, name: d.name, color: d.color, score: d.score || 0 }); });
  rows.sort(function (a, b) { return b.score - a.score; });
  if (LD_MAIN.teams) {
    /* 팀전: 팀별로 합친 땅 (겹친 칸은 한 번만) */
    var trows = ldTeamScores();
    document.getElementById('ld-board').innerHTML = trows.map(function (r, i) {
      return '<div class="ld-row' + (r.mine ? ' me' : '') + '"><span class="ld-dot" style="background:' + r.color + '"></span><span class="ld-name">' + (i + 1) + '. ' + r.name + '</span><b>' + (r.score / total * 100).toFixed(1) + '%</b></div>';
    }).join('');
    return;
  }
  document.getElementById('ld-board').innerHTML = rows.map(function (r, i) {
    return '<div class="ld-row' + (r.pid === myPlayerId ? ' me' : '') + '"><span class="ld-dot" style="background:' + r.color + '"></span><span class="ld-name">' + (i + 1) + '. ' + esc(r.name || '?') + '</span><b>' + (r.score / total * 100).toFixed(1) + '%</b></div>';
  }).join('');
}

function ldTeamScores(masksByPid) {
  var T = LD_MAIN.teams, n = LD_MAIN.teamN || 2, out = [];
  var masks = masksByPid || {};
  if (!masksByPid) {
    masks[myPlayerId] = LD.mask;
    Object.keys(LD_OTHERS).forEach(function (pid) { if (LD_OTHERS[pid].maskArr && LD_OTHERS[pid].alive !== false) masks[pid] = LD_OTHERS[pid].maskArr; });
  }
  for (var t = 0; t < n; t++) {
    var u = new Uint8Array(LD_G * LD_G), sc = 0;
    Object.keys(masks).forEach(function (pid) { if (T[pid] !== t) return; var m = masks[pid]; for (var i = 0; i < m.length; i++) if (m[i] && !u[i]) { u[i] = 1; sc++; } });
    out.push({ team: t, name: TEAM_NAMES[t], color: TEAM_COLORS[t], score: sc, mine: T[myPlayerId] === t, members: Object.keys(T).filter(function (p) { return T[p] === t; }) });
  }
  return out.sort(function (a, b) { return b.score - a.score; });
}

/* 방장: 시간이 끝나면 모두의 최종 땅을 모아서 결과 확정 */
function ldHostFinish(st) {
  DBgetPrefix('ld_', st.order).then(function (all) {
    var res = st.order.map(function (pid) {
      var d = all[pid];
      return { pid: pid, name: st.names[pid], score: d && d.gameId === st.gameId ? (d.score || 0) : 0, kills: d ? d.kills || 0 : 0, color: d ? d.color : '#ccc' };
    }).sort(function (a, b) { return b.score - a.score; });
    var teamRes = null;
    if (st.teams) {
      var masks = {};
      st.order.forEach(function (pid) { var d = all[pid]; if (d && d.gameId === st.gameId && d.mask) masks[pid] = ldUnB64(d.mask); });
      teamRes = ldTeamScores(masks).map(function (r) { return { team: r.team, name: r.name, score: r.score, members: r.members }; });
    }
    DBget(ldKey()).then(function (cur) {
      if (!cur || cur.gameId !== st.gameId || cur.phase !== 'play') return;
      cur.phase = 'end'; cur.results = res; cur.teamResults = teamRes;
      DBset(ldKey(), cur).then(ldPollMain);
    });
  });
}

function ldShowResult(st) {
  var box = document.getElementById('ld-result');
  if (box.style.display !== 'none' && box.getAttribute('data-g') === String(st.gameId)) return;
  box.setAttribute('data-g', st.gameId);
  box.style.display = '';
  var total = LD_G * LD_G;
  var r = st.results || [];
  if (st.teamResults && st.teamResults.length) {
    var tr = st.teamResults, top = tr[0];
    document.getElementById('ld-result-banner').textContent = '🏆 ' + top.name + ' 승리! (' + (top.score / total * 100).toFixed(1) + '%)';
    renderRankBoard('ld-result-rank', tr.map(function (x) { return { name: x.name + ' (' + x.members.map(function (p) { return st.names[p] || '?'; }).join(', ') + ')', isMe: x.members.indexOf(myPlayerId) >= 0, label: (x.score / total * 100).toFixed(1) + '%' }; }));
    typeof celebrateWin === 'function' && celebrateWin('land:' + st.gameId, top.members.map(function (p) { return st.names[p]; }), '땅따먹기 팀전 · ' + top.name);
    document.getElementById('ld-restart-btn').style.display = myPlayerId === roomHostId ? '' : 'none';
    return;
  }
  document.getElementById('ld-result-banner').textContent = r.length ? ('🏆 ' + r[0].name + ' 승리! (' + (r[0].score / total * 100).toFixed(1) + '%)') : '게임 끝!';
  if (r.length) typeof celebrateWin === 'function' && celebrateWin('land:' + st.gameId, [r[0].name], '땅따먹기 · ' + (r[0].score / total * 100).toFixed(1) + '%');
  renderRankBoard('ld-result-rank', r.map(function (x) { return { name: x.name, isMe: x.pid === myPlayerId, label: (x.score / total * 100).toFixed(1) + '% · 꼬리 끊기 ' + x.kills + '번' }; }));
  document.getElementById('ld-restart-btn').style.display = myPlayerId === roomHostId ? '' : 'none';
}

(function ldSetupInput() {
  var KEYS = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', KeyW: 'u', KeyS: 'd', KeyA: 'l', KeyD: 'r' };
  var active = function () { return document.getElementById('land') && document.getElementById('land').classList.contains('active'); };
  document.addEventListener('keydown', function (e) {
    if (!active()) return;
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    var k = KEYS[e.code] || KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    LD_CTRL.mode = 'keys';
    LD_CTRL.keys[k] = true;
    ldKeysTarget();
  });
  document.addEventListener('keyup', function (e) {
    var k = KEYS[e.code] || KEYS[e.key];
    if (k) LD_CTRL.keys[k] = false;
  });
  window.addEventListener('blur', function () { LD_CTRL.keys = {}; });
  var cv = document.getElementById('ld-canvas');
  if (!cv) return;
  /* 마우스: 캔버스 위에서 움직이면 마우스 쪽으로 가요 */
  cv.addEventListener('mousemove', function (e) {
    LD_CTRL.mx = e.clientX; LD_CTRL.my = e.clientY;
    if (!Object.keys(LD_CTRL.keys).some(function (k) { return LD_CTRL.keys[k]; })) LD_CTRL.mode = 'mouse';
  });
  /* 터치: 손가락을 댄 곳에서 끄는 방향으로 가요 (조이스틱처럼) */
  cv.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    LD_CTRL.touch = { x: e.clientX, y: e.clientY };
    LD_CTRL.mode = 'touch';
  });
  cv.addEventListener('pointermove', function (e) {
    var t = LD_CTRL.touch;
    if (e.pointerType === 'mouse' || !t) return;
    var dx = e.clientX - t.x, dy = e.clientY - t.y;
    if (dx * dx + dy * dy < 100) return;
    ldSetTarget(Math.atan2(dy, dx));
    /* 시작점이 손가락을 천천히 따라와서, 계속 끌면서 방향을 바꿀 수 있어요 */
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 40) { t.x = e.clientX - dx / dist * 40; t.y = e.clientY - dy / dist * 40; }
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) { cv.addEventListener(ev, function () { LD_CTRL.touch = null; }); });
  document.querySelectorAll('#ld-pad [data-d]').forEach(function (b) {
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var d = b.getAttribute('data-d').split(',');
      ldSetDir(+d[0], +d[1]);
    });
  });
})();
