/* ---------------- Pixel game ---------------- */
var pxRoundId = 0;
var pxItem = null;
var pxSolvedLocal = false;
var pxCategory = null;

var PX_SOLO_BLURS = [24, 18, 13, 8, 4, 0];
var PX_SOLO_SCORES = [100, 80, 60, 40, 20, 10];
var PX_ROUND_LENGTH = 20;
var pxSoloItem = null;
var pxSoloStage = 0;
var pxSoloTotal = 0;
var pxRoundIndex = 0;    // how many questions shown so far this round
var pxRoundPool = [];
var pxAdvanceTimer = null;

function pxInputKeydown(e) {
  if (e.key !== 'Enter') return;
  if (playMode === 'solo' && document.getElementById('px-input').readOnly) {
    if (pxAdvanceTimer) { clearTimeout(pxAdvanceTimer); pxAdvanceTimer = null; }
    pxAdvanceOrFinish();
  } else {
    submitPixelGuess();
  }
}

var PX_VOTE_STOP = null;

function resetPixelToCategorySelect() {
  clearInterval(pollTimer);
  clearInterval(pixelTickTimer);
  pxCategory = null;
  document.getElementById('px-category-select').style.display = '';
  document.getElementById('px-game-area').style.display = 'none';
  if (PX_VOTE_STOP) { PX_VOTE_STOP(); PX_VOTE_STOP = null; }
  if (playMode === 'online') {
    PX_VOTE_STOP = ctStartVoteUI('pixel', 'px-category-select', 'px-vote-hint', function (resolved) {
      PX_VOTE_STOP = null;
      if (!document.getElementById('pixel').classList.contains('active')) return;
      choosePixelCategory(resolved);
    });
  } else {
    document.getElementById('px-vote-hint').style.display = 'none';
  }
}

/* 카테고리 버튼 클릭: 혼자하기는 바로 선택, 온라인은 다수결 투표에 한 표를 던집니다.
   예전에는 온라인에서도 아무나 누르면 그 즉시 카테고리가 바뀌어서, 서로 다른 카테고리를
   동시에 누르면 무엇이 선택된 건지 헷갈리는 문제가 있었습니다. */
function pxCategoryClick(cat) {
  if (playMode !== 'online') { choosePixelCategory(cat); return; }
  ctCastVote('pixel', cat, function (resolved) {
    if (PX_VOTE_STOP) { PX_VOTE_STOP(); PX_VOTE_STOP = null; }
    if (!document.getElementById('pixel').classList.contains('active')) return;
    choosePixelCategory(resolved);
  }, 'px-category-select', 'px-vote-hint');
}

function backToPixelCategories() {
  resetPixelToCategorySelect();
}

function choosePixelCategory(cat) {
  pxCategory = cat;
  document.getElementById('px-category-select').style.display = 'none';
  document.getElementById('px-game-area').style.display = '';
  if (playMode === 'solo') {
    document.getElementById('px-solo-controls').style.display = '';
    document.getElementById('px-leaderboard-box').style.display = 'none';
    document.getElementById('px-next-btn').textContent = '스킵';
    startPixelRound();
  } else {
    document.getElementById('px-solo-controls').style.display = 'none';
    document.getElementById('px-leaderboard-box').style.display = '';
    document.getElementById('px-next-btn').textContent = '새 라운드 시작';
    document.getElementById('px-round-progress').style.display = 'none';
    startPixelOnline();
  }
}

/* solo: a round is PX_ROUND_LENGTH questions, then a score summary, then a fresh random round */
function startPixelRound() {
  document.getElementById('px-play-stage').style.display = '';
  document.getElementById('px-round-summary').style.display = 'none';
  document.getElementById('px-round-progress').style.display = '';
  pxSoloTotal = 0;
  pxRoundIndex = 0;
  pxRoundPool = shuffleArray(PIXEL_CATEGORIES[pxCategory].items);
  pickPixelSoloItem();
}

function pxNextPixelItem() {
  if (pxRoundPool.length === 0) pxRoundPool = shuffleArray(PIXEL_CATEGORIES[pxCategory].items);
  return pxRoundPool.pop();
}

function pxAdvanceOrFinish() {
  if (!document.getElementById('pixel').classList.contains('active') || playMode !== 'solo') return;
  if (pxRoundIndex >= PX_ROUND_LENGTH) {
    document.getElementById('px-play-stage').style.display = 'none';
    document.getElementById('px-round-summary').style.display = '';
    document.getElementById('px-round-final-score').textContent = pxSoloTotal + '점';
  } else {
    pickPixelSoloItem();
  }
}

function skipPixelQuestion() {
  if (playMode !== 'solo') { newPixelRound(); return; }
  if (!pxSoloItem || document.getElementById('px-input').readOnly) return;
  document.getElementById('px-input').readOnly = true;
  document.getElementById('px-reveal-btn').disabled = true;
  var emojiEl = document.getElementById('px-emoji');
  if (emojiEl) emojiEl.style.filter = 'blur(0px)';
  document.getElementById('px-err').textContent = '';
  document.getElementById('px-msg').textContent = '정답: ' + pxSoloItem.answers[0];
  document.getElementById('px-msg').classList.remove('win');
  if (pxAdvanceTimer) clearTimeout(pxAdvanceTimer);
  pxAdvanceTimer = setTimeout(function(){ pxAdvanceTimer = null; pxAdvanceOrFinish(); }, 1000);
}

function nextPixelRound() {
  if (playMode === 'solo') { skipPixelQuestion(); return; }
  if (pxSolvedLocal) newPixelRound();
  else giveUpPixelOnline();
}

/* 온라인에서 "모르겠어요 (정답 보기)"를 눌렀을 때의 동작.
   예전엔 아무나 한 명만 눌러도 그 즉시 방 전체에 정답이 공개되고 라운드가 끝나버려서,
   아직 더 맞혀보고 싶은 다른 사람 입장에선 갑자기 게임이 끝나버리는 느낌이었습니다(수정
   요청이 있었지만 실제로는 그대로 남아있던 문제). 이제는 누르면 "나만" 포기 처리되어
   나에게는 바로 정답이 보이지만(개인 포기), 다른 사람들의 라운드는 그대로 계속됩니다.
   같은 방의 모든 사람이 다 포기하거나(전원 포기 시 자동 공개) 누군가 정답을 맞히면
   그때 비로소 라운드가 끝나고 다같이 정답이 공개됩니다. */
var pxGaveUpLocal = false; // 이번 라운드에서 내가 개인적으로 포기했는지

function giveUpPixelOnline() {
  if (pxGaveUpLocal) return;
  DBget(roomKey('pixel')).then(function (state) {
    if (!state || state.roundId !== pxRoundId) { if (state) applyPixelState(state); return; }
    if (state.solved) { applyPixelState(state); return; }
    pxGaveUpLocal = true;
    state.gaveUpIds = state.gaveUpIds || [];
    if (state.gaveUpIds.indexOf(myPlayerId) === -1) state.gaveUpIds.push(myPlayerId);
    var allGaveUp = (roomPlayersList || []).length > 0 &&
      (roomPlayersList || []).every(function (p) { return state.gaveUpIds.indexOf(p.id) !== -1; });
    if (allGaveUp) { state.solved = true; state.winner = ''; state.gaveUp = true; }
    DBset(roomKey('pixel'), state).then(function () {
      if (state.solved) {
        applyPixelState(state);
        setTimeout(function () {
          if (document.getElementById('pixel').classList.contains('active') && playMode === 'online') newPixelRound();
        }, 1000);
      } else {
        pxShowLocalGiveUp(state);
      }
    });
  });
}

/* 나는 포기했지만 다른 사람은 아직 맞히는 중일 때: 나에게만 정답을 보여주고,
   몇 명이 포기했는지 표시하며 다른 사람을 기다립니다(라운드 자체는 안 끝남). */
function pxShowLocalGiveUp(state) {
  var el = document.getElementById('px-emoji');
  if (el) el.style.filter = 'blur(0px)';
  document.getElementById('px-input').disabled = true;
  document.getElementById('px-err').textContent = '';
  var total = (roomPlayersList || []).length;
  var gaveUpCount = (state.gaveUpIds || []).length;
  document.getElementById('px-msg').textContent = '포기했어요! 정답: ' + pxItem.answers[0] + ' (다른 사람을 기다리는 중... ' + gaveUpCount + '/' + total + '명 포기)';
  document.getElementById('px-msg').classList.remove('win');
  var pxNextBtn = document.getElementById('px-next-btn');
  if (pxNextBtn) { pxNextBtn.disabled = true; pxNextBtn.textContent = '다른 사람을 기다리는 중...'; }
}

function submitPixelGuess() {
  if (playMode === 'solo') submitPixelSoloGuess();
  else submitPixelGuessOnline();
}

/* 가끔 휴대폰/네트워크 상태에 따라 이미지가 한 번에 안 뜨는 경우를 대비해서,
   이미지 로드에 실패하면 자동으로 몇 번 재시도하고, 그래도 안 되면 "다시 불러오기"
   버튼이 있는 화면을 보여줘서 게임이 그냥 빈 화면으로 멈춰있지 않게 합니다. */
function setPixelVisual(item) {
  var box = document.getElementById('px-box');
  if (item.img) {
    box.innerHTML = '<img class="pixel-emoji pixel-img" id="px-emoji" src="' + item.img + '" alt="" data-retry="0" onerror="pxImageLoadError(this)" draggable="false" oncontextmenu="return false" />';
  } else {
    box.innerHTML = '<span class="pixel-emoji" id="px-emoji">' + item.emoji + '</span>';
  }
}

function pxImageLoadError(imgEl) {
  var retry = parseInt(imgEl.getAttribute('data-retry') || '0', 10);
  var src = imgEl.getAttribute('src');
  if (retry < 2) {
    imgEl.setAttribute('data-retry', String(retry + 1));
    setTimeout(function () {
      if (!imgEl.isConnected) return; // 이미 다른 화면으로 넘어갔으면 그만둡니다
      imgEl.removeAttribute('src');
      imgEl.setAttribute('src', src);
    }, 400);
    return;
  }
  var box = document.getElementById('px-box');
  if (!box) return;
  box.innerHTML = '<div class="pixel-img-fallback" id="px-emoji">' +
    '<span>🖼️ 사진을 불러오지 못했어요</span>' +
    '<button type="button" class="btn btn-ghost" onclick="pxRetryImageLoad(this, \'' + src.replace(/'/g, "\\'") + '\')">다시 불러오기</button>' +
    '</div>';
}

function pxRetryImageLoad(btn, src) {
  var box = document.getElementById('px-box');
  if (!box) return;
  box.innerHTML = '<img class="pixel-emoji pixel-img" id="px-emoji" src="' + src + '" alt="" data-retry="0" onerror="pxImageLoadError(this)" draggable="false" oncontextmenu="return false" />';
}

function pickPixelSoloItem() {
  pxRoundIndex++;
  pxSoloItem = pxNextPixelItem();
  pxSoloStage = 0;
  setPixelVisual(pxSoloItem);
  document.getElementById('px-emoji').style.filter = 'blur(' + PX_SOLO_BLURS[0] + 'px)';
  document.getElementById('px-input').value = '';
  document.getElementById('px-input').disabled = false;
  document.getElementById('px-input').readOnly = false;
  document.getElementById('px-err').textContent = '';
  document.getElementById('px-msg').textContent = '';
  document.getElementById('px-msg').classList.remove('win');
  document.getElementById('px-round-progress').textContent = '문제 ' + pxRoundIndex + ' / ' + PX_ROUND_LENGTH;
  updatePxSoloUI();
  document.getElementById('px-input').focus();
}

function updatePxSoloUI() {
  document.getElementById('px-solo-score').textContent = PX_SOLO_SCORES[pxSoloStage] + '점';
  document.getElementById('px-reveal-btn').disabled = pxSoloStage >= PX_SOLO_BLURS.length - 1;
  document.getElementById('px-total-score').textContent = pxSoloTotal + '점';
}

function revealMorePixel() {
  if (pxSoloStage >= PX_SOLO_BLURS.length - 1) return;
  pxSoloStage++;
  document.getElementById('px-emoji').style.filter = 'blur(' + PX_SOLO_BLURS[pxSoloStage] + 'px)';
  updatePxSoloUI();
}

function submitPixelSoloGuess() {
  var val = document.getElementById('px-input').value.trim();
  var errEl = document.getElementById('px-err');
  if (!val) { errEl.textContent = '정답을 입력해주세요'; return; }
  errEl.textContent = '';
  if (document.getElementById('px-input').readOnly) return;
  var isCorrect = pxSoloItem.answers.some(function(a){ return a === val || val.indexOf(a) !== -1; });
  if (!isCorrect) { errEl.textContent = '땡! 다시 시도해보세요'; return; }
  var earned = PX_SOLO_SCORES[pxSoloStage];
  pxSoloTotal += earned;
  document.getElementById('px-emoji').style.filter = 'blur(0px)';
  document.getElementById('px-input').readOnly = true;
  document.getElementById('px-msg').textContent = '정답! ' + earned + '점 획득 (정답: ' + pxSoloItem.answers[0] + ')';
  document.getElementById('px-msg').classList.add('win');
  updatePxSoloUI();
  if (pxAdvanceTimer) clearTimeout(pxAdvanceTimer);
  pxAdvanceTimer = setTimeout(function(){ pxAdvanceTimer = null; pxAdvanceOrFinish(); }, 1400);
}

/* online: time-based blur, first correct guess wins */
function startPixelOnline() {
  DBget(roomKey('pixel')).then(function(state){
    if (state && state.category === pxCategory) {
      applyPixelState(state);
    } else {
      var items = PIXEL_CATEGORIES[pxCategory].items;
      var idx = Math.floor(Math.random() * items.length);
      var newState = { roundId: Date.now(), category: pxCategory, itemIndex: idx, startTime: Date.now(), solved: false, winner: '', leaderboard: (state && state.leaderboard) || {} };
      DBset(roomKey('pixel'), newState).then(function(){ applyPixelState(newState); });
    }
  });
  pixelTickTimer = setInterval(tickPixelBlur, 400);
  /* 예전엔 2.5초마다 한 번씩만 상태를 확인해서, 누군가 포기하거나 정답을 맞혀서 정답이
     공개된 순간과 다음 라운드로 넘어가는 순간 사이(1초)를 못 보고 지나쳐 정답을 아예
     못 보는 사람이 생기는 문제가 있었습니다. 더 자주 확인해서 그런 일이 없게 합니다. */
  pollTimer = setInterval(pollPixel, 700);
}

function applyPixelState(state) {
  if (state.roundId !== pxRoundId) pxGaveUpLocal = false;
  pxRoundId = state.roundId;
  var items = PIXEL_CATEGORIES[state.category].items;
  pxItem = items[state.itemIndex];
  pxSolvedLocal = state.solved;
  setPixelVisual(pxItem);
  document.getElementById('px-input').value = '';
  document.getElementById('px-input').disabled = state.solved;
  document.getElementById('px-err').textContent = '';
  updatePixelBlurFromStart(state.startTime, state.solved);
  if (state.solved) {
    if (state.gaveUp) {
      document.getElementById('px-msg').textContent = '아무도 못 맞혔어요! 정답: ' + pxItem.answers[0];
      document.getElementById('px-msg').classList.remove('win');
    } else {
      document.getElementById('px-msg').textContent = (state.winner === me.name ? '내가' : state.winner) + ' 맞혔어요! 정답: ' + pxItem.answers[0];
      document.getElementById('px-msg').classList.add('win');
    }
  } else {
    document.getElementById('px-msg').textContent = '';
    document.getElementById('px-msg').classList.remove('win');
  }
  var pxNextBtn = document.getElementById('px-next-btn');
  if (pxNextBtn && playMode === 'online') { pxNextBtn.textContent = state.solved ? '새 라운드 시작' : '모르겠어요 (정답 보기)'; pxNextBtn.disabled = false; }
  if (!state.solved) document.getElementById('px-input').focus();
  renderPixelLeaderboard(state.leaderboard || {});
}

function updatePixelBlurFromStart(startTime, solved) {
  var el = document.getElementById('px-emoji');
  if (!el) return;
  if (solved) { el.style.filter = 'blur(0px)'; return; }
  var elapsed = (Date.now() - startTime) / 1000;
  /* 흐림이 풀리는 속도를 아주 조금 늦췄습니다(1.3 -> 1.1, 완전히 선명해지는 시간이
     약 17초에서 약 20초로 늘어남) - 너무 많이 늦추면 게임이 늘어지니 살짝만 조정. */
  var blur = Math.max(0, 22 - elapsed * 1.1);
  el.style.filter = 'blur(' + blur.toFixed(1) + 'px)';
  el.dataset.startTime = startTime;
}

function tickPixelBlur() {
  if (pxSolvedLocal) return;
  var el = document.getElementById('px-emoji');
  if (!el) return;
  var st = el.dataset.startTime;
  if (!st) return;
  updatePixelBlurFromStart(parseFloat(st), false);
}

function pollPixel() {
  DBget(roomKey('pixel')).then(function(state){
    if (!state) return;
    document.getElementById('px-dot').classList.add('live');
    setTimeout(function(){ document.getElementById('px-dot').classList.remove('live'); }, 500);
    if (state.roundId !== pxRoundId) { applyPixelState(state); return; }
    if (state.solved && !pxSolvedLocal) { applyPixelState(state); return; }
    renderPixelLeaderboard(state.leaderboard || {});
    if (pxGaveUpLocal && !state.solved) {
      pxShowLocalGiveUp(state);
    } else if (!pxGaveUpLocal && !state.solved) {
      var gcount = (state.gaveUpIds || []).length;
      var totalP = (roomPlayersList || []).length;
      document.getElementById('px-msg').textContent = gcount > 0 ? ('👋 ' + gcount + '/' + totalP + '명이 포기했어요') : '';
    }
  });
}

function submitPixelGuessOnline() {
  var val = document.getElementById('px-input').value.trim();
  var errEl = document.getElementById('px-err');
  if (!val) { errEl.textContent = '정답을 입력해주세요'; return; }
  errEl.textContent = '';
  if (pxSolvedLocal) return;
  DBget(roomKey('pixel')).then(function(state){
    if (!state || state.roundId !== pxRoundId) return;
    if (state.solved) { applyPixelState(state); return; }
    var isCorrect = pxItem.answers.some(function(a){ return a === val || val.indexOf(a) !== -1; });
    if (!isCorrect) { errEl.textContent = '땡! 다시 시도해보세요'; return; }
    state.solved = true;
    state.winner = me.name;
    state.leaderboard = state.leaderboard || {};
    state.leaderboard[me.name] = (state.leaderboard[me.name] || 0) + 1;
    DBset(roomKey('pixel'), state).then(function(){
      applyPixelState(state);
      setTimeout(function(){
        if (document.getElementById('pixel').classList.contains('active') && playMode === 'online') newPixelRound();
      }, 1000);
    });
  });
}

function renderPixelLeaderboard(lb) {
  renderScoreLeaderboard('px-leaderboard', lb);
}

function newPixelRound() {
  var items = PIXEL_CATEGORIES[pxCategory].items;
  var idx = Math.floor(Math.random() * items.length);
  DBget(roomKey('pixel')).then(function(prev){
    var state = { roundId: Date.now(), category: pxCategory, itemIndex: idx, startTime: Date.now(), solved: false, winner: '', leaderboard: (prev && prev.leaderboard) || {} };
    DBset(roomKey('pixel'), state).then(function(){ applyPixelState(state); });
  });
}

/* 단축키: 'Tab' 키를 누르면 '더 선명하게 보기'와 같은 동작(블러를 한 단계 연하게) */
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Tab') return;
  if (!document.getElementById('pixel').classList.contains('active')) return;
  if (playMode !== 'solo') return;
  var revealBtn = document.getElementById('px-reveal-btn');
  if (!revealBtn || revealBtn.disabled) return;
  var input = document.getElementById('px-input');
  if (input && input.readOnly) return;
  e.preventDefault();
  revealMorePixel();
});


