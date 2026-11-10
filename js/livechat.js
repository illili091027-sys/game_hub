/* 분필 아이콘 (사용자가 준 분필통 그림) */
var CHALK_SRC = 'data:image/png;base64,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';
var CHALK_IMG = '<img class="chalk-ic" src="' + CHALK_SRC + '" alt="분필" />';
function chalkify(html) { return String(html).replace(/🖍️/g, CHALK_IMG); }
/* ===================== 분필 · 후원 · 화면공유 실시간 채팅 =====================
   1) 분필: 게임이 끝나면 등수대로 분필을 받아요. 분필은 '이 기기(브라우저)'에 저장돼서
      서버 주소나 방 코드가 바뀌어도 그대로 남아요.
   2) 후원: 분필을 친구에게 보내면서 메시지를 남겨요. 방 모두에게 후원 알림이 크게 뜨고,
      메시지를 목소리로 읽어줘요. 받은 사람 기기에 분필이 들어가요.
      (후원은 방 채팅에 특별한 메시지로 올라가요. 그래서 채팅 기록에도 남아요)
   3) 화면공유 채팅: 화면을 보는 사람은 영상 오른쪽 아래에서 채팅, 공유하는 사람은
      실시간 채팅창이 떠요(끌어서 위치 옮기기). 방 채팅과 같은 대화예요. */

/* ---------- 분필 지갑 (이 기기에 저장) ---------- */
var WALLET_KEY = 'gamehub_wallet_v1';
function walletLoad() {
  try { var w = JSON.parse(localStorage.getItem(WALLET_KEY) || 'null'); if (w && typeof w.coins === 'number') return w; } catch (e) {}
  return { coins: 100, got: {}, awarded: {} };   /* 처음엔 분필 100개 선물 */
}
function walletSave(w) {
  /* 기록이 너무 쌓이지 않게 최근 것만 */
  ['got', 'awarded'].forEach(function (k) {
    var keys = Object.keys(w[k] || {});
    if (keys.length > 300) keys.sort(function (a, b) { return w[k][a] - w[k][b]; }).slice(0, keys.length - 300).forEach(function (x) { delete w[k][x]; });
  });
  try { localStorage.setItem(WALLET_KEY, JSON.stringify(w)); } catch (e) {}
  walletRender();
}
function walletCoins() { return walletLoad().coins; }
function walletAdd(n, reason) {
  var w = walletLoad();
  w.coins = Math.max(0, Math.round(w.coins + n));
  walletSave(w);
  if (n > 0) coinToast('+' + n + ' 🖍️' + (reason ? ' ' + reason : ''));
}
function walletRender() {
  var c = walletCoins();
  document.querySelectorAll('.coin-balance').forEach(function (el) { el.textContent = c; });
  if (typeof LC !== 'undefined' && LC.pip && !LC.pip.closed) LC.pip.document.querySelectorAll('.coin-balance').forEach(function (el) { el.textContent = c; });
}

/* 게임이 끝났을 때 등수대로 분필 (한 판에 한 번만) */
var COIN_RANK_REWARD = [100, 70, 50];
var COIN_JOIN_REWARD = 25;
var LAST_RANK_BOARD = null;
function coinAwardRank(key, rank, total) {
  if (!key || !rank) return;
  var w = walletLoad();
  if (w.awarded[key]) return;
  w.awarded[key] = Date.now();
  var n = rank <= 3 ? COIN_RANK_REWARD[rank - 1] : COIN_JOIN_REWARD;
  if (total && total < 2) n = COIN_JOIN_REWARD;
  w.coins += n;
  walletSave(w);
  coinToast('+' + n + ' 🖍️ ' + (rank <= 3 ? rank + '등 보상!' : '참가 보상!'));
}

/* 알림을 띄울 곳: 전체화면이면 그 안, 화면공유 보는 중이면 그 위, 아니면 페이지 */
function overlayHost() {
  if (LC.pip && !LC.pip.closed) return LC.pip.document.body;   /* 채팅을 따로 띄웠으면 그 창에 */
  if (document.fullscreenElement) return document.fullscreenElement;
  var v = document.getElementById('ss-viewer');
  if (v && v.style.display !== 'none' && v.style.display !== '') return v;
  return document.body;
}
/* 혼자 하기 분필: 같은 걸로 여러 번 못 받게(onceKey), 하루 최대 300분필 */
var SOLO_DAILY_CAP = 1000;
var SOLO_COIN_MULT = 3;   /* 혼자 하기 분필 전체 배율 (짜다는 의견으로 3배) */
function soloCoin(amount, reason, onceKey) {
  amount = Math.max(0, Math.round((amount || 0) * SOLO_COIN_MULT));
  if (!amount) return 0;
  var w = walletLoad();
  if (onceKey) { if (w.awarded[onceKey]) return 0; w.awarded[onceKey] = Date.now(); }
  var today = new Date().toDateString();
  if (!w.daily || w.daily.d !== today) w.daily = { d: today, n: 0 };
  var give = Math.min(amount, SOLO_DAILY_CAP - w.daily.n);
  if (give <= 0) { walletSave(w); coinToast('오늘 혼자 하기 분필은 다 받았어요 (하루 ' + SOLO_DAILY_CAP + ')'); return 0; }
  w.daily.n += give; w.coins += give;
  walletSave(w);
  coinToast('+' + give + ' 🖍️ ' + (reason || ''));
  return give;
}
var COIN_TOAST_T = null;
function coinToast(text) {
  var el = document.getElementById('coin-toast');
  if (!el) { el = document.createElement('div'); el.id = 'coin-toast'; el.className = 'coin-toast'; }
  var host = overlayHost(); if (el.parentNode !== host) host.appendChild(el);
  el.innerHTML = chalkify(esc(text));
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(COIN_TOAST_T);
  COIN_TOAST_T = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

/* ---------- 목소리로 읽기 ---------- */
function sayText(text) {
  try {
    if (!window.speechSynthesis) return;
    var u = new SpeechSynthesisUtterance(String(text).slice(0, 120));
    u.lang = 'ko-KR'; u.rate = 1.05; u.pitch = 1.1;
    var vs = speechSynthesis.getVoices().filter(function (v) { return /ko/i.test(v.lang); });
    if (vs.length) u.voice = vs[0];
    speechSynthesis.speak(u);
  } catch (e) {}
}

/* ---------- 후원 ---------- */
function donateOpen(toPid) {
  if (!roomJoined) { alert('방에 들어가야 후원할 수 있어요!'); return; }
  /* 후원은 화면공유 채팅에서만 */
  if (!LC.mode) { coinToast('후원은 화면공유 채팅에서 할 수 있어요'); return; }
  var others = (roomPlayersList || []).filter(function (p) { return p.id !== myPlayerId; });
  if (!others.length) { coinToast('후원할 친구가 아직 없어요'); return; }
  var have = walletCoins();
  var box = document.getElementById('donate-modal');
  if (!box) {
    box = document.createElement('div');
    box.id = 'donate-modal'; box.className = 'donate-modal';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) { if (e.target === box) box.style.display = 'none'; });
  }
  box.innerHTML = '<div class="donate-card">' +
    '<div class="donate-title">💸 후원하기 <span class="donate-have">내 분필 ' + CHALK_IMG + ' <b class="coin-balance">' + have + '</b></span></div>' +
    '<div class="donate-label">누구에게?</div>' +
    '<div class="donate-to">' + others.map(function (p, i) { return '<button type="button" class="donate-chip' + ((toPid ? p.id === toPid : i === 0) ? ' on' : '') + '" data-pid="' + p.id + '">' + esc(p.name) + '</button>'; }).join('') + '</div>' +
    '<div class="donate-label">얼마나?</div>' +
    '<div class="donate-amts">' + [10, 30, 50, 100].map(function (a, i) { return '<button type="button" class="donate-chip amt' + (i === 0 ? ' on' : '') + '" data-a="' + a + '">' + CHALK_IMG + ' ' + a + '</button>'; }).join('') +
    '<input type="number" id="donate-custom" min="1" placeholder="직접" /></div>' +
    '<div class="donate-label">후원 메시지 <small>(목소리로 읽어줘요)</small></div>' +
    '<input type="text" id="donate-msg" maxlength="60" placeholder="예: 그림 너무 잘 그린다ㅋㅋ" />' +
    '<div class="donate-err" id="donate-err"></div>' +
    '<div class="donate-btns"><button class="btn btn-ghost" id="donate-cancel">취소</button><button class="btn btn-primary" id="donate-send">후원 보내기</button></div>' +
    '</div>';
  box.style.display = 'flex';
  var pick = function (sel, cls) { box.querySelectorAll(sel).forEach(function (b) { b.onclick = function () { box.querySelectorAll(sel).forEach(function (x) { x.classList.toggle('on', x === b); }); if (cls) document.getElementById('donate-custom').value = ''; }; }); };
  pick('.donate-to .donate-chip'); pick('.donate-amts .donate-chip', true);
  document.getElementById('donate-custom').oninput = function () { box.querySelectorAll('.donate-amts .donate-chip').forEach(function (x) { x.classList.remove('on'); }); };
  document.getElementById('donate-cancel').onclick = function () { box.style.display = 'none'; };
  var msgIn = document.getElementById('donate-msg');
  msgIn.onkeydown = function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); document.getElementById('donate-send').click(); } };
  document.getElementById('donate-send').onclick = function () {
    var toB = box.querySelector('.donate-to .donate-chip.on');
    var amtB = box.querySelector('.donate-amts .donate-chip.on');
    var amt = amtB ? +amtB.getAttribute('data-a') : Math.floor(+document.getElementById('donate-custom').value || 0);
    var err = document.getElementById('donate-err');
    if (!toB) { err.textContent = '받을 친구를 골라요!'; return; }
    if (!(amt > 0)) { err.textContent = '분필 개수를 정해요!'; return; }
    if (amt > walletCoins()) { err.textContent = '분필이 모자라요 😢 (게임에서 이기면 분필을 받아요)'; return; }
    var to = toB.getAttribute('data-pid'), toName = toB.textContent;
    var msg = msgIn.value.trim().slice(0, 60);
    walletAdd(-amt);
    var id = chatNewId();
    /* 내가 보낸 후원은 내 화면에서 다시 알림이 안 뜨게 */
    var w = walletLoad(); w.got[id] = Date.now(); walletSave(w);
    chatPushMessage(groupChatKey(), {
      id: id, pid: myPlayerId, name: me.name, ts: Date.now(),
      text: '💸 ' + toName + '님에게 분필 ' + amt + '개 후원!' + (msg ? ' “' + msg + '”' : ''),
      don: { to: to, toName: toName, amount: amt, msg: msg }
    }).then(function () { if (typeof groupPoll === 'function') groupPoll(); lcPoll(true); });
    donateAlert({ name: me.name, toName: toName, amount: amt, msg: msg });
    box.style.display = 'none';
  };
}

/* 후원 알림: 화면 위에 크게 + 목소리 (여러 개 오면 차례대로) */
var DON_QUEUE = [], DON_BUSY = false;
function donateAlert(d) { DON_QUEUE.push(d); if (!DON_BUSY) donateNext(); }
function donateNext() {
  var d = DON_QUEUE.shift();
  if (!d) { DON_BUSY = false; return; }
  DON_BUSY = true;
  var el = document.getElementById('donate-alert');
  if (!el) { el = document.createElement('div'); el.id = 'donate-alert'; el.className = 'donate-alert'; }
  var host = overlayHost(); if (el.parentNode !== host) host.appendChild(el);
  el.innerHTML = '<div class="da-coins">' + CHALK_IMG + CHALK_IMG + CHALK_IMG + '</div><div class="da-head"><b>' + esc(d.name) + '</b>님이 <b>' + esc(d.toName) + '</b>님에게<br><span class="da-amt">분필 ' + d.amount + '개</span> 후원!</div>' + (d.msg ? '<div class="da-msg">“' + esc(d.msg) + '”</div>' : '');
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  if (typeof mmSound === 'function') mmSound('catch');
  setTimeout(function () { sayText(d.name + '님, ' + '분필 ' + d.amount + '개 후원. ' + (d.msg || '')); }, 500);
  setTimeout(function () { el.classList.remove('show'); setTimeout(donateNext, 400); }, 5200);
}

/* 방 채팅을 지켜보다가 새 후원이 오면 알림 + (나한테 온 거면) 분필 받기 */
var DON_WATCH = { joinedAt: 0 };
function donateCheck(messages) {
  if (!messages || !messages.length) return;
  var w = walletLoad(), changed = false;
  messages.forEach(function (m) {
    if (!m || !m.don || w.got[m.id]) return;
    w.got[m.id] = Date.now(); changed = true;
    if (m.don.to === myPlayerId && m.pid !== myPlayerId) {
      w.coins += Math.max(0, Math.floor(m.don.amount || 0));
    }
    /* 방에 들어오기 전에 있던 옛날 후원은 알림 없이 기록만 */
    if (m.ts > DON_WATCH.joinedAt - 5000 && Date.now() - m.ts < 60000) donateAlert({ name: m.name, toName: m.don.toName, amount: m.don.amount, msg: m.don.msg });
  });
  if (changed) walletSave(w);
}

/* ---------- 화면공유 실시간 채팅 ---------- */
var LC = { el: null, pipEl: null, pip: null, mode: null, busy: false };
/* 채팅창은 두 개까지 있을 수 있어요: 사이트 안(LC.el) / 따로 띄운 창(LC.pipEl). 둘 다 같은 대화를 보여줘요 */
function lcBoxes() { return [LC.el, LC.pipEl].filter(function (e) { return e && e.style.display !== 'none'; }); }
function lcPoll(force) {
  if (!roomJoined || LC.busy) return;
  LC.busy = true;
  DBget(groupChatKey()).then(function (st) {
    LC.busy = false;
    var msgs = (st && st.messages) || [];
    donateCheck(msgs);
    lcBoxes().forEach(function (el) { lcRender(el, msgs, force); });
  }, function () { LC.busy = false; });
}
function lcRender(el, msgs, force) {
  var list = el.querySelector('.lc-list');
  var sig = msgs.length + ':' + (msgs.length ? msgs[msgs.length - 1].id + (msgs[msgs.length - 1].text || '') : '');
  if (sig === el._sig && !force) return;
  el._sig = sig;
  var stick = list.scrollHeight - list.scrollTop - list.clientHeight < 50;
  list.innerHTML = msgs.slice(-40).map(function (m) {
    if (m.deleted) return '';
    var body = m.type === 'file' ? '📎 ' + esc(m.fileName || '파일') : esc(m.text || '');
    if (m.don) return '<div class="lc-m don"><b>' + esc(m.name) + '</b> → ' + esc(m.don.toName) + ' ' + CHALK_IMG + m.don.amount + (m.don.msg ? '<br>“' + esc(m.don.msg) + '”' : '') + '</div>';
    return '<div class="lc-m' + (m.pid === myPlayerId ? ' me' : '') + '"><b>' + esc(m.name || '?') + '</b> ' + body + '</div>';
  }).join('') || '<div class="lc-empty">채팅이 여기 실시간으로 올라와요</div>';
  if (stick || force) list.scrollTop = list.scrollHeight;
}
function lcSend(el) {
  var inp = el.querySelector('.lc-input'), v = inp.value.trim();
  if (el._don) { lcDonate(el, v); return; }
  if (!v) return;
  inp.value = '';
  chatSendText(groupChatKey(), v).then(function () { lcPoll(true); if (typeof groupPoll === 'function') groupPoll(); });
}
/* 후원 채팅: 화면을 공유하는 사람에게 분필 + 메시지 (모두에게 알림, 목소리로 읽어줘요) */
function lcSetDon(el, on) {
  el._don = !!on;
  el.classList.toggle('don-on', el._don);
  el.querySelector('.lc-donbar').style.display = el._don ? '' : 'none';
  el.querySelector('.lc-input').placeholder = el._don ? '후원 메시지 (목소리로 읽어줘요)' : '채팅 입력 (엔터)';
  el.querySelector('.lc-don').textContent = el._don ? '✕ 후원 닫기' : '💸 후원';
  walletRender();
  if (el._don) el.querySelector('.lc-input').focus();
}
function lcDonate(el, msg) {
  var info = (SS && SS.info) || {};
  var to = info.by, toName = info.name || (SS.view && SS.view.name) || '친구';
  if (!to || to === myPlayerId) { coinToast('지금 화면을 공유하는 친구에게만 후원할 수 있어요'); return; }
  var on = el.querySelector('.lc-amt.on'), custom = Math.floor(+el.querySelector('.lc-amt-custom').value || 0);
  var amt = custom > 0 ? custom : (on ? +on.getAttribute('data-a') : 0);
  if (!(amt > 0)) { coinToast('후원할 분필을 골라요'); return; }
  if (amt > walletCoins()) { coinToast('분필이 모자라요 😢 (게임에서 이기면 받아요)'); return; }
  msg = String(msg || '').slice(0, 60);
  walletAdd(-amt);
  var id = chatNewId(), w = walletLoad(); w.got[id] = Date.now(); walletSave(w);
  chatPushMessage(groupChatKey(), {
    id: id, pid: myPlayerId, name: me.name, ts: Date.now(),
    text: '💸 ' + toName + '님에게 분필 ' + amt + '개 후원!' + (msg ? ' “' + msg + '”' : ''),
    don: { to: to, toName: toName, amount: amt, msg: msg }
  }).then(function () { lcPoll(true); if (typeof groupPoll === 'function') groupPoll(); });
  donateAlert({ name: me.name, toName: toName, amount: amt, msg: msg });
  el.querySelector('.lc-input').value = ''; el.querySelector('.lc-amt-custom').value = '';
  lcSetDon(el, false);
}
function lcBuild(mode, inPip) {
  var el = document.createElement('div');
  el.className = 'lc-box' + (inPip ? ' in-pip' : '');
  el.innerHTML = '<div class="lc-head"><span class="lc-grip">⠿</span> 💬 실시간 채팅 <span class="hw-spacer"></span><button type="button" class="lc-don" title="화면 공유하는 친구에게 후원">💸 후원</button><button type="button" class="lc-pop">' + (inPip ? '⤓ 사이트로' : '⧉ 따로') + '</button>' + (inPip ? '' : '<button type="button" class="lc-min" title="접기">—</button>') + '</div>' +
    '<div class="lc-list"></div>' +
    '<div class="lc-donbar" style="display:none"><div class="lc-amts">' + [10, 30, 50, 100].map(function (a, i) { return '<button type="button" class="lc-amt' + (i === 0 ? ' on' : '') + '" data-a="' + a + '">' + CHALK_IMG + a + '</button>'; }).join('') +
    '<input type="number" class="lc-amt-custom" min="1" placeholder="직접" /></div><div class="lc-have">내 분필 ' + CHALK_IMG + ' <b class="coin-balance">0</b></div></div>' +
    '<div class="lc-row"><input type="text" class="lc-input" maxlength="300" placeholder="채팅 입력 (엔터)" autocomplete="off" /><button type="button" class="lc-send">➤</button></div>';
  el.querySelector('.lc-send').onclick = function () { lcSend(el); };
  el.querySelector('.lc-input').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); lcSend(el); } e.stopPropagation(); });
  el.querySelector('.lc-don').onclick = function () { lcSetDon(el, !el._don); };
  if (mode === 'share') el.querySelector('.lc-don').style.display = 'none';   /* 공유하는 사람은 후원을 받아요 */
  el.querySelectorAll('.lc-amt').forEach(function (b) { b.onclick = function () { el.querySelectorAll('.lc-amt').forEach(function (x) { x.classList.toggle('on', x === b); }); el.querySelector('.lc-amt-custom').value = ''; }; });
  el.querySelector('.lc-amt-custom').addEventListener('input', function () { el.querySelectorAll('.lc-amt').forEach(function (x) { x.classList.remove('on'); }); });
  el.querySelector('.lc-amt-custom').addEventListener('keydown', function (e) { e.stopPropagation(); });
  el.querySelector('.lc-pop').onclick = function () { if (inPip) lcPopIn(); else lcPopOut(); };
  var mn = el.querySelector('.lc-min');
  if (mn) mn.onclick = function () { el.classList.toggle('folded'); this.textContent = el.classList.contains('folded') ? '+' : '—'; };
  return el;
}
/* 공유하는 사람: 화면 어디든 떠 있는 창. 위쪽 막대를 끌어서 옮기고, 위치는 기억해요 */
function lcMakeFloatDraggable(el) {
  var head = el.querySelector('.lc-head'), sx, sy, bx, by, drag = false;
  head.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button')) return;
    drag = true; sx = e.clientX; sy = e.clientY;
    var r = el.getBoundingClientRect(); bx = r.left; by = r.top;
    try { head.setPointerCapture(e.pointerId); } catch (er) {}
  });
  head.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var nx = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, bx + e.clientX - sx));
    var ny = Math.max(0, Math.min(window.innerHeight - 40, by + e.clientY - sy));
    el.style.left = nx + 'px'; el.style.top = ny + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
  });
  head.addEventListener('pointerup', function () {
    if (!drag) return; drag = false;
    try { localStorage.setItem('gamehub_lc_pos', JSON.stringify({ x: parseInt(el.style.left, 10), y: parseInt(el.style.top, 10) })); } catch (e) {}
  });
}
/* ---- 채팅을 사이트 밖 작은 창으로 ----
   크롬: 항상 맨 위에 떠 있는 작은 창(문서 PiP) → 다른 탭·프로그램을 공유하면서도 채팅이 보여요.
   안 되는 브라우저: 새 창(팝업). 사이트 안 채팅은 그동안 숨겨 두었다가, 창을 닫으면 다시 보여요.
   (예전엔 채팅창을 통째로 옮겼다가 창이 닫히면서 같이 망가져서 까맣게 보였어요 → 이제 새로 하나 만들어요) */
function lcPopOut() {
  if (!LC.mode || (LC.pip && !LC.pip.closed)) return;
  var setup = function (win) {
    if (!win) { coinToast('팝업이 막혔어요. 주소창 오른쪽에서 팝업 허용을 눌러 주세요'); return; }
    var d = win.document;
    d.title = '💬 실시간 채팅';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(function (n) { d.head.appendChild(n.cloneNode(true)); });
    d.body.style.margin = '0'; d.body.style.background = '#16201b';
    LC.pip = win;
    LC.pipEl = lcBuild(LC.mode, true);
    d.body.appendChild(LC.pipEl);
    if (LC.el) LC.el.style.display = 'none';
    var closed = function () { if (LC.pip === win) lcPopClosed(); };
    win.addEventListener('pagehide', closed);
    win.addEventListener('unload', closed);
    /* 혹시 닫힘 알림을 못 받아도 확인 */
    clearInterval(LC.pipWatch);
    LC.pipWatch = setInterval(function () { if (LC.pip === win && win.closed) lcPopClosed(); }, 700);
    walletRender();
    lcPoll(true);
  };
  try {
    if (window.documentPictureInPicture && documentPictureInPicture.requestWindow) {
      documentPictureInPicture.requestWindow({ width: 340, height: 500 }).then(setup, function () { setup(lcOpenPopup()); });
      return;
    }
  } catch (e) {}
  setup(lcOpenPopup());
}
function lcOpenPopup() {
  var w = window.open('', 'gamehub_livechat', 'width=360,height=540,menubar=no,toolbar=no,location=no,status=no');
  if (!w) return null;
  try { w.document.open(); w.document.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>실시간 채팅</title></head><body></body></html>'); w.document.close(); } catch (e) { return null; }
  return w;
}
/* 따로 띄운 창이 닫혔을 때: 사이트 안 채팅을 다시 보여줘요 */
function lcPopClosed() {
  clearInterval(LC.pipWatch);
  LC.pip = null; LC.pipEl = null;
  if (LC.el) { LC.el.style.display = ''; LC.el._sig = ''; }
  lcPoll(true);
}
/* 사이트로 돌아가기 버튼 */
function lcPopIn() {
  var win = LC.pip;
  lcPopClosed();
  if (win && !win.closed) try { win.close(); } catch (e) {}
}

/* 지금 상황에 맞게 채팅창을 붙였다 뗐다 */
function lcSync() {
  var viewer = document.getElementById('ss-viewer');
  var viewing = !!(SS && SS.view && viewer && viewer.style.display !== 'none' && !viewer.classList.contains('mini'));
  var sharing = !!(SS && SS.share);
  var mode = viewing ? 'view' : (sharing ? 'share' : null);
  if (mode === LC.mode) return;
  /* 공유가 끝나면 따로 띄운 창도 닫아요 */
  if (!mode && LC.pip) lcPopIn();
  if (LC.el) { LC.el.remove(); LC.el = null; }
  LC.mode = mode;
  if (!mode) return;
  LC.el = lcBuild(mode, false);
  if (LC.pip && !LC.pip.closed) LC.el.style.display = 'none';   /* 따로 띄운 창이 있으면 사이트 안 것은 숨김 */
  if (mode === 'view') {
    LC.el.classList.add('in-view');
    viewer.querySelector('.ss-video-wrap').appendChild(LC.el);
  } else {
    LC.el.classList.add('floating');
    document.body.appendChild(LC.el);
    var pos = null;
    try { pos = JSON.parse(localStorage.getItem('gamehub_lc_pos') || 'null'); } catch (e) {}
    if (pos && pos.x >= 0 && pos.x < window.innerWidth - 60 && pos.y >= 0 && pos.y < window.innerHeight - 40) { LC.el.style.left = pos.x + 'px'; LC.el.style.top = pos.y + 'px'; LC.el.style.right = 'auto'; LC.el.style.bottom = 'auto'; }
    lcMakeFloatDraggable(LC.el);
  }
  lcPoll(true);
}

/* 방에 있는 동안: 화면공유 채팅을 보고 있으면 1초마다, 아니면 2.5초마다 (후원 확인용) */
/* 내 분필: 화면 위쪽에 항상 (온라인 방에 있을 때) */
function coinPillSync() {
  var el = document.getElementById('coin-pill');
  if (!el) {
    el = document.createElement('div');
    el.id = 'coin-pill'; el.className = 'coin-pill'; el.title = '게임 등수대로 받아요 · 이 기기에 저장 · 화면공유 채팅에서 후원할 수 있어요';
    el.innerHTML = CHALK_IMG + ' <b class="coin-balance">0</b>';
    document.body.appendChild(el);
    walletRender();
  }
  el.style.display = (roomJoined && playMode === 'online') || playMode === 'solo' ? '' : 'none';
  el.classList.toggle('solo', playMode === 'solo');
}
(function lcLoop() {
  var n = 0, wasJoined = false;
  setInterval(function () {
    if (roomJoined && !wasJoined) { DON_WATCH.joinedAt = Date.now(); }
    wasJoined = roomJoined;
    coinPillSync();
    if (!roomJoined) { if (LC.pip) lcPopIn(); if (LC.el) { LC.el.remove(); LC.el = null; LC.mode = null; } return; }
    lcSync();
    n++;
    if (LC.el || LC.pipEl || n % 5 === 0) lcPoll(false);
  }, 500);
  setTimeout(walletRender, 0);
})();
