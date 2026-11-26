/* ===================== 💬 소통방 =====================
   같은 방 코드로 들어온 친구들끼리 이야기하면서 놀아요.
   - 왼쪽: 화면 공유 (누가 공유하면 여기서 바로 봐요 / 내 화면도 여기서 공유)
   - 오른쪽: 채팅 (방 전체 채팅이라서 게임 · 화면공유 채팅과 같은 대화예요)
   - 화면을 누르면(⛶ 화면 크게) 화면이 크게 펼쳐지고, 채팅은 오른쪽 아래에 떠요 (screenshare.js / livechat.js 의 보기 채팅)
   - 🎮 같이 게임: 게임 목록(테이블)으로 가요. 화면 공유는 그대로 이어져서 화면 공유하면서 게임도 할 수 있어요.
   - 💸 후원: 분필을 친구에게 보내요.
   과제방에 있던 기능(채팅 · 화면 공유 · 게임 · 후원)을 가져와서, 과제방에서는 막고 여기서만 써요. */

var SOC = { active: false, big: false, wasIn: false, tracker: { lastSig: null, pending: [] }, chatT: null, viewT: null, bound: false, gameSeen: null, chatCount: 0 };

function socActive() { var v = document.getElementById('social'); return !!(v && v.classList.contains('active')); }

/* ---------------- 열기 / 닫기 ---------------- */
function openSocial() {
  if (playMode !== 'online' || !roomJoined) return;
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('social').classList.add('active');
  var bb = document.getElementById('btn-back-soc'); if (bb) bb.style.display = SOC_MODE ? '' : 'none';
  document.getElementById('soc-room-pill').textContent = me.room + ' 방';
  SOC.active = true; SOC.big = false;
  SOC.tracker = { lastSig: null, pending: [] };
  if (typeof ssRenderBar === 'function') ssRenderBar();
  socPollChat();
  clearInterval(SOC.chatT); SOC.chatT = setInterval(socPollChat, 1300);
  clearInterval(SOC.viewT); SOC.viewT = setInterval(socSyncViewer, 300);
  socSyncViewer();
}

/* 게임 화면 등 다른 곳으로 갈 때: 소통방 채팅 확인만 멈춰요 (방 · 화면 공유는 그대로) */
function socPause() {
  clearInterval(SOC.chatT); SOC.chatT = null;
  clearInterval(SOC.viewT); SOC.viewT = null;
  SOC.active = false;
  socSyncViewer();
}

/* 방을 나갈 때 (core.js leaveRoomLocal) */
function socStop() {
  clearInterval(SOC.chatT); SOC.chatT = null;
  clearInterval(SOC.viewT); SOC.viewT = null;
  SOC.active = false; SOC.big = false; SOC.wasIn = false;
  var box = document.getElementById('ss-viewer');
  if (box && box.parentNode !== document.body) document.body.appendChild(box);
  if (box) box.classList.remove('soc-inline');
}

function socLeave() {
  socStop();
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('home').classList.add('active');
  backToModeSelect();
}

/* 🎮 같이 게임: 게임 목록으로 (화면 공유는 그대로 이어져요) */
function socOpenGames() {
  if (!roomJoined) return;
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('home').classList.add('active');
  socPause();   /* 화면 공유 창은 작은 창으로 줄어들어요 */
  var bb = document.getElementById('btn-back-soc'); if (bb) bb.style.display = '';
  /* 방장이 고른 게임이 있으면 곧 자동으로 같이 들어가요 (core.js applyRoomState) */
}
var SOC_NOTICE_SHOWN = null;
function socGameNotice(game) {
  if (!game) { SOC_NOTICE_SHOWN = null; return; }
  if (SOC_NOTICE_SHOWN === game) return;
  SOC_NOTICE_SHOWN = game;
  if (typeof coinToast === 'function') coinToast('🎮 같이 게임이 시작됐어요! 위의 "같이 게임"을 눌러요');
}

/* 💸 후원 */
function socDonate() { if (typeof donateOpen === 'function') donateOpen(); }

/* ---------------- 💬 채팅 (방 전체 채팅) ---------------- */
function socChatKey() { return groupChatKey(); }
function socPollChat() {
  if (!roomJoined) return;
  DBget(socChatKey()).then(function (st) {
    if (!socActive()) return;
    var msgs = (st && st.messages) || [];
    if (typeof donateCheck === 'function') donateCheck(msgs);
    chatRenderInto(document.getElementById('soc-chat-messages'), msgs, SOC.tracker, '친구들과 이야기해요! 👋');
    var who = document.getElementById('soc-who');
    if (who) who.textContent = '👥 ' + ((typeof ROOM_ALL_PLAYERS !== 'undefined' && ROOM_ALL_PLAYERS && ROOM_ALL_PLAYERS.length) ? ROOM_ALL_PLAYERS.length : (roomPlayersList || []).length) + '명';
  });
}
function socSendChat() {
  var input = document.getElementById('soc-chat-input');
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  chatAutoGrow(input);
  chatSendText(socChatKey(), text).then(socPollChat);
}
function socSendChatFiles(files) {
  chatSendFiles(socChatKey(), files, SOC.tracker, socPollChat, function (msg) { var e = document.getElementById('soc-upload-err'); if (e) e.textContent = msg; });
}

/* ---------------- 📺 화면: 왼쪽에 바로 보이고, 누르면 크게 (채팅은 오른쪽 아래) ----------------
   공유 화면(#ss-viewer)은 원래 화면 전체를 덮는 창인데,
   - 소통방에서는 왼쪽 칸 안에 들어가고 (soc-inline)
   - "⛶ 화면 크게"를 누르면 전체 화면 창으로 커지면서 채팅이 오른쪽 아래에 떠요
   - 소통방을 벗어나(게임 등) 있으면 작은 창(mini)으로 줄어들어서 게임을 할 수 있어요 */
function socSyncViewer() {
  var box = document.getElementById('ss-viewer');
  var screen = document.getElementById('soc-screen');
  var inSoc = socActive();
  var viewing = !!(box && typeof SS !== 'undefined' && SS.view && box.style.display !== 'none');
  if (screen) screen.classList.toggle('has-view', !!(inSoc && viewing));
  if (!box) return;

  if (!SOC.bound) { socBindViewer(box); }
  var btn = document.getElementById('ss-soc-btn');

  if (inSoc && viewing) {
    if (!SOC.wasIn) { SOC.wasIn = true; if (!SOC.big) box.classList.remove('mini'); }
    if (!SOC.big) {
      if (box.parentNode !== screen) screen.appendChild(box);
      box.classList.add('soc-inline'); box.classList.remove('mini');
    } else {
      if (box.parentNode !== document.body) document.body.appendChild(box);
      box.classList.remove('soc-inline');
    }
    if (btn) { btn.style.display = ''; btn.textContent = SOC.big ? '⬜ 소통방 화면으로' : '⛶ 화면 크게'; }
  } else {
    if (btn) btn.style.display = 'none';
    if (box.classList.contains('soc-inline') || box.parentNode === screen) {
      /* 소통방을 벗어났거나 공유가 끝났어요 → 원래 자리로 */
      if (box.parentNode !== document.body) document.body.appendChild(box);
      var wasInline = box.classList.contains('soc-inline');
      box.classList.remove('soc-inline');
      if (viewing && wasInline) box.classList.add('mini');   /* 게임하면서 작게 볼 수 있게 */
    }
    if (!viewing) SOC.big = false;
    SOC.wasIn = false;
  }
}
function socBindViewer(box) {
  var btn = document.getElementById('ss-soc-btn');
  if (!btn) return;
  SOC.bound = true;
  btn.onclick = function () { socToggleBig(); };
}
function socToggleBig(v) {
  SOC.big = (typeof v === 'boolean') ? v : !SOC.big;
  var box = document.getElementById('ss-viewer');
  if (box) { box.classList.remove('mini'); }
  socSyncViewer();
}

/* ---------------- 처음 한 번 연결 ---------------- */
(function socInit() {
  var cm = document.getElementById('soc-chat-messages');
  if (!cm) return;
  chatBindMessageArea(cm, socSendChatFiles, function () { return socChatKey(); }, socPollChat);
  chatBindComposer({ inputId: 'soc-chat-input', attachBtnId: 'soc-attach-btn', fileInputId: 'soc-file-input', onFiles: socSendChatFiles });
  chatSetupMultiline(document.getElementById('soc-chat-input'), socSendChat);
})();
