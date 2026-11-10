/* ===================== 얼른 버려! (온라인, 2~8명) =====================
   카드 57장, 한 장에 그림 8개. 어떤 두 장을 골라도 똑같은 그림이 딱 1개 있어요(유한 사영평면, 7차).
   - 각자 카드 더미를 받고, 가운데에 카드 1장.
   - 내 맨 위 카드와 가운데 카드에서 '똑같은 그림'을 찾아 누르면 → 내 카드가 가운데로 버려져요.
   - 내 카드를 가장 먼저 다 버리면 승리! 틀리게 누르면 1.5초 동안 손이 묶여요.
   - 동시에 눌러도 공정하게: 각자 '찾았어요(그림·시각)'를 자기 칸 roomKey('db_'+id)에 쓰고,
     방장 화면이 가장 먼저 누른 사람을 골라 진행 상태 roomKey('dobble')에 반영해요. */
var DB_SYMBOLS = [
  ['💡', '전구'], ['🍼', '젖병'], ['🕷️', '거미'], ['⛄', '눈사람'], ['🧑', '사람'], ['👄', '입술'], ['🕯️', '촛불'], ['🌵', '선인장'],
  ['🔒', '자물쇠'], ['🥕', '당근'], ['🦖', '공룡'], ['🎼', '높은음자리표'], ['🔑', '열쇠'], ['🌳', '나무'], ['💣', '폭탄'], ['🐞', '무당벌레'],
  ['❤️', '하트'], ['✏️', '연필'], ['🐬', '돌고래'], ['🐱', '고양이'], ['🐶', '개'], ['🎯', '과녁'], ['✂️', '가위'], ['🐉', '용'],
  ['⚡', '번개'], ['👻', '유령'], ['🕶️', '선글라스'], ['🧀', '치즈'], ['🧊', '얼음'], ['💧', '물방울'], ['⏰', '시계'], ['🚕', '자동차'],
  ['🕸️', '거미줄'], ['❗', '느낌표'], ['❓', '물음표'], ['🍏', '사과'], ['🦓', '얼룩말'], ['🍀', '네잎클로버'], ['💀', '해골'], ['⚓', '닻'],
  ['🤡', '광대'], ['♞', '나이트'], ['🛖', '이글루'], ['⛔', '표지판'], ['🐦', '새'], ['👁️', '눈'], ['🔥', '모닥불'], ['🍁', '단풍잎'],
  ['🌼', '꽃'], ['❄️', '눈꽃'], ['🔨', '망치'], ['🌙', '달'], ['☀️', '해'], ['✋', '손'], ['🎨', '물감'], ['🐢', '거북이'], ['☯️', '음양']
];
var DB_N = 7; /* 7차 사영평면 → 카드 57장, 한 장에 8개 */
var DB_MIN = 2, DB_MAX = 8, DB_HAND_MAX = 12;
var DB_CARDS = (function () {
  var n = DB_N, cards = [];
  var P = function (m) { return 1 + m; };                 /* 무한원점(기울기 m) */
  var A = function (x, y) { return 1 + n + x * n + y; };   /* 일반 점 (x, y) */
  var line = [0]; for (var m = 0; m < n; m++) line.push(P(m)); cards.push(line);          /* 무한원직선 */
  for (var c = 0; c < n; c++) { var v = [0]; for (var y = 0; y < n; y++) v.push(A(c, y)); cards.push(v); } /* x = c */
  for (var mm = 0; mm < n; mm++) for (var b = 0; b < n; b++) {                              /* y = m x + b */
    var l = [P(mm)]; for (var xx = 0; xx < n; xx++) l.push(A(xx, (mm * xx + b) % n)); cards.push(l);
  }
  return cards;
})();

var DB_POLL = null, DB_HOST_POLL = null, DB_STATE = null, DB_LOCK_UNTIL = 0, DB_MY_CLAIM = null, DB_LAST_SEQ = -1, DB_SEED = 1;

function dbKey() { return roomKey('dobble'); }
function dbMyKey() { return roomKey('db_' + myPlayerId); }
function dbCommon(a, b) {
  var A = DB_CARDS[a], B = DB_CARDS[b];
  for (var i = 0; i < A.length; i++) if (B.indexOf(A[i]) >= 0) return A[i];
  return -1;
}
function dbRand(seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }

function stopDobbleGame() {
  clearInterval(DB_POLL); DB_POLL = null;
  clearInterval(DB_HOST_POLL); DB_HOST_POLL = null;
}

function startDobbleGame() {
  stopDobbleGame();
  DB_STATE = null; DB_LOCK_UNTIL = 0; DB_MY_CLAIM = null; DB_LAST_SEQ = -1;
  document.getElementById('db-result').style.display = 'none';
  var n = (roomPlayersList || []).length;
  var err = document.getElementById('db-error');
  if (n < DB_MIN || n > DB_MAX) {
    err.style.display = ''; err.textContent = '얼른 버려!는 ' + DB_MIN + '~' + DB_MAX + '명이 필요해요. 지금 ' + n + '명이에요.';
    return;
  }
  err.style.display = 'none';
  var starter = myPlayerId === roomHostId ? dbHostInit() : Promise.resolve();
  starter.then(function () {
    dbPoll();
    DB_POLL = setInterval(dbPoll, 250);
    if (myPlayerId === roomHostId) DB_HOST_POLL = setInterval(dbHostResolve, 200);
  });
}

function dbHostInit() {
  var order = shuffleArray((roomPlayersList || []).map(function (p) { return p.id; }));
  var names = {}; (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; });
  var deck = shuffleArray(DB_CARDS.map(function (_, i) { return i; }));
  var center = deck.pop();
  var per = Math.min(DB_HAND_MAX, Math.floor(deck.length / order.length));
  var hands = {};
  order.forEach(function (pid) { hands[pid] = deck.splice(0, per); });
  var st = { gameId: Date.now(), seed: Math.floor(Math.random() * 1e9), order: order, names: names, hands: hands, center: center, seq: 0, phase: 'play', startAt: Date.now() + 3500, last: null, per: per };
  return DBset(dbKey(), st);
}
function dbHostRestart() { if (myPlayerId === roomHostId) dbHostInit().then(dbPoll); }

/* ---- 방장: 가장 먼저 맞힌 사람을 골라서 진행 ---- */
var DB_RESOLVE_BUSY = false;
function dbHostResolve() {
  if (myPlayerId !== roomHostId || DB_RESOLVE_BUSY || !DB_STATE || DB_STATE.phase !== 'play') return;
  DB_RESOLVE_BUSY = true;
  DBgetPrefix('db_', DB_STATE.order).then(function (claims) {
    return DBget(dbKey()).then(function (st) {
      if (!st || st.phase !== 'play') return;
      var best = null;
      Object.keys(claims).forEach(function (pid) {
        var c = claims[pid];
        if (!c || c.gameId !== st.gameId || c.seq !== st.seq) return;
        var hand = st.hands[pid];
        if (!hand || !hand.length) return;
        var top = hand[hand.length - 1];
        if (dbCommon(top, st.center) !== c.sym) return; /* 방장도 한 번 더 확인 */
        if (!best || c.t < best.t || (c.t === best.t && pid < best.pid)) best = { pid: pid, t: c.t, sym: c.sym };
      });
      if (!best) return;
      var hand = st.hands[best.pid];
      st.center = hand.pop();
      st.seq++;
      st.last = { pid: best.pid, sym: best.sym, at: Date.now() };
      if (!hand.length) { st.phase = 'end'; st.winner = best.pid; }
      return DBset(dbKey(), st).then(function () { DB_STATE = st; dbRender(st); });
    });
  }).then(function () { DB_RESOLVE_BUSY = false; }, function () { DB_RESOLVE_BUSY = false; });
}

function dbPoll() {
  DBget(dbKey()).then(function (st) {
    if (!st || !st.order) return;
    if (!DB_STATE || DB_STATE.gameId !== st.gameId) { DB_LAST_SEQ = -1; DB_MY_CLAIM = null; DB_SEED = st.seed || 1; document.getElementById('db-result').style.display = 'none'; }
    var changed = !DB_STATE || DB_STATE.gameId !== st.gameId || DB_STATE.seq !== st.seq || DB_STATE.phase !== st.phase;
    DB_STATE = st;
    if (changed) dbRender(st);
    else dbRenderCountdown(st);
  });
}

/* ---- 카드 그리기 ---- */
function dbCardHtml(cardId, who) {
  var r = dbRand((DB_SEED + cardId * 7919) | 0);
  var syms = shuffleArray(DB_CARDS[cardId].slice());
  /* 가운데 1개 + 둘레 7개, 크기·각도는 카드마다 다르게 */
  var html = '';
  syms.forEach(function (s, i) {
    var x, y, size;
    if (i === 0) { x = 50 + (r() - 0.5) * 6; y = 50 + (r() - 0.5) * 6; size = 15 + r() * 6; }
    else {
      var ang = (i - 1) / 7 * Math.PI * 2 + r() * 0.35;
      var rad = 30 + r() * 4;
      x = 50 + Math.cos(ang) * rad; y = 50 + Math.sin(ang) * rad; size = 11 + r() * 8;
    }
    var rot = Math.round(r() * 360);
    html += '<button type="button" class="db-sym" data-sym="' + s + '" data-who="' + who + '" title="' + DB_SYMBOLS[s][1] + '" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1) + '%;font-size:' + size.toFixed(1) + 'cqw;transform:translate(-50%,-50%) rotate(' + rot + 'deg)">' + DB_SYMBOLS[s][0] + '</button>';
  });
  return '<div class="db-card-face">' + html + '</div>';
}

function dbRenderCountdown(st) {
  var cd = document.getElementById('db-count');
  var left = Math.ceil((st.startAt - Date.now()) / 1000);
  if (st.phase === 'play' && left > 0) { cd.style.display = ''; cd.textContent = left; }
  else if (cd.style.display !== 'none') { cd.style.display = 'none'; dbRender(st); }
}

function dbRender(st) {
  if (!document.getElementById('dobble').classList.contains('active')) return;
  var mine = st.hands[myPlayerId] || [];
  var top = mine.length ? mine[mine.length - 1] : null;
  var started = Date.now() >= st.startAt;
  dbRenderCountdown(st);
  /* 가운데 카드 */
  var cEl = document.getElementById('db-center');
  if (cEl.getAttribute('data-c') !== String(st.center) + ':' + st.gameId) {
    cEl.setAttribute('data-c', String(st.center) + ':' + st.gameId);
    cEl.innerHTML = started ? dbCardHtml(st.center, 'center') : '<div class="db-card-back">?</div>';
    cEl.classList.remove('flip'); void cEl.offsetWidth; cEl.classList.add('flip');
  } else if (started && cEl.querySelector('.db-card-back')) cEl.innerHTML = dbCardHtml(st.center, 'center');
  /* 내 카드 */
  var mEl = document.getElementById('db-mine');
  var key = (top === null ? 'none' : top) + ':' + st.gameId + ':' + started;
  if (mEl.getAttribute('data-c') !== key) {
    mEl.setAttribute('data-c', key);
    mEl.innerHTML = top === null ? '<div class="db-card-done">🎉<br>다 버렸어요!</div>' : (started ? dbCardHtml(top, 'mine') : '<div class="db-card-back">?</div>');
    mEl.classList.remove('flip'); void mEl.offsetWidth; mEl.classList.add('flip');
  }
  document.getElementById('db-my-left').textContent = mine.length;
  /* 다른 사람들 */
  document.getElementById('db-players').innerHTML = st.order.map(function (pid) {
    var n = (st.hands[pid] || []).length;
    var lead = st.last && st.last.pid === pid && Date.now() - st.last.at < 1500;
    return '<div class="db-player' + (pid === myPlayerId ? ' me' : '') + (lead ? ' got' : '') + '"><span class="db-pname">' + esc(st.names[pid] || '?') + (pid === myPlayerId ? ' (나)' : '') + '</span>' +
      '<span class="db-pstack">' + '<i></i>'.repeat(Math.min(n, 6)) + '</span><b>' + n + '장</b></div>';
  }).join('');
  /* 방금 누가 버렸는지 */
  var msg = document.getElementById('db-msg');
  if (st.last && st.seq !== DB_LAST_SEQ) {
    DB_LAST_SEQ = st.seq;
    var me2 = st.last.pid === myPlayerId;
    msg.innerHTML = (me2 ? '✅ <b>내가</b> 먼저 찾았어요! ' : '⚡ <b>' + esc(st.names[st.last.pid] || '') + '</b> 님이 먼저! ') + '같은 그림: <span class="db-msg-sym">' + DB_SYMBOLS[st.last.sym][0] + '</span>';
    msg.className = 'db-msg ' + (me2 ? 'good' : 'other');
    if (me2) dbSound('good'); else dbSound('other');
    DB_MY_CLAIM = null;
  } else if (!st.last && st.seq !== DB_LAST_SEQ) {
    DB_LAST_SEQ = st.seq;
    msg.innerHTML = '내 카드와 가운데 카드에서 <b>똑같은 그림</b>을 찾아 눌러요!';
    msg.className = 'db-msg';
  }
  if (st.phase === 'end') dbShowResult(st);
}

function dbShowResult(st) {
  var box = document.getElementById('db-result');
  if (box.style.display !== 'none' && box.getAttribute('data-g') === String(st.gameId)) return;
  box.setAttribute('data-g', st.gameId);
  box.style.display = '';
  var rows = st.order.map(function (pid) { return { pid: pid, n: (st.hands[pid] || []).length }; }).sort(function (a, b) { return a.n - b.n; });
  document.getElementById('db-result-title').textContent = '🏆 ' + (st.names[st.winner] || '') + ' 님 승리!';
  typeof celebrateWin === 'function' && celebrateWin('dobble:' + st.gameId, [st.names[st.winner]], '얼른 버려!');
  renderRankBoard('db-result-rank', rows.map(function (r) { return { name: st.names[r.pid] || '?', isMe: r.pid === myPlayerId, label: r.n ? '남은 카드 ' + r.n + '장' : '다 버림! 🎉' }; }));
  document.getElementById('db-restart').style.display = myPlayerId === roomHostId ? '' : 'none';
  if (st.winner === myPlayerId) dbSound('win');
}

/* ---- 누르기 ---- */
function dbTap(sym, el) {
  var st = DB_STATE;
  if (!st || st.phase !== 'play' || Date.now() < st.startAt) return;
  var mine = st.hands[myPlayerId] || [];
  if (!mine.length) return;
  var now = Date.now();
  if (now < DB_LOCK_UNTIL) { dbFlash('🙅 잠깐! ' + Math.ceil((DB_LOCK_UNTIL - now) / 100) / 10 + '초', 'bad'); return; }
  if (DB_MY_CLAIM && DB_MY_CLAIM.seq === st.seq) return; /* 이미 보냄 */
  var top = mine[mine.length - 1];
  var common = dbCommon(top, st.center);
  if (sym !== common) {
    DB_LOCK_UNTIL = now + 1500;
    dbSound('bad');
    if (el) { el.classList.remove('wrong'); void el.offsetWidth; el.classList.add('wrong'); }
    var area = document.getElementById('db-table'); area.classList.remove('shake'); void area.offsetWidth; area.classList.add('shake');
    dbFlash('❌ 땡! 1.5초 쉬어요', 'bad');
    return;
  }
  DB_MY_CLAIM = { gameId: st.gameId, seq: st.seq, sym: sym, t: now };
  DBset(dbMyKey(), DB_MY_CLAIM);
  document.querySelectorAll('.db-sym[data-sym="' + sym + '"]').forEach(function (b) { b.classList.add('hit'); });
  dbFlash('🎯 찾았다!', 'good');
  if (myPlayerId === roomHostId) setTimeout(dbHostResolve, 30);
}
function dbFlash(text, cls) {
  var f = document.getElementById('db-flash');
  f.textContent = text; f.className = 'db-flash show ' + (cls || '');
  clearTimeout(dbFlash.t); dbFlash.t = setTimeout(function () { f.className = 'db-flash'; }, 900);
}
function dbSound(kind) {
  try {
    if (typeof mmSound !== 'function') return;
    mmSound(kind === 'good' ? 'catch' : kind === 'bad' ? 'wrong' : kind === 'win' ? 'win' : 'pop');
  } catch (e) {}
}

(function dbSetup() {
  var t = document.getElementById('db-table');
  if (!t) return;
  t.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.db-sym');
    if (!b) return;
    e.preventDefault();
    dbTap(+b.getAttribute('data-sym'), b);
  });
})();
