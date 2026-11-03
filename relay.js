/* ---------------- 엉뚱 그림 릴레이 (온라인, 3~10명) ----------------
   1단계: 각자 엉뚱한 문장을 써요 → 2단계: 앞사람 문장을 보고 그림으로 그려요 →
   3단계: 앞사람 그림만 보고 무슨 문장인지 적어요 → (그리기/적기 반복) → 마지막에 처음 문장이
   어떻게 변했는지 한 줄씩 공개!
   - 진행 상태: roomKey('relay') (방장만 씀) / 각자 제출물: roomKey('rl_'+내id) (나만 씀)
     → 여러 명이 동시에 제출해도 서로 덮어쓰지 않아요.
   - 체인(이야기 줄) 개수 = 인원수. k단계에서 나는 (앞사람이 k-1단계에 만든 것)을 받아요. */
var RL_MIN = 3, RL_MAX = 10, RL_MAX_STEPS = 8;
var RL_SECONDS = { write: 45, draw: 90, guess: 45 };
var RL_POLL = null;
var RL_STATE = null;
var RL_MY = { gameId: null, entries: {} };
var RL_EDIT_STEP = -1;     // 지금 화면에 띄운 단계
var RL_SUBMITTED = {};     // 단계별 제출 여부
var RL_PREV_CACHE = {};    // 받은 앞사람 내용 캐시
var RL_ALL = null;         // 공개 단계: 모든 사람 제출물
var RL_DRAW = null;        // 그림판 상태
var RL_EXAMPLES = ['안경을 쓰고 선글라스를 낀 문어가 라면을 먹고 있다', '교장선생님이 구름 위에서 줄넘기를 한다', '고양이가 우주선을 타고 편의점에 간다', '수박이 축구공을 차서 골을 넣었다', '펭귄이 사막에서 아이스크림을 팔고 있다', '공룡이 버스 정류장에서 줄을 서 있다'];

function rlKey() { return roomKey('relay'); }
function rlMyKey() { return roomKey('rl_' + myPlayerId); }
function rlStepType(step) { return step === 0 ? 'write' : (step % 2 === 1 ? 'draw' : 'guess'); }

function stopRelayGame() { clearInterval(RL_POLL); RL_POLL = null; }

function startRelayGame() {
  stopRelayGame();
  RL_STATE = null; RL_ALL = null; RL_EDIT_STEP = -1; RL_SUBMITTED = {}; RL_PREV_CACHE = {};
  RL_MY = { gameId: null, entries: {} };
  document.querySelectorAll('#relay .rl-phase').forEach(function (el) { el.style.display = 'none'; });
  rlSetupCanvas();
  var n = (roomPlayersList || []).length;
  if (n < RL_MIN || n > RL_MAX) {
    document.getElementById('rl-error').style.display = '';
    document.getElementById('rl-error').textContent = '엉뚱 그림 릴레이는 ' + RL_MIN + '~' + RL_MAX + '명이 필요해요. 지금 ' + n + '명이에요.';
    return;
  }
  var starter = myPlayerId === roomHostId ? rlHostInit() : Promise.resolve();
  starter.then(function () { rlPoll(); RL_POLL = setInterval(rlPoll, 1200); });
}

function rlHostInit() {
  var order = shuffleArray((roomPlayersList || []).map(function (p) { return p.id; }));
  var names = {};
  (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; });
  var total = Math.min(order.length, RL_MAX_STEPS);
  if (total % 2 === 0 && total > 3) total--; // 마지막 단계가 "문장"으로 끝나게(홀수 개 단계)
  var st = { gameId: Date.now(), order: order, names: names, step: 0, total: total, phase: 'play', deadline: Date.now() + RL_SECONDS.write * 1000 };
  return DBset(rlKey(), st);
}

function rlHostRestart() {
  if (myPlayerId !== roomHostId) return;
  rlHostInit().then(rlPoll);
}

function rlPoll() {
  DBget(rlKey()).then(function (st) {
    if (!st || !st.order) return;
    if (!RL_STATE || RL_STATE.gameId !== st.gameId) {
      RL_MY = { gameId: st.gameId, entries: {} };
      RL_SUBMITTED = {}; RL_PREV_CACHE = {}; RL_ALL = null; RL_EDIT_STEP = -1;
    }
    RL_STATE = st;
    rlRender(st);
    if (myPlayerId === roomHostId) rlHostCheck(st);
  });
}

/* 방장: 모두 제출했거나 시간이 지나면 다음 단계로 */
function rlHostCheck(st) {
  if (st.phase !== 'play') return;
  DBgetPrefix('rl_', st.order).then(function (all) {
    var done = st.order.filter(function (pid) { var d = all[pid]; return d && d.gameId === st.gameId && d.entries && d.entries[st.step]; }).length;
    var el = document.getElementById('rl-progress');
    if (el) el.textContent = '제출 ' + done + '/' + st.order.length;
    var late = Date.now() > st.deadline + 3000;
    if (done < st.order.length && !late) return;
    DBget(rlKey()).then(function (cur) {
      if (!cur || cur.gameId !== st.gameId || cur.step !== st.step || cur.phase !== 'play') return;
      if (cur.step + 1 >= cur.total) { cur.phase = 'reveal'; cur.revealChain = 0; cur.revealCount = 1; cur.deadline = null; }
      else { cur.step++; cur.deadline = Date.now() + RL_SECONDS[rlStepType(cur.step)] * 1000; }
      DBset(rlKey(), cur).then(rlPoll);
    });
  });
}

function rlMyIndex(st) { return st.order.indexOf(myPlayerId); }
function rlPrevPid(st) { var i = rlMyIndex(st); return st.order[(i - 1 + st.order.length) % st.order.length]; }

function rlSubmit(value, auto) {
  var st = RL_STATE;
  if (!st || st.phase !== 'play') return;
  var type = rlStepType(st.step);
  if (!auto && type !== 'draw' && !String(value || '').trim()) { document.getElementById('rl-err').textContent = '내용을 적어주세요!'; return; }
  document.getElementById('rl-err').textContent = '';
  RL_MY.gameId = st.gameId;
  RL_MY.entries[st.step] = { t: type === 'draw' ? 'img' : 'text', v: type === 'draw' ? value : (String(value || '').trim().slice(0, 80) || '(시간 초과로 비어 있음)') };
  RL_SUBMITTED[st.step] = true;
  DBset(rlMyKey(), { gameId: st.gameId, entries: RL_MY.entries });
  rlRender(st);
}

function rlSubmitText() { rlSubmit(document.getElementById('rl-text-input').value); }
function rlSubmitDrawing() { rlSubmit(rlCanvasData()); }
function rlEditAgain() {
  if (!RL_STATE) return;
  RL_SUBMITTED[RL_STATE.step] = false;
  rlRender(RL_STATE);
}

/* ---- 화면 ---- */
function rlRender(st) {
  if (!document.getElementById('relay').classList.contains('active')) return;
  document.querySelectorAll('#relay .rl-phase').forEach(function (el) { el.style.display = 'none'; });
  var isHost = myPlayerId === roomHostId;
  if (st.phase === 'play') {
    var type = rlStepType(st.step);
    var remain = Math.max(0, Math.ceil((st.deadline - Date.now()) / 1000));
    document.getElementById('rl-head').style.display = '';
    document.getElementById('rl-step').textContent = (st.step + 1) + '/' + st.total + ' 단계 · ' + ({ write: '✍️ 문장 쓰기', draw: '🎨 그림 그리기', guess: '🤔 그림 보고 문장 쓰기' })[type];
    document.getElementById('rl-timer').textContent = '⏱ ' + remain + '초';
    document.getElementById('rl-timer').classList.toggle('hurry', remain <= 10);
    // 시간이 다 되면 지금까지 한 걸로 자동 제출
    if (remain <= 1 && !RL_SUBMITTED[st.step]) {
      if (type === 'draw') rlSubmit(rlCanvasData(), true);
      else rlSubmit(document.getElementById('rl-text-input').value, true);
      return;
    }
    if (RL_SUBMITTED[st.step]) {
      document.getElementById('rl-wait').style.display = '';
      if (!isHost) document.getElementById('rl-progress').textContent = '';
      return;
    }
    if (RL_EDIT_STEP !== st.step) {
      RL_EDIT_STEP = st.step;
      document.getElementById('rl-text-input').value = '';
      document.getElementById('rl-err').textContent = '';
      if (type === 'draw') rlClearCanvas(true);
    }
    if (type === 'write') {
      document.getElementById('rl-text-area').style.display = '';
      document.getElementById('rl-text-title').textContent = '엉뚱하고 재밌는 문장을 써주세요!';
      document.getElementById('rl-received').innerHTML = '';
      document.getElementById('rl-text-input').placeholder = '예: ' + RL_EXAMPLES[st.gameId % RL_EXAMPLES.length];
    } else {
      rlLoadPrev(st, function (entry) {
        if (!RL_STATE || RL_STATE.step !== st.step || RL_SUBMITTED[st.step]) return;
        if (type === 'draw') {
          document.getElementById('rl-draw-area').style.display = '';
          document.getElementById('rl-draw-prompt').innerHTML = '<small>이 문장을 그림으로!</small>' + esc(entry ? entry.v : '(앞사람이 아직 안 냈어요… 자유롭게 그려요)');
        } else {
          document.getElementById('rl-text-area').style.display = '';
          document.getElementById('rl-text-title').textContent = '이 그림은 무슨 문장일까요?';
          document.getElementById('rl-text-input').placeholder = '그림을 보고 문장으로 적어요';
          document.getElementById('rl-received').innerHTML = entry && entry.t === 'img' ? '<img class="rl-recv-img" src="' + entry.v + '" alt="받은 그림" />' : '<div class="rl-recv-empty">(앞사람 그림이 없어요… 상상해서 적어요!)</div>';
        }
      });
    }
  } else if (st.phase === 'reveal') {
    document.getElementById('rl-head').style.display = 'none';
    document.getElementById('rl-reveal').style.display = '';
    rlRenderReveal(st, isHost);
  }
}

function rlLoadPrev(st, cb) {
  var key = st.gameId + ':' + st.step;
  if (RL_PREV_CACHE[key]) { cb(RL_PREV_CACHE[key]); return; }
  var prev = rlPrevPid(st);
  DBget(roomKey('rl_' + prev)).then(function (d) {
    var e = d && d.gameId === st.gameId && d.entries ? d.entries[st.step - 1] : null;
    if (e) RL_PREV_CACHE[key] = e;
    cb(e);
  });
}

function rlRenderReveal(st, isHost) {
  var N = st.order.length;
  var draw = function () {
    var c = st.revealChain;
    var owner = st.order[c % N];
    var html = '<div class="rl-chain-title">📖 <b>' + esc(st.names[owner] || '?') + '</b>의 문장은 어떻게 변했을까? <small>(' + (c + 1) + '/' + N + ')</small></div>';
    for (var k = 0; k < Math.min(st.revealCount, st.total); k++) {
      var pid = st.order[(c + k) % N];
      var d = RL_ALL && RL_ALL[pid];
      var e = d && d.gameId === st.gameId && d.entries ? d.entries[k] : null;
      var who = '<div class="rl-item-who">' + esc(st.names[pid] || '?') + (k === 0 ? ' (처음 문장)' : (rlStepType(k) === 'draw' ? ' 의 그림' : ' 의 추측')) + '</div>';
      var body = !e ? '<div class="rl-item-text">(제출 안 함)</div>' : (e.t === 'img' ? '<img class="rl-item-img" src="' + e.v + '" alt="" />' : '<div class="rl-item-text">' + esc(e.v) + '</div>');
      html += '<div class="rl-item' + (k === st.revealCount - 1 ? ' new' : '') + '">' + who + body + '</div>';
    }
    document.getElementById('rl-album').innerHTML = html;
    var last = c >= N - 1 && st.revealCount >= st.total;
    document.getElementById('rl-next-btn').style.display = isHost && !last ? '' : 'none';
    document.getElementById('rl-next-btn').textContent = st.revealCount >= st.total ? '다음 사람 이야기 ▶' : '다음 장 보기 ▶';
    document.getElementById('rl-restart-btn').style.display = isHost && last ? '' : 'none';
    document.getElementById('rl-reveal-wait').textContent = isHost ? '' : (last ? '모든 이야기 끝! 🎉' : '방장이 한 장씩 넘겨요…');
  };
  var needed = !RL_ALL || st.order.some(function (pid) { return !RL_ALL[pid] || RL_ALL[pid].gameId !== st.gameId; });
  if (needed && !rlRenderReveal.loading) {
    rlRenderReveal.loading = true;
    DBgetPrefix('rl_', st.order).then(function (all) { RL_ALL = all; rlRenderReveal.loading = false; draw(); });
  }
  draw();
}

function rlHostNext() {
  if (myPlayerId !== roomHostId) return;
  DBget(rlKey()).then(function (st) {
    if (!st || st.phase !== 'reveal') return;
    if (st.revealCount < st.total) st.revealCount++;
    else if (st.revealChain < st.order.length - 1) { st.revealChain++; st.revealCount = 1; }
    DBset(rlKey(), st).then(rlPoll);
  });
}

/* ---- 그림판 ---- */
var RL_COLORS = ['#1d1d1d', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#8d6e63', '#f48fb1'];
function rlSetupCanvas() {
  if (RL_DRAW) return;
  var cv = document.getElementById('rl-canvas');
  var ctx = cv.getContext('2d');
  RL_DRAW = { cv: cv, ctx: ctx, color: RL_COLORS[0], size: 6, eraser: false, drawing: false, last: null, undo: [] };
  document.getElementById('rl-colors').innerHTML = RL_COLORS.map(function (c, i) {
    return '<button type="button" class="rl-color' + (i === 0 ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '"></button>';
  }).join('') + '<button type="button" class="rl-color rl-eraser" data-c="eraser" title="지우개">🧽</button>';
  document.getElementById('rl-colors').onclick = function (e) {
    var b = e.target.closest('.rl-color'); if (!b) return;
    document.querySelectorAll('#rl-colors .rl-color').forEach(function (x) { x.classList.toggle('on', x === b); });
    var c = b.getAttribute('data-c');
    RL_DRAW.eraser = c === 'eraser';
    if (!RL_DRAW.eraser) RL_DRAW.color = c;
  };
  document.getElementById('rl-sizes').onclick = function (e) {
    var b = e.target.closest('.rl-size'); if (!b) return;
    document.querySelectorAll('#rl-sizes .rl-size').forEach(function (x) { x.classList.toggle('on', x === b); });
    RL_DRAW.size = +b.getAttribute('data-s');
  };
  function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    RL_DRAW.undo.push(ctx.getImageData(0, 0, cv.width, cv.height));
    if (RL_DRAW.undo.length > 25) RL_DRAW.undo.shift();
    RL_DRAW.drawing = true;
    RL_DRAW.last = pos(e);
    rlStroke(RL_DRAW.last, RL_DRAW.last);
  });
  cv.addEventListener('pointermove', function (e) {
    if (!RL_DRAW.drawing) return;
    var p = pos(e);
    rlStroke(RL_DRAW.last, p);
    RL_DRAW.last = p;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { cv.addEventListener(ev, function () { RL_DRAW.drawing = false; }); });
  rlClearCanvas(true);
}
function rlStroke(a, b) {
  var ctx = RL_DRAW.ctx;
  ctx.strokeStyle = RL_DRAW.eraser ? '#ffffff' : RL_DRAW.color;
  ctx.lineWidth = RL_DRAW.eraser ? RL_DRAW.size * 3 : RL_DRAW.size;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 0.01, b.y + 0.01); ctx.stroke();
}
function rlClearCanvas(silent) {
  if (!RL_DRAW) return;
  if (!silent) RL_DRAW.undo.push(RL_DRAW.ctx.getImageData(0, 0, RL_DRAW.cv.width, RL_DRAW.cv.height));
  else RL_DRAW.undo = [];
  RL_DRAW.ctx.fillStyle = '#ffffff';
  RL_DRAW.ctx.fillRect(0, 0, RL_DRAW.cv.width, RL_DRAW.cv.height);
}
function rlUndo() {
  if (!RL_DRAW || !RL_DRAW.undo.length) return;
  RL_DRAW.ctx.putImageData(RL_DRAW.undo.pop(), 0, 0);
}
function rlCanvasData() { return RL_DRAW ? RL_DRAW.cv.toDataURL('image/png') : ''; }
