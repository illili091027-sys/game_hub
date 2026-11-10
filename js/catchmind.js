/* ---------------- 캐치마인드 (온라인, 2~10명) ----------------
   돌아가면서 한 명이 출제자가 돼요. 출제자는 단어 3개 중 하나를 골라 그림으로 그리고,
   나머지는 그림을 보고 정답을 입력해요. 맞힌 사람과 출제자 모두 점수!
   - 방 공용 상태 roomKey('catch'): 방장만 씀 (차례, 단어, 점수, 정답/오답 기록)
   - 그림 roomKey('cm_draw'): 출제자만 씀 (선 목록) → 다른 사람 화면에서 똑같이 다시 그려요
   - 내 추측 roomKey('cm_g_'+내id): 나만 씀 → 방장이 모아서 정답 판정 */
var CM_MIN = 2, CM_MAX = 10;
var CM_CHOOSE_S = 12, CM_DRAW_S = 80, CM_REVEAL_S = 5;
var CM_W = 640, CM_H = 480;
var CM_WORDS = ['사과', '바나나', '수박', '딸기', '포도', '당근', '피자', '햄버거', '라면', '김밥', '아이스크림', '케이크', '도넛', '치킨', '떡볶이', '우유', '계란', '빵',
  '고양이', '강아지', '토끼', '코끼리', '기린', '사자', '호랑이', '펭귄', '돼지', '거북이', '물고기', '상어', '고래', '문어', '뱀', '개구리', '나비', '거미', '달팽이', '공룡', '오리', '닭', '부엉이', '원숭이', '판다', '곰',
  '자동차', '버스', '비행기', '배', '기차', '자전거', '로켓', '헬리콥터', '잠수함', '오토바이',
  '집', '학교', '병원', '다리', '성', '텐트', '등대', '놀이터', '편의점',
  '해', '달', '별', '구름', '비', '눈사람', '무지개', '번개', '산', '바다', '섬', '화산', '나무', '꽃', '선인장', '버섯', '눈',
  '연필', '가위', '시계', '안경', '우산', '모자', '신발', '양말', '가방', '책', '컴퓨터', '휴대폰', '텔레비전', '의자', '침대', '냉장고', '선풍기', '전구', '열쇠', '왕관', '풍선', '선물', '편지', '거울', '칫솔', '빗자루', '촛불', '사다리', '망원경', '카메라',
  '축구공', '야구', '농구', '줄넘기', '수영', '스키', '그네', '미끄럼틀', '기타', '피아노', '드럼', '나팔',
  '눈물', '하트', '천사', '유령', '해적', '마녀', '외계인', '로봇', '경찰', '소방관', '의사', '요리사', '산타', '공주', '닌자', '좀비', '허수아비', '미라'];

var CM_POLL = null, CM_DRAW_POLL = null, CM_HOST = null, CM_TICK = null;
var CM_STATE = null;
var CM_MY_GUESS = { turnId: null, list: [] };
var CM_PAD = null;          // 내가 그리는 그림판 상태
var CM_VIEW = { turnId: null, rev: -1, op: 0, pt: 0 };   // 받은 그림을 어디까지 그렸는지
var CM_OPS = [];            // 출제자: 내 선 목록
var CM_REV = 0, CM_DIRTY = false, CM_PUB_BUSY = false, CM_LAST_PUB = 0;
var CM_SEEN_FEED = 0;
var CM_HOST_BUSY = false;

function cmKey() { return roomKey('catch'); }
function cmDrawKey() { return roomKey('cm_draw'); }
function cmMyKey() { return roomKey('cm_g_' + myPlayerId); }
function cmNorm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }

function stopCatchGame() {
  clearInterval(CM_POLL); CM_POLL = null;
  clearInterval(CM_DRAW_POLL); CM_DRAW_POLL = null;
  clearInterval(CM_HOST); CM_HOST = null;
  clearInterval(CM_TICK); CM_TICK = null;
}

function startCatchGame() {
  stopCatchGame();
  CM_STATE = null; CM_MY_GUESS = { turnId: null, list: [] }; CM_VIEW = { turnId: null, rev: -1, op: 0, pt: 0 };
  CM_OPS = []; CM_REV = 0; CM_SEEN_FEED = 0;
  cmSetupPad();
  document.getElementById('cm-result').style.display = 'none';
  var n = (roomPlayersList || []).length;
  var err = document.getElementById('cm-error');
  if (n < CM_MIN || n > CM_MAX) {
    err.style.display = '';
    err.textContent = '캐치마인드는 ' + CM_MIN + '~' + CM_MAX + '명이 필요해요. 지금 ' + n + '명이에요.';
    document.getElementById('cm-main').style.display = 'none';
    return;
  }
  err.style.display = 'none';
  document.getElementById('cm-main').style.display = '';
  var starter = myPlayerId === roomHostId ? cmHostInit() : Promise.resolve();
  starter.then(function () {
    cmPoll();
    CM_POLL = setInterval(cmPoll, 450);
    CM_DRAW_POLL = setInterval(cmDrawSync, 250);
    CM_TICK = setInterval(cmTick, 250);
    if (myPlayerId === roomHostId) CM_HOST = setInterval(cmHostTick, 450);
  });
}

/* ---- 방장: 진행 ---- */
function cmPickWords(used) {
  var pool = CM_WORDS.filter(function (w) { return used.indexOf(w) < 0; });
  if (pool.length < 3) pool = CM_WORDS.slice();
  return shuffleArray(pool).slice(0, 3);
}
function cmHostInit() {
  var order = shuffleArray((roomPlayersList || []).map(function (p) { return p.id; }));
  var names = {}, scores = {};
  (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; scores[p.id] = 0; });
  var per = order.length <= 3 ? 3 : (order.length <= 5 ? 2 : 1);   /* 한 사람당 그리는 횟수 */
  var st = { gameId: Date.now(), order: order, names: names, scores: scores, turns: Math.min(20, order.length * per), turn: 0, used: [], phase: 'choose' };
  cmSetupTurn(st);
  return Promise.all([DBset(cmKey(), st), DBset(cmDrawKey(), { turnId: st.turnId, rev: 0, ops: [] })]);
}
function cmHostRestart() { if (myPlayerId === roomHostId) cmHostInit().then(cmPoll); }

/* 다음 차례 준비 (나간 사람 차례는 건너뛰어요) */
function cmSetupTurn(st) {
  var here = {};
  (roomPlayersList || []).forEach(function (p) { here[p.id] = 1; });
  var tries = 0, drawer = st.order[st.turn % st.order.length];
  while (!here[drawer] && tries < st.order.length) { st.turn++; tries++; drawer = st.order[st.turn % st.order.length]; }
  st.drawer = drawer;
  st.turnId = st.gameId + '-' + st.turn;
  st.choices = cmPickWords(st.used);
  st.word = null; st.hint = null;
  st.phase = 'choose';
  st.deadline = Date.now() + CM_CHOOSE_S * 1000;
  st.correct = {};    // pid → 맞힌 시각
  st.feed = [];       // 채팅처럼 보이는 추측 기록
  st.gain = {};
}
function cmHostSave(st) { return DBset(cmKey(), st).then(function () { CM_STATE = st; cmRender(); }); }

function cmHostTick() {
  if (myPlayerId !== roomHostId || CM_HOST_BUSY) return;
  if (!document.getElementById('catch').classList.contains('active')) return;
  CM_HOST_BUSY = true;
  Promise.all([DBget(cmKey()), DBgetPrefix('cm_g_', (CM_STATE && CM_STATE.order) || [])]).then(function (r) {
    var st = r[0], all = r[1] || {};
    CM_HOST_BUSY = false;
    if (!st || !st.order || st.phase === 'end') return;
    var now = Date.now(), changed = false;
    var hereList = (roomPlayersList || []).map(function (p) { return p.id; });
    if (st.phase === 'choose') {
      /* 출제자가 고른 단어(출제자의 추측 칸에 pick으로 올려요) 또는 시간 초과 → 자동 선택 */
      var dg = all[st.drawer];
      var pick = dg && dg.turnId === st.turnId && dg.pick;
      if (pick && st.choices.indexOf(pick) >= 0) cmHostBeginDraw(st, pick);
      else if (now > st.deadline + 600 || hereList.indexOf(st.drawer) < 0) cmHostBeginDraw(st, st.choices[0]);
      else return;
      return cmHostSave(st);
    }
    if (st.phase === 'draw') {
      var answer = cmNorm(st.word);
      st.order.forEach(function (pid) {
        if (pid === st.drawer) return;
        var g = all[pid];
        if (!g || g.turnId !== st.turnId || !g.list) return;
        var seen = (st.seen && st.seen[pid]) || 0;
        g.list.slice(seen).forEach(function (it) {
          if (st.correct[pid]) return;
          if (cmNorm(it.v) === answer) {
            st.correct[pid] = now;
            var left = Math.max(0, st.deadline - now) / (CM_DRAW_S * 1000);
            var first = Object.keys(st.correct).length === 1;
            var pts = Math.max(30, Math.round(100 * left)) + (first ? 20 : 0);
            st.scores[pid] = (st.scores[pid] || 0) + pts;
            st.scores[st.drawer] = (st.scores[st.drawer] || 0) + 40;
            st.gain[pid] = pts; st.gain[st.drawer] = (st.gain[st.drawer] || 0) + 40;
            st.feed.push({ pid: pid, ok: 1 });
          } else {
            st.feed.push({ pid: pid, v: String(it.v).slice(0, 30) });
          }
        });
        st.seen = st.seen || {}; st.seen[pid] = g.list.length;
        changed = true;
      });
      if (st.feed.length > 60) st.feed = st.feed.slice(-60);
      /* 힌트: 절반 지나면 한 글자 공개 */
      if (!st.hint && now > st.deadline - CM_DRAW_S * 500 && st.word.length >= 2) {
        var i = Math.floor(Math.random() * st.word.length);
        st.hint = { i: i, c: st.word[i] }; changed = true;
      }
      var guessers = st.order.filter(function (pid) { return pid !== st.drawer && hereList.indexOf(pid) >= 0; });
      var allOk = guessers.length && guessers.every(function (pid) { return st.correct[pid]; });
      if (allOk || now > st.deadline || hereList.indexOf(st.drawer) < 0) {
        st.phase = 'reveal';
        st.deadline = now + CM_REVEAL_S * 1000;
        changed = true;
      }
      if (changed) return cmHostSave(st);
      return;
    }
    if (st.phase === 'reveal' && now > st.deadline) {
      st.turn++;
      if (st.turn >= st.turns) { st.phase = 'end'; return cmHostSave(st); }
      cmSetupTurn(st);
      return Promise.all([cmHostSave(st), DBset(cmDrawKey(), { turnId: st.turnId, rev: 0, ops: [] })]);
    }
  }).catch(function () { CM_HOST_BUSY = false; });
}
function cmHostBeginDraw(st, word) {
  st.word = word;
  st.used = (st.used || []).concat([word]).slice(-80);
  st.phase = 'draw';
  st.deadline = Date.now() + CM_DRAW_S * 1000;
  st.seen = {};
}

/* ---- 모두: 상태 받기 ---- */
function cmPoll() {
  DBget(cmKey()).then(function (st) {
    if (!st || !st.order) return;
    var prev = CM_STATE;
    CM_STATE = st;
    if (!prev || prev.turnId !== st.turnId) cmNewTurn(st);
    /* 새로 맞힌 사람 소리 */
    if (prev && prev.turnId === st.turnId && st.feed && prev.feed && st.feed.length > prev.feed.length) {
      var hit = st.feed.slice(prev.feed.length).some(function (f) { return f.ok; });
      if (hit) cmSound('ok');
    }
    if (prev && prev.phase !== st.phase && st.phase === 'reveal') cmSound('reveal');
    cmRender();
  });
}
function cmNewTurn(st) {
  CM_MY_GUESS = { turnId: st.turnId, list: [] };
  CM_OPS = []; CM_REV = 0; CM_DIRTY = false;
  CM_VIEW = { turnId: null, rev: -1, op: 0, pt: 0 };
  cmPadClear(true);
  document.getElementById('cm-guess').value = '';
  document.getElementById('cm-feed').innerHTML = '';
  CM_SEEN_FEED = 0;
  if (st.drawer === myPlayerId) cmSound('turn');
}
function cmTick() { if (CM_STATE) cmRenderTimer(); if (CM_DIRTY) cmPublishDraw(); }

/* ---- 출제자: 단어 고르기 ---- */
function cmChoose(w) {
  var st = CM_STATE;
  if (!st || st.drawer !== myPlayerId || st.phase !== 'choose') return;
  DBset(cmMyKey(), { turnId: st.turnId, pick: w, list: [] });
  document.getElementById('cm-choose').innerHTML = '<div class="cm-choose-wait">✏️ <b>' + esc(w) + '</b> 그릴 준비!</div>';
}

/* ---- 맞히는 사람: 정답 입력 ---- */
function cmSendGuess() {
  var st = CM_STATE, inp = document.getElementById('cm-guess');
  var v = inp.value.trim();
  if (!st || !v || st.phase !== 'draw' || st.drawer === myPlayerId || (st.correct && st.correct[myPlayerId])) { inp.value = ''; return; }
  inp.value = '';
  if (CM_MY_GUESS.turnId !== st.turnId) CM_MY_GUESS = { turnId: st.turnId, list: [] };
  CM_MY_GUESS.list.push({ v: v.slice(0, 30), t: Date.now() });
  DBset(cmMyKey(), { turnId: st.turnId, list: CM_MY_GUESS.list.slice(-40) });
  /* 내 화면엔 바로 보여주기 (방장이 판정하면 다시 그려져요) */
  var feed = document.getElementById('cm-feed');
  feed.insertAdjacentHTML('beforeend', '<div class="cm-f pending"><b>' + esc(me.name) + '</b> ' + esc(v.slice(0, 30)) + '</div>');
  feed.scrollTop = feed.scrollHeight;
}

/* ---- 화면 ---- */
function cmRenderTimer() {
  var st = CM_STATE, el = document.getElementById('cm-timer');
  if (!st || !st.deadline || st.phase === 'end') { el.textContent = ''; return; }
  var remain = Math.max(0, Math.ceil((st.deadline - Date.now()) / 1000));
  el.textContent = '⏱ ' + remain;
  el.classList.toggle('hurry', st.phase === 'draw' && remain <= 10);
}
function cmWordLabel(st) {
  if (st.phase === 'choose') return st.drawer === myPlayerId ? '그릴 단어를 골라요!' : esc(st.names[st.drawer] || '?') + '님이 단어를 고르는 중…';
  if (st.phase === 'reveal' || st.phase === 'end' || st.drawer === myPlayerId || (st.correct && st.correct[myPlayerId])) return '<span class="cm-word">' + esc(st.word || '') + '</span>';
  var s = '';
  for (var i = 0; i < (st.word || '').length; i++) s += '<span class="cm-blank">' + (st.hint && st.hint.i === i ? esc(st.hint.c) : '') + '</span>';
  return s + '<small class="cm-len">' + (st.word || '').length + '글자</small>';
}
function cmRender() {
  var st = CM_STATE;
  if (!st || !document.getElementById('catch').classList.contains('active')) return;
  var isDrawer = st.drawer === myPlayerId, isHost = myPlayerId === roomHostId;
  document.getElementById('cm-round').textContent = st.phase === 'end' ? '게임 끝!' : ('라운드 ' + Math.min(st.turn + 1, st.turns) + ' / ' + st.turns);
  var wl = cmWordLabel(st), we = document.getElementById('cm-wordbox');
  if (we.getAttribute('data-h') !== wl) { we.innerHTML = wl; we.setAttribute('data-h', wl); }
  cmRenderTimer();
  /* 점수판 */
  var rows = st.order.map(function (pid) { return { pid: pid, s: st.scores[pid] || 0 }; }).sort(function (a, b) { return b.s - a.s; });
  var here = {};
  (roomPlayersList || []).forEach(function (p) { here[p.id] = 1; });
  var ph = rows.map(function (r) {
    var cls = (r.pid === myPlayerId ? ' me' : '') + (r.pid === st.drawer && st.phase !== 'end' ? ' drawer' : '') + (st.correct && st.correct[r.pid] ? ' ok' : '') + (here[r.pid] ? '' : ' gone');
    var gain = st.phase === 'reveal' && st.gain && st.gain[r.pid] ? ' <i class="cm-gain">+' + st.gain[r.pid] + '</i>' : '';
    return '<div class="cm-p' + cls + '"><span class="cm-pn">' + (r.pid === st.drawer && st.phase !== 'end' ? '✏️ ' : (st.correct && st.correct[r.pid] ? '✅ ' : '')) + esc(st.names[r.pid] || '?') + (r.pid === myPlayerId ? ' (나)' : '') + '</span><b>' + r.s + gain + '</b></div>';
  }).join('');
  var pe = document.getElementById('cm-players');
  if (pe.getAttribute('data-h') !== ph) { pe.innerHTML = ph; pe.setAttribute('data-h', ph); }
  /* 추측 기록 */
  var feed = document.getElementById('cm-feed');
  var fl = st.feed || [];
  if (fl.length !== CM_SEEN_FEED || feed.querySelector('.pending')) {
    var stick = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
    feed.innerHTML = fl.map(function (f) {
      var nm = esc(st.names[f.pid] || '?');
      return f.ok ? '<div class="cm-f ok">🎉 <b>' + nm + '</b>님 정답!</div>' : '<div class="cm-f"><b>' + nm + '</b> ' + esc(f.v) + '</div>';
    }).join('');
    CM_SEEN_FEED = fl.length;
    if (stick || true) feed.scrollTop = feed.scrollHeight;
  }
  /* 단어 고르기 / 정답 공개 / 끝 */
  var choose = document.getElementById('cm-choose');
  var showChoose = st.phase === 'choose' && isDrawer;
  if (showChoose && choose.getAttribute('data-t') !== st.turnId) {
    choose.setAttribute('data-t', st.turnId);
    choose.innerHTML = '<div class="cm-choose-title">그릴 단어를 골라요!</div>' + st.choices.map(function (w) { return '<button class="cm-choice" onclick="cmChoose(\'' + w + '\')">' + esc(w) + '</button>'; }).join('');
  }
  choose.style.display = showChoose ? '' : 'none';
  var ov = document.getElementById('cm-overlay');
  var ovHtml = '';
  if (st.phase === 'choose' && !isDrawer) ovHtml = '<div class="cm-ov-big">🤔</div><div><b>' + esc(st.names[st.drawer] || '?') + '</b>님이 그릴 단어를 고르고 있어요…</div>';
  else if (st.phase === 'reveal') {
    var n = Object.keys(st.correct || {}).length;
    ovHtml = '<div class="cm-ov-sub">정답은</div><div class="cm-ov-word">' + esc(st.word || '') + '</div><div>' + (n ? n + '명이 맞혔어요! 🎉' : '아무도 못 맞혔어요 😅') + '</div>';
  }
  if (ov.getAttribute('data-h') !== ovHtml) { ov.innerHTML = ovHtml; ov.setAttribute('data-h', ovHtml); }
  ov.style.display = ovHtml ? '' : 'none';
  /* 출제자만 그림 도구 */
  document.getElementById('cm-tools').style.display = isDrawer && st.phase === 'draw' ? '' : 'none';
  document.getElementById('cm-canvas').classList.toggle('can-draw', isDrawer && st.phase === 'draw');
  var gi = document.getElementById('cm-guess');
  var canGuess = !isDrawer && st.phase === 'draw' && !(st.correct && st.correct[myPlayerId]);
  gi.disabled = !canGuess;
  gi.placeholder = isDrawer ? '출제자는 그림만 그려요! (글자 쓰기 금지 🙅)' : (st.correct && st.correct[myPlayerId] ? '정답! 다른 친구들을 기다려요 😎' : (st.phase === 'draw' ? '정답을 입력하고 엔터!' : '잠깐 기다려요…'));
  document.getElementById('cm-send').disabled = !canGuess;
  if (st.phase === 'end') cmShowResult(st, isHost); else document.getElementById('cm-result').style.display = 'none';
}
function cmShowResult(st, isHost) {
  var box = document.getElementById('cm-result');
  box.style.display = '';
  if (box.getAttribute('data-g') !== String(st.gameId)) {
    box.setAttribute('data-g', st.gameId);
    var rows = st.order.map(function (pid) { return { pid: pid, s: st.scores[pid] || 0 }; }).sort(function (a, b) { return b.s - a.s; });
    document.getElementById('cm-result-title').textContent = '🏆 ' + (st.names[rows[0].pid] || '?') + ' 우승!';
    typeof celebrateWin === 'function' && celebrateWin('catch:' + st.gameId, rows.filter(function (r) { return r.s === rows[0].s; }).map(function (r) { return st.names[r.pid]; }), '캐치마인드 · ' + rows[0].s + '점');
    renderRankBoard('cm-result-rank', rows.map(function (r) { return { name: st.names[r.pid] || '?', isMe: r.pid === myPlayerId, label: r.s + '점' }; }));
    cmSound('end');
  }
  document.getElementById('cm-restart').style.display = isHost ? '' : 'none';
}

/* ---- 그림 주고받기 ---- */
function cmPublishDraw() {
  var st = CM_STATE;
  if (!st || st.drawer !== myPlayerId || CM_PUB_BUSY) return;
  if (Date.now() - CM_LAST_PUB < 200) return;
  CM_DIRTY = false; CM_PUB_BUSY = true; CM_LAST_PUB = Date.now();
  DBset(cmDrawKey(), { turnId: st.turnId, rev: CM_REV, ops: CM_OPS }).then(function () { CM_PUB_BUSY = false; }, function () { CM_PUB_BUSY = false; CM_DIRTY = true; });
}
function cmDrawSync() {
  var st = CM_STATE;
  if (!st || st.drawer === myPlayerId || cmDrawSync.busy) return;
  if (!document.getElementById('catch').classList.contains('active')) return;
  cmDrawSync.busy = true;
  DBget(cmDrawKey()).then(function (d) {
    cmDrawSync.busy = false;
    if (!d || !CM_STATE || d.turnId !== CM_STATE.turnId) return;
    var ops = d.ops || [];
    /* 되돌리기/다 지우기를 했으면(rev 바뀜) 처음부터 다시, 아니면 새로 그린 부분만 이어서 */
    if (CM_VIEW.turnId !== d.turnId || CM_VIEW.rev !== d.rev || ops.length < CM_VIEW.op) {
      cmPadClear(true);
      CM_VIEW = { turnId: d.turnId, rev: d.rev, op: 0, pt: 0 };
    }
    for (var i = CM_VIEW.op; i < ops.length; i++) {
      var from = i === CM_VIEW.op ? CM_VIEW.pt : 0;
      var done = cmApplyOp(ops[i], from);
      CM_VIEW.op = i; CM_VIEW.pt = done;
    }
    /* 마지막 선은 아직 이어지는 중일 수 있어서 '그 선의 몇 번째 점까지'를 기억해요 */
  }, function () { cmDrawSync.busy = false; });
}
/* 선 하나 그리기: o = {k:'s', c:색, w:굵기, p:[x,y,x,y...]} / {k:'f', c, x, y} (채우기)
   from: 이미 그린 점 개수 → 그 다음 점부터 이어서. 그린 점 개수를 돌려줘요 */
function cmApplyOp(o, from) {
  var ctx = CM_PAD.ctx;
  if (o.k === 'f') { if (!from) cmFloodFill(ctx, o.x, o.y, o.c); return 1; }
  var p = o.p || [], n = p.length / 2;
  if (!n) return 0;
  ctx.strokeStyle = o.c; ctx.lineWidth = o.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  var s = Math.max(0, from - 1);
  ctx.moveTo(p[s * 2], p[s * 2 + 1]);
  if (n === 1) ctx.lineTo(p[0] + 0.01, p[1] + 0.01);
  for (var i = s + 1; i < n; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]);
  ctx.stroke();
  return n;
}

/* ---- 그림판 (출제자) ---- */
var CM_COLORS = ['#1d1d1d', '#7a7a7a', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#7cb342', '#1e88e5', '#4dd0e1', '#3949ab', '#8e24aa', '#f06292', '#8d6e63', '#ffcc80'];
function cmSetupPad() {
  if (CM_PAD) { cmPadClear(true); return; }
  var cv = document.getElementById('cm-canvas');
  cv.width = CM_W; cv.height = CM_H;
  CM_PAD = { cv: cv, ctx: cv.getContext('2d'), color: CM_COLORS[0], size: 6, tool: 'pen', cur: null };
  document.getElementById('cm-colors').innerHTML = CM_COLORS.map(function (c, i) {
    return '<button type="button" class="rl-color' + (i === 0 ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '"></button>';
  }).join('');
  document.getElementById('cm-colors').onclick = function (e) {
    var b = e.target.closest('.rl-color'); if (!b) return;
    document.querySelectorAll('#cm-colors .rl-color').forEach(function (x) { x.classList.toggle('on', x === b); });
    CM_PAD.color = b.getAttribute('data-c');
    if (CM_PAD.tool === 'eraser') cmSetTool('pen');
  };
  document.getElementById('cm-modes').onclick = function (e) {
    var b = e.target.closest('[data-tool]'); if (b) cmSetTool(b.getAttribute('data-tool'));
  };
  document.getElementById('cm-sizes').onclick = function (e) {
    var b = e.target.closest('.rl-size'); if (!b) return;
    document.querySelectorAll('#cm-sizes .rl-size').forEach(function (x) { x.classList.toggle('on', x === b); });
    CM_PAD.size = +b.getAttribute('data-s');
  };
  var canDraw = function () { return CM_STATE && CM_STATE.drawer === myPlayerId && CM_STATE.phase === 'draw'; };
  var pos = function (e) { var r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * CM_W / r.width), Math.round((e.clientY - r.top) * CM_H / r.height)]; };
  cv.addEventListener('pointerdown', function (e) {
    if (!canDraw()) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    var p = pos(e);
    if (CM_PAD.tool === 'fill') {
      var o = { k: 'f', c: CM_PAD.color, x: p[0], y: p[1] };
      CM_OPS.push(o); cmApplyOp(o, 0); CM_DIRTY = true; return;
    }
    var er = CM_PAD.tool === 'eraser';
    CM_PAD.cur = { k: 's', c: er ? '#ffffff' : CM_PAD.color, w: er ? CM_PAD.size * 3 : CM_PAD.size, p: [p[0], p[1]] };
    CM_OPS.push(CM_PAD.cur);
    cmApplyOp(CM_PAD.cur, 0);
    CM_DIRTY = true;
  });
  cv.addEventListener('pointermove', function (e) {
    var o = CM_PAD.cur;
    if (!o) return;
    var p = pos(e), n = o.p.length;
    if (Math.abs(p[0] - o.p[n - 2]) + Math.abs(p[1] - o.p[n - 1]) < 2) return;
    o.p.push(p[0], p[1]);
    cmApplyOp(o, o.p.length / 2 - 1);
    CM_DIRTY = true;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { cv.addEventListener(ev, function () { CM_PAD.cur = null; }); });
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || (e.key !== 'z' && e.key !== 'Z')) return;
    if (!document.getElementById('catch').classList.contains('active') || !canDraw()) return;
    e.preventDefault(); cmUndo();
  });
  cmPadClear(true);
}
function cmSetTool(t) {
  CM_PAD.tool = t;
  document.querySelectorAll('#cm-modes [data-tool]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === t); });
  CM_PAD.cv.style.cursor = t === 'fill' ? 'cell' : 'crosshair';
}
function cmPadClear(silent) {
  if (!CM_PAD) return;
  CM_PAD.ctx.fillStyle = '#ffffff';
  CM_PAD.ctx.fillRect(0, 0, CM_W, CM_H);
}
function cmRedrawAll() { cmPadClear(true); CM_OPS.forEach(function (o) { cmApplyOp(o, 0); }); }
function cmUndo() {
  if (!CM_OPS.length) return;
  CM_OPS.pop(); CM_REV++; CM_PAD.cur = null;
  cmRedrawAll(); CM_DIRTY = true;
}
function cmClearAll() {
  if (!CM_STATE || CM_STATE.drawer !== myPlayerId) return;
  CM_OPS = []; CM_REV++; CM_PAD.cur = null;
  cmPadClear(true); CM_DIRTY = true;
}
/* 색 채우기 (모든 화면에서 똑같은 결과가 나오게 같은 방법으로) */
function cmFloodFill(ctx, sx, sy, color) {
  var W = CM_W, H = CM_H;
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  var img = ctx.getImageData(0, 0, W, H), d = img.data;
  var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return;
  var fr = parseInt(m[1], 16), fg = parseInt(m[2], 16), fb = parseInt(m[3], 16);
  var p0 = (sy * W + sx) * 4, tr = d[p0], tg = d[p0 + 1], tb = d[p0 + 2];
  if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 10) return;
  var TOL = 70, seen = new Uint8Array(W * H);
  var match = function (i) { var q = i * 4; return Math.abs(d[q] - tr) + Math.abs(d[q + 1] - tg) + Math.abs(d[q + 2] - tb) <= TOL; };
  var stack = [sy * W + sx], filled = [];
  while (stack.length) {
    var i = stack.pop();
    var y = (i / W) | 0, x = i - y * W;
    while (x > 0 && !seen[i - 1] && match(i - 1)) { x--; i--; }
    var up = false, dn = false;
    for (; x < W && !seen[i] && match(i); x++, i++) {
      seen[i] = 1; filled.push(i);
      if (y > 0) { var u = i - W; if (!seen[u] && match(u)) { if (!up) { stack.push(u); up = true; } } else up = false; }
      if (y < H - 1) { var dd = i + W; if (!seen[dd] && match(dd)) { if (!dn) { stack.push(dd); dn = true; } } else dn = false; }
    }
  }
  var grow = [];
  filled.forEach(function (i) {
    var x = i % W;
    if (x > 0 && !seen[i - 1]) grow.push(i - 1);
    if (x < W - 1 && !seen[i + 1]) grow.push(i + 1);
    if (i >= W && !seen[i - W]) grow.push(i - W);
    if (i < W * (H - 1) && !seen[i + W]) grow.push(i + W);
  });
  filled.concat(grow).forEach(function (i) { var q = i * 4; d[q] = fr; d[q + 1] = fg; d[q + 2] = fb; d[q + 3] = 255; });
  ctx.putImageData(img, 0, 0);
}

function cmSound(kind) {
  if (typeof mmSound !== 'function') return;
  if (kind === 'ok') mmSound('catch');
  else if (kind === 'turn') mmSound('plop');
  else if (kind === 'reveal') mmSound('bubble');
  else if (kind === 'end') mmSound('catch');
}
