/* ---------------- 태플 (온라인 전용, 2~10명) ----------------
   주제 카드가 나오면, 차례인 사람이 10초 안에 주제에 맞는 단어를 입력합니다. 그 단어의 첫 글자
   자음(초성) 버튼이 눌리고 다음 사람에게 차례가 넘어갑니다.
   - 이미 눌린 자음으로 시작하는 단어를 내거나, 10초가 지나면 탈락.
   - 주제와 안 맞는 단어는 다른 사람들이 "땡!"을 눌러 이의를 걸 수 있고, 나머지 생존자의 절반
     이상이 땡을 누르면 그 단어를 낸 사람이 탈락(그 자음 버튼은 다시 올라옴).
   - 14개 자음이 모두 눌리면 버튼을 전부 다시 올리고 계속.
   - 라운드에서 끝까지 살아남은 1명이 주제 카드를 가져가고, 카드 3장을 먼저 모으면 우승.
   쌍자음(ㄲ,ㄸ,ㅃ,ㅆ,ㅉ)은 실제 태플처럼 기본 자음 버튼(ㄱ,ㄷ,ㅂ,ㅅ,ㅈ)과 같은 버튼으로 칩니다.
   진행 상태는 roomKey('tapple') 하나, 시간 초과/다음 라운드 자동 진행은 방장 화면이 처리합니다. */
var TP_KEYS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
var TP_CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
var TP_DOUBLE_TO_BASE = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };
var TP_TURN_SECONDS = 10;
var TP_WIN_CARDS = 3;
var TP_MIN_PLAYERS = 2;
var TP_MAX_PLAYERS = 10;
var TP_TOPICS = [
  '동물', '과일', '채소', '나라 이름', '도시 이름', '직업', '음식', '과자·간식', '음료수', '학교에 있는 것',
  '교실에 있는 물건', '부엌에 있는 물건', '탈것', '운동·스포츠', '악기', '몸의 부위', '바다에 사는 것', '하늘을 나는 것', '곤충', '꽃 이름',
  '옷·패션 아이템', '날씨·자연 현상', '가전제품', '문구류', '게임 이름', '만화·애니 캐릭터', '가수·아이돌', '유튜브에서 보는 것', '편의점에서 파는 것', '빨간색인 것',
  '둥근 것', '차가운 것', '뜨거운 것', '무서운 것', '달콤한 것', '시끄러운 것', '작은 것', '큰 것', '냄새나는 것', '반짝이는 것',
  '생일에 받고 싶은 선물', '여행 갈 때 챙기는 것', '캠핑에서 쓰는 것', '놀이공원에 있는 것', '병원에 있는 것', '마트에서 파는 것', '공원에 있는 것', '겨울에 생각나는 것', '여름에 생각나는 것', '아침에 하는 일',
  '한국 음식', '중국집 메뉴', '치킨 브랜드·메뉴', '라면 이름', '아이스크림 이름', '빵 종류', '영화 제목', '드라마 제목', '노래 제목', '브랜드 이름',
  '지하철역 이름', '학교 행사', '교과목·과목 용어', '취미', '감정을 나타내는 말', '의성어·의태어', '동화 속 등장인물', '전설 속 존재', '보석·광물', '나무 이름'
];
var TP_POLL_TIMER = null;
var TP_LAST_SIG = '';

function tpKey() { return roomKey('tapple'); }

function tpChoseongOf(word) {
  var ch = String(word || '').trim().charAt(0);
  var code = ch.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) {
    var cho = TP_CHOSEONG[Math.floor((code - 0xAC00) / 588)];
    return TP_DOUBLE_TO_BASE[cho] || cho;
  }
  if (TP_KEYS.indexOf(ch) !== -1) return null; // 자음만 입력한 경우는 단어로 안 침
  return null;
}

function stopTappleGame() {
  clearInterval(TP_POLL_TIMER);
  TP_POLL_TIMER = null;
}

function startTappleGame() {
  stopTappleGame();
  TP_LAST_SIG = '';
  document.querySelectorAll('#tapple .tp-phase').forEach(function (el) { el.style.display = 'none'; });
  tpBuildWheel();
  var n = (roomPlayersList || []).length;
  if (n < TP_MIN_PLAYERS || n > TP_MAX_PLAYERS) {
    document.getElementById('tp-error-area').style.display = '';
    document.getElementById('tp-error-msg').textContent = '태플은 ' + TP_MIN_PLAYERS + '~' + TP_MAX_PLAYERS + '명이 모여야 할 수 있어요. 지금 방 인원: ' + n + '명.';
    return;
  }
  var starter = (myPlayerId === roomHostId) ? tpHostInit() : Promise.resolve();
  starter.then(function () {
    tpPoll();
    TP_POLL_TIMER = setInterval(tpPoll, 700);
  });
}

function tpPickTopic(s) {
  var left = TP_TOPICS.filter(function (t) { return (s.usedTopics || []).indexOf(t) === -1; });
  if (!left.length) { s.usedTopics = []; left = TP_TOPICS.slice(); }
  var t = left[Math.floor(Math.random() * left.length)];
  s.usedTopics = (s.usedTopics || []).concat([t]);
  return t;
}

function tpStartRound(s, starterPid) {
  s.phase = 'play';
  s.round = (s.round || 0) + 1;
  s.topic = tpPickTopic(s);
  s.alive = s.order.slice();
  s.pressed = [];
  s.turnPid = starterPid || s.order[0];
  s.deadline = Date.now() + (TP_TURN_SECONDS + 3) * 1000; // 첫 차례는 주제 읽을 시간 3초 더
  s.lastWord = null;
  s.log = [];
  s.roundWinner = null;
  s.msg = '';
  return s;
}

function tpHostInit() {
  return DBget(tpKey()).then(function (state) {
    var currentIds = (roomPlayersList || []).map(function (p) { return p.id; }).sort().join(',');
    var existingIds = (state && state.players) ? state.players.map(function (p) { return p.id; }).sort().join(',') : '';
    if (state && state.phase && state.phase !== 'end' && existingIds === currentIds) return;
    var players = roomPlayersList.map(function (p) { return { id: p.id, name: p.name }; });
    var cards = {};
    players.forEach(function (p) { cards[p.id] = 0; });
    var order = shuffleArray(players.map(function (p) { return p.id; }));
    var s = { gameId: Date.now(), players: players, order: order, cards: cards, round: 0, usedTopics: [] };
    return DBset(tpKey(), tpStartRound(s, order[0]));
  });
}

function tpHostRestart() {
  if (myPlayerId !== roomHostId) return;
  DBset(tpKey(), null).then(function () { tpHostInit().then(tpPoll); });
}

function tpName(s, pid) {
  var p = (s.players || []).filter(function (x) { return x.id === pid; })[0];
  return p ? p.name : '?';
}

function tpNextAlive(s, fromPid) {
  var idx = s.order.indexOf(fromPid);
  for (var k = 1; k <= s.order.length; k++) {
    var pid = s.order[(idx + k) % s.order.length];
    if (s.alive.indexOf(pid) !== -1 && pid !== fromPid) return pid;
  }
  return null;
}

function tpLog(s, text, kind) {
  s.log = (s.log || []).concat([{ text: text, kind: kind || '', ts: Date.now() }]).slice(-14);
}

/* 탈락 처리. 지금 차례인 사람이 탈락하면 다음 사람에게 넘기고, 1명만 남으면 라운드 종료. */
function tpEliminate(s, pid, reason) {
  if (s.alive.indexOf(pid) === -1) return;
  var wasTurn = s.turnPid === pid;
  var next = wasTurn ? tpNextAlive(s, pid) : s.turnPid;
  s.alive = s.alive.filter(function (x) { return x !== pid; });
  tpLog(s, '💥 ' + tpName(s, pid) + ' 탈락! (' + reason + ')', 'out');
  if (s.alive.length <= 1) {
    var winner = s.alive[0] || pid;
    s.roundWinner = winner;
    s.cards[winner] = (s.cards[winner] || 0) + 1;
    s.phase = s.cards[winner] >= TP_WIN_CARDS ? 'end' : 'roundEnd';
    s.deadline = s.phase === 'roundEnd' ? Date.now() + 7000 : null;
    s.lastLoser = pid;
    return;
  }
  if (wasTurn) {
    s.turnPid = next;
    s.deadline = Date.now() + TP_TURN_SECONDS * 1000;
  }
}

function tpUpdate(mutator) {
  return DBget(tpKey()).then(function (s) {
    if (!s || !s.phase) return;
    if (mutator(s) === false) return;
    return DBset(tpKey(), s).then(function () { tpRender(s); });
  });
}

function tpSubmitWord() {
  var input = document.getElementById('tp-word-input');
  var word = input.value.trim().slice(0, 20);
  var errEl = document.getElementById('tp-word-err');
  if (!word) return;
  var key = tpChoseongOf(word);
  if (!key) { errEl.textContent = '한글 단어로 입력해주세요. (첫 글자가 한글이어야 해요)'; return; }
  errEl.textContent = '';
  input.value = '';
  tpUpdatePreview();
  tpUpdate(function (s) {
    if (s.phase !== 'play' || s.turnPid !== myPlayerId) return false;
    if (s.pressed.indexOf(key) !== -1) {
      tpLog(s, '“' + word + '” → ' + key + ' 는 이미 눌린 글자!', 'out');
      tpEliminate(s, myPlayerId, '이미 눌린 글자');
      return;
    }
    s.pressed.push(key);
    s.lastWord = { id: Date.now().toString(36), pid: myPlayerId, word: word, key: key, objections: [] };
    tpLog(s, tpName(s, myPlayerId) + ': “' + word + '” (' + key + ')', 'word');
    if (s.pressed.length >= TP_KEYS.length) {
      s.pressed = [];
      tpLog(s, '🔄 자음을 전부 썼어요! 버튼이 모두 다시 올라와요', 'sys');
    }
    s.turnPid = tpNextAlive(s, myPlayerId) || myPlayerId;
    s.deadline = Date.now() + TP_TURN_SECONDS * 1000;
  });
}

function tpObject() {
  tpUpdate(function (s) {
    var lw = s.lastWord;
    if (s.phase !== 'play' || !lw || lw.pid === myPlayerId) return false;
    if (s.alive.indexOf(myPlayerId) === -1) return false;
    if (lw.objections.indexOf(myPlayerId) !== -1) return false;
    lw.objections.push(myPlayerId);
    var judges = s.alive.filter(function (pid) { return pid !== lw.pid; }).length;
    var need = Math.max(1, Math.ceil(judges / 2));
    if (lw.objections.length >= need && !lw.judged) {
      lw.judged = true;
      s.pressed = s.pressed.filter(function (k) { return k !== lw.key; });
      tpLog(s, '🔔 땡! “' + lw.word + '”은(는) 주제와 안 맞대요', 'out');
      tpEliminate(s, lw.pid, '주제와 안 맞음');
    }
  });
}

function tpHostNextRound() {
  if (myPlayerId !== roomHostId) return;
  tpUpdate(function (s) {
    if (s.phase !== 'roundEnd') return false;
    tpStartRound(s, s.lastLoser && s.order.indexOf(s.lastLoser) !== -1 ? s.lastLoser : s.order[0]);
  });
}

function tpHostCheckTimeout(s) {
  if (!s.deadline || Date.now() < s.deadline + 300) return;
  if (s.phase === 'play') {
    var pid = s.turnPid;
    tpUpdate(function (s2) {
      if (s2.phase !== 'play' || s2.turnPid !== pid || Date.now() < s2.deadline + 300) return false;
      tpEliminate(s2, pid, '시간 초과');
    });
  } else if (s.phase === 'roundEnd') {
    tpHostNextRound();
  }
}

function tpPoll() {
  DBget(tpKey()).then(function (s) {
    if (!s || !s.phase) return;
    tpRender(s);
    if (myPlayerId === roomHostId) tpHostCheckTimeout(s);
  });
}

/* ---- 화면 ---- */
function tpBuildWheel() {
  var wheel = document.getElementById('tp-wheel-keys');
  if (wheel.childElementCount) return;
  var html = '';
  TP_KEYS.forEach(function (k, i) {
    var ang = ((i / TP_KEYS.length) * 360 - 90) * Math.PI / 180;
    var left = 50 + 40.5 * Math.cos(ang), top = 50 + 40.5 * Math.sin(ang);
    html += '<div class="tp-key" data-key="' + k + '" style="left:' + left.toFixed(2) + '%;top:' + top.toFixed(2) + '%"><span>' + k + '</span></div>';
  });
  wheel.innerHTML = html;
}

function tpUpdatePreview() {
  var input = document.getElementById('tp-word-input');
  var key = tpChoseongOf(input.value);
  document.querySelectorAll('#tp-wheel-keys .tp-key').forEach(function (el) {
    el.classList.toggle('preview', el.getAttribute('data-key') === key);
  });
  var pv = document.getElementById('tp-preview');
  if (!key) { pv.textContent = ''; return; }
  var used = (window.TP_LAST_STATE && TP_LAST_STATE.pressed || []).indexOf(key) !== -1;
  pv.innerHTML = used ? '⚠️ <b>' + key + '</b> 는 이미 눌렸어요! 이대로 내면 탈락' : '👉 <b>' + key + '</b> 버튼을 누르게 돼요';
  pv.className = 'tp-preview' + (used ? ' bad' : '');
}

var TP_LAST_STATE = null;

function tpRender(s) {
  if (!document.getElementById('tapple').classList.contains('active')) return;
  TP_LAST_STATE = s;
  document.querySelectorAll('#tapple .tp-phase').forEach(function (el) { el.style.display = 'none'; });
  var isHost = myPlayerId === roomHostId;
  var myTurn = s.phase === 'play' && s.turnPid === myPlayerId;
  var amAlive = s.alive.indexOf(myPlayerId) !== -1;
  document.getElementById('tp-main').style.display = s.phase === 'end' ? 'none' : '';

  document.getElementById('tp-topic').textContent = s.topic || '';
  document.getElementById('tp-round').textContent = '라운드 ' + s.round + ' · 카드 ' + TP_WIN_CARDS + '장 먼저 모으면 우승';

  // 자음 휠
  document.querySelectorAll('#tp-wheel-keys .tp-key').forEach(function (el) {
    el.classList.toggle('down', s.pressed.indexOf(el.getAttribute('data-key')) !== -1);
  });
  var remain = s.deadline ? Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000)) : 0;
  var center = document.getElementById('tp-center');
  if (s.phase === 'play') {
    center.innerHTML = '<span class="tp-center-time' + (remain <= 3 ? ' hurry' : '') + '">' + remain + '</span><span class="tp-center-name">' + esc(tpName(s, s.turnPid)) + (myTurn ? '(나)' : '') + '</span>';
  } else {
    center.innerHTML = '<span class="tp-center-name">라운드 끝</span>';
  }

  // 입력
  var inputArea = document.getElementById('tp-input-area');
  var waitEl = document.getElementById('tp-wait');
  if (s.phase === 'play') {
    inputArea.style.display = myTurn ? '' : 'none';
    waitEl.style.display = myTurn ? 'none' : '';
    waitEl.innerHTML = amAlive ? ('⏳ <b>' + esc(tpName(s, s.turnPid)) + '</b>님 차례예요') : '👀 탈락했어요. 다른 사람들을 구경해요!';
    if (myTurn && TP_LAST_SIG !== s.turnPid + ':' + s.deadline) {
      TP_LAST_SIG = s.turnPid + ':' + s.deadline;
      setTimeout(function () { var i = document.getElementById('tp-word-input'); if (i) i.focus(); }, 30);
    }
  } else {
    inputArea.style.display = 'none';
    waitEl.style.display = 'none';
  }

  // 마지막 단어 + 땡
  var lw = s.lastWord;
  var lastBox = document.getElementById('tp-last');
  if (s.phase === 'play' && lw && !lw.judged) {
    lastBox.style.display = '';
    var judges = s.alive.filter(function (pid) { return pid !== lw.pid; }).length;
    var need = Math.max(1, Math.ceil(judges / 2));
    var isMine = lw.pid === myPlayerId;
    var already = lw.objections.indexOf(myPlayerId) !== -1;
    document.getElementById('tp-last-word').innerHTML = '<span class="tp-last-who">' + esc(tpName(s, lw.pid)) + (isMine ? ' (나)' : '') + '</span><span class="tp-last-text">“' + esc(lw.word) + '”</span><span class="tp-last-key">' + lw.key + '</span>';
    var btn = document.getElementById('tp-object-btn');
    btn.style.display = isMine ? 'none' : '';
    btn.disabled = !amAlive || already;
    btn.classList.toggle('pressed', already);
    btn.querySelector('.tp-object-main').textContent = already ? '✔ 땡 눌렀어요' : '🔔 땡!';
    btn.querySelector('.tp-object-sub').textContent = already ? '다른 친구들도 누르면 탈락!' : (amAlive ? '주제랑 안 맞으면 눌러요' : '탈락해서 누를 수 없어요');
    document.getElementById('tp-object-fill').style.width = Math.min(100, (lw.objections.length / need) * 100) + '%';
    document.getElementById('tp-object-count').textContent = isMine
      ? ('내 단어에 땡 ' + lw.objections.length + '/' + need + ' (' + need + '명이 누르면 탈락)')
      : ('땡 ' + lw.objections.length + '/' + need + ' · ' + need + '명이 누르면 ' + tpName(s, lw.pid) + ' 탈락!');
  } else {
    lastBox.style.display = 'none';
  }

  // 플레이어 목록
  document.getElementById('tp-players').innerHTML = s.order.map(function (pid) {
    var alive = s.alive.indexOf(pid) !== -1;
    var cls = 'tp-player' + (alive ? '' : ' out') + (s.phase === 'play' && pid === s.turnPid ? ' turn' : '') + (pid === myPlayerId ? ' me' : '');
    var cards = '';
    for (var i = 0; i < TP_WIN_CARDS; i++) cards += '<span class="tp-card-dot' + (i < (s.cards[pid] || 0) ? ' on' : '') + '"></span>';
    return '<div class="' + cls + '"><span class="tp-player-name">' + esc(tpName(s, pid)) + (pid === myPlayerId ? ' (나)' : '') + '</span><span class="tp-cards">' + cards + '</span></div>';
  }).join('');

  document.getElementById('tp-log').innerHTML = (s.log || []).slice().reverse().map(function (l) {
    return '<div class="tp-log-row ' + l.kind + '">' + esc(l.text) + '</div>';
  }).join('') || '<div class="tp-log-row sys">주제에 맞는 단어를 말하고 버튼을 눌러요!</div>';

  if (s.phase === 'roundEnd') {
    document.getElementById('tp-roundend-area').style.display = '';
    document.getElementById('tp-roundend-msg').innerHTML = '🏆 <b>' + esc(tpName(s, s.roundWinner)) + '</b>님이 끝까지 살아남아 「' + esc(s.topic) + '」 카드를 가져가요!';
    document.getElementById('tp-next-btn').style.display = isHost ? '' : 'none';
    document.getElementById('tp-next-wait').textContent = '잠시 후 다음 라운드가 시작돼요... (' + remain + '초)';
  } else if (s.phase === 'end') {
    document.getElementById('tp-end-area').style.display = '';
    document.getElementById('tp-end-banner').textContent = '👑 ' + tpName(s, s.roundWinner) + ' 우승! (카드 ' + TP_WIN_CARDS + '장)';
    var ranked = s.order.slice().sort(function (a, b) { return (s.cards[b] || 0) - (s.cards[a] || 0); });
    renderRankBoard('tp-end-rank', ranked.map(function (pid) { return { name: tpName(s, pid), isMe: pid === myPlayerId, label: '카드 ' + (s.cards[pid] || 0) + '장' }; }));
    document.getElementById('tp-restart-btn').style.display = isHost ? '' : 'none';
  }
}

(function tpSetupInput() {
  var input = document.getElementById('tp-word-input');
  if (!input) return;
  input.addEventListener('input', function () { tpUpdatePreview(); groupHandleTyping(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); tpSubmitWord(); }
  });
})();
