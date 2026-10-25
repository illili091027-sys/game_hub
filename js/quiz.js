
var QUIZ_ROUND_SIZE = 20;
var QZ_TIME_LIMIT = 5;
var QZ_EVENT_CHANCE = 0.45;
var QZ_ROUND = [];
var QZ_INDEX = 0;
var QZ_SCORE = 0;
var QZ_COMBO = 0;
var QZ_BEST_COMBO = 0;
var QZ_BEST_SCORE = 0;
var QZ_CURRENT_CHOICES = [];
var QZ_CURRENT_EVENT = null;
var QZ_TIMER_INTERVAL = null;
var QZ_ADVANCE_TIMER = null;
var QZ_ANSWERED = false;
var QZ_ROUND_ID = 0;
var QZ_ONLINE_ANSWERED = false;
var QZ_ADV_SCHEDULED_FOR = -1;
var QZ_LOCKED_INDEX = -1; // 온라인에서 이 번호의 문제는 이미 오답을 내서 나는 더 이상 시도할 수 없음

function qzLoadBest() {
  try {
    var v = parseInt(localStorage.getItem('gamehub_qz_best') || '0', 10);
    QZ_BEST_SCORE = isNaN(v) ? 0 : v;
  } catch (e) { QZ_BEST_SCORE = 0; }
}
function qzSaveBest() {
  try { localStorage.setItem('gamehub_qz_best', String(QZ_BEST_SCORE)); } catch (e) {}
}

function startQuiz() {
  qzLoadBest();
  document.getElementById('qz-best-intro').textContent = QZ_BEST_SCORE + '점';
  document.getElementById('qz-intro').style.display = '';
  document.getElementById('qz-game-area').style.display = 'none';
  document.getElementById('qz-over-area').style.display = 'none';
  document.getElementById('qz-score-stat').style.display = playMode === 'solo' ? '' : 'none';
  document.getElementById('qz-combo-stat').style.display = playMode === 'solo' ? '' : 'none';
  document.getElementById('qz-leaderboard-box').style.display = playMode === 'solo' ? 'none' : '';
  if (playMode === 'online') qzShowIntroLeaderboard();
}

function qzBeginGame() {
  if (playMode !== 'solo') { qzBeginGameOnline(); return; }
  clearInterval(QZ_TIMER_INTERVAL);
  clearTimeout(QZ_ADVANCE_TIMER);
  QZ_ROUND = shuffleArray(QUIZ_BANK).slice(0, QUIZ_ROUND_SIZE);
  QZ_INDEX = 0;
  QZ_SCORE = 0;
  QZ_COMBO = 0;
  QZ_BEST_COMBO = 0;
  document.getElementById('qz-intro').style.display = 'none';
  document.getElementById('qz-over-area').style.display = 'none';
  document.getElementById('qz-game-area').style.display = '';
  qzShowQuestion();
}

/* ---- 온라인: 같은 문제, 먼저 맞히는 사람이 그 문제를 획득 ---- */
function qzShowIntroLeaderboard() {
  DBget(roomKey('quiz')).then(function (state) {
    if (state && state.questions) renderQuizLeaderboard(state.leaderboard || {});
  });
}

function qzBeginGameOnline() {
  clearInterval(QZ_TIMER_INTERVAL);
  clearTimeout(QZ_ADVANCE_TIMER);
  QZ_ADV_SCHEDULED_FOR = -1;
  document.getElementById('qz-intro').style.display = 'none';
  document.getElementById('qz-over-area').style.display = 'none';
  document.getElementById('qz-game-area').style.display = '';
  DBget(roomKey('quiz')).then(function (prev) {
    if (prev && prev.questions && prev.index < prev.questions.length) {
      /* 이미 진행 중인 라운드가 있으면 그 라운드에 합류 (덮어쓰지 않음) */
      applyQuizState(prev);
    } else {
      var questions = shuffleArray(QUIZ_BANK).slice(0, QUIZ_ROUND_SIZE);
      var newState = { roundId: Date.now(), questions: questions, index: 0, answered: false, winner: '', qStart: Date.now(), leaderboard: (prev && prev.leaderboard) || {} };
      DBset(roomKey('quiz'), newState).then(function () { applyQuizState(newState); });
    }
  });
  pollTimer = setInterval(pollQuiz, 1500);
}

function pollQuiz() {
  DBget(roomKey('quiz')).then(function (state) {
    if (!state || !state.questions) return;
    if (state.roundId !== QZ_ROUND_ID || state.index !== QZ_INDEX || state.answered !== QZ_ONLINE_ANSWERED) {
      applyQuizState(state);
    } else {
      renderQuizLeaderboard(state.leaderboard || {});
    }
    if (!state.answered && state.index < state.questions.length) qzCheckAllWrong(state);
  });
}

/* 모두가 틀렸거나(각자 roomKey('quiz_w_'+id)에 "이 문제 틀림" 표시) 30초가 지나면, 아무도 못 맞힌
   상태로 정답을 공개하고 다음 문제로 넘어갑니다. (예전엔 다 틀리면 그 문제에서 영원히 멈춰있었음) */
var QZ_QUESTION_LIMIT_MS = 30000;
function qzWrongKey(pid) { return roomKey('quiz_w_' + pid); }
function qzCheckAllWrong(state) {
  var list = roomPlayersList || [];
  var timedOut = state.qStart && Date.now() - state.qStart > QZ_QUESTION_LIMIT_MS;
  Promise.all(list.map(function (p) { return DBget(qzWrongKey(p.id)); })).then(function (marks) {
    var allWrong = list.length > 0 && marks.every(function (m) { return m && m.roundId === state.roundId && m.index === state.index; });
    if (!allWrong && !timedOut) return;
    DBget(roomKey('quiz')).then(function (cur) {
      if (!cur || cur.roundId !== state.roundId || cur.index !== state.index || cur.answered) return;
      cur.answered = true;
      cur.winner = '';
      cur.nobody = allWrong ? 'allwrong' : 'timeout';
      DBset(roomKey('quiz'), cur).then(function () { applyQuizState(cur); });
    });
  });
}

function applyQuizState(state) {
  if (state.index !== QZ_INDEX) QZ_LOCKED_INDEX = -1;
  QZ_ROUND_ID = state.roundId;
  QZ_ROUND = state.questions;
  QZ_INDEX = state.index;
  QZ_ONLINE_ANSWERED = state.answered;
  document.getElementById('qz-cd-bar').style.display = 'none';
  var banner = document.getElementById('qz-event-banner');
  banner.className = 'qz-event-banner';
  banner.textContent = '';
  if (QZ_INDEX >= QZ_ROUND.length) {
    qzGameOverOnline(state);
    return;
  }
  var q = QZ_ROUND[QZ_INDEX];
  document.getElementById('qz-qidx-val').textContent = (QZ_INDEX + 1) + '/' + QZ_ROUND.length;
  document.getElementById('qz-question').textContent = q.q;
  if (state.answered) {
    if (state.winner) {
      document.getElementById('qz-msg').textContent = (state.winner === me.name ? '내가 먼저' : (state.winner + '님이 먼저')) + ' 맞혔어요! 정답: ' + q.a;
      document.getElementById('qz-msg').className = 'sd-msg win';
    } else {
      document.getElementById('qz-msg').textContent = (state.nobody === 'timeout' ? '⏰ 시간 초과! ' : '😵 아무도 못 맞혔어요! ') + '정답: ' + q.a + ' · 다음 문제로 넘어가요';
      document.getElementById('qz-msg').className = 'sd-msg over';
    }
    document.querySelectorAll('#qz-choices .cat-btn').forEach(function (btn) {
      btn.onclick = null;
      if (btn.textContent === q.a) btn.classList.add('qz-correct');
      else btn.classList.add('qz-disabled');
    });
    if (QZ_ADV_SCHEDULED_FOR !== state.index) {
      QZ_ADV_SCHEDULED_FOR = state.index;
      qzScheduleAdvance(state.index);
    }
  } else {
    QZ_ADV_SCHEDULED_FOR = -1;
    document.getElementById('qz-msg').textContent = '';
    document.getElementById('qz-msg').className = 'sd-msg';
    QZ_CURRENT_CHOICES = shuffleArray(q.c);
    qzRenderChoicesOnline(q);
  }
  renderQuizLeaderboard(state.leaderboard || {});
}

function qzRenderChoicesOnline(q) {
  var wrap = document.getElementById('qz-choices');
  wrap.innerHTML = '';
  QZ_CURRENT_CHOICES.forEach(function (choiceText) {
    var btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.textContent = choiceText;
    btn.onclick = function () { qzAnswerOnline(choiceText); };
    wrap.appendChild(btn);
  });
}

function qzAnswerOnline(choiceText) {
  if (QZ_ONLINE_ANSWERED) return;
  /* 예전엔 오답을 내도 버튼이 그대로 남아있어서 하나씩 다 눌러보면 결국 정답을 맞히는
     식으로 사실상 여러 번 시도할 수 있었습니다. 이제는 한 번 틀리면 이 문제에서는
     (나만) 더 이상 시도할 수 없고, 다른 사람이 맞히거나 시간이 지나야 다음 문제로 넘어갑니다. */
  if (QZ_LOCKED_INDEX === QZ_INDEX) return;
  DBget(roomKey('quiz')).then(function (state) {
    if (!state || !state.questions || state.roundId !== QZ_ROUND_ID || state.index !== QZ_INDEX) { if (state) applyQuizState(state); return; }
    if (state.answered) { applyQuizState(state); return; }
    var q = state.questions[state.index];
    if (choiceText !== q.a) {
      QZ_LOCKED_INDEX = QZ_INDEX;
      DBset(qzWrongKey(myPlayerId), { roundId: state.roundId, index: state.index, ts: Date.now() });
      document.getElementById('qz-msg').textContent = '땡! 아쉬워요. 이 문제는 더 이상 시도할 수 없어요.';
      document.getElementById('qz-msg').className = 'sd-msg over';
      document.querySelectorAll('#qz-choices .cat-btn').forEach(function (btn) {
        btn.onclick = null;
        btn.classList.add('qz-disabled');
      });
      return;
    }
    state.answered = true;
    state.winner = me.name;
    state.leaderboard = state.leaderboard || {};
    state.leaderboard[me.name] = (state.leaderboard[me.name] || 0) + 1;
    DBset(roomKey('quiz'), state).then(function () { applyQuizState(state); });
  });
}

function qzScheduleAdvance(fromIndex) {
  clearTimeout(QZ_ADVANCE_TIMER);
  QZ_ADVANCE_TIMER = setTimeout(function () {
    if (!document.getElementById('quiz').classList.contains('active') || playMode !== 'online') return;
    DBget(roomKey('quiz')).then(function (state) {
      if (!state || !state.questions || state.index !== fromIndex) { if (state) applyQuizState(state); return; }
      var newState = { roundId: state.roundId, questions: state.questions, index: fromIndex + 1, answered: false, winner: '', qStart: Date.now(), leaderboard: state.leaderboard || {} };
      DBset(roomKey('quiz'), newState).then(function () { applyQuizState(newState); });
    });
  }, 2000);
}

function qzGameOverOnline(state) {
  clearInterval(QZ_TIMER_INTERVAL);
  clearTimeout(QZ_ADVANCE_TIMER);
  document.getElementById('qz-game-area').style.display = 'none';
  document.getElementById('qz-over-area').style.display = '';
  document.getElementById('qz-over-msg').textContent = '20문제 완료! 아래 누적 점수판을 확인해보세요.';
  renderQuizLeaderboard(state.leaderboard || {});
}

function renderQuizLeaderboard(lb) {
  renderScoreLeaderboard('qz-leaderboard', lb);
}

function qzUpdateStatRow() {
  document.getElementById('qz-qidx-val').textContent = (QZ_INDEX + 1) + '/' + QZ_ROUND.length;
  document.getElementById('qz-score-val').textContent = QZ_SCORE;
  document.getElementById('qz-combo-val').textContent = QZ_COMBO + (QZ_COMBO >= 3 ? ' 🔥' : '');
}

function qzShowQuestion() {
  var view = document.getElementById('quiz');
  if (!view.classList.contains('active')) return;
  clearInterval(QZ_TIMER_INTERVAL);
  QZ_ANSWERED = false;
  qzUpdateStatRow();

  var q = QZ_ROUND[QZ_INDEX];
  document.getElementById('qz-question').textContent = q.q;
  document.getElementById('qz-msg').textContent = '';
  document.getElementById('qz-msg').className = 'sd-msg';

  QZ_CURRENT_CHOICES = shuffleArray(q.c);
  QZ_CURRENT_EVENT = null;
  document.getElementById('qz-cd-bar').style.display = 'none';
  var banner = document.getElementById('qz-event-banner');
  banner.className = 'qz-event-banner';
  banner.textContent = '';

  if (QZ_INDEX > 0 && Math.random() < QZ_EVENT_CHANCE) {
    QZ_CURRENT_EVENT = 'timer';
  }

  if (QZ_CURRENT_EVENT === 'timer') {
    banner.textContent = '⚡ 5초 안에 답하세요!';
    banner.classList.add('show');
  }

  qzRenderChoices(q);

  if (QZ_CURRENT_EVENT === 'timer') qzStartTimer();
}

function qzRenderChoices(q) {
  var wrap = document.getElementById('qz-choices');
  wrap.innerHTML = '';
  QZ_CURRENT_CHOICES.forEach(function (choiceText) {
    var btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.textContent = choiceText;
    btn.onclick = function () { qzAnswer(choiceText, btn); };
    wrap.appendChild(btn);
  });
}

function qzStartTimer() {
  var timeLeft = QZ_TIME_LIMIT;
  var bar = document.getElementById('qz-cd-bar');
  var fill = document.getElementById('qz-cd-fill');
  bar.style.display = '';
  fill.style.transition = 'none';
  fill.style.width = '100%';
  void fill.offsetWidth;
  fill.style.transition = 'width ' + QZ_TIME_LIMIT + 's linear';
  fill.style.width = '0%';
  clearInterval(QZ_TIMER_INTERVAL);
  QZ_TIMER_INTERVAL = setInterval(function () {
    timeLeft -= 1;
    if (timeLeft <= 0) {
      clearInterval(QZ_TIMER_INTERVAL);
      if (!QZ_ANSWERED) qzAnswer(null, null);
    }
  }, 1000);
}

function qzAnswer(choiceText, btnEl) {
  if (QZ_ANSWERED) return;
  QZ_ANSWERED = true;
  clearInterval(QZ_TIMER_INTERVAL);
  var q = QZ_ROUND[QZ_INDEX];
  var correct = choiceText === q.a;

  document.querySelectorAll('#qz-choices .cat-btn').forEach(function (btn) {
    btn.onclick = null;
    if (btn.textContent === q.a) btn.classList.add('qz-correct');
    else if (btn === btnEl) btn.classList.add('qz-wrong');
    else if (!btn.classList.contains('qz-removed')) btn.classList.add('qz-disabled');
  });

  var msgEl = document.getElementById('qz-msg');
  if (correct) {
    QZ_COMBO++;
    if (QZ_COMBO > QZ_BEST_COMBO) QZ_BEST_COMBO = QZ_COMBO;
    var bonus = 100 + (QZ_COMBO - 1) * 10;
    QZ_SCORE += bonus;
    msgEl.textContent = '정답! +' + bonus + '점 (연속 ' + QZ_COMBO + '개째)';
    msgEl.className = 'sd-msg win';
  } else {
    QZ_COMBO = 0;
    msgEl.textContent = choiceText === null ? ('시간 초과! 정답은 "' + q.a + '"였어요.') : ('아쉬워요! 정답은 "' + q.a + '"였어요.');
    msgEl.className = 'sd-msg over';
  }
  qzUpdateStatRow();

  clearTimeout(QZ_ADVANCE_TIMER);
  QZ_ADVANCE_TIMER = setTimeout(qzNextQuestion, 1400);
}

function qzNextQuestion() {
  QZ_INDEX++;
  if (QZ_INDEX >= QZ_ROUND.length) qzGameOver();
  else qzShowQuestion();
}

function qzGameOver() {
  document.getElementById('qz-game-area').style.display = 'none';
  document.getElementById('qz-over-area').style.display = '';
  if (QZ_SCORE > QZ_BEST_SCORE) { QZ_BEST_SCORE = QZ_SCORE; qzSaveBest(); }
  document.getElementById('qz-over-msg').textContent =
    '20문제 완료! 최종 점수 ' + QZ_SCORE + '점, 최고 콤보 ' + QZ_BEST_COMBO + '개! (역대 최고 점수: ' + QZ_BEST_SCORE + '점)';
}

