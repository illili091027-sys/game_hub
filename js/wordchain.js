/* ---------------- 끝말잇기 타이머 (2명 이상 온라인 전용) ---------------- */
/* 규칙: 방 안에 2명 이상 있어야 합니다. 참가 순서대로 돌아가며 끝말잇기를 하고,
   각자 제한 시간(15초) 안에 앞 단어의 마지막 글자로 시작하는 새 단어를 입력해야 합니다.
   시간 안에 못 잇거나 이미 나온 단어를 또 쓰면 목숨을 하나 잃고, 목숨이 0이 되면 탈락합니다.
   한 명만 남을 때까지 계속되고, 마지막까지 살아남은 사람이 승리합니다. */
var WC_TIME_LIMIT_MS = 15000;
var WC_LIVES_START = 3;
var WC_POLL_TIMER = null;
var WC_TICK_TIMER = null;
var WC_LAST_STATE = null;
var WC_LAST_CHAIN_LEN = -1;
var WC_LAST_TURN_PID = null; // 자동 포커스를 매번 다시 걸지 않고, 차례가 "새로 나에게 왔을 때"만 걸기 위한 표시

function wcKey() { return roomKey('wordchain'); }

function startWordChain() {
  clearInterval(WC_POLL_TIMER);
  clearInterval(WC_TICK_TIMER);
  WC_LAST_STATE = null;
  WC_LAST_CHAIN_LEN = -1;
  WC_LAST_TURN_PID = null;
  document.getElementById('wc-need-two').style.display = 'none';
  document.getElementById('wc-game-area').style.display = 'none';
  document.getElementById('wc-over-area').style.display = 'none';
  if (!roomPlayersList || roomPlayersList.length < 2) {
    document.getElementById('wc-need-two').style.display = '';
    document.getElementById('wc-player-count').textContent = (roomPlayersList || []).length;
    WC_POLL_TIMER = setInterval(function () {
      if (roomPlayersList && roomPlayersList.length >= 2) { startWordChain(); return; }
      document.getElementById('wc-player-count').textContent = (roomPlayersList || []).length;
    }, 1000);
    return;
  }
  document.getElementById('wc-game-area').style.display = '';
  DBget(wcKey()).then(function (state) {
    if (!state || state.winnerId) {
      wcCreateNewGame();
    } else {
      WC_LAST_STATE = state;
      wcApplyState(state);
    }
  });
  WC_POLL_TIMER = setInterval(wcPoll, 700);
  WC_TICK_TIMER = setInterval(wcTick, 250);
}

function wcCreateNewGame() {
  if (!roomPlayersList || roomPlayersList.length < 2) return;
  var lives = {};
  var eliminated = {};
  roomPlayersList.forEach(function (p) { lives[p.id] = WC_LIVES_START; eliminated[p.id] = false; });
  var state = {
    chain: [],
    turnPlayerId: roomPlayersList[0].id,
    deadline: Date.now() + WC_TIME_LIMIT_MS,
    lives: lives,
    eliminated: eliminated,
    turnSeq: 0,
    winnerId: null
  };
  DBset(wcKey(), state).then(function () { WC_LAST_STATE = state; wcApplyState(state); });
}

function wcRestart() {
  document.getElementById('wc-over-area').style.display = 'none';
  document.getElementById('wc-game-area').style.display = '';
  wcCreateNewGame();
}

function wcPoll() {
  if (!roomPlayersList || roomPlayersList.length < 2) { startWordChain(); return; }
  DBget(wcKey()).then(function (state) {
    if (!state) return;
    WC_LAST_STATE = state;
    wcApplyState(state);
  });
}

function wcAlivePlayers(state) {
  return (roomPlayersList || []).filter(function (p) { return !state.eliminated[p.id]; });
}

function wcNextAlivePlayerId(state, fromId) {
  var order = roomPlayersList || [];
  if (!order.length) return null;
  var idx = order.findIndex(function (p) { return p.id === fromId; });
  if (idx === -1) idx = 0;
  for (var step = 1; step <= order.length; step++) {
    var candidate = order[(idx + step) % order.length];
    if (!state.eliminated[candidate.id]) return candidate.id;
  }
  return fromId;
}

function wcPlayerName(pid) {
  var p = (roomPlayersList || []).find(function (pp) { return pp.id === pid; });
  return p ? p.name : '알 수 없음';
}

function wcApplyState(state) {
  if (!state || !document.getElementById('wordchain').classList.contains('active')) return;
  document.getElementById('wc-need-two').style.display = 'none';
  if (state.winnerId) {
    wcShowOver(state);
    return;
  }
  document.getElementById('wc-game-area').style.display = '';
  document.getElementById('wc-over-area').style.display = 'none';

  if (state.chain.length !== WC_LAST_CHAIN_LEN) {
    WC_LAST_CHAIN_LEN = state.chain.length;
    wcRenderChain(state.chain);
    document.getElementById('wc-err').textContent = '';
    document.getElementById('wc-input').value = '';
  }
  wcRenderLives(state);
  wcRenderTurn(state);
}

function wcRenderChain(chain) {
  var el = document.getElementById('wc-chain-list');
  if (!chain || !chain.length) { el.innerHTML = '<div class="story-empty">아직 아무 단어도 없어요. 첫 단어를 자유롭게 시작해보세요!</div>'; return; }
  var html = chain.slice().reverse().map(function (item) {
    return '<div class="story-item"><div class="story-author">' + esc(item.author) + '</div><div class="story-text">' + esc(item.word) + '</div></div>';
  }).join('');
  el.innerHTML = html;
}

function wcRenderLives(state) {
  var panel = document.getElementById('wc-lives-panel');
  var html = (roomPlayersList || []).map(function (p) {
    var isMe = p.id === myPlayerId;
    var isOut = state.eliminated[p.id];
    var hearts = isOut ? '탈락' : '❤️'.repeat(state.lives[p.id]) + '🖤'.repeat(Math.max(0, WC_LIVES_START - state.lives[p.id]));
    return '<div class="wc-life-row' + (isOut ? ' wc-life-out' : '') + '"><span>' + esc(p.name) + (isMe ? ' (나)' : '') + '</span><span>' + hearts + '</span></div>';
  }).join('');
  panel.innerHTML = html;
}

function wcRenderTurn(state) {
  var myTurn = myPlayerId === state.turnPlayerId;
  var iAmEliminated = !!state.eliminated[myPlayerId];
  var indicator = document.getElementById('wc-turn-indicator');
  if (iAmEliminated) {
    indicator.textContent = '탈락했어요. 결과를 지켜봐 주세요!';
  } else if (myTurn) {
    indicator.textContent = state.chain.length === 0
      ? '당신 차례! 아무 단어로나 시작해보세요.'
      : '당신 차례! "' + wcLastChar(state.chain[state.chain.length - 1].word) + '"로 시작하는 단어를 입력하세요.';
  } else {
    indicator.textContent = wcPlayerName(state.turnPlayerId) + '님 차례를 기다리는 중...';
  }
  var input = document.getElementById('wc-input');
  var btn = document.getElementById('wc-submit-btn');
  input.disabled = !myTurn || iAmEliminated;
  btn.disabled = !myTurn || iAmEliminated;
  /* 상대 차례가 끝나고 내 차례로 막 바뀐 순간에만 입력창에 자동으로 커서를 놓아줘서,
     칸을 따로 클릭하지 않아도 바로 타자를 칠 수 있게 합니다. */
  if (myTurn && !iAmEliminated && WC_LAST_TURN_PID !== state.turnPlayerId) {
    input.focus();
  }
  WC_LAST_TURN_PID = state.turnPlayerId;
}

function wcLastChar(word) { return word.charAt(word.length - 1); }

function wcTick() {
  if (!WC_LAST_STATE || WC_LAST_STATE.winnerId) return;
  var remainingMs = WC_LAST_STATE.deadline - Date.now();
  var remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  var timerEl = document.getElementById('wc-timer');
  if (timerEl) {
    timerEl.textContent = String(remainingSec);
    timerEl.classList.toggle('wc-timer-low', remainingSec <= 5);
  }
  /* 시간이 다 됐을 때 페널티 처리는, 그 차례인 사람의 화면에서만 실행합니다.
     (다른 사람 화면에서도 각자 처리하면 여러 명이 동시에 같은 페널티를 두 번 적용할 위험이 있어서,
     "지금 내 차례가 시간 초과됐다"는 판단은 당사자 화면 하나만 하도록 했습니다.) */
  if (remainingMs <= 0 && myPlayerId === WC_LAST_STATE.turnPlayerId && !WC_LAST_STATE.eliminated[myPlayerId]) {
    wcApplyTimeout(WC_LAST_STATE.turnSeq);
  }
}

function wcApplyTimeout(expectedSeq) {
  DBget(wcKey()).then(function (state) {
    if (!state || state.winnerId || state.turnSeq !== expectedSeq || state.turnPlayerId !== myPlayerId) { WC_LAST_STATE = state; return; }
    wcPenalizeCurrentPlayer(state);
  });
}

function wcPenalizeCurrentPlayer(state) {
  var pid = state.turnPlayerId;
  state.lives[pid] = Math.max(0, (state.lives[pid] || 0) - 1);
  if (state.lives[pid] <= 0) state.eliminated[pid] = true;
  wcAdvanceOrFinish(state);
}

function wcAdvanceOrFinish(state) {
  var alive = wcAlivePlayers(state);
  if (alive.length <= 1) {
    state.winnerId = alive.length === 1 ? alive[0].id : null;
  } else {
    state.turnPlayerId = wcNextAlivePlayerId(state, state.turnPlayerId);
    state.deadline = Date.now() + WC_TIME_LIMIT_MS;
    state.turnSeq = (state.turnSeq || 0) + 1;
  }
  DBset(wcKey(), state).then(function () { WC_LAST_STATE = state; wcApplyState(state); });
}

function wcSubmit() {
  var input = document.getElementById('wc-input');
  var errEl = document.getElementById('wc-err');
  var raw = input.value.trim();
  errEl.textContent = '';
  if (!raw) { errEl.textContent = '단어를 입력해주세요.'; return; }
  if (!/^[가-힣]{2,}$/.test(raw)) { errEl.textContent = '한글 2글자 이상의 단어만 가능해요.'; return; }
  /* 예전에는 사전에 없는(지어낸) 단어도 그냥 통과됐는데, 이제는 실제로 등록된 단어인지 확인합니다. */
  if (typeof isValidWordchainWord === 'function' && !isValidWordchainWord(raw)) {
    errEl.textContent = '사전에 없는 단어예요. 다른 단어를 입력해보세요.';
    return;
  }

  DBget(wcKey()).then(function (state) {
    if (!state || state.winnerId) { return; }
    if (state.turnPlayerId !== myPlayerId) { errEl.textContent = '지금은 당신 차례가 아니에요.'; wcApplyState(state); return; }
    if (state.chain.length > 0) {
      var lastWord = state.chain[state.chain.length - 1].word;
      if (wcLastChar(lastWord) !== raw.charAt(0)) {
        errEl.textContent = '"' + lastWord + '"의 마지막 글자 "' + wcLastChar(lastWord) + '"로 시작해야 해요.';
        return;
      }
    }
    var alreadyUsed = state.chain.some(function (item) { return item.word === raw; });
    if (alreadyUsed) { errEl.textContent = '이미 나온 단어예요. 다른 단어를 입력해보세요.'; return; }

    state.chain.push({ word: raw, author: me.name });
    wcAdvanceOrFinish(state);
  });
}

function wcShowOver(state) {
  document.getElementById('wc-game-area').style.display = 'none';
  document.getElementById('wc-over-area').style.display = '';
  var iWon = state.winnerId === myPlayerId;
  document.getElementById('wc-over-msg').textContent = state.winnerId
    ? (iWon ? '🎉 승리! 끝까지 살아남았어요!' : '😢 ' + wcPlayerName(state.winnerId) + '님이 끝까지 살아남았어요.')
    : '게임 종료!';
}

function stopWordChain() {
  clearInterval(WC_POLL_TIMER);
  clearInterval(WC_TICK_TIMER);
  WC_LAST_STATE = null;
}
