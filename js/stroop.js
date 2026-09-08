/* ---------------- 색깔 글자 게임 (Stroop) ---------------- */
var SW_COLORS = [
  { name: '빨강', hex: '#e6493f' },
  { name: '파랑', hex: '#3f78e6' },
  { name: '초록', hex: '#3fae5a' },
  { name: '노랑', hex: '#e6c93f' },
  { name: '보라', hex: '#9a5fe0' },
  { name: '주황', hex: '#e68a3f' }
];
var SW_ROUND_SEC = 30;
var SW_TIMER = null;
var SW_ADVANCE_TIMER = null;
var SW_TIMELEFT = 0;
var SW_SCORE = 0;
var SW_COMBO = 0;
var SW_BEST_COMBO = 0;
var SW_CORRECT = 0;
var SW_WRONG = 0;
var SW_REACTIONS = [];
var SW_CURRENT = null;
var SW_QUESTION_START = 0;
var SW_ANSWERED = false;
var SW_ACTIVE_COUNT = 4;
var SW_BEST_SCORE = 0;
var SW_OPP_POLL_TIMER = null;
var SW_LAST_POST = 0;

function swLoadBest() {
  try {
    var v = parseInt(localStorage.getItem('gamehub_sw_best') || '0', 10);
    SW_BEST_SCORE = isNaN(v) ? 0 : v;
  } catch (e) { SW_BEST_SCORE = 0; }
}
function swSaveBest() {
  try { localStorage.setItem('gamehub_sw_best', String(SW_BEST_SCORE)); } catch (e) {}
}

function startStroop() {
  swLoadBest();
  document.getElementById('sw-best-intro').textContent = SW_BEST_SCORE + '점';
  document.getElementById('sw-intro').style.display = '';
  document.getElementById('sw-game-area').style.display = 'none';
  document.getElementById('sw-over-area').style.display = 'none';
  swStartOppPoll();
}

/* ---- 온라인: 상대방 진행상황 ---- */
function swOpponentKey(pid) { return roomKey('stroop_p_' + pid); }

function swPostProgress(opts) {
  opts = opts || {};
  if (playMode !== 'online' || !roomJoined || !myPlayerId) return;
  var now = Date.now();
  if (!opts.force && now - SW_LAST_POST < 400) return;
  SW_LAST_POST = now;
  DBset(swOpponentKey(myPlayerId), {
    name: me.name,
    score: opts.done ? (opts.finalScore != null ? opts.finalScore : SW_SCORE) : SW_SCORE,
    combo: SW_COMBO,
    timeLeft: Math.max(0, SW_TIMELEFT),
    done: !!opts.done,
    ts: now
  });
}

var SW_FINAL_SCORE = null;

function swRenderOpponents() {
  var panel = document.getElementById('sw-opponents');
  if (!panel) return;
  if (playMode !== 'online' || !roomJoined || !roomPlayersList) { panel.innerHTML = ''; return; }
  var others = roomPlayersList.filter(function (p) { return p.id !== myPlayerId; });
  Promise.all(others.map(function (p) {
    return DBget(swOpponentKey(p.id)).then(function (data) { return { name: p.name, isMe: false, data: data }; });
  })).then(function (results) {
    var myDone = document.getElementById('sw-over-area').style.display !== 'none';
    var myPlaying = document.getElementById('sw-game-area').style.display !== 'none';
    var myData = myDone
      ? { score: SW_FINAL_SCORE != null ? SW_FINAL_SCORE : SW_SCORE, combo: SW_COMBO, timeLeft: 0, done: true }
      : (myPlaying ? { score: SW_SCORE, combo: SW_COMBO, timeLeft: Math.max(0, SW_TIMELEFT), done: false } : null);
    var all = results.concat([{ name: me.name, isMe: true, data: myData }]);
    var entries = all.map(function (r) {
      var d = r.data;
      if (!d) return { name: r.name, isMe: r.isMe, label: '대기 중', sortKey: [1, 0] };
      if (d.done) return { name: r.name, isMe: r.isMe, label: '종료! 최종 ' + d.score + '점 (콤보 ' + d.combo + ')', sortKey: [0, -d.score] };
      return { name: r.name, isMe: r.isMe, label: d.score + '점 (콤보 ' + d.combo + ', 남은시간 ' + d.timeLeft + '초)', sortKey: [1, -d.score] };
    });
    entries.sort(function (a, b) { return a.sortKey[0] - b.sortKey[0] || a.sortKey[1] - b.sortKey[1]; });
    renderRankBoard('sw-opponents', entries);
  });
}

function swStartOppPoll() {
  swStopOppPoll();
  if (playMode !== 'online') return;
  swRenderOpponents();
  SW_OPP_POLL_TIMER = setInterval(swRenderOpponents, 1200);
}

function swStopOppPoll() {
  clearInterval(SW_OPP_POLL_TIMER);
  SW_OPP_POLL_TIMER = null;
}

function swBeginGame() {
  clearInterval(SW_TIMER);
  clearTimeout(SW_ADVANCE_TIMER);
  SW_FINAL_SCORE = null;
  SW_SCORE = 0;
  SW_COMBO = 0;
  SW_BEST_COMBO = 0;
  SW_CORRECT = 0;
  SW_WRONG = 0;
  SW_REACTIONS = [];
  SW_TIMELEFT = SW_ROUND_SEC;
  SW_ACTIVE_COUNT = 4;
  document.getElementById('sw-intro').style.display = 'none';
  document.getElementById('sw-over-area').style.display = 'none';
  document.getElementById('sw-game-area').style.display = '';
  swUpdateStatRow();
  swPostProgress({ force: true });
  swNextQuestion();
  clearInterval(SW_TIMER);
  SW_TIMER = setInterval(swTick, 1000);
}

function swTick() {
  SW_TIMELEFT--;
  var elapsed = SW_ROUND_SEC - SW_TIMELEFT;
  if (elapsed >= 10 && SW_ACTIVE_COUNT < 5) SW_ACTIVE_COUNT = 5;
  if (elapsed >= 20 && SW_ACTIVE_COUNT < 6) SW_ACTIVE_COUNT = 6;
  swUpdateStatRow();
  swPostProgress({});
  if (SW_TIMELEFT <= 0) { swGameOver(); }
}

function swUpdateStatRow() {
  document.getElementById('sw-time-val').textContent = Math.max(0, SW_TIMELEFT);
  document.getElementById('sw-score-val').textContent = SW_SCORE;
  document.getElementById('sw-combo-val').textContent = SW_COMBO + (SW_COMBO >= 3 ? ' 🔥' : '');
}

function swNextQuestion() {
  var view = document.getElementById('stroop');
  if (!view.classList.contains('active')) return;
  if (SW_TIMELEFT <= 0) return;
  SW_ANSWERED = false;
  var pool = SW_COLORS.slice(0, SW_ACTIVE_COUNT);
  var wordColor = pool[Math.floor(Math.random() * pool.length)];
  var displayColor;
  var guard = 0;
  do {
    displayColor = pool[Math.floor(Math.random() * pool.length)];
    guard++;
  } while (displayColor.name === wordColor.name && pool.length > 1 && guard < 20);

  SW_CURRENT = { word: wordColor.name, colorHex: displayColor.hex, colorName: displayColor.name };
  var wordEl = document.getElementById('sw-word');
  wordEl.textContent = SW_CURRENT.word;
  wordEl.style.color = SW_CURRENT.colorHex;

  swRenderChoices(pool);
  SW_QUESTION_START = performance.now();
}

function swRenderChoices(pool) {
  var wrap = document.getElementById('sw-choices');
  wrap.innerHTML = '';
  var shuffled = shuffleArray(pool.slice());
  shuffled.forEach(function (c) {
    var btn = document.createElement('button');
    btn.className = 'sw-swatch';
    btn.style.background = c.hex;
    btn.title = c.name;
    btn.onclick = function () { swAnswer(c, btn); };
    wrap.appendChild(btn);
  });
}

function swAnswer(chosen, btnEl) {
  if (SW_ANSWERED || SW_TIMELEFT <= 0) return;
  SW_ANSWERED = true;
  var reactMs = performance.now() - SW_QUESTION_START;
  SW_REACTIONS.push(reactMs);
  var correct = chosen.name === SW_CURRENT.colorName;

  document.querySelectorAll('#sw-choices .sw-swatch').forEach(function (btn) { btn.onclick = null; });
  if (btnEl) btnEl.classList.add(correct ? 'correct' : 'wrong');

  if (correct) {
    SW_CORRECT++;
    SW_COMBO++;
    if (SW_COMBO > SW_BEST_COMBO) SW_BEST_COMBO = SW_COMBO;
    var bonus = 10 + Math.min(20, (SW_COMBO - 1) * 2);
    SW_SCORE += bonus;
  } else {
    SW_WRONG++;
    SW_COMBO = 0;
    SW_SCORE = Math.max(0, SW_SCORE - 5);
  }
  swUpdateStatRow();
  swPostProgress({ force: true });

  clearTimeout(SW_ADVANCE_TIMER);
  SW_ADVANCE_TIMER = setTimeout(function () {
    if (SW_TIMELEFT > 0) swNextQuestion();
  }, 220);
}

function swGameOver() {
  clearInterval(SW_TIMER);
  clearTimeout(SW_ADVANCE_TIMER);
  document.getElementById('sw-game-area').style.display = 'none';
  document.getElementById('sw-over-area').style.display = '';
  SW_FINAL_SCORE = SW_SCORE;
  if (SW_SCORE > SW_BEST_SCORE) { SW_BEST_SCORE = SW_SCORE; swSaveBest(); }
  var avgReactSec = SW_REACTIONS.length
    ? (SW_REACTIONS.reduce(function (a, b) { return a + b; }, 0) / SW_REACTIONS.length / 1000).toFixed(2)
    : '0.00';
  document.getElementById('sw-over-msg').innerHTML =
    '최종 점수 <b>' + SW_SCORE + '점</b><br>' +
    '정답 ' + SW_CORRECT + '개 / 오답 ' + SW_WRONG + '개<br>' +
    '최고 콤보 ' + SW_BEST_COMBO + '개 · 평균 반응속도 ' + avgReactSec + '초<br>' +
    '(역대 최고 점수: ' + SW_BEST_SCORE + '점)';
  swPostProgress({ done: true, finalScore: SW_SCORE, force: true });
}

function stopStroop() {
  clearInterval(SW_TIMER);
  clearTimeout(SW_ADVANCE_TIMER);
  swStopOppPoll();
}
