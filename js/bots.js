/* ===================== 🤖 봇 (방에 혼자 있을 때) =====================
   같이하기(온라인) 게임을 하려는데 방(또는 게임 테이블)에 나 혼자뿐이면, 봇이 자리를 채워 줘요.
   - 봇은 '방장 화면'에서만 움직여요(바퀴 레이스 봇과 같은 방식). 봇 id는 bot1, bot2 … 이고,
     게임 상태 안에서는 진짜 참가자처럼 order / names / 점수판에 들어가요.
   - 봇이 들어가면 재미있는 게임만 골랐어요 (BOT_GAMES):
       얼른 버려! · 상식 끝판왕 · 빙고 대작전
     반대로 봇이 있어도 재미없는 게임은 일부러 뺐어요:
       캐치마인드·엉뚱 그림 릴레이(그림), 양세찬(대화로 추리), 색감과 직감(색 설명),
       폭탄 돌리기·태플(주제 단어 말하기), 땅따먹기·똥벼락(실시간 조종 화면 분리)
     (WASD 대모험·먼작귀·바퀴 레이스는 원래 혼자서도 되거나 이미 자기 봇이 있어요)
   - 친구가 한 명이라도 같이 있으면 봇은 안 들어와요. 다음 판부터 진짜 친구들끼리! */

/* 게임 → 봇 수 */
var BOT_GAMES = { dobble: 2, quiz: 2, bingo: 2 };

/* 봇 성격: 반응 속도(ms 범위), 퀴즈 정답률 */
var BOT_DEFS = [
  { id: 'bot1', name: '🤖 번개봇', dobble: [3200, 5200], quiz: { min: 3500, max: 7500, acc: 0.78 }, bingo: [1500, 3500] },
  { id: 'bot2', name: '🤖 몽글봇', dobble: [4800, 7800], quiz: { min: 5500, max: 11000, acc: 0.62 }, bingo: [2500, 5500] },
  { id: 'bot3', name: '🤖 씽씽봇', dobble: [6500, 9500], quiz: { min: 7000, max: 14000, acc: 0.5 }, bingo: [3000, 7000] }
];

function botIs(pid) { return /^bot\d+$/.test(String(pid || '')); }
function botDef(pid) {
  for (var i = 0; i < BOT_DEFS.length; i++) if (BOT_DEFS[i].id === pid) return BOT_DEFS[i];
  return BOT_DEFS[0];
}
function botSupports(gameId) { return !!BOT_GAMES[gameId]; }
function botRand(range) { return range[0] + Math.random() * (range[1] - range[0]); }

/* 지금 게임에 같이 하는 '사람'이 나 하나뿐이고, 내가 방장(또는 테이블 주인)이면 봇을 채울 수 있어요 */
function botCanFill(gameId) {
  if (playMode !== 'online' || !roomJoined || !botSupports(gameId)) return false;
  var humans = (roomPlayersList || []).filter(function (p) { return !botIs(p.id); });
  return humans.length === 1 && humans[0].id === myPlayerId && myPlayerId === roomHostId;
}
function botExtras(gameId) {
  if (!botCanFill(gameId)) return [];
  return BOT_DEFS.slice(0, BOT_GAMES[gameId]).map(function (d) { return { id: d.id, name: d.name }; });
}
/* 게임 참가 명단: 사람들 + (혼자일 때만) 봇 */
function botRoster(gameId) { return (roomPlayersList || []).concat(botExtras(gameId)); }

/* 로비 안내 문구에 붙일 말 */
function botLobbyHint() {
  var names = {
    dobble: '얼른 버려!', quiz: '상식 끝판왕', bingo: '빙고 대작전'
  };
  return '혼자라면 🤖 봇과 함께: ' + Object.keys(BOT_GAMES).map(function (g) { return names[g]; }).join(' · ');
}

function botNotice(gameId) {
  if (typeof coinToast === 'function') coinToast('🤖 혼자라서 봇이 같이 해요!');
}

/* ---------------------------------------------------------------
   얼른 버려! 봇: 가운데 카드와 맨 위 카드의 같은 그림을 (정해진 시간 뒤에) 눌러요.
   방장 화면이 가짜 '찾았어요'를 만들어 dbHostResolve 의 claims 에 섞어 줘요.
   --------------------------------------------------------------- */
var BOT_DB = { timer: null, claims: {}, plan: {} };

function botDobbleStart() {
  botDobbleStop();
  if (myPlayerId !== roomHostId) return;
  BOT_DB.timer = setInterval(botDobbleTick, 150);
}
function botDobbleStop() {
  clearInterval(BOT_DB.timer); BOT_DB.timer = null;
  BOT_DB.claims = {}; BOT_DB.plan = {};
}
function botDobbleTick() {
  var st = (typeof DB_STATE !== 'undefined') ? DB_STATE : null;
  if (!st || st.phase !== 'play' || myPlayerId !== roomHostId) return;
  var now = Date.now();
  if (now < st.startAt) return;
  st.order.forEach(function (pid) {
    if (!botIs(pid)) return;
    var hand = st.hands[pid];
    if (!hand || !hand.length) return;
    var key = st.gameId + ':' + st.seq;
    var plan = BOT_DB.plan[pid];
    if (!plan || plan.key !== key) plan = BOT_DB.plan[pid] = { key: key, at: now + botRand(botDef(pid).dobble), done: false };
    if (plan.done || now < plan.at) return;
    plan.done = true;
    BOT_DB.claims[pid] = { gameId: st.gameId, seq: st.seq, sym: dbCommon(hand[hand.length - 1], st.center), t: now };
    setTimeout(dbHostResolve, 20);
  });
}
/* dbHostResolve 가 읽은 사람들의 claims 에 봇 claims 를 섞어요 */
function botDobbleClaims(claims) {
  Object.keys(BOT_DB.claims).forEach(function (pid) { claims[pid] = BOT_DB.claims[pid]; });
  return claims;
}

/* ---------------------------------------------------------------
   상식 끝판왕 봇: 문제가 뜨면 잠깐 생각한 뒤, 정답률만큼 맞히고 아니면 '틀림' 표시.
   봇 명단은 퀴즈 상태(state.bots)에 들어 있어서 방장 화면이 움직여요.
   --------------------------------------------------------------- */
var BOT_QZ = { key: null, timers: [] };

function botQuizStop() {
  BOT_QZ.timers.forEach(clearTimeout);
  BOT_QZ.timers = []; BOT_QZ.key = null;
}
function botQuizOnQuestion(state) {
  if (!state || state.answered || !state.bots || !state.bots.length || myPlayerId !== roomHostId) return;
  var key = state.roundId + ':' + state.index;
  if (BOT_QZ.key === key) return;
  botQuizStop();
  BOT_QZ.key = key;
  state.bots.forEach(function (b) {
    var d = botDef(b.id).quiz;
    BOT_QZ.timers.push(setTimeout(function () { botQuizAnswer(b, state.roundId, state.index); }, d.min + Math.random() * (d.max - d.min)));
  });
}
function botQuizAnswer(b, roundId, index) {
  var view = document.getElementById('quiz');
  if (!view || !view.classList.contains('active') || playMode !== 'online' || myPlayerId !== roomHostId) return;
  DBget(roomKey('quiz')).then(function (state) {
    if (!state || !state.questions || state.roundId !== roundId || state.index !== index || state.answered) return;
    if (Math.random() < botDef(b.id).quiz.acc) {
      state.answered = true;
      state.winner = b.name;
      state.leaderboard = state.leaderboard || {};
      state.leaderboard[b.name] = (state.leaderboard[b.name] || 0) + 1;
      DBset(roomKey('quiz'), state).then(function () { applyQuizState(state); });
    } else {
      DBset(qzWrongKey(b.id), { roundId: roundId, index: index, ts: Date.now() });
    }
  });
}

/* ---------------------------------------------------------------
   빙고 대작전 봇: 주제 단어장에서 16칸을 채우고, 자기 차례에 빙고가 잘 되는 단어를 불러요.
   봇 판은 방장 화면이 들고 있다가 roomKey('bg_'+봇id)에 올려요(사람 판과 같은 모양).
   --------------------------------------------------------------- */
var BOT_BG = { m: {}, plan: {}, timers: [] };

function botBingoStop() {
  BOT_BG.timers.forEach(clearTimeout);
  BOT_BG = { m: {}, plan: {}, timers: [] };
}
function botBingoBoard(topic) {
  var pool;
  if (String(topic).indexOf('숫자') === 0) pool = Array.from({ length: 50 }, function (_, i) { return String(i + 1); });
  else pool = (BG_WORDS[topic] || '').split(' ').filter(Boolean);
  return shuffleArray(pool).slice(0, BG_CELLS);
}
function botBingoRecord(b) { return { gameId: b.gameId, cells: b.cells, ready: true, lines: b.lines, callCount: b.callCount }; }

/* bgPoll(방장)이 매번 불러요. 끝나면 Promise 를 줘서 bgHostCheck 가 최신 봇 판을 보게 해요. */
function botBingoStep(st) {
  var bots = (st.order || []).filter(botIs);
  if (!bots.length || myPlayerId !== roomHostId) return Promise.resolve();
  var now = Date.now(), jobs = [];
  bots.forEach(function (pid) {
    var b = BOT_BG.m[pid];
    if (!b || b.gameId !== st.gameId || b.topic !== st.topic) {
      if (b && b.gameId === st.gameId && b.written) jobs.push(DBset(roomKey('bg_' + pid), null));   /* 주제가 바뀜 → 예전 판 지우기 */
      b = BOT_BG.m[pid] = { gameId: st.gameId, topic: st.topic, cells: botBingoBoard(st.topic), written: false, readyAt: now + botRand([2500, 6000]), lines: 0, callCount: 0 };
      delete BOT_BG.plan[pid];
    }
    if (st.phase === 'fill') {
      if (!b.written && now >= b.readyAt) { b.written = true; jobs.push(DBset(roomKey('bg_' + pid), botBingoRecord(b))); }
      return;
    }
    if (!b.written) { b.written = true; jobs.push(DBset(roomKey('bg_' + pid), botBingoRecord(b))); }
    /* 내 판에 체크가 몇 줄인지 알려요 (방장이 이걸 보고 우승을 가려요) */
    var marks = bgMarkedSet(st);
    var lines = bgCountLines(b.cells.map(function (w) { return !!marks[bgNorm(w)]; }));
    if (b.lines !== lines || b.callCount !== st.calls.length) {
      b.lines = lines; b.callCount = st.calls.length;
      jobs.push(DBset(roomKey('bg_' + pid), botBingoRecord(b)));
    }
    /* 내 차례면 잠깐 고민한 뒤 단어를 불러요 */
    if (st.phase === 'play' && st.order[st.turnIdx % st.order.length] === pid) {
      var key = st.gameId + ':' + st.turnIdx;
      if (BOT_BG.plan[pid] !== key) {
        BOT_BG.plan[pid] = key;
        var gid = st.gameId, ti = st.turnIdx;
        BOT_BG.timers.push(setTimeout(function () { botBingoCall(pid, gid, ti); }, botRand(botDef(pid).bingo)));
      }
    }
  });
  return Promise.all(jobs);
}

/* 부를 단어 고르기: 부르면 빙고 줄이 제일 많이 생기는 칸 → 같은 줄에 이미 체크가 많은 칸 순 */
function botBingoPick(cells, marks) {
  var N = BG_N, lineSets = [], r, c, i;
  for (r = 0; r < N; r++) { var row = []; for (c = 0; c < N; c++) row.push(r * N + c); lineSets.push(row); }
  for (c = 0; c < N; c++) { var col = []; for (r = 0; r < N; r++) col.push(r * N + c); lineSets.push(col); }
  var d1 = [], d2 = [];
  for (i = 0; i < N; i++) { d1.push(i * (N + 1)); d2.push(i * N + (N - 1 - i)); }
  lineSets.push(d1, d2);
  var cur = cells.map(function (w) { return !!marks[bgNorm(w)]; });
  var best = null;
  cells.forEach(function (w, idx) {
    if (cur[idx]) return;
    var after = cur.slice(); after[idx] = true;
    var score = bgCountLines(after) * 100 + Math.random() * 3;
    lineSets.forEach(function (ln) {
      if (ln.indexOf(idx) === -1) return;
      var n = ln.filter(function (k) { return after[k]; }).length;
      score += n * n;
    });
    if (!best || score > best.score) best = { word: w, score: score };
  });
  return best ? best.word : null;
}
function botBingoCall(pid, gameId, turnIdx) {
  var view = document.getElementById('bingo');
  if (!view || !view.classList.contains('active') || myPlayerId !== roomHostId) return;
  var b = BOT_BG.m[pid];
  if (!b || b.gameId !== gameId) return;
  DBget(bgKey()).then(function (cur) {
    if (!cur || cur.gameId !== gameId || cur.phase !== 'play' || cur.turnIdx !== turnIdx) return;
    if (cur.order[cur.turnIdx % cur.order.length] !== pid) return;
    var word = botBingoPick(b.cells, bgMarkedSet(cur));
    if (!word) return;   /* 부를 게 없으면 시간이 지나 다음 차례로 넘어가요 */
    cur.calls = (cur.calls || []).concat([{ word: word, by: pid }]);
    cur.turnIdx++;
    cur.deadline = Date.now() + BG_TURN_SECONDS * 1000;
    DBset(bgKey(), cur).then(bgPoll);
  });
}
