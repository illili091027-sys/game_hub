/* ===================== 코인 · 후원 · 화면공유 실시간 채팅 =====================
   1) 코인: 게임이 끝나면 등수대로 코인을 받아요. 코인은 '이 기기(브라우저)'에 저장돼서
      서버 주소나 방 코드가 바뀌어도 그대로 남아요.
   2) 후원: 코인을 친구에게 보내면서 메시지를 남겨요. 방 모두에게 후원 알림이 크게 뜨고,
      메시지를 목소리로 읽어줘요. 받은 사람 기기에 코인이 들어가요.
      (후원은 방 채팅에 특별한 메시지로 올라가요. 그래서 채팅 기록에도 남아요)
   3) 화면공유 채팅: 화면을 보는 사람은 영상 오른쪽 아래에서 채팅, 공유하는 사람은
      실시간 채팅창이 떠요(끌어서 위치 옮기기). 방 채팅과 같은 대화예요. */

/* ---------- 코인 지갑 (이 기기에 저장) ---------- */
var WALLET_KEY = 'gamehub_wallet_v1';
function walletLoad() {
  try { var w = JSON.parse(localStorage.getItem(WALLET_KEY) || 'null'); if (w && typeof w.coins === 'number') return w; } catch (e) {}
  return { coins: 100, got: {}, awarded: {} };   /* 처음엔 100코인 선물 */
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
  if (n > 0) coinToast('+' + n + ' 🪙' + (reason ? ' ' + reason : ''));
}
function walletRender() {
  var c = walletCoins();
  document.querySelectorAll('.coin-balance').forEach(function (el) { el.textContent = c; });
  if (typeof LC !== 'undefined' && LC.pip && !LC.pip.closed) LC.pip.document.querySelectorAll('.coin-balance').forEach(function (el) { el.textContent = c; });
}

/* 게임이 끝났을 때 등수대로 코인 (한 판에 한 번만) */
var COIN_RANK_REWARD = [50, 30, 20];
var COIN_JOIN_REWARD = 10;
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
  coinToast('+' + n + ' 🪙 ' + (rank <= 3 ? rank + '등 보상!' : '참가 보상!'));
}

/* 알림을 띄울 곳: 전체화면이면 그 안, 화면공유 보는 중이면 그 위, 아니면 페이지 */
function overlayHost() {
  if (LC.pip && !LC.pip.closed) return LC.pip.document.body;   /* 채팅을 따로 띄웠으면 그 창에 */
  if (document.fullscreenElement) return document.fullscreenElement;
  var v = document.getElementById('ss-viewer');
  if (v && v.style.display !== 'none' && v.style.display !== '') return v;
  return document.body;
}
/* 혼자 하기 코인: 같은 걸로 여러 번 못 받게(onceKey), 하루 최대 300코인 */
var SOLO_DAILY_CAP = 300;
function soloCoin(amount, reason, onceKey) {
  amount = Math.max(0, Math.round(amount || 0));
  if (!amount) return 0;
  var w = walletLoad();
  if (onceKey) { if (w.awarded[onceKey]) return 0; w.awarded[onceKey] = Date.now(); }
  var today = new Date().toDateString();
  if (!w.daily || w.daily.d !== today) w.daily = { d: today, n: 0 };
  var give = Math.min(amount, SOLO_DAILY_CAP - w.daily.n);
  if (give <= 0) { walletSave(w); coinToast('오늘 혼자 하기 코인은 다 받았어요 (하루 ' + SOLO_DAILY_CAP + ')'); return 0; }
  w.daily.n += give; w.coins += give;
  walletSave(w);
  coinToast('+' + give + ' 🪙 ' + (reason || ''));
  return give;
}
var COIN_TOAST_T = null;
function coinToast(text) {
  var el = document.getElementById('coin-toast');
  if (!el) { el = document.createElement('div'); el.id = 'coin-toast'; el.className = 'coin-toast'; }
  var host = overlayHost(); if (el.parentNode !== host) host.appendChild(el);
  el.textContent = text;
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
    '<div class="donate-title">💸 후원하기 <span class="donate-have">내 코인 🪙 <b class="coin-balance">' + have + '</b></span></div>' +
    '<div class="donate-label">누구에게?</div>' +
    '<div class="donate-to">' + others.map(function (p, i) { return '<button type="button" class="donate-chip' + ((toPid ? p.id === toPid : i === 0) ? ' on' : '') + '" data-pid="' + p.id + '">' + esc(p.name) + '</button>'; }).join('') + '</div>' +
    '<div class="donate-label">얼마나?</div>' +
    '<div class="donate-amts">' + [10, 30, 50, 100].map(function (a, i) { return '<button type="button" class="donate-chip amt' + (i === 0 ? ' on' : '') + '" data-a="' + a + '">🪙 ' + a + '</button>'; }).join('') +
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
    if (!(amt > 0)) { err.textContent = '코인 개수를 정해요!'; return; }
    if (amt > walletCoins()) { err.textContent = '코인이 모자라요 😢 (게임에서 이기면 코인을 받아요)'; return; }
    var to = toB.getAttribute('data-pid'), toName = toB.textContent;
    var msg = msgIn.value.trim().slice(0, 60);
    walletAdd(-amt);
    var id = chatNewId();
    /* 내가 보낸 후원은 내 화면에서 다시 알림이 안 뜨게 */
    var w = walletLoad(); w.got[id] = Date.now(); walletSave(w);
    chatPushMessage(groupChatKey(), {
      id: id, pid: myPlayerId, name: me.name, ts: Date.now(),
      text: '💸 ' + toName + '님에게 🪙' + amt + ' 후원!' + (msg ? ' “' + msg + '”' : ''),
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
  el.innerHTML = '<div class="da-coins">🪙🪙🪙</div><div class="da-head"><b>' + esc(d.name) + '</b>님이 <b>' + esc(d.toName) + '</b>님에게<br><span class="da-amt">' + d.amount + '코인</span> 후원!</div>' + (d.msg ? '<div class="da-msg">“' + esc(d.msg) + '”</div>' : '');
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  if (typeof mmSound === 'function') mmSound('catch');
  setTimeout(function () { sayText(d.name + '님, ' + d.amount + '코인 후원. ' + (d.msg || '')); }, 500);
  setTimeout(function () { el.classList.remove('show'); setTimeout(donateNext, 400); }, 5200);
}

/* 방 채팅을 지켜보다가 새 후원이 오면 알림 + (나한테 온 거면) 코인 받기 */
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
var LC = { el: null, mode: null, last: '', busy: false };
function lcPoll(force) {
  if (!roomJoined || LC.busy) return;
  LC.busy = true;
  DBget(groupChatKey()).then(function (st) {
    LC.busy = false;
    var msgs = (st && st.messages) || [];
    donateCheck(msgs);
    if (LC.el && LC.el.style.display !== 'none') lcRender(msgs, force);
  }, function () { LC.busy = false; });
}
function lcRender(msgs, force) {
  var list = LC.el.querySelector('.lc-list');
  var sig = msgs.length + ':' + (msgs.length ? msgs[msgs.length - 1].id + (msgs[msgs.length - 1].text || '') : '');
  if (sig === LC.last && !force) return;
  LC.last = sig;
  var stick = list.scrollHeight - list.scrollTop - list.clientHeight < 50;
  list.innerHTML = msgs.slice(-40).map(function (m) {
    if (m.deleted) return '';
    var body = m.type === 'file' ? '📎 ' + esc(m.fileName || '파일') : esc(m.text || '');
    if (m.don) return '<div class="lc-m don"><b>' + esc(m.name) + '</b> → ' + esc(m.don.toName) + ' 🪙' + m.don.amount + (m.don.msg ? '<br>“' + esc(m.don.msg) + '”' : '') + '</div>';
    return '<div class="lc-m' + (m.pid === myPlayerId ? ' me' : '') + '"><b>' + esc(m.name || '?') + '</b> ' + body + '</div>';
  }).join('') || '<div class="lc-empty">채팅이 여기 실시간으로 올라와요</div>';
  if (stick || force) list.scrollTop = list.scrollHeight;
}
function lcSend() {
  var inp = LC.el.querySelector('.lc-input'), v = inp.value.trim();
  if (LC.don) { lcDonate(v); return; }
  if (!v) return;
  inp.value = '';
  chatSendText(groupChatKey(), v).then(function () { lcPoll(true); if (typeof groupPoll === 'function') groupPoll(); });
}
/* 후원 채팅: 화면을 공유하는 사람에게 코인 + 메시지 (모두에게 알림, 목소리로 읽어줘요) */
function lcSetDon(on) {
  LC.don = !!on;
  var el = LC.el; if (!el) return;
  el.classList.toggle('don-on', LC.don);
  el.querySelector('.lc-donbar').style.display = LC.don ? '' : 'none';
  el.querySelector('.lc-input').placeholder = LC.don ? '후원 메시지 (목소리로 읽어줘요)' : '채팅 입력 (엔터)';
  el.querySelector('.lc-don').textContent = LC.don ? '✕ 후원 닫기' : '💸 후원';
  walletRender();
  if (LC.don) el.querySelector('.lc-input').focus();
}
function lcDonate(msg) {
  var el = LC.el, info = (SS && SS.info) || {};
  var to = info.by, toName = info.name || (SS.view && SS.view.name) || '친구';
  if (!to || to === myPlayerId) { coinToast('지금 화면을 공유하는 친구에게만 후원할 수 있어요'); return; }
  var on = el.querySelector('.lc-amt.on'), custom = Math.floor(+el.querySelector('.lc-amt-custom').value || 0);
  var amt = custom > 0 ? custom : (on ? +on.getAttribute('data-a') : 0);
  if (!(amt > 0)) { coinToast('후원할 코인을 골라요'); return; }
  if (amt > walletCoins()) { coinToast('코인이 모자라요 😢 (게임에서 이기면 받아요)'); return; }
  msg = String(msg || '').slice(0, 60);
  walletAdd(-amt);
  var id = chatNewId(), w = walletLoad(); w.got[id] = Date.now(); walletSave(w);
  chatPushMessage(groupChatKey(), {
    id: id, pid: myPlayerId, name: me.name, ts: Date.now(),
    text: '💸 ' + toName + '님에게 🪙' + amt + ' 후원!' + (msg ? ' “' + msg + '”' : ''),
    don: { to: to, toName: toName, amount: amt, msg: msg }
  }).then(function () { lcPoll(true); if (typeof groupPoll === 'function') groupPoll(); });
  donateAlert({ name: me.name, toName: toName, amount: amt, msg: msg });
  el.querySelector('.lc-input').value = ''; el.querySelector('.lc-amt-custom').value = '';
  lcSetDon(false);
}
function lcBuild() {
  var el = document.createElement('div');
  el.className = 'lc-box';
  el.innerHTML = '<div class="lc-head"><span class="lc-grip">⠿</span> 💬 실시간 채팅 <span class="hw-spacer"></span><button type="button" class="lc-don" title="화면 공유하는 친구에게 후원">💸 후원</button><button type="button" class="lc-pop" title="사이트 밖 작은 창으로 따로 띄우기 (다른 화면을 보면서도 채팅)">⧉ 따로</button><button type="button" class="lc-min" title="접기">—</button></div>' +
    '<div class="lc-list"></div>' +
    '<div class="lc-donbar" style="display:none"><div class="lc-amts">' + [10, 30, 50, 100].map(function (a, i) { return '<button type="button" class="lc-amt' + (i === 0 ? ' on' : '') + '" data-a="' + a + '">🪙' + a + '</button>'; }).join('') +
    '<input type="number" class="lc-amt-custom" min="1" placeholder="직접" /></div><div class="lc-have">내 코인 🪙 <b class="coin-balance">0</b></div></div>' +
    '<div class="lc-row"><input type="text" class="lc-input" maxlength="300" placeholder="채팅 입력 (엔터)" autocomplete="off" /><button type="button" class="lc-send">➤</button></div>';
  el.querySelector('.lc-send').onclick = lcSend;
  el.querySelector('.lc-input').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); lcSend(); } e.stopPropagation(); });
  el.querySelector('.lc-don').onclick = function () { lcSetDon(!LC.don); };
  el.querySelectorAll('.lc-amt').forEach(function (b) { b.onclick = function () { el.querySelectorAll('.lc-amt').forEach(function (x) { x.classList.toggle('on', x === b); }); el.querySelector('.lc-amt-custom').value = ''; }; });
  el.querySelector('.lc-amt-custom').addEventListener('input', function () { el.querySelectorAll('.lc-amt').forEach(function (x) { x.classList.remove('on'); }); });
  el.querySelector('.lc-amt-custom').addEventListener('keydown', function (e) { e.stopPropagation(); });
  el.querySelector('.lc-pop').onclick = function () { if (LC.pip && !LC.pip.closed) lcPopIn(); else lcPopOut(); };
  el.querySelector('.lc-min').onclick = function () { el.classList.toggle('folded'); this.textContent = el.classList.contains('folded') ? '+' : '—'; };
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
   안 되는 브라우저: 새 창(팝업)으로 열어요. 창을 닫으면 다시 사이트 안으로 돌아와요. */
function lcPopOut() {
  if (!LC.el) return;
  var setup = function (win) {
    if (!win) { coinToast('팝업이 막혔어요. 주소창 오른쪽에서 팝업 허용을 눌러 주세요'); return; }
    var d = win.document;
    d.title = '💬 실시간 채팅';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(function (n) { d.head.appendChild(n.cloneNode(true)); });
    d.body.style.margin = '0'; d.body.style.background = '#16201b';
    LC.pip = win;
    LC.el.classList.add('in-pip');
    LC.el.querySelector('.lc-pop').textContent = '⤓ 돌아가기';
    d.body.appendChild(LC.el);
    var back = function () { if (LC.pip === win) lcPopIn(true); };
    win.addEventListener('pagehide', back);
    win.addEventListener('unload', back);
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
/* 다시 사이트 안으로 */
function lcPopIn(fromClose) {
  var win = LC.pip;
  LC.pip = null;
  if (LC.el) {
    LC.el.classList.remove('in-pip');
    var pb = LC.el.querySelector('.lc-pop'); if (pb) pb.textContent = '⧉ 따로';
    var viewer = document.getElementById('ss-viewer');
    if (LC.mode === 'view' && viewer) viewer.querySelector('.ss-video-wrap').appendChild(LC.el);
    else if (LC.mode === 'share') document.body.appendChild(LC.el);
    else { LC.el.remove(); LC.el = null; }
  }
  ['donate-alert', 'coin-toast'].forEach(function (id) { var e = win && !win.closed && win.document.getElementById(id); if (e) document.body.appendChild(e); });
  if (!fromClose && win && !win.closed) try { win.close(); } catch (e) {}
}

/* 지금 상황에 맞게 채팅창을 붙였다 뗐다 */
function lcSync() {
  var viewer = document.getElementById('ss-viewer');
  var viewing = !!(SS && SS.view && viewer && viewer.style.display !== 'none' && !viewer.classList.contains('mini'));
  var sharing = !!(SS && SS.share);
  var mode = viewing ? 'view' : (sharing ? 'share' : null);
  if (mode === LC.mode) return;
  /* 따로 띄운 창은 공유 중인 동안 그대로 두고, 공유가 끝나면 닫아요 */
  if (LC.pip && !LC.pip.closed) {
    if (mode) { LC.mode = mode; return; }
    LC.mode = null; lcPopIn(); return;
  }
  if (LC.el) { LC.el.remove(); LC.el = null; }
  LC.mode = mode; LC.last = '';
  if (!mode) return;
  LC.el = lcBuild();
  LC.don = false;
  if (mode === 'share') LC.el.querySelector('.lc-don').style.display = 'none';   /* 공유하는 사람은 후원을 받아요 */
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
/* 내 코인: 화면 위쪽에 항상 (온라인 방에 있을 때) */
function coinPillSync() {
  var el = document.getElementById('coin-pill');
  if (!el) {
    el = document.createElement('div');
    el.id = 'coin-pill'; el.className = 'coin-pill'; el.title = '게임 등수대로 받아요 · 이 기기에 저장 · 화면공유 채팅에서 후원할 수 있어요';
    el.innerHTML = '🪙 <b class="coin-balance">0</b>';
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
    if (!roomJoined) { if (LC.el) { LC.el.remove(); LC.el = null; LC.mode = null; } return; }
    lcSync();
    n++;
    if (LC.el || n % 5 === 0) lcPoll(false);
  }, 500);
  setTimeout(walletRender, 0);
})();
