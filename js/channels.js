/* ---------------- 0번: 채널 라운지 (온라인 전용, 방 안의 여러 대화방) ---------------- */
/* 기존 채팅 위젯(core.js의 group*)은 방 전체가 공유하는 대화방 딱 하나였습니다. 이 기능은
   디스코드처럼, 같은 방(room) 안에서 여러 개의 작은 채널(대화방)을 자유롭게 만들고, 채널
   목록에서 누가 어느 채널에 들어가있는지 미리 본 뒤 원하는 채널에 들어가 따로 대화할 수
   있게 합니다. 다른 게임 카드들과 달리 방장이 골라서 다같이 들어가는 방식이 아니라, 각자
   원할 때 자유롭게 열고 닫는 개인용 화면이라서 rules-overlay(동시 시작 절차)를 거치지
   않고 카드를 누르면 바로 열립니다(core.js의 openChannelLounge 참고).
   - 채널 목록: roomKey('lchannels')에 { channels: [{id, name, createdAt}, ...] } 로 저장.
   - 채널별 멤버(누가 들어가있는지): roomKey('lchan_m_'+채널id)에 { [플레이어id]: {name, ts} }.
     ts가 8초 이상 오래되면 접속이 끊긴 것으로 보고 목록에서 제외합니다(하트비트 방식이라
     탭을 그냥 닫아도 알아서 정리됨).
   - 채널별 채팅: roomKey('lchan_c_'+채널id)에 { messages: [...] } (최근 50개 유지).
   - 아무도 없는 채널(활성 멤버 0명, 만들어진 지 5초 이상 지남)은 채널 목록 화면을 보고 있는
     누군가에 의해 자동으로 삭제됩니다. */
var CH_MAX_CHANNELS = 12;
var CH_CURRENT_ID = null;
var CH_CHANNELS_CACHE = [];
var CH_LIST_POLL_TIMER = null;
var CH_CHAT_POLL_TIMER = null;
var CH_MEMBER_HEARTBEAT_TIMER = null;
var CH_LAST_RENDERED_COUNT = -1;

function channelsKey() { return roomKey('lchannels'); }
function chMembersKey(chId) { return roomKey('lchan_m_' + chId); }
function chChatKey(chId) { return roomKey('lchan_c_' + chId); }

function openChannelLounge() {
  if (playMode !== 'online' || !roomJoined) return;
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('channels').classList.add('active');
  document.getElementById('ch-room-pill').textContent = me.room + ' 방';
  document.getElementById('ch-inside-area').style.display = 'none';
  document.getElementById('ch-list-area').style.display = '';
  document.getElementById('ch-create-err').textContent = '';
  document.getElementById('ch-new-name').value = '';
  CH_CURRENT_ID = null;
  startGameMembersBar();
  chPollList();
  clearInterval(CH_LIST_POLL_TIMER);
  CH_LIST_POLL_TIMER = setInterval(chPollList, 1500);
}

function closeChannelLounge() {
  chLeaveCurrentChannel();
  clearInterval(CH_LIST_POLL_TIMER);
  stopGameMembersBar();
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('home').classList.add('active');
}

/* ---- 채널 목록 화면 ---- */
function chPollList() {
  if (!document.getElementById('channels').classList.contains('active')) return;
  DBget(channelsKey()).then(function (state) {
    var channels = (state && state.channels) || [];
    CH_CHANNELS_CACHE = channels;
    if (!channels.length) {
      document.getElementById('ch-list').innerHTML = '<div class="lobby-hint">아직 만들어진 채널이 없어요. 아래에서 새로 만들어보세요!</div>';
      return;
    }
    Promise.all(channels.map(function (ch) {
      return DBget(chMembersKey(ch.id)).then(function (m) { return { ch: ch, members: m || {} }; });
    })).then(function (results) {
      if (!document.getElementById('channels').classList.contains('active')) return;
      var now = Date.now();
      var toDelete = [];
      var html = results.map(function (r) {
        var activeNames = [];
        Object.keys(r.members).forEach(function (pid) {
          if (r.members[pid] && now - r.members[pid].ts < 8000) activeNames.push(r.members[pid].name);
        });
        if (activeNames.length === 0 && (now - r.ch.createdAt > 5000)) toDelete.push(r.ch.id);
        return chRenderRow(r.ch, activeNames);
      }).join('');
      document.getElementById('ch-list').innerHTML = html;
      if (toDelete.length) chDeleteChannels(toDelete);
    });
  });
}

function chRenderRow(ch, activeNames) {
  return '<button class="ch-row" onclick="enterChannel(\'' + ch.id + '\')">' +
    '<div class="ch-row-top"><span class="ch-row-name">' + esc(ch.name) + '</span><span class="ch-row-count">' + activeNames.length + '명</span></div>' +
    '<div class="ch-row-members">' + (activeNames.length ? esc(activeNames.join(', ')) : '아직 아무도 없어요') + '</div>' +
    '</button>';
}

function createChannel() {
  var input = document.getElementById('ch-new-name');
  var errEl = document.getElementById('ch-create-err');
  var name = input.value.trim();
  if (!name) { errEl.textContent = '채널 이름을 입력해주세요.'; return; }
  DBget(channelsKey()).then(function (state) {
    state = state || { channels: [] };
    state.channels = state.channels || [];
    if (state.channels.length >= CH_MAX_CHANNELS) { errEl.textContent = '채널은 최대 ' + CH_MAX_CHANNELS + '개까지 만들 수 있어요.'; return; }
    errEl.textContent = '';
    var id = 'ch_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    var ch = { id: id, name: name.slice(0, 20), createdAt: Date.now() };
    state.channels.push(ch);
    DBset(channelsKey(), state).then(function () {
      input.value = '';
      CH_CHANNELS_CACHE = state.channels;
      enterChannel(id);
    });
  });
}

/* 활성 멤버가 하나도 없는 채널을 목록/채팅/멤버 상태에서 함께 정리합니다.
   여러 사람이 목록 화면을 보고 있을 때 동시에 이 정리를 시도해도, 둘 다 결국 같은
   결과(그 채널이 없어짐)로 수렴하기 때문에 크게 문제되지 않는 정도의 아주 작은 경합입니다. */
function chDeleteChannels(ids) {
  DBget(channelsKey()).then(function (state) {
    if (!state || !state.channels) return;
    state.channels = state.channels.filter(function (c) { return ids.indexOf(c.id) === -1; });
    DBset(channelsKey(), state);
  });
  ids.forEach(function (id) {
    DBset(chMembersKey(id), null);
    DBset(chChatKey(id), null);
  });
}

/* ---- 채널 안(채팅) 화면 ---- */
function enterChannel(chId) {
  var ch = CH_CHANNELS_CACHE.filter(function (c) { return c.id === chId; })[0];
  if (!ch) return;
  chLeaveCurrentChannel();
  CH_CURRENT_ID = chId;
  clearInterval(CH_LIST_POLL_TIMER);
  document.getElementById('ch-list-area').style.display = 'none';
  document.getElementById('ch-inside-area').style.display = '';
  document.getElementById('ch-inside-title').textContent = ch.name;
  document.getElementById('ch-messages').innerHTML = '';
  CH_LAST_RENDERED_COUNT = -1;
  chHeartbeat(chId).then(function () { if (chId === CH_CURRENT_ID) chPollInside(); });
  clearInterval(CH_MEMBER_HEARTBEAT_TIMER);
  CH_MEMBER_HEARTBEAT_TIMER = setInterval(function () { chHeartbeat(CH_CURRENT_ID); }, 2000);
  clearInterval(CH_CHAT_POLL_TIMER);
  CH_CHAT_POLL_TIMER = setInterval(chPollInside, 1200);
}

function backToChannelList() {
  chLeaveCurrentChannel();
  document.getElementById('ch-inside-area').style.display = 'none';
  document.getElementById('ch-list-area').style.display = '';
  chPollList();
  clearInterval(CH_LIST_POLL_TIMER);
  CH_LIST_POLL_TIMER = setInterval(chPollList, 1500);
}

/* 채널을 나갈 때(목록으로 돌아가거나, 라운지를 닫거나, 방을 나갈 때) 내 하트비트를 바로
   지워서 다른 사람 화면에서 즉시 반영되게 합니다(안 지워도 8초 뒤엔 어차피 사라짐). */
function chLeaveCurrentChannel() {
  clearInterval(CH_MEMBER_HEARTBEAT_TIMER);
  clearInterval(CH_CHAT_POLL_TIMER);
  if (CH_CURRENT_ID) {
    var idToLeave = CH_CURRENT_ID;
    DBget(chMembersKey(idToLeave)).then(function (m) {
      if (!m || !Object.prototype.hasOwnProperty.call(m, myPlayerId)) return;
      delete m[myPlayerId];
      DBset(chMembersKey(idToLeave), m);
    });
  }
  CH_CURRENT_ID = null;
}

function chHeartbeat(chId) {
  if (!chId) return Promise.resolve();
  return DBget(chMembersKey(chId)).then(function (m) {
    m = m || {};
    var now = Date.now();
    Object.keys(m).forEach(function (pid) { if (!m[pid] || now - m[pid].ts > 15000) delete m[pid]; });
    m[myPlayerId] = { name: me.name, ts: now };
    return DBset(chMembersKey(chId), m);
  });
}

function chPollInside() {
  if (!CH_CURRENT_ID) return;
  var chId = CH_CURRENT_ID;
  DBget(chChatKey(chId)).then(function (state) {
    if (chId !== CH_CURRENT_ID) return;
    chRenderMessages((state && state.messages) || []);
  });
  DBget(chMembersKey(chId)).then(function (m) {
    if (chId !== CH_CURRENT_ID) return;
    chRenderInsideMembers(m || {});
  });
}

function chRenderMessages(messages) {
  if (messages.length === CH_LAST_RENDERED_COUNT) return;
  CH_LAST_RENDERED_COUNT = messages.length;
  var el = document.getElementById('ch-messages');
  if (!el) return;
  el.innerHTML = messages.length ? messages.map(function (m) {
    var mine = m.pid === myPlayerId;
    return '<div class="group-chat-msg' + (mine ? ' mine' : '') + '"><span class="group-chat-name">' + esc(m.name) + '</span><span class="group-chat-text">' + esc(m.text) + '</span></div>';
  }).join('') : '<div class="lobby-hint">아직 대화가 없어요. 첫 메시지를 남겨보세요!</div>';
  el.scrollTop = el.scrollHeight;
}

function chRenderInsideMembers(m) {
  var el = document.getElementById('ch-inside-members');
  if (!el) return;
  var now = Date.now();
  var names = Object.keys(m).filter(function (pid) { return m[pid] && now - m[pid].ts < 8000; })
    .map(function (pid) { return m[pid].name + (pid === myPlayerId ? '(나)' : ''); });
  el.textContent = names.length ? ('👥 ' + names.join(', ')) : '👥 아직 아무도 없어요';
}

function chSendMessage() {
  var input = document.getElementById('ch-chat-input');
  var text = input.value.trim();
  if (!text || !CH_CURRENT_ID) return;
  var chId = CH_CURRENT_ID;
  input.value = '';
  DBget(chChatKey(chId)).then(function (state) {
    state = state || { messages: [] };
    state.messages = state.messages || [];
    state.messages.push({ id: Date.now() + '_' + Math.random().toString(36).slice(2, 6), pid: myPlayerId, name: me.name, text: text.slice(0, 200), ts: Date.now() });
    if (state.messages.length > 50) state.messages = state.messages.slice(-50);
    DBset(chChatKey(chId), state).then(function () { if (chId === CH_CURRENT_ID) chPollInside(); });
  });
  groupClearTyping();
}
