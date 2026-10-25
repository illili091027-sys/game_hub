/* ---------------- 블록 배틀 (온라인, 2~10명, 실시간 대전) ----------------
   떨어지는 블록을 쌓아 가로줄을 지우는 게임. 한 번에 여러 줄을 지우거나 연속으로 지우면
   상대에게 구멍 뚫린 "쓰레기줄"을 보내요. 마지막까지 살아남는 사람이 승리!
   - 조작: ←/→ 이동, ↓ 천천히 내리기, 스페이스 바로 내리기, ↑/X 시계 회전, Z 반시계 회전, C/Shift 홀드
   - 공격력: 2줄 1 / 3줄 2 / 4줄(블록 배틀!) 4 / T-스핀 싱글 2·더블 4·트리플 6 / 연속 콤보 보너스 /
     백투백(4줄·T-스핀을 연달아) +1 / 판을 싹 비우면 +10
   - 상쇄: 쓰레기줄이 들어오기 전에 내가 줄을 지우면 들어올 쓰레기줄을 먼저 지워서 막아요.
   네트워크: 내 판/공격 목록을 roomKey('bk_'+내id)에 올리고, 다른 사람 것은 일괄조회로 읽어요. */
var BK_W = 10, BK_H = 20, BK_HIDDEN = 2;
var BK_MIN = 2, BK_MAX = 10;
var BK_COLORS = { I: '#4dd0e1', O: '#ffd54f', T: '#ba68c8', S: '#81c784', Z: '#e57373', J: '#64b5f6', L: '#ffb74d', G: '#9e9e9e' };
var BK_SHAPES = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]]
};
// SRS 벽차기(kick) 표 - 0:기본 R:오른쪽 2:뒤집힘 L:왼쪽
var BK_KICKS = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
};
var BK_KICKS_I = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]], '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]], '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]], '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]], '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
};
var BK_COMBO = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5];

var BK = null, BK_MAIN = null, BK_OTHERS = {};
var BK_RAF = null, BK_NET = null, BK_POLL = null;
var BK_CV = null, BK_CTX = null;

function bkKey() { return roomKey('blocks'); }
function bkMyKey() { return roomKey('bk_' + myPlayerId); }

function stopBlocksGame() {
  cancelAnimationFrame(BK_RAF); BK_RAF = null;
  clearInterval(BK_NET); BK_NET = null;
  clearInterval(BK_POLL); BK_POLL = null;
  bkStopRepeat();
}

function startBlocksGame() {
  stopBlocksGame();
  BK = null; BK_MAIN = null; BK_OTHERS = {};
  BK_CV = document.getElementById('bk-canvas');
  BK_CTX = BK_CV.getContext('2d');
  document.getElementById('bk-result').style.display = 'none';
  var n = (roomPlayersList || []).length;
  if (n < BK_MIN || n > BK_MAX) {
    document.getElementById('bk-msg').textContent = '블록 배틀은 ' + BK_MIN + '~' + BK_MAX + '명이 필요해요. 지금 ' + n + '명이에요.';
    return;
  }
  var starter = myPlayerId === roomHostId ? bkHostInit() : Promise.resolve();
  starter.then(function () {
    bkPollMain();
    BK_POLL = setInterval(bkPollMain, 1000);
    BK_NET = setInterval(bkNetTick, 250);
    BK_RAF = requestAnimationFrame(bkFrame);
  });
}

function bkHostInit() {
  var order = (roomPlayersList || []).map(function (p) { return p.id; });
  var names = {};
  (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; });
  return DBset(bkKey(), { gameId: Date.now(), order: order, names: names, startAt: Date.now() + 4500, phase: 'play' });
}
function bkHostRestart() { if (myPlayerId === roomHostId) bkHostInit().then(bkPollMain); }

function bkPollMain() {
  DBget(bkKey()).then(function (st) {
    if (!st || !st.order) return;
    if (!BK_MAIN || BK_MAIN.gameId !== st.gameId) { BK_MAIN = st; bkInitMine(st); }
    BK_MAIN = st;
    if (myPlayerId === roomHostId && st.phase === 'play') bkHostCheckEnd(st);
    if (st.phase === 'end') bkShowResult(st);
  });
}

function bkEmptyBoard() {
  var b = [];
  for (var y = 0; y < BK_H + BK_HIDDEN; y++) { b.push([]); for (var x = 0; x < BK_W; x++) b[y].push(''); }
  return b;
}

function bkInitMine(st) {
  BK = {
    gameId: st.gameId, board: bkEmptyBoard(), bag: [], queue: [], cur: null, hold: null, holdUsed: false,
    alive: true, diedAt: 0, lines: 0, sent: 0, combo: -1, b2b: false, incoming: [], attacks: [], processed: {},
    dropT: 0, lockT: 0, lockMoves: 0, lastRotate: false, started: false, target: null, msg: '', msgT: 0, startedAt: 0, pieces: 0
  };
  for (var i = 0; i < 5; i++) BK.queue.push(bkNextFromBag());
  document.getElementById('bk-result').style.display = 'none';
  bkPublish(true);
}

function bkNextFromBag() {
  if (!BK.bag.length) BK.bag = shuffleArray(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
  return BK.bag.pop();
}

function bkCells(p, rot, ox, oy) {
  var shape = BK_SHAPES[p.type];
  var size = p.type === 'I' ? 4 : (p.type === 'O' ? 4 : 3);
  return shape.map(function (c) {
    var x = c[0], y = c[1];
    for (var r = 0; r < rot; r++) { var nx = size - 1 - y; y = x; x = nx; }
    if (p.type === 'O') { x = c[0]; y = c[1]; }
    return [x + ox, y + oy];
  });
}
function bkFits(p, rot, ox, oy) {
  return bkCells(p, rot, ox, oy).every(function (c) {
    return c[0] >= 0 && c[0] < BK_W && c[1] < BK_H + BK_HIDDEN && (c[1] < 0 || !BK.board[c[1]][c[0]]);
  });
}

function bkSpawn(type) {
  var p = { type: type || BK.queue.shift(), rot: 0, x: 3, y: 0 };
  if (!type) BK.queue.push(bkNextFromBag());
  BK.cur = p;
  BK.lockT = 0; BK.lockMoves = 0; BK.lastRotate = false; BK.dropT = 0;
  if (!bkFits(p, 0, p.x, p.y)) bkDie();
}

function bkDie() {
  BK.alive = false;
  BK.diedAt = Date.now();
  BK.cur = null;
  bkPublish(true);
}

function bkMove(dx) {
  if (!bkCanControl()) return;
  var p = BK.cur;
  if (bkFits(p, p.rot, p.x + dx, p.y)) { p.x += dx; BK.lastRotate = false; bkLockReset(); }
}
function bkSoft() {
  if (!bkCanControl()) return;
  var p = BK.cur;
  if (bkFits(p, p.rot, p.x, p.y + 1)) { p.y++; BK.dropT = 0; BK.lastRotate = false; }
}
function bkHard() {
  if (!bkCanControl()) return;
  var p = BK.cur;
  while (bkFits(p, p.rot, p.x, p.y + 1)) { p.y++; BK.lastRotate = false; }
  bkLock();
}
function bkRotate(dir) {
  if (!bkCanControl()) return;
  var p = BK.cur;
  if (p.type === 'O') return;
  var nr = (p.rot + dir + 4) % 4;
  var table = p.type === 'I' ? BK_KICKS_I : BK_KICKS;
  var kicks = table[p.rot + '>' + nr] || [[0, 0]];
  for (var i = 0; i < kicks.length; i++) {
    var kx = kicks[i][0], ky = -kicks[i][1];
    if (bkFits(p, nr, p.x + kx, p.y + ky)) { p.x += kx; p.y += ky; p.rot = nr; BK.lastRotate = true; bkLockReset(); return; }
  }
}
function bkHold() {
  if (!bkCanControl() || BK.holdUsed) return;
  var t = BK.cur.type;
  if (BK.hold) { var h = BK.hold; BK.hold = t; bkSpawn(h); }
  else { BK.hold = t; bkSpawn(); }
  BK.holdUsed = true;
}
function bkLockReset() {
  if (BK.lockT > 0 && BK.lockMoves < 15) { BK.lockT = 0; BK.lockMoves++; }
}
function bkCanControl() { return BK && BK.alive && BK.cur && BK.started && BK_MAIN && BK_MAIN.phase === 'play'; }

/* T-스핀: 마지막 동작이 회전이고, T 블록 중심 대각선 4칸 중 3칸 이상이 막혀 있으면 */
function bkIsTSpin(p) {
  if (p.type !== 'T' || !BK.lastRotate) return false;
  var cx = p.x + 1, cy = p.y + 1, n = 0;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) {
    var x = cx + d[0], y = cy + d[1];
    if (x < 0 || x >= BK_W || y >= BK_H + BK_HIDDEN || (y >= 0 && BK.board[y][x])) n++;
  });
  return n >= 3;
}

function bkLock() {
  var p = BK.cur;
  var tspin = bkIsTSpin(p);
  bkCells(p, p.rot, p.x, p.y).forEach(function (c) { if (c[1] >= 0) BK.board[c[1]][c[0]] = p.type; });
  BK.pieces++;
  // 줄 지우기
  var cleared = 0;
  for (var y = BK.board.length - 1; y >= 0; y--) {
    if (BK.board[y].every(function (v) { return v; })) {
      BK.board.splice(y, 1);
      BK.board.unshift(new Array(BK_W).fill(''));
      cleared++; y++;
    }
  }
  var atk = 0, label = '';
  if (cleared) {
    BK.combo++;
    BK.lines += cleared;
    var special = tspin || cleared === 4;
    if (tspin) { atk = [0, 2, 4, 6][cleared]; label = 'T-스핀 ' + ['', '싱글', '더블', '트리플'][cleared] + '!'; }
    else { atk = [0, 0, 1, 2, 4][cleared]; label = cleared === 4 ? '블록 배틀!! (4줄)' : (cleared + '줄!'); }
    if (special && BK.b2b) { atk += 1; label = '백투백 ' + label; }
    BK.b2b = special ? true : (cleared ? false : BK.b2b);
    atk += BK_COMBO[Math.min(BK.combo, BK_COMBO.length - 1)];
    if (BK.combo >= 2) label += ' ' + BK.combo + '콤보';
    if (BK.board.every(function (row) { return row.every(function (v) { return !v; }); })) { atk += 10; label = '싹쓸이!! ' + label; }
    // 상쇄: 들어올 쓰레기줄부터 지움
    while (atk > 0 && BK.incoming.length) {
      var g = BK.incoming[0];
      var use = Math.min(atk, g.n);
      g.n -= use; atk -= use;
      if (g.n <= 0) BK.incoming.shift();
    }
    if (atk > 0) bkSendAttack(atk);
    bkFlash(label + (atk > 0 ? ' → 공격 ' + atk : ''));
  } else {
    BK.combo = -1;
    if (tspin) bkFlash('T-스핀!');
    bkApplyGarbage();
    if (!BK.alive) return;
  }
  BK.holdUsed = false;
  bkSpawn();
  bkPublish(true);
}

function bkApplyGarbage() {
  var total = 0;
  while (BK.incoming.length && total < 10) {
    var g = BK.incoming.shift();
    var n = Math.min(g.n, 10 - total);
    for (var i = 0; i < n; i++) {
      var row = new Array(BK_W).fill('G');
      row[g.hole] = '';
      if (BK.board[0].some(function (v) { return v; })) { bkDie(); return; }
      BK.board.shift();
      BK.board.push(row);
    }
    total += n;
  }
}

function bkAliveOpponents() {
  return Object.keys(BK_OTHERS).filter(function (pid) { var d = BK_OTHERS[pid]; return d && d.gameId === BK.gameId && d.alive; });
}
function bkSendAttack(n) {
  var opp = bkAliveOpponents();
  if (!opp.length) return;
  var to = opp[Math.floor(Math.random() * opp.length)];
  BK.sent += n;
  BK.attacks.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), to: to, n: n, hole: Math.floor(Math.random() * BK_W) });
  if (BK.attacks.length > 40) BK.attacks = BK.attacks.slice(-40);
  BK.target = to;
}

var BK_FLASH_T = null;
function bkFlash(text) {
  var el = document.getElementById('bk-flash');
  el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

/* ---- 네트워크 ---- */
function bkBoardString() {
  var s = '';
  for (var y = BK_HIDDEN; y < BK_H + BK_HIDDEN; y++) for (var x = 0; x < BK_W; x++) s += BK.board[y][x] || '.';
  return s;
}
var BK_LAST_PUB = 0;
function bkPublish(force) {
  if (!BK || !BK_MAIN) return;
  var now = Date.now();
  if (!force && now - BK_LAST_PUB < 240) return;
  BK_LAST_PUB = now;
  DBset(bkMyKey(), { gameId: BK.gameId, name: me.name, alive: BK.alive, diedAt: BK.diedAt, board: bkBoardString(), lines: BK.lines, sent: BK.sent, attacks: BK.attacks, pending: BK.incoming.reduce(function (a, g) { return a + g.n; }, 0), t: now });
}

function bkNetTick() {
  if (!BK || !BK_MAIN) return;
  bkPublish(false);
  var others = BK_MAIN.order.filter(function (p) { return p !== myPlayerId; });
  DBgetPrefix('bk_', others).then(function (all) {
    BK_OTHERS = all;
    // 나에게 온 공격 받기
    Object.keys(all).forEach(function (pid) {
      var d = all[pid];
      if (!d || d.gameId !== BK.gameId) return;
      (d.attacks || []).forEach(function (a) {
        if (a.to !== myPlayerId || BK.processed[a.id]) return;
        BK.processed[a.id] = true;
        if (BK.alive) { BK.incoming.push({ n: a.n, hole: a.hole, from: pid }); bkFlash('⚠️ ' + (d.name || '') + '님이 ' + a.n + '줄 공격!'); }
      });
    });
    bkRenderOthers();
  });
}

function bkHostCheckEnd(st) {
  if (Date.now() < st.startAt + 2000) return;
  DBgetPrefix('bk_', st.order).then(function (all) {
    var players = st.order.filter(function (pid) { return all[pid] && all[pid].gameId === st.gameId; });
    if (players.length < 2) return;
    var alive = players.filter(function (pid) { return all[pid].alive; });
    if (alive.length > 1) return;
    var res = players.slice().sort(function (a, b) {
      var da = all[a], db = all[b];
      if (da.alive !== db.alive) return da.alive ? -1 : 1;
      return (db.diedAt || 0) - (da.diedAt || 0);
    }).map(function (pid) { return { pid: pid, name: st.names[pid], lines: all[pid].lines || 0, sent: all[pid].sent || 0 }; });
    DBget(bkKey()).then(function (cur) {
      if (!cur || cur.gameId !== st.gameId || cur.phase !== 'play') return;
      cur.phase = 'end'; cur.results = res;
      DBset(bkKey(), cur).then(bkPollMain);
    });
  });
}

function bkShowResult(st) {
  var box = document.getElementById('bk-result');
  if (box.style.display !== 'none' && box.getAttribute('data-g') === String(st.gameId)) return;
  box.setAttribute('data-g', st.gameId);
  box.style.display = '';
  var r = st.results || [];
  document.getElementById('bk-result-banner').textContent = r.length ? ('🏆 ' + r[0].name + ' 승리!') : '게임 끝!';
  renderRankBoard('bk-result-rank', r.map(function (x) { return { name: x.name, isMe: x.pid === myPlayerId, label: x.lines + '줄 · 공격 ' + x.sent }; }));
  document.getElementById('bk-restart-btn').style.display = myPlayerId === roomHostId ? '' : 'none';
}

/* ---- 루프/그리기 ---- */
function bkGravityMs() {
  var secs = (Date.now() - BK.startedAt) / 1000;
  return Math.max(120, 800 - secs * 3.5);
}

function bkFrame(ts) {
  BK_RAF = requestAnimationFrame(bkFrame);
  if (!BK || !BK_MAIN || !document.getElementById('blocks').classList.contains('active')) return;
  var dt = bkFrame.last ? Math.min(50, ts - bkFrame.last) : 16;
  bkFrame.last = ts;
  var now = Date.now();
  var cd = document.getElementById('bk-countdown');
  if (!BK.started) {
    if (now >= BK_MAIN.startAt) { BK.started = true; BK.startedAt = now; bkSpawn(); cd.style.display = 'none'; }
    else { cd.style.display = ''; cd.textContent = Math.ceil((BK_MAIN.startAt - now) / 1000); }
  }
  if (BK.started && BK.alive && BK.cur && BK_MAIN.phase === 'play') {
    var p = BK.cur;
    if (bkFits(p, p.rot, p.x, p.y + 1)) {
      BK.lockT = 0;
      BK.dropT += dt;
      if (BK.dropT >= bkGravityMs()) { BK.dropT = 0; p.y++; BK.lastRotate = false; }
    } else {
      BK.lockT += dt;
      if (BK.lockT >= 500) bkLock();
    }
  }
  bkDraw();
}

function bkDraw() {
  var cv = BK_CV, ctx = BK_CTX;
  var rect = cv.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var W = Math.round(rect.width * dpr), H = Math.round(rect.height * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#141b24'; ctx.fillRect(0, 0, W, H);
  // 레이아웃: [홀드] [보드] [다음]
  var cell = Math.floor(Math.min(H / (BK_H + 0.5), W / (BK_W + 9)));
  var bw = cell * BK_W, bh = cell * BK_H;
  var bx = Math.floor((W - bw) / 2), by = Math.floor((H - bh) / 2);
  // 들어올 쓰레기줄 막대
  var pending = BK.incoming.reduce(function (a, g) { return a + g.n; }, 0);
  ctx.fillStyle = '#e53935';
  ctx.fillRect(bx - cell * 0.4, by + bh - Math.min(bh, pending * cell), cell * 0.28, Math.min(bh, pending * cell));
  ctx.fillStyle = '#0b1118'; ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (var gx = 0; gx <= BK_W; gx++) { ctx.beginPath(); ctx.moveTo(bx + gx * cell, by); ctx.lineTo(bx + gx * cell, by + bh); ctx.stroke(); }
  for (var gy = 0; gy <= BK_H; gy++) { ctx.beginPath(); ctx.moveTo(bx, by + gy * cell); ctx.lineTo(bx + bw, by + gy * cell); ctx.stroke(); }
  function block(x, y, color, alpha) {
    ctx.globalAlpha = alpha || 1;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 1, y + 1, cell - 2, Math.max(2, cell * 0.18));
    ctx.globalAlpha = 1;
  }
  for (var y = BK_HIDDEN; y < BK_H + BK_HIDDEN; y++) for (var x = 0; x < BK_W; x++) {
    var v = BK.board[y][x];
    if (v) block(bx + x * cell, by + (y - BK_HIDDEN) * cell, BK.alive ? BK_COLORS[v] : '#555');
  }
  if (BK.cur && BK.alive) {
    var p = BK.cur, gy2 = p.y;
    while (bkFits(p, p.rot, p.x, gy2 + 1)) gy2++;
    bkCells(p, p.rot, p.x, gy2).forEach(function (c) { if (c[1] >= BK_HIDDEN) block(bx + c[0] * cell, by + (c[1] - BK_HIDDEN) * cell, BK_COLORS[p.type], 0.25); });
    bkCells(p, p.rot, p.x, p.y).forEach(function (c) { if (c[1] >= BK_HIDDEN) block(bx + c[0] * cell, by + (c[1] - BK_HIDDEN) * cell, BK_COLORS[p.type]); });
  }
  // 미리보기
  function mini(type, x0, y0, s) {
    if (!type) return;
    var cs = bkCells({ type: type }, 0, 0, 0);
    cs.forEach(function (c) { block(x0 + c[0] * s, y0 + c[1] * s, BK_COLORS[type]); });
  }
  ctx.fillStyle = '#9fb3c8'; ctx.font = 'bold ' + Math.round(cell * 0.55) + 'px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('홀드', bx - cell * 4.4, by + cell * 0.7);
  var oc = cell; cell = Math.round(oc * 0.75);
  mini(BK.hold, bx - oc * 4.3, by + oc * 1.1, cell);
  ctx.fillText('다음', bx + bw + oc * 0.6, by + oc * 0.7);
  BK.queue.slice(0, 4).forEach(function (t, i) { mini(t, bx + bw + oc * 0.6, by + oc * 1.1 + i * oc * 2.4, cell); });
  cell = oc;
  ctx.fillStyle = '#cfd8dc'; ctx.font = Math.round(cell * 0.5) + 'px sans-serif';
  ctx.fillText('줄 ' + BK.lines, bx - cell * 4.4, by + cell * 5);
  ctx.fillText('공격 ' + BK.sent, bx - cell * 4.4, by + cell * 5.8);
  if (BK.target && BK_OTHERS[BK.target]) ctx.fillText('→ ' + (BK_OTHERS[BK.target].name || ''), bx - cell * 4.4, by + cell * 6.6);
  if (!BK.alive) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold ' + Math.round(cell * 1.1) + 'px sans-serif';
    ctx.fillText('탈락!', bx + bw / 2, by + bh / 2);
    ctx.font = Math.round(cell * 0.55) + 'px sans-serif';
    ctx.fillText('다른 친구들을 구경해요', bx + bw / 2, by + bh / 2 + cell);
  }
}

function bkRenderOthers() {
  var wrap = document.getElementById('bk-others');
  var ids = Object.keys(BK_OTHERS).filter(function (pid) { return BK_OTHERS[pid] && BK_OTHERS[pid].gameId === (BK && BK.gameId); });
  if (wrap.getAttribute('data-ids') !== ids.join(',')) {
    wrap.setAttribute('data-ids', ids.join(','));
    wrap.innerHTML = ids.map(function (pid) { return '<div class="bk-other" data-pid="' + pid + '"><canvas width="80" height="160"></canvas><div class="bk-other-name"></div></div>'; }).join('');
  }
  ids.forEach(function (pid) {
    var d = BK_OTHERS[pid];
    var box = wrap.querySelector('.bk-other[data-pid="' + pid + '"]');
    if (!box) return;
    box.classList.toggle('dead', !d.alive);
    box.classList.toggle('target', BK && BK.target === pid);
    box.querySelector('.bk-other-name').textContent = (d.name || '') + (d.alive ? '' : ' 💀') + ' · ' + (d.lines || 0) + '줄';
    var ctx = box.querySelector('canvas').getContext('2d');
    ctx.fillStyle = '#0b1118'; ctx.fillRect(0, 0, 80, 160);
    var s = d.board || '';
    for (var i = 0; i < s.length; i++) {
      var v = s[i];
      if (v === '.') continue;
      ctx.fillStyle = d.alive ? (BK_COLORS[v] || '#999') : '#555';
      ctx.fillRect((i % BK_W) * 8, Math.floor(i / BK_W) * 8, 7, 7);
    }
  });
}

/* ---- 입력 ---- */
var BK_REPEAT = null;
function bkStopRepeat() { clearTimeout(BK_REPEAT && BK_REPEAT.t1); clearInterval(BK_REPEAT && BK_REPEAT.t2); BK_REPEAT = null; }
function bkStartRepeat(fn) {
  bkStopRepeat();
  fn();
  BK_REPEAT = { t1: setTimeout(function () { BK_REPEAT.t2 = setInterval(fn, 45); }, 160) };
}
(function bkSetupInput() {
  var held = {};
  document.addEventListener('keydown', function (e) {
    if (!document.getElementById('blocks').classList.contains('active')) return;
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    var k = e.key;
    var handled = true;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowDown') {
      if (!held[k]) { held[k] = true; bkStartRepeat(k === 'ArrowLeft' ? function () { bkMove(-1); } : k === 'ArrowRight' ? function () { bkMove(1); } : bkSoft); }
    } else if (e.repeat) { handled = ['ArrowUp', ' '].indexOf(k) !== -1; }
    else if (k === 'ArrowUp' || k === 'x' || k === 'X') bkRotate(1);
    else if (k === 'z' || k === 'Z') bkRotate(-1);
    else if (k === ' ') bkHard();
    else if (k === 'c' || k === 'C' || k === 'Shift') bkHold();
    else handled = false;
    if (handled) e.preventDefault();
  });
  document.addEventListener('keyup', function (e) {
    if (held[e.key]) { held[e.key] = false; bkStopRepeat(); }
  });
  document.querySelectorAll('#bk-pad [data-a]').forEach(function (b) {
    var a = b.getAttribute('data-a');
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (a === 'L') bkStartRepeat(function () { bkMove(-1); });
      else if (a === 'R') bkStartRepeat(function () { bkMove(1); });
      else if (a === 'D') bkStartRepeat(bkSoft);
      else if (a === 'CW') bkRotate(1);
      else if (a === 'CCW') bkRotate(-1);
      else if (a === 'HD') bkHard();
      else if (a === 'H') bkHold();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { if (a === 'L' || a === 'R' || a === 'D') bkStopRepeat(); }); });
  });
})();
