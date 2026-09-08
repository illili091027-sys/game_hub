/* ---------------- 숫자 찾기 대 채우기 (2인 온라인 전용) ---------------- */
/* 규칙: 방 안에 딱 2명이 있어야 합니다.
   한 명은 '채우는 사람'이 되어 상대가 찾아야 할 숫자를 직접 하나 고르고,
   다른 한 명은 '찾는 사람'이 되어 흩어진 숫자 중에서 그 목표 숫자를 찾습니다.
   그동안 채우는 사람은 자기 판을 최대한 빨리 X로 채웁니다.
   찾는 사람이 숫자를 찾으면 역할이 서로 바뀌고, 새로운 채우는 사람이 다음 숫자를 고릅니다.
   (랜덤으로 목표 숫자가 정해지던 예전 방식 대신, 채우는 사람이 직접 숫자를 지정합니다.)
   자기 판을 상대방보다 먼저 다 채우면 승리, 그렇지 않으면 패배! */
var FX_FILL_TOTAL = 30;
var FX_GRID_SIZE = 24;
var FX_NUM_RANGE = 50;
var FX_SEQ = -1;
var FX_ROLE = null; // 'search' | 'fill'
var FX_MY_FILL = 0;
var FX_OPP_FILL = 0;
var FX_OPP_ID = null;
var FX_OPP_NAME = '상대';
var FX_GAME_OVER = false;
var FX_POLL_TIMER = null;
var FX_LAST_POST = 0;
var FX_POST_PENDING = false;
var FX_LAST_GRID_JSON = null; // 검색판이 바뀌었는지 감지용(phase가 pick<->search로 바뀔 땐 seq가 그대로일 수 있어서 seq 대신 사용)
var FX_FILLED = []; // 각 칸의 상태: 0=빈칸, 1=반쪽(한 번 누름), 2=완성(두 번 눌러서 채워짐)
                     // 예전엔 한 번만 눌러도 바로 채워졌는데, 실수로 누르는 걸 줄이려고
                     // 같은 칸을 두 번 눌러야 완전히 채워지도록 바뀌었습니다.

function fxKey() { return roomKey('findx'); }

function startFindX() {
  clearInterval(FX_POLL_TIMER);
  FX_SEQ = -1;
  FX_MY_FILL = 0;
  FX_OPP_FILL = 0;
  FX_GAME_OVER = false;
  FX_LAST_GRID_JSON = null;
  FX_FILLED = new Array(FX_FILL_TOTAL).fill(0);
  document.getElementById('fx-need-two').style.display = 'none';
  document.getElementById('fx-game-area').style.display = 'none';
  document.getElementById('fx-over-area').style.display = 'none';
  if (!roomPlayersList || roomPlayersList.length !== 2) {
    document.getElementById('fx-need-two').style.display = '';
    document.getElementById('fx-player-count').textContent = (roomPlayersList || []).length;
    FX_POLL_TIMER = setInterval(function () {
      if (roomPlayersList && roomPlayersList.length === 2) { startFindX(); return; }
      document.getElementById('fx-player-count').textContent = (roomPlayersList || []).length;
    }, 1000);
    return;
  }
  var others = roomPlayersList.filter(function (p) { return p.id !== myPlayerId; });
  FX_OPP_ID = others.length ? others[0].id : null;
  FX_OPP_NAME = others.length ? others[0].name : '상대';
  var oppNameEl = document.getElementById('fx-opp-name');
  if (oppNameEl) oppNameEl.textContent = FX_OPP_NAME;
  document.getElementById('fx-game-area').style.display = '';
  DBget(fxKey()).then(function (state) {
    if (!state || state.winnerId) {
      fxCreateNewGame();
    } else {
      fxApplyState(state);
    }
  });
  FX_POLL_TIMER = setInterval(fxPoll, 400);
}

/* 채우는 사람이 고른 숫자(target)를 반드시 포함하는 24개짜리 검색판을 만듭니다. */
function fxBuildGridWithTarget(target) {
  var pool = [];
  for (var i = 1; i <= FX_NUM_RANGE; i++) { if (i !== target) pool.push(i); }
  pool = shuffleArray(pool).slice(0, FX_GRID_SIZE - 1);
  pool.push(target);
  return shuffleArray(pool);
}

function fxCreateNewGame() {
  if (!roomPlayersList || roomPlayersList.length !== 2) return;
  var players = roomPlayersList.map(function (p) { return p.id; });
  var searcherId = players[Math.floor(Math.random() * players.length)];
  var fillerId = players.filter(function (id) { return id !== searcherId; })[0];
  var state = {
    seq: 0,
    phase: 'pick', // 'pick' = 채우는 사람이 숫자를 고르는 중, 'search' = 찾는 사람이 찾는 중
    searcherId: searcherId,
    fillerId: fillerId,
    grid: null,
    target: null,
    fillCounts: {},
    fillTotal: FX_FILL_TOTAL,
    winnerId: null
  };
  state.fillCounts[searcherId] = 0;
  state.fillCounts[fillerId] = 0;
  DBset(fxKey(), state).then(function () { fxApplyState(state); });
}

function fxBeginGame() {
  document.getElementById('fx-over-area').style.display = 'none';
  document.getElementById('fx-game-area').style.display = '';
  FX_SEQ = -1;
  FX_MY_FILL = 0;
  FX_OPP_FILL = 0;
  FX_GAME_OVER = false;
  FX_LAST_GRID_JSON = null;
  FX_FILLED = new Array(FX_FILL_TOTAL).fill(0);
  fxCreateNewGame();
}

function fxPoll() {
  if (!roomPlayersList || roomPlayersList.length !== 2) { startFindX(); return; }
  DBget(fxKey()).then(function (state) {
    if (!state) return;
    fxApplyState(state);
  });
}

function fxApplyState(state) {
  if (!state || !document.getElementById('findx').classList.contains('active')) return;
  document.getElementById('fx-need-two').style.display = 'none';
  if (state.winnerId) {
    fxShowOver(state);
    return;
  }
  document.getElementById('fx-game-area').style.display = '';
  document.getElementById('fx-over-area').style.display = 'none';

  FX_SEQ = state.seq;
  FX_ROLE = (state.searcherId === myPlayerId) ? 'search' : (state.fillerId === myPlayerId ? 'fill' : null);
  /* 내가 채운 칸 수는 서버(=memoryStore) 값보다 뒤처질 수 없습니다. 채우기는 200ms 간격으로 묶어서
     전송하기 때문에, 그 사이에 폴링이 옛날 값을 읽어와 fxApplyState를 다시 부르면 방금 내가 클릭해서
     늘려놓은 진행 상황이 순간적으로 되돌아가 버리는 문제가 있었습니다 - 두 값 중 큰 쪽을 씁니다. */
  FX_MY_FILL = Math.max(FX_MY_FILL, (state.fillCounts && state.fillCounts[myPlayerId]) || 0);
  FX_OPP_FILL = (state.fillCounts && FX_OPP_ID && state.fillCounts[FX_OPP_ID]) || 0;
  fxSyncFilledFromCount(FX_MY_FILL);

  var pickArea = document.getElementById('fx-pick-area');
  var waitPickArea = document.getElementById('fx-wait-pick-area');
  var searchArea = document.getElementById('fx-search-area');
  var fillArea = document.getElementById('fx-fill-area');
  var banner = document.getElementById('fx-role-banner');

  if (state.phase === 'pick') {
    pickArea.style.display = FX_ROLE === 'fill' ? '' : 'none';
    waitPickArea.style.display = FX_ROLE === 'search' ? '' : 'none';
    searchArea.style.display = 'none';
    fillArea.style.display = 'none';
    banner.textContent = FX_ROLE === 'fill'
      ? '🔢 상대가 찾을 숫자를 하나 골라주세요!'
      : '⏳ 상대가 낼 문제를 고르는 중이에요...';
    if (FX_ROLE === 'fill') fxRenderPickGrid();
  } else {
    pickArea.style.display = 'none';
    waitPickArea.style.display = 'none';
    searchArea.style.display = FX_ROLE === 'search' ? '' : 'none';
    fillArea.style.display = FX_ROLE === 'fill' ? '' : 'none';
    banner.textContent = FX_ROLE === 'search'
      ? '🔍 당신 차례! 아래에서 찾을 숫자를 눌러보세요.'
      : '✏️ 상대방이 찾는 동안, 판을 최대한 빨리 채우세요!';

    if (FX_ROLE === 'search') {
      document.getElementById('fx-target-val').textContent = state.target;
      var gridJson = JSON.stringify(state.grid);
      if (gridJson !== FX_LAST_GRID_JSON) {
        FX_LAST_GRID_JSON = gridJson;
        fxRenderSearchGrid(state.grid);
      }
    }
    if (FX_ROLE === 'fill') {
      fxRenderFillGrid();
    }
  }
  fxUpdateBars();
}

function fxRenderPickGrid() {
  var el = document.getElementById('fx-pick-grid');
  if (el.querySelectorAll('.fx-pick-cell').length === FX_NUM_RANGE) return;
  el.innerHTML = '';
  for (var n = 1; n <= FX_NUM_RANGE; n++) {
    var btn = document.createElement('button');
    btn.className = 'fx-pick-cell';
    btn.textContent = n;
    btn.onclick = (function (num) { return function () { fxPickTarget(num); }; })(n);
    el.appendChild(btn);
  }
}

function fxPickTarget(n) {
  if (FX_ROLE !== 'fill' || FX_GAME_OVER) return;
  DBget(fxKey()).then(function (state) {
    if (!state || state.winnerId || state.phase !== 'pick' || state.fillerId !== myPlayerId || state.seq !== FX_SEQ) {
      fxApplyState(state);
      return;
    }
    state.target = n;
    state.grid = fxBuildGridWithTarget(n);
    state.phase = 'search';
    state.seq = (state.seq || 0) + 1;
    DBset(fxKey(), state).then(function () { fxApplyState(state); });
  });
}

function fxRenderSearchGrid(grid) {
  var el = document.getElementById('fx-search-grid');
  el.innerHTML = '';
  grid.forEach(function (n) {
    var btn = document.createElement('button');
    btn.className = 'fx-search-cell';
    btn.textContent = n;
    btn.onclick = function () { fxTrySearch(n, btn); };
    el.appendChild(btn);
  });
}

function fxTrySearch(n, btn) {
  if (FX_ROLE !== 'search' || FX_GAME_OVER) return;
  DBget(fxKey()).then(function (state) {
    if (!state || state.winnerId || state.phase !== 'search' || state.searcherId !== myPlayerId || state.seq !== FX_SEQ) { fxApplyState(state); return; }
    if (n !== state.target) {
      btn.classList.add('fx-wrong-flash');
      setTimeout(function () { btn.classList.remove('fx-wrong-flash'); }, 250);
      return;
    }
    /* 정답! 역할을 서로 바꾸고, 새로운 채우는 사람이 다음 숫자를 고르도록 pick 단계로 돌아갑니다. */
    state.searcherId = state.fillerId;
    state.fillerId = myPlayerId;
    state.grid = null;
    state.target = null;
    state.phase = 'pick';
    state.seq = (state.seq || 0) + 1;
    DBset(fxKey(), state).then(function () { fxApplyState(state); });
  });
}

/* 서버에 저장된 내 진행 칸 수(count)만큼은 완성된(2단계) 상태여야 하므로, 아직 완성되지 않은 칸 중
   앞에서부터 필요한 만큼을 채운 것으로 맞춰줍니다 (새로고침 등으로 진행 상황을 이어받을 때 사용). */
function fxSyncFilledFromCount(count) {
  if (!FX_FILLED || FX_FILLED.length !== FX_FILL_TOTAL) FX_FILLED = new Array(FX_FILL_TOTAL).fill(0);
  var filledSoFar = FX_FILLED.filter(function (v) { return v >= 2; }).length;
  for (var i = 0; i < FX_FILLED.length && filledSoFar < count; i++) {
    if (FX_FILLED[i] < 2) { FX_FILLED[i] = 2; filledSoFar++; }
  }
}

function fxRenderFillGrid() {
  var el = document.getElementById('fx-fill-grid');
  if (el.querySelectorAll('.fx-cell').length !== FX_FILL_TOTAL) {
    el.innerHTML = '';
    for (var i = 0; i < FX_FILL_TOTAL; i++) {
      var cell = document.createElement('div');
      cell.className = 'fx-cell';
      cell.innerHTML = '<span class="fx-stroke fx-stroke1"></span><span class="fx-stroke fx-stroke2"></span>';
      cell.onclick = (function (idx) { return function () { fxCellClick(idx); }; })(i);
      el.appendChild(cell);
    }
  }
  var cells = el.querySelectorAll('.fx-cell');
  cells.forEach(function (cell, idx) {
    cell.classList.toggle('half', FX_FILLED[idx] === 1);
    cell.classList.toggle('filled', FX_FILLED[idx] >= 2);
  });
}

/* 칸 하나당 두 번을 눌러야 완전히 채워집니다 - 한 번 누르면 반쪽(사선 하나)만 그어지고,
   같은 칸을 한 번 더 눌러야 X가 완성되고 채운 것으로 인정됩니다. 이미 완성된 칸을 다시
   눌러도 아무 일도 일어나지 않습니다. */
function fxCellClick(idx) {
  if (FX_ROLE !== 'fill' || FX_GAME_OVER) return;
  var state = FX_FILLED[idx] || 0;
  if (state >= 2) return;
  FX_FILLED[idx] = state + 1;
  var cellEl = document.getElementById('fx-fill-grid').querySelectorAll('.fx-cell')[idx];
  if (cellEl) {
    cellEl.classList.toggle('half', FX_FILLED[idx] === 1);
    cellEl.classList.toggle('filled', FX_FILLED[idx] >= 2);
  }
  if (FX_FILLED[idx] < 2) return;
  FX_MY_FILL = FX_FILLED.filter(function (v) { return v >= 2; }).length;
  fxUpdateBars();
  fxPostFill(FX_MY_FILL >= FX_FILL_TOTAL);
}

function fxPostFill(force) {
  var now = Date.now();
  if (!force && now - FX_LAST_POST < 200) return;
  if (FX_POST_PENDING) return;
  FX_LAST_POST = now;
  FX_POST_PENDING = true;
  DBget(fxKey()).then(function (state) {
    FX_POST_PENDING = false;
    if (!state || state.winnerId) return;
    state.fillCounts = state.fillCounts || {};
    var current = state.fillCounts[myPlayerId] || 0;
    if (FX_MY_FILL > current) state.fillCounts[myPlayerId] = FX_MY_FILL;
    if (state.fillCounts[myPlayerId] >= FX_FILL_TOTAL) state.winnerId = myPlayerId;
    DBset(fxKey(), state).then(function () { fxApplyState(state); });
  });
}

function fxUpdateBars() {
  var myPct = Math.min(100, (FX_MY_FILL / FX_FILL_TOTAL) * 100);
  var oppPct = Math.min(100, (FX_OPP_FILL / FX_FILL_TOTAL) * 100);
  document.getElementById('fx-my-bar').style.width = myPct + '%';
  document.getElementById('fx-opp-bar').style.width = oppPct + '%';
  document.getElementById('fx-my-count').textContent = FX_MY_FILL + '/' + FX_FILL_TOTAL;
  document.getElementById('fx-opp-count').textContent = FX_OPP_FILL + '/' + FX_FILL_TOTAL;
}

function fxShowOver(state) {
  FX_GAME_OVER = true;
  document.getElementById('fx-game-area').style.display = 'none';
  document.getElementById('fx-over-area').style.display = '';
  var iWon = state.winnerId === myPlayerId;
  document.getElementById('fx-over-msg').innerHTML = iWon
    ? '🎉 승리! 내 판을 먼저 다 채웠어요!'
    : '😢 패배! ' + esc(FX_OPP_NAME || '상대방') + '님이 먼저 판을 다 채웠어요.';
}

function stopFindX() {
  clearInterval(FX_POLL_TIMER);
}
