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
   (비밀번호는 서버가 확인해요. 서버의 관리자 비밀번호를 einbe4039 로 맞춰 두세요) */
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
  if (!ACC.admin) { m.style.display = 'none'; m.innerHTML = ''; return; }
  m.style.display = 'flex';
  var h = '<div class="acc-admin-card"><div class="acc-admin-head"><b>🔧 관리자</b><span class="hw-spacer"></span>' +
    (ACC.adminOk ? '<button class="btn btn-ghost" onclick="accAdminLoad()">↻ 새로고침</button>' : '') +
    '<button class="btn btn-ghost" onclick="accAdminOpen(false)">닫기 ✕</button></div>';
  if (!ACC.adminOk) {
    h += '<div class="acc-admin-login"><p>관리자 비밀번호를 치면 사용자 목록이 떠요.</p>' +
      '<input id="acc-adminkey" type="password" placeholder="관리자 비밀번호" maxlength="64" autocomplete="off" value="' + esc(ACC.adminKey) + '" onkeydown="if(event.key===\'Enter\')accAdminEnter()" />' +
      '<button class="btn btn-primary" onclick="accAdminEnter()">들어가기</button>' +
      '<div class="acc-msg" id="acc-admin-msg">' + esc(ACC.msg) + '</div></div></div>';
    m.innerHTML = h;
    var k = document.getElementById('acc-adminkey'); if (k) k.focus();
    return;
  }
  h += '<div class="acc-admin-tools"><input id="acc-q" type="text" placeholder="아이디 검색 (비우면 전체)" maxlength="16" autocomplete="off" value="' + esc(ACC.adminQ || '') + '" onkeydown="if(event.key===\'Enter\')accAdminLoad()" />' +
    '<button class="btn btn-primary" onclick="accAdminLoad()">검색</button></div>' +
    '<div class="acc-msg" id="acc-admin-msg">' + esc(ACC.msg) + '</div><div class="acc-admin-list">';
  (ACC.adminRes || []).forEach(function (u) {
    var id = esc(u.id);
    h += '<div class="acc-admin-row"><div class="acc-admin-who"><b>' + id + '</b>' +
      '<span class="acc-admin-coins">분필 <b id="acc-c-' + id + '">' + (u.coins != null ? esc(u.coins) : '-') + '</b></span>' +
      '<small>' + (u.updatedAt ? new Date(u.updatedAt).toLocaleString() : '') + '</small></div>' +
      '<div class="acc-admin-act">' +
      '<button class="acc-btn" data-id="' + id + '" data-d="-100" onclick="accAdminDelta(this.dataset.id,+this.dataset.d)">-100</button>' +
      '<button class="acc-btn" data-id="' + id + '" data-d="-10" onclick="accAdminDelta(this.dataset.id,+this.dataset.d)">-10</button>' +
      '<button class="acc-btn" data-id="' + id + '" data-d="10" onclick="accAdminDelta(this.dataset.id,+this.dataset.d)">+10</button>' +
      '<button class="acc-btn" data-id="' + id + '" data-d="100" onclick="accAdminDelta(this.dataset.id,+this.dataset.d)">+100</button>' +
      '<input type="number" min="0" class="acc-admin-num" id="acc-n-' + id + '" placeholder="개수" onkeydown="if(event.key===\'Enter\')accAdminSetCoins(this.id.slice(6))" />' +
      '<button class="acc-btn" data-id="' + id + '" onclick="accAdminSetCoins(this.dataset.id)">분필 설정</button>' +
      '<button class="acc-btn warn" data-id="' + id + '" onclick="accAdminReset(this.dataset.id)">비번 0000으로</button>' +
      '</div></div>';
  });
  if (!(ACC.adminRes || []).length) h += '<div class="acc-admin-empty">사용자가 없어요</div>';
  m.innerHTML = h + '</div></div>';
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

/* ---------- 관리자: 사용자 전부 보기 · 분필 조절 · 비밀번호 초기화 ---------- */
function accAdminOpen(v) {
  ACC.admin = v; ACC.menuOpen = false; ACC.msg = ''; ACC.adminRes = null; ACC.adminOk = false; ACC.adminQ = '';
  if (!v) ACC.adminKey = '';
  accRender();
}
function accAdminEnter() {
  var k = document.getElementById('acc-adminkey');
  var key = k ? k.value : ACC.adminKey;
  if (!key) return accSetMsg('관리자 비밀번호를 써주세요');
  ACC.adminKey = key; ACC.adminQ = '';
  accAdminLoad();
}
function accAdminLoad() {
  var qEl = document.getElementById('acc-q');
  var q = qEl ? qEl.value : (ACC.adminQ || '');
  ACC.adminQ = q;
  if (!ACC.adminKey) return accSetMsg('관리자 비밀번호를 써주세요');
  accSetMsg('불러오는 중…');
  accApi('/api/admin/search', 'POST', { adminKey: ACC.adminKey, query: q }, false, true).then(function (j) {
    if (j._status !== 200) {
      ACC.adminOk = false; ACC.adminRes = null;
      ACC.msg = (j._status === 401 || j._status === 403) ? '관리자 비밀번호가 달라요' : (j.message || '잘 안 됐어요 (' + j._status + ')');
      accRender(); return;
    }
    ACC.adminOk = true;
    ACC.adminRes = j.users || [];
    ACC.msg = ACC.adminRes.length ? '전체 ' + (j.total != null ? j.total : ACC.adminRes.length) + '명 중 ' + ACC.adminRes.length + '명' : '그런 아이디가 없어요';
    accRender();
  }).catch(function () { accSetMsg('서버에 연결이 안 돼요'); });
}
function accAdminUser(id) { return (ACC.adminRes || []).filter(function (u) { return u.id === id; })[0]; }
function accAdminSendCoins(id, coins) {
  coins = Math.max(0, Math.floor(coins));
  accSetMsg(id + ' 분필을 ' + coins + '개로 바꾸는 중…');
  accApi('/api/admin/coins', 'POST', { adminKey: ACC.adminKey, id: id, coins: coins }, false, true).then(function (j) {
    if (j._status === 200) {
      var u = accAdminUser(id); if (u) u.coins = (j.coins != null ? j.coins : coins);
      ACC.msg = '✅ ' + id + ' 분필 ' + (u ? u.coins : coins) + '개';
      accRender();
    } else if (j._status === 404) accSetMsg('서버에 분필 조절 기능(/api/admin/coins)이 아직 없어요. 서버_관리자_패치.md 를 서버에 넣어 주세요.');
    else accSetMsg(j.message || '잘 안 됐어요 (' + j._status + ')');
  }).catch(function () { accSetMsg('서버에 연결이 안 돼요'); });
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
  accApi('/api/admin/reset', 'POST', { adminKey: ACC.adminKey, id: id }, false, true).then(function (j) {
    accSetMsg(j._status === 200 ? '✅ ' + id + ' 비밀번호를 0000으로 바꿨어요' : (j.message || '잘 안 됐어요'));
  }).catch(function () { accSetMsg('서버에 연결이 안 돼요'); });
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
