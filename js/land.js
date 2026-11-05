/* ---------------- 땅따먹기 (온라인, 2~10명, 실시간) ----------------
   내 땅(색칠된 칸)에서 밖으로 나가면 꼬리(선)가 생기고, 다시 내 땅으로 돌아오면 꼬리로 둘러싼
   공간이 전부 내 땅이 돼요. 내가 밖에 나가 있을 때 다른 사람이 내 꼬리를 밟거나, 내가 내 꼬리를
   밟으면 탈락(3초 뒤 작은 땅에서 다시 시작). 2분 동안 땅을 가장 넓게 차지한 사람이 승리!
   - 내 움직임/땅 계산은 내 화면이 직접 하고, roomKey('ld_'+내id)에 0.2초마다 올려요.
   - 다른 사람 상태는 서버 일괄조회(DBgetPrefix)로 한 번에 읽어요.
   - 다른 사람이 내 땅을 뺏으면(그 사람이 나보다 나중에 땅을 차지했으면) 겹친 칸은 그 사람 것. */
var LD_G = 100;                // 판 크기 (100×100칸)
var LD_SPEED = 6.2;            // 칸/초
var LD_ROUND_MS = 210000;      // 3분 30초 (판이 커져서 조금 늘림)
var LD_RESPAWN_MS = 3000;
var LD_COLORS = ['#ef5350', '#42a5f5', '#43a047', '#ffa726', '#ab47bc', '#26c6da', '#c0ca33', '#ec407a', '#ffca28', '#26a69a'];
var LD_MIN = 2, LD_MAX = 10;

var LD = null;           // 내 게임 상태
var LD_MAIN = null;      // 방 공용 상태 roomKey('land')
var LD_OTHERS = {};      // 다른 사람들 최신 상태 {pid: data}
var LD_RAF = null, LD_POLL = null, LD_NET = null;
var LD_CANVAS = null, LD_CTX = null, LD_DPR = 1;
var LD_PICK = null;
var LD_KILL_AT = {};

function ldKey() { return roomKey('land'); }
function ldMyKey() { return roomKey('ld_' + myPlayerId); }
function ldIdx(x, y) { return y * LD_G + x; }

function stopLandGame() {
  cancelAnimationFrame(LD_RAF); LD_RAF = null;
  clearInterval(LD_POLL); LD_POLL = null;
  clearInterval(LD_NET); LD_NET = null;
}

function startLandGame() {
  stopLandGame();
  LD = null; LD_MAIN = null; LD_OTHERS = {};
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
    LD_NET = setInterval(ldNetTick, 200);
    LD_RAF = requestAnimationFrame(ldFrame);
  });
}

function ldHostInit() {
  var order = shuffleArray((roomPlayersList || []).map(function (p) { return p.id; }));
  var names = {}, spawns = {};
  (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; });
  order.forEach(function (pid, i) {
    var a = (i / order.length) * Math.PI * 2;
    spawns[pid] = { x: Math.round(LD_G / 2 + Math.cos(a) * LD_G * 0.3), y: Math.round(LD_G / 2 + Math.sin(a) * LD_G * 0.3), color: LD_COLORS[i % LD_COLORS.length] };
  });
  var startAt = Date.now() + 9000; // 캐릭터 고를 시간
  return DBset(ldKey(), { gameId: Date.now(), order: order, names: names, spawns: spawns, startAt: startAt, endAt: startAt + LD_ROUND_MS, phase: 'play' });
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
  var sp = st.spawns[myPlayerId] || { x: 10, y: 10, color: LD_COLORS[0] };
  LD = {
    gameId: st.gameId, color: sp.color, char: LD_PICK || (charLoadChoice() || {}).id || null,
    mask: new Uint8Array(LD_G * LD_G), trail: [], trailMask: new Uint8Array(LD_G * LD_G),
    x: sp.x, y: sp.y, px: sp.x, py: sp.y, dir: [1, 0], nextDir: null, turns: [], stepT: 0,
    alive: true, deadUntil: 0, cap: Date.now(), hits: [], kills: 0, deaths: 0, killedBy: null,
    trailTime: {}, recentTrail: null, seenDeaths: {}
  };
  LD_PROCESSED = {}; LD_BIGMAP = false; LD_OWNER_DIRTY = true;
  ldFillSquare(sp.x, sp.y, 2);
  document.getElementById('ld-result').style.display = 'none';
  document.getElementById('ld-pick-box').style.display = '';
}

function ldFillSquare(cx, cy, r) {
  for (var y = cy - r; y <= cy + r; y++) for (var x = cx - r; x <= cx + r; x++) {
    if (x >= 0 && y >= 0 && x < LD_G && y < LD_G) LD.mask[ldIdx(x, y)] = 1;
  }
}

/* ---- 내 움직임 ---- */
/* 방향 바꾸기: 빠르게 두 번 꺾는 것(예: ↑ 다음 바로 →)도 놓치지 않게 최대 2개까지 미리 받아둬요 */
function ldSetDir(dx, dy) {
  if (!LD || !LD.alive) return;
  var q = LD.turns || (LD.turns = []);
  var cur = q.length ? q[q.length - 1] : LD.dir;
  if (cur[0] === dx && cur[1] === dy) return;
  if (cur[0] === -dx && cur[1] === -dy) return; // 바로 뒤로는 못 돌아요
  if (q.length >= 2) q[1] = [dx, dy]; else q.push([dx, dy]);
}

function ldStep() {
  if (LD.turns && LD.turns.length) {
    var nd = LD.turns.shift();
    if (!(nd[0] === -LD.dir[0] && nd[1] === -LD.dir[1])) LD.dir = nd;
  }
  var nx = LD.x + LD.dir[0], ny = LD.y + LD.dir[1];
  LD.px = LD.x; LD.py = LD.y;
  if (nx < 0 || ny < 0 || nx >= LD_G || ny >= LD_G) return; // 벽에서는 멈춰요(방향을 바꾸세요)
  LD.x = nx; LD.y = ny;
  var id = ldIdx(nx, ny);
  if (LD.trailMask[id]) { ldDie(null, '내 꼬리를 밟았어요'); return; }
  ldCheckHit(id);
  if (LD.mask[id]) {
    if (LD.trail.length) ldCapture();
  } else {
    LD.trail.push(id);
    LD.trailMask[id] = 1;
    LD.trailTime[id] = Date.now();
  }
}

/* 내가 다른 사람 꼬리를 밟았을 때: "누구의 몇 번 칸을 밟았다"는 기록(hit)을 내 상태에 올려요.
   상대 화면이 그 칸이 "지금도" 자기 꼬리인지 확인한 뒤에만 탈락시켜요.
   (예전엔 상대의 '최근 지나간 칸'으로 판정해서, 이미 지나간 자리나 내가 끊은 순간에 엉뚱하게
   내가 죽는 문제가 있었어요) */
function ldCheckHit(id) {
  Object.keys(LD_OTHERS).forEach(function (pid) {
    var d = LD_OTHERS[pid];
    if (!d.alive || !d.trailSet) return;
    /* 상대 꼬리 + (꼬리가 있을 때) 상대가 지금 막 지나는 칸까지 꼬리로 봐요 - 아직 못 받은 최신 꼬리 보완 */
    var onTrail = d.trailSet[id];
    if (!onTrail && d.trail && d.trail.length) { var hp = ldOtherPos(d, Date.now()); onTrail = ldIdx(Math.round(hp.x), Math.round(hp.y)) === id && !(d.maskArr && d.maskArr[id]); }
    if (!onTrail) return;
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
  LD.recentTrail = { mask: LD.trailMask, until: Date.now() + 900 }; /* 방금 닫은 꼬리: 0.9초 안에 끊긴 거면 인정 */
  LD.trail.forEach(function (id) { mask[id] = 1; });
  var outside = new Uint8Array(G * G);
  var stack = [];
  for (var i = 0; i < G; i++) {
    [ldIdx(i, 0), ldIdx(i, G - 1), ldIdx(0, i), ldIdx(G - 1, i)].forEach(function (id) {
      if (!mask[id] && !outside[id]) { outside[id] = 1; stack.push(id); }
    });
  }
  while (stack.length) {
    var id = stack.pop();
    var x = id % G, y = (id - x) / G;
    if (x > 0 && !mask[id - 1] && !outside[id - 1]) { outside[id - 1] = 1; stack.push(id - 1); }
    if (x < G - 1 && !mask[id + 1] && !outside[id + 1]) { outside[id + 1] = 1; stack.push(id + 1); }
    if (y > 0 && !mask[id - G] && !outside[id - G]) { outside[id - G] = 1; stack.push(id - G); }
    if (y < G - 1 && !mask[id + G] && !outside[id + G]) { outside[id + G] = 1; stack.push(id + G); }
  }
  for (var j = 0; j < G * G; j++) if (!outside[j]) mask[j] = 1;
  LD.trail = [];
  LD.trailMask = new Uint8Array(G * G);
  LD.trailTime = {};
  LD.cap = Date.now();
  LD_OWNER_DIRTY = true;
  ldPublish(true);
}

function ldDie(byPid, why) {
  if (!LD.alive) return;
  LD.alive = false;
  LD.deaths++;
  LD.killedBy = byPid;
  LD.deadUntil = Date.now() + LD_RESPAWN_MS;
  LD.mask = new Uint8Array(LD_G * LD_G);
  LD.trail = []; LD.trailMask = new Uint8Array(LD_G * LD_G);
  LD.trailTime = {}; LD.recentTrail = null; LD.turns = [];
  LD.cap = Date.now();
  LD_OWNER_DIRTY = true;
  if (why) ldToast('💥 ' + why);
  ldPublish(true);
}

function ldRespawn() {
  // 다른 사람 땅이 적은 곳을 골라 다시 시작
  var best = null, bestScore = -1;
  for (var t = 0; t < 30; t++) {
    var x = 3 + Math.floor(Math.random() * (LD_G - 6)), y = 3 + Math.floor(Math.random() * (LD_G - 6));
    var free = 0;
    for (var yy = y - 2; yy <= y + 2; yy++) for (var xx = x - 2; xx <= x + 2; xx++) if (LD_OWNER[ldIdx(xx, yy)] < 0) free++;
    if (free > bestScore) { bestScore = free; best = { x: x, y: y }; }
  }
  LD.x = LD.px = best.x; LD.y = LD.py = best.y;
  LD.dir = [1, 0]; LD.nextDir = null; LD.turns = [];
  LD.alive = true; LD.killedBy = null;
  LD.stepT = 0;
  ldFillSquare(best.x, best.y, 2);
  LD.cap = Date.now();
  LD_OWNER_DIRTY = true;
  LD_BIGMAP = false;
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
var LD_BIGMAP = false;
var LD_MM_AT = 0;

/* 렉 줄이기: 이전 요청이 아직 안 끝났으면 새 요청을 쌓지 않아요 */
function ldPublish(force) {
  if (!LD || !LD_MAIN) return;
  var now = Date.now();
  if (!force && now - LD_LAST_PUB < 180) return;
  if (LD_PUB_BUSY) { LD_PUB_AGAIN = true; return; }
  LD_LAST_PUB = now;
  var score = 0;
  for (var i = 0; i < LD.mask.length; i++) score += LD.mask[i];
  LD.score = score;
  LD_PUB_BUSY = true;
  DBset(ldMyKey(), {
    gameId: LD.gameId, name: me.name, color: LD.color, char: LD.char,
    x: LD.x, y: LD.y, fx: Math.round(ldHeadPos()[0] * 100) / 100, fy: Math.round(ldHeadPos()[1] * 100) / 100, dir: LD.dir, alive: LD.alive, t: now,
    mask: ldB64(LD.mask), cap: LD.cap, trail: LD.trail.slice(-400), hits: LD.hits.slice(),
    score: score, kills: LD.kills, deaths: LD.deaths, killedBy: LD.killedBy
  }).then(function () {
    LD_PUB_BUSY = false;
    if (LD_PUB_AGAIN) { LD_PUB_AGAIN = false; ldPublish(true); }
  });
}

function ldNetTick() {
  if (!LD_MAIN || !LD) return;
  ldPublish(false);
  if (LD_FETCH_BUSY) return;
  LD_FETCH_BUSY = true;
  var others = LD_MAIN.order.filter(function (p) { return p !== myPlayerId; });
  DBgetPrefix('ld_', others).then(function (all) {
    LD_FETCH_BUSY = false;
    var now = Date.now();
    Object.keys(all).forEach(function (pid) {
      var d = all[pid];
      if (!d || d.gameId !== LD_MAIN.gameId) return;
      var prev = LD_OTHERS[pid];
      if (prev && prev.t === d.t) return;
      d.maskArr = (prev && prev.mask === d.mask && prev.maskArr) ? prev.maskArr : ldUnB64(d.mask);
      d.trailSet = {};
      (d.trail || []).forEach(function (id) { d.trailSet[id] = 1; });
      // 부드럽게 움직이기: 화면에 보이던 위치에서 새 위치까지 천천히 이어서 그려요
      var cur = prev ? ldOtherPos(prev, now) : { x: d.x, y: d.y };
      var far = Math.abs(cur.x - d.x) + Math.abs(cur.y - d.y) > 4;
      d.fromX = far ? d.x : cur.x; d.fromY = far ? d.y : cur.y;
      d.lerpStart = now;
      d.lerpDur = prev ? Math.max(120, Math.min(450, now - (prev.recvAt || now))) : 200;
      d.recvAt = now;
      d.prevX = prev ? prev.x : d.x; d.prevY = prev ? prev.y : d.y;
      /* 위치 기록(보낸 시각 + 부드러운 위치)을 모아 두고, 0.2초 전 모습을 이어서 그려요 */
      d.hist = (prev && prev.hist) ? prev.hist : [];
      var hx0 = d.fx != null ? d.fx : d.x, hy0 = d.fy != null ? d.fy : d.y;
      var lastH = d.hist[d.hist.length - 1];
      if (lastH && (Math.abs(lastH.x - hx0) + Math.abs(lastH.y - hy0) > 4 || d.alive !== (prev && prev.alive))) d.hist = []; /* 다시 시작 등 순간이동 */
      if (!lastH || d.t > lastH.t) d.hist.push({ t: d.t, x: hx0, y: hy0 });
      if (d.hist.length > 30) d.hist.splice(0, d.hist.length - 30);
      var off = now - d.t;
      d.clockOff = prev && prev.clockOff != null ? Math.min(prev.clockOff + 2, off) : off; /* 서로 시계 차이(가장 빨리 온 값 기준) */
      /* 인터넷이 느릴수록(늦게 도착할수록) 조금 더 뒤의 모습을 그려서 끊기지 않게 - 자동 조절 */
      var lag = off - d.clockOff;
      d.lagMax = Math.max(lag, ((prev && prev.lagMax) || 0) * 0.97);
      /* 그 사람이 나를 끊었다고 확정되면(내 화면 말고 상대 화면이 판정) 내 '꼬리 끊기' 횟수 +1 */
      if (prev && (d.deaths || 0) > (prev.deaths || 0) && d.killedBy === myPlayerId) {
        LD.kills++;
        ldToast('⚔️ ' + (d.name || '') + '님의 꼬리를 끊었어요!');
      }
      LD_OTHERS[pid] = d;
      if (!prev || prev.mask !== d.mask || prev.cap !== d.cap) LD_OWNER_DIRTY = true;
    });
    ldResolveConflicts();
  }).catch(function () { LD_FETCH_BUSY = false; });
  ldUpdateBoard();
}

function ldOtherPos(d, now) {
  var k = Math.min(1, (now - (d.lerpStart || now)) / (d.lerpDur || 200));
  var fx = d.fromX != null ? d.fromX : d.x, fy = d.fromY != null ? d.fromY : d.y;
  return { x: fx + (d.x - fx) * k, y: fy + (d.y - fy) * k };
}

/* 다른 사람과의 충돌/땅 뺏김 판정 (내 화면에서 나에 대해서만 판단) */
function ldResolveConflicts() {
  if (!LD || Date.now() < LD_MAIN.startAt) return;
  Object.keys(LD_OTHERS).forEach(function (pid) {
    var d = LD_OTHERS[pid];
    // 1) 누가 "내 꼬리를 밟았다"고 기록했고, 그 칸이 지금도 내 꼬리면 탈락
    var now = Date.now();
    (d.hits || []).forEach(function (h) {
      if (h.to !== myPlayerId || LD_PROCESSED[h.id]) return;
      LD_PROCESSED[h.id] = 1;
      var rt = LD.recentTrail;
      var onMine = LD.trailMask[h.cell] || (rt && now < rt.until && rt.mask[h.cell]);
      if (LD.alive && onMine) ldDie(pid, (d.name || '누군가') + '님이 내 꼬리를 밟았어요!');
    });
    /* 내 화면에서도 직접 확인: 그 사람이 지난번~이번 위치 사이에 지나간 칸 중에 내 꼬리가 있으면 탈락 */
    if (LD.alive && d.alive !== false && LD.trail.length && d.recvAt && now - d.recvAt < 1000 && !d.pathChecked) {
      d.pathChecked = true;
      var cells = ldPathCells(d.prevX, d.prevY, d.x, d.y, d.dir);
      for (var ci = 0; ci < cells.length; ci++) {
        var cid = cells[ci];
        if (LD.trailMask[cid] && (LD.trailTime[cid] || 0) < d.recvAt - 120) { ldDie(pid, (d.name || '누군가') + '님이 내 꼬리를 밟았어요!'); break; }
      }
    }
    // 2) 그 사람이 나보다 나중에 땅을 차지했으면 겹친 칸은 그 사람 것
    if (LD.alive && d.alive !== false && d.cap > LD.cap && d.maskArr) {
      var changed = false;
      for (var i = 0; i < LD.mask.length; i++) if (LD.mask[i] && d.maskArr[i]) { LD.mask[i] = 0; changed = true; }
      if (changed) {
        LD_OWNER_DIRTY = true;
        /* 내 땅을 전부 빼앗기면 탈락 */
        var left = 0;
        for (var k = 0; k < LD.mask.length && !left; k++) left = LD.mask[k];
        if (!left) ldDie(pid, (d.name || '누군가') + '님에게 땅을 모두 빼앗겼어요!');
      }
    }
  });
}

/* 지난번 위치 → 이번 위치까지 지나간 칸들 (격자로만 움직이니 가로·세로로 이어서 계산) */
function ldPathCells(x0, y0, x1, y1, dir) {
  var out = [];
  if (Math.abs(x1 - x0) + Math.abs(y1 - y0) > 8) return [ldIdx(x1, y1)]; /* 순간이동(다시 시작 등)은 무시 */
  var x = x0, y = y0;
  /* 마지막 방향이 세로면 가로를 먼저, 가로면 세로를 먼저 움직였다고 봐요 */
  var vertLast = dir && dir[1] !== 0;
  var moveX = function () { while (x !== x1) { x += x1 > x ? 1 : -1; out.push(ldIdx(x, y)); } };
  var moveY = function () { while (y !== y1) { y += y1 > y ? 1 : -1; out.push(ldIdx(x, y)); } };
  if (vertLast) { moveX(); moveY(); } else { moveY(); moveX(); }
  if (!out.length) out.push(ldIdx(x1, y1));
  return out;
}

/* 칸 주인 표를 한 번에 계산해 두고(땅이 바뀔 때만), 그릴 때는 표만 봐요 → 렉 감소 */
function ldRebuildOwners() {
  LD_OWNER_DIRTY = false;
  LD_OWNER_LIST = Object.keys(LD_OTHERS).sort(function (a, b) { return (LD_OTHERS[a].cap || 0) - (LD_OTHERS[b].cap || 0); });
  LD_OWNER.fill(-1);
  LD_OWNER_LIST.forEach(function (pid, k) {
    var m = LD_OTHERS[pid].maskArr;
    if (!m) return;
    for (var i = 0; i < m.length; i++) if (m[i]) LD_OWNER[i] = k + 1;
  });
  if (LD) for (var j = 0; j < LD.mask.length; j++) if (LD.mask[j]) LD_OWNER[j] = 0;
  LD_MM_AT = 0;
}
function ldOwnerColor(o) {
  if (o === 0) return LD.color;
  var pid = LD_OWNER_LIST[o - 1];
  return (pid && LD_OTHERS[pid] && LD_OTHERS[pid].color) || '#ccc';
}
function ldOwnerOf(id) {
  var o = LD_OWNER[id];
  return o < 0 ? null : (o === 0 ? myPlayerId : LD_OWNER_LIST[o - 1]);
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
  if (!LD || !LD_MAIN || !document.getElementById('land').classList.contains('active')) return;
  var now = Date.now();
  var dt = ldFrame.last ? Math.min(0.05, (ts - ldFrame.last) / 1000) : 0.016;
  ldFrame.last = ts;
  var started = now >= LD_MAIN.startAt;
  var ended = now >= LD_MAIN.endAt || LD_MAIN.phase === 'end';
  document.getElementById('ld-pick-box').style.display = started ? 'none' : '';
  if (!started) {
    document.getElementById('ld-count').textContent = Math.ceil((LD_MAIN.startAt - now) / 1000);
  }
  if (started && !ended) {
    if (LD.alive) {
      LD.stepT += dt * LD_SPEED;
      while (LD.stepT >= 1 && LD.alive) { LD.stepT -= 1; ldStep(); }
    } else if (now >= LD.deadUntil) ldRespawn();
  }
  if (LD_OWNER_DIRTY) ldRebuildOwners();
  var remain = Math.max(0, Math.ceil((LD_MAIN.endAt - now) / 1000));
  document.getElementById('ld-time').textContent = started ? (Math.floor(remain / 60) + ':' + ('0' + remain % 60).slice(-2)) : '준비';
  ldDraw();
}

/* 내 머리 위치: '지금 칸 → 다음 칸' 사이를 끊김 없이 이어서 (칸을 넘는 순간에도 위치가 그대로 이어져요) */
function ldHeadPos() {
  if (!LD) return [0, 0];
  var t = LD.alive ? Math.max(0, Math.min(1, LD.stepT)) : 0;
  var nxp = LD.x + LD.dir[0], nyp = LD.y + LD.dir[1];
  if (nxp < 0 || nyp < 0 || nxp >= LD_G || nyp >= LD_G) t = 0;
  return [LD.x + LD.dir[0] * t, LD.y + LD.dir[1] * t];
}
/* 친구 위치: 받은 칸에서 그 친구 방향으로 일정한 속도로 미리 움직여 그리고(예측),
   새 위치를 받으면 화면 위치를 살살 당겨서 맞춰요 → 속도가 들쭉날쭉하지 않게 */
var LD_INTERP_DELAY = 380;
var LD_DELAY_S = {};
function ldOtherDisplay(d, now) {
  var h = d.hist;
  if (!h || !h.length) return { x: d.x, y: d.y };
  var target = Math.max(LD_INTERP_DELAY, Math.min(900, (d.lagMax || 0) + 280));
  /* 지연 시간은 아주 천천히만 바꿔서(갑자기 바뀌면 화면이 튀어요) */
  var delay = LD_DELAY_S[d.name || ''] != null ? LD_DELAY_S[d.name || ''] : target;
  delay += (target - delay) * 0.01;
  LD_DELAY_S[d.name || ''] = delay;
  var rt = now - (d.clockOff || 0) - delay;
  if (rt <= h[0].t) return { x: h[0].x, y: h[0].y };
  for (var i = h.length - 1; i > 0; i--) {
    if (h[i - 1].t <= rt) {
      if (rt <= h[i].t) {
        var k = (rt - h[i - 1].t) / Math.max(1, h[i].t - h[i - 1].t);
        return { x: h[i - 1].x + (h[i].x - h[i - 1].x) * k, y: h[i - 1].y + (h[i].y - h[i - 1].y) * k };
      }
      break;
    }
  }
  /* 새 기록이 늦게 오면 마지막 방향으로 조금(최대 1칸)만 이어서 */
  var L = h[h.length - 1], dir = d.dir || [0, 0];
  var ahead = Math.min(1, Math.max(0, (rt - L.t) / 1000 * LD_SPEED));
  return { x: Math.max(0, Math.min(LD_G - 1, L.x + dir[0] * ahead)), y: Math.max(0, Math.min(LD_G - 1, L.y + dir[1] * ahead)) };
}

function ldResize() {
  var rect = LD_CANVAS.getBoundingClientRect();
  LD_DPR = window.devicePixelRatio || 1;
  var w = Math.round(rect.width * LD_DPR), h = Math.round(rect.height * LD_DPR);
  if (LD_CANVAS.width !== w || LD_CANVAS.height !== h) { LD_CANVAS.width = w; LD_CANVAS.height = h; }
}

function ldDraw() {
  ldResize();
  var ctx = LD_CTX, W = LD_CANVAS.width, H = LD_CANVAS.height;
  var now = Date.now();
  var big = LD_BIGMAP;
  var cell = big ? Math.min(W, H) / (LD_G + 1) : Math.max(10, Math.min(W, H) / 22);
  /* 머리는 '지금 칸 → 다음 칸' 사이를 그려서 누르는 즉시 반응하는 느낌 */
  var hp0 = ldHeadPos(), hx = hp0[0], hy = hp0[1];
  var camX, camY;
  if (big) { camX = (LD_G * cell - W) / 2; camY = (LD_G * cell - H) / 2; }
  else {
    var tx = hx * cell + cell / 2 - W / 2, ty = hy * cell + cell / 2 - H / 2;
    var cs = ldDraw.cam;
    if (!cs || Math.abs(cs.x - tx) > W || Math.abs(cs.y - ty) > H || cs.cell !== cell) cs = ldDraw.cam = { x: tx, y: ty, cell: cell };
    cs.x += (tx - cs.x) * 0.35; cs.y += (ty - cs.y) * 0.35;
    camX = cs.x; camY = cs.y;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#e9eef5';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(-camX, -camY);
  ctx.fillStyle = '#f7f9fc';
  ctx.fillRect(0, 0, LD_G * cell, LD_G * cell);
  var x0 = Math.max(0, Math.floor(camX / cell)), x1 = Math.min(LD_G, Math.ceil((camX + W) / cell));
  var y0 = Math.max(0, Math.floor(camY / cell)), y1 = Math.min(LD_G, Math.ceil((camY + H) / cell));
  if (!big) {
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = x0; gx <= x1; gx++) { ctx.moveTo(gx * cell, y0 * cell); ctx.lineTo(gx * cell, y1 * cell); }
    for (var gy = y0; gy <= y1; gy++) { ctx.moveTo(x0 * cell, gy * cell); ctx.lineTo(x1 * cell, gy * cell); }
    ctx.stroke();
  }
  // 땅 (미리 계산한 주인 표 사용)
  ctx.globalAlpha = 0.72;
  for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
    var o = LD_OWNER[ldIdx(x, y)];
    if (o < 0) continue;
    ctx.fillStyle = ldOwnerColor(o);
    ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
  }
  ctx.globalAlpha = 1;
  // 꼬리
  function drawTrail(list, color) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    for (var k = 0; k < list.length; k++) { var id = list[k], x2 = id % LD_G, y2 = (id - x2) / LD_G; ctx.fillRect(x2 * cell + cell * 0.18, y2 * cell + cell * 0.18, cell * 0.64, cell * 0.64); }
    ctx.globalAlpha = 1;
  }
  Object.keys(LD_OTHERS).forEach(function (pid) { var d = LD_OTHERS[pid]; if (d.alive) drawTrail(d.trail || [], d.color); });
  drawTrail(LD.trail, LD.color);
  ctx.strokeStyle = '#6b7a90'; ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, LD_G * cell, LD_G * cell);
  // 캐릭터
  var hs = big ? Math.max(cell, 9) : cell;
  function drawHead(px, py, color, charId, name, isMe) {
    var cx = px * cell + cell / 2, cy = py * cell + cell / 2;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, hs * 0.78, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    var img = charId ? charImage(charId) : null;
    if (img && img.complete && img.naturalWidth) {
      var s2 = hs * 1.5, r = img.naturalWidth / img.naturalHeight;
      ctx.drawImage(img, cx - (s2 * Math.min(1, r)) / 2, cy - (s2 / Math.max(1, r)) / 2 - hs * 0.1, s2 * Math.min(1, r), s2 / Math.max(1, r));
    }
    ctx.font = 'bold ' + Math.round(Math.max(11 * LD_DPR, hs * 0.6)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(name + (isMe ? '(나)' : ''), cx, cy - hs * 1.1);
    ctx.fillStyle = '#263238';
    ctx.fillText(name + (isMe ? '(나)' : ''), cx, cy - hs * 1.1);
  }
  Object.keys(LD_OTHERS).forEach(function (pid) {
    var d = LD_OTHERS[pid];
    if (!d.alive) return;
    var p = ldOtherDisplay(d, now);
    drawHead(p.x, p.y, d.color, d.char, d.name || '', false);
  });
  if (LD.alive) drawHead(hx, hy, LD.color, LD.char, me.name, true);
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
  if (LD.alive) { ctx.beginPath(); ctx.arc(LD.x * s + s / 2, LD.y * s + s / 2, 3, 0, Math.PI * 2); ctx.fill(); }
}

function ldUpdateBoard() {
  if (!LD_MAIN) return;
  var total = LD_G * LD_G;
  var rows = [{ pid: myPlayerId, name: me.name, color: LD.color, score: LD.score || 0 }];
  Object.keys(LD_OTHERS).forEach(function (pid) { var d = LD_OTHERS[pid]; rows.push({ pid: pid, name: d.name, color: d.color, score: d.score || 0 }); });
  rows.sort(function (a, b) { return b.score - a.score; });
  document.getElementById('ld-board').innerHTML = rows.map(function (r, i) {
    return '<div class="ld-row' + (r.pid === myPlayerId ? ' me' : '') + '"><span class="ld-dot" style="background:' + r.color + '"></span><span class="ld-name">' + (i + 1) + '. ' + esc(r.name || '?') + '</span><b>' + (r.score / total * 100).toFixed(1) + '%</b></div>';
  }).join('');
}

/* 방장: 시간이 끝나면 모두의 최종 땅을 모아서 결과 확정 */
function ldHostFinish(st) {
  DBgetPrefix('ld_', st.order).then(function (all) {
    var res = st.order.map(function (pid) {
      var d = all[pid];
      return { pid: pid, name: st.names[pid], score: d && d.gameId === st.gameId ? (d.score || 0) : 0, kills: d ? d.kills || 0 : 0, color: d ? d.color : '#ccc' };
    }).sort(function (a, b) { return b.score - a.score; });
    DBget(ldKey()).then(function (cur) {
      if (!cur || cur.gameId !== st.gameId || cur.phase !== 'play') return;
      cur.phase = 'end'; cur.results = res;
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
  document.getElementById('ld-result-banner').textContent = r.length ? ('🏆 ' + r[0].name + ' 승리! (' + (r[0].score / total * 100).toFixed(1) + '%)') : '게임 끝!';
  renderRankBoard('ld-result-rank', r.map(function (x) { return { name: x.name, isMe: x.pid === myPlayerId, label: (x.score / total * 100).toFixed(1) + '% · 꼬리 끊기 ' + x.kills + '번' }; }));
  document.getElementById('ld-restart-btn').style.display = myPlayerId === roomHostId ? '' : 'none';
}

(function ldSetupInput() {
  var KEYMAP = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
  document.addEventListener('keydown', function (e) {
    if (!document.getElementById('land').classList.contains('active')) return;
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    var CODEMAP = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
    var d = KEYMAP[e.key] || CODEMAP[e.code];
    if (d) { e.preventDefault(); ldSetDir(d[0], d[1]); }
  });
  var cv = document.getElementById('ld-canvas');
  if (!cv) return;
  var sx = null, sy = null;
  cv.addEventListener('pointerdown', function (e) {
    sx = e.clientX; sy = e.clientY;
  });
  cv.addEventListener('pointermove', function (e) {
    if (sx === null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) ldSetDir(dx > 0 ? 1 : -1, 0); else ldSetDir(0, dy > 0 ? 1 : -1);
    sx = e.clientX; sy = e.clientY;
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) { cv.addEventListener(ev, function () { sx = sy = null; }); });
  document.querySelectorAll('#ld-pad [data-d]').forEach(function (b) {
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var d = b.getAttribute('data-d').split(',');
      ldSetDir(+d[0], +d[1]);
    });
  });
})();
