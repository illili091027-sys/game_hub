/* ---------------- 거짓말 탐지 (2명 이상 온라인 전용, Two Truths and a Lie) ---------------- */
/* 흐름: (1) 제출 단계 - 모두가 진짜 2개 + 거짓말 1개를 적어서 제출.
   (2) 투표 단계 - 한 사람씩 돌아가며 그 사람이 적은 3개 문장을 뒤섞어서 보여주고,
       본인을 뺀 나머지가 어떤 게 거짓말인지 투표(15초 제한, 시간 초과시 자동으로 무작위 투표됨).
       전원이 투표하면 정답 공개.
   (3) 모든 사람이 끝나면 최종 결과 - 점수가 가장 높은 사람이 "탐정왕".
   점수 규칙(2단계 개선): 거짓말을 맞힌 사람은 +1점을 받고, 반대로 이야기를 낸 사람(주인공)도
   자신을 속이는 데 성공한(못 맞힌) 사람 수만큼 점수를 받습니다 - 예전엔 이야기를 낸 사람은
   그냥 기다리기만 하고 아무 보상이 없어서 재미가 없었는데, 이제는 "얼마나 그럴싸한 거짓말을
   쓰느냐"도 승부의 일부가 됩니다. 또한 투표에 15초 제한시간을 둬서 너무 오래 고민하지 않고
   긴장감 있게 진행되도록 했습니다(시간이 다 되면 자동으로 무작위 문장에 투표됨). */
var LIE_POLL_TIMER = null;
var LIE_COUNTDOWN_TIMER = null;
var LIE_LAST_STATE = null;
var LIE_SCHEDULED_ADVANCE_FOR = null; // 중복으로 자동 진행 타이머를 걸지 않기 위한 표시
var LIE_VOTE_TIME_MS = 15000;
var LIE_AUTO_VOTE_PENDING = false; // 자동투표 요청이 이미 진행 중일 때 중복 요청 방지

function lieKey() { return roomKey('lie'); }

function startLieGame() {
  clearInterval(LIE_POLL_TIMER);
  clearInterval(LIE_COUNTDOWN_TIMER);
  LIE_LAST_STATE = null;
  LIE_SCHEDULED_ADVANCE_FOR = null;
  LIE_AUTO_VOTE_PENDING = false;
  document.getElementById('lie-need-two').style.display = 'none';
  ['lie-submit-area', 'lie-wait-submit-area', 'lie-vote-area', 'lie-reveal-area', 'lie-final-area'].forEach(function (id) {
    document.getElementById(id).style.display = 'none';
  });
  if (!roomPlayersList || roomPlayersList.length < 2) {
    document.getElementById('lie-need-two').style.display = '';
    document.getElementById('lie-player-count').textContent = (roomPlayersList || []).length;
    LIE_POLL_TIMER = setInterval(function () {
      if (roomPlayersList && roomPlayersList.length >= 2) { startLieGame(); return; }
      document.getElementById('lie-player-count').textContent = (roomPlayersList || []).length;
    }, 1000);
    return;
  }
  DBget(lieKey()).then(function (state) {
    if (!state) { lieCreateNewGame(); }
    else { LIE_LAST_STATE = state; lieApplyState(state); }
  });
  LIE_POLL_TIMER = setInterval(liePoll, 800);
  LIE_COUNTDOWN_TIMER = setInterval(lieTickCountdown, 400);
}

function lieCreateNewGame() {
  if (!roomPlayersList || roomPlayersList.length < 2) return;
  var scores = {};
  roomPlayersList.forEach(function (p) { scores[p.id] = 0; });
  var state = {
    phase: 'submit',
    submissions: {},
    subjectOrder: shuffleArray(roomPlayersList.map(function (p) { return p.id; })),
    currentSubjectIdx: 0,
    votes: {},
    scores: scores
  };
  DBset(lieKey(), state).then(function () { LIE_LAST_STATE = state; lieApplyState(state); });
}

function lieRestart() { lieCreateNewGame(); }

function liePoll() {
  if (!roomPlayersList || roomPlayersList.length < 2) { startLieGame(); return; }
  DBget(lieKey()).then(function (state) {
    if (!state) return;
    LIE_LAST_STATE = state;
    lieApplyState(state);
  });
}

function liePlayerName(pid) {
  var p = (roomPlayersList || []).find(function (pp) { return pp.id === pid; });
  return p ? p.name : '알 수 없음';
}

function lieApplyState(state) {
  if (!state || !document.getElementById('lie').classList.contains('active')) return;
  document.getElementById('lie-need-two').style.display = 'none';
  ['lie-submit-area', 'lie-wait-submit-area', 'lie-vote-area', 'lie-reveal-area', 'lie-final-area'].forEach(function (id) {
    document.getElementById(id).style.display = 'none';
  });

  if (state.phase === 'submit') {
    lieRenderSubmitPhase(state);
  } else if (state.phase === 'vote') {
    LIE_SCHEDULED_ADVANCE_FOR = null;
    lieRenderVotePhase(state);
    lieCheckVoteTimeout(state);
  } else if (state.phase === 'reveal') {
    lieRenderRevealPhase(state);
  } else if (state.phase === 'final') {
    lieRenderFinalPhase(state);
  }
}

/* ---- 제출 단계 ---- */
function lieRenderSubmitPhase(state) {
  var mySubmitted = !!(state.submissions && state.submissions[myPlayerId]);
  if (mySubmitted) {
    document.getElementById('lie-wait-submit-area').style.display = '';
    var total = (roomPlayersList || []).length;
    var done = Object.keys(state.submissions || {}).length;
    document.getElementById('lie-wait-submit-msg').textContent = '제출 완료! 다른 사람들을 기다리는 중... (' + done + '/' + total + '명 제출)';
  } else {
    document.getElementById('lie-submit-area').style.display = '';
  }
}

function lieSubmitStatements() {
  var errEl = document.getElementById('lie-submit-err');
  errEl.textContent = '';
  var statements = [0, 1, 2].map(function (i) { return document.getElementById('lie-stmt-' + i).value.trim(); });
  if (statements.some(function (s) { return !s; })) { errEl.textContent = '3개 문장을 모두 입력해주세요.'; return; }
  var picked = document.querySelector('input[name="lie-pick"]:checked');
  if (!picked) { errEl.textContent = '어떤 문장이 거짓말인지 선택해주세요.'; return; }
  var lieIndex = parseInt(picked.value, 10);

  DBget(lieKey()).then(function (state) {
    if (!state || state.phase !== 'submit') { LIE_LAST_STATE = state; if (state) lieApplyState(state); return; }
    state.submissions = state.submissions || {};
    state.submissions[myPlayerId] = {
      statements: statements,
      lieIndex: lieIndex,
      shuffledOrder: shuffleArray([0, 1, 2])
    };
    var allSubmitted = (roomPlayersList || []).every(function (p) { return !!state.submissions[p.id]; });
    if (allSubmitted) {
      state.phase = 'vote';
      state.currentSubjectIdx = 0;
      state.voteDeadline = Date.now() + LIE_VOTE_TIME_MS;
    }
    DBset(lieKey(), state).then(function () { LIE_LAST_STATE = state; lieApplyState(state); });
  });
}

/* ---- 투표 단계 ---- */
function lieCurrentSubjectId(state) { return state.subjectOrder[state.currentSubjectIdx]; }

function lieRenderVotePhase(state) {
  var subjectId = lieCurrentSubjectId(state);
  var sub = state.submissions[subjectId];
  if (!sub) return; // 방어적으로: 제출 정보가 없으면 아무것도 안 함
  var isSubject = subjectId === myPlayerId;
  var votesForSubject = (state.votes && state.votes[subjectId]) || {};
  var others = (roomPlayersList || []).filter(function (p) { return p.id !== subjectId; });
  var votedCount = Object.keys(votesForSubject).length;

  document.getElementById('lie-subject-name').textContent = liePlayerName(subjectId) + (isSubject ? ' (나)' : '') + '님의 이야기';

  if (isSubject) {
    document.getElementById('lie-wait-submit-area').style.display = '';
    document.getElementById('lie-wait-submit-msg').textContent = '당신 차례예요! 다른 사람들이 어떤 게 거짓말인지 투표하는 중... (' + votedCount + '/' + others.length + '명 투표) - 다들 속으면 속인 사람 수만큼 점수를 받아요!';
    return;
  }

  document.getElementById('lie-vote-area').style.display = '';
  var myVoted = Object.prototype.hasOwnProperty.call(votesForSubject, myPlayerId);
  var hintEl = document.getElementById('lie-vote-hint');
  hintEl.textContent = myVoted
    ? '투표 완료! 다른 사람들을 기다리는 중... (' + votedCount + '/' + others.length + '명 투표)'
    : '어떤 문장이 거짓말일까요? 하나를 골라보세요.';

  var displayOrder = sub.shuffledOrder;
  var container = document.getElementById('lie-statements');
  container.innerHTML = displayOrder.map(function (origIdx, displayIdx) {
    var isMyPick = myVoted && votesForSubject[myPlayerId] === displayIdx;
    return '<button class="lie-stmt-btn' + (isMyPick ? ' picked' : '') + '" ' +
      (myVoted ? 'disabled' : 'onclick="lieCastVote(' + displayIdx + ')"') + '>' +
      esc(sub.statements[origIdx]) + '</button>';
  }).join('');
}

function lieCastVote(displayIdx) {
  DBget(lieKey()).then(function (state) {
    if (!state || state.phase !== 'vote') { LIE_LAST_STATE = state; if (state) lieApplyState(state); return; }
    var subjectId = lieCurrentSubjectId(state);
    if (subjectId === myPlayerId) return;
    state.votes = state.votes || {};
    state.votes[subjectId] = state.votes[subjectId] || {};
    if (Object.prototype.hasOwnProperty.call(state.votes[subjectId], myPlayerId)) return;
    state.votes[subjectId][myPlayerId] = displayIdx;

    var sub = state.submissions[subjectId];
    var others = (roomPlayersList || []).filter(function (p) { return p.id !== subjectId; });
    var allVoted = others.every(function (p) { return Object.prototype.hasOwnProperty.call(state.votes[subjectId], p.id); });
    if (allVoted) {
      /* 정답(거짓말)의 화면 표시 위치를 찾아서, 그 위치를 고른 사람들에게 점수를 줍니다.
         반대로 못 맞히고 속은 사람 수만큼은, 그럴싸한 거짓말을 써낸 주인공(subject)에게
         점수를 줍니다 - 이야기를 낸 사람도 이 라운드에서 얻을 게 있어야 재미있어집니다. */
      var lieDisplayIdx = sub.shuffledOrder.indexOf(sub.lieIndex);
      var foolCount = 0;
      others.forEach(function (p) {
        if (state.votes[subjectId][p.id] === lieDisplayIdx) {
          state.scores[p.id] = (state.scores[p.id] || 0) + 1;
        } else {
          foolCount++;
        }
      });
      if (foolCount > 0) state.scores[subjectId] = (state.scores[subjectId] || 0) + foolCount;
      state.phase = 'reveal';
    }
    DBset(lieKey(), state).then(function () { LIE_LAST_STATE = state; lieApplyState(state); });
  });
}

/* 투표 제한시간(15초)이 지났는데 아직 투표를 안 한 사람은, 무작위 문장에 자동으로 투표됩니다.
   (여러 사람 화면에서 동시에 시간 초과를 감지해도, lieCastVote 안에서 이미 투표했는지
   다시 한 번 확인하기 때문에 중복 투표가 되지는 않습니다.) */
function lieCheckVoteTimeout(state) {
  if (!state || state.phase !== 'vote' || LIE_AUTO_VOTE_PENDING) return;
  var subjectId = lieCurrentSubjectId(state);
  if (subjectId === myPlayerId) return;
  var votesForSubject = (state.votes && state.votes[subjectId]) || {};
  if (Object.prototype.hasOwnProperty.call(votesForSubject, myPlayerId)) return;
  if (!state.voteDeadline || Date.now() < state.voteDeadline) return;
  LIE_AUTO_VOTE_PENDING = true;
  lieCastVote(Math.floor(Math.random() * 3));
  setTimeout(function () { LIE_AUTO_VOTE_PENDING = false; }, 500);
}

function lieTickCountdown() {
  var timerEl = document.getElementById('lie-vote-timer');
  if (!timerEl) return;
  if (!LIE_LAST_STATE || LIE_LAST_STATE.phase !== 'vote' || !LIE_LAST_STATE.voteDeadline) {
    timerEl.textContent = '';
    return;
  }
  var subjectId = lieCurrentSubjectId(LIE_LAST_STATE);
  if (subjectId === myPlayerId) { timerEl.textContent = ''; return; }
  var votesForSubject = (LIE_LAST_STATE.votes && LIE_LAST_STATE.votes[subjectId]) || {};
  if (Object.prototype.hasOwnProperty.call(votesForSubject, myPlayerId)) { timerEl.textContent = ''; return; }
  var remain = Math.max(0, Math.ceil((LIE_LAST_STATE.voteDeadline - Date.now()) / 1000));
  timerEl.textContent = '⏱ ' + remain + '초';
  timerEl.classList.toggle('urgent', remain <= 5);
}

/* ---- 공개 단계 ---- */
function lieRenderRevealPhase(state) {
  var subjectId = lieCurrentSubjectId(state);
  var sub = state.submissions[subjectId];
  var votesForSubject = (state.votes && state.votes[subjectId]) || {};
  var lieDisplayIdx = sub.shuffledOrder.indexOf(sub.lieIndex);
  var others = (roomPlayersList || []).filter(function (p) { return p.id !== subjectId; });
  var correctGuessers = others.filter(function (p) { return votesForSubject[p.id] === lieDisplayIdx; }).map(function (p) { return p.name; });

  document.getElementById('lie-reveal-area').style.display = '';
  document.getElementById('lie-reveal-subject').textContent = liePlayerName(subjectId) + '님의 거짓말은...';
  document.getElementById('lie-reveal-answer').textContent = '🤥 "' + sub.statements[sub.lieIndex] + '"';
  document.getElementById('lie-reveal-note').textContent = correctGuessers.length
    ? '정답을 맞힌 사람: ' + correctGuessers.join(', ')
    : '아무도 못 맞혔어요!';

  var isLastSubject = state.currentSubjectIdx + 1 >= state.subjectOrder.length;
  if (LIE_SCHEDULED_ADVANCE_FOR !== subjectId) {
    LIE_SCHEDULED_ADVANCE_FOR = subjectId;
    setTimeout(function () { lieAdvanceSubject(subjectId, isLastSubject); }, 3500);
  }
}

/* phase가 여전히 'reveal'이고 같은 subject일 때만 다음으로 넘깁니다.
   여러 명의 화면이 동시에 이 타이머를 걸어도, 가장 먼저 쓰는 한 번만 반영되고
   나머지는 phase가 이미 바뀐 걸 보고 그냥 멈춥니다. */
function lieAdvanceSubject(expectedSubjectId, wasLast) {
  DBget(lieKey()).then(function (state) {
    if (!state || state.phase !== 'reveal' || lieCurrentSubjectId(state) !== expectedSubjectId) {
      LIE_LAST_STATE = state; if (state) lieApplyState(state);
      return;
    }
    if (wasLast) {
      state.phase = 'final';
    } else {
      state.currentSubjectIdx++;
      state.phase = 'vote';
      state.voteDeadline = Date.now() + LIE_VOTE_TIME_MS;
    }
    DBset(lieKey(), state).then(function () { LIE_LAST_STATE = state; lieApplyState(state); });
  });
}

/* ---- 최종 결과 ---- */
function lieRenderFinalPhase(state) {
  document.getElementById('lie-final-area').style.display = '';
  var entries = (roomPlayersList || []).map(function (p) {
    return { name: p.name, isMe: p.id === myPlayerId, label: (state.scores[p.id] || 0) + '점', sortKey: -(state.scores[p.id] || 0) };
  });
  entries.sort(function (a, b) { return a.sortKey - b.sortKey; });
  renderRankBoard('lie-final-board', entries);
}

function stopLieGame() {
  clearInterval(LIE_POLL_TIMER);
  clearInterval(LIE_COUNTDOWN_TIMER);
  LIE_LAST_STATE = null;
  LIE_SCHEDULED_ADVANCE_FOR = null;
  LIE_AUTO_VOTE_PENDING = false;
}
