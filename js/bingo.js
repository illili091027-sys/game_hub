/* ---------------- 빙고 대작전 (온라인, 2~10명) ----------------
   1) 채우기: 주제에 맞는 단어(또는 숫자)로 내 5×5 빙고판을 겹치지 않게 채워요.
   2) 부르기: 차례대로 내 판에 있는 단어 하나를 눌러서 불러요. 누가 부르든 그 단어가
      내 판에 있으면 자동으로 동그라미! (띄어쓰기/대소문자는 무시하고 비교)
   3) 가로·세로·대각선 3줄을 먼저 완성하면 빙고! (동시에 완성하면 공동 우승)
   진행 상태 roomKey('bingo')는 방장 + 지금 차례인 사람만 쓰고, 각자 판은 roomKey('bg_'+id)에 따로 저장. */
var BG_MIN = 2, BG_MAX = 10, BG_GOAL = 3;
var BG_FILL_SECONDS = 120, BG_TURN_SECONDS = 25;
var BG_TOPICS = ['숫자 (1~50)', '과일', '동물', '나라 이름', '음식', '직업', '과자·간식', '탈것', '운동·스포츠', '가수·아이돌', '게임 이름', '학교에 있는 것', '색깔 이름', '채소', '바다에 사는 것'];
var BG_POLL = null;
var BG_STATE = null;
var BG_MY = null;          // 내 판 {gameId, cells, ready, lines}
var BG_LAST_LINES = -1;

function bgKey() { return roomKey('bingo'); }
function bgMyKey() { return roomKey('bg_' + myPlayerId); }
function bgNorm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }
function stopBingoGame() { clearInterval(BG_POLL); BG_POLL = null; }

function startBingoGame() {
  stopBingoGame();
  BG_STATE = null; BG_MY = null; BG_LAST_LINES = -1;
  document.querySelectorAll('#bingo .bg-phase').forEach(function (el) { el.style.display = 'none'; });
  var n = (roomPlayersList || []).length;
  if (n < BG_MIN || n > BG_MAX) {
    document.getElementById('bg-error').style.display = '';
    document.getElementById('bg-error').textContent = '빙고 대작전은 ' + BG_MIN + '~' + BG_MAX + '명이 필요해요. 지금 ' + n + '명이에요.';
    return;
  }
  bgBuildFillGrid();
  var starter = myPlayerId === roomHostId ? bgHostInit() : Promise.resolve();
  starter.then(function () { bgPoll(); BG_POLL = setInterval(bgPoll, 1000); });
}

function bgHostInit(topic) {
  var order = shuffleArray((roomPlayersList || []).map(function (p) { return p.id; }));
  var names = {};
  (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; });
  var st = { gameId: Date.now(), order: order, names: names, topic: topic || BG_TOPICS[Math.floor(Math.random() * BG_TOPICS.length)], phase: 'fill', deadline: Date.now() + BG_FILL_SECONDS * 1000, turnIdx: 0, calls: [], winners: [] };
  return DBset(bgKey(), st);
}
function bgHostRestart() { if (myPlayerId === roomHostId) bgHostInit().then(bgPoll); }
function bgHostChangeTopic() {
  if (myPlayerId !== roomHostId) return;
  DBget(bgKey()).then(function (st) {
    if (!st || st.phase !== 'fill') return;
    var others = BG_TOPICS.filter(function (t) { return t !== st.topic; });
    st.topic = others[Math.floor(Math.random() * others.length)];
    st.deadline = Date.now() + BG_FILL_SECONDS * 1000;
    DBset(bgKey(), st).then(bgPoll);
  });
}

function bgPoll() {
  DBget(bgKey()).then(function (st) {
    if (!st || !st.order) return;
    if (!BG_STATE || BG_STATE.gameId !== st.gameId) {
      BG_MY = { gameId: st.gameId, cells: [], ready: false, lines: 0 };
      BG_LAST_LINES = -1;
      document.querySelectorAll('#bg-fill-grid input').forEach(function (i) { i.value = ''; i.disabled = false; });
    }
    var topicChanged = BG_STATE && BG_STATE.gameId === st.gameId && BG_STATE.topic !== st.topic;
    BG_STATE = st;
    if (topicChanged && BG_MY && !BG_MY.ready) document.querySelectorAll('#bg-fill-grid input').forEach(function (i) { i.value = ''; });
    bgRender(st);
    if (myPlayerId === roomHostId) bgHostCheck(st);
  });
}

function bgHostCheck(st) {
  if (st.phase === 'fill') {
    DBgetPrefix('bg_', st.order).then(function (all) {
      var ready = st.order.filter(function (pid) { return all[pid] && all[pid].gameId === st.gameId && all[pid].ready; }).length;
      document.getElementById('bg-ready-count').textContent = '완료 ' + ready + '/' + st.order.length;
      if (ready < st.order.length && Date.now() < st.deadline + 3000) return;
      DBget(bgKey()).then(function (cur) {
        if (!cur || cur.gameId !== st.gameId || cur.phase !== 'fill') return;
        cur.phase = 'play'; cur.turnIdx = 0; cur.deadline = Date.now() + BG_TURN_SECONDS * 1000;
        DBset(bgKey(), cur).then(bgPoll);
      });
    });
  } else if (st.phase === 'play') {
    DBgetPrefix('bg_', st.order).then(function (all) {
      var winners = st.order.filter(function (pid) { var d = all[pid]; return d && d.gameId === st.gameId && d.callCount === st.calls.length && (d.lines || 0) >= BG_GOAL; });
      if (winners.length) {
        DBget(bgKey()).then(function (cur) {
          if (!cur || cur.gameId !== st.gameId || cur.phase !== 'play') return;
          cur.phase = 'end'; cur.winners = winners; cur.deadline = null;
          DBset(bgKey(), cur).then(bgPoll);
        });
        return;
      }
      if (Date.now() > st.deadline + 500) {
        var idx = st.turnIdx;
        DBget(bgKey()).then(function (cur) {
          if (!cur || cur.gameId !== st.gameId || cur.phase !== 'play' || cur.turnIdx !== idx) return;
          cur.turnIdx++; cur.deadline = Date.now() + BG_TURN_SECONDS * 1000;
          cur.skipped = (cur.skipped || 0) + 1;
          DBset(bgKey(), cur).then(bgPoll);
        });
      }
    });
  }
}

/* ---- 채우기 ---- */
function bgBuildFillGrid() {
  var g = document.getElementById('bg-fill-grid');
  if (g.childElementCount) return;
  var html = '';
  for (var i = 0; i < 25; i++) html += '<input type="text" maxlength="10" data-i="' + i + '" autocomplete="off" />';
  g.innerHTML = html;
  g.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    var i = +e.target.getAttribute('data-i');
    var next = g.querySelector('input[data-i="' + ((i + 1) % 25) + '"]');
    if (next) next.focus();
  });
}

function bgRandomFill() {
  if (!BG_STATE || BG_STATE.topic.indexOf('숫자') !== 0) return;
  var nums = shuffleArray(Array.from({ length: 50 }, function (_, i) { return String(i + 1); })).slice(0, 25);
  document.querySelectorAll('#bg-fill-grid input').forEach(function (inp, i) { inp.value = nums[i]; });
}

function bgSubmitBoard(force) {
  var st = BG_STATE;
  if (!st || st.phase !== 'fill') return;
  var vals = Array.prototype.map.call(document.querySelectorAll('#bg-fill-grid input'), function (i) { return i.value.trim(); });
  var err = document.getElementById('bg-fill-err');
  if (!force) {
    var empty = vals.filter(function (v) { return !v; }).length;
    if (empty) { err.textContent = '빈칸이 ' + empty + '개 있어요!'; return; }
    var seen = {}, dup = null;
    vals.forEach(function (v) { var k = bgNorm(v); if (seen[k]) dup = v; seen[k] = 1; });
    if (dup) { err.textContent = '"' + dup + '"이(가) 두 번 들어갔어요. 겹치지 않게 써주세요!'; return; }
  }
  err.textContent = '';
  vals = vals.map(function (v, i) { return v || ('?' + (i + 1)); });
  BG_MY = { gameId: st.gameId, cells: vals, ready: true, lines: 0, callCount: 0 };
  document.querySelectorAll('#bg-fill-grid input').forEach(function (i) { i.disabled = true; });
  DBset(bgMyKey(), BG_MY);
  bgRender(st);
}

function bgUnready() {
  if (!BG_MY || !BG_STATE || BG_STATE.phase !== 'fill') return;
  BG_MY.ready = false;
  document.querySelectorAll('#bg-fill-grid input').forEach(function (i) { i.disabled = false; });
  DBset(bgMyKey(), BG_MY);
  bgRender(BG_STATE);
}

/* ---- 부르기 ---- */
function bgMarkedSet(st) {
  var s = {};
  (st.calls || []).forEach(function (c) { s[bgNorm(c.word)] = c; });
  return s;
}
function bgCountLines(marks) {
  var lines = 0, r, c;
  for (r = 0; r < 5; r++) { var ok = true; for (c = 0; c < 5; c++) if (!marks[r * 5 + c]) ok = false; if (ok) lines++; }
  for (c = 0; c < 5; c++) { var ok2 = true; for (r = 0; r < 5; r++) if (!marks[r * 5 + c]) ok2 = false; if (ok2) lines++; }
  var d1 = true, d2 = true;
  for (var i = 0; i < 5; i++) { if (!marks[i * 6]) d1 = false; if (!marks[i * 5 + (4 - i)]) d2 = false; }
  return lines + (d1 ? 1 : 0) + (d2 ? 1 : 0);
}

function bgCall(i) {
  var st = BG_STATE;
  if (!st || st.phase !== 'play' || !BG_MY || !BG_MY.cells.length) return;
  if (st.order[st.turnIdx % st.order.length] !== myPlayerId) return;
  var word = BG_MY.cells[i];
  if (bgMarkedSet(st)[bgNorm(word)]) return;
  DBget(bgKey()).then(function (cur) {
    if (!cur || cur.gameId !== st.gameId || cur.phase !== 'play' || cur.turnIdx !== st.turnIdx) return;
    cur.calls = (cur.calls || []).concat([{ word: word, by: myPlayerId }]);
    cur.turnIdx++;
    cur.deadline = Date.now() + BG_TURN_SECONDS * 1000;
    DBset(bgKey(), cur).then(bgPoll);
  });
}

function bgRender(st) {
  if (!document.getElementById('bingo').classList.contains('active')) return;
  document.querySelectorAll('#bingo .bg-phase').forEach(function (el) { el.style.display = 'none'; });
  var isHost = myPlayerId === roomHostId;
  var remain = st.deadline ? Math.max(0, Math.ceil((st.deadline - Date.now()) / 1000)) : 0;
  document.getElementById('bg-topic').textContent = st.topic;
  if (st.phase === 'fill') {
    document.getElementById('bg-fill').style.display = '';
    document.getElementById('bg-fill-timer').textContent = '⏱ ' + remain + '초';
    var ready = BG_MY && BG_MY.ready;
    document.getElementById('bg-random-btn').style.display = st.topic.indexOf('숫자') === 0 && !ready ? '' : 'none';
    document.getElementById('bg-submit-btn').style.display = ready ? 'none' : '';
    document.getElementById('bg-unready-btn').style.display = ready ? '' : 'none';
    document.getElementById('bg-topic-btn').style.display = isHost && !ready ? '' : 'none';
    document.getElementById('bg-fill-msg').textContent = ready ? '✅ 완료! 다른 친구들을 기다리는 중…' : '주제에 맞는 단어로 25칸을 겹치지 않게 채워요 (Enter로 다음 칸)';
    if (remain <= 1 && !ready) bgSubmitBoard(true);
    if (!isHost) document.getElementById('bg-ready-count').textContent = '';
    return;
  }
  // 내 판 + 체크
  var marks = bgMarkedSet(st);
  var myMarks = (BG_MY && BG_MY.cells.length) ? BG_MY.cells.map(function (w) { return !!marks[bgNorm(w)]; }) : [];
  var lines = myMarks.length ? bgCountLines(myMarks) : 0;
  if (BG_MY && BG_MY.cells.length && (BG_MY.lines !== lines || BG_MY.callCount !== st.calls.length)) {
    BG_MY.lines = lines; BG_MY.callCount = st.calls.length;
    DBset(bgMyKey(), BG_MY);
  }
  if (lines > BG_LAST_LINES && BG_LAST_LINES >= 0 && lines > 0) {
    var pop = document.getElementById('bg-pop');
    pop.textContent = lines >= BG_GOAL ? '🎉 빙고!!' : (lines + '줄 완성!');
    pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
  }
  BG_LAST_LINES = lines;
  if (st.phase === 'play' || st.phase === 'end') {
    document.getElementById('bg-play').style.display = '';
    var turnPid = st.order[st.turnIdx % st.order.length];
    var myTurn = st.phase === 'play' && turnPid === myPlayerId;
    document.getElementById('bg-turn').innerHTML = st.phase === 'end' ? '' :
      (myTurn ? '👉 <b>내 차례!</b> 내 판에서 부를 단어를 눌러요 <span class="bg-t">⏱ ' + remain + '초</span>' : '⏳ <b>' + esc(st.names[turnPid] || '?') + '</b>님이 고르는 중… <span class="bg-t">⏱ ' + remain + '초</span>');
    var lastCall = st.calls[st.calls.length - 1];
    document.getElementById('bg-last-call').innerHTML = lastCall ? ('방금 부른 단어: <b>' + esc(lastCall.word) + '</b> <small>(' + esc(st.names[lastCall.by] || '?') + ')</small>') : '아직 부른 단어가 없어요';
    document.getElementById('bg-lines').textContent = '내 빙고 ' + lines + ' / ' + BG_GOAL + '줄';
    var html = '';
    (BG_MY && BG_MY.cells.length ? BG_MY.cells : []).forEach(function (w, i) {
      var m = myMarks[i];
      var isLast = lastCall && bgNorm(lastCall.word) === bgNorm(w);
      html += '<button class="bg-cell' + (m ? ' marked' : '') + (isLast ? ' last' : '') + (myTurn && !m ? ' callable' : '') + '" onclick="bgCall(' + i + ')">' + esc(w) + '</button>';
    });
    document.getElementById('bg-board').innerHTML = html || '<div class="lobby-hint">빙고판을 못 채워서 구경 중이에요</div>';
    document.getElementById('bg-calls').innerHTML = st.calls.slice().reverse().map(function (c) { return '<span class="bg-call-chip">' + esc(c.word) + '</span>'; }).join('');
    if (st.phase === 'end') {
      document.getElementById('bg-end').style.display = '';
      document.getElementById('bg-end-banner').textContent = '🏆 ' + st.winners.map(function (p) { return st.names[p]; }).join(', ') + ' 빙고 우승!';
      document.getElementById('bg-restart-btn').style.display = isHost ? '' : 'none';
    }
  }
}
