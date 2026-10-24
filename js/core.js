// 공용 상태 변수 및 화면 전환/유틸리티 함수
var me = { name: '', room: '' };
var playMode = null;
var pollTimer = null;
var pixelTickTimer = null;
var memoryStore = {};

// 온라인 서버(직접 배포한 내 서버) 연결 상태: 'idle' | 'pending' | 'connected' | 'unavailable'
var cloudStatus = 'idle';
var cloudServerUrl = '';
var cloudCheckToken = 0;

function normalizeServerUrl(url) {
  url = (url || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url.replace(/\/+$/, '');
}
function loadSavedServerUrl() {
  try { return localStorage.getItem('gamehub_server_url') || ''; } catch (e) { return ''; }
}
function saveServerUrl(url) {
  try { localStorage.setItem('gamehub_server_url', url); } catch (e) {}
}

function checkCloudServer(url) {
  var myToken = ++cloudCheckToken;
  if (!url) { cloudStatus = 'idle'; updateIdStatus(); return Promise.resolve(false); }
  cloudStatus = 'pending';
  updateIdStatus();
  return fetch(url + '/api/ping', { cache: 'no-store' }).then(function(r){
    if (myToken !== cloudCheckToken) return false;
    cloudStatus = r.ok ? 'connected' : 'unavailable';
    updateIdStatus();
    return r.ok;
  }).catch(function(){
    if (myToken !== cloudCheckToken) return false;
    cloudStatus = 'unavailable';
    updateIdStatus();
    return false;
  });
}

// key: 'room:' + room + ':' + game
function keyParts(key) {
  var parts = key.split(':');
  return { room: parts[1], game: parts[2] };
}

function DBget(key) {
  if (playMode === 'solo' || cloudStatus !== 'connected' || !cloudServerUrl) {
    return Promise.resolve(memoryStore[key] || null);
  }
  var p = keyParts(key);
  return fetch(cloudServerUrl + '/api/state?room=' + encodeURIComponent(p.room) + '&game=' + encodeURIComponent(p.game), { cache: 'no-store' })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){ return (j && j.data) ? j.data : null; })
    .catch(function(){ return memoryStore[key] || null; });
}
function DBset(key, obj) {
  memoryStore[key] = obj;
  if (playMode === 'solo' || cloudStatus !== 'connected' || !cloudServerUrl) {
    return Promise.resolve(obj);
  }
  var p = keyParts(key);
  return fetch(cloudServerUrl + '/api/state?room=' + encodeURIComponent(p.room) + '&game=' + encodeURIComponent(p.game), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  }).then(function(){ return obj; }).catch(function(){ return obj; });
}

function updateIdStatus() {
  var el = document.getElementById('id-status');
  if (playMode !== 'online') return;
  if (!cloudServerUrl) {
    el.innerHTML = '먼저 <b>서버 주소</b>를 입력해주세요. 서버를 연 친구에게 주소를 물어보세요.';
    return;
  }
  if (cloudStatus === 'pending') {
    el.textContent = '서버에 연결하는 중이에요...';
    return;
  }
  if (cloudStatus === 'unavailable') {
    el.innerHTML = '<b>⚠ 서버 연결 실패</b> - 서버 주소가 맞는지, 서버가 켜져 있는지 확인해주세요. 지금은 나에게만 보이고 친구와 공유되지 않아요.';
    return;
  }
  if (me.name && me.room) {
    el.innerHTML = '<b>' + esc(me.name) + '</b>님, <b>' + esc(me.room) + '</b> 방에서 놀 준비 완료! (서버 연결됨) 게임을 골라보세요.';
  } else {
    el.textContent = '닉네임과 방 코드를 입력하면 게임을 시작할 수 있어요. 방 코드를 친구에게 알려주면 같은 판에서 같이 놀 수 있어요.';
  }
}

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ---------------- 온라인 방 로비(대기실) / 방장 시스템 ---------------- */
var myPlayerId = null;
var roomHostId = null;
var roomCurrentGame = null;
var roomJoined = false;
var roomHeartbeatTimer = null;
var lastAutoEnteredGame = null;
var roomPlayersList = []; // [{id, name}, ...] 방 참가 순서(입장 순서) - 이어쓰기 순서 등에 사용

function getPlayerId() {
  var id = null;
  try { id = localStorage.getItem('gamehub_player_id'); } catch (e) {}
  if (!id) {
    id = 'p' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    try { localStorage.setItem('gamehub_player_id', id); } catch (e) {}
  }
  return id;
}

function joinRoom() {
  if (!cloudServerUrl) { flashField('in-server'); return; }
  if (!me.name) { flashField('in-name'); return; }
  if (!me.room) { flashField('in-room'); return; }
  if (cloudStatus !== 'connected') { flashField('in-server'); return; }
  myPlayerId = getPlayerId();
  fetch(cloudServerUrl + '/api/room/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: me.room, playerId: myPlayerId, name: me.name })
  }).then(function (r) { return r.json(); }).then(function (state) {
    roomJoined = true;
    lastAutoEnteredGame = null;
    document.getElementById('btn-join-room').style.display = 'none';
    document.getElementById('lobby-panel').style.display = '';
    document.getElementById('in-name').disabled = true;
    document.getElementById('in-room').disabled = true;
    document.getElementById('in-server').disabled = true;
    applyRoomState(state);
    clearInterval(roomHeartbeatTimer);
    roomHeartbeatTimer = setInterval(roomHeartbeat, 1500);
    startGroupWidget();
  }).catch(function () {
    alert('방 입장에 실패했어요. 서버 주소가 맞는지 확인해주세요.');
  });
}

function roomHeartbeat() {
  if (!roomJoined || !cloudServerUrl || !myPlayerId) return;
  fetch(cloudServerUrl + '/api/room/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: me.room, playerId: myPlayerId })
  }).then(function (r) { return r.json(); }).then(applyRoomState).catch(function () {});
}

function applyRoomState(state) {
  if (!state || !state.players) return;
  var amInRoom = state.players.some(function (p) { return p.id === myPlayerId; });
  if (!amInRoom) {
    clearInterval(roomHeartbeatTimer);
    roomJoined = false;
    alert('방장에 의해 추방되었어요.');
    backToModeSelect();
    return;
  }
  roomHostId = state.hostId;
  roomCurrentGame = state.currentGame;
  roomPlayersList = state.players;
  var amHost = (myPlayerId === roomHostId);
  renderLobbyPlayers(state.players);
  /* 예전엔 방장이 아니면 카드 목록(#card-grid) 전체를 통째로 숨겼는데, 그 안에는 방장만
     고를 수 있는 게임 카드들뿐 아니라 0번 채널 라운지 카드도 같이 들어있어서, 결과적으로
     방장이 아닌 사람은 채널 라운지조차 못 여는 버그가 있었습니다(채널 라운지는 애초에
     방장이 골라야 들어가는 게임이 아니라 다같이 자유롭게 여닫는 화면이라 이러면 안 됨).
     이제는 카드 목록 자체는 항상 보여주고, 방장만 고를 수 있는 "진짜 게임" 카드들만 흐리게
     표시해서(클릭해도 hostSelectGame에서 막힘) 채널 라운지는 누구나 항상 쓸 수 있습니다. */
  document.getElementById('card-grid').style.display = '';
  document.querySelectorAll('#card-grid .game-card').forEach(function (card) {
    if (card.id === 'card-channels') { card.classList.remove('disabled'); return; }
    card.classList.toggle('disabled', !amHost);
  });
  document.getElementById('lobby-hint').textContent = amHost
    ? '아래에서 같이 할 게임을 골라주세요. (0번 채널 라운지는 누구나 자유롭게 열 수 있어요)'
    : '채널 라운지(0번)는 자유롭게 쓸 수 있어요. 다른 게임은 방장이 고르면 같이 시작돼요.';
  var activeView = document.querySelector('.view.active');
  var activeIsHome = activeView && activeView.id === 'home';
  if (roomCurrentGame) {
    if (activeIsHome && roomCurrentGame !== lastAutoEnteredGame) {
      enterGame(roomCurrentGame);
    }
  } else {
    lastAutoEnteredGame = null;
    /* 0번 채널 라운지는 방장이 골라서 다같이 들어가는 "게임"이 아니라 각자 자유롭게
       여닫는 화면이라 roomCurrentGame과 무관합니다. 이 조건에서 제외하지 않으면,
       방장이 게임을 아직 안 고른 상태(roomCurrentGame이 비어있음)에서 채널 라운지를
       열어도 하트비트가 돌 때마다(1.5~2초마다) "게임이 선택 안 됨 = 다들 홈으로"로
       착각해서 자꾸 홈으로 튕겨나가는 문제가 있었습니다. */
    if (activeView && activeView.id !== 'home' && activeView.id !== 'channels') {
      clearInterval(pollTimer);
      clearInterval(pixelTickTimer);
      document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
      document.getElementById('home').classList.add('active');
    }
  }
}

function renderLobbyPlayers(players) {
  var el = document.getElementById('lobby-players');
  var amHost = (myPlayerId === roomHostId);
  var html = players.map(function (p) {
    var isHost = p.id === roomHostId;
    var isMe = p.id === myPlayerId;
    var row = '<div class="lobby-player" style="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:6px 0;">';
    row += '<span>' + (isHost ? '👑 ' : '') + esc(p.name) + (isMe ? ' (나)' : '') + '</span>';
    if (amHost && !isMe) {
      row += '<span>' +
        '<button class="btn btn-ghost" onclick="delegateHost(\'' + p.id + '\')">위임</button> ' +
        '<button class="btn btn-ghost" onclick="kickPlayer(\'' + p.id + '\')">추방</button>' +
        '</span>';
    }
    row += '</div>';
    return row;
  }).join('');
  el.innerHTML = html || '<div class="story-empty">아무도 없어요</div>';
}

function hostSelectGame(gameId) {
  if (myPlayerId !== roomHostId || !cloudServerUrl) return;
  fetch(cloudServerUrl + '/api/room/select-game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: me.room, playerId: myPlayerId, game: gameId })
  }).then(function (r) { return r.json(); }).then(applyRoomState).catch(function () {});
}

function cardClicked(gameId) {
  if (playMode === 'online' && roomJoined) {
    hostSelectGame(gameId);
  } else {
    enterGame(gameId);
  }
}

function kickPlayer(targetId) {
  if (!cloudServerUrl) return;
  fetch(cloudServerUrl + '/api/room/kick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: me.room, hostId: myPlayerId, targetId: targetId })
  }).then(function (r) { return r.json(); }).then(applyRoomState).catch(function () {});
}

function delegateHost(targetId) {
  if (!cloudServerUrl) return;
  fetch(cloudServerUrl + '/api/room/delegate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: me.room, hostId: myPlayerId, targetId: targetId })
  }).then(function (r) { return r.json(); }).then(applyRoomState).catch(function () {});
}

function leaveRoomLocal() {
  clearInterval(roomHeartbeatTimer);
  stopGroupWidget();
  stopGameMembersBar();
  chLeaveCurrentChannel();
  clearInterval(CH_LIST_POLL_TIMER);
  if (roomJoined && cloudServerUrl && myPlayerId) {
    fetch(cloudServerUrl + '/api/room/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: me.room, playerId: myPlayerId }),
      keepalive: true
    }).catch(function () {});
  }
  roomJoined = false;
  roomHostId = null;
  roomCurrentGame = null;
  lastAutoEnteredGame = null;
  document.getElementById('lobby-panel').style.display = 'none';
  document.getElementById('btn-join-room').style.display = playMode === 'online' ? '' : 'none';
  document.getElementById('in-name').disabled = false;
  document.getElementById('in-room').disabled = false;
  document.getElementById('in-server').disabled = false;
}

function randRoomCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

document.getElementById('in-room').value = randRoomCode();
document.getElementById('in-server').value = loadSavedServerUrl() || 'https://gamehub-server-tfu5.onrender.com';
document.getElementById('in-name').addEventListener('input', function(e){ me.name = e.target.value.trim(); updateIdStatus(); });
document.getElementById('in-room').addEventListener('input', function(e){ me.room = e.target.value.trim().toUpperCase(); e.target.value = me.room; updateIdStatus(); });
var serverInputDebounce = null;
document.getElementById('in-server').addEventListener('input', function(e){
  var raw = e.target.value;
  clearTimeout(serverInputDebounce);
  serverInputDebounce = setTimeout(function(){
    var url = normalizeServerUrl(raw);
    cloudServerUrl = url;
    saveServerUrl(url);
    checkCloudServer(url);
  }, 500);
});
document.getElementById('in-server').addEventListener('blur', function(e){
  clearTimeout(serverInputDebounce);
  var url = normalizeServerUrl(e.target.value);
  e.target.value = url;
  cloudServerUrl = url;
  saveServerUrl(url);
  checkCloudServer(url);
});
if (document.getElementById('in-server').value) {
  cloudServerUrl = normalizeServerUrl(document.getElementById('in-server').value);
}

/* 온라인에서만 할 수 있는 게임 카드들 - 혼자하기에서는 숨깁니다.
   예전엔 카드마다 따로 style.display를 껐다 켰다 해서, 새 온라인 전용 게임을 추가할 때마다
   "온라인 모드로 다시 보이게 하는 줄"을 깜빡하기 쉬웠습니다(실제로 findx가 이 버그를 겪었음).
   지금은 배열 하나로 관리해서 새 온라인 전용 게임은 이 배열에만 추가하면 됩니다. */
var ONLINE_ONLY_CARD_IDS = ['card-channels', 'card-sudoku', 'card-bomb', 'card-quiz', 'card-mafia', 'card-werewolf', 'card-hues', 'card-tapple'];
/* 반대로 혼자하기에서만 할 수 있는 게임 카드들 - 온라인에서는 숨깁니다.
   (2026-10-24: 혼자하기 모드는 영어 낱말 찾기 전용으로 정리 - 나머지 게임은 온라인에서만) */
var SOLO_ONLY_CARD_IDS = ['card-wordsearch'];

function chooseMode(mode) {
  playMode = mode;
  document.getElementById('mode-select').style.display = 'none';
  document.getElementById('mode-back').style.display = '';
  document.getElementById('home-footer').style.display = '';
  if (mode === 'solo') {
    me.name = '나';
    me.room = 'solo-' + Math.random().toString(36).slice(2, 8);
    /* 혼자하기에서는 방 개념이 없지만, 반쪽 단어 챌린지처럼 "참가 순서" 기반 로직을 쓰는
       게임이 혼자서도 자연스럽게(항상 내 차례) 동작하도록 나 혼자만 있는 가짜 방 인원을 만들어둡니다. */
    myPlayerId = 'solo-player';
    roomHostId = 'solo-player';
    roomPlayersList = [{ id: 'solo-player', name: '나' }];
    document.getElementById('card-grid').style.display = '';
    document.getElementById('btn-join-room').style.display = 'none';
    document.getElementById('lobby-panel').style.display = 'none';
    document.getElementById('online-id-box').style.display = 'none';
    document.getElementById('id-status').style.display = 'none';
    document.getElementById('home-footer').textContent = '혼자 하기 모드예요. 기록은 저장되지 않고 이 화면을 나가면 사라져요.';
    ONLINE_ONLY_CARD_IDS.forEach(function (id) { document.getElementById(id).style.display = 'none'; });
    SOLO_ONLY_CARD_IDS.forEach(function (id) { document.getElementById(id).style.display = ''; });
    renumberGameCards();
  } else {
    document.getElementById('card-grid').style.display = 'none';
    document.getElementById('btn-join-room').style.display = '';
    document.getElementById('lobby-panel').style.display = 'none';
    document.getElementById('online-id-box').style.display = '';
    document.getElementById('id-status').style.display = '';
    document.getElementById('home-footer').textContent = '닉네임, 방 코드, 서버 주소를 입력하고 "입장하기"를 누르면 대기실로 들어가요. 같은 방 코드로 들어온 친구들과 함께, 방장이 고른 게임을 같이 즐길 수 있어요.';
    ONLINE_ONLY_CARD_IDS.forEach(function (id) { document.getElementById(id).style.display = ''; });
    SOLO_ONLY_CARD_IDS.forEach(function (id) { document.getElementById(id).style.display = 'none'; });
    renumberGameCards();
    me.room = document.getElementById('in-room').value;
    me.name = document.getElementById('in-name').value.trim();
    cloudServerUrl = normalizeServerUrl(document.getElementById('in-server').value);
    updateIdStatus();
    if (cloudServerUrl) checkCloudServer(cloudServerUrl);
  }
}

/* 혼자하기/온라인 각각 특정 게임 카드가 숨겨지다 보니, 카드에 원래 박혀 있던 고정 번호로
   보면 화면에 보이는 순서가 1,2,3...으로 안 이어지고 중간이 뜨문뜨문 비어 보이는 문제가
   있었습니다("숫자 정렬이 안 맞음"). 그래서 모드를 고를 때마다 지금 실제로 화면에 보이는
   카드만 순서대로 다시 세어서 번호를 새로 매깁니다. 0번 채널 라운지는 게임이 아니라 항상
   0번 고정이라 이 번호 매기기에서 제외합니다. */
function renumberGameCards() {
  var cards = document.querySelectorAll('#card-grid .game-card');
  var n = 1;
  cards.forEach(function (card) {
    if (card.id === 'card-channels') return;
    if (card.style.display === 'none') return;
    var iconEl = card.querySelector('.game-icon');
    if (iconEl) iconEl.textContent = String(n);
    n++;
  });
}

function backToModeSelect() {
  document.getElementById('rules-overlay').style.display = 'none';
  RULES_PENDING_START = null;
  RULES_PENDING_GAME = null;
  RULES_STARTED = false;
  clearInterval(RULES_READY_POLL_TIMER);
  leaveRoomLocal();
  document.getElementById('mode-select').style.display = '';
  document.getElementById('mode-back').style.display = 'none';
  document.getElementById('card-grid').style.display = 'none';
  document.getElementById('btn-join-room').style.display = 'none';
  document.getElementById('lobby-panel').style.display = 'none';
  document.getElementById('online-id-box').style.display = 'none';
  document.getElementById('id-status').style.display = 'none';
  document.getElementById('home-footer').style.display = 'none';
  playMode = null;
}

var ONLINE_ONLY_GAME_IDS = ['sudoku', 'bomb', 'quiz', 'mafia', 'werewolf', 'hues', 'tapple'];
var SOLO_ONLY_GAME_IDS = ['wordsearch'];

/* 온라인에서 방장이 게임을 골라 들어가면 멤버들은 카드에 있던 설명(게임 방법)을 볼 기회 없이
   바로 게임 화면으로 들어가버리는 문제가 있었습니다. 그래서 온라인 모드에서는 실제 게임 로직을
   시작하기 전에 항상 이 규칙 안내 화면을 한 번 보여줍니다.
   3단계 개선: 예전엔 "시작하기!"를 누르면 그 사람 화면에서만 바로 시작돼서, 누구는 벌써
   게임 중인데 누구는 아직 설명을 보고 있는 상황이 생겼습니다. 이제는 버튼을 누르면 "준비
   완료"로 표시만 되고, 방에 있는 모두가 준비를 마쳐야 다 같이 동시에 시작됩니다(서버에
   공유되는 roomKey('gamestart_ready') 상태로 누가 준비됐는지 세어봅니다). 방장은 누군가
   반응이 없을 때를 대비해 "그냥 바로 시작하기" 버튼으로 강제 시작할 수 있습니다. */
var RULES_PENDING_START = null;
var RULES_PENDING_GAME = null;
var RULES_STARTED = false;
var RULES_READY_POLL_TIMER = null;

function rulesReadyKey() { return roomKey('gamestart_ready'); }

/* 설명서(페이지 넘김) - manuals.js의 GAME_MANUALS를 한 장씩 보여줍니다.
   RULES_MODE: 'online'(다같이 준비 완료) | 'solo'(바로 시작하기) | 'manual'(홈에서 우클릭으로 보기만) */
var RULES_MODE = 'online';
var RULES_PAGE = 0;
var RULES_MANUAL_ID = null;

function rulesRenderPage() {
  var man = (typeof GAME_MANUALS !== 'undefined') ? GAME_MANUALS[RULES_MANUAL_ID] : null;
  var pages = man ? man.pages : [];
  var textEl = document.getElementById('rules-text');
  if (!pages.length) {
    var descEl = document.getElementById('desc-' + RULES_MANUAL_ID);
    textEl.innerHTML = '<div class="rules-page-body"><p>' + esc(descEl ? descEl.textContent : '') + '</p></div>';
    document.getElementById('rules-dots').innerHTML = '';
    document.getElementById('rules-prev').style.visibility = 'hidden';
    document.getElementById('rules-next').style.visibility = 'hidden';
    return;
  }
  RULES_PAGE = Math.max(0, Math.min(pages.length - 1, RULES_PAGE));
  var pg = pages[RULES_PAGE];
  textEl.innerHTML = '<div class="rules-page-head"><span class="rules-page-icon">' + pg.icon + '</span><span class="rules-page-title">' + pg.title + '</span><span class="rules-page-num">' + (RULES_PAGE + 1) + ' / ' + pages.length + '</span></div>' +
    '<ul class="rules-page-body">' + pg.lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>';
  document.getElementById('rules-dots').innerHTML = pages.map(function (_, i) {
    return '<button class="rules-dot' + (i === RULES_PAGE ? ' on' : '') + '" onclick="rulesGoPage(' + (i - RULES_PAGE) + ')" aria-label="' + (i + 1) + '쪽"></button>';
  }).join('');
  document.getElementById('rules-prev').style.visibility = RULES_PAGE > 0 ? 'visible' : 'hidden';
  document.getElementById('rules-next').style.visibility = RULES_PAGE < pages.length - 1 ? 'visible' : 'hidden';
}

function rulesGoPage(delta) {
  RULES_PAGE += delta;
  rulesRenderPage();
}

function rulesOpenBox(gameId) {
  var man = (typeof GAME_MANUALS !== 'undefined') ? GAME_MANUALS[gameId] : null;
  var nameEl = document.querySelector('#card-' + gameId + ' .game-name');
  RULES_MANUAL_ID = gameId;
  RULES_PAGE = 0;
  document.getElementById('rules-title').textContent = man ? man.name : (nameEl ? nameEl.textContent : '');
  document.getElementById('rules-tag').textContent = man ? man.tag : '';
  rulesRenderPage();
  document.getElementById('rules-overlay').style.display = 'flex';
}

function showGameRulesOverlay(gameId, onStart) {
  RULES_MODE = playMode === 'online' ? 'online' : 'solo';
  rulesOpenBox(gameId);
  var btn = document.getElementById('rules-ready-btn');
  btn.style.display = '';
  btn.disabled = false;
  btn.textContent = RULES_MODE === 'solo' ? '시작하기!' : '준비 완료!';
  document.getElementById('rules-close-btn').style.display = 'none';
  document.getElementById('rules-wait-msg').textContent = '';
  document.getElementById('rules-wait-msg').style.display = RULES_MODE === 'online' ? '' : 'none';
  document.getElementById('rules-force-btn').style.display = (RULES_MODE === 'online' && myPlayerId === roomHostId) ? '' : 'none';
  RULES_PENDING_START = onStart;
  RULES_PENDING_GAME = gameId;
  RULES_STARTED = false;
  clearInterval(RULES_READY_POLL_TIMER);
  if (RULES_MODE === 'online') {
    RULES_READY_POLL_TIMER = setInterval(function () { rulesCheckReady(gameId); }, 500);
    rulesCheckReady(gameId);
  }
}

/* 홈에서 카드 우클릭(휴대폰은 길게 누르기) → 설명서만 보기 */
function showGameManual(gameId) {
  if (document.getElementById('rules-overlay').style.display === 'flex' && RULES_MODE !== 'manual') return;
  RULES_MODE = 'manual';
  rulesOpenBox(gameId);
  document.getElementById('rules-ready-btn').style.display = 'none';
  document.getElementById('rules-force-btn').style.display = 'none';
  document.getElementById('rules-wait-msg').style.display = 'none';
  document.getElementById('rules-close-btn').style.display = '';
}

function closeGameManual() {
  if (RULES_MODE !== 'manual') return;
  document.getElementById('rules-overlay').style.display = 'none';
}

(function rulesSetupInteractions() {
  var overlay = document.getElementById('rules-overlay');
  var grid = document.getElementById('card-grid');
  document.addEventListener('keydown', function (e) {
    if (overlay.style.display !== 'flex') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); rulesGoPage(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); rulesGoPage(1); }
    else if (e.key === 'Escape') closeGameManual();
  });
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeGameManual(); });
  // 휴대폰에서 좌우로 밀어서 넘기기
  var page = document.getElementById('rules-text');
  var sx = null;
  page.addEventListener('pointerdown', function (e) { sx = e.clientX; });
  page.addEventListener('pointerup', function (e) {
    if (sx === null) return;
    var dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 45) rulesGoPage(dx < 0 ? 1 : -1);
  });
  if (!grid) return;
  function cardIdOf(target) {
    var card = target.closest && target.closest('.game-card');
    return card ? card.id.replace(/^card-/, '') : null;
  }
  grid.addEventListener('contextmenu', function (e) {
    var id = cardIdOf(e.target);
    if (!id) return;
    e.preventDefault();
    showGameManual(id);
  });
  // 길게 누르기(터치) - iOS는 contextmenu가 안 떠서 직접 처리
  var pressTimer = null, pressFired = false, startPt = null;
  grid.addEventListener('touchstart', function (e) {
    var id = cardIdOf(e.target);
    if (!id) return;
    pressFired = false;
    startPt = e.touches[0] ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(function () { pressFired = true; showGameManual(id); }, 550);
  }, { passive: true });
  grid.addEventListener('touchmove', function (e) {
    if (!startPt || !e.touches[0]) return;
    if (Math.abs(e.touches[0].clientX - startPt.x) + Math.abs(e.touches[0].clientY - startPt.y) > 12) clearTimeout(pressTimer);
  }, { passive: true });
  grid.addEventListener('touchend', function () { clearTimeout(pressTimer); }, { passive: true });
  grid.addEventListener('click', function (e) {
    if (pressFired) { pressFired = false; e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }
  }, true);
})();

function dismissRulesOverlay() {
  if (RULES_MODE === 'solo') { rulesStartNow(); return; }
  if (RULES_MODE === 'manual') { closeGameManual(); return; }
  var btn = document.getElementById('rules-ready-btn');
  btn.disabled = true;
  btn.textContent = '준비 완료! 다른 사람을 기다리는 중...';
  var gameId = RULES_PENDING_GAME;
  DBget(rulesReadyKey()).then(function (state) {
    if (!state || state.game !== gameId) state = { game: gameId, readyIds: [] };
    state.readyIds = state.readyIds || [];
    if (state.readyIds.indexOf(myPlayerId) === -1) state.readyIds.push(myPlayerId);
    DBset(rulesReadyKey(), state).then(function () { rulesCheckReady(gameId); });
  });
}

function rulesCheckReady(gameId) {
  if (RULES_STARTED || gameId !== RULES_PENDING_GAME) return;
  DBget(rulesReadyKey()).then(function (state) {
    if (RULES_STARTED || gameId !== RULES_PENDING_GAME) return;
    var ids = (roomPlayersList || []).map(function (p) { return p.id; });
    var sameGame = state && state.game === gameId;
    var readyIds = (sameGame && state.readyIds) || [];
    var readyCount = ids.filter(function (id) { return readyIds.indexOf(id) !== -1; }).length;
    var waitMsg = document.getElementById('rules-wait-msg');
    if (waitMsg) waitMsg.textContent = ids.length ? ('(' + readyCount + '/' + ids.length + '명 준비 완료)') : '';
    var allReady = (sameGame && state.forceStarted) || (ids.length > 0 && ids.every(function (id) { return readyIds.indexOf(id) !== -1; }));
    if (allReady) rulesStartNow();
  });
}

function rulesStartNow() {
  if (RULES_STARTED) return;
  RULES_STARTED = true;
  clearInterval(RULES_READY_POLL_TIMER);
  document.getElementById('rules-overlay').style.display = 'none';
  var fn = RULES_PENDING_START;
  RULES_PENDING_START = null;
  RULES_PENDING_GAME = null;
  if (fn) fn();
}

/* 방장 전용: 아직 준비 안 된 사람이 있어도 그냥 다 같이 시작시킵니다(누군가 자리를 비웠을 때 등). */
function rulesForceStart() {
  if (myPlayerId !== roomHostId || !RULES_PENDING_GAME) return;
  var gameId = RULES_PENDING_GAME;
  DBget(rulesReadyKey()).then(function (state) {
    state = (state && state.game === gameId) ? state : { game: gameId, readyIds: [] };
    state.forceStarted = true;
    DBset(rulesReadyKey(), state);
  });
  rulesStartNow();
}

function enterGame(gameId) {
  if (ONLINE_ONLY_GAME_IDS.indexOf(gameId) !== -1 && playMode === 'solo') return;
  if (SOLO_ONLY_GAME_IDS.indexOf(gameId) !== -1 && playMode === 'online') return;
  if (playMode === 'online') {
    if (!me.name) { flashField('in-name'); return; }
    if (!me.room) { flashField('in-room'); return; }
  }
  document.querySelectorAll('.view').forEach(function(v){ v.classList.remove('active'); });
  document.getElementById(gameId).classList.add('active');
  var PILL_IDS = { sudoku: 'sd-room-pill', bomb: 'bm-room-pill', quiz: 'qz-room-pill', mafia: 'mf-room-pill', werewolf: 'ww-room-pill', hues: 'hu-room-pill', wordsearch: 'ws-room-pill', tapple: 'tp-room-pill', baby: 'bb-room-pill' };
  var pillId = PILL_IDS[gameId];
  if (pillId && document.getElementById(pillId)) {
    document.getElementById(pillId).textContent = playMode === 'solo' ? '혼자 하기' : (me.room + ' 방');
  }
  clearInterval(pollTimer);
  clearInterval(pixelTickTimer);
  var startFn = function () {
    if (gameId === 'sudoku') startSudokuGame();
    else if (gameId === 'bomb') startBombGame();
    else if (gameId === 'quiz') startQuiz();
    else if (gameId === 'mafia') startMafiaGame();
    else if (gameId === 'werewolf') startWerewolfGame();
    else if (gameId === 'hues') startHuesGame();
    else if (gameId === 'tapple') startTappleGame();
    else if (gameId === 'baby') startBabyGame();
    else if (gameId === 'wordsearch') startWordSearch();
    lastAutoEnteredGame = gameId;
  };
  if (playMode === 'online') {
    startGameMembersBar();
    showGameRulesOverlay(gameId, startFn);
  } else {
    stopGameMembersBar();
    showGameRulesOverlay(gameId, startFn);
  }
}

/* ---------------- 홈으로 나가면 그 게임의 방(온라인 공유) 진행 상황 초기화 ---------------- */
/* 예전에는 게임 중간에 홈으로 나가도 서버/메모리에 저장된 진행 상황이 그대로 남아있어서,
   나중에 그 게임에 다시 들어오면(나든 다른 사람이든) 누군가 두다 만 중간 상태를 이어받는
   문제가 있었습니다. 이제는 누구든 홈으로 나가는 순간 그 방에서 하던 그 게임의 공유 상태를
   지워서, 다음에 들어올 땐 항상 처음부터 새로 시작합니다. */
var GAME_ROOM_STATE_KEYS = {
  sudoku: ['sudoku'],
  quiz: ['quiz'],
  mafia: ['mafia'],
  werewolf: ['werewolf'],
  hues: ['hues'],
  tapple: ['tapple']
};
var GAME_PER_PLAYER_STATE_KEYS = {
  bomb: 'bomb_p_',
  baby: 'baby_p_'
};
var GAME_VOTE_KEYS = ['sudoku'];

function resetGameRoomState(gameId) {
  if (playMode !== 'online' || !me.room) return;
  var fixedKeys = GAME_ROOM_STATE_KEYS[gameId];
  if (fixedKeys) fixedKeys.forEach(function (k) { DBset(roomKey(k), null); });
  var perPlayerPrefix = GAME_PER_PLAYER_STATE_KEYS[gameId];
  if (perPlayerPrefix) {
    (roomPlayersList || []).forEach(function (p) { DBset(roomKey(perPlayerPrefix + p.id), null); });
  }
  if (GAME_VOTE_KEYS.indexOf(gameId) !== -1) DBset(ctVoteKey(gameId), null);
}

function goHome() {
  var activeView = document.querySelector('.view.active');
  var leavingGameId = (activeView && activeView.id !== 'home') ? activeView.id : null;
  clearInterval(pollTimer);
  clearInterval(pixelTickTimer);
  stopSudokuTimer();
  stopBombGame();
  clearInterval(QZ_TIMER_INTERVAL);
  clearTimeout(QZ_ADVANCE_TIMER);
  stopMafiaGame();
  stopWerewolfGame();
  stopHuesGame();
  stopTappleGame();
  stopBabyGame();
  stopWordSearch();
  if (typeof SD_VOTE_STOP === 'function') { SD_VOTE_STOP(); SD_VOTE_STOP = null; }
  document.getElementById('rules-overlay').style.display = 'none';
  RULES_PENDING_START = null;
  RULES_PENDING_GAME = null;
  RULES_STARTED = false;
  clearInterval(RULES_READY_POLL_TIMER);
  document.querySelectorAll('.view').forEach(function(v){ v.classList.remove('active'); });
  document.getElementById('home').classList.add('active');
  stopGameMembersBar();
  if (leavingGameId) resetGameRoomState(leavingGameId);
  if (playMode === 'online' && me.room) DBset(rulesReadyKey(), null);
  if (playMode === 'online' && roomJoined && myPlayerId === roomHostId && roomCurrentGame) {
    hostSelectGame(null);
  }
}

function flashField(id) {
  var el = document.getElementById(id);
  el.style.borderBottomColor = '#F2836B';
  el.focus();
  setTimeout(function(){ el.style.borderBottomColor = ''; }, 900);
}

function roomKey(game) { return 'room:' + me.room + ':' + game; }

/* ---------------- 공용: 순위(1등/2등/3등) 리더보드 렌더링 ---------------- */
var RANK_MEDALS = ['🥇', '🥈', '🥉'];

/* entries: [{ name, isMe, label }], 이미 원하는 순서(1등부터)로 정렬돼 있어야 합니다. */
function renderRankBoard(panelId, entries) {
  var panel = document.getElementById(panelId);
  if (!panel) return;
  if (!entries || !entries.length) { panel.innerHTML = '<div class="lobby-hint">아직 참가자가 없어요.</div>'; return; }
  var html = entries.map(function (e, i) {
    var rankLabel = i < 3 ? RANK_MEDALS[i] : (i + 1) + '등';
    return '<div class="rank-row' + (e.isMe ? ' rank-row-me' : '') + '">' +
      '<span class="rank-badge">' + rankLabel + '</span>' +
      '<span class="rank-name">' + esc(e.name) + (e.isMe ? ' (나)' : '') + '</span>' +
      '<span class="rank-status">' + e.label + '</span>' +
    '</div>';
  }).join('');
  panel.innerHTML = html;
}

/* 누적 점수 오브젝트({이름: 점수}) 형태의 리더보드(픽셀/눈코입/퀴즈)를 순위 표시로 렌더링 */
function renderScoreLeaderboard(elId, lb) {
  var el = document.getElementById(elId);
  if (!el) return;
  var names = Object.keys(lb || {});
  if (names.length === 0) { el.innerHTML = '<div class="empty-lb">아직 아무도 맞히지 못했어요.</div>'; return; }
  names.sort(function (a, b) { return lb[b] - lb[a]; });
  var html = names.map(function (n, i) {
    var rankLabel = i < 3 ? RANK_MEDALS[i] : (i + 1) + '등';
    return '<div class="lb-row"><span class="lb-name"><span class="rank-badge">' + rankLabel + '</span>' + esc(n) + (n === me.name ? ' (나)' : '') + '</span><span class="lb-score">' + lb[n] + '점</span></div>';
  }).join('');
  el.innerHTML = html;
}

/* ---------------- 공용: 온라인 카테고리/난이도 다수결 투표 ---------------- */
/* 예전에는 방 안의 아무나 카테고리(또는 난이도) 버튼을 누르면 그 즉시 모두의 화면이 바뀌어서,
   서로 다른 카테고리를 동시에 누르면 무엇이 선택된 건지 헷갈리는 문제가 있었습니다.
   지금은 다 같이 투표하고, 참가자 전원이 투표를 마치면 다수결로 정하며 - 동점이면 방장이 고른 쪽으로 정합니다. */
function ctVoteKey(game) { return roomKey(game + '_catvote'); }

function ctReset(game) {
  return DBset(ctVoteKey(game), { votes: {}, resolved: null });
}

function ctResolve(state) {
  var ids = (roomPlayersList || []).map(function (p) { return p.id; });
  if (!ids.length) return null;
  var allVoted = ids.every(function (id) { return Object.prototype.hasOwnProperty.call(state.votes, id); });
  if (!allVoted) return null;
  var counts = {};
  ids.forEach(function (id) {
    var c = state.votes[id];
    counts[c] = (counts[c] || 0) + 1;
  });
  var maxCount = 0;
  Object.keys(counts).forEach(function (c) { if (counts[c] > maxCount) maxCount = counts[c]; });
  var topCats = Object.keys(counts).filter(function (c) { return counts[c] === maxCount; });
  if (topCats.length === 1) return topCats[0];
  var hostVote = state.votes[roomHostId];
  if (hostVote && topCats.indexOf(hostVote) !== -1) return hostVote;
  return topCats[0];
}

/* 투표를 던지고, 다수결로 정해지면 onResolved(cat)를 호출합니다.
   containerId/hintElId를 주면 서버에 저장되기를 기다리지 않고 내 투표 표시를 그 자리에서 즉시 보여줍니다
   (버튼을 눌렀는데 최대 800ms 폴링 주기 동안 반응이 없어 보이는 문제를 막기 위함). */
function ctCastVote(game, cat, onResolved, containerId, hintElId) {
  DBget(ctVoteKey(game)).then(function (state) {
    state = state || { votes: {}, resolved: null };
    state.votes = state.votes || {};
    if (state.resolved) { onResolved(state.resolved); return; }
    state.votes[myPlayerId] = cat;
    var resolved = ctResolve(state);
    state.resolved = resolved;
    if (containerId) ctRenderVoteButtons(containerId, hintElId, state);
    DBset(ctVoteKey(game), state).then(function () { if (resolved) onResolved(resolved); });
  });
}

/* 투표 화면에 표시할 득표 수 집계 */
function ctVoteCounts(state) {
  var counts = {};
  var votes = (state && state.votes) || {};
  Object.keys(votes).forEach(function (pid) {
    var c = votes[pid];
    counts[c] = (counts[c] || 0) + 1;
  });
  return counts;
}

function ctRenderVoteButtons(containerId, hintElId, state) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var counts = ctVoteCounts(state);
  var totalPlayers = (roomPlayersList || []).length;
  var votedCount = Object.keys((state && state.votes) || {}).length;
  var myVote = state && state.votes ? state.votes[myPlayerId] : null;
  container.querySelectorAll('.cat-btn[data-cat]').forEach(function (btn) {
    var cat = btn.getAttribute('data-cat');
    var count = counts[cat] || 0;
    var badge = btn.querySelector('.cat-vote-count');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cat-vote-count';
      btn.appendChild(badge);
    }
    badge.textContent = count > 0 ? (count + '표') : '';
    badge.style.display = count > 0 ? '' : 'none';
    btn.classList.toggle('voted', myVote === cat);
  });
  var hintEl = document.getElementById(hintElId);
  if (hintEl) {
    hintEl.style.display = '';
    hintEl.textContent = '다 같이 투표 중이에요 (' + votedCount + '/' + totalPlayers + '명 투표 완료) · 다수결로 정해요. 동점이면 방장이 고른 쪽으로!';
  }
}

/* game: 'sudoku' 같은 게임 키, containerId: 카테고리/난이도 버튼들을 담은 컨테이너,
   hintElId: 투표 현황을 보여줄 안내 문구 요소, onResolved(cat): 다수결로 정해졌을 때 호출.
   반환값은 폴링을 멈추는 함수입니다. */
function ctStartVoteUI(game, containerId, hintElId, onResolved) {
  var stopped = false;
  var resolvedHandled = false;
  function poll() {
    if (stopped) return;
    DBget(ctVoteKey(game)).then(function (state) {
      if (stopped) return;
      state = state || { votes: {}, resolved: null };
      ctRenderVoteButtons(containerId, hintElId, state);
      if (state.resolved && !resolvedHandled) {
        resolvedHandled = true;
        stopped = true;
        clearInterval(timer);
        onResolved(state.resolved);
      }
    });
  }
  var timer = null;
  var starter = (myPlayerId === roomHostId) ? ctReset(game) : Promise.resolve();
  starter.then(function () {
    if (stopped) return;
    poll();
    timer = setInterval(poll, 800);
  });
  return function stop() { stopped = true; clearInterval(timer); };
}

function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* ---------------- 3단계: 그룹 위젯(방 채팅 + 멤버 현황판) ---------------- */
/* 온라인 모드로 방에 있는 동안(로비에서든, 어떤 게임 화면에서든) 우측 하단에 작은 채팅+멤버
   버튼이 떠 있습니다. 게임 중에도 옆에서 계속 대화하거나, 누가 채팅을 입력 중인지 볼 수 있어서
   "다같이 하고 있다"는 느낌을 주기 위한 기능입니다. 채팅 메시지/입력중 표시는 다른 게임들과
   똑같은 방식(roomKey를 이용한 공용 상태 저장소)으로 저장/폴링되며, 서버 쪽 코드 변경은
   필요하지 않습니다(이미 있는 범용 상태 저장 API를 그대로 재사용). */
var GROUP_POLL_TIMER = null;
var GROUP_PANEL_OPEN = false;
var GROUP_ACTIVE_TAB = 'chat';
var GROUP_LAST_SEEN_COUNT = 0;
var GROUP_LAST_RENDERED_COUNT = -1;
var GROUP_TYPING_THROTTLE = 0;

function groupChatKey() { return roomKey('chat'); }
function groupTypingKey() { return roomKey('typing'); }

function startGroupWidget() {
  document.getElementById('group-widget').style.display = '';
  GROUP_LAST_SEEN_COUNT = 0;
  GROUP_LAST_RENDERED_COUNT = -1;
  GROUP_PANEL_OPEN = false;
  document.getElementById('group-panel').style.display = 'none';
  document.getElementById('group-unread-badge').style.display = 'none';
  if (typeof gwApplyBtnPos === 'function') gwApplyBtnPos();
  clearInterval(GROUP_POLL_TIMER);
  groupPoll();
  GROUP_POLL_TIMER = setInterval(groupPoll, 1500);
}

function stopGroupWidget() {
  document.getElementById('group-widget').style.display = 'none';
  clearInterval(GROUP_POLL_TIMER);
  GROUP_PANEL_OPEN = false;
  document.getElementById('group-panel').style.display = 'none';
}

function toggleGroupPanel() {
  GROUP_PANEL_OPEN = !GROUP_PANEL_OPEN;
  document.getElementById('group-panel').style.display = GROUP_PANEL_OPEN ? '' : 'none';
  if (GROUP_PANEL_OPEN) {
    document.getElementById('group-unread-badge').style.display = 'none';
    if (typeof gwPlacePanel === 'function') gwPlacePanel();
    var msgEl = document.getElementById('group-chat-messages');
    if (msgEl) msgEl.scrollTop = msgEl.scrollHeight;
    groupPoll();
  }
}

function switchGroupTab(tab) {
  GROUP_ACTIVE_TAB = tab;
  document.getElementById('group-tab-chat').classList.toggle('active', tab === 'chat');
  document.getElementById('group-tab-members').classList.toggle('active', tab === 'members');
  document.getElementById('group-chat-tab').style.display = tab === 'chat' ? '' : 'none';
  document.getElementById('group-members-tab').style.display = tab === 'members' ? '' : 'none';
  if (tab === 'chat') document.getElementById('group-unread-badge').style.display = 'none';
}

function groupPoll() {
  if (playMode !== 'online' || !roomJoined) return;
  DBget(groupChatKey()).then(function (state) {
    var messages = (state && state.messages) || [];
    groupRenderChat(messages);
    var viewingChat = GROUP_PANEL_OPEN && GROUP_ACTIVE_TAB === 'chat';
    var seenIdx = -1;
    if (GROUP_LAST_SEEN_COUNT) {
      for (var si = messages.length - 1; si >= 0; si--) { if (messages[si].id === GROUP_LAST_SEEN_COUNT) { seenIdx = si; break; } }
    }
    var unseen = GROUP_LAST_SEEN_COUNT ? (messages.length - 1 - seenIdx) : messages.length;
    if (viewingChat) {
      GROUP_LAST_SEEN_COUNT = messages.length ? messages[messages.length - 1].id : 0;
    } else if (unseen > 0) {
      var newCount = unseen;
      var badge = document.getElementById('group-unread-badge');
      badge.textContent = newCount > 9 ? '9+' : String(newCount);
      badge.style.display = '';
    }
  });
  DBget(groupTypingKey()).then(function (typing) {
    groupRenderMembers(typing || {});
  });
}

function groupRenderChat(messages) {
  if (typeof GROUP_CHAT_TRACKER === 'undefined') return;
  if (GROUP_LAST_RENDERED_COUNT === -1) { GROUP_CHAT_TRACKER.lastSig = null; GROUP_LAST_RENDERED_COUNT = 0; }
  chatRenderInto(document.getElementById('group-chat-messages'), messages, GROUP_CHAT_TRACKER, '아직 채팅이 없어요. 첫 메시지를 남겨보세요!');
}

function groupSendChat() {
  var input = document.getElementById('group-chat-input');
  var text = input.value.trim();
  if (!text || !roomJoined) return;
  input.value = '';
  chatSendText(groupChatKey(), text).then(function () { groupPoll(); });
  groupClearTyping();
}

/* 채팅 입력창에 타이핑 중이면(1초에 한 번만) 공용 상태에 내 타임스탬프를 기록해서,
   다른 사람의 멤버 탭에 "입력 중..."으로 보이게 합니다. */
function groupHandleTyping() {
  if (!roomJoined) return;
  var now = Date.now();
  if (now - GROUP_TYPING_THROTTLE < 1000) return;
  GROUP_TYPING_THROTTLE = now;
  DBget(groupTypingKey()).then(function (typing) {
    typing = typing || {};
    typing[myPlayerId] = now;
    DBset(groupTypingKey(), typing);
  });
}

function groupClearTyping() {
  DBget(groupTypingKey()).then(function (typing) {
    if (!typing || !Object.prototype.hasOwnProperty.call(typing, myPlayerId)) return;
    delete typing[myPlayerId];
    DBset(groupTypingKey(), typing);
  });
}

function groupRenderMembers(typing) {
  var el = document.getElementById('group-member-list');
  var countEl = document.getElementById('group-member-count');
  if (!el) return;
  var now = Date.now();
  var list = roomPlayersList || [];
  if (countEl) countEl.textContent = list.length ? ('(' + list.length + ')') : '';
  el.innerHTML = list.length ? list.map(function (p) {
    var isHost = p.id === roomHostId;
    var isMe = p.id === myPlayerId;
    var isTyping = !isMe && typing[p.id] && (now - typing[p.id] < 3000);
    return '<div class="group-member-row">' +
      '<span>' + (isHost ? '👑 ' : '') + esc(p.name) + (isMe ? ' (나)' : '') + '</span>' +
      (isTyping ? '<span class="group-typing-hint">✏️ 입력 중...</span>' : '') +
      '</div>';
  }).join('') : '<div class="lobby-hint">아무도 없어요.</div>';
}

/* ---------------- 게임창 참가자 현황 바(항상 보임) ---------------- */
/* 3단계의 채팅+멤버 위젯은 눌러서 펼쳐야 보였는데, "같이 게임하는 느낌이 안 난다"는
   의견이 있었습니다. 그래서 접혀있지 않고 항상 떠 있는 작은 바를 추가로 만들어서,
   온라인으로 어떤 게임을 하든 화면 위(오른쪽 위)에 바로 누가 있는지/누가 입력 중인지
   보이게 했습니다. "입력 중"은 기존의 채팅 입력창뿐 아니라, 픽셀 디텍터의 정답 입력칸처럼
   각 게임 자체의 텍스트 입력칸에 타이핑할 때도 함께 반영됩니다(같은 공용 타이핑 상태를
   재사용 - groupHandleTyping). */
var GMB_POLL_TIMER = null;

function startGameMembersBar() {
  var el = document.getElementById('game-members-bar');
  if (!el) return;
  el.style.display = '';
  gmbPoll();
  clearInterval(GMB_POLL_TIMER);
  GMB_POLL_TIMER = setInterval(gmbPoll, 1200);
}

function stopGameMembersBar() {
  var el = document.getElementById('game-members-bar');
  if (el) el.style.display = 'none';
  clearInterval(GMB_POLL_TIMER);
}

function gmbPoll() {
  if (playMode !== 'online' || !roomJoined) return;
  DBget(groupTypingKey()).then(function (typing) {
    gmbRender(typing || {});
  });
}

function gmbRender(typing) {
  var el = document.getElementById('game-members-bar');
  if (!el) return;
  var now = Date.now();
  var list = roomPlayersList || [];
  el.innerHTML = list.map(function (p) {
    var isMe = p.id === myPlayerId;
    var isTyping = typing[p.id] && (now - typing[p.id] < 3000);
    return '<span class="gmb-chip' + (isMe ? ' me' : '') + '"><span class="gmb-dot"></span>' +
      esc(p.name) + (isMe ? ' (나)' : '') +
      (isTyping ? '<span class="gmb-typing"> ✏️입력중</span>' : '') +
      '</span>';
  }).join('');
}

(function groupSetupChatInput() {
  var input = document.getElementById('group-chat-input');
  if (!input) return;
  input.addEventListener('input', groupHandleTyping);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); groupSendChat(); }
  });
})();


