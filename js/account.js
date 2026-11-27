/* 👤 계정 (아이디/비밀번호 로그인)
   로그인하면 이 기기의 게임 기록과 분필이 서버 계정에 자동으로 저장돼요.
   - 저장 대상: 브라우저 저장소(localStorage)에서 'gamehub_'로 시작하는 항목 전부 (분필 지갑, 각 게임 최고 기록 등)
     단, 기기마다 다른 값(서버 주소, 방 코드, 창 위치 등)은 빼요 (ACC_SKIP).
   - 게임 코드는 하나도 안 고쳐도 돼요: 저장소에 쓰는 순간을 지켜보다가 1.5초 뒤 서버로 올려요.
   - 로그인하면 서버 데이터가 이 기기 데이터를 덮어써요. (이 기기에만 있던 항목은 서버로 올라가요)
   - 로그아웃하면 이 기기의 저장 항목을 지워요. (공용 컴퓨터에서 다른 사람이 못 보게. 계정에는 그대로 있어요) */

var ACC_DEFAULT_SERVER = 'https://gamehub-server-tfu5.onrender.com';   /* 서버 주소는 자동으로 들어가요 */
var ACC = { menuOpen: false, admin: false, adminOk: false, adminQ: '', pw: false, adminKey: '', adminRes: null, showServer: false, server: '', id: '', token: '', mode: 'login', open: false, busy: false, msg: '', applying: false, timer: null, state: '' };
var ACC_SKIP = { 'gamehub_server_url': 1, 'gamehub_player_id': 1, 'gamehub_lc_pos': 1, 'gamehub_hw_room': 1, 'gamehub_hw_name': 1, 'gamehub_soc_room': 1, 'gamehub_soc_name': 1, 'gamehub_auth': 1 };

function accSyncable(k) { return typeof k === 'string' && k.indexOf('gamehub_') === 0 && !ACC_SKIP[k]; }

/* 저장소에 쓰는 순간을 지켜봐요 (게임 코드를 고치지 않고도 자동 저장) */
(function () {
  var orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k) {
    var r = orig.apply(this, arguments);
    try { if (this === window.localStorage && ACC.token && !ACC.applying && accSyncable(k)) accDirty(); } catch (e) {}
    return r;
  };
})();

function accLoadAuth() {
  try {
    var a = JSON.parse(localStorage.getItem('gamehub_auth') || 'null');
    if (a && a.token && a.server) { ACC.server = a.server; ACC.id = a.id; ACC.token = a.token; }
  } catch (e) {}
}
function accSaveAuth() {
  try {
    if (ACC.token) localStorage.setItem('gamehub_auth', JSON.stringify({ server: ACC.server, id: ACC.id, token: ACC.token }));
    else localStorage.removeItem('gamehub_auth');
  } catch (e) {}
}
function accNorm(u) { return (typeof normalizeServerUrl === 'function') ? normalizeServerUrl(u) : String(u || '').trim().replace(/\/+$/, ''); }

function accCollect() {
  var blob = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (accSyncable(k)) blob[k] = localStorage.getItem(k);
    }
  } catch (e) {}
  return blob;
}
function accApply(blob) {
  ACC.applying = true;
  try { Object.keys(blob || {}).forEach(function (k) { if (accSyncable(k) && typeof blob[k] === 'string') localStorage.setItem(k, blob[k]); }); } catch (e) {}
  ACC.applying = false;
  if (typeof walletRender === 'function') walletRender();
}
function accWipe() {
  ACC.applying = true;
  try {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (accSyncable(k)) keys.push(k); }
    keys.forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) {}
  ACC.applying = false;
  if (typeof walletRender === 'function') walletRender();
}

function accApi(path, method, body, keepalive, noAuth) {
  var h = { 'Content-Type': 'application/json' };
  if (ACC.token && !noAuth) h['Authorization'] = 'Bearer ' + ACC.token;
  if (/ngrok/i.test(accServer())) h['ngrok-skip-browser-warning'] = '1';   /* ngrok 무료 주소의 경고 화면 건너뛰기 */
  var opt = { method: method, headers: h, cache: 'no-store' };
  if (body) opt.body = JSON.stringify(body);
  if (keepalive) opt.keepalive = true;
  return fetch(accServer() + path, opt).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; });
  });
}

/* ---------- 자동 저장 ---------- */
function accDirty() {
  ACC.state = '저장 중…'; accRenderState();
  clearTimeout(ACC.timer);
  ACC.timer = setTimeout(function () { accPush(false); }, 1500);
}
function accPush(keepalive) {
  if (!ACC.token) return Promise.resolve();
  clearTimeout(ACC.timer);
  return accApi('/api/account/data', 'POST', { blob: accCollect() }, keepalive).then(function (j) {
    if (j._status === 401) return accExpire();
    ACC.state = j._status === 200 ? '☁️ 저장됨' : '⚠️ 저장 실패';
    accRenderState();
  }).catch(function () { ACC.state = '⚠️ 서버에 연결이 안 돼요'; accRenderState(); });
}
function accPull() {
  if (!ACC.token) return;
  ACC.state = '불러오는 중…'; accRenderState();
  accApi('/api/account/data', 'GET').then(function (j) {
    if (j._status === 401) return accExpire();
    if (j._status !== 200) { ACC.state = '⚠️ 불러오기 실패'; return accRenderState(); }
    accApply(j.blob);
    accApplyAdminCoins(j.adminCoins);
    ACC.state = '☁️ 저장됨';
    accRender();
    accPush(false);   /* 이 기기에만 있던 기록도 올려요 */
  }).catch(function () { ACC.state = '⚠️ 서버에 연결이 안 돼요'; accRenderState(); });
}
function accExpire() {
  ACC.token = ''; ACC.id = ''; accSaveAuth();
  ACC.msg = '로그인이 풀렸어요. 다시 로그인해 주세요.'; ACC.open = true; accRender();
}
window.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && ACC.token && ACC.timer) accPush(true); });
window.addEventListener('pagehide', function () { if (ACC.token && ACC.timer) accPush(true); });

/* ---------- 화면 ---------- */
function accOpen(v) { ACC.open = v; ACC.msg = ''; accRender(); }
function accMode(m) { ACC.mode = m; ACC.msg = ''; accRender(); }

function accRenderState() {
  var el = document.getElementById('acc-state'); if (el) el.textContent = ACC.state;
  var chip = document.getElementById('acc-chip-btn'); if (chip && ACC.token) chip.textContent = '👤 ' + ACC.id + ' ' + accStateIcon();
}

function accServer() {
  if (ACC.server) return ACC.server;
  return accNorm((typeof loadSavedServerUrl === 'function' ? loadSavedServerUrl() : '') || ACC_DEFAULT_SERVER);
}
function accSetMsg(t) { ACC.msg = t; var m = document.getElementById(ACC.admin ? 'acc-admin-msg' : 'acc-msg'); if (m) m.textContent = t; }

/* 로그인해야 게임이 보이게 할지 (true: 로그인 창이 먼저 떠요) */
var ACC_REQUIRE_LOGIN = true;
/* 로그인 없이 '둘러보기'를 허용할지 (false: 꼭 로그인해야 해요) */
var ACC_ALLOW_GUEST = false;
function accGateOn() { return ACC_REQUIRE_LOGIN && !ACC.token && !(ACC.guest && ACC_ALLOW_GUEST); }

/* ---------- 관리자 창 (큰 창으로 따로 떠요) ----------
   비밀번호를 치고 들어가면 가입한 사용자가 전부 뜨고, 사람마다
   분필 개수 조절 · 비밀번호 0000 초기화를 할 수 있어요.
   (비밀번호는 서버가 확인해요. 서버를 켤 때 ADMIN_KEY 로 정한 비밀번호예요) */
function accHtmlAdmin() { return ''; }   /* 예전 작은 관리자 칸은 없앴어요 → accRenderAdmin() */
function accAdminModal() {
  var m = document.getElementById('acc-admin-modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'acc-admin-modal'; m.className = 'acc-admin-modal';
    document.body.appendChild(m);
  }
  return m;
}
function accRenderAdmin() {
  var m = accAdminModal();
  if (!ACC.admin) { m.style.display = 'none'; m.innerHTML = ''; accAdminStopTimer(); return; }
  m.style.display = 'flex';
  var tab = ACC.adminTab || 'dash';
  var h = '<div class="acc-admin-card"><div class="acc-admin-head"><b>🔧 관리자</b><span class="hw-spacer"></span>' +
    (ACC.adminOk ? '<button class="btn btn-ghost" onclick="accAdminRefresh()">↻ 새로고침</button>' : '') +
    '<button class="btn btn-ghost" onclick="accAdminOpen(false)">닫기 ✕</button></div>';
  if (!ACC.adminOk) {
    h += '<div class="acc-admin-login"><p>관리자 비밀번호를 치면 관리 화면이 열려요.</p>' +
      '<input id="acc-adminkey" type="password" placeholder="관리자 비밀번호" maxlength="64" autocomplete="off" value="' + esc(ACC.adminKey) + '" onkeydown="if(event.key===\'Enter\')accAdminEnter()" />' +
      '<button class="btn btn-primary" onclick="accAdminEnter()">들어가기</button>' +
      '<div class="acc-msg" id="acc-admin-msg">' + esc(ACC.msg) + '</div></div></div>';
    m.innerHTML = h;
    var k = document.getElementById('acc-adminkey'); if (k) k.focus();
    return;
  }
  var tabs = [['dash', '📊 현황'], ['users', '👥 사용자'], ['rooms', '🏠 방'], ['log', '📜 기록']];
  h += '<div class="acc-atabs">' + tabs.map(function (t) {
    return '<button class="' + (tab === t[0] ? 'on' : '') + '" onclick="accAdminTab(\'' + t[0] + '\')">' + t[1] + '</button>';
  }).join('') + '</div>';
  h += '<div class="acc-msg" id="acc-admin-msg">' + esc(ACC.msg) + '</div>';
  h += '<div class="acc-admin-body">' + (tab === 'users' ? accAdminViewUsers() : tab === 'rooms' ? accAdminViewRooms() : tab === 'log' ? accAdminViewLog() : accAdminViewDash()) + '</div>';
  m.innerHTML = h + '</div>';
}
function accHtmlForm(closable) {
  return '<div class="acc-form">' +
    '<div class="acc-tabs"><button class="' + (ACC.mode === 'login' ? 'on' : '') + '" onclick="accMode(\'login\')">로그인</button>' +
    '<button class="' + (ACC.mode === 'register' ? 'on' : '') + '" onclick="accMode(\'register\')">처음이에요 (가입)</button></div>' +
    (ACC.showServer ? '<input id="acc-server" type="text" placeholder="서버 주소" value="' + esc(accServer()) + '" maxlength="200" autocomplete="off" />' : '') +
    '<input id="acc-id" type="text" placeholder="아이디 (3~16글자)" maxlength="16" autocomplete="username" />' +
    '<input id="acc-pw" type="password" placeholder="비밀번호 (4글자 이상)" maxlength="64" autocomplete="' + (ACC.mode === 'login' ? 'current-password' : 'new-password') + '" onkeydown="if(event.key===\'Enter\')accSubmit()" />' +
    (ACC.mode === 'register' ? '<div class="acc-hint">가입하면 지금 이 기기의 기록과 분필이 계정으로 옮겨져요. 비밀번호를 잃어버리면 관리자에게 말해서 0000으로 초기화할 수 있어요.</div>' : '') +
    '<div class="acc-msg" id="acc-msg">' + esc(ACC.msg) + '</div>' +
    '<div class="acc-actions"><button class="btn btn-primary" id="acc-go" onclick="accSubmit()"' + (ACC.busy ? ' disabled' : '') + '>' + (ACC.mode === 'login' ? '로그인' : '가입하기') + '</button>' +
    (closable ? '<button class="btn btn-ghost" onclick="accOpen(false)">닫기</button>' : '') + '</div></div>';
}
function accHtmlFoot(showServerLink) {
  return '<div class="acc-foot"><button onclick="accAdminOpen(true)">🔧 관리자</button>' +
    (showServerLink ? '<button onclick="ACC.showServer=!ACC.showServer;accRender()">서버 주소 바꾸기</button>' : '') +
    (ACC_ALLOW_GUEST && accGateOn() ? '<button onclick="ACC.guest=true;accRender()">로그인 없이 둘러보기</button>' : '') + '</div>';
}

function accRender() {
  var gate = document.getElementById('acc-gate'), gbox = document.getElementById('acc-gate-box'), box = document.getElementById('acc-box');
  var on = accGateOn();
  if (gate) gate.style.display = on ? 'flex' : 'none';
  if (on && gbox) {   /* 로그인 창: 로그인해야 게임이 보여요 */
    gbox.innerHTML = accHtmlForm(false) + accHtmlFoot(true);
    accRenderAdmin();
    if (box) box.innerHTML = '';
    return;
  }
  if (gbox) gbox.innerHTML = '';
  var chip = document.getElementById('acc-chip-btn');
  if (chip) chip.textContent = ACC.token ? '👤 ' + ACC.id + ' ' + accStateIcon() : '👤 로그인';
  if (!box) return;
  var h = '';
  accRenderAdmin();
  if (ACC.pw && ACC.token) {
    h = '<div class="acc-form"><b>🔑 비밀번호 바꾸기</b>' +
      '<input id="acc-oldpw" type="password" placeholder="지금 비밀번호" maxlength="64" autocomplete="current-password" />' +
      '<input id="acc-newpw" type="password" placeholder="새 비밀번호 (4글자 이상)" maxlength="64" autocomplete="new-password" onkeydown="if(event.key===\'Enter\')accChangePw()" />' +
      '<div class="acc-msg" id="acc-msg">' + esc(ACC.msg) + '</div>' +
      '<div class="acc-actions"><button class="btn btn-primary" onclick="accChangePw()">바꾸기</button><button class="btn btn-ghost" onclick="accPwOpen(false)">닫기</button></div></div>';
  } else if (ACC.token && ACC.menuOpen) {
    h = '<div class="acc-menu-head"><b>' + esc(ACC.id) + '</b>님<small id="acc-state">' + esc(ACC.state || '☁️ 저장됨') + '</small></div>' +
        '<button class="acc-menu-item" onclick="accPwOpen(true)">🔑 비밀번호 변경</button>' +
        '<button class="acc-menu-item" onclick="accAdminOpen(true)">🔧 관리자</button>' +
        '<button class="acc-menu-item" onclick="accLogout()">🚪 로그아웃</button>' +
        (ACC.msg ? '<div class="acc-msg">' + esc(ACC.msg) + '</div>' : '');
  } else if (!ACC.token && ACC.open) {
    h = accHtmlForm(true) + accHtmlFoot(true);
  } else if (ACC.msg && ACC.token && !ACC.admin) {
    h = '<div class="acc-msg">' + esc(ACC.msg) + '</div>';
  }
  box.innerHTML = h;
  box.style.display = h ? '' : 'none';
}

function accStateIcon() {
  var s = ACC.state || '';
  return s.indexOf('저장 중') > -1 || s.indexOf('불러오는') > -1 ? '⏳' : s.indexOf('⚠') > -1 ? '⚠️' : '☁️';
}
/* 오른쪽 위 버튼: 로그인 상태면 메뉴(비번 변경·관리자·로그아웃), 아니면 로그인 칸 */
function accMenu() {
  if (ACC.admin || ACC.pw) { ACC.admin = false; ACC.pw = false; ACC.menuOpen = false; ACC.adminKey = ''; ACC.msg = ''; return accRender(); }
  if (ACC.token) ACC.menuOpen = !ACC.menuOpen; else ACC.open = !ACC.open;
  ACC.msg = ''; accRender();
}
document.addEventListener('click', function (e) {
  if (ACC.menuOpen && !(e.target.closest && e.target.closest('#acc-chip'))) { ACC.menuOpen = false; accRender(); }
});

function accPwOpen(v) { ACC.pw = v; ACC.menuOpen = false; ACC.msg = ''; accRender(); }
function accChangePw() {
  var o = document.getElementById('acc-oldpw').value, n = document.getElementById('acc-newpw').value;
  if (!o || !n) return accSetMsg('두 칸 모두 써주세요');
  accSetMsg('바꾸는 중…');
  accApi('/api/account/password', 'POST', { oldPassword: o, newPassword: n }).then(function (j) {
    if (j._status === 200) { ACC.pw = false; ACC.msg = '비밀번호를 바꿨어요 🔑'; accRender(); }
    else if (j._status === 401 && j.error === 'unauthorized') accExpire();
    else accSetMsg(j.message || '잘 안 됐어요');
  }).catch(function () { accSetMsg('서버에 연결이 안 돼요'); });
}

/* ---------- 관리자: 현황 · 사용자 · 방 · 기록 ---------- */
var ACC_ADMIN_OLD = '서버가 옛 버전이에요. 새 server.js 를 서버에 올려 주세요.';
function accAdminStopTimer() { if (ACC.adminTimer) { clearInterval(ACC.adminTimer); ACC.adminTimer = null; } }
function accAdminStartTimer() {
  accAdminStopTimer();
  ACC.adminTimer = setInterval(function () {
    if (!ACC.admin || !ACC.adminOk || document.hidden) return;
    var t = ACC.adminTab || 'dash';
    if (t === 'dash' || t === 'rooms') accAdminRefresh(true);
  }, 10000);
}
function accAdminOpen(v) {
  ACC.admin = v; ACC.menuOpen = false; ACC.msg = ''; ACC.adminRes = null; ACC.adminOk = false; ACC.adminQ = '';
  ACC.adminTab = 'dash'; ACC.adminStats = null; ACC.adminRooms = null; ACC.adminLog = null; ACC.adminSort = 'recent';
  if (!v) { ACC.adminKey = ''; accAdminStopTimer(); }
  accRender();
}
function accAdminEnter() {
  var k = document.getElementById('acc-adminkey');
  var key = k ? k.value : ACC.adminKey;
  if (!key) return accSetMsg('관리자 비밀번호를 써주세요');
  ACC.adminKey = key; ACC.adminQ = '';
  accAdminCall('/api/admin/search', {}).then(function (j) {
    if (!j) return;
    ACC.adminOk = true; ACC.adminRes = j.users || []; ACC.adminTotal = j.total;
    ACC.adminTab = 'dash'; ACC.msg = '';
    accAdminStartTimer();
    accAdminRefresh();
  });
}
/* 서버 호출 공통: 오류는 여기서 안내하고 null 을 돌려줘요 */
function accAdminCall(path, extra, quiet) {
  var body = { adminKey: ACC.adminKey };
  for (var k in (extra || {})) body[k] = extra[k];
  return accApi(path, 'POST', body, false, true).then(function (j) {
    if (j._status === 200) return j;
    if (j._status === 401 || j._status === 403) {
      ACC.adminOk = false; ACC.adminRes = null; ACC.msg = '관리자 비밀번호가 달라요'; accRender(); return null;
    }
    if (j.error === 'admin_off') {
      ACC.adminOk = false; ACC.msg = '서버에 관리자 비밀번호가 안 정해져 있어요. 서버 설정의 ADMIN_KEY 를 확인하고 서버를 다시 켜 주세요.'; accRender(); return null;
    }
    if (j._status === 404 && j.error === 'not_found' || j._status === 404 && !j.error) { if (!quiet) accSetMsg(ACC_ADMIN_OLD); return null; }
    if (!quiet) accSetMsg(j.message || '잘 안 됐어요 (' + j._status + ')');
    return null;
  }).catch(function () { if (!quiet) accSetMsg('서버에 연결이 안 돼요'); return null; });
}
function accAdminTab(t) {
  ACC.adminTab = t; ACC.msg = ''; accRender(); accAdminRefresh();
}
function accAdminRefresh(silent) {
  var t = ACC.adminTab || 'dash';
  if (t === 'users') return accAdminLoad(silent);
  var path = t === 'rooms' ? '/api/admin/rooms' : t === 'log' ? '/api/admin/log' : '/api/admin/stats';
  return accAdminCall(path, {}, silent).then(function (j) {
    if (!j) return;
    if (t === 'rooms') ACC.adminRooms = j.rooms || [];
    else if (t === 'log') ACC.adminLog = j.log || [];
    else ACC.adminStats = j;
    if (!silent) ACC.msg = '';
    if (ACC.adminTab === t) accRender();
  });
}
function accAdminLoad(silent) {
  var qEl = document.getElementById('acc-q');
  var q = qEl ? qEl.value : (ACC.adminQ || '');
  ACC.adminQ = q;
  if (!ACC.adminKey) return accSetMsg('관리자 비밀번호를 써주세요');
  if (!silent) accSetMsg('불러오는 중…');
  return accAdminCall('/api/admin/search', { query: q }).then(function (j) {
    if (!j) return;
    ACC.adminRes = j.users || []; ACC.adminTotal = j.total;
    ACC.msg = ACC.adminRes.length ? '전체 ' + accNum(j.total != null ? j.total : ACC.adminRes.length) + '명 중 ' + accNum(ACC.adminRes.length) + '명' : '그런 아이디가 없어요';
    var keep = (document.getElementById('acc-q') || {}).value;
    accRender();
    var el = document.getElementById('acc-q'); if (el && keep != null) el.value = keep;
  });
}

/* ----- 보기 좋게 바꾸는 도우미 ----- */
function accNum(n) { return (n == null || isNaN(n)) ? '-' : Number(n).toLocaleString('ko-KR'); }
function accBytes(b) { if (b == null) return '-'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }
function accDur(sec) {
  var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
  return (d ? d + '일 ' : '') + (d || h ? h + '시간 ' : '') + m + '분';
}
function accAgo(t) {
  if (!t) return '기록 없음';
  var s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return '방금 전'; if (s < 3600) return Math.floor(s / 60) + '분 전';
  if (s < 86400) return Math.floor(s / 3600) + '시간 전'; if (s < 86400 * 30) return Math.floor(s / 86400) + '일 전';
  return accDay(t);
}
function accDay(t) { if (!t) return '-'; var d = new Date(t); return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(); }
function accTime(t) { var d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

/* ----- 📊 현황 ----- */
function accAdminViewDash() {
  var s = ACC.adminStats;
  if (!s) return '<div class="acc-admin-empty">불러오는 중…</div>';
  function card(label, val, sub) { return '<div class="acc-stat"><small>' + label + '</small><b>' + val + '</b>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>'; }
  var h = '<div class="acc-stats">' +
    card('전체 사용자', accNum(s.users), '최대 ' + accNum(s.maxUsers) + '명') +
    card('최근 10분 활동', accNum(s.activeNow), '24시간 ' + accNum(s.active24) + '명') +
    card('로그인된 기기', accNum(s.sessions), '정지 계정 ' + accNum(s.banned) + '명') +
    card('열려 있는 방', accNum(s.rooms), '참가자 ' + accNum(s.roomPlayers) + '명') +
    card('분필 합계', accNum(s.coinsSum), '') +
    card('서버 켜진 지', accDur(s.uptimeSec), accDay(s.startedAt) + ' 시작') + '</div>';
  var max = Math.max.apply(null, s.signups7.concat([1]));
  h += '<div class="acc-sect"><b>최근 7일 가입</b><div class="acc-bars">';
  for (var i = 6; i >= 0; i--) {
    var n = s.signups7[i];
    h += '<div class="acc-bar"><span>' + n + '</span><i style="height:' + Math.max(3, Math.round(n / max * 64)) + 'px"></i><small>' + (i === 0 ? '오늘' : i + '일 전') + '</small></div>';
  }
  h += '</div></div>';
  h += '<div class="acc-sect"><b>서버 정보</b><div class="acc-kv">' +
    '<span>메모리 사용</span><span>' + accBytes(s.rss) + ' <small>(힙 ' + accBytes(s.heapUsed) + ')</small></span>' +
    '<span>계정 파일 크기</span><span>' + accBytes(s.fileBytes) + '</span>' +
    '<span>사용자 저장 데이터</span><span>' + accBytes(s.blobBytes) + '</span>' +
    '<span>방 놀이 저장 항목</span><span>' + accNum(s.storeEntries) + '개</span>' +
    '<span>Node / 운영체제</span><span>' + esc(s.node) + ' · ' + esc(s.platform) + '</span>' +
    '<span>서버 주소</span><span>' + esc(accServer()) + '</span></div></div>';
  h += '<div class="acc-sect"><b>백업</b><div class="acc-admin-act">' +
    '<button class="acc-btn" onclick="accAdminBackup()">⬇ 계정 백업 내려받기</button>' +
    '<button class="acc-btn" onclick="document.getElementById(\'acc-restore-file\').click()">⬆ 백업에서 복원</button>' +
    '<input type="file" id="acc-restore-file" accept=".json,application/json" style="display:none" onchange="accAdminRestore(this)" /></div>' +
    '<small class="acc-note">무료 서버는 재시작할 때 계정이 사라질 수 있어요. 가끔 백업해 두세요. 복원은 없는 계정만 다시 만들고, 이미 있는 계정은 건드리지 않아요.</small></div>';
  return h;
}
function accAdminBackup() {
  accAdminCall('/api/admin/backup', {}).then(function (j) {
    if (!j) return;
    var blob = new Blob([JSON.stringify(j)], { type: 'application/json' });
    var a = document.createElement('a'); var d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = '게임판_계정백업_' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    accSetMsg('✅ 계정 ' + accNum(Object.keys(j.users || {}).length) + '명을 백업했어요');
  });
}
function accAdminRestore(inp) {
  var f = inp.files && inp.files[0]; inp.value = '';
  if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    var data; try { data = JSON.parse(r.result); } catch (e) { return accSetMsg('백업 파일을 읽을 수 없어요'); }
    if (!data || !data.users) return accSetMsg('게임판 백업 파일이 아니에요');
    if (!confirm('백업 파일의 계정 ' + accNum(Object.keys(data.users).length) + '명을 복원할까요?\n(이미 있는 계정은 그대로 두고, 없는 계정만 다시 만들어요)')) return;
    accAdminCall('/api/admin/restore', { users: data.users }).then(function (j) {
      if (j) { accSetMsg('✅ ' + accNum(j.added) + '명 복원, ' + accNum(j.skipped) + '명 건너뜀'); }
    });
  };
  r.readAsText(f);
}

/* ----- 👥 사용자 ----- */
function accAdminSorted() {
  var l = (ACC.adminRes || []).slice(), s = ACC.adminSort || 'recent';
  var by = {
    recent: function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); },
    joined: function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); },
    coins: function (a, b) { return (b.coins || 0) - (a.coins || 0); },
    name: function (a, b) { return String(a.id).toLowerCase() < String(b.id).toLowerCase() ? -1 : 1; }
  };
  return l.sort(by[s] || by.recent);
}
function accAdminSort(v) { ACC.adminSort = v; var keep = (document.getElementById('acc-q') || {}).value; ACC.adminQ = keep || ''; accRender(); }
function accAdminViewUsers() {
  var sorts = [['recent', '최근 활동순'], ['joined', '최근 가입순'], ['coins', '분필 많은 순'], ['name', '이름순']];
  var h = '<div class="acc-admin-tools"><input id="acc-q" type="text" placeholder="아이디 검색 (비우면 전체)" maxlength="16" autocomplete="off" value="' + esc(ACC.adminQ || '') + '" onkeydown="if(event.key===\'Enter\')accAdminLoad()" />' +
    '<select class="acc-sel" onchange="accAdminSort(this.value)">' + sorts.map(function (o) { return '<option value="' + o[0] + '"' + ((ACC.adminSort || 'recent') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
    '<button class="btn btn-primary" onclick="accAdminLoad()">검색</button></div><div class="acc-admin-list">';
  var list = accAdminSorted();
  list.forEach(function (u) {
    var id = esc(u.id);
    h += '<div class="acc-admin-row' + (u.banned ? ' banned' : '') + '"><div class="acc-admin-who"><b>' + id +
      (u.banned ? ' <span class="acc-pill red">정지됨</span>' : '') +
      (u.sessions ? ' <span class="acc-pill green">로그인 ' + u.sessions + '기기</span>' : '') + '</b>' +
      '<span class="acc-admin-coins">분필 <b id="acc-c-' + id + '">' + (u.coins != null ? accNum(u.coins) : '-') + '</b></span>' +
      '<small>가입 ' + accDay(u.createdAt) + ' · 최근 활동 ' + accAgo(u.updatedAt) + ' · 최근 로그인 ' + accAgo(u.lastLoginAt) + ' · 저장 ' + accBytes(u.bytes) + '</small></div>' +
      '<div class="acc-admin-act">' +
      '<button class="acc-btn" data-id="' + id + '" data-d="-100" onclick="accAdminDelta(this.dataset.id,+this.dataset.d)">-100</button>' +
      '<button class="acc-btn" data-id="' + id + '" data-d="-10" onclick="accAdminDelta(this.dataset.id,+this.dataset.d)">-10</button>' +
      '<button class="acc-btn" data-id="' + id + '" data-d="10" onclick="accAdminDelta(this.dataset.id,+this.dataset.d)">+10</button>' +
      '<button class="acc-btn" data-id="' + id + '" data-d="100" onclick="accAdminDelta(this.dataset.id,+this.dataset.d)">+100</button>' +
      '<input type="number" min="0" class="acc-admin-num" id="acc-n-' + id + '" placeholder="개수" onkeydown="if(event.key===\'Enter\')accAdminSetCoins(this.id.slice(6))" />' +
      '<button class="acc-btn" data-id="' + id + '" onclick="accAdminSetCoins(this.dataset.id)">분필 설정</button>' +
      '<button class="acc-btn" data-id="' + id + '" onclick="accAdminKick(this.dataset.id)">강제 로그아웃</button>' +
      '<button class="acc-btn" data-id="' + id + '" onclick="accAdminBan(this.dataset.id,' + (u.banned ? 'false' : 'true') + ')">' + (u.banned ? '정지 해제' : '이용 정지') + '</button>' +
      '<button class="acc-btn warn" data-id="' + id + '" onclick="accAdminReset(this.dataset.id)">비번 0000으로</button>' +
      '<button class="acc-btn warn" data-id="' + id + '" onclick="accAdminDelete(this.dataset.id)">삭제</button></div></div>';
  });
  if (!list.length) h += '<div class="acc-admin-empty">사용자가 없어요</div>';
  return h + '</div>';
}
function accAdminUser(id) { return (ACC.adminRes || []).filter(function (u) { return u.id === id; })[0]; }
function accAdminSendCoins(id, coins) {
  coins = Math.max(0, Math.floor(coins));
  accSetMsg(id + ' 분필을 ' + coins + '개로 바꾸는 중…');
  accAdminCall('/api/admin/coins', { id: id, coins: coins }).then(function (j) {
    if (!j) return;
    var u = accAdminUser(id); if (u) u.coins = (j.coins != null ? j.coins : coins);
    ACC.msg = '✅ ' + id + ' 분필 ' + accNum(u ? u.coins : coins) + '개';
    var keep = (document.getElementById('acc-q') || {}).value; ACC.adminQ = keep || '';
    accRender();
  });
}
function accAdminSetCoins(id) {
  var el = document.getElementById('acc-n-' + id);
  var v = el ? el.value : '';
  if (v === '' || isNaN(+v) || +v < 0) return accSetMsg('분필 개수를 0 이상 숫자로 써주세요');
  accAdminSendCoins(id, +v);
}
function accAdminDelta(id, d) {
  var u = accAdminUser(id);
  accAdminSendCoins(id, Math.max(0, ((u && u.coins) || 0) + d));
}
function accAdminReset(id) {
  if (!confirm(id + ' 님의 비밀번호를 0000으로 초기화할까요?\n(로그인돼 있던 기기는 로그아웃돼요)')) return;
  accAdminCall('/api/admin/reset', { id: id }).then(function (j) { if (j) { accSetMsg('✅ ' + id + ' 비밀번호를 0000으로 바꿨어요'); accAdminLoad(true); } });
}
function accAdminKick(id) {
  if (!confirm(id + ' 님이 로그인한 모든 기기를 로그아웃시킬까요?')) return;
  accAdminCall('/api/admin/kick', { id: id }).then(function (j) { if (j) { accSetMsg('✅ ' + id + ' ' + j.devices + '기기를 로그아웃시켰어요'); accAdminLoad(true); } });
}
function accAdminBan(id, on) {
  if (!confirm(on ? id + ' 님의 이용을 정지할까요?\n(로그인돼 있던 기기는 로그아웃되고, 다시 로그인할 수 없어요)' : id + ' 님의 정지를 풀까요?')) return;
  accAdminCall('/api/admin/ban', { id: id, banned: on }).then(function (j) { if (j) { accSetMsg(on ? '🚫 ' + id + ' 이용을 정지했어요' : '✅ ' + id + ' 정지를 풀었어요'); accAdminLoad(true); } });
}
function accAdminDelete(id) {
  var t = prompt('⚠️ 계정을 삭제하면 저장된 기록과 분필이 모두 사라지고 되돌릴 수 없어요.\n삭제하려면 아이디 "' + id + '" 를 그대로 입력하세요.');
  if (t === null) return;
  if (t.trim().toLowerCase() !== String(id).toLowerCase()) return accSetMsg('아이디가 달라서 삭제하지 않았어요');
  accAdminCall('/api/admin/delete', { id: id }).then(function (j) { if (j) { accSetMsg('🗑 ' + id + ' 계정을 삭제했어요'); accAdminLoad(true); } });
}

/* ----- 🏠 방 ----- */
function accAdminViewRooms() {
  var list = ACC.adminRooms;
  if (!list) return '<div class="acc-admin-empty">불러오는 중…</div>';
  if (!list.length) return '<div class="acc-admin-empty">지금 열려 있는 방이 없어요</div>';
  return '<div class="acc-admin-list">' + list.map(function (r) {
    var live = r.players.filter(function (p) { return !p.away; }).length;
    return '<div class="acc-admin-row"><div class="acc-admin-who"><b>방 ' + esc(r.code) + (r.currentGame ? ' <span class="acc-pill">' + esc(r.currentGame) + '</span>' : '') + '</b>' +
      '<span class="acc-admin-coins">방장 ' + (r.hostName ? esc(r.hostName) : '-') + ' · 참가자 ' + r.players.length + '명 (접속 ' + live + ')</span>' +
      '<small>' + r.players.map(function (p) { return esc(p.name) + (p.away ? '(자리 비움)' : ''); }).join(', ') + ' · 마지막 활동 ' + accAgo(r.updatedAt) + '</small></div>' +
      '<div class="acc-admin-act"><button class="acc-btn warn" data-code="' + esc(r.code) + '" onclick="accAdminCloseRoom(this.dataset.code)">방 닫기</button></div></div>';
  }).join('') + '</div>';
}
function accAdminCloseRoom(code) {
  if (!confirm('방 ' + code + ' 을 닫을까요?\n(그 방의 놀이 기록도 함께 지워져요)')) return;
  accAdminCall('/api/admin/closeroom', { code: code }).then(function (j) { if (j) { accSetMsg('✅ 방 ' + code + ' 을 닫았어요'); accAdminRefresh(true); } });
}

/* ----- 📜 기록 ----- */
function accAdminViewLog() {
  var list = ACC.adminLog;
  if (!list) return '<div class="acc-admin-empty">불러오는 중…</div>';
  if (!list.length) return '<div class="acc-admin-empty">아직 관리자 작업 기록이 없어요</div>';
  return '<div class="acc-admin-list">' + list.map(function (e) {
    return '<div class="acc-logrow"><span class="acc-logt">' + accTime(e.t) + '</span><b>' + esc(e.a) + '</b>' +
      (e.u ? '<span class="acc-pill">' + esc(e.u) + '</span>' : '') + (e.d ? '<span class="acc-logd">' + esc(e.d) + '</span>' : '') + '</div>';
  }).join('') + '</div><small class="acc-note">최근 100개까지 보여요. 서버를 새로 켜도 계정 파일에 같이 저장돼요.</small>';
}

/* ---------- 관리자가 바꾼 분필을 사용자 기기에 반영 ----------
   서버가 /api/account/data 응답에 adminCoins: { rev, coins } 를 담아 주면,
   처음 보는 rev일 때 내 지갑의 분필을 그 값으로 바꿔요. (로그인 중엔 20초마다 확인) */
var ACC_COIN_REV_KEY = 'gamehub_admin_coin_rev';
function accApplyAdminCoins(ac) {
  if (!ac || typeof ac.coins !== 'number' || !ac.rev) return;
  var seen = 0;
  try { seen = +localStorage.getItem(ACC_COIN_REV_KEY) || 0; } catch (e) {}
  if (ac.rev <= seen) return;
  try {
    var w = walletLoad(); w.coins = Math.max(0, Math.round(ac.coins)); walletSave(w);
    localStorage.setItem(ACC_COIN_REV_KEY, String(ac.rev));
    if (typeof coinToast === 'function') coinToast('관리자가 분필을 ' + w.coins + '개로 바꿨어요');
  } catch (e) {}
}
setInterval(function () {
  if (!ACC.token || document.visibilityState === 'hidden') return;
  accApi('/api/account/data', 'GET').then(function (j) { if (j._status === 200 && j.adminCoins) accApplyAdminCoins(j.adminCoins); }).catch(function () {});
}, 20000);

function accSubmit() {
  if (ACC.busy) return;
  var sEl = document.getElementById('acc-server');
  var server = accNorm(sEl ? sEl.value : accServer());
  var id = document.getElementById('acc-id').value.trim();
  var pw = document.getElementById('acc-pw').value;
  function fail(t) { accSetMsg(t); }
  if (!server) return fail('서버 주소를 써주세요');
  if (!id || !pw) return fail('아이디와 비밀번호를 써주세요');
  ACC.busy = true; ACC.server = server; fail('확인하는 중…');
  var go = document.getElementById('acc-go'); if (go) go.disabled = true;
  var reg = ACC.mode === 'register';
  var body = reg ? { id: id, password: pw, blob: accCollect() } : { id: id, password: pw };
  accApi(reg ? '/api/auth/register' : '/api/auth/login', 'POST', body).then(function (j) {
    ACC.busy = false;
    if (j._status !== 200 || !j.token) {
      var go2 = document.getElementById('acc-go'); if (go2) go2.disabled = false;
      return fail(j.message || '잘 안 됐어요. 서버 주소를 확인해 주세요 (' + j._status + ')');
    }
    ACC.token = j.token; ACC.id = j.id; ACC.msg = ''; ACC.open = false; ACC.state = '☁️ 저장됨';
    accSaveAuth();
    if (typeof saveServerUrl === 'function') saveServerUrl(server);   /* 온라인 방 입장 화면에도 서버 주소가 채워져요 */
    accApply(j.blob);
    accApplyAdminCoins(j.adminCoins);
    accRender();
    accPush(false);   /* 이 기기에만 있던 기록도 올려요 */
  }).catch(function () {
    ACC.busy = false;
    var go3 = document.getElementById('acc-go'); if (go3) go3.disabled = false;
    fail('서버에 연결이 안 돼요. 서버가 잠들어 있을 수 있으니 잠시 뒤에 다시 해봐요.');
  });
}

function accLogout() {
  if (!confirm('로그아웃할까요?\n이 기기에 있는 기록과 분필은 지워져요. (계정에는 그대로 저장돼 있어요)')) return;
  var p = ACC.token ? accPush(false) : Promise.resolve();   /* 마지막으로 한 번 더 저장 */
  Promise.resolve(p).then(function () { return accApi('/api/auth/logout', 'POST', {}); }).catch(function () {}).then(function () {
    ACC.token = ''; ACC.id = ''; ACC.state = ''; ACC.menuOpen = false; accSaveAuth(); accWipe(); accRender();
  });
}

(function () { accLoadAuth(); accRender(); if (ACC.token) accPull(); })();
