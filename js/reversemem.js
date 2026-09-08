/* ---------------- 거꾸로 기억하기 ---------------- */
var RM_MIN_LEN = 3;
var RM_LEVEL = 1;
var RM_SEQUENCE = [];
var RM_INPUT_INDEX = 0;
var RM_SCORE = 0;
var RM_BEST_LEVEL = 0;
var RM_SHOW_TIMER = null;
var RM_PANELS = ['rm-intro', 'rm-showing', 'rm-input', 'rm-over-area'];
var RM_OPP_POLL_TIMER = null;
var RM_LAST_POST = 0;

function rmLoadBest() {
  try {
    var v = parseInt(localStorage.getItem('gamehub_rm_best') || '0', 10);
    RM_BEST_LEVEL = isNaN(v) ? 0 : v;
  } catch (e) { RM_BEST_LEVEL = 0; }
}
function rmSaveBest() {
  try { localStorage.setItem('gamehub_rm_best', String(RM_BEST_LEVEL)); } catch (e) {}
}
function rmBestText() { return RM_BEST_LEVEL > 0 ? ('단계 ' + RM_BEST_LEVEL) : '기록 없음'; }

function rmShowPanel(id) {
  RM_PANELS.forEach(function (pid) {
    document.getElementById(pid).style.display = (pid === id) ? '' : 'none';
  });
}

function startReverseMem() {
  rmLoadBest();
  document.getElementById('rm-best-intro').textContent = rmBestText();
  clearTimeout(RM_SHOW_TIMER);
  rmShowPanel('rm-intro');
  rmStartOppPoll();
}

function rmBeginGame() {
  clearTimeout(RM_SHOW_TIMER);
  RM_LEVEL = 1;
  RM_SCORE = 0;
  RM_FINAL = null;
  rmPostProgress({ force: true });
  rmStartRound();
}

/* ---- 온라인: 상대방 진행상황 ---- */
function rmOpponentKey(pid) { return roomKey('reversemem_p_' + pid); }

function rmPostProgress(opts) {
  opts = opts || {};
  if (playMode !== 'online' || !roomJoined || !myPlayerId) return;
  var now = Date.now();
  if (!opts.force && now - RM_LAST_POST < 400) return;
  RM_LAST_POST = now;
  DBset(rmOpponentKey(myPlayerId), {
    name: me.name,
    cleared: opts.done ? (opts.finalCleared != null ? opts.finalCleared : (RM_LEVEL - 1)) : (RM_LEVEL - 1),
    score: opts.done ? (opts.finalScore != null ? opts.finalScore : RM_SCORE) : RM_SCORE,
    done: !!opts.done,
    ts: now
  });
}

var RM_FINAL = null;

function rmRenderOpponents() {
  var panel = document.getElementById('rm-opponents');
  if (!panel) return;
  if (playMode !== 'online' || !roomJoined || !roomPlayersList) { panel.innerHTML = ''; return; }
  var others = roomPlayersList.filter(function (p) { return p.id !== myPlayerId; });
  Promise.all(others.map(function (p) {
    return DBget(rmOpponentKey(p.id)).then(function (data) { return { name: p.name, isMe: false, data: data }; });
  })).then(function (results) {
    var myDone = document.getElementById('rm-over-area').style.display !== 'none';
    var myData = myDone
      ? { cleared: RM_FINAL ? RM_FINAL.cleared : (RM_LEVEL - 1), score: RM_FINAL ? RM_FINAL.score : RM_SCORE, done: true }
      : (RM_LEVEL > 1 || RM_SCORE > 0 ? { cleared: RM_LEVEL - 1, score: RM_SCORE, done: false } : null);
    var all = results.concat([{ name: me.name, isMe: true, data: myData }]);
    var entries = all.map(function (r) {
      var d = r.data;
      if (!d) return { name: r.name, isMe: r.isMe, label: '대기 중', sortKey: [1, 0] };
      if (d.done) return { name: r.name, isMe: r.isMe, label: '종료! ' + d.cleared + '단계 통과 (점수 ' + d.score + '점)', sortKey: [0, -d.score] };
      return { name: r.name, isMe: r.isMe, label: (d.cleared + 1) + '단계 도전 중 (점수 ' + d.score + '점)', sortKey: [1, -d.score] };
    });
    entries.sort(function (a, b) { return a.sortKey[0] - b.sortKey[0] || a.sortKey[1] - b.sortKey[1]; });
    renderRankBoard('rm-opponents', entries);
  });
}

function rmStartOppPoll() {
  rmStopOppPoll();
  if (playMode !== 'online') return;
  rmRenderOpponents();
  RM_OPP_POLL_TIMER = setInterval(rmRenderOpponents, 1200);
}

function rmStopOppPoll() {
  clearInterval(RM_OPP_POLL_TIMER);
  RM_OPP_POLL_TIMER = null;
}

function rmStartRound() {
  var view = document.getElementById('reversemem');
  if (!view.classList.contains('active')) return;
  var len = RM_MIN_LEN + (RM_LEVEL - 1);
  RM_SEQUENCE = [];
  for (var i = 0; i < len; i++) RM_SEQUENCE.push(1 + Math.floor(Math.random() * 9));
  RM_INPUT_INDEX = 0;
  document.getElementById('rm-level-val').textContent = RM_LEVEL;
  document.getElementById('rm-score-val').textContent = RM_SCORE;
  rmShowPanel('rm-showing');
  document.getElementById('rm-show-display').textContent = '';
  clearTimeout(RM_SHOW_TIMER);
  RM_SHOW_TIMER = setTimeout(function () { rmPlaySequence(0); }, 500);
}

function rmPlaySequence(idx) {
  var display = document.getElementById('rm-show-display');
  if (idx >= RM_SEQUENCE.length) {
    display.textContent = '';
    clearTimeout(RM_SHOW_TIMER);
    RM_SHOW_TIMER = setTimeout(rmShowInputPanel, 400);
    return;
  }
  display.textContent = RM_SEQUENCE[idx];
  clearTimeout(RM_SHOW_TIMER);
  RM_SHOW_TIMER = setTimeout(function () {
    display.textContent = '';
    RM_SHOW_TIMER = setTimeout(function () { rmPlaySequence(idx + 1); }, 250);
  }, 700);
}

function rmShowInputPanel() {
  document.getElementById('rm-progress').textContent = '0 / ' + RM_SEQUENCE.length;
  rmRenderPad();
  rmShowPanel('rm-input');
}

function rmRenderPad() {
  var wrap = document.getElementById('rm-pad');
  wrap.innerHTML = '';
  for (var d = 1; d <= 9; d++) {
    (function (digit) {
      var btn = document.createElement('button');
      btn.className = 'rm-pad-btn';
      btn.textContent = digit;
      btn.onclick = function () { rmInput(digit); };
      wrap.appendChild(btn);
    })(d);
  }
}

function rmInput(digit) {
  var expectedIdx = RM_SEQUENCE.length - 1 - RM_INPUT_INDEX;
  var expected = RM_SEQUENCE[expectedIdx];
  if (digit === expected) {
    RM_INPUT_INDEX++;
    if (RM_INPUT_INDEX >= RM_SEQUENCE.length) {
      RM_SCORE += RM_SEQUENCE.length * 10;
      RM_LEVEL++;
      rmPostProgress({ force: true });
      document.getElementById('rm-progress').textContent = '성공! 다음 단계로...';
      clearTimeout(RM_SHOW_TIMER);
      RM_SHOW_TIMER = setTimeout(rmStartRound, 800);
    } else {
      document.getElementById('rm-progress').textContent = RM_INPUT_INDEX + ' / ' + RM_SEQUENCE.length;
    }
  } else {
    rmGameOver();
  }
}

function rmGameOver() {
  clearTimeout(RM_SHOW_TIMER);
  var cleared = RM_LEVEL - 1;
  RM_FINAL = { cleared: cleared, score: RM_SCORE };
  if (cleared > RM_BEST_LEVEL) { RM_BEST_LEVEL = cleared; rmSaveBest(); }
  document.getElementById('rm-over-msg').innerHTML =
    '통과한 단계 <b>' + cleared + '</b> · 점수 ' + RM_SCORE + '점<br>' +
    '(역대 최고 기록: ' + rmBestText() + ')';
  rmShowPanel('rm-over-area');
  rmPostProgress({ done: true, finalCleared: cleared, finalScore: RM_SCORE, force: true });
}

function stopReverseMem() {
  clearTimeout(RM_SHOW_TIMER);
  rmStopOppPoll();
}
