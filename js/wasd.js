/* ---------------- WASD 대모험 (온라인 협동, 1~4명) ----------------
   캐릭터 하나를 다 같이 조종해요. W(위)·A(왼쪽)·S(아래)·D(오른쪽) 키를 사람마다 랜덤으로 나눠 맡고,
   내가 맡은 키만 누를 수 있어요. 캐릭터는 출발하면 멈추지 않고 계속 가요!
   돌·나무(벽)에 부딪히면 탈락 → 그 스테이지 처음부터. 코인을 다 모으고 깃발에 도착하면 다음 스테이지.
   6스테이지를 모두 깨면 끝! 사망 횟수와 걸린 시간이 기록돼요.
   - 방장 화면이 캐릭터를 직접 움직이고(진짜 위치), roomKey('wasd')에 0.12초마다 올려요.
   - 다른 사람은 키를 누르면 roomKey('wd_k_'+내id)에 올리고, 방장이 모아서 적용해요. */
var WD_MIN = 1, WD_MAX = 4, WD_STAGES = 6;
var WD_W = 22, WD_H = 14;
var WD_KEYS = { W: [0, -1], A: [-1, 0], S: [0, 1], D: [1, 0] };
var WD_KEY_NAME = { W: '위', A: '왼쪽', S: '아래', D: '오른쪽' };

var WD_STATE = null;      // 받은(또는 방장이 계산한) 상태
var WD_SIM = null;        // 방장: 진짜 움직임 계산
var WD_POLL = null, WD_HOSTNET = null, WD_RAF = null;
var WD_CANVAS = null, WD_CTX = null, WD_DPR = 1;
var WD_MY_SEQ = 0, WD_SEEN_SEQ = {};
var WD_DISP = null;       // 화면에 그리는 위치(부드럽게)
var WD_RECV_AT = 0;
var WD_SHEET = null;
var WD_FLASH = {};        // 키 버튼 반짝임 {W: 시각}
var WD_PUB_BUSY = false, WD_LAST_PUB = 0;
var WD_OFF = 0, WD_OFF_SAMPLES = [];   /* 방장 시계와의 차이(ms) */
var WD_LOCAL_PEND = null;             /* 내가 방금 누른 키(방장에게 닿기 전까지 내 화면에 미리 반영) */

function wdKey() { return roomKey('wasd'); }
function wdMyKey() { return roomKey('wd_k_' + myPlayerId); }
function wdIsHost() { return myPlayerId === roomHostId; }

function stopWasdGame() {
  clearInterval(WD_POLL); WD_POLL = null;
  clearInterval(WD_HOSTNET); WD_HOSTNET = null;
  cancelAnimationFrame(WD_RAF); WD_RAF = null;
  WD_SIM = null;
}

function startWasdGame() {
  stopWasdGame();
  WD_STATE = null; WD_DISP = null; WD_SEEN_SEQ = {}; WD_MY_SEQ = 0;
  WD_CANVAS = document.getElementById('wd-canvas');
  WD_CTX = WD_CANVAS.getContext('2d');
  if (!WD_SHEET && typeof WD_SHEET_SRC === 'string') { WD_SHEET = new Image(); WD_SHEET.src = WD_SHEET_SRC; }
  document.getElementById('wd-result').style.display = 'none';
  var n = (roomPlayersList || []).length, err = document.getElementById('wd-error');
  if (n < WD_MIN || n > WD_MAX) {
    err.style.display = ''; err.textContent = 'WASD 대모험은 ' + WD_MIN + '~' + WD_MAX + '명이 할 수 있어요. 지금 ' + n + '명이에요.';
    document.getElementById('wd-main').style.display = 'none';
    return;
  }
  err.style.display = 'none';
  document.getElementById('wd-main').style.display = '';
  var starter = wdIsHost() ? wdHostInit() : Promise.resolve();
  starter.then(function () {
    if (wdIsHost()) WD_HOSTNET = setInterval(wdHostNet, 100);
    else WD_POLL = setInterval(wdPoll, 110);
    wdPoll();
    WD_RAF = requestAnimationFrame(wdFrame);
  });
}

/* ---- 맵 6개 (흙길을 따라가는 통로형) ----
   '#' 울타리(벽) · '.' 흙길 · 'c' 코인 · 'R' 길 위의 돌 · 'G' 깃발. 22×14칸, 한 줄씩 이어 붙인 문자열 */
var WD_MAPS = [
  {"map": "#####################################################..........############.c........############..######..############..######..#####....c....######.c#####.........######..####################..####################..##############........##############G.......###############################################", "sx": 2, "sy": 6, "dir": "D"},
  {"map": "##############################################..................####........c.........####################..####################..#####.................#####..............c..#####.c####################..####################.................#####.........c......G##############################################", "sx": 2, "sy": 2, "dir": "D"},
  {"map": "##############################################.........c.........###...................####################..###...............##..###..........c....##..###.c###########..##.c###..###..........##..###..###G.........##..###..###############..###...................###.......c...........#######################", "sx": 2, "sy": 2, "dir": "D"},
  {"map": "##############################################..###...c...###....###..###.......###...G###..###.c###..###..#####..###..###R.###..#####..###..###..###.c#####Rc###.R###..###..#####..###..###..###..#####..###..###.c###.R#####..###..###..###..#####.......###.......#####.......###.......#########################", "sx": 2, "sy": 2, "dir": "S"},
  {"map": "##############################################.........###.......###.........###.......###.R#####c.###..###..###..#####..###c.###..###c.#####..###..###..###..#......###..###..###..#.###..###.R###c.###..#.########..###..###..#c########..###..###..#.....c.....###.G###..#..R........###..#######################", "sx": 2, "sy": 11, "dir": "W"},
  {"map": "##################################################..R.....##.....#######.c......##.c...#######..####..##R.#..#######..####..##..#..###......####......#R.###......####...c..#..###.........#..#####..###G.......c#..#####..#####..###..#c.#####.c#####.c###............#####..###.....R......#######################", "sx": 2, "sy": 6, "dir": "D"}];

/* ---- 방장: 시작 ---- */
function wdHostInit() {
  var order = shuffleArray((roomPlayersList || []).map(function (p) { return p.id; }));
  var names = {};
  (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; });
  /* 키 나눠주기: W A S D 를 섞어서 돌아가며 (2명이면 2개씩, 3명이면 한 명은 2개) */
  var keys = shuffleArray(['W', 'A', 'S', 'D']), assign = {};
  order.forEach(function (pid) { assign[pid] = []; });
  keys.forEach(function (k, i) { assign[order[i % order.length]].push(k); });
  var gameId = Date.now();
  WD_SIM = { gameId: gameId, order: order, names: names, assign: assign, deaths: 0, startedAt: null, stage: 1, pending: null, lastPress: null };
  wdSimStage(1);
  return wdHostPublish(true);
}
function wdHostRestart() { if (wdIsHost()) { stopWasdGame(); startWasdGame(); } }

function wdStageSpeed(stage) { return 2.75 + stage * 0.15; }   /* 칸/초 (길이 좁아서 조금 천천히) */

function wdSimStage(stage) {
  var S = WD_SIM;
  S.stage = stage;
  var M = WD_MAPS[stage - 1];
  S.map = M.map; S.sx = M.sx; S.sy = M.sy; S.sdir = M.dir;
  S.coinsTotal = (S.map.match(/c/g) || []).length;
  wdSimRespawn(3000);
}
function wdSimRespawn(wait) {
  var S = WD_SIM;
  S.got = {};                      /* 이번 시도에서 먹은 코인 칸 */
  S.x = S.sx; S.y = S.sy; S.dir = S.sdir; S.prog = 0; S.pending = null;
  S.phase = 'ready';
  S.phaseUntil = Date.now() + wait;
}
function wdTile(map, x, y) { if (x < 0 || y < 0 || x >= WD_W || y >= WD_H) return '#'; return map[y * WD_W + x]; }
function wdBlocked(v) { return v === '#' || v === 'R' || v === 'T'; }

/* 방장: 한 프레임 움직이기 */
function wdSimStep(dt) {
  var S = WD_SIM, now = Date.now();
  if (!S) return;
  if (S.phase === 'ready') {
    if (now >= S.phaseUntil) { S.phase = 'run'; if (!S.startedAt) S.startedAt = now; wdHostPublish(true); }
    return;
  }
  if (S.phase === 'dead') { if (now >= S.phaseUntil) { wdSimRespawn(1500); wdHostPublish(true); } return; }
  if (S.phase === 'clear') {
    if (now >= S.phaseUntil) {
      if (S.stage >= WD_STAGES) { S.phase = 'end'; S.endedAt = S.clearAt; }
      else wdSimStage(S.stage + 1);
      wdHostPublish(true);
    }
    return;
  }
  if (S.phase !== 'run') return;
  var ev = wdAdvance(S, dt, S.coinsTotal);
  if (ev === 'coin') { S.coinAt = now; wdHostPublish(true); }
  else if (ev === 'bonk') { S.deaths++; S.phase = 'dead'; S.phaseUntil = now + 1300; S.hitAt = now; wdHostPublish(true); }
  else if (ev === 'clear') { S.phase = 'clear'; S.phaseUntil = now + 2800; S.clearAt = now; wdHostPublish(true); }
}

/* 움직이기 (방장 계산 · 다른 사람 화면 예측 둘 다 이걸로 똑같이)
   P = {x, y, dir, prog, pending, map, got}. 결과: 'coin' / 'bonk'(부딪힘) / 'clear' / null */
function wdAdvance(P, dt, coinsTotal) {
  var left = dt * wdStageSpeed(P.stage), ev = null;
  while (left > 1e-9) {
    if (P.prog === 0 && P.pending) { P.dir = P.pending; P.pending = null; }
    var d = WD_KEYS[P.dir], blocked = wdBlocked(wdTile(P.map, P.x + d[0], P.y + d[1]));
    var room = (blocked ? 0.32 : 1) - P.prog;
    var mv = Math.min(left, room);
    P.prog += mv; left -= mv;
    if (blocked && P.prog >= 0.32 - 1e-6) { P.prog = 0.32; return 'bonk'; }
    if (P.prog >= 1 - 1e-6) {
      P.x += d[0]; P.y += d[1]; P.prog = 0;
      var id = P.y * WD_W + P.x, v = P.map[id];
      if (v === 'c' && !P.got[id]) { P.got[id] = 1; ev = 'coin'; }
      if (v === 'G' && Object.keys(P.got).length >= coinsTotal) return 'clear';
    }
  }
  return ev;
}

/* 키 누름 적용 (방장) */
function wdSimPress(pid, k) {
  var S = WD_SIM;
  if (!S || (S.assign[pid] || []).indexOf(k) < 0) return;
  if (S.phase !== 'run' && S.phase !== 'ready') return;
  if (S.prog === 0 && S.phase === 'ready') S.dir = k;
  else S.pending = k;
  S.lastPress = { pid: pid, k: k, t: Date.now() };
}

function wdHostPublish(force) {
  var S = WD_SIM;
  if (!S) return Promise.resolve();
  var now = Date.now();
  WD_STATE = wdSnapshot();
  if (!force && (WD_PUB_BUSY || now - WD_LAST_PUB < 110)) return Promise.resolve();
  WD_PUB_BUSY = true; WD_LAST_PUB = now;
  return DBset(wdKey(), WD_STATE).then(function () { WD_PUB_BUSY = false; }, function () { WD_PUB_BUSY = false; });
}
function wdSnapshot() {
  var S = WD_SIM, now = Date.now();
  return {
    gameId: S.gameId, order: S.order, names: S.names, assign: S.assign, stage: S.stage, map: S.map,
    coinsTotal: S.coinsTotal, got: Object.keys(S.got).map(Number), deaths: S.deaths, sx: S.sx, sy: S.sy,
    x: S.x, y: S.y, dir: S.dir, prog: Math.round(S.prog * 1000) / 1000, pending: S.pending,
    phase: S.phase, left: Math.max(0, (S.phaseUntil || now) - now), t: now,
    elapsed: S.startedAt ? ((S.endedAt || now) - S.startedAt) : 0,
    hitAt: S.hitAt || 0, coinAt: S.coinAt || 0, lastPress: S.lastPress
  };
}

/* 방장: 친구들 키 누름 모으기 + 상태 올리기 */
function wdHostNet() {
  if (!WD_SIM || !document.getElementById('wasd').classList.contains('active')) return;
  if (!wdHostNet.busy) {
    wdHostNet.busy = true;
    var others = WD_SIM.order.filter(function (p) { return p !== myPlayerId; });
    (others.length ? DBgetPrefix('wd_k_', others) : Promise.resolve({})).then(function (all) {
      wdHostNet.busy = false;
      Object.keys(all || {}).forEach(function (pid) {
        var d = all[pid];
        if (!d || d.gameId !== WD_SIM.gameId || !d.list) return;
        var seen = WD_SEEN_SEQ[pid] || 0;
        d.list.forEach(function (it) { if (it.s > seen) { wdSimPress(pid, it.k); seen = it.s; } });
        WD_SEEN_SEQ[pid] = seen;
      });
    }, function () { wdHostNet.busy = false; });
  }
  wdHostPublish(false);
}

/* 모두: 상태 받기 (방장은 자기 계산값을 그대로 써요) */
function wdPoll() {
  if (wdIsHost()) { if (WD_SIM) WD_STATE = wdSnapshot(); wdRenderHud(); return; }
  if (wdPoll.busy) return;
  wdPoll.busy = true;
  DBget(wdKey()).then(function (st) {
    wdPoll.busy = false;
    if (!st || !st.map) return;
    var isNew = !WD_STATE || WD_STATE.gameId !== st.gameId;
    if (isNew) { WD_MY_SEQ = 0; WD_DISP = null; wdPressList = []; }
    if (WD_STATE && WD_STATE.t === st.t) return;
    if (WD_STATE && (st.stage !== WD_STATE.stage || st.phase !== WD_STATE.phase)) wdPhaseSound(WD_STATE, st);
    if (WD_STATE && st.coinAt !== WD_STATE.coinAt && st.coinAt) wdSound('coin');
    WD_STATE = st; WD_RECV_AT = Date.now();
    /* 시계 차이 추정: (받은 시각 - 방장이 보낸 시각) 중 가장 작은 값 = 시계 차이 + 가장 빠른 전송 시간 */
    var sample = WD_RECV_AT - st.t;
    WD_OFF_SAMPLES.push(sample); if (WD_OFF_SAMPLES.length > 30) WD_OFF_SAMPLES.shift();
    WD_OFF = Math.min.apply(null, WD_OFF_SAMPLES);
    if (WD_LOCAL_PEND && (st.pending === WD_LOCAL_PEND.k || (st.lastPress && st.lastPress.pid === myPlayerId && st.lastPress.k === WD_LOCAL_PEND.k && st.lastPress.t > WD_LOCAL_PEND.ht))) WD_LOCAL_PEND = null;
    wdRenderHud();
  }, function () { wdPoll.busy = false; });
}

/* 내 키 누르기 */
var wdPressList = [];
function wdPress(k) {
  var st = WD_STATE;
  if (!st || (st.assign[myPlayerId] || []).indexOf(k) < 0) return;
  WD_FLASH[k] = Date.now();
  wdSound('tap');
  if (wdIsHost()) { wdSimPress(myPlayerId, k); wdHostPublish(true); return; }
  WD_LOCAL_PEND = { k: k, at: Date.now(), ht: Date.now() - WD_OFF - 200 };
  WD_MY_SEQ++;
  wdPressList.push({ s: WD_MY_SEQ, k: k });
  if (wdPressList.length > 12) wdPressList.shift();
  DBset(wdMyKey(), { gameId: st.gameId, list: wdPressList.slice() });
}

/* ---- 화면 ---- */
function wdFrame(ts) {
  WD_RAF = requestAnimationFrame(wdFrame);
  if (!document.getElementById('wasd').classList.contains('active')) { wdFrame.last = ts; return; }
  var dt = wdFrame.last ? Math.min(0.05, (ts - wdFrame.last) / 1000) : 0.016;
  wdFrame.last = ts;
  if (wdIsHost() && WD_SIM) {
    var before = WD_SIM.phase, bs = WD_SIM.stage, bc = WD_SIM.coinAt;
    wdSimStep(dt);
    WD_STATE = wdSnapshot(); WD_RECV_AT = Date.now();
    if (before !== WD_SIM.phase || bs !== WD_SIM.stage) wdPhaseSound({ phase: before, stage: bs }, WD_STATE);
    if (bc !== WD_SIM.coinAt) wdSound('coin');
    if (wdFrame.hud === undefined || ts - wdFrame.hud > 120) { wdFrame.hud = ts; wdRenderHud(); }
  }
  wdDraw(dt);
}
function wdPhaseSound(a, b) {
  if (b.phase === 'dead') wdSound('bonk');
  else if (b.phase === 'clear') wdSound('clear');
  else if (b.phase === 'end') wdSound('clear');
}

/* 그릴 위치
   - 방장: 진짜 위치 그대로
   - 다른 사람: 받은 상태는 조금 옛날 거라서, 지금쯤 방장 화면에서 어디 있을지 같은 규칙으로 앞질러 계산(예측)해서 그려요.
     → 모두의 화면에서 캐릭터 위치가 거의 같아져서 타이밍이 맞아요. 부딪힘/코인은 방장이 확정하면 반영돼요. */
function wdTargetPos(st) {
  var d = WD_KEYS[st.dir] || [1, 0];
  if (wdIsHost() || st.phase !== 'run') return { x: st.x + d[0] * st.prog, y: st.y + d[1] * st.prog };
  var e = (Date.now() - st.t - WD_OFF + 60) / 1000;
  e = Math.max(0, Math.min(0.8, e));
  var got = {};
  (st.got || []).forEach(function (id) { got[id] = 1; });
  var pend = st.pending;
  if (WD_LOCAL_PEND) { if (Date.now() - WD_LOCAL_PEND.at < 900) pend = WD_LOCAL_PEND.k; else WD_LOCAL_PEND = null; }
  var P = { x: st.x, y: st.y, dir: st.dir, prog: st.prog, pending: pend, map: st.map, got: got, stage: st.stage };
  wdAdvance(P, e, st.coinsTotal);
  WD_PRED = P;
  var pd = WD_KEYS[P.dir];
  return { x: P.x + pd[0] * P.prog, y: P.y + pd[1] * P.prog, dir: P.dir, got: P.got };
}
var WD_PRED = null;

function wdResize() {
  var r = WD_CANVAS.getBoundingClientRect();
  WD_DPR = window.devicePixelRatio || 1;
  var w = Math.round(r.width * WD_DPR), h = Math.round(r.height * WD_DPR);
  if (WD_CANVAS.width !== w || WD_CANVAS.height !== h) { WD_CANVAS.width = w; WD_CANVAS.height = h; }
}

function wdDraw(dt) {
  var st = WD_STATE;
  if (!st || !st.map) return;
  wdResize();
  var ctx = WD_CTX, W = WD_CANVAS.width, H = WD_CANVAS.height;
  var ts = Math.min(W / WD_W, H / WD_H);
  var ox = (W - ts * WD_W) / 2, oy = (H - ts * WD_H) / 2;
  var now = Date.now();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#4f8a3c'; ctx.fillRect(0, 0, W, H);
  ctx.translate(ox, oy);
  var tp = wdTargetPos(st);
  var got = {};
  (st.got || []).forEach(function (id) { got[id] = 1; });
  if (tp.got) Object.keys(tp.got).forEach(function (id) { got[id] = 1; });   /* 예측으로 먹은 코인도 바로 사라지게 */
  var allGot = Object.keys(got).length >= st.coinsTotal;
  var walk = function (x, y) { return !wdBlocked(wdTile(st.map, x, y)) || wdTile(st.map, x, y) === 'R'; };
  var nearPath = function (x, y) { for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if ((dx || dy) && walk(x + dx, y + dy) && wdTile(st.map, x + dx, y + dy) !== '#') return true; return false; };
  /* 바닥: 풀밭 + 흙길 */
  for (var y = 0; y < WD_H; y++) for (var x = 0; x < WD_W; x++) {
    var v0 = st.map[y * WD_W + x];
    if (v0 === '#') ctx.fillStyle = (x + y) % 2 ? '#7fbf5e' : '#88c766';
    else ctx.fillStyle = (x * 3 + y * 5) % 4 ? '#d9b27c' : '#d2a972';
    ctx.fillRect(x * ts, y * ts, ts + 0.5, ts + 0.5);
  }
  /* 흙길 가장자리 그림자 */
  ctx.fillStyle = 'rgba(120,80,40,0.18)';
  for (var y1 = 0; y1 < WD_H; y1++) for (var x1 = 0; x1 < WD_W; x1++) {
    if (st.map[y1 * WD_W + x1] === '#' || wdTile(st.map, x1, y1 - 1) !== '#') continue;
    ctx.fillRect(x1 * ts, y1 * ts, ts + 0.5, ts * 0.18);
  }
  /* 출발점 */
  if (st.sx != null) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(2, ts * 0.06); ctx.setLineDash([ts * 0.12, ts * 0.1]);
    ctx.strokeRect(st.sx * ts + ts * 0.12, st.sy * ts + ts * 0.12, ts * 0.76, ts * 0.76); ctx.setLineDash([]);
  }
  for (var y2 = 0; y2 < WD_H; y2++) for (var x2 = 0; x2 < WD_W; x2++) {
    var v = st.map[y2 * WD_W + x2], cx = (x2 + 0.5) * ts, cy = (y2 + 0.5) * ts, sd = x2 * 7 + y2 * 13;
    if (v === '#') {
      /* 길 바로 옆은 돌 울타리, 먼 곳은 가끔 나무·풀 */
      if (nearPath(x2, y2)) wdDrawFence(ctx, cx, cy, ts, sd);
      else if (sd % 5 === 0) wdDrawTree(ctx, cx, cy, ts, sd);
      else if (sd % 7 === 1) wdDrawTuft(ctx, cx, cy, ts);
    }
    else if (v === 'R') wdDrawRock(ctx, cx, cy, ts, x2 * 5 + y2 * 3);
    else if (v === 'c' && !got[y2 * WD_W + x2]) wdDrawCoin(ctx, cx, cy, ts, now + x2 * 120);
    else if (v === 'G') wdDrawFlag(ctx, cx, cy, ts, allGot, now);
  }
  /* 캐릭터 */
  if (!WD_DISP || Math.abs(WD_DISP.x - tp.x) + Math.abs(WD_DISP.y - tp.y) > 2.5 || st.phase === 'ready') WD_DISP = { x: tp.x, y: tp.y };
  var k = Math.min(1, (dt || 0.016) * (wdIsHost() ? 60 : 14));
  WD_DISP.x += (tp.x - WD_DISP.x) * k; WD_DISP.y += (tp.y - WD_DISP.y) * k;
  var px = (WD_DISP.x + 0.5) * ts, py = (WD_DISP.y + 0.5) * ts;
  var row = (st.stage - 1) % 4;
  var dead = st.phase === 'dead';
  var blink = st.phase === 'ready' && Math.floor(now / 180) % 2 === 0;
  if (!blink) {
    var hop = st.phase === 'run' ? Math.abs(Math.sin(now / 90)) * ts * 0.08 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(px, py + ts * 0.42, ts * 0.38, ts * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    wdDrawChar(ctx, row, tp.dir || st.dir, px, py - hop, ts * 1.25, dead);
  }
  if (dead) {
    ctx.font = 'bold ' + Math.round(ts * 0.9) + 'px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('💫', px, py - ts * 0.75);
  }
  /* 다음에 꺾을 방향(예약된 키) 화살표 */
  if (st.pending && st.phase === 'run') {
    var pd = WD_KEYS[st.pending];
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    var ax = px + pd[0] * ts * 0.75, ay = py + pd[1] * ts * 0.75;
    ctx.moveTo(ax + pd[0] * ts * 0.22, ay + pd[1] * ts * 0.22);
    ctx.lineTo(ax - pd[1] * ts * 0.16, ay + pd[0] * ts * 0.16);
    ctx.lineTo(ax + pd[1] * ts * 0.16, ay - pd[0] * ts * 0.16);
    ctx.closePath(); ctx.fill();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  /* 가운데 큰 글씨 */
  var big = '';
  var sub = '';
  if (st.phase === 'ready') { var s = Math.ceil((st.left - (Date.now() - WD_RECV_AT)) / 1000); big = s > 0 ? String(s) : '출발!'; sub = '스테이지 ' + st.stage + ' · 코인 ' + st.coinsTotal + '개 모으고 깃발로!'; }
  else if (st.phase === 'dead') { big = '쿵!'; sub = '처음부터 다시…'; }
  else if (st.phase === 'clear') { big = st.stage >= WD_STAGES ? '모두 클리어! 🎉' : '스테이지 클리어! 🎉'; }
  if (big) {
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + Math.round(Math.min(W, H) / 7) + 'px "Gaegu", sans-serif';
    ctx.lineWidth = 8 * WD_DPR; ctx.strokeStyle = 'rgba(40,60,30,0.85)';
    ctx.strokeText(big, W / 2, H / 2); ctx.fillStyle = '#fff'; ctx.fillText(big, W / 2, H / 2);
    if (sub) {
      ctx.font = 'bold ' + Math.round(Math.min(W, H) / 22) + 'px sans-serif';
      ctx.lineWidth = 5 * WD_DPR; ctx.strokeText(sub, W / 2, H / 2 + Math.min(W, H) / 10);
      ctx.fillText(sub, W / 2, H / 2 + Math.min(W, H) / 10);
    }
  }
  wdRenderTimer(st);
  wdRenderKeyFlash(st);
}

function wdDrawChar(ctx, row, dir, cx, cy, size, dead) {
  if (!WD_SHEET || !WD_SHEET.complete || !WD_SHEET.naturalWidth) {
    ctx.fillStyle = '#ffe0b2'; ctx.beginPath(); ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2); ctx.fill(); return;
  }
  var cell = WD_SHEET.naturalWidth / 4;
  var col = dir === 'S' ? 0 : (dir === 'W' ? 2 : 1);
  var flip = dir === 'A';
  ctx.save();
  ctx.translate(cx, cy);
  if (dead) ctx.rotate(Math.sin(Date.now() / 60) * 0.2);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(WD_SHEET, col * cell, row * cell, cell, cell, -size / 2, -size * 0.62, size, size);
  ctx.restore();
}
function wdDrawTree(ctx, cx, cy, ts, s) {
  ctx.fillStyle = '#2f6b2b';
  ctx.beginPath(); ctx.arc(cx, cy + ts * 0.08, ts * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = s % 3 ? '#3f8a35' : '#468f3a';
  ctx.beginPath(); ctx.arc(cx - ts * 0.14, cy - ts * 0.06, ts * 0.32, 0, Math.PI * 2); ctx.arc(cx + ts * 0.16, cy - ts * 0.02, ts * 0.3, 0, Math.PI * 2); ctx.arc(cx, cy - ts * 0.22, ts * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.arc(cx - ts * 0.1, cy - ts * 0.24, ts * 0.1, 0, Math.PI * 2); ctx.fill();
}
function wdDrawFence(ctx, cx, cy, ts, s) {
  /* 회색 돌 울타리 (돌 2~3개 뭉친 모양) */
  var o = [[-0.22, 0.08, 0.27], [0.2, 0.1, 0.26], [0, -0.16, 0.25]];
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.ellipse(cx, cy + ts * 0.3, ts * 0.46, ts * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  o.forEach(function (q, i) {
    ctx.fillStyle = (s + i) % 3 ? '#8d939b' : '#7c828a';
    ctx.beginPath(); ctx.arc(cx + q[0] * ts, cy + q[1] * ts, q[2] * ts, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.arc(cx + q[0] * ts - q[2] * ts * 0.3, cy + q[1] * ts - q[2] * ts * 0.35, q[2] * ts * 0.35, 0, Math.PI * 2); ctx.fill();
  });
}
function wdDrawTuft(ctx, cx, cy, ts) {
  ctx.strokeStyle = '#5f9e45'; ctx.lineWidth = Math.max(1.5, ts * 0.05); ctx.lineCap = 'round';
  ctx.beginPath();
  [-0.12, 0, 0.12].forEach(function (dx) { ctx.moveTo(cx + dx * ts, cy + ts * 0.15); ctx.lineTo(cx + dx * ts * 1.6, cy - ts * 0.12); });
  ctx.stroke();
}
function wdDrawRock(ctx, cx, cy, ts, s) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(cx, cy + ts * 0.3, ts * 0.42, ts * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a8f96';
  ctx.beginPath();
  ctx.moveTo(cx - ts * 0.4, cy + ts * 0.3); ctx.lineTo(cx - ts * 0.33, cy - ts * 0.08); ctx.lineTo(cx - ts * 0.08, cy - ts * 0.34);
  ctx.lineTo(cx + ts * 0.22, cy - ts * 0.26); ctx.lineTo(cx + ts * 0.4, cy + ts * 0.04); ctx.lineTo(cx + ts * 0.36, cy + ts * 0.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b3b8bf';
  ctx.beginPath(); ctx.moveTo(cx - ts * 0.26, cy - ts * 0.04); ctx.lineTo(cx - ts * 0.06, cy - ts * 0.26); ctx.lineTo(cx + ts * 0.1, cy - ts * 0.18); ctx.lineTo(cx - ts * 0.08, cy + ts * 0.02); ctx.closePath(); ctx.fill();
}
function wdDrawCoin(ctx, cx, cy, ts, t) {
  var w = Math.abs(Math.cos(t / 260));
  var r = ts * 0.3;
  ctx.fillStyle = '#c99a1a';
  ctx.beginPath(); ctx.ellipse(cx, cy + ts * 0.03, r * Math.max(0.18, w), r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath(); ctx.ellipse(cx, cy, r * Math.max(0.15, w) * 0.88, r * 0.88, 0, 0, Math.PI * 2); ctx.fill();
  if (w > 0.5) { ctx.fillStyle = '#fff2b0'; ctx.fillRect(cx - r * 0.12 * w, cy - r * 0.45, r * 0.24 * w, r * 0.9); }
}
function wdDrawFlag(ctx, cx, cy, ts, open, now) {
  ctx.fillStyle = open ? 'rgba(255,240,150,0.55)' : 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.arc(cx, cy, ts * (open ? 0.5 + Math.sin(now / 200) * 0.05 : 0.42), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6d4c2f'; ctx.fillRect(cx - ts * 0.04, cy - ts * 0.38, ts * 0.08, ts * 0.72);
  ctx.fillStyle = open ? '#ff5252' : '#9e9e9e';
  var wave = open ? Math.sin(now / 150) * ts * 0.04 : 0;
  ctx.beginPath(); ctx.moveTo(cx + ts * 0.04, cy - ts * 0.38); ctx.lineTo(cx + ts * 0.38, cy - ts * 0.26 + wave); ctx.lineTo(cx + ts * 0.04, cy - ts * 0.12); ctx.closePath(); ctx.fill();
  if (!open) { ctx.font = Math.round(ts * 0.36) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🔒', cx, cy + ts * 0.4); }
}

function wdFmtTime(ms) {
  var s = Math.floor(ms / 1000);
  return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + s % 60).slice(-2) + '.' + ('0' + Math.floor(ms % 1000 / 10)).slice(-2);
}
function wdRenderTimer(st) {
  var el = document.getElementById('wd-time');
  var ms = st.elapsed + (st.phase !== 'end' && st.elapsed ? Date.now() - WD_RECV_AT : 0);
  el.textContent = wdFmtTime(ms);
}
function wdRenderKeyFlash(st) {
  var lp = st.lastPress;
  document.querySelectorAll('#wd-keys .wd-key').forEach(function (b) {
    var k = b.getAttribute('data-k');
    var on = (WD_FLASH[k] && Date.now() - WD_FLASH[k] < 220) || (lp && lp.k === k && Date.now() - WD_RECV_AT + (Date.now() - lp.t > 0 ? 0 : 0) < 220 && Date.now() - lp.t < 400);
    b.classList.toggle('lit', !!on);
    b.classList.toggle('next', st.pending === k);
  });
}
function wdRenderHud() {
  var st = WD_STATE;
  if (!st || !document.getElementById('wasd').classList.contains('active')) return;
  document.getElementById('wd-deaths').textContent = st.deaths;
  document.getElementById('wd-stage').textContent = st.stage + ' / ' + WD_STAGES;
  document.getElementById('wd-coins').textContent = (st.got || []).length + ' / ' + st.coinsTotal;
  /* 키 버튼: 누가 어떤 키를 맡았는지 */
  var html = ['W', 'A', 'S', 'D'].map(function (k) {
    var owner = Object.keys(st.assign).filter(function (pid) { return st.assign[pid].indexOf(k) >= 0; })[0];
    var mine = owner === myPlayerId;
    return '<button type="button" class="wd-key' + (mine ? ' mine' : '') + '" data-k="' + k + '"' + (mine ? '' : ' disabled') + '><b>' + k + '</b><small>' + WD_KEY_NAME[k] + '</small><i>' + esc(st.names[owner] || '?') + (mine ? ' (나)' : '') + '</i></button>';
  }).join('');
  var box = document.getElementById('wd-keys');
  if (box.getAttribute('data-h') !== html) { box.innerHTML = html; box.setAttribute('data-h', html); }
  var mineKeys = (st.assign[myPlayerId] || []);
  document.getElementById('wd-mykeys').innerHTML = '내 키: ' + mineKeys.map(function (k) { return '<b>' + k + '</b>(' + WD_KEY_NAME[k] + ')'; }).join(' ');
  if (st.phase === 'end') wdShowResult(st); else document.getElementById('wd-result').style.display = 'none';
}
function wdShowResult(st) {
  var box = document.getElementById('wd-result');
  box.style.display = '';
  if (box.getAttribute('data-g') !== String(st.gameId)) {
    box.setAttribute('data-g', st.gameId);
    typeof celebrateWin === 'function' && celebrateWin('wasd:' + st.gameId, st.order.map(function (p) { return st.names[p]; }), 'WASD 대모험 모두 클리어! ⏱ ' + wdFmtTime(st.elapsed));
    document.getElementById('wd-result-text').innerHTML = '6개 스테이지 모두 클리어!<br>⏱ <b>' + wdFmtTime(st.elapsed) + '</b> · 💀 <b>' + st.deaths + '번</b> 쿵';
  }
  document.getElementById('wd-restart').style.display = wdIsHost() ? '' : 'none';
}

function wdSound(kind) {
  if (typeof mmSound !== 'function') return;
  if (kind === 'coin') mmSound('catch');
  else if (kind === 'bonk') { if (typeof playFart === 'function') playFart(); else mmSound('wrong'); }
  else if (kind === 'clear') mmSound('plop');
  else if (kind === 'tap') mmSound('mash');
}

(function wdSetupInput() {
  var MAP = { KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', ArrowUp: 'W', ArrowLeft: 'A', ArrowDown: 'S', ArrowRight: 'D' };
  document.addEventListener('keydown', function (e) {
    var v = document.getElementById('wasd');
    if (!v || !v.classList.contains('active')) return;
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    var k = MAP[e.code];
    if (!k) return;
    e.preventDefault();
    if (e.repeat) return;
    wdPress(k);
  });
  var keys = document.getElementById('wd-keys');
  if (keys) keys.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.wd-key.mine'); if (!b) return;
    e.preventDefault();
    wdPress(b.getAttribute('data-k'));
  });
})();
