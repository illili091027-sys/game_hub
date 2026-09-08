/* ---------------- 10초 감각 게임 ---------------- */
/* 라운드마다 목표 시간(5/7/10/13/20초 중 하나)이 표시되고, 카운트다운이 끝나면 타이머가
   화면에 보이지 않는 채로 시작됩니다. 플레이어는 마음속으로 시간을 세다가 목표 시간이
   됐다고 생각하는 순간 STOP을 누릅니다. 오차가 작을수록 등급(PERFECT/EXCELLENT/GOOD)과
   점수가 높아지고, 총 5라운드가 끝나면 평균 오차/최고 라운드/최종 점수를 보여줍니다. */
var TS_ROUND_COUNT = 5;
var TS_TARGETS_POOL = [5, 7, 10, 13, 20];
var TS_ROUND_IDX = 0;
var TS_TARGETS = [];
var TS_ROUND_RESULTS = [];
var TS_RUNNING = false;
var TS_START_TIME = 0;
var TS_COUNTDOWN_TIMER = null;
var TS_BEST_SCORE = null;
var TS_OPP_POLL_TIMER = null;

function tsLoadBest() {
  try {
    var v = parseFloat(localStorage.getItem('gamehub_ts_best_score') || '');
    TS_BEST_SCORE = isNaN(v) ? null : v;
  } catch (e) { TS_BEST_SCORE = null; }
}
function tsSaveBest(score) {
  try { localStorage.setItem('gamehub_ts_best_score', String(score)); } catch (e) {}
}
function tsBestText() {
  return TS_BEST_SCORE !== null ? (TS_BEST_SCORE + '점') : '기록 없음';
}

function tsShowOnly(id) {
  ['ts-intro', 'ts-round-area', 'ts-round-result-area', 'ts-final-area'].forEach(function (elId) {
    document.getElementById(elId).style.display = (elId === id) ? '' : 'none';
  });
}

function startTenSec() {
  tsLoadBest();
  document.getElementById('ts-best-intro').textContent = tsBestText();
  tsShowOnly('ts-intro');
  tsStopCountdown();
  TS_RUNNING = false;
  tsStartOppPoll();
}

function tsStartGame() {
  TS_ROUND_IDX = 0;
  TS_ROUND_RESULTS = [];
  TS_TARGETS = shuffleArray(TS_TARGETS_POOL).slice(0, TS_ROUND_COUNT);
  tsBeginRound();
}

function tsBeginRound() {
  tsShowOnly('ts-round-area');
  tsPostLive('playing', TS_ROUND_IDX + 1);
  document.getElementById('ts-round-indicator').textContent = (TS_ROUND_IDX + 1) + ' / ' + TS_ROUND_COUNT + ' 라운드';
  var target = TS_TARGETS[TS_ROUND_IDX];
  var targetDisplay = document.getElementById('ts-target-display');
  targetDisplay.innerHTML = '목표 시간: <b>' + target + '</b>초';
  targetDisplay.style.display = '';
  document.getElementById('ts-countdown').style.display = 'none';
  document.getElementById('ts-running-area').style.display = 'none';
  TS_RUNNING = false;

  /* 목표 시간을 잠깐 보여준 다음 카운트다운(3-2-1)을 하고, 그 뒤로는 타이머가 화면에
     보이지 않는 채로 시작됩니다 - 실제 시간을 보고 맞히면 반칙이니까요. */
  clearTimeout(TS_COUNTDOWN_TIMER);
  TS_COUNTDOWN_TIMER = setTimeout(function () { tsRunCountdown(3, target); }, 1200);
}

function tsRunCountdown(n, target) {
  document.getElementById('ts-target-display').style.display = 'none';
  var cd = document.getElementById('ts-countdown');
  cd.style.display = '';
  if (n > 0) {
    cd.textContent = n;
    TS_COUNTDOWN_TIMER = setTimeout(function () { tsRunCountdown(n - 1, target); }, 700);
  } else {
    cd.textContent = '시작!';
    TS_COUNTDOWN_TIMER = setTimeout(function () {
      cd.style.display = 'none';
      document.getElementById('ts-running-area').style.display = '';
      TS_RUNNING = true;
      TS_START_TIME = performance.now();
    }, 500);
  }
}

function tsStopCountdown() {
  clearTimeout(TS_COUNTDOWN_TIMER);
}

function tsGrade(diff) {
  if (diff <= 0.05) return 'PERFECT';
  if (diff <= 0.15) return 'EXCELLENT';
  if (diff <= 0.35) return 'GOOD';
  return '아쉬워요';
}
function tsGradeEmoji(grade) {
  return { PERFECT: '⭐', EXCELLENT: '👏', GOOD: '😊' }[grade] || '🙂';
}
function tsGradeClass(grade) {
  return { PERFECT: 'ts-grade-perfect', EXCELLENT: 'ts-grade-excellent', GOOD: 'ts-grade-good' }[grade] || 'ts-grade-miss';
}
function tsScoreFor(diff) {
  return Math.round(Math.max(0, 100 - diff * 200));
}

function tsStop() {
  if (!TS_RUNNING) return;
  TS_RUNNING = false;
  var target = TS_TARGETS[TS_ROUND_IDX];
  var elapsedSec = (performance.now() - TS_START_TIME) / 1000;
  var diff = Math.abs(elapsedSec - target);
  var grade = tsGrade(diff);
  var score = tsScoreFor(diff);
  TS_ROUND_RESULTS.push({ target: target, elapsed: elapsedSec, diff: diff, score: score, grade: grade });

  tsShowOnly('ts-round-result-area');
  var gradeEl = document.getElementById('ts-result-grade');
  gradeEl.textContent = tsGradeEmoji(grade) + ' ' + grade;
  gradeEl.className = 'ts-result-grade ' + tsGradeClass(grade);
  document.getElementById('ts-result-time').textContent = elapsedSec.toFixed(2) + '초';
  document.getElementById('ts-result-diff').textContent = '목표 ' + target + '초 · 오차 ' + diff.toFixed(2) + '초 · +' + score + '점';
  document.getElementById('ts-next-round-btn').textContent = (TS_ROUND_IDX + 1 >= TS_ROUND_COUNT) ? '결과 보기' : '다음 라운드';
}

function tsNextRound() {
  TS_ROUND_IDX++;
  if (TS_ROUND_IDX >= TS_ROUND_COUNT) {
    tsShowFinal();
  } else {
    tsBeginRound();
  }
}

function tsShowFinal() {
  tsShowOnly('ts-final-area');
  var totalScore = TS_ROUND_RESULTS.reduce(function (s, r) { return s + r.score; }, 0);
  var avgDiff = TS_ROUND_RESULTS.reduce(function (s, r) { return s + r.diff; }, 0) / TS_ROUND_RESULTS.length;
  var best = TS_ROUND_RESULTS.reduce(function (a, b) { return b.diff < a.diff ? b : a; });
  document.getElementById('ts-final-score').textContent = totalScore + '점';
  document.getElementById('ts-final-avg').textContent = avgDiff.toFixed(2) + '초';
  document.getElementById('ts-final-best').textContent = best.target + '초 목표 · ' + best.elapsed.toFixed(2) + '초 (오차 ' + best.diff.toFixed(2) + '초)';
  if (TS_BEST_SCORE === null || totalScore > TS_BEST_SCORE) {
    TS_BEST_SCORE = totalScore;
    tsSaveBest(totalScore);
  }
  tsPostResult(totalScore, avgDiff);
}

/* ---- 온라인: 친구들 결과 + 실시간 진행 상황 표시 ---- */
/* "같이 게임하는 느낌"이 나도록, 다 끝난 최종 점수만 보여주던 것에서 한 걸음 더 나아가
   지금 몇 번째 라운드를 도전하고 있는지도 실시간으로 같이 볼 수 있게 합니다. 라운드가
   바뀔 때마다(tsBeginRound) phase:'playing'으로 갱신하고, 최종 결과가 나오면
   phase:'done'으로 덮어씁니다. */
function tsResultKey(pid) { return roomKey('tensec_r_' + pid); }

function tsPostLive(phase, roundIdx) {
  if (playMode !== 'online' || !roomJoined || !myPlayerId) return;
  DBset(tsResultKey(myPlayerId), { name: me.name, phase: phase, roundIdx: roundIdx, of: TS_ROUND_COUNT, ts: Date.now() });
}

function tsPostResult(totalScore, avgDiff) {
  if (playMode !== 'online' || !roomJoined || !myPlayerId) return;
  DBset(tsResultKey(myPlayerId), { name: me.name, phase: 'done', score: totalScore, avgDiff: avgDiff, ts: Date.now() });
}

function tsRenderOpponents() {
  var panel = document.getElementById('ts-opponents');
  if (!panel) return;
  if (playMode !== 'online' || !roomJoined || !roomPlayersList) { panel.innerHTML = ''; return; }
  Promise.all(roomPlayersList.map(function (p) {
    return DBget(tsResultKey(p.id)).then(function (data) { return { name: p.name, isMe: p.id === myPlayerId, data: data }; });
  })).then(function (results) {
    var entries = results.map(function (r) {
      var d = r.data;
      if (!d) return { name: r.name, isMe: r.isMe, label: '아직 도전 전', sortKey: [2, 0] };
      if (d.phase === 'done') return { name: r.name, isMe: r.isMe, label: d.score + '점 (평균 오차 ' + d.avgDiff.toFixed(2) + '초)', sortKey: [0, -d.score] };
      return { name: r.name, isMe: r.isMe, label: '🎯 ' + (d.roundIdx || 1) + ' / ' + (d.of || TS_ROUND_COUNT) + ' 라운드 도전 중...', sortKey: [1, -(d.roundIdx || 0)] };
    });
    entries.sort(function (a, b) { return a.sortKey[0] - b.sortKey[0] || a.sortKey[1] - b.sortKey[1]; });
    renderRankBoard('ts-opponents', entries);
  });
}

function tsStartOppPoll() {
  tsStopOppPoll();
  if (playMode !== 'online') return;
  tsRenderOpponents();
  TS_OPP_POLL_TIMER = setInterval(tsRenderOpponents, 1500);
}
function tsStopOppPoll() {
  clearInterval(TS_OPP_POLL_TIMER);
  TS_OPP_POLL_TIMER = null;
}

function stopTenSec() {
  TS_RUNNING = false;
  tsStopCountdown();
  tsStopOppPoll();
}
