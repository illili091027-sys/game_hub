/* ---------------- 째깍째깍 폭탄 돌리기 (온라인, 2~12명) ----------------
   주제가 나오면 폭탄을 든 사람이 주제에 맞는 단어를 빨리 입력 → 폭탄이 다음 사람에게 넘어가요.
   폭탄은 25~60초 사이 아무 때나(아무도 모르는 시간에) 펑! 그때 폭탄을 들고 있던 사람이 벌점 카드 1장.
   - 이미 나온 단어는 다시 못 써요(자동 거절).
   - 엉뚱한 단어는 다른 사람들이 "❌ 인정 못 해!"를 눌러 반대할 수 있고, 절반 이상 반대하면
     그 단어는 취소되고 폭탄이 다시 그 사람에게 돌아가요.
   - 정해진 라운드가 끝나면 벌점 카드가 가장 적은 사람이 승리!
   진행 상태 roomKey('tickbomb')는 방장 + 폭탄 든 사람만 쓰고, 반대표는 각자 roomKey('tb_o_'+id). */
var TB_MIN = 2, TB_MAX = 12, TB_ROUNDS = 5;
var TB_POLL = null;
var TB_STATE = null;
var TB_FOCUS_SIG = '';

function tbKey() { return roomKey('tickbomb'); }
function tbNorm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }
function stopTickBombGame() { clearInterval(TB_POLL); TB_POLL = null; }

function startTickBombGame() {
  stopTickBombGame();
  TB_STATE = null;
  document.querySelectorAll('#tickbomb .tb-phase').forEach(function (el) { el.style.display = 'none'; });
  var n = (roomPlayersList || []).length;
  if (n < TB_MIN || n > TB_MAX) {
    document.getElementById('tb-error').style.display = '';
    document.getElementById('tb-error').textContent = '폭탄 돌리기는 ' + TB_MIN + '~' + TB_MAX + '명이 필요해요. 지금 ' + n + '명이에요.';
    return;
  }
  var starter = myPlayerId === roomHostId ? tbHostInit() : Promise.resolve();
  starter.then(function () { tbPoll(); TB_POLL = setInterval(tbPoll, 600); });
}

function tbPickTopic(st) {
  var list = (typeof TP_TOPICS !== 'undefined') ? TP_TOPICS : ['동물', '과일', '음식'];
  var left = list.filter(function (t) { return (st.usedTopics || []).indexOf(t) === -1; });
  if (!left.length) left = list;
  var t = left[Math.floor(Math.random() * left.length)];
  st.usedTopics = (st.usedTopics || []).concat([t]);
  return t;
}

function tbNewRound(st, holder) {
  st.round = (st.round || 0) + 1;
  st.topic = tbPickTopic(st);
  st.holder = holder;
  st.words = [];
  st.lastWord = null;
  st.phase = 'play';
  st.roundStart = Date.now();
  st.explodeAt = Date.now() + 3000 + (25 + Math.random() * 35) * 1000; // 주제 읽을 3초 + 25~60초
  return st;
}

function tbHostInit() {
  var order = shuffleArray((roomPlayersList || []).map(function (p) { return p.id; }));
  var names = {}, cards = {};
  (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; cards[p.id] = 0; });
  var st = { gameId: Date.now(), order: order, names: names, cards: cards, rounds: TB_ROUNDS, round: 0, usedTopics: [] };
  return DBset(tbKey(), tbNewRound(st, order[0]));
}
function tbHostRestart() { if (myPlayerId === roomHostId) tbHostInit().then(tbPoll); }

function tbNextPid(st, pid) { var i = st.order.indexOf(pid); return st.order[(i + 1) % st.order.length]; }

function tbPoll() {
  DBget(tbKey()).then(function (st) {
    if (!st || !st.order) return;
    TB_STATE = st;
    tbRender(st);
    if (myPlayerId === roomHostId) tbHostCheck(st);
  });
}

function tbHostCheck(st) {
  var now = Date.now();
  if (st.phase === 'play' && now >= st.explodeAt) {
    DBget(tbKey()).then(function (cur) {
      if (!cur || cur.gameId !== st.gameId || cur.phase !== 'play' || cur.round !== st.round) return;
      cur.phase = 'boom';
      cur.loser = cur.holder;
      cur.cards[cur.loser] = (cur.cards[cur.loser] || 0) + 1;
      cur.boomUntil = Date.now() + 5000;
      DBset(tbKey(), cur).then(tbPoll);
    });
    return;
  }
  if (st.phase === 'boom' && now >= st.boomUntil) {
    DBget(tbKey()).then(function (cur) {
      if (!cur || cur.gameId !== st.gameId || cur.phase !== 'boom') return;
      if (cur.round >= cur.rounds) { cur.phase = 'end'; }
      else tbNewRound(cur, cur.loser);
      DBset(tbKey(), cur).then(tbPoll);
    });
    return;
  }
  // 반대표 집계
  if (st.phase === 'play' && st.lastWord) {
    var lw = st.lastWord;
    DBgetPrefix('tb_o_', st.order).then(function (all) {
      var votes = st.order.filter(function (pid) { return pid !== lw.by && all[pid] && all[pid].wordId === lw.id; }).length;
      var need = Math.max(1, Math.ceil((st.order.length - 1) / 2));
      if (votes < need) return;
      DBget(tbKey()).then(function (cur) {
        if (!cur || cur.gameId !== st.gameId || cur.phase !== 'play' || !cur.lastWord || cur.lastWord.id !== lw.id) return;
        cur.words = cur.words.filter(function (w) { return w.id !== lw.id; });
        cur.holder = lw.by;
        cur.rejected = { word: lw.word, by: lw.by, at: Date.now() };
        cur.lastWord = null;
        DBset(tbKey(), cur).then(tbPoll);
      });
    });
  }
}

function tbSubmit() {
  var input = document.getElementById('tb-input');
  var word = input.value.trim().slice(0, 20);
  var err = document.getElementById('tb-err');
  if (!word) return;
  var st = TB_STATE;
  if (!st || st.phase !== 'play' || st.holder !== myPlayerId) return;
  if (st.words.some(function (w) { return tbNorm(w.word) === tbNorm(word); })) { err.textContent = '"' + word + '"은(는) 이미 나왔어요! 다른 단어!'; input.select(); return; }
  err.textContent = '';
  input.value = '';
  DBget(tbKey()).then(function (cur) {
    if (!cur || cur.phase !== 'play' || cur.holder !== myPlayerId || Date.now() >= cur.explodeAt) return;
    if (cur.words.some(function (w) { return tbNorm(w.word) === tbNorm(word); })) { err.textContent = '이미 나온 단어예요!'; return; }
    var w = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), word: word, by: myPlayerId };
    cur.words.push(w);
    cur.lastWord = w;
    cur.holder = tbNextPid(cur, myPlayerId);
    DBset(tbKey(), cur).then(tbPoll);
  });
}

function tbObject() {
  var st = TB_STATE;
  if (!st || !st.lastWord || st.lastWord.by === myPlayerId) return;
  DBset(roomKey('tb_o_' + myPlayerId), { wordId: st.lastWord.id, ts: Date.now() });
  TB_OBJECTED = st.lastWord.id;
  tbRender(st);
}
var TB_OBJECTED = null;

function tbRender(st) {
  if (!document.getElementById('tickbomb').classList.contains('active')) return;
  document.querySelectorAll('#tickbomb .tb-phase').forEach(function (el) { el.style.display = 'none'; });
  var isHost = myPlayerId === roomHostId;
  document.getElementById('tb-topic').textContent = st.topic || '';
  document.getElementById('tb-round').textContent = '라운드 ' + st.round + '/' + st.rounds;
  // 플레이어 원형 배치 + 폭탄 위치
  var n = st.order.length;
  document.getElementById('tb-ring').innerHTML = st.order.map(function (pid, i) {
    var ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    var x = 50 + 40 * Math.cos(ang), y = 50 + 40 * Math.sin(ang);
    var holding = (st.phase === 'play' && st.holder === pid) || (st.phase === 'boom' && st.loser === pid);
    var cards = '';
    for (var k = 0; k < (st.cards[pid] || 0); k++) cards += '🟥';
    return '<div class="tb-seat' + (holding ? ' holding' : '') + (pid === myPlayerId ? ' me' : '') + '" style="left:' + x + '%;top:' + y + '%">' +
      '<div class="tb-seat-name">' + esc(st.names[pid] || '?') + (pid === myPlayerId ? '(나)' : '') + '</div>' +
      '<div class="tb-seat-cards">' + (cards || '&nbsp;') + '</div></div>';
  }).join('');
  var holderIdx = st.order.indexOf(st.phase === 'boom' ? st.loser : st.holder);
  var bomb = document.getElementById('tb-bomb');
  if (holderIdx >= 0) {
    var a = (holderIdx / n) * Math.PI * 2 - Math.PI / 2;
    bomb.style.left = (50 + 22 * Math.cos(a)) + '%';
    bomb.style.top = (50 + 22 * Math.sin(a)) + '%';
  }
  bomb.className = 'tb-bomb' + (st.phase === 'boom' ? ' boom' : ' ticking');
  bomb.textContent = st.phase === 'boom' ? '💥' : '💣';

  if (st.phase === 'play') {
    var mine = st.holder === myPlayerId;
    document.getElementById('tb-play').style.display = '';
    document.getElementById('tb-input-row').style.display = mine ? '' : 'none';
    document.getElementById('tb-holder-msg').innerHTML = mine ? '💣 <b>폭탄이 나한테 있어요!</b> 주제에 맞는 단어를 빨리 쓰고 넘기세요!' : '⏳ <b>' + esc(st.names[st.holder] || '?') + '</b>님이 폭탄을 들고 있어요…';
    document.getElementById('tb-holder-msg').classList.toggle('mine', mine);
    var sig = st.round + ':' + st.holder + ':' + st.words.length;
    if (mine && TB_FOCUS_SIG !== sig) { TB_FOCUS_SIG = sig; setTimeout(function () { var i = document.getElementById('tb-input'); if (i) i.focus(); }, 30); }
    var rej = st.rejected && Date.now() - st.rejected.at < 4000 ? '❌ "' + esc(st.rejected.word) + '"은(는) 인정 안 됐어요! ' + esc(st.names[st.rejected.by] || '') + '님 다시!' : '';
    document.getElementById('tb-rejected').innerHTML = rej;
    var lw = st.lastWord;
    var obBox = document.getElementById('tb-object-box');
    if (lw && lw.by !== myPlayerId) {
      obBox.style.display = '';
      document.getElementById('tb-last-word').innerHTML = '<small>' + esc(st.names[lw.by] || '') + '</small> “' + esc(lw.word) + '”';
      var done = TB_OBJECTED === lw.id;
      var btn = document.getElementById('tb-object-btn');
      btn.disabled = done;
      btn.textContent = done ? '✔ 반대했어요' : '❌ 인정 못 해!';
    } else obBox.style.display = 'none';
    document.getElementById('tb-words').innerHTML = st.words.slice().reverse().map(function (w) { return '<span class="tb-word">' + esc(w.word) + '</span>'; }).join('') || '<span class="tb-word-empty">아직 나온 단어가 없어요</span>';
  } else if (st.phase === 'boom') {
    document.getElementById('tb-boom').style.display = '';
    document.getElementById('tb-boom-msg').innerHTML = '💥 펑!! <b>' + esc(st.names[st.loser] || '?') + '</b>님이 벌점 카드를 받았어요!';
  } else if (st.phase === 'end') {
    document.getElementById('tb-end').style.display = '';
    var ranked = st.order.slice().sort(function (a2, b2) { return (st.cards[a2] || 0) - (st.cards[b2] || 0); });
    var best = st.cards[ranked[0]] || 0;
    var winners = ranked.filter(function (p) { return (st.cards[p] || 0) === best; }).map(function (p) { return st.names[p]; });
    document.getElementById('tb-end-banner').textContent = '🏆 ' + winners.join(', ') + ' 승리! (벌점 ' + best + '장)';
    renderRankBoard('tb-end-rank', ranked.map(function (p) { return { name: st.names[p], isMe: p === myPlayerId, label: '벌점 ' + (st.cards[p] || 0) + '장' }; }));
    document.getElementById('tb-restart-btn').style.display = isHost ? '' : 'none';
  }
}

(function tbSetupInput() {
  var input = document.getElementById('tb-input');
  if (!input) return;
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); tbSubmit(); } });
  input.addEventListener('input', function () { groupHandleTyping(); });
})();
