/* ---------------- 색감과 직감 (Hues and Cues 방식, 온라인 전용 3~10명) ----------------
   30칸 x 16줄(A~P) 색상판. 출제자가 카드 4가지 색 중 하나를 몰래 고르고, 색 이름을 쓰지 않는
   1단어 힌트를 주면 나머지 사람들이 차례대로(출제자 다음 사람부터) 색상판에 말을 1개씩 놓습니다.
   이어서 출제자가 최대 2단어 추가 힌트를 주면 이번엔 역순으로 말을 1개씩 더 놓습니다.
   정답 공개 후 정답 칸 기준 3x3 채점틀로 점수를 매깁니다.
   - 플레이어: 정답 칸 3점 / 채점틀 안(정답 칸 제외) 2점 / 채점틀 바로 바깥 한 줄 1점
   - 출제자: 채점틀(3x3) 안에 들어온 말 1개당 1점(최대 9점)
   모든 사람이 한 번씩 출제자를 하면 끝, 총점이 가장 높은 사람이 승리.
   진행 상태는 roomKey('hues') 하나에 다 들어있고(정답 칸도 포함 - 이 앱은 로그인이 없어서
   마피아 게임과 같은 수준으로 화면에서만 가립니다), 시간 초과 처리는 방장 화면이 맡습니다. */
var HU_COLS = 30;
var HU_ROWS = 16;
var HU_ROW_LABELS = 'ABCDEFGHIJKLMNOP';
var HU_MIN_PLAYERS = 3;
var HU_MAX_PLAYERS = 10;
var HU_PICK_SECONDS = 40;
var HU_CLUE_SECONDS = 60;
var HU_TURN_SECONDS = 30;
var HU_POLL_TIMER = null;
var HU_BOARD_BUILT = false;
var HU_SELECTED = null;
var HU_LAST_PHASE_SIG = '';
var HU_BANNED_COLOR_WORDS = ['빨강', '빨간', '빨갛', '파랑', '파란', '파랗', '노랑', '노란', '노랗', '초록', '녹색', '주황', '보라', '분홍', '검정', '검은', '까만', '하양', '하얀', '흰색', '회색', '갈색', '남색', '적색', '청색', '황색',
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white', 'gray', 'grey', 'brown'];

function huKey() { return roomKey('hues'); }

/* 색상판 색: 가로(1~30)는 색상환을 한 바퀴, 세로(A~P)는 위쪽이 밝고 아래쪽이 어둡게. */
function huColor(r, c) {
  var hue = Math.round((c / HU_COLS) * 360);
  var light = Math.round(86 - r * 4.1);
  var sat = Math.round(62 + Math.sin((r / (HU_ROWS - 1)) * Math.PI) * 26);
  return 'hsl(' + hue + ', ' + sat + '%, ' + light + '%)';
}
function huCoord(r, c) { return HU_ROW_LABELS[r] + (c + 1); }
function huDist(a, b) { return Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)); }

function stopHuesGame() {
  clearInterval(HU_POLL_TIMER);
  HU_POLL_TIMER = null;
}

function startHuesGame() {
  stopHuesGame();
  HU_SELECTED = null;
  HU_LAST_PHASE_SIG = '';
  document.querySelectorAll('#hues .hu-phase').forEach(function (el) { el.style.display = 'none'; });
  huBuildBoard();
  var n = (roomPlayersList || []).length;
  if (n < HU_MIN_PLAYERS || n > HU_MAX_PLAYERS) {
    document.getElementById('hu-error-area').style.display = '';
    document.getElementById('hu-error-msg').textContent = '색감과 직감은 ' + HU_MIN_PLAYERS + '~' + HU_MAX_PLAYERS + '명이 모여야 할 수 있어요. 지금 방 인원: ' + n + '명. 인원을 맞춘 뒤 홈에서 다시 골라주세요.';
    return;
  }
  var starter = (myPlayerId === roomHostId) ? huHostInit() : Promise.resolve();
  starter.then(function () {
    huPoll();
    HU_POLL_TIMER = setInterval(huPoll, 1000);
  });
}

function huRandomCards(count) {
  var picks = [];
  while (picks.length < count) {
    var p = { r: Math.floor(Math.random() * HU_ROWS), c: Math.floor(Math.random() * HU_COLS) };
    if (picks.some(function (q) { var dc = Math.abs(p.c - q.c); return Math.min(dc, HU_COLS - dc) < 5; })) continue;
    picks.push(p);
  }
  return picks;
}

function huNewRoundFields(state) {
  var giverId = state.order[state.round];
  var gIdx = state.order.indexOf(giverId);
  var guessers = [];
  for (var k = 1; k < state.order.length; k++) guessers.push(state.order[(gIdx + k) % state.order.length]);
  state.giverId = giverId;
  state.guessers = guessers;
  state.phase = 'pick';
  state.cards = huRandomCards(4);
  state.target = null;
  state.clue1 = '';
  state.clue2 = '';
  state.markers = [];
  state.turnIdx = 0;
  state.roundScores = null;
  state.deadline = Date.now() + HU_PICK_SECONDS * 1000;
  return state;
}

function huHostInit() {
  return DBget(huKey()).then(function (state) {
    var currentIds = (roomPlayersList || []).map(function (p) { return p.id; }).sort().join(',');
    var existingIds = (state && state.players) ? state.players.map(function (p) { return p.id; }).sort().join(',') : '';
    if (state && state.phase && state.phase !== 'end' && existingIds === currentIds) return;
    var players = roomPlayersList.map(function (p) { return { id: p.id, name: p.name }; });
    var scores = {};
    players.forEach(function (p) { scores[p.id] = 0; });
    var fresh = { gameId: Date.now(), players: players, order: shuffleArray(players.map(function (p) { return p.id; })), round: 0, scores: scores, usedClues: [], history: [] };
    return DBset(huKey(), huNewRoundFields(fresh));
  });
}

function huHostRestart() {
  if (myPlayerId !== roomHostId) return;
  DBset(huKey(), null).then(function () {
    HU_LAST_PHASE_SIG = '';
    huHostInit().then(huPoll);
  });
}

function huName(state, pid) {
  var p = (state.players || []).filter(function (x) { return x.id === pid; })[0];
  return p ? p.name : '?';
}

function huPoll() {
  DBget(huKey()).then(function (state) {
    if (!state || !state.phase) return;
    huRender(state);
    if (myPlayerId === roomHostId) huHostCheckTimeout(state);
  });
}

/* ---- 시간 초과는 방장 화면이 대신 처리 ---- */
function huHostCheckTimeout(state) {
  if (!state.deadline || Date.now() < state.deadline + 400) return;
  if (state.phase === 'pick') {
    huUpdate(state, function (s) { if (s.phase !== 'pick') return false; s.target = s.cards[Math.floor(Math.random() * s.cards.length)]; s.phase = 'clue1'; s.deadline = Date.now() + HU_CLUE_SECONDS * 1000; });
  } else if (state.phase === 'clue1' || state.phase === 'clue2') {
    var ph = state.phase;
    huUpdate(state, function (s) { if (s.phase !== ph) return false; huAdvanceAfterClue(s, ph === 'clue1' ? '(시간 초과)' : ''); });
  } else if (state.phase === 'guess1' || state.phase === 'guess2') {
    var ph2 = state.phase, idx = state.turnIdx;
    huUpdate(state, function (s) { if (s.phase !== ph2 || s.turnIdx !== idx) return false; huAdvanceTurn(s); });
  }
}

/* 최신 상태를 다시 읽어서 고친 뒤 저장(mutator가 false를 돌려주면 저장 안 함) */
function huUpdate(_unused, mutator) {
  return DBget(huKey()).then(function (s) {
    if (!s || !s.phase) return;
    if (mutator(s) === false) return;
    return DBset(huKey(), s).then(function () { huRender(s); });
  });
}

function huTurnOrder(s) {
  return s.phase === 'guess2' ? s.guessers.slice().reverse() : s.guessers;
}

function huAdvanceTurn(s) {
  s.turnIdx++;
  if (s.turnIdx >= s.guessers.length) {
    if (s.phase === 'guess1') { s.phase = 'clue2'; s.deadline = Date.now() + HU_CLUE_SECONDS * 1000; }
    else huReveal(s);
  } else {
    s.deadline = Date.now() + HU_TURN_SECONDS * 1000;
  }
}

function huAdvanceAfterClue(s, clue) {
  if (s.phase === 'clue1') { s.clue1 = clue; s.phase = 'guess1'; }
  else { s.clue2 = clue; s.phase = 'guess2'; }
  s.turnIdx = 0;
  s.deadline = Date.now() + HU_TURN_SECONDS * 1000;
}

function huReveal(s) {
  s.phase = 'reveal';
  s.deadline = null;
  var rs = {};
  var giverPts = 0;
  s.markers.forEach(function (m) {
    var d = huDist(m, s.target);
    var pts = d === 0 ? 3 : d === 1 ? 2 : d === 2 ? 1 : 0;
    rs[m.pid] = (rs[m.pid] || 0) + pts;
    if (d <= 1) giverPts++;
  });
  giverPts = Math.min(9, giverPts);
  rs[s.giverId] = (rs[s.giverId] || 0) + giverPts;
  Object.keys(rs).forEach(function (pid) { s.scores[pid] = (s.scores[pid] || 0) + rs[pid]; });
  s.roundScores = rs;
  s.history = (s.history || []).concat([{ giver: huName(s, s.giverId), coord: huCoord(s.target.r, s.target.c), r: s.target.r, c: s.target.c, clue1: s.clue1, clue2: s.clue2 }]);
}

/* ---- 행동 ---- */
function huPickCard(i) {
  huUpdate(null, function (s) {
    if (s.phase !== 'pick' || s.giverId !== myPlayerId) return false;
    s.target = s.cards[i];
    s.phase = 'clue1';
    s.deadline = Date.now() + HU_CLUE_SECONDS * 1000;
  });
}

function huValidateClue(text, maxWords, used) {
  if (!text) return '힌트를 입력해주세요.';
  var words = text.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) return maxWords === 1 ? '첫 번째 힌트는 띄어쓰기 없이 1단어만 쓸 수 있어요.' : '두 번째 힌트는 최대 2단어까지예요.';
  var lower = text.toLowerCase();
  var banned = HU_BANNED_COLOR_WORDS.filter(function (w) { return lower.indexOf(w) !== -1; })[0];
  if (banned) return '"' + banned + '"처럼 기본 색 이름은 쓸 수 없어요! (예: 라벤더, 체리, 해질녘바다 같은 표현은 OK)';
  if (/^[a-pA-P]\s*-?\s*\d{1,2}$/.test(text.trim())) return '좌표를 힌트로 쓸 수는 없어요.';
  if ((used || []).indexOf(text.trim()) !== -1) return '이번 게임에서 이미 나온 힌트예요. 다른 표현을 써주세요.';
  return '';
}

function huSubmitClue() {
  var input = document.getElementById('hu-clue-input');
  var errEl = document.getElementById('hu-clue-err');
  var text = input.value.trim().slice(0, 30);
  DBget(huKey()).then(function (s) {
    if (!s || s.giverId !== myPlayerId || (s.phase !== 'clue1' && s.phase !== 'clue2')) return;
    var err = huValidateClue(text, s.phase === 'clue1' ? 1 : 2, s.usedClues);
    if (err) { errEl.textContent = err; return; }
    errEl.textContent = '';
    input.value = '';
    huUpdate(null, function (s2) {
      if (s2.giverId !== myPlayerId || (s2.phase !== 'clue1' && s2.phase !== 'clue2')) return false;
      s2.usedClues = (s2.usedClues || []).concat([text]);
      huAdvanceAfterClue(s2, text);
    });
  });
}

function huSkipClue2() {
  huUpdate(null, function (s) {
    if (s.phase !== 'clue2' || s.giverId !== myPlayerId) return false;
    huAdvanceAfterClue(s, '(추가 힌트 없음)');
  });
}

function huPlaceMarker() {
  if (!HU_SELECTED) return;
  var sel = HU_SELECTED;
  huUpdate(null, function (s) {
    if (s.phase !== 'guess1' && s.phase !== 'guess2') return false;
    if (huTurnOrder(s)[s.turnIdx] !== myPlayerId) return false;
    if (s.markers.some(function (m) { return m.r === sel.r && m.c === sel.c; })) { document.getElementById('hu-place-err').textContent = '이미 다른 말이 있는 칸이에요.'; return false; }
    s.markers.push({ pid: myPlayerId, r: sel.r, c: sel.c, n: s.phase === 'guess1' ? 1 : 2 });
    huAdvanceTurn(s);
  }).then(function () { HU_SELECTED = null; });
}

function huHostSkipTurn() {
  if (myPlayerId !== roomHostId) return;
  huUpdate(null, function (s) {
    if (s.phase !== 'guess1' && s.phase !== 'guess2') return false;
    huAdvanceTurn(s);
  });
}

function huHostNextRound() {
  if (myPlayerId !== roomHostId) return;
  huUpdate(null, function (s) {
    if (s.phase !== 'reveal') return false;
    s.round++;
    if (s.round >= s.order.length) { s.phase = 'end'; s.deadline = null; return; }
    huNewRoundFields(s);
  });
}

/* ---- 색상판 ---- */
function huBuildBoard() {
  if (HU_BOARD_BUILT) return;
  var board = document.getElementById('hu-board');
  var html = '<div class="hu-corner"></div>';
  for (var c = 0; c < HU_COLS; c++) html += '<div class="hu-lbl hu-lbl-top">' + (c + 1) + '</div>';
  for (var r = 0; r < HU_ROWS; r++) {
    html += '<div class="hu-lbl hu-lbl-left">' + HU_ROW_LABELS[r] + '</div>';
    for (var c2 = 0; c2 < HU_COLS; c2++) {
      html += '<div class="hu-cell" data-r="' + r + '" data-c="' + c2 + '" style="background:' + huColor(r, c2) + '"></div>';
    }
  }
  board.innerHTML = html;
  board.addEventListener('click', function (e) {
    var cell = e.target.closest && e.target.closest('.hu-cell');
    if (!cell || !board.classList.contains('can-place')) return;
    HU_SELECTED = { r: +cell.getAttribute('data-r'), c: +cell.getAttribute('data-c') };
    document.getElementById('hu-place-err').textContent = '';
    huPoll();
  });
  HU_BOARD_BUILT = true;
}

function huCell(r, c) { return document.querySelector('#hu-board .hu-cell[data-r="' + r + '"][data-c="' + c + '"]'); }

function huPaintBoard(state, opts) {
  var board = document.getElementById('hu-board');
  board.querySelectorAll('.hu-cell').forEach(function (el) {
    el.className = 'hu-cell';
    el.innerHTML = '';
  });
  board.classList.toggle('can-place', !!opts.canPlace);
  if (opts.showTarget && state.target) {
    for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
      var el = huCell(state.target.r + dr, state.target.c + dc);
      if (!el) continue;
      var d = Math.max(Math.abs(dr), Math.abs(dc));
      el.classList.add(d === 0 ? 'hu-target' : d === 1 ? 'hu-frame' : 'hu-outer');
    }
  }
  if (opts.giverPeek && state.target) {
    var t = huCell(state.target.r, state.target.c);
    if (t) t.classList.add('hu-peek');
  }
  (state.markers || []).forEach(function (m) {
    var el2 = huCell(m.r, m.c);
    if (!el2) return;
    var nm = huName(state, m.pid);
    el2.innerHTML = '<span class="hu-marker' + (m.pid === myPlayerId ? ' mine' : '') + '" style="--mc:' + chatAvatarColor(m.pid) + '" title="' + esc(nm) + '">' + esc(nm.charAt(0)) + '</span>';
  });
  if (opts.canPlace && HU_SELECTED) {
    var sel = huCell(HU_SELECTED.r, HU_SELECTED.c);
    if (sel) sel.classList.add('hu-selected');
  }
}

/* ---- 화면 ---- */
function huRender(state) {
  if (!document.getElementById('hues').classList.contains('active')) return;
  document.querySelectorAll('#hues .hu-phase').forEach(function (el) { el.style.display = 'none'; });
  var isGiver = state.giverId === myPlayerId;
  var isHost = myPlayerId === roomHostId;
  var giverName = huName(state, state.giverId);
  var phaseSig = state.gameId + ':' + state.round + ':' + state.phase + ':' + state.turnIdx;
  if (phaseSig !== HU_LAST_PHASE_SIG) {
    HU_LAST_PHASE_SIG = phaseSig;
    HU_SELECTED = null;
    document.getElementById('hu-place-err').textContent = '';
  }
  var remain = state.deadline ? Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000)) : null;

  document.getElementById('hu-round-pill').textContent = state.phase === 'end' ? '게임 끝' : ('라운드 ' + (state.round + 1) + '/' + state.order.length + ' · 출제자 ' + giverName);
  document.getElementById('hu-timer').textContent = remain !== null ? ('⏱ ' + remain + '초') : '';
  var clueBox = document.getElementById('hu-clues');
  var clues = [];
  if (state.clue1) clues.push('<span class="hu-clue"><small>힌트 1</small>' + esc(state.clue1) + '</span>');
  if (state.clue2) clues.push('<span class="hu-clue"><small>힌트 2</small>' + esc(state.clue2) + '</span>');
  clueBox.innerHTML = clues.join('');
  clueBox.style.display = clues.length ? '' : 'none';

  var canPlace = false;
  var showBoard = state.phase !== 'end';
  document.getElementById('hu-board-area').style.display = showBoard ? '' : 'none';

  if (state.phase === 'pick') {
    document.getElementById('hu-pick-area').style.display = '';
    if (isGiver) {
      document.getElementById('hu-pick-title').textContent = '🎨 내가 출제자! 아래 카드 4가지 색 중 하나를 몰래 골라주세요.';
      document.getElementById('hu-cards').innerHTML = state.cards.map(function (cd, i) {
        return '<button class="hu-card" onclick="huPickCard(' + i + ')"><span class="hu-card-swatch" style="background:' + huColor(cd.r, cd.c) + '"></span><span class="hu-card-coord">' + huCoord(cd.r, cd.c) + '</span></button>';
      }).join('');
    } else {
      document.getElementById('hu-pick-title').textContent = '🤫 ' + giverName + '님이 문제로 낼 색을 고르는 중이에요...';
      document.getElementById('hu-cards').innerHTML = '';
    }
  } else if (state.phase === 'clue1' || state.phase === 'clue2') {
    document.getElementById('hu-clue-area').style.display = '';
    var first = state.phase === 'clue1';
    if (isGiver) {
      document.getElementById('hu-clue-form').style.display = '';
      document.getElementById('hu-clue-wait').style.display = 'none';
      document.getElementById('hu-clue-title').innerHTML = '내 정답 색: <span class="hu-mini-swatch" style="background:' + huColor(state.target.r, state.target.c) + '"></span> <b>' + huCoord(state.target.r, state.target.c) + '</b> — ' +
        (first ? '색 이름 없이 <b>1단어</b> 힌트를 주세요.' : '<b>최대 2단어</b> 추가 힌트를 주세요.');
      document.getElementById('hu-clue-input').placeholder = first ? '예: 라벤더' : '예: 해질녘 바다';
      document.getElementById('hu-skip-clue2').style.display = first ? 'none' : '';
    } else {
      document.getElementById('hu-clue-form').style.display = 'none';
      document.getElementById('hu-clue-wait').style.display = '';
      document.getElementById('hu-clue-wait').textContent = '💭 ' + giverName + '님이 ' + (first ? '첫 번째' : '두 번째') + ' 힌트를 생각하는 중...';
    }
  } else if (state.phase === 'guess1' || state.phase === 'guess2') {
    document.getElementById('hu-guess-area').style.display = '';
    var order = huTurnOrder(state);
    var turnPid = order[state.turnIdx];
    canPlace = turnPid === myPlayerId;
    document.getElementById('hu-turn-list').innerHTML = order.map(function (pid, i) {
      var cls = i < state.turnIdx ? 'done' : i === state.turnIdx ? 'now' : '';
      return '<span class="hu-turn-chip ' + cls + '" style="--mc:' + chatAvatarColor(pid) + '">' + esc(huName(state, pid)) + (pid === myPlayerId ? '(나)' : '') + '</span>';
    }).join('<span class="hu-turn-arrow">›</span>');
    var guide = document.getElementById('hu-guess-guide');
    var placeRow = document.getElementById('hu-place-row');
    if (canPlace) {
      guide.innerHTML = '👉 <b>내 차례!</b> 힌트에 맞는 칸을 눌러 고른 뒤 "여기 놓기"를 눌러주세요.' + (state.phase === 'guess2' ? ' (두 번째 말)' : '');
      placeRow.style.display = '';
      var sw = document.getElementById('hu-sel-swatch');
      if (HU_SELECTED) {
        sw.style.background = huColor(HU_SELECTED.r, HU_SELECTED.c);
        document.getElementById('hu-sel-coord').textContent = huCoord(HU_SELECTED.r, HU_SELECTED.c);
        document.getElementById('hu-place-btn').disabled = false;
      } else {
        sw.style.background = 'transparent';
        document.getElementById('hu-sel-coord').textContent = '칸을 골라주세요';
        document.getElementById('hu-place-btn').disabled = true;
      }
    } else {
      placeRow.style.display = 'none';
      guide.textContent = isGiver ? '🎨 다들 내 힌트를 보고 말을 놓는 중이에요. (정답 칸은 나에게만 ★로 보여요)' : ('⏳ ' + huName(state, turnPid) + '님이 말을 놓는 중...');
    }
    document.getElementById('hu-host-skip').style.display = (isHost && !canPlace) ? '' : 'none';
  } else if (state.phase === 'reveal') {
    document.getElementById('hu-reveal-area').style.display = '';
    document.getElementById('hu-reveal-title').innerHTML = '정답은 <span class="hu-mini-swatch big" style="background:' + huColor(state.target.r, state.target.c) + '"></span> <b>' + huCoord(state.target.r, state.target.c) + '</b>!';
    var rs = state.roundScores || {};
    document.getElementById('hu-round-scores').innerHTML = state.players.map(function (p) {
      var pts = rs[p.id] || 0;
      return '<div class="lb-row"><span>' + (p.id === state.giverId ? '🎨 ' : '') + esc(p.name) + (p.id === myPlayerId ? ' (나)' : '') + '</span><b class="lb-score">+' + pts + '</b></div>';
    }).join('');
    document.getElementById('hu-next-btn').style.display = isHost ? '' : 'none';
    document.getElementById('hu-next-btn').textContent = state.round + 1 >= state.order.length ? '🏁 최종 결과 보기' : '다음 라운드 →';
    document.getElementById('hu-reveal-wait').style.display = isHost ? 'none' : '';
  } else if (state.phase === 'end') {
    document.getElementById('hu-end-area').style.display = '';
    var ranked = state.players.slice().sort(function (a, b) { return (state.scores[b.id] || 0) - (state.scores[a.id] || 0); });
    var topScore = ranked.length ? (state.scores[ranked[0].id] || 0) : 0;
    var winners = ranked.filter(function (p) { return (state.scores[p.id] || 0) === topScore; }).map(function (p) { return p.name; });
    document.getElementById('hu-end-banner').textContent = '🏆 ' + winners.join(', ') + ' 승리! (' + topScore + '점)';
    renderRankBoard('hu-end-rank', ranked.map(function (p) { return { name: p.name, isMe: p.id === myPlayerId, label: (state.scores[p.id] || 0) + '점' }; }));
    document.getElementById('hu-end-history').innerHTML = (state.history || []).map(function (h) {
      return '<div class="lb-row"><span><span class="hu-mini-swatch" style="background:' + huColor(h.r, h.c) + '"></span> ' + esc(h.giver) + ' · ' + h.coord + '</span><span class="hu-hist-clue">' + esc(h.clue1) + (h.clue2 && h.clue2.charAt(0) !== '(' ? ' / ' + esc(h.clue2) : '') + '</span></div>';
    }).join('');
    document.getElementById('hu-restart-btn').style.display = isHost ? '' : 'none';
  }

  // 점수판(항상)
  document.getElementById('hu-scoreboard').innerHTML = state.order.map(function (pid) {
    return '<div class="hu-score-row' + (pid === state.giverId && state.phase !== 'end' ? ' giver' : '') + (pid === myPlayerId ? ' me' : '') + '">' +
      '<span class="hu-score-dot" style="background:' + chatAvatarColor(pid) + '"></span>' +
      '<span class="hu-score-name">' + esc(huName(state, pid)) + (pid === state.giverId && state.phase !== 'end' ? ' 🎨' : '') + '</span>' +
      '<b>' + (state.scores[pid] || 0) + '</b></div>';
  }).join('');

  if (showBoard) {
    huPaintBoard(state, {
      canPlace: canPlace,
      showTarget: state.phase === 'reveal',
      giverPeek: isGiver && state.target && state.phase !== 'reveal'
    });
  }
}
