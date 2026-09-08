/* ---------------- 단어 절반 이어맞추기 (온라인: 차례 강제 + 입력중 표시) ---------------- */
/* 예전에는 문장을 자유롭게 이어쓰는 "이어쓰기"였지만,
   지금은 '유튜브' -> '유튜'만 보여주고 나머지 '브'를 차례인 사람이 맞혀서 완성하는 단어 게임입니다. */
var whRoundId = 0;
var whTypingThrottle = null;
var whTypingListenerAttached = false;

function whSplit(full) {
  var half1Len = Math.ceil(full.length / 2);
  return { half1: full.slice(0, half1Len), half2: full.slice(half1Len) };
}

/* 예전에는 바로 직전 단어 하나만 피해서, 단어가 50개뿐이던 것과 겹쳐 같은 단어가 자주 다시 나왔습니다.
   지금은 단어를 훨씬 많이 늘렸고(150개+), 최근에 나온 단어들(최대 20개)은 한동안 다시 뽑히지 않게 피합니다. */
var WH_AVOID_WINDOW = 20;

function whRecentlyUsed(history) {
  if (!history || !history.length) return [];
  var n = Math.min(WH_AVOID_WINDOW, WORDHALF_WORDS.length - 1);
  return history.slice(-n).map(function (h) { return h.full; });
}

function whPickWord(avoidList) {
  avoidList = avoidList || [];
  var pool = shuffleArray(WORDHALF_WORDS);
  for (var i = 0; i < pool.length; i++) {
    if (avoidList.indexOf(pool[i]) === -1) return pool[i];
  }
  return pool[0];
}

function whFirstTurnPlayerId() {
  return (roomPlayersList && roomPlayersList.length) ? roomPlayersList[0].id : null;
}

function whNextTurnPlayerId(currentId) {
  if (!roomPlayersList || !roomPlayersList.length) return null;
  var idx = -1;
  for (var i = 0; i < roomPlayersList.length; i++) {
    if (roomPlayersList[i].id === currentId) { idx = i; break; }
  }
  if (idx === -1) return roomPlayersList[0].id;
  return roomPlayersList[(idx + 1) % roomPlayersList.length].id;
}

function whPlayerNameById(id) {
  if (!roomPlayersList) return '알 수 없음';
  for (var i = 0; i < roomPlayersList.length; i++) {
    if (roomPlayersList[i].id === id) return roomPlayersList[i].name;
  }
  return '알 수 없음';
}

function startStory() {
  if (!whTypingListenerAttached) {
    whTypingListenerAttached = true;
    document.getElementById('st-input').addEventListener('input', whOnTyping);
  }
  DBget(roomKey('wordhalf')).then(function (state) {
    if (!state) {
      var full = whPickWord(null);
      var parts = whSplit(full);
      state = { roundId: Date.now(), full: full, half1: parts.half1, half2: parts.half2, history: [], turnPlayerId: whFirstTurnPlayerId(), typingPlayerId: null, typingTs: 0 };
      DBset(roomKey('wordhalf'), state);
    }
    whRoundId = state.roundId;
    renderWordHalfHistory(state.history);
    renderWordHalfWord(state);
    renderWordHalfTurn(state);
  });
  pollTimer = setInterval(pollWordHalf, 1500);
}

function pollWordHalf() {
  DBget(roomKey('wordhalf')).then(function (state) {
    if (!state) return;
    document.getElementById('st-dot').classList.add('live');
    setTimeout(function () { document.getElementById('st-dot').classList.remove('live'); }, 500);
    var isNewRound = state.roundId !== whRoundId;
    whRoundId = state.roundId;
    renderWordHalfHistory(state.history);
    if (isNewRound) renderWordHalfWord(state);
    renderWordHalfTurn(state);
  });
}

function whOnTyping() {
  if (!myPlayerId || whTypingThrottle) return;
  whTypingThrottle = setTimeout(function () { whTypingThrottle = null; }, 2000);
  DBget(roomKey('wordhalf')).then(function (state) {
    if (!state || state.turnPlayerId !== myPlayerId) return;
    state.typingPlayerId = myPlayerId;
    state.typingTs = Date.now();
    DBset(roomKey('wordhalf'), state);
  });
}

function renderWordHalfWord(state) {
  document.getElementById('st-half1').textContent = state.half1;
  document.getElementById('st-half2-len').textContent = new Array(state.half2.length + 1).join('＿');
  document.getElementById('st-input').value = '';
}

function renderWordHalfTurn(state) {
  var input = document.getElementById('st-input');
  var btn = document.getElementById('st-submit-btn');
  var indicator = document.getElementById('st-turn-indicator');
  var myTurn = !!(myPlayerId && state.turnPlayerId === myPlayerId);
  var typingOther = state.typingPlayerId && state.typingPlayerId !== myPlayerId && (Date.now() - (state.typingTs || 0) < 4000);
  if (typingOther) {
    indicator.textContent = whPlayerNameById(state.typingPlayerId) + '님이 입력 중...';
  } else if (myTurn) {
    indicator.textContent = '당신 차례예요! 나머지 ' + state.half2.length + '글자를 맞혀보세요.';
  } else if (state.turnPlayerId) {
    indicator.textContent = whPlayerNameById(state.turnPlayerId) + '님 차례를 기다리는 중...';
  } else {
    indicator.textContent = '';
  }
  input.disabled = !myTurn;
  btn.disabled = !myTurn;
}

function renderWordHalfHistory(history) {
  var el = document.getElementById('story-list');
  if (!history || history.length === 0) { el.innerHTML = '<div class="story-empty">아직 완성된 단어가 없어요.</div>'; return; }
  var html = '';
  history.slice().reverse().forEach(function (h) {
    html += '<div class="story-item"><div class="story-author">' + esc(h.author) + '</div><div class="story-text">' + esc(h.full) + '</div></div>';
  });
  el.innerHTML = html;
  el.scrollTop = 0;
}

function submitStory() {
  var input = document.getElementById('st-input');
  var val = input.value.trim();
  var errEl = document.getElementById('st-err');
  if (!val) { errEl.textContent = '나머지 글자를 입력해주세요'; return; }
  DBget(roomKey('wordhalf')).then(function (state) {
    if (!state) return;
    if (myPlayerId && state.turnPlayerId && state.turnPlayerId !== myPlayerId) {
      errEl.textContent = '지금은 당신 차례가 아니에요.';
      renderWordHalfTurn(state);
      return;
    }
    var norm = val.replace(/\s+/g, '');
    if (norm !== state.half2) {
      errEl.textContent = '땡! "' + state.half1 + norm + '"은(는) 정답이 아니에요. 다시 시도해보세요.';
      return;
    }
    errEl.textContent = '';
    state.history = state.history || [];
    state.history.push({ author: me.name, full: state.full, time: Date.now() });
    var nextFull = whPickWord(whRecentlyUsed(state.history));
    var parts = whSplit(nextFull);
    state.full = nextFull;
    state.half1 = parts.half1;
    state.half2 = parts.half2;
    state.turnPlayerId = whNextTurnPlayerId(state.turnPlayerId || myPlayerId);
    state.typingPlayerId = null;
    state.typingTs = 0;
    state.roundId = Date.now();
    DBset(roomKey('wordhalf'), state).then(function () {
      whRoundId = state.roundId;
      input.value = '';
      renderWordHalfHistory(state.history);
      renderWordHalfWord(state);
      renderWordHalfTurn(state);
    });
  });
}

function resetStory() {
  var full = whPickWord(null);
  var parts = whSplit(full);
  var state = { roundId: Date.now(), full: full, half1: parts.half1, half2: parts.half2, history: [], turnPlayerId: whFirstTurnPlayerId(), typingPlayerId: null, typingTs: 0 };
  DBset(roomKey('wordhalf'), state).then(function () {
    whRoundId = state.roundId;
    renderWordHalfHistory(state.history);
    renderWordHalfWord(state);
    renderWordHalfTurn(state);
  });
}
