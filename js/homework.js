/* ===================== 📚 과제하기 (우리끼리 과제방) =====================
   선생님 없이 친구들끼리 쓰는 공간이에요. 같은 방 코드에 들어온 사람끼리:
   - 과제 목록을 같이 정리(과목 · 내용 · 마감일) → 마감 가까운 순으로 D-day 표시
   - "나 다 했어!" 체크 → 누가 다 했는지 한눈에
   - 과제마다 💬 자료·질문 방(사진/파일 올리기, 줄바꿈, 수정/삭제 가능)
   - 🔥 집중 타이머: 지금 누가 과제하는 중인지, 몇 분째인지 서로 보여요

   서버 저장 키(방마다):
   - hw_list          : { items: [...], del: [삭제된 id들] }  (누구나 추가/수정/삭제)
   - hw_d_<pid>       : { name, done: { 과제id: 시간 }, focusSince, ts }  (사람마다 따로 → 동시에 눌러도 안 꼬여요)
   - hw_c_<과제id>    : 자료·질문 채팅 { messages: [...] }

   무료 서버는 재시작되면 내용이 사라질 수 있어서, 각자 브라우저에 사본을 저장해 두고
   서버가 비어 있으면 누구든 들어오는 순간 자동으로 다시 채워 넣어요(자동 복구). */

var HW_POLL = null;
var HW_THREAD_POLL = null;
var HW_FOCUS_TICK = null;
var HW_STATE = { list: null, people: {}, filter: 'all', thread: null, editing: null };
var HW_THREAD_TRACKER = { lastSig: null, pending: [] };
var HW_SUBJECT_COLORS = ['#F2C744', '#6FC3DF', '#F2836B', '#B79CE8', '#6FC364', '#E89CC8', '#F2A65A', '#7FD8BE'];

function hwListKey() { return roomKey('hw_list'); }
function hwMeKey(pid) { return roomKey('hw_d_' + (pid || myPlayerId)); }
function hwThreadKey(id) { return roomKey('hw_c_' + id); }
function hwLocalKey() { return 'gamehub_hw_' + String(me.room || '').toUpperCase(); }

function hwLoadLocal() {
  try { return JSON.parse(localStorage.getItem(hwLocalKey()) || 'null') || {}; } catch (e) { return {}; }
}
function hwSaveLocal(patch) {
  try {
    var cur = hwLoadLocal();
    for (var k in patch) cur[k] = patch[k];
    localStorage.setItem(hwLocalKey(), JSON.stringify(cur));
  } catch (e) {}
}

function hwSubjectColor(s) {
  var h = 0;
  String(s || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
  return HW_SUBJECT_COLORS[h % HW_SUBJECT_COLORS.length];
}

/* 마감 날짜 → D-day 글자/색 */
function hwDue(item) {
  if (!item.due) return { text: '마감 없음', cls: 'none', sort: 9e15 };
  var d = new Date(item.due + (item.dueTime ? 'T' + item.dueTime : 'T23:59'));
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var days = Math.round((dueDay - today) / 86400000);
  var t = d.getTime();
  if (t < now.getTime()) return { text: '마감 지남', cls: 'over', sort: 8e15 + t };
  if (days === 0) return { text: '오늘 마감' + (item.dueTime ? ' ' + item.dueTime : ''), cls: 'today', sort: t };
  if (days === 1) return { text: '내일 마감', cls: 'soon', sort: t };
  return { text: 'D-' + days, cls: days <= 3 ? 'soon' : 'later', sort: t };
}
function hwFmtDate(item) {
  if (!item.due) return '';
  var d = new Date(item.due + 'T00:00');
  var w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return (d.getMonth() + 1) + '/' + d.getDate() + '(' + w + ')' + (item.dueTime ? ' ' + item.dueTime : '');
}

/* ---------- 열기 / 닫기 ---------- */
function openHomework() {
  if (playMode !== 'online' || !roomJoined) return;
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('homework').classList.add('active');
  document.getElementById('hw-room-pill').textContent = me.room + ' 방';
  HW_STATE.thread = null;
  HW_STATE.editing = null;
  document.getElementById('hw-thread').style.display = 'none';
  hwResetForm();
  /* 지난번에 저장해 둔 사본으로 먼저 그려서 바로 보이게 */
  var local = hwLoadLocal();
  if (local.list) { HW_STATE.list = local.list; hwRender(); }
  startGameMembersBar();
  ssMount('hw', 'hw-ss-bar');
  hwPoll();
  clearInterval(HW_POLL);
  HW_POLL = setInterval(hwPoll, 2000);
  clearInterval(HW_FOCUS_TICK);
  HW_FOCUS_TICK = setInterval(hwRenderFocus, 1000);
}

function closeHomework() {
  clearInterval(HW_POLL); HW_POLL = null;
  clearInterval(HW_THREAD_POLL); HW_THREAD_POLL = null;
  clearInterval(HW_FOCUS_TICK); HW_FOCUS_TICK = null;
  HW_STATE.thread = null;
  ssUnmount();
  stopGameMembersBar();
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('home').classList.add('active');
}

/* ---------- 서버 읽기 + 자동 복구 ---------- */
function hwMergeLists(a, b) {
  a = a || { items: [], del: [] }; b = b || { items: [], del: [] };
  var del = {};
  (a.del || []).concat(b.del || []).forEach(function (id) { del[id] = 1; });
  var map = {};
  (a.items || []).concat(b.items || []).forEach(function (it) {
    if (!it || !it.id || del[it.id]) return;
    if (!map[it.id] || (it.v || 0) > (map[it.id].v || 0)) map[it.id] = it;
  });
  var items = Object.keys(map).map(function (k) { return map[k]; });
  items.sort(function (x, y) { return x.ts - y.ts; });
  return { items: items, del: Object.keys(del).slice(-200) };
}
function hwListSig(l) {
  return (l.items || []).map(function (i) { return i.id + ':' + (i.v || 0); }).join(',') + '|' + (l.del || []).length;
}

/* hw_d_ 로 시작하는 사람별 상태를 전부 읽어요 (방에서 나간 친구 체크도 보이게) */
function hwFetchPeople() {
  if (cloudServerUrl && BATCH_SUPPORTED !== false) {
    return fetch(cloudServerUrl + '/api/states?room=' + encodeURIComponent(me.room) + '&prefix=' + encodeURIComponent('hw_d_'), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('nobatch'); return r.json(); })
      .then(function (j) {
        var out = {}, data = (j && j.data) || {};
        Object.keys(data).forEach(function (k) {
          var d = data[k];
          if (d && !d.__cleared) out[k.replace(/^hw_d_/, '')] = d;
        });
        return out;
      })
      .catch(function () { return DBgetPrefix('hw_d_'); });
  }
  return DBgetPrefix('hw_d_');
}

function hwMyState() {
  var p = HW_STATE.people[myPlayerId];
  if (p) return p;
  var local = hwLoadLocal();
  return local.mine || { name: me.name, done: {}, focusSince: null, ts: Date.now() };
}

function hwSaveMine(st) {
  st.name = me.name;
  st.ts = Date.now();
  HW_STATE.people[myPlayerId] = st;
  hwSaveLocal({ mine: st });
  return DBset(hwMeKey(), st);
}

var HW_POLL_BUSY = false;
function hwPoll() {
  if (HW_POLL_BUSY) return;
  HW_POLL_BUSY = true;
  Promise.all([DBget(hwListKey()), hwFetchPeople()]).then(function (res) {
    HW_POLL_BUSY = false;
    var server = res[0], people = res[1] || {};
    var local = hwLoadLocal();
    var merged = hwMergeLists(server, local.list);
    /* 서버에 빠진 게 있으면(서버 재시작 등) 내 사본으로 다시 채워 넣기 */
    if (!server || hwListSig(merged) !== hwListSig(hwMergeLists(server, null))) {
      if ((merged.items.length || merged.del.length)) DBset(hwListKey(), merged);
    }
    HW_STATE.list = merged;
    hwSaveLocal({ list: merged });
    /* 내 체크 상태가 서버에 없으면 복구 */
    if (!people[myPlayerId] && local.mine) { people[myPlayerId] = local.mine; DBset(hwMeKey(), local.mine); }
    else if (people[myPlayerId]) hwSaveLocal({ mine: people[myPlayerId] });
    HW_STATE.people = people;
    hwRender();
  }).catch(function () { HW_POLL_BUSY = false; });
}

/* ---------- 과제 추가 / 수정 / 삭제 ---------- */
function hwResetForm() {
  ['hw-subject', 'hw-title', 'hw-desc', 'hw-due', 'hw-due-time'].forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; });
  var btn = document.getElementById('hw-add-btn'); if (btn) btn.textContent = '+ 과제 추가';
  var cancel = document.getElementById('hw-cancel-edit'); if (cancel) cancel.style.display = 'none';
  var err = document.getElementById('hw-form-err'); if (err) err.textContent = '';
  HW_STATE.editing = null;
}

function hwSubmitForm() {
  var subject = document.getElementById('hw-subject').value.trim();
  var title = document.getElementById('hw-title').value.trim();
  var desc = document.getElementById('hw-desc').value.trim();
  var due = document.getElementById('hw-due').value;
  var dueTime = document.getElementById('hw-due-time').value;
  var err = document.getElementById('hw-form-err');
  if (!title) { err.textContent = '과제 내용을 적어주세요.'; document.getElementById('hw-title').focus(); return; }
  err.textContent = '';
  var editingId = HW_STATE.editing;
  DBget(hwListKey()).then(function (server) {
    var list = hwMergeLists(server, HW_STATE.list);
    if (editingId) {
      list.items.forEach(function (it) {
        if (it.id !== editingId) return;
        it.subject = subject.slice(0, 12); it.title = title.slice(0, 80); it.desc = desc.slice(0, 600);
        it.due = due; it.dueTime = dueTime; it.v = (it.v || 0) + 1; it.editBy = me.name;
      });
    } else {
      list.items.push({
        id: chatNewId(), subject: subject.slice(0, 12), title: title.slice(0, 80), desc: desc.slice(0, 600),
        due: due, dueTime: dueTime, by: myPlayerId, byName: me.name, ts: Date.now(), v: 1
      });
    }
    HW_STATE.list = list;
    hwSaveLocal({ list: list });
    hwResetForm();
    hwRender();
    return DBset(hwListKey(), list);
  });
}

function hwEdit(id) {
  var it = (HW_STATE.list.items || []).filter(function (x) { return x.id === id; })[0];
  if (!it) return;
  HW_STATE.editing = id;
  document.getElementById('hw-subject').value = it.subject || '';
  document.getElementById('hw-title').value = it.title || '';
  document.getElementById('hw-desc').value = it.desc || '';
  document.getElementById('hw-due').value = it.due || '';
  document.getElementById('hw-due-time').value = it.dueTime || '';
  document.getElementById('hw-add-btn').textContent = '✏️ 수정 저장';
  document.getElementById('hw-cancel-edit').style.display = '';
  document.getElementById('hw-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('hw-title').focus();
}

function hwDelete(id) {
  var it = (HW_STATE.list.items || []).filter(function (x) { return x.id === id; })[0];
  if (!it) return;
  chatConfirmBox('"' + it.title + '" 과제를 지울까요?', '모두의 목록에서 사라지고, 자료·질문 방도 같이 지워져요.', '삭제', function () {
    DBget(hwListKey()).then(function (server) {
      var list = hwMergeLists(server, HW_STATE.list);
      list.del.push(id);
      list = hwMergeLists(list, null);
      HW_STATE.list = list;
      hwSaveLocal({ list: list });
      if (HW_STATE.thread === id) hwCloseThread();
      hwRender();
      DBget(hwThreadKey(id)).then(function (st) { chatDeleteFilesOf(st && st.messages); DBset(hwThreadKey(id), null); });
      return DBset(hwListKey(), list);
    });
  });
}

function hwToggleDone(id) {
  var st = JSON.parse(JSON.stringify(hwMyState()));
  st.done = st.done || {};
  if (st.done[id]) delete st.done[id];
  else st.done[id] = Date.now();
  hwSaveMine(st);
  hwRender();
  if (st.done[id]) hwConfetti();
}

function hwSetFilter(f) {
  HW_STATE.filter = f;
  document.querySelectorAll('.hw-filter button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-f') === f); });
  hwRender();
}

/* ---------- 🔥 집중 타이머 ---------- */
function hwToggleFocus() {
  var st = JSON.parse(JSON.stringify(hwMyState()));
  if (st.focusSince) {
    var mins = Math.floor((Date.now() - st.focusSince) / 60000);
    st.focusTotal = (st.focusDay === hwToday() ? (st.focusTotal || 0) : 0) + mins;
    st.focusDay = hwToday();
    st.focusSince = null;
  } else {
    st.focusSince = Date.now();
  }
  hwSaveMine(st);
  hwRenderFocus();
}
function hwToday() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function hwFmtDur(ms) {
  var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
}

function hwRenderFocus() {
  var box = document.getElementById('hw-focus');
  if (!box) return;
  var mine = hwMyState();
  var now = Date.now();
  var people = HW_STATE.people || {};
  var online = {};
  (roomPlayersList || []).forEach(function (p) { online[p.id] = p; });
  var ids = Object.keys(people).filter(function (pid) { return online[pid] || people[pid].focusSince; });
  if (ids.indexOf(myPlayerId) < 0) ids.unshift(myPlayerId);
  (roomPlayersList || []).forEach(function (p) { if (ids.indexOf(p.id) < 0) ids.push(p.id); });
  var chips = ids.map(function (pid) {
    var p = people[pid] || {};
    var name = pid === myPlayerId ? me.name : (p.name || (online[pid] && online[pid].name) || '?');
    /* 6시간 넘게 켜져 있으면 깜빡 잊은 걸로 보고 표시 안 함 */
    var focusing = p.focusSince && now - p.focusSince < 6 * 3600000;
    if (pid === myPlayerId) focusing = !!mine.focusSince;
    var since = pid === myPlayerId ? mine.focusSince : p.focusSince;
    var todayTotal = (p.focusDay === hwToday() ? p.focusTotal || 0 : 0);
    return '<div class="hw-chip' + (focusing ? ' on' : '') + (online[pid] ? '' : ' off') + '">' +
      '<span class="hw-ava" style="background:' + chatAvatarColor(pid) + '">' + esc(name.charAt(0)) + '</span>' +
      '<span class="hw-chip-name">' + esc(name) + (pid === myPlayerId ? ' (나)' : '') + '</span>' +
      '<span class="hw-chip-st">' + (focusing ? '🔥 ' + hwFmtDur(now - since) : (todayTotal ? '오늘 ' + todayTotal + '분' : (online[pid] ? '쉬는 중' : '나감'))) + '</span>' +
    '</div>';
  }).join('');
  var btn = mine.focusSince
    ? '<button class="btn hw-focus-btn stop" onclick="hwToggleFocus()">⏸ 그만하기 <b>' + hwFmtDur(now - mine.focusSince) + '</b></button>'
    : '<button class="btn btn-primary hw-focus-btn" onclick="hwToggleFocus()">🔥 나 과제 시작!</button>';
  box.innerHTML = '<div class="hw-focus-top"><span class="hw-sec-title">지금 같이 하는 중</span>' + btn + '</div><div class="hw-chips">' + chips + '</div>';
}

/* ---------- 목록 그리기 ---------- */
function hwRender() {
  hwRenderFocus();
  var el = document.getElementById('hw-list');
  if (!el) return;
  var items = ((HW_STATE.list && HW_STATE.list.items) || []).slice();
  var people = HW_STATE.people || {};
  var mine = hwMyState();
  var members = {};
  (roomPlayersList || []).forEach(function (p) { members[p.id] = p.name; });
  items.forEach(function (it) { it._due = hwDue(it); it._mine = !!(mine.done && mine.done[it.id]); });
  items.sort(function (a, b) { return (a._mine - b._mine) || (a._due.sort - b._due.sort); });
  var f = HW_STATE.filter;
  var shown = items.filter(function (it) { return f === 'all' || (f === 'todo' ? !it._mine : it._mine); });
  var todoCount = items.filter(function (it) { return !it._mine; }).length;
  var cnt = document.getElementById('hw-count');
  if (cnt) cnt.textContent = items.length ? ('남은 과제 ' + todoCount + '개 / 전체 ' + items.length + '개') : '';
  if (!shown.length) {
    el.innerHTML = '<div class="hw-empty">' + (items.length ? (f === 'todo' ? '🎉 할 과제를 다 끝냈어요!' : '아직 다 한 과제가 없어요.') : '아직 과제가 없어요.<br>위에서 첫 과제를 추가해 보세요!') + '</div>';
    return;
  }
  el.innerHTML = shown.map(function (it) {
    var doneBy = Object.keys(people).filter(function (pid) { return people[pid].done && people[pid].done[it.id]; });
    if (it._mine && doneBy.indexOf(myPlayerId) < 0) doneBy.push(myPlayerId);
    /* 전체 인원 = 지금 방에 있는 사람 + (나갔어도) 이 과제를 끝낸 사람 */
    var totalSet = {};
    Object.keys(members).forEach(function (k) { totalSet[k] = 1; });
    doneBy.forEach(function (k) { totalSet[k] = 1; });
    var total = Object.keys(totalSet).length || 1;
    var avas = doneBy.slice(0, 8).map(function (pid) {
      var nm = pid === myPlayerId ? me.name : (people[pid].name || '?');
      return '<span class="hw-ava sm" title="' + esc(nm) + '" style="background:' + chatAvatarColor(pid) + '">' + esc(nm.charAt(0)) + '</span>';
    }).join('');
    var col = hwSubjectColor(it.subject || '기타');
    return '<div class="hw-card' + (it._mine ? ' done' : '') + ' due-' + it._due.cls + '">' +
      '<div class="hw-card-top">' +
        (it.subject ? '<span class="hw-subj" style="background:' + col + '">' + esc(it.subject) + '</span>' : '') +
        '<span class="hw-dday ' + it._due.cls + '">' + it._due.text + '</span>' +
        (it.due ? '<span class="hw-date">' + hwFmtDate(it) + '</span>' : '') +
        '<span class="hw-spacer"></span>' +
        '<button class="hw-icon-btn" title="수정" onclick="hwEdit(\'' + it.id + '\')">✏️</button>' +
        '<button class="hw-icon-btn" title="삭제" onclick="hwDelete(\'' + it.id + '\')">🗑️</button>' +
      '</div>' +
      '<div class="hw-title">' + esc(it.title) + '</div>' +
      (it.desc ? '<div class="hw-desc">' + chatLinkify(it.desc) + '</div>' : '') +
      '<div class="hw-meta">' + esc(it.byName || '') + '님이 올림' + (it.editBy ? ' · ' + esc(it.editBy) + '님이 수정' : '') + '</div>' +
      '<div class="hw-card-bottom">' +
        '<button class="hw-check' + (it._mine ? ' on' : '') + '" onclick="hwToggleDone(\'' + it.id + '\')">' + (it._mine ? '✅ 다 했어!' : '⬜ 다 했으면 체크') + '</button>' +
        '<span class="hw-doneby">' + avas + '<span class="hw-done-n">' + doneBy.length + '/' + total + '명 완료</span></span>' +
        '<button class="btn btn-ghost hw-thread-btn" onclick="hwOpenThread(\'' + it.id + '\')">💬 자료·질문</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function hwConfetti() {
  var box = document.getElementById('homework');
  for (var i = 0; i < 18; i++) {
    var c = document.createElement('span');
    c.className = 'hw-confetti';
    c.textContent = ['🎉', '✨', '⭐', '💯'][i % 4];
    c.style.left = (10 + Math.random() * 80) + '%';
    c.style.animationDelay = (Math.random() * 0.3) + 's';
    box.appendChild(c);
    (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1600); })(c);
  }
}

/* ---------- 💬 자료·질문 방 ---------- */
function hwOpenThread(id) {
  var it = (HW_STATE.list.items || []).filter(function (x) { return x.id === id; })[0];
  if (!it) return;
  HW_STATE.thread = id;
  HW_THREAD_TRACKER.lastSig = null;
  HW_THREAD_TRACKER.pending = [];
  document.getElementById('hw-thread-title').textContent = (it.subject ? '[' + it.subject + '] ' : '') + it.title;
  document.getElementById('hw-upload-err').textContent = '';
  document.getElementById('hw-thread').style.display = 'flex';
  document.getElementById('hw-messages').innerHTML = '<div class="cmsg-empty">불러오는 중...</div>';
  hwPollThread();
  clearInterval(HW_THREAD_POLL);
  HW_THREAD_POLL = setInterval(hwPollThread, 1500);
  setTimeout(function () { var i = document.getElementById('hw-chat-input'); if (i && window.matchMedia && !window.matchMedia('(pointer: coarse)').matches) i.focus(); }, 50);
}

function hwCloseThread() {
  HW_STATE.thread = null;
  clearInterval(HW_THREAD_POLL); HW_THREAD_POLL = null;
  document.getElementById('hw-thread').style.display = 'none';
}

function hwPollThread() {
  var id = HW_STATE.thread;
  if (!id) return;
  DBget(hwThreadKey(id)).then(function (st) {
    if (HW_STATE.thread !== id) return;
    var msgs = (st && st.messages) || [];
    /* 서버가 비었는데 내 사본에 대화가 있으면 다시 채워 넣기 (파일 내용은 복구 안 될 수 있어요) */
    var local = hwLoadLocal(), threads = local.threads || {};
    if (!msgs.length && threads[id] && threads[id].length) {
      msgs = threads[id];
      DBset(hwThreadKey(id), { messages: msgs });
    } else if (msgs.length) {
      threads[id] = msgs.slice(-60);
      hwSaveLocal({ threads: threads });
    }
    chatRenderInto(document.getElementById('hw-messages'), msgs, HW_THREAD_TRACKER, '아직 아무 말도 없어요. 자료나 질문을 올려보세요!');
  });
}

function hwSendThread() {
  var input = document.getElementById('hw-chat-input');
  var text = input.value.trim();
  if (!text || !HW_STATE.thread) return;
  var id = HW_STATE.thread;
  input.value = '';
  chatAutoGrow(input);
  chatSendText(hwThreadKey(id), text).then(function () { if (HW_STATE.thread === id) hwPollThread(); });
}

function hwSendThreadFiles(files) {
  if (!HW_STATE.thread) return;
  var id = HW_STATE.thread;
  chatSendFiles(hwThreadKey(id), files, HW_THREAD_TRACKER, function () {
    if (HW_STATE.thread === id) hwPollThread();
  }, function (msg) {
    var el = document.getElementById('hw-upload-err');
    if (el) el.textContent = msg;
  });
}

(function hwSetup() {
  var el = document.getElementById('hw-messages');
  if (!el) return;
  chatBindMessageArea(el, hwSendThreadFiles, function () { return HW_STATE.thread ? hwThreadKey(HW_STATE.thread) : null; }, function () { hwPollThread(); });
  chatBindComposer({ inputId: 'hw-chat-input', attachBtnId: 'hw-attach-btn', fileInputId: 'hw-file-input', onFiles: hwSendThreadFiles });
  chatSetupMultiline(document.getElementById('hw-chat-input'), hwSendThread);
  var title = document.getElementById('hw-title');
  if (title) title.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); hwSubmitForm(); } });
  document.getElementById('hw-thread').addEventListener('click', function (e) { if (e.target.id === 'hw-thread') hwCloseThread(); });
})();
