/* ===================== 게임 테이블 (방 안의 작은 방) =====================
   한 방(서버 코드)에 10명이 있어도, 각자 원하는 게임 '테이블'을 열고 따로 놀 수 있어요.
   - 오른쪽 위 🎮 버튼 → 테이블 목록. 테이블 만들기(게임·인원) → 다른 친구는 참가/구경.
   - 테이블 만든 사람이 '시작'을 누르면 그 테이블 사람들끼리만 게임 시작.
   - 테이블에 있는 사람은 방장이 고른 게임 준비 화면이 안 떠요(이름 옆에 🎮 표시).
   - 방장이 테이블에 들어가면 자동으로 '방장 프리'. 남은 사람 중 '방장 하기'를 먼저 누른 사람이 방장.
   저장 위치(큰 방): tbl_<만든사람id> = 테이블 정보, tm_<내id> = 내가 있는 테이블, hostfree = 방장 프리 상태
   테이블 안의 게임 데이터는 '방코드_T테이블id' 라는 작은 방에 따로 저장돼요(roomKey가 알아서). */

var TBL = { tid: null, owner: null, spectate: false };
var TBL_LIST = [];          // 열린 테이블들
var TBL_MEM = {};           // pid → {tid, spec}
var TBL_META = null;        // 내가 있는 테이블 정보
var TBL_ENTERED_SEQ = null; // 이 테이블에서 마지막으로 들어간 게임 차례
var HOST_FREE = false;
var TBL_POLL = null, TBL_BUSY = false;

var TBL_GAMES = {
  bomb: { n: '똥벼락 대탈출', min: 2, max: 10 }, quiz: { n: '상식 끝판왕', min: 2, max: 10 }, hues: { n: '색감과 직감', min: 3, max: 10 },
  tapple: { n: '태플', min: 2, max: 10 }, relay: { n: '엉뚱 그림 릴레이', min: 3, max: 10 }, bingo: { n: '빙고 대작전', min: 2, max: 10 },
  tickbomb: { n: '폭탄 돌리기', min: 2, max: 12 }, dobble: { n: '얼른 버려!', min: 2, max: 8 }, catch: { n: '캐치마인드', min: 2, max: 10 },
  wasd: { n: 'WASD 대모험', min: 1, max: 4 }, yang: { n: '양세찬 게임', min: 2, max: 8 }, land: { n: '땅따먹기', min: 2, max: 10, team: true },
  baby: { n: '먼작귀 키우기', min: 1, max: 10 }
};
var TEAM_NAMES = ['빨강팀', '파랑팀', '초록팀', '노랑팀'];
var TEAM_COLORS = ['#ef5350', '#42a5f5', '#43a047', '#ffb300'];

function tblKey(s) { return roomKeyBase(s); }
function tblNewId() { return Math.random().toString(36).slice(2, 7); }

/* ---- core.js 가 부르는 것들 ---- */
function tblEffectiveHost(serverHost) {
  if (TBL.tid) return TBL.owner;
  return HOST_FREE ? null : serverHost;
}
function tblRoster(players) {
  if (TBL.tid) return players.filter(function (p) { var m = TBL_MEM[p.id]; return m && m.tid === TBL.tid && !m.spec; });
  return players.filter(function (p) { return !TBL_MEM[p.id]; });
}
function tblBadge(pid) {
  var m = TBL_MEM[pid];
  if (!m) return '';
  var t = TBL_LIST.filter(function (x) { return x.tid === m.tid; })[0];
  var g = t && TBL_GAMES[t.game] ? TBL_GAMES[t.game].n : '테이블';
  return ' <small class="tbl-badge">' + (m.spec ? '👀 ' : '🎮 ') + esc(g) + (t && t.status === 'play' && !m.spec ? ' 게임 중' : '') + '</small>';
}
/* 명단·방장을 지금 상황에 맞게 다시 계산 (테이블에 들어가고 나올 때 바로) */
function tblApply() {
  if (!ROOM_ALL_PLAYERS || !ROOM_ALL_PLAYERS.length) return;
  roomHostId = tblEffectiveHost(ROOM_SERVER_HOST);
  roomPlayersList = tblRoster(ROOM_ALL_PLAYERS);
  renderLobbyPlayers(ROOM_ALL_PLAYERS);
  document.querySelectorAll('#card-grid .game-card').forEach(function (card) {
    if (card.id === 'card-channels' || card.id === 'card-homework') return;
    card.classList.toggle('disabled', myPlayerId !== roomHostId);
  });
  tblRenderHostBar();
}

/* ---- 주기적으로 상태 읽기 ---- */
function tblStart() {
  clearInterval(TBL_POLL);
  TBL_POLL = setInterval(tblPoll, 1500);
  tblPoll();
  tblShowButton(true);
}
function tblStop() {
  clearInterval(TBL_POLL); TBL_POLL = null;
  TBL = { tid: null, owner: null, spectate: false }; TBL_META = null; TBL_LIST = []; TBL_MEM = {}; HOST_FREE = false;
  tblShowButton(false);
  document.body.classList.remove('tbl-spectate');
}
function tblPoll() {
  if (!roomJoined || TBL_BUSY || playMode !== 'online') return;
  var ids = (ROOM_ALL_PLAYERS || []).map(function (p) { return p.id; });
  if (!ids.length) return;
  TBL_BUSY = true;
  Promise.all([DBgetPrefixIn(me.room, 'tbl_', ids), DBgetPrefixIn(me.room, 'tm_', ids), DBget(tblKey('hostfree'))]).then(function (r) {
    TBL_BUSY = false;
    var metas = r[0] || {}, mems = r[1] || {}, hf = r[2] || {};
    var here = {};
    ids.forEach(function (id) { here[id] = 1; });
    TBL_LIST = Object.keys(metas).map(function (k) { return metas[k]; }).filter(function (t) { return t && t.tid && here[t.owner]; })
      .sort(function (a, b) { return a.at - b.at; });
    var valid = {};
    TBL_LIST.forEach(function (t) { valid[t.tid] = t; });
    TBL_MEM = {};
    Object.keys(mems).forEach(function (pid) { var m = mems[pid]; if (m && m.tid && valid[m.tid] && here[pid]) TBL_MEM[pid] = { tid: m.tid, spec: !!m.spec }; });
    TBL_LIST.forEach(function (t) { t.members = ids.filter(function (id) { var m = TBL_MEM[id]; return m && m.tid === t.tid && !m.spec; }); t.specs = ids.filter(function (id) { var m = TBL_MEM[id]; return m && m.tid === t.tid && m.spec; }); });
    /* 방장 프리 */
    HOST_FREE = !!hf.free;
    if (myPlayerId === ROOM_SERVER_HOST && hf.claim && hf.claim.pid && here[hf.claim.pid]) {
      /* 누가 '방장 하기'를 눌렀어요 → 서버 방장인 내가 그 사람에게 넘겨줘요 */
      if (hf.claim.pid !== myPlayerId) delegateHost(hf.claim.pid);
      DBset(tblKey('hostfree'), { free: false, at: Date.now() });
      HOST_FREE = false;
    }
    /* 내 테이블 */
    var mine = TBL_MEM[myPlayerId];
    if (TBL.tid && (!mine || mine.tid !== TBL.tid)) {
      /* 테이블이 닫혔어요 */
      var wasIn = TBL.tid;
      tblSetCtx(null);
      if (wasIn) { coinToast('테이블이 닫혔어요'); tblLeaveGameView(); }
    } else if (!TBL.tid && mine) tblSetCtx(valid[mine.tid], mine.spec);
    TBL_META = TBL.tid ? valid[TBL.tid] : null;
    if (TBL_META) tblFollowTable(TBL_META);
    tblApply();
    tblRender();
  }, function () { TBL_BUSY = false; });
}

function tblSetCtx(meta, spec) {
  if (!meta) {
    TBL = { tid: null, owner: null, spectate: false }; TBL_META = null; TBL_ENTERED_SEQ = null;
    document.body.classList.remove('tbl-spectate');
    if (typeof GROUP_ACTIVE_TAB !== 'undefined' && GROUP_ACTIVE_TAB === 'table') switchGroupTab('chat');
  } else {
    TBL = { tid: meta.tid, owner: meta.owner, spectate: !!spec };
    TBL_META = meta;
    TBL_ENTERED_SEQ = meta.status === 'play' ? null : meta.seq;   /* 이미 게임 중이면 바로 들어가요 */
    document.body.classList.toggle('tbl-spectate', !!spec);
  }
  tblApply();
}

/* 테이블 시작/끝을 따라가기 */
function tblFollowTable(t) {
  var active = document.querySelector('.view.active');
  var inGame = active && TBL_GAMES[active.id];
  if (t.status === 'play' && t.seq !== TBL_ENTERED_SEQ) {
    TBL_ENTERED_SEQ = t.seq;
    roomHostId = t.owner;
    roomPlayersList = tblRoster(ROOM_ALL_PLAYERS);
    enterGame(t.game);
  } else if (t.status !== 'play' && inGame && myPlayerId !== t.owner) {
    /* 만든 사람이 게임을 끝냈어요 → 모두 테이블 화면으로 */
    tblLeaveGameView();
  }
}
function tblLeaveGameView() {
  var active = document.querySelector('.view.active');
  if (active && TBL_GAMES[active.id]) { var keep = TBL.tid; goHome(); if (!keep) openTables(); }
  else if (active && active.id === 'tables') tblRender();
}
/* goHome 이 테이블 안에서 불리면 홈 대신 테이블 화면으로 */
function tblAfterGameHome() {
  if (TBL_META && myPlayerId === TBL_META.owner && TBL_META.status === 'play') {
    TBL_META.status = 'wait';
    DBset(tblKey('tbl_' + myPlayerId), TBL_META);
  }
  openTables();
}

/* ---- 방장 프리 ---- */
function hostFree() {
  if (myPlayerId !== ROOM_SERVER_HOST) return;
  HOST_FREE = true;
  DBset(tblKey('hostfree'), { free: true, at: Date.now() }).then(tblPoll);
  tblApply();
}
function hostClaim() {
  if (!HOST_FREE) return;
  DBget(tblKey('hostfree')).then(function (hf) {
    if (!hf || !hf.free) return tblPoll();
    if (hf.claim && Date.now() - hf.claim.at < 5000) { coinToast((hf.claim.name || '누군가') + '님이 먼저 눌렀어요!'); return; }
    if (myPlayerId === ROOM_SERVER_HOST) { DBset(tblKey('hostfree'), { free: false, at: Date.now() }).then(tblPoll); return; }
    DBset(tblKey('hostfree'), { free: true, claim: { pid: myPlayerId, name: me.name, at: Date.now() }, at: Date.now() });
    coinToast('👑 방장이 되는 중…');
  });
}
function tblRenderHostBar() {
  var el = document.getElementById('host-free-bar');
  if (!el) return;
  var amServerHost = myPlayerId === ROOM_SERVER_HOST;
  if (HOST_FREE) el.innerHTML = '<span>👑 지금 방장이 없어요</span>' + (TBL.tid ? '' : '<button class="btn btn-primary hf-btn" onclick="hostClaim()">👑 방장 하기</button>');
  else if (amServerHost && !TBL.tid) el.innerHTML = '<span>👑 내가 방장이에요</span><button class="btn btn-ghost hf-btn" onclick="hostFree()">방장 프리</button>';
  else el.innerHTML = '';
  el.style.display = el.innerHTML ? '' : 'none';
}

/* ---- 테이블 만들기 / 참가 / 나가기 ---- */
function tblCreate(game, max, team) {
  if (TBL.tid) return;
  var g = TBL_GAMES[game];
  var meta = { tid: tblNewId(), owner: myPlayerId, ownerName: me.name, game: game, max: Math.max(g.min, Math.min(g.max, max || g.max)), status: 'wait', seq: 0, at: Date.now(), team: team ? { on: true, n: 2, assign: {} } : null };
  Promise.all([DBset(tblKey('tbl_' + myPlayerId), meta), DBset(tblKey('tm_' + myPlayerId), { tid: meta.tid, at: Date.now() })]).then(function () {
    tblAutoHostFree();
    TBL_MEM[myPlayerId] = { tid: meta.tid };
    TBL_LIST.push(meta); meta.members = [myPlayerId]; meta.specs = [];
    tblSetCtx(meta, false);
    tblRender();
    tblPoll();
  });
}
function tblJoin(tid, spec) {
  var t = TBL_LIST.filter(function (x) { return x.tid === tid; })[0];
  if (!t) return;
  if (!spec && t.members.length >= t.max) { coinToast('자리가 꽉 찼어요. 구경은 할 수 있어요!'); return; }
  if (!spec && t.status === 'play') { coinToast('게임 중이에요. 지금은 구경만 돼요!'); return; }
  DBset(tblKey('tm_' + myPlayerId), { tid: tid, spec: !!spec, at: Date.now() }).then(function () {
    if (!spec) tblAutoHostFree();
    TBL_MEM[myPlayerId] = { tid: tid, spec: !!spec };
    tblSetCtx(t, spec);
    tblRender();
    tblPoll();
  });
}
/* 방장이 테이블에 들어가면 자동으로 방장 프리 */
function tblAutoHostFree() { if (myPlayerId === ROOM_SERVER_HOST && !HOST_FREE) hostFree(); }
function tblLeave() {
  if (!TBL.tid) return;
  var wasOwner = TBL_META && TBL_META.owner === myPlayerId;
  var active = document.querySelector('.view.active');
  DBset(tblKey('tm_' + myPlayerId), null);
  if (wasOwner) DBset(tblKey('tbl_' + myPlayerId), null);
  tblSetCtx(null);
  delete TBL_MEM[myPlayerId];
  if (active && TBL_GAMES[active.id]) goHome();
  tblRender();
  setTimeout(tblPoll, 300);
}
/* 테이블 만든 사람: 시작 (같은 게임 다시 하기도 이걸로) */
function tblOwnerStart(gameId) {
  var t = TBL_META;
  if (!t || t.owner !== myPlayerId) return;
  if (gameId && TBL_GAMES[gameId]) t.game = gameId;
  var g = TBL_GAMES[t.game];
  var n = (t.members || []).length;
  if (n < g.min) { coinToast(g.n + '은(는) ' + g.min + '명 이상이 필요해요'); return; }
  if (t.team && t.team.on) tblEnsureTeams(t);
  t.status = 'play'; t.seq = (t.seq || 0) + 1;
  DBset(tblKey('tbl_' + myPlayerId), t).then(function () { tblFollowTable(t); });
}

/* ---- 팀 나누기 ---- */
function tblEnsureTeams(t) {
  var as = t.team.assign || {}, n = t.team.n || 2;
  (t.members || []).forEach(function (pid) { if (as[pid] == null || as[pid] >= n) as[pid] = -1; });
  var free = t.members.filter(function (pid) { return as[pid] < 0; });
  free.forEach(function (pid) {
    var cnt = [];
    for (var i = 0; i < n; i++) cnt.push(t.members.filter(function (p) { return as[p] === i; }).length);
    as[pid] = cnt.indexOf(Math.min.apply(null, cnt));
  });
  Object.keys(as).forEach(function (pid) { if (t.members.indexOf(pid) < 0) delete as[pid]; });
  t.team.assign = as;
}
function tblTeamSet(patch) {
  var t = TBL_META;
  if (!t || t.owner !== myPlayerId || !t.team) return;
  if (patch.on !== undefined) t.team.on = patch.on;
  if (patch.n) { t.team.n = patch.n; t.team.assign = {}; }
  if (patch.random) {
    var m = shuffleArray(t.members.slice()); t.team.assign = {};
    m.forEach(function (pid, i) { t.team.assign[pid] = i % t.team.n; });
  }
  if (patch.size) {
    t.team.n = Math.max(2, Math.min(4, Math.ceil(t.members.length / patch.size)));
    var m2 = shuffleArray(t.members.slice()); t.team.assign = {};
    m2.forEach(function (pid, i) { t.team.assign[pid] = Math.floor(i / patch.size) % t.team.n; });
  }
  if (patch.move) t.team.assign[patch.move.pid] = patch.move.team;
  tblEnsureTeams(t);
  DBset(tblKey('tbl_' + myPlayerId), t).then(tblRender);
  tblRender();
}
/* 게임이 쓰는 팀 정보: {pid: 팀번호} (팀전이 꺼져 있으면 null) */
function tblTeamConfig() {
  var t = TBL_META;
  if (!TBL.tid || !t || !t.team || !t.team.on) return null;
  tblEnsureTeams(t);
  return { n: t.team.n, assign: t.team.assign };
}

/* ---- 화면 ---- */
function tblShowButton(on) {
  var b = document.getElementById('tbl-fab');
  if (!b) {
    b = document.createElement('button');
    b.id = 'tbl-fab'; b.className = 'tbl-fab'; b.title = '게임 테이블';
    b.innerHTML = '🎮<span class="tbl-fab-n" id="tbl-fab-n"></span>';
    b.onclick = function () { var a = document.querySelector('.view.active'); if (a && a.id === 'tables') closeTables(); else openTables(); };
    document.body.appendChild(b);
  }
  b.style.display = on ? '' : 'none';
}
function openTables() {
  var a = document.querySelector('.view.active');
  if (a && TBL_GAMES[a.id] && !TBL.tid) {
    if (!confirm('지금 게임에서 나가서 테이블 목록으로 갈까요?')) return;
    goHome();
  }
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('tables').classList.add('active');
  tblRender();
  tblPoll();
}
function closeTables() {
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('home').classList.add('active');
}
function tblName(pid) { var p = (ROOM_ALL_PLAYERS || []).filter(function (x) { return x.id === pid; })[0]; return p ? p.name : '?'; }

function tblRender() {
  var n = document.getElementById('tbl-fab-n');
  if (n) { n.textContent = TBL_LIST.length || ''; n.style.display = TBL_LIST.length ? '' : 'none'; }
  var v = document.getElementById('tables');
  if (!v || !v.classList.contains('active')) return;
  var box = document.getElementById('tbl-body');
  var html;
  if (TBL.tid && TBL_META) html = tblRenderMine(TBL_META);
  else {
    html = '<button class="btn btn-primary tbl-new" onclick="tblOpenCreate()">＋ 테이블 만들기</button>';
    html += TBL_LIST.length ? '<div class="tbl-list">' + TBL_LIST.map(function (t) {
      var g = TBL_GAMES[t.game] || { n: t.game };
      var full = t.members.length >= t.max;
      return '<div class="tbl-card' + (t.status === 'play' ? ' play' : '') + '">' +
        '<div class="tbl-card-top"><b>' + esc(g.n) + '</b>' + (t.team && t.team.on ? ' <span class="tbl-tag">팀전</span>' : '') + '<span class="tbl-state">' + (t.status === 'play' ? '🔴 게임 중' : '🟢 대기 중') + '</span></div>' +
        '<div class="tbl-card-sub">👑 ' + esc(t.ownerName || tblName(t.owner)) + ' · <b>' + t.members.length + '/' + t.max + '명</b>' + (t.specs.length ? ' · 👀 ' + t.specs.length : '') + '</div>' +
        '<div class="tbl-card-who">' + t.members.map(function (id) { return esc(tblName(id)); }).join(', ') + '</div>' +
        '<div class="tbl-card-btns">' + (t.status !== 'play' && !full ? '<button class="btn btn-primary" onclick="tblJoin(\'' + t.tid + '\')">참가</button>' : '') + '<button class="btn btn-ghost" onclick="tblJoin(\'' + t.tid + '\', true)">👀 구경</button></div>' +
        '</div>';
    }).join('') + '</div>' : '<div class="tbl-empty">아직 열린 테이블이 없어요.<br>먼저 하나 만들어 보세요!</div>';
  }
  if (box.getAttribute('data-h') !== html) { box.innerHTML = html; box.setAttribute('data-h', html); }
}
function tblRenderMine(t) {
  var g = TBL_GAMES[t.game] || { n: t.game, min: 1 };
  var owner = t.owner === myPlayerId;
  var h = '<div class="tbl-mine"><div class="tbl-mine-title">' + esc(g.n) + ' <small>테이블</small>' + (TBL.spectate ? ' <span class="tbl-tag">👀 구경 중</span>' : '') + '</div>';
  h += '<div class="tbl-mine-sub">' + (t.status === 'play' ? '🔴 게임 중' : '🟢 대기 중') + ' · ' + t.members.length + '/' + t.max + '명 · 최소 ' + g.min + '명</div>';
  if (t.team && t.team.on) {
    tblEnsureTeams(t);
    h += '<div class="tbl-teams">';
    for (var i = 0; i < t.team.n; i++) {
      h += '<div class="tbl-team" data-team="' + i + '" style="--tc:' + TEAM_COLORS[i] + '"><div class="tbl-team-name">' + TEAM_NAMES[i] + '</div>' +
        t.members.filter(function (pid) { return t.team.assign[pid] === i; }).map(function (pid) {
          return '<div class="tbl-chip' + (owner ? ' movable' : '') + '" ' + (owner ? 'draggable="true" ' : '') + 'data-pid="' + pid + '">' + (pid === t.owner ? '👑 ' : '') + esc(tblName(pid)) + (pid === myPlayerId ? ' (나)' : '') + '</div>';
        }).join('') + '</div>';
    }
    h += '</div>';
    if (owner) h += '<div class="tbl-team-ctl">팀 <select onchange="tblTeamSet({n:+this.value})">' + [2, 3, 4].map(function (k) { return '<option' + (k === t.team.n ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>개 · ' +
      '<button class="btn btn-ghost" onclick="tblTeamSet({random:1})">🎲 랜덤</button> ' +
      '<button class="btn btn-ghost" onclick="var s=+prompt(\'몇 명씩 나눌까요?\',\'2\');if(s>0)tblTeamSet({size:s})">👥 몇 명씩</button>' +
      '<div class="tbl-hint">이름을 끌어서(휴대폰은 눌러서) 다른 팀으로 옮길 수 있어요</div></div>';
  } else {
    h += '<div class="tbl-members">' + t.members.map(function (pid) { return '<span class="tbl-chip">' + (pid === t.owner ? '👑 ' : '') + esc(tblName(pid)) + (pid === myPlayerId ? ' (나)' : '') + '</span>'; }).join('') + '</div>';
  }
  if (t.specs.length) h += '<div class="tbl-specs">👀 구경: ' + t.specs.map(function (id) { return esc(tblName(id)); }).join(', ') + '</div>';
  if (owner && g.team) h += '<label class="tbl-teamtoggle"><input type="checkbox" ' + (t.team && t.team.on ? 'checked' : '') + ' onchange="tblToggleTeam(this.checked)"> 팀전으로 하기</label>';
  h += '<div class="tbl-btns">';
  if (owner) h += '<button class="btn btn-primary" onclick="tblOwnerStart()"' + (t.members.length < g.min ? ' disabled' : '') + '>▶ ' + (t.seq ? '한 판 더' : '시작') + '</button>';
  else if (!TBL.spectate) h += '<div class="tbl-wait">⏳ ' + esc(tblName(t.owner)) + '님이 시작하면 같이 시작해요</div>';
  h += '<button class="btn btn-ghost" onclick="tblLeave()">' + (owner ? '테이블 닫기' : '나가기') + '</button></div>';
  h += '<div class="tbl-hint">💬 채팅창의 <b>🎮 테이블</b> 탭은 이 테이블 사람들끼리만 보여요</div></div>';
  return h;
}
function tblToggleTeam(on) {
  var t = TBL_META;
  if (!t || t.owner !== myPlayerId) return;
  t.team = t.team || { on: false, n: 2, assign: {} };
  tblTeamSet({ on: on });
}
/* 팀 칩 옮기기: 끌어서 놓기(컴퓨터) / 눌러서 고른 뒤 팀 칸 누르기(휴대폰) */
var TBL_PICKED = null;
document.addEventListener('dragstart', function (e) { var c = e.target.closest && e.target.closest('.tbl-chip.movable'); if (c) { e.dataTransfer.setData('text/plain', c.getAttribute('data-pid')); } });
document.addEventListener('dragover', function (e) { if (e.target.closest && e.target.closest('.tbl-team')) e.preventDefault(); });
document.addEventListener('drop', function (e) {
  var tm = e.target.closest && e.target.closest('.tbl-team');
  if (!tm) return;
  e.preventDefault();
  var pid = e.dataTransfer.getData('text/plain');
  if (pid) tblTeamSet({ move: { pid: pid, team: +tm.getAttribute('data-team') } });
});
document.addEventListener('click', function (e) {
  if (!e.target.closest) return;
  var c = e.target.closest('.tbl-chip.movable');
  if (c) { TBL_PICKED = c.getAttribute('data-pid'); document.querySelectorAll('.tbl-chip').forEach(function (x) { x.classList.toggle('picked', x === c); }); return; }
  var tm = e.target.closest('.tbl-team');
  if (tm && TBL_PICKED) { var pid = TBL_PICKED; TBL_PICKED = null; tblTeamSet({ move: { pid: pid, team: +tm.getAttribute('data-team') } }); }
});

/* 테이블 만들기 창 */
function tblOpenCreate() {
  var box = document.getElementById('tbl-create');
  var games = Object.keys(TBL_GAMES);
  box.innerHTML = '<div class="donate-card"><div class="donate-title">＋ 테이블 만들기</div>' +
    '<div class="donate-label">무슨 게임?</div><div class="tbl-game-pick">' + games.map(function (g, i) { return '<button type="button" class="donate-chip' + (i === 0 ? ' on' : '') + '" data-g="' + g + '">' + esc(TBL_GAMES[g].n) + '</button>'; }).join('') + '</div>' +
    '<div class="donate-label">최대 몇 명?</div><div class="tbl-count"><button type="button" class="donate-chip" id="tbl-minus">－</button><b id="tbl-n">2</b><button type="button" class="donate-chip" id="tbl-plus">＋</button><small id="tbl-range"></small></div>' +
    '<label class="tbl-teamtoggle" id="tbl-team-row" style="display:none"><input type="checkbox" id="tbl-team-on"> 팀전으로 하기</label>' +
    '<div class="donate-btns" style="margin-top:14px"><button class="btn btn-ghost" onclick="document.getElementById(\'tbl-create\').style.display=\'none\'">취소</button><button class="btn btn-primary" id="tbl-make">열기</button></div></div>';
  box.style.display = 'flex';
  var sel = games[0], n = 2;
  var upd = function () {
    var g = TBL_GAMES[sel];
    n = Math.max(g.min, Math.min(g.max, n));
    document.getElementById('tbl-n').textContent = n;
    document.getElementById('tbl-range').textContent = '(' + g.min + '~' + g.max + '명)';
    document.getElementById('tbl-team-row').style.display = g.team ? '' : 'none';
  };
  box.querySelectorAll('.tbl-game-pick .donate-chip').forEach(function (b) { b.onclick = function () { box.querySelectorAll('.tbl-game-pick .donate-chip').forEach(function (x) { x.classList.toggle('on', x === b); }); sel = b.getAttribute('data-g'); upd(); }; });
  document.getElementById('tbl-minus').onclick = function () { n--; upd(); };
  document.getElementById('tbl-plus').onclick = function () { n++; upd(); };
  document.getElementById('tbl-make').onclick = function () { box.style.display = 'none'; tblCreate(sel, n, document.getElementById('tbl-team-on').checked); };
  box.onclick = function (e) { if (e.target === box) box.style.display = 'none'; };
  upd();
}
