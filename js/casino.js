/* 🎰 도박방 (혼자 하기)
   분필로 홀짝 · 주사위 · 사다리 · 슬롯 · 야바위를 즐겨요.
   - 걸 분필은 내가 직접 적거나, 옆 버튼으로 더해요 (가진 만큼 얼마든지)
   - 분필 지갑은 livechat.js의 walletLoad / walletSave를 그대로 써요.
   - 슬롯 그림은 data/casino-chars.js (CS_CHARS) */

var CS_BETS = [10, 50, 100, 500];
var CS_CELL_H = 100;           /* 슬롯 칸 높이(px) — CSS .cs-cell 높이와 같아야 해요 */
var CS_PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
/* 보여줄 면을 정면으로 돌리는 각도 [x, y] */
var CS_ORI = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
var CS_LAD = { W: 320, H: 270, xs: [40, 120, 200, 280], y0: 8, y1: 262, rows: 9, faces: [0, 3, 4, 7] };
var CS = { tab: 'oe', bet: 10, busy: false, live: false, pick: { oe: 'odd', lad: 0 },
           timers: [], raf: 0, imgs: null, slotPrev: [0, 1, 2], dice: null, yb: null, lad: null };

function csRand(n) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function csLater(fn, ms) { var t = setTimeout(fn, ms); CS.timers.push(t); }
function csEl(id) { return document.getElementById(id); }
function csN(n) { return Number(n).toLocaleString(); }

function startCasinoGame() {
  stopCasinoGame(); CS.busy = false; CS.live = false;
  CS.imgs = (typeof CS_CHARS !== 'undefined' ? CS_CHARS : []).map(function (s) { var i = new Image(); i.src = s; return i; });
  csBuild(); csShowTab(CS.tab);
}
function stopCasinoGame() {
  CS.timers.forEach(clearTimeout); CS.timers = [];
  if (CS.raf) cancelAnimationFrame(CS.raf); CS.raf = 0;
  CS.busy = false; CS.live = false; CS.dice = null; CS.yb = null;
}

function csBuild() {
  var tabs = [['oe', '🔮 홀짝'], ['dice', '🎲 주사위'], ['lad', '🪜 사다리'], ['slot', '🎰 슬롯'], ['cup', '🥤 야바위']];
  var html = '<div class="cs-top"><span>내 분필 ' + CHALK_IMG + ' <b class="coin-balance">0</b></span></div><div class="cs-tabs">';
  tabs.forEach(function (t) { html += '<button class="cs-tab" data-t="' + t[0] + '" onclick="csShowTab(\'' + t[0] + '\')">' + t[1] + '</button>'; });
  html += '</div><div class="cs-bet"><span class="cs-bet-l">걸 분필</span>' +
    '<input id="cs-bet" type="number" inputmode="numeric" min="1" step="1" placeholder="직접 적기" oninput="csTyped()" />' +
    '<div id="cs-chips">';
  CS_BETS.forEach(function (b) { html += '<button class="cs-chip" onclick="csAdd(' + b + ')">+' + b + '</button>'; });
  html += '<button class="cs-chip" onclick="csMax()">최대</button><button class="cs-chip" onclick="csClear()">지우기</button></div></div>' +
    '<div id="cs-game" class="cs-game"><div id="cs-fx" class="cs-fx"></div><div id="cs-body"></div></div><div id="cs-msg" class="cs-msg"></div>';
  csEl('cs-root').innerHTML = html;
  csSetBet(Math.min(CS.bet, walletCoins()) || 10);
}

/* ---------- 거는 분필 ---------- */
function csGetBet() { var v = parseInt(csEl('cs-bet').value, 10); return isNaN(v) ? 0 : v; }
function csSetBet(v) { v = Math.max(0, Math.min(Math.floor(v), walletCoins())); csEl('cs-bet').value = v || ''; CS.bet = v; }
function csTyped() { var v = csGetBet(); if (v > 0) CS.bet = v; }
function csAdd(n) { if (CS.busy) return; csSetBet(csGetBet() + n); }
function csMax() { if (CS.busy) return; csSetBet(walletCoins()); }
function csClear() { if (CS.busy) return; csSetBet(0); csEl('cs-bet').focus(); }

/* 판 시작 전 확인: 걸 수 있으면 걸 분필을 돌려줘요 */
function csStake() {
  if (CS.busy) return 0;
  var coins = walletCoins(), v = csGetBet();
  if (coins < 1) { csMsg('분필이 없어요 😢 다른 게임에서 분필을 모아 와요!', 'lose'); return 0; }
  if (v < 1) { csMsg('걸 분필을 적거나 옆 버튼을 눌러 주세요 👆', ''); csEl('cs-bet').focus(); return 0; }
  if (v > coins) { csMsg('분필이 모자라요! 가진 분필은 ' + csN(coins) + '개예요.', 'lose'); return 0; }
  CS.bet = v;
  return v;
}

function csMsg(text, cls) { var m = csEl('cs-msg'); if (m) { m.className = 'cs-msg ' + (cls || ''); m.textContent = text; } }

function csRefresh() {
  walletRender();
  var lock = CS.busy;
  csEl('cs-bet').disabled = lock;
  document.querySelectorAll('#cs-chips button').forEach(function (b) { b.disabled = lock; });
  document.querySelectorAll('.cs-tab').forEach(function (b) { b.classList.toggle('lock', lock && b.dataset.t !== CS.tab); });
  document.querySelectorAll('#cs-picks button').forEach(function (b) { b.classList.toggle('on', b.dataset.p === CS.pick[CS.tab]); b.disabled = lock; });
  document.querySelectorAll('.cs-lt').forEach(function (b) { b.classList.toggle('on', +b.dataset.i === CS.pick.lad); b.disabled = lock; });
  document.querySelectorAll('.cs-go').forEach(function (b) { b.disabled = CS.busy && !CS.live; });
}

function csPick(p) { if (CS.busy) return; CS.pick[CS.tab] = p; csRefresh(); }

/* 정산: mult배를 돌려받음 (0이면 걸었던 분필을 잃음, 1이면 본전) */
function csSettle(stake, mult, winText, loseText) {
  var back = Math.floor(stake * mult), net = back - stake;
  var w = walletLoad();
  w.coins = Math.max(0, Math.round(w.coins + net));
  walletSave(w);
  CS.busy = false; CS.live = false;
  var big = mult >= 3;
  if (net > 0) {
    csMsg('🎉 ' + winText + ' +' + csN(net) + '분필!', big ? 'win big' : 'win');
    csBurst(big ? 70 : 30, big);
  } else if (net === 0) csMsg('😮 ' + winText + ' 본전이에요.', '');
  else csMsg('😢 ' + (loseText || '아쉬워요!') + ' -' + csN(stake) + '분필', 'lose');
  csRefresh();
}

/* ---------- 이기면 시원하게! 캐릭터 폭죽 ---------- */
function csBurst(n, big) {
  var fx = csEl('cs-fx'), g = csEl('cs-game');
  if (!fx || !fx.animate) return;
  var srcs = typeof CS_CHARS !== 'undefined' ? CS_CHARS : [];
  for (var i = 0; i < n; i++) {
    var img = document.createElement('img');
    img.src = srcs[csRand(srcs.length)]; img.className = 'cs-conf';
    var s = 26 + csRand(big ? 34 : 22); img.style.width = s + 'px'; img.style.height = s + 'px';
    fx.appendChild(img);
    var dx = (csRand(1000) / 1000 - 0.5) * (big ? 560 : 420), up = -(70 + csRand(big ? 220 : 150)), fall = 140 + csRand(180), rot = (csRand(1000) / 1000 - 0.5) * 720;
    var a = img.animate([
      { transform: 'translate(-50%,-50%) scale(.2) rotate(0deg)', opacity: 1 },
      { transform: 'translate(calc(-50% + ' + dx * 0.6 + 'px), calc(-50% + ' + up + 'px)) scale(1) rotate(' + rot * 0.5 + 'deg)', opacity: 1, offset: 0.4 },
      { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + fall + 'px)) scale(.8) rotate(' + rot + 'deg)', opacity: 0 }
    ], { duration: 1000 + csRand(800), delay: csRand(180), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    a.onfinish = (function (el) { return function () { el.remove(); }; })(img);
  }
  if (big) {
    var b = document.createElement('div'); b.className = 'cs-banner'; b.textContent = '🎉 대박!'; fx.appendChild(b);
    b.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-60%) scale(1)', opacity: 0 }], { duration: 1500, fill: 'forwards' }).onfinish = function () { b.remove(); };
    g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake');
  }
}

/* 숫자가 점점 느리게 바뀌는 연출 */
function csSpin(steps, tick, done) {
  CS.busy = true; CS.live = false; csRefresh(); csMsg('');
  var i = 0;
  (function next() {
    tick(i); i++;
    if (i < steps) csLater(next, 40 + i * 7); else csLater(done, 240);
  })();
}

function csShowTab(t) {
  if (CS.busy) return;
  CS.tab = t; CS.dice = null; CS.yb = null;
  if (CS.raf) cancelAnimationFrame(CS.raf); CS.raf = 0;
  csEl('cs-fx').innerHTML = '';
  document.querySelectorAll('.cs-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
  var g = csEl('cs-body');
  csMsg('');
  if (t === 'oe') {
    g.innerHTML = '<div class="cs-stage"><div id="cs-ball" class="cs-ball">?</div></div>' +
      '<div class="cs-picks" id="cs-picks"><button data-p="odd" onclick="csPick(\'odd\')">홀 ×2</button><button data-p="even" onclick="csPick(\'even\')">짝 ×2</button></div>' +
      '<p class="cs-help">1~100 중에 구슬이 멈추는 숫자가 홀수인지 짝수인지 맞혀요.</p>' +
      '<button class="btn btn-primary cs-go" onclick="csOE()">🔮 구슬 굴리기</button>';
  } else if (t === 'dice') {
    g.innerHTML = '<div class="cs-stage cs-dstage"><div class="cs-dside"><div class="cs-dlabel">상대</div>' + csCube('cs-dh') + '</div><div class="cs-vs">VS</div><div class="cs-dside"><div class="cs-dlabel">나</div>' + csCube('cs-dm') + '</div></div>' +
      '<p class="cs-help" id="cs-dhelp">상대가 먼저 굴려요. 그다음 내가 굴려서 더 큰 눈이 나오면 ×2! (같으면 본전)</p>' +
      '<button class="btn btn-primary cs-go" id="cs-dgo" onclick="csDice()">🎲 승부 시작</button>';
  } else if (t === 'lad') {
    var tops = '', i;
    for (i = 0; i < 4; i++) tops += '<button class="cs-lt" data-i="' + i + '" onclick="csLadPick(' + i + ')"><img src="' + CS_CHARS[CS_LAD.faces[i]] + '" alt=""><b>' + (i + 1) + '번</b></button>';
    g.innerHTML = '<div class="cs-lad"><div class="cs-lad-top">' + tops + '</div><canvas id="cs-lc"></canvas><div class="cs-lad-bot" id="cs-lb"></div></div>' +
      '<p class="cs-help">출발할 줄을 고르고 사다리를 타요. 아래 상자는 도착하면 열려요! (×3 · ×1 · 꽝 · 꽝)</p>' +
      '<button class="btn btn-primary cs-go" onclick="csLadder()">🪜 사다리 타기</button>';
    csLadNew();
  } else if (t === 'slot') {
    var reels = '';
    for (i = 0; i < 3; i++) reels += '<div class="cs-reel" id="cs-rl' + i + '"><div class="cs-strip" id="cs-s' + i + '">' + csCell(CS.slotPrev[i]) + '</div></div>';
    g.innerHTML = '<div class="cs-stage"><div class="cs-slotbox">' + reels + '</div></div>' +
      '<p class="cs-help">같은 그림 3개면 ×30 잭팟! 2개가 같으면 ×1.6</p><button class="btn btn-primary cs-go" onclick="csSlot()">🎰 레버 당기기</button>';
  } else if (t === 'cup') {
    var cups = '';
    for (i = 0; i < 3; i++) cups += '<div class="cs-cup" id="cs-cup' + i + '" onclick="csCup(' + i + ')"><div class="cs-yball"></div><div class="cs-cupbody"></div></div>';
    g.innerHTML = '<div class="cs-ybstage" id="cs-yb">' + cups + '<div class="cs-table"></div></div>' +
      '<p class="cs-help" id="cs-yhelp">공이 든 컵을 잘 보고, 섞은 뒤에 찾아요. <b>보통</b>은 맞히면 ×2, 엄청 빠른 <b>초고속</b>은 맞히면 ×3!</p>' +
      '<div class="cs-ybbtns"><button class="btn btn-primary cs-go" onclick="csYabawi(\'normal\')">🥤 보통 (×2)</button>' +
      '<button class="btn btn-primary cs-go cs-go-fast" onclick="csYabawi(\'fast\')">⚡ 초고속 (×3)</button></div>';
    csCupPlace([0, 1, 2], 0);
  }
  csRefresh();
}

/* ---------- 홀짝 ---------- */
function csOE() {
  var stake = csStake(); if (!stake) return;
  var pick = CS.pick.oe, r = csRand(100) + 1, ball = csEl('cs-ball');
  function paint(n) { ball.textContent = n; ball.className = 'cs-ball ' + (n % 2 ? 'odd' : 'even'); }
  csSpin(20, function () { paint(csRand(100) + 1); }, function () {
    paint(r);
    var kind = r % 2 ? '홀' : '짝', win = (pick === 'odd') === (r % 2 === 1);
    csSettle(stake, win ? 2 : 0, r + ' · ' + kind + '! 맞혔어요', r + ' · ' + kind + '이었어요!');
  });
}

/* ---------- 3D 주사위 ---------- */
function csCube(id) {
  var faces = '';
  [1, 2, 3, 4, 5, 6].forEach(function (n) {
    var p = '';
    for (var i = 0; i < 9; i++) p += '<i' + (CS_PIPS[n].indexOf(i) > -1 ? ' class="on' + (n === 1 ? ' one' : '') + '"' : '') + '></i>';
    faces += '<div class="cs-face f' + n + '">' + p + '</div>';
  });
  return '<div class="cs-dice" id="' + id + '"><div class="cs-dshadow"></div><div class="cs-hop"><div class="cs-cube" data-n="1">' + faces + '</div></div></div>';
}
function csRollCube(id, n, ms, done) {
  var box = csEl(id), cube = box.querySelector('.cs-cube'), hop = box.querySelector('.cs-hop'), sh = box.querySelector('.cs-dshadow');
  var cur = CS_ORI[+cube.dataset.n], o = CS_ORI[n];
  cube.style.transition = 'none';
  cube.style.transform = 'rotateZ(0deg) rotateX(' + cur[0] + 'deg) rotateY(' + cur[1] + 'deg)';
  void cube.offsetWidth;
  cube.style.transition = 'transform ' + ms + 'ms cubic-bezier(.12,.7,.2,1)';
  cube.style.transform = 'rotateZ(' + (360 * (1 + csRand(2))) + 'deg) rotateX(' + (o[0] + 360 * (2 + csRand(3))) + 'deg) rotateY(' + (o[1] + 360 * (2 + csRand(3))) + 'deg)';
  cube.dataset.n = n;
  [hop, sh].forEach(function (el) { el.classList.remove('go'); void el.offsetWidth; el.style.animationDuration = ms + 'ms'; el.classList.add('go'); });
  csLater(done, ms + 120);
}
function csDice() {
  var go = csEl('cs-dgo'), help = csEl('cs-dhelp'), D = CS.dice;
  if (!D) {                                       /* 1단계: 상대가 먼저 굴려요 */
    var stake = csStake(); if (!stake) return;
    var h = csRand(6) + 1;
    CS.dice = { stake: stake, h: h };
    CS.busy = true; CS.live = false; csRefresh(); csMsg('');
    help.textContent = '상대가 굴리는 중…';
    csRollCube('cs-dh', h, 1300, function () {
      help.innerHTML = '상대는 <b>' + h + '</b>! ' + (h === 6 ? '6이면 못 이기고 같아야 본전이에요 😬' : '이보다 큰 눈이 나오면 승리예요.') + ' 이제 내가 던져요!';
      go.textContent = '🎲 내 주사위 던지기'; CS.live = true; csRefresh();
    });
    return;
  }
  CS.live = false; csRefresh();                    /* 2단계: 내가 던져요 */
  var m = csRand(6) + 1;
  help.textContent = '내 주사위 굴러가는 중…';
  csRollCube('cs-dm', m, 1500, function () {
    CS.dice = null; go.textContent = '🎲 승부 시작';
    help.textContent = '상대가 먼저 굴려요. 그다음 내가 굴려서 더 큰 눈이 나오면 ×2! (같으면 본전)';
    if (m > D.h) csSettle(D.stake, 2, '내 ' + m + ' > 상대 ' + D.h + '! 이겼어요');
    else if (m === D.h) csSettle(D.stake, 1, '둘 다 ' + m + '! 무승부,');
    else csSettle(D.stake, 0, '', '내 ' + m + ' < 상대 ' + D.h + ' 졌어요!');
  });
}

/* ---------- 사다리 타기 ---------- */
function csLadNew() {
  var G = CS_LAD, rungs, cnt;
  do {
    rungs = []; cnt = 0;
    for (var r = 0; r < G.rows; r++) {
      var row = [false, false, false];
      for (var c = 0; c < 3; c++) if (!(c > 0 && row[c - 1]) && csRand(100) < 50) { row[c] = true; cnt++; }
      rungs.push(row);
    }
  } while (cnt < 5);
  var prizes = [3, 1, 0, 0];
  for (var i = prizes.length - 1; i > 0; i--) { var j = csRand(i + 1), t = prizes[i]; prizes[i] = prizes[j]; prizes[j] = t; }
  CS.lad = { rungs: rungs, prizes: prizes, done: false };
  var b = '';
  for (var k = 0; k < 4; k++) b += '<div class="cs-lb">🎁</div>';
  csEl('cs-lb').innerHTML = b;
  csLadDraw(null, 0);
}
function csLadPick(i) { if (CS.busy) return; CS.pick.lad = i; csRefresh(); if (CS.lad) csLadDraw(null, 0); }
function csLadY(r) { return 34 + r * 26; }
function csLadPath(start) {
  var G = CS_LAD, L = CS.lad, lane = start, pts = [[G.xs[lane], G.y0]];
  for (var r = 0; r < G.rows; r++) {
    var mv = 0;
    if (lane < 3 && L.rungs[r][lane]) mv = 1; else if (lane > 0 && L.rungs[r][lane - 1]) mv = -1;
    if (mv) { pts.push([G.xs[lane], csLadY(r)]); lane += mv; pts.push([G.xs[lane], csLadY(r)]); }
  }
  pts.push([G.xs[lane], G.y1]);
  return { pts: pts, end: lane };
}
function csLadDraw(path, drawn) {
  var G = CS_LAD, cv = csEl('cs-lc'); if (!cv || !CS.lad) return;
  var dpr = window.devicePixelRatio || 1;
  if (cv.width !== G.W * dpr) { cv.width = G.W * dpr; cv.height = G.H * dpr; }
  var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, G.W, G.H);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (!path) { ctx.strokeStyle = 'rgba(224,83,63,.28)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(G.xs[CS.pick.lad], G.y0); ctx.lineTo(G.xs[CS.pick.lad], G.y1); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(30,30,30,.55)'; ctx.lineWidth = 4;
  G.xs.forEach(function (x) { ctx.beginPath(); ctx.moveTo(x, G.y0); ctx.lineTo(x, G.y1); ctx.stroke(); });
  CS.lad.rungs.forEach(function (row, r) {
    row.forEach(function (on, c) { if (on) { ctx.beginPath(); ctx.moveTo(G.xs[c], csLadY(r)); ctx.lineTo(G.xs[c + 1], csLadY(r)); ctx.stroke(); } });
  });
  if (path) {
    ctx.strokeStyle = '#E0533F'; ctx.lineWidth = 7; ctx.beginPath();
    var left = drawn, p = path.pts, hx = p[0][0], hy = p[0][1];
    ctx.moveTo(hx, hy);
    for (var i = 1; i < p.length && left > 0; i++) {
      var dx = p[i][0] - p[i - 1][0], dy = p[i][1] - p[i - 1][1], d = Math.sqrt(dx * dx + dy * dy), f = Math.min(1, left / d);
      hx = p[i - 1][0] + dx * f; hy = p[i - 1][1] + dy * f; ctx.lineTo(hx, hy); left -= d;
    }
    ctx.stroke();
    var im = CS.imgs && CS.imgs[G.faces[CS.pick.lad]];
    if (im && im.complete) ctx.drawImage(im, hx - 20, hy - 20, 40, 40);
  }
}
function csLadder() {
  var stake = csStake(); if (!stake) return;
  if (CS.lad.done) csLadNew();
  var G = CS_LAD, path = csLadPath(CS.pick.lad), total = 0, i;
  for (i = 1; i < path.pts.length; i++) total += Math.abs(path.pts[i][0] - path.pts[i - 1][0]) + Math.abs(path.pts[i][1] - path.pts[i - 1][1]);
  CS.busy = true; CS.live = false; csRefresh(); csMsg('');
  var t0 = performance.now(), speed = 330;
  (function frame(now) {
    var d = Math.min(total, (now - t0) / 1000 * speed);
    csLadDraw(path, d);
    if (d < total) { CS.raf = requestAnimationFrame(frame); return; }
    CS.raf = 0;
    var cells = csEl('cs-lb').children, prize = CS.lad.prizes[path.end];
    CS.lad.done = true;
    for (var k = 0; k < 4; k++) {
      var p = CS.lad.prizes[k];
      cells[k].textContent = p === 0 ? '꽝' : '×' + p;
      cells[k].className = 'cs-lb ' + (p === 0 ? 'zero' : 'gain') + (k === path.end ? ' hit' : '');
    }
    csLater(function () {
      csSettle(stake, prize, (prize === 1 ? '×1 칸이에요,' : (path.end + 1) + '번 도착! ×' + prize + ' 당첨'), (path.end + 1) + '번 도착… 꽝이에요!');
      csLater(function () { if (!CS.busy && CS.lad && CS.lad.done && CS.tab === 'lad') csLadNew(); }, 2600);
    }, 450);
  })(t0);
}

/* ---------- 슬롯 (캐릭터 8종) ---------- */
function csCell(k) { return '<div class="cs-cell"><img src="' + CS_CHARS[k] + '" alt=""></div>'; }
function csSlot() {
  var stake = csStake(); if (!stake) return;
  var n = CS_CHARS.length, res = [csRand(n), csRand(n), csRand(n)];
  CS.busy = true; CS.live = false; csRefresh(); csMsg('');
  document.querySelectorAll('.cs-reel').forEach(function (r) { r.classList.remove('hit'); });
  var last = 0;
  [0, 1, 2].forEach(function (k) {
    var strip = csEl('cs-s' + k), reel = csEl('cs-rl' + k), len = 16 + k * 8, ms = 1500 + k * 650, h = csCell(CS.slotPrev[k]);
    for (var i = 1; i < len - 1; i++) h += csCell(csRand(n));
    h += csCell(res[k]);
    strip.style.transition = 'none'; strip.innerHTML = h; strip.style.transform = 'translateY(0)';
    void strip.offsetWidth;
    reel.classList.add('spin');
    strip.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,.75,.25,1.06)';
    strip.style.transform = 'translateY(-' + (len - 1) * CS_CELL_H + 'px)';
    csLater(function () { reel.classList.remove('spin'); CS.slotPrev[k] = res[k]; }, ms);
    last = Math.max(last, ms);
  });
  csLater(function () {
    var same = (res[0] === res[1] ? 1 : 0) + (res[1] === res[2] ? 1 : 0) + (res[0] === res[2] ? 1 : 0);
    if (same >= 1) [0, 1, 2].forEach(function (k) {
      var cnt = res.filter(function (x) { return x === res[k]; }).length;
      if (cnt >= 2) csEl('cs-rl' + k).classList.add('hit');
    });
    csSettle(stake, same === 3 ? 30 : same === 1 ? 1.6 : 0, same === 3 ? '잭팟!! 3개 일치' : '2개 일치!', '그림이 다 달라요!');
  }, last + 250);
}

/* ---------- 야바위 (컵 3개) ---------- */
function csCupX(slot) { return slot * 105 + 10; }
function csCupPlace(pos, ball) {
  for (var i = 0; i < 3; i++) {
    var b = csEl('cs-cup' + i);
    b.style.transform = 'translateX(' + csCupX(pos[i]) + 'px)';
    b.classList.remove('lift', 'pickable', 'has');
    if (i === ball && CS.yb) b.classList.add('has');
  }
}
function csCupHelp(t) { var h = csEl('cs-yhelp'); if (h) h.innerHTML = t; }
/* 난이도: 보통은 적당히 어렵게(×2), 초고속은 눈이 따라가기 힘들 만큼 빠르게(×3) */
var CS_YB = {
  normal: { mult: 2, total: 14, d0: 280, step: 10, min: 150, gap: 30 },
  fast:   { mult: 3, total: 26, d0: 170, step: 5,  min: 70,  gap: 6 }
};
function csYabawi(level) {
  var L = CS_YB[level] ? level : 'normal';
  var stake = csStake(); if (!stake) return;
  var ball = csRand(3), Y = CS.yb = { stake: stake, pos: [0, 1, 2], ball: ball, phase: 'show', level: L };
  CS.busy = true; CS.live = false; csRefresh(); csMsg('');
  csCupPlace(Y.pos, ball);
  csCupHelp('👀 공을 잘 보세요!' + (L === 'fast' ? ' (⚡ 초고속!)' : ''));
  var ball_el = csEl('cs-cup' + ball);
  csLater(function () { ball_el.classList.add('lift'); }, 350);
  csLater(function () { ball_el.classList.remove('lift'); }, 1500);
  csLater(function () { csCupHelp(L === 'fast' ? '⚡ 엄청 빠르게 섞는 중… 눈을 떼지 마요!' : '🌀 섞는 중… 눈을 떼지 마요!'); csCupShuffle(0, CS_YB[L].total); }, 2000);
}
function csCupShuffle(s, total) {
  var Y = CS.yb; if (!Y) return;
  if (s >= total) { Y.phase = 'pick'; csCupHelp('❓ 공이 든 컵은 어디? 눌러서 골라요!'); for (var i = 0; i < 3; i++) csEl('cs-cup' + i).classList.add('pickable'); return; }
  var sa, sb;
  do { sa = csRand(3); sb = csRand(3); } while (sa === sb || (Y.last && ((Y.last[0] === sa && Y.last[1] === sb) || (Y.last[0] === sb && Y.last[1] === sa))));
  Y.last = [sa, sb];
  var ca = Y.pos.indexOf(sa), cb = Y.pos.indexOf(sb), L = CS_YB[Y.level] || CS_YB.normal, d = Math.max(L.min, L.d0 - s * L.step);
  var A = csEl('cs-cup' + ca), B = csEl('cs-cup' + cb), xa = csCupX(sa), xb = csCupX(sb);
  Y.pos[ca] = sb; Y.pos[cb] = sa;
  A.style.transition = B.style.transition = 'none';
  A.style.transform = 'translateX(' + xb + 'px)'; B.style.transform = 'translateX(' + xa + 'px)';
  if (A.animate) {
    A.animate([{ transform: 'translate(' + xa + 'px,0) scale(1)' }, { transform: 'translate(' + (xa + xb) / 2 + 'px,-24px) scale(1.06)' }, { transform: 'translate(' + xb + 'px,0) scale(1)' }], { duration: d, easing: 'ease-in-out' });
    B.animate([{ transform: 'translate(' + xb + 'px,0) scale(1)' }, { transform: 'translate(' + (xa + xb) / 2 + 'px,24px) scale(.96)' }, { transform: 'translate(' + xa + 'px,0) scale(1)' }], { duration: d, easing: 'ease-in-out' });
  }
  csLater(function () { csCupShuffle(s + 1, total); }, d + L.gap);
}
function csCup(i) {
  var Y = CS.yb; if (!Y || Y.phase !== 'pick') return;
  Y.phase = 'done';
  for (var k = 0; k < 3; k++) csEl('cs-cup' + k).classList.remove('pickable');
  csEl('cs-cup' + i).classList.add('lift');
  csLater(function () {
    var hit = i === Y.ball, stake = Y.stake;
    if (!hit) csEl('cs-cup' + Y.ball).classList.add('lift');
    CS.yb = null;
    csCupHelp(hit ? '찾았다! 🎯' : '공은 여기 있었어요!');
    var mult = (CS_YB[Y.level] || CS_YB.normal).mult;
    csSettle(stake, hit ? mult : 0, '공을 찾았어요! ×' + mult, '엉뚱한 컵이었어요!');
    /* 2초 뒤 컵을 다시 내리고 공도 치워요 (끝난 뒤 공이 계속 보이지 않게) */
    csLater(function () { if (CS.yb) return; for (var k = 0; k < 3; k++) { var c = csEl('cs-cup' + k); if (c) c.classList.remove('lift'); } csLater(function () { if (CS.yb) return; for (var k = 0; k < 3; k++) { var c = csEl('cs-cup' + k); if (c) c.classList.remove('has'); } }, 400); }, 2000);
  }, 650);
}
