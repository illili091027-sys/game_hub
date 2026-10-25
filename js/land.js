/* ---------------- 먼작귀 땅따먹기 (온라인, 2~10명, 실시간) ----------------
   내 땅(색칠된 칸)에서 밖으로 나가면 꼬리(선)가 생기고, 다시 내 땅으로 돌아오면 꼬리로 둘러싼
   공간이 전부 내 땅이 돼요. 내가 밖에 나가 있을 때 다른 사람이 내 꼬리를 밟거나, 내가 내 꼬리를
   밟으면 탈락(3초 뒤 작은 땅에서 다시 시작). 2분 동안 땅을 가장 넓게 차지한 사람이 승리!
   - 내 움직임/땅 계산은 내 화면이 직접 하고, roomKey('ld_'+내id)에 0.2초마다 올려요.
   - 다른 사람 상태는 서버 일괄조회(DBgetPrefix)로 한 번에 읽어요.
   - 다른 사람이 내 땅을 뺏으면(그 사람이 나보다 나중에 땅을 차지했으면) 겹친 칸은 그 사람 것. */
var LD_G = 44;                 // 판 크기 (44×44칸)
var LD_SPEED = 6.2;            // 칸/초
var LD_ROUND_MS = 120000;      // 2분
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
    x: sp.x, y: sp.y, px: sp.x, py: sp.y, dir: [1, 0], nextDir: null, stepT: 0,
    alive: true, deadUntil: 0, cap: Date.now(), recent: [], kills: 0, deaths: 0, killedBy: null
  };
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
function ldSetDir(dx, dy) {
  if (!LD || !LD.alive) return;
  var cur = LD.nextDir || LD.dir;
  if (cur[0] === -dx && cur[1] === -dy) return; // 바로 뒤로는 못 돌아요
  LD.nextDir = [dx, dy];
}

function ldStep() {
  if (LD.nextDir) {
    if (!(LD.nextDir[0] === -LD.dir[0] && LD.nextDir[1] === -LD.dir[1])) LD.dir = LD.nextDir;
    LD.nextDir = null;
  }
  var nx = LD.x + LD.dir[0], ny = LD.y + LD.dir[1];
  LD.px = LD.x; LD.py = LD.y;
  if (nx < 0 || ny < 0 || nx >= LD_G || ny >= LD_G) return; // 벽에서는 멈춰요(방향을 바꾸세요)
  LD.x = nx; LD.y = ny;
  var id = ldIdx(nx, ny);
  LD.recent.push(id);
  if (LD.recent.length > 5) LD.recent.shift();
  if (LD.trailMask[id]) { ldDie(null); return; }
  if (LD.mask[id]) {
    if (LD.trail.length) ldCapture();
  } else {
    LD.trail.push(id);
    LD.trailMask[id] = 1;
  }
}

/* 꼬리를 땅으로 바꾸고, 바깥과 연결되지 않은(둘러싸인) 칸도 전부 내 땅으로 */
function ldCapture() {
  var G = LD_G, mask = LD.mask;
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
    var nb = [];
    if (x > 0) nb.push(id - 1);
    if (x < G - 1) nb.push(id + 1);
    if (y > 0) nb.push(id - G);
    if (y < G - 1) nb.push(id + G);
    for (var k = 0; k < nb.length; k++) {
      var n = nb[k];
      if (!mask[n] && !outside[n]) { outside[n] = 1; stack.push(n); }
    }
  }
  for (var j = 0; j < G * G; j++) if (!outside[j]) mask[j] = 1;
  LD.trail = [];
  LD.trailMask = new Uint8Array(G * G);
  LD.cap = Date.now();
}

function ldDie(byPid) {
  LD.alive = false;
  LD.deaths++;
  LD.killedBy = byPid;
  LD.deadUntil = Date.now() + LD_RESPAWN_MS;
  LD.mask = new Uint8Array(LD_G * LD_G);
  LD.trail = []; LD.trailMask = new Uint8Array(LD_G * LD_G);
  LD.cap = Date.now();
  ldPublish(true);
}

function ldRespawn() {
  // 다른 사람 땅이 적은 곳을 골라 다시 시작
  var best = null, bestScore = -1;
  for (var t = 0; t < 30; t++) {
    var x = 3 + Math.floor(Math.random() * (LD_G - 6)), y = 3 + Math.floor(Math.random() * (LD_G - 6));
    var free = 0;
    for (var yy = y - 2; yy <= y + 2; yy++) for (var xx = x - 2; xx <= x + 2; xx++) if (!ldOwnerOf(ldIdx(xx, yy))) free++;
    if (free > bestScore) { bestScore = free; best = { x: x, y: y }; }
  }
  LD.x = LD.px = best.x; LD.y = LD.py = best.y;
  LD.dir = [1, 0]; LD.nextDir = null;
  LD.alive = true; LD.killedBy = null;
  LD.recent = [];
  ldFillSquare(best.x, best.y, 2);
  LD.cap = Date.now();
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
var LD_LAST_PUB = 0;
function ldPublish(force) {
  if (!LD || !LD_MAIN) return;
  var now = Date.now();
  if (!force && now - LD_LAST_PUB < 180) return;
  LD_LAST_PUB = now;
  var score = 0;
  for (var i = 0; i < LD.mask.length; i++) score += LD.mask[i];
  LD.score = score;
  DBset(ldMyKey(), {
    gameId: LD.gameId, name: me.name, color: LD.color, char: LD.char,
    x: LD.x, y: LD.y, dir: LD.dir, alive: LD.alive, t: now,
    mask: ldB64(LD.mask), cap: LD.cap, trail: LD.trail.slice(-300), recent: LD.recent.slice(),
    score: score, kills: LD.kills, deaths: LD.deaths
  });
}

function ldNetTick() {
  if (!LD_MAIN || !LD) return;
  ldPublish(false);
  var others = LD_MAIN.order.filter(function (p) { return p !== myPlayerId; });
  DBgetPrefix('ld_', others).then(function (all) {
    Object.keys(all).forEach(function (pid) {
      var d = all[pid];
      if (!d || d.gameId !== LD_MAIN.gameId) return;
      var prev = LD_OTHERS[pid];
      if (!prev || prev.t !== d.t || !prev.maskArr) {
        d.maskArr = (prev && prev.mask === d.mask) ? prev.maskArr : ldUnB64(d.mask);
        d.trailSet = {};
        (d.trail || []).forEach(function (id) { d.trailSet[id] = 1; });
        d.recvAt = Date.now();
        LD_OTHERS[pid] = d;
      }
    });
    ldResolveConflicts();
  });
  ldUpdateBoard();
}

/* 다른 사람과의 충돌/땅 뺏김 판정 (내 화면에서 나에 대해서만 판단) */
function ldResolveConflicts() {
  if (!LD || !LD.alive || Date.now() < LD_MAIN.startAt) return;
  Object.keys(LD_OTHERS).forEach(function (pid) {
    var d = LD_OTHERS[pid];
    if (!d.alive) return;
    // 1) 그 사람 머리(최근 지나간 칸)가 내 꼬리를 밟았으면 나는 탈락
    var stepped = (d.recent || []).some(function (id) { return LD.trailMask[id]; });
    if (stepped && LD.alive) {
      ldDie(pid);
      ldToast('💥 ' + (d.name || '누군가') + '님이 내 꼬리를 밟았어요!');
      return;
    }
    // 2) 그 사람이 나보다 나중에 땅을 차지했으면 겹친 칸은 그 사람 것
    if (d.cap > LD.cap && d.maskArr) {
      for (var i = 0; i < LD.mask.length; i++) if (LD.mask[i] && d.maskArr[i]) LD.mask[i] = 0;
    }
  });
  // 내가 다른 사람 꼬리를 밟았는지(킬 카운트용 - 실제 탈락 판정은 상대 화면이 함)
  LD.recent.forEach(function (id) {
    Object.keys(LD_OTHERS).forEach(function (pid) {
      var d = LD_OTHERS[pid];
      if (d.alive && d.trailSet && d.trailSet[id] && Date.now() - (LD_KILL_AT[pid] || 0) > 4000) { LD_KILL_AT[pid] = Date.now(); LD.kills++; ldToast('⚔️ ' + (d.name || '') + '님의 꼬리를 끊었어요!'); }
    });
  });
}

function ldOwnerOf(id) {
  if (LD && LD.mask[id]) return myPlayerId;
  var owner = null, bestCap = -1;
  Object.keys(LD_OTHERS).forEach(function (pid) {
    var d = LD_OTHERS[pid];
    if (d.maskArr && d.maskArr[id] && d.cap > bestCap) { bestCap = d.cap; owner = pid; }
  });
  return owner;
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
  var remain = Math.max(0, Math.ceil((LD_MAIN.endAt - now) / 1000));
  document.getElementById('ld-time').textContent = started ? (Math.floor(remain / 60) + ':' + ('0' + remain % 60).slice(-2)) : '준비';
  ldDraw();
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
  var cell = Math.max(10, Math.min(W, H) / 22);
  var t = LD.alive ? Math.min(1, LD.stepT) : 1;
  var hx = LD.px + (LD.x - LD.px) * t, hy = LD.py + (LD.y - LD.py) * t;
  var camX = hx * cell + cell / 2 - W / 2, camY = hy * cell + cell / 2 - H / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#e9eef5';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(-camX, -camY);
  // 판 바탕 + 격자
  ctx.fillStyle = '#f7f9fc';
  ctx.fillRect(0, 0, LD_G * cell, LD_G * cell);
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  var x0 = Math.max(0, Math.floor(camX / cell)), x1 = Math.min(LD_G, Math.ceil((camX + W) / cell));
  var y0 = Math.max(0, Math.floor(camY / cell)), y1 = Math.min(LD_G, Math.ceil((camY + H) / cell));
  ctx.beginPath();
  for (var gx = x0; gx <= x1; gx++) { ctx.moveTo(gx * cell, y0 * cell); ctx.lineTo(gx * cell, y1 * cell); }
  for (var gy = y0; gy <= y1; gy++) { ctx.moveTo(x0 * cell, gy * cell); ctx.lineTo(x1 * cell, gy * cell); }
  ctx.stroke();
  // 땅
  for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
    var id = ldIdx(x, y);
    var owner = ldOwnerOf(id);
    if (!owner) continue;
    ctx.fillStyle = owner === myPlayerId ? LD.color : (LD_OTHERS[owner] && LD_OTHERS[owner].color) || '#ccc';
    ctx.globalAlpha = 0.72;
    ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
    ctx.globalAlpha = 1;
  }
  // 꼬리
  function drawTrail(list, color) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    list.forEach(function (id) { var x2 = id % LD_G, y2 = (id - x2) / LD_G; ctx.fillRect(x2 * cell + cell * 0.18, y2 * cell + cell * 0.18, cell * 0.64, cell * 0.64); });
    ctx.globalAlpha = 1;
  }
  Object.keys(LD_OTHERS).forEach(function (pid) { var d = LD_OTHERS[pid]; if (d.alive) drawTrail(d.trail || [], d.color); });
  drawTrail(LD.trail, LD.color);
  // 테두리
  ctx.strokeStyle = '#6b7a90'; ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, LD_G * cell, LD_G * cell);
  // 캐릭터
  function drawHead(px, py, color, charId, name, isMe) {
    var cx = px * cell + cell / 2, cy = py * cell + cell / 2;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.78, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    var img = charId ? charImage(charId) : null;
    if (img && img.complete && img.naturalWidth) {
      var s = cell * 1.5, r = img.naturalWidth / img.naturalHeight;
      ctx.drawImage(img, cx - (s * Math.min(1, r)) / 2, cy - (s / Math.max(1, r)) / 2 - cell * 0.1, s * Math.min(1, r), s / Math.max(1, r));
    }
    ctx.font = 'bold ' + Math.round(cell * 0.6) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(name + (isMe ? '(나)' : ''), cx, cy - cell * 1.1);
    ctx.fillStyle = '#263238';
    ctx.fillText(name + (isMe ? '(나)' : ''), cx, cy - cell * 1.1);
  }
  Object.keys(LD_OTHERS).forEach(function (pid) {
    var d = LD_OTHERS[pid];
    if (!d.alive) return;
    var age = Math.min(0.25, (Date.now() - (d.recvAt || Date.now())) / 1000);
    var ex = d.x + (d.dir ? d.dir[0] : 0) * age * LD_SPEED * 0.5, ey = d.y + (d.dir ? d.dir[1] : 0) * age * LD_SPEED * 0.5;
    drawHead(ex, ey, d.color, d.char, d.name || '', false);
  });
  if (LD.alive) drawHead(hx, hy, LD.color, LD.char, me.name, true);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 죽었을 때
  if (!LD.alive) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = 'bold ' + Math.round(H / 14) + 'px sans-serif';
    ctx.fillText('으앙! 탈락…', W / 2, H / 2 - 10 * LD_DPR);
    ctx.font = Math.round(H / 26) + 'px sans-serif';
    ctx.fillText(Math.max(0, Math.ceil((LD.deadUntil - Date.now()) / 1000)) + '초 뒤 다시 시작', W / 2, H / 2 + 24 * LD_DPR);
  }
  ldDrawMinimap();
}

function ldDrawMinimap() {
  var mm = document.getElementById('ld-minimap');
  var ctx = mm.getContext('2d');
  var s = mm.width / LD_G;
  ctx.fillStyle = '#f7f9fc'; ctx.fillRect(0, 0, mm.width, mm.height);
  for (var id = 0; id < LD_G * LD_G; id++) {
    var o = ldOwnerOf(id);
    if (!o) continue;
    var x = id % LD_G, y = (id - x) / LD_G;
    ctx.fillStyle = o === myPlayerId ? LD.color : (LD_OTHERS[o] && LD_OTHERS[o].color) || '#ccc';
    ctx.fillRect(x * s, y * s, s + 0.3, s + 0.3);
  }
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
    var d = KEYMAP[e.key];
    if (d) { e.preventDefault(); ldSetDir(d[0], d[1]); }
  });
  var cv = document.getElementById('ld-canvas');
  if (!cv) return;
  var sx = null, sy = null;
  cv.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
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
