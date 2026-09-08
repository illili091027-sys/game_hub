/* ---------------- Person (eyes-nose-mouth) guessing game ---------------- */
var PS_STAGE_SCORES = [100, 60];
var psPool = [];        // shuffled remaining person ids for this session
var psCurrent = null;   // current PERSON_DATA item
var psHintUsed = false;
var psTotal = 0;
var psSolved = false;
var psAdvanceTimer = null;
var psWrongStreak = 0;
var psRoundId = 0;
var psItem = null;

var PS_VOTE_STOP = null;

function resetPersonToCategorySelect() {
  clearInterval(pollTimer);
  document.getElementById('ps-category-select').style.display = '';
  document.getElementById('ps-soon').style.display = 'none';
  document.getElementById('ps-idol-game').style.display = 'none';
  if (psAdvanceTimer) { clearTimeout(psAdvanceTimer); psAdvanceTimer = null; }
  if (PS_VOTE_STOP) { PS_VOTE_STOP(); PS_VOTE_STOP = null; }
  if (playMode === 'online') {
    PS_VOTE_STOP = ctStartVoteUI('person', 'ps-category-select', 'ps-vote-hint', function (resolved) {
      PS_VOTE_STOP = null;
      if (!document.getElementById('person').classList.contains('active')) return;
      choosePersonCategory(resolved);
    });
  } else {
    document.getElementById('ps-vote-hint').style.display = 'none';
  }
}

/* 카테고리 버튼 클릭: 혼자하기는 바로 선택, 온라인은 다수결 투표에 한 표를 던집니다. */
function psCategoryClick(cat) {
  if (playMode !== 'online') { choosePersonCategory(cat); return; }
  ctCastVote('person', cat, function (resolved) {
    if (PS_VOTE_STOP) { PS_VOTE_STOP(); PS_VOTE_STOP = null; }
    if (!document.getElementById('person').classList.contains('active')) return;
    choosePersonCategory(resolved);
  }, 'ps-category-select', 'ps-vote-hint');
}

function backToPersonCategory() {
  resetPersonToCategorySelect();
}

var psDataset = PERSON_DATA;

function personDatasetByName(name) { return name === 'actor' ? ACTOR_DATA : PERSON_DATA; }

function choosePersonCategory(cat) {
  document.getElementById('ps-category-select').style.display = 'none';
  if (cat === 'idol' || cat === 'actor') {
    psDataset = cat === 'idol' ? PERSON_DATA : ACTOR_DATA;
    document.getElementById('ps-soon').style.display = 'none';
    document.getElementById('ps-idol-game').style.display = '';
    if (playMode === 'solo') {
      document.getElementById('ps-solo-controls').style.display = '';
      document.getElementById('ps-leaderboard-box').style.display = 'none';
      document.getElementById('ps-next-btn').textContent = '다음 인물';
      startPerson();
    } else {
      document.getElementById('ps-solo-controls').style.display = 'none';
      document.getElementById('ps-leaderboard-box').style.display = '';
      document.getElementById('ps-next-btn').textContent = '새 라운드 시작';
      startPersonOnline();
    }
  } else {
    document.getElementById('ps-idol-game').style.display = 'none';
    document.getElementById('ps-soon').style.display = '';
  }
}

function nextPersonRoundBtn() {
  if (playMode === 'solo') { requestNextPerson(); return; }
  if (psSolved) newPersonRound();
  else giveUpPersonOnline();
}

/* 온라인에서 "모르겠어요 (정답 보기)"를 눌렀을 때: 픽셀 디텍터와 같은 방식으로,
   누르는 즉시 방 전체에 정답이 공개되던 예전 방식 대신, 나만 개인적으로 포기 처리되어
   나에게는 바로 정답이 보이되 다른 사람 라운드는 계속됩니다. 같은 방 전원이 다 포기하거나
   누군가 정답을 맞히면 그때 라운드가 끝나고 다같이 정답이 공개됩니다. */
var psGaveUpLocal = false; // 이번 라운드에서 내가 개인적으로 포기했는지

function giveUpPersonOnline() {
  if (psGaveUpLocal) return;
  DBget(roomKey('person')).then(function (state) {
    if (!state || state.roundId !== psRoundId) { if (state) applyPersonState(state); return; }
    if (state.solved) { applyPersonState(state); return; }
    psGaveUpLocal = true;
    state.gaveUpIds = state.gaveUpIds || [];
    if (state.gaveUpIds.indexOf(myPlayerId) === -1) state.gaveUpIds.push(myPlayerId);
    var allGaveUp = (roomPlayersList || []).length > 0 &&
      (roomPlayersList || []).every(function (p) { return state.gaveUpIds.indexOf(p.id) !== -1; });
    if (allGaveUp) { state.solved = true; state.winner = ''; state.gaveUp = true; }
    DBset(roomKey('person'), state).then(function () {
      if (state.solved) {
        applyPersonState(state);
        setTimeout(function () {
          if (document.getElementById('person').classList.contains('active') && playMode === 'online') newPersonRound();
        }, 1000);
      } else {
        psShowLocalGiveUp(state);
      }
    });
  });
}

/* 나는 포기했지만 다른 사람은 아직 맞히는 중일 때: 나에게만 정답을 보여주고
   몇 명이 포기했는지 표시하며 기다립니다(라운드 자체는 안 끝남). */
function psShowLocalGiveUp(state) {
  document.getElementById('ps-box').style.display = 'none';
  document.getElementById('ps-answer-img').src = psItem.aimg;
  document.getElementById('ps-answer-box').style.display = '';
  var total = (roomPlayersList || []).length;
  var gaveUpCount = (state.gaveUpIds || []).length;
  psShowReveal('포기했어요! 정답: ' + psItem.name + ' (다른 사람을 기다리는 중... ' + gaveUpCount + '/' + total + '명 포기)');
  var psNextBtn = document.getElementById('ps-next-btn');
  if (psNextBtn) { psNextBtn.disabled = true; psNextBtn.textContent = '다른 사람을 기다리는 중...'; }
}

/* ---- 온라인: 같은 문제, 먼저 맞히는 사람 승리 + 누적 점수판 ---- */
function startPersonOnline() {
  var wantDataset = (psDataset === ACTOR_DATA) ? 'actor' : 'idol';
  DBget(roomKey('person')).then(function (state) {
    if (state && state.dataset === wantDataset) {
      applyPersonState(state);
    } else {
      var ids = psDataset.map(function (p) { return p.id; });
      var id = ids[Math.floor(Math.random() * ids.length)];
      var newState = { roundId: Date.now(), dataset: wantDataset, personId: id, solved: false, winner: '', leaderboard: (state && state.leaderboard) || {} };
      DBset(roomKey('person'), newState).then(function () { applyPersonState(newState); });
    }
  });
  /* 픽셀 게임과 같은 이유로 폴링 주기를 짧게 해서, 정답 공개가 뜬 순간을 놓치는 사람이
     없게 합니다. */
  pollTimer = setInterval(pollPerson, 700);
}

function applyPersonState(state) {
  if (state.roundId !== psRoundId) psGaveUpLocal = false;
  psRoundId = state.roundId;
  var dataset = personDatasetByName(state.dataset);
  psItem = dataset.filter(function (p) { return p.id === state.personId; })[0];
  psCurrent = psItem;
  psSolved = state.solved;
  document.getElementById('ps-img').src = psItem.img;
  document.getElementById('ps-img').alt = '인물 눈코입 사진';
  document.getElementById('ps-input').value = '';
  document.getElementById('ps-input').disabled = state.solved;
  document.getElementById('ps-input').readOnly = state.solved;
  document.getElementById('ps-err').textContent = '';
  if (state.solved) {
    document.getElementById('ps-box').style.display = 'none';
    document.getElementById('ps-answer-img').src = psItem.aimg;
    document.getElementById('ps-answer-box').style.display = '';
    if (state.gaveUp) {
      psShowReveal('아무도 못 맞혔어요! 정답: ' + psItem.name);
    } else {
      psShowReveal((state.winner === me.name ? '내가' : (state.winner + '님이')) + ' 맞혔어요! 정답: ' + psItem.name);
    }
  } else {
    document.getElementById('ps-box').style.display = '';
    document.getElementById('ps-answer-box').style.display = 'none';
    psHideReveal();
    document.getElementById('ps-input').focus();
  }
  var psNextBtn = document.getElementById('ps-next-btn');
  if (psNextBtn && playMode === 'online') { psNextBtn.textContent = state.solved ? '새 라운드 시작' : '모르겠어요 (정답 보기)'; psNextBtn.disabled = false; }
  renderPersonLeaderboard(state.leaderboard || {});
}

function pollPerson() {
  DBget(roomKey('person')).then(function (state) {
    if (!state) return;
    if (state.roundId !== psRoundId) { applyPersonState(state); return; }
    if (state.solved && !psSolved) { applyPersonState(state); return; }
    renderPersonLeaderboard(state.leaderboard || {});
    if (psGaveUpLocal && !state.solved) {
      psShowLocalGiveUp(state);
    } else if (!psGaveUpLocal && !state.solved) {
      var gcount = (state.gaveUpIds || []).length;
      var totalP = (roomPlayersList || []).length;
      document.getElementById('ps-msg').textContent = gcount > 0 ? ('👋 ' + gcount + '/' + totalP + '명이 포기했어요') : '';
    }
  });
}

function submitPersonGuessOnline() {
  var input = document.getElementById('ps-input');
  var val = input.value.trim();
  if (!val) { document.getElementById('ps-err').textContent = '정답을 입력해주세요.'; return; }
  if (psSolved) return;
  DBget(roomKey('person')).then(function (state) {
    if (!state || state.roundId !== psRoundId) return;
    if (state.solved) { applyPersonState(state); return; }
    var norm = normalizePersonAnswer(val);
    var correct = psItem.answers.some(function (a) {
      var an = normalizePersonAnswer(a);
      if (an === norm) return true;
      if (an.length >= 3 && an.slice(1) === norm) return true;
      return false;
    });
    if (!correct) {
      psWrongStreak++;
      var errText = '아쉬워요, 다시 한 번 시도해보세요.';
      if (psWrongStreak >= 2) errText += ' (연속 ' + psWrongStreak + '번째 오답!)';
      document.getElementById('ps-err').textContent = errText;
      input.classList.remove('ps-shake');
      void input.offsetWidth;
      input.classList.add('ps-shake');
      return;
    }
    state.solved = true;
    state.winner = me.name;
    state.leaderboard = state.leaderboard || {};
    state.leaderboard[me.name] = (state.leaderboard[me.name] || 0) + 1;
    DBset(roomKey('person'), state).then(function () {
      applyPersonState(state);
      setTimeout(function () {
        if (document.getElementById('person').classList.contains('active') && playMode === 'online') newPersonRound();
      }, 1000);
    });
  });
}

function renderPersonLeaderboard(lb) {
  renderScoreLeaderboard('ps-leaderboard', lb);
}

function newPersonRound() {
  var ids = psDataset.map(function (p) { return p.id; });
  var id = ids[Math.floor(Math.random() * ids.length)];
  DBget(roomKey('person')).then(function (prev) {
    var state = { roundId: Date.now(), dataset: (psDataset === ACTOR_DATA ? 'actor' : 'idol'), personId: id, solved: false, winner: '', leaderboard: (prev && prev.leaderboard) || {} };
    DBset(roomKey('person'), state).then(function () { applyPersonState(state); });
  });
}

function startPerson() {
  psPool = shuffleArray(psDataset.map(function(p){ return p.id; }));
  psTotal = 0;
  document.getElementById('ps-total-score').textContent = '0점';
  nextPersonRound();
}

function personById(id) { return psDataset.filter(function(p){ return p.id === id; })[0]; }

function psShowReveal(name) {
  document.getElementById('ps-solo-controls').style.display = 'none';
  document.getElementById('ps-guess-row').style.display = 'none';
  document.getElementById('ps-err').style.display = 'none';
  document.getElementById('ps-msg').style.display = 'none';
  var nameEl = document.getElementById('ps-answer-name');
  nameEl.textContent = name;
  nameEl.style.display = '';
}

function psHideReveal() {
  document.getElementById('ps-solo-controls').style.display = '';
  document.getElementById('ps-guess-row').style.display = '';
  document.getElementById('ps-err').style.display = '';
  document.getElementById('ps-msg').style.display = '';
  document.getElementById('ps-answer-name').style.display = 'none';
  document.getElementById('ps-answer-name').textContent = '';
}

function nextPersonRound() {
  if (psAdvanceTimer) { clearTimeout(psAdvanceTimer); psAdvanceTimer = null; }
  if (psPool.length === 0) psPool = shuffleArray(psDataset.map(function(p){ return p.id; }));
  var id = psPool.pop();
  psCurrent = personById(id);
  psHintUsed = false;
  psSolved = false;
  document.getElementById('ps-img').src = psCurrent.img;
  document.getElementById('ps-img').alt = '인물 눈코입 사진';
  document.getElementById('ps-box').style.display = '';
  document.getElementById('ps-answer-box').style.display = 'none';
  document.getElementById('ps-answer-img').src = '';
  psHideReveal();
  psWrongStreak = 0;
  document.getElementById('ps-input').classList.remove('ps-shake');
  document.getElementById('ps-input').value = '';
  document.getElementById('ps-input').disabled = false;
  document.getElementById('ps-input').readOnly = false;
  document.getElementById('ps-err').textContent = '';
  document.getElementById('ps-msg').textContent = '';
  document.getElementById('ps-msg').classList.remove('win');
  var hintEl0 = document.getElementById('ps-hint-text');
  if (hintEl0) hintEl0.textContent = '';
  document.getElementById('ps-hint-btn').disabled = false;
  document.getElementById('ps-hint-btn').textContent = '힌트 보기 (점수 낮아짐)';
  document.getElementById('ps-solo-score').textContent = PS_STAGE_SCORES[0] + '점';
  document.getElementById('ps-input').focus();
}

function requestNextPerson() {
  if (psSolved) { nextPersonRound(); return; }
  psSolved = true;
  document.getElementById('ps-input').readOnly = true;
  document.getElementById('ps-hint-btn').disabled = true;
  document.getElementById('ps-box').style.display = 'none';
  document.getElementById('ps-answer-img').src = psCurrent.aimg;
  document.getElementById('ps-answer-box').style.display = '';
  psShowReveal(psCurrent.name);
  psAdvanceTimer = setTimeout(function(){
    psAdvanceTimer = null;
    if (document.getElementById('person').classList.contains('active')) nextPersonRound();
  }, 1200);
}

/* Enter still needs to reach us after a correct guess, so we mark the input
   readOnly (not disabled) when solved - disabled inputs stop firing key events,
   which was why Enter appeared to "do nothing" right after answering correctly. */
function personInputKeydown(e) {
  if (e.key !== 'Enter') return;
  if (playMode === 'solo' && psSolved) {
    if (psAdvanceTimer) { clearTimeout(psAdvanceTimer); psAdvanceTimer = null; }
    nextPersonRound();
  } else {
    submitPersonGuess();
  }
}

/* 힌트 텍스트는 오답 에러 메시지(#ps-err)와 같은 자리를 쓰면 안 됩니다.
   같은 요소를 공유하면 힌트를 본 뒤 오답을 한 번 더 제출했을 때 오답 메시지가 힌트를 덮어써서
   "힌트가 가끔 안 보이는" 것처럼 보이는 버그가 생겼습니다. 힌트 전용 표시줄(#ps-hint-text)로 분리합니다. */
function usePersonHint() {
  if (psSolved) return;
  psHintUsed = true;
  document.getElementById('ps-hint-btn').disabled = true;
  document.getElementById('ps-solo-score').textContent = PS_STAGE_SCORES[1] + '점';
  var hintEl = document.getElementById('ps-hint-text');
  if (hintEl) hintEl.textContent = '힌트: 이름은 "' + psCurrent.name.charAt(0) + '\u2588\u2588" 이렇게 시작해요 (총 ' + psCurrent.name.length + '글자).';
}

function normalizePersonAnswer(s) {
  return s.replace(/\s+/g, '').toLowerCase();
}

function submitPersonGuess() {
  if (playMode !== 'solo') { submitPersonGuessOnline(); return; }
  var input = document.getElementById('ps-input');
  var val = input.value.trim();
  if (!val) { document.getElementById('ps-err').textContent = '정답을 입력해주세요.'; return; }
  if (psSolved) return;
  var norm = normalizePersonAnswer(val);
  var correct = psCurrent.answers.some(function(a){
    var an = normalizePersonAnswer(a);
    if (an === norm) return true;
    // 한국 이름 3글자 이상이면 성을 뺀 이름(예: 이하늬 -> 하늬)도 정답으로 인정
    if (an.length >= 3 && an.slice(1) === norm) return true;
    return false;
  });
  if (correct) {
    psSolved = true;
    var gained = psHintUsed ? PS_STAGE_SCORES[1] : PS_STAGE_SCORES[0];
    psTotal += gained;
    document.getElementById('ps-total-score').textContent = psTotal + '점';
    input.readOnly = true;
    document.getElementById('ps-hint-btn').disabled = true;
    document.getElementById('ps-box').style.display = 'none';
    document.getElementById('ps-answer-img').src = psCurrent.aimg;
    document.getElementById('ps-answer-box').style.display = '';
    psShowReveal(psCurrent.name);
    psAdvanceTimer = setTimeout(function(){
      psAdvanceTimer = null;
      if (document.getElementById('person').classList.contains('active')) nextPersonRound();
    }, 1400);
  } else {
    psWrongStreak++;
    var errText = '아쉬워요, 다시 한 번 시도해보세요.';
    if (psWrongStreak >= 2) errText += ' (연속 ' + psWrongStreak + '번째 오답!)';
    document.getElementById('ps-err').textContent = errText;
    input.classList.remove('ps-shake');
    void input.offsetWidth;
    input.classList.add('ps-shake');
  }
}


