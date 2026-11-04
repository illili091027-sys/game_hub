/* ===================== 📚 과제방 (모둠 과제 같이 하기) =====================
   같은 방 코드로 들어온 친구들끼리:
   - 💬 채팅 (PC는 오른쪽에 항상, 휴대폰은 탭)
   - 🖼 발표 자료(PPT)를 같이 만들기: 슬라이드마다 따로 저장돼서 서로 다른 슬라이드는 동시에 고쳐도 안 꼬여요.
        같은 슬라이드는 먼저 고치는 사람이 잠깐 '편집 중'으로 잡아요(다른 사람은 보기만).
        ▶ 발표하기(전체 화면), ⬇ PPT 파일(.pptx)로 내려받기
   - 📁 자료실: 사진·파일·링크 모으기, 사진은 바로 슬라이드에 넣기
   - 📺 화면 공유 (screenshare.js)

   서버 키(방마다):
   pj_decks              { items:[{id,title,ts,byName}], del:[] }   발표 자료 목록
   pj_d_<덱>             { id, title, theme, order:[슬라이드id], v }  덱 정보 + 슬라이드 순서
   pj_s_<덱>_<슬라이드>  { id, layout, title, body, note, img:{fileId,fname}|null, v, byName }
   pj_l_<덱>_<슬라이드>  { pid, name, ts }                          '편집 중' 표시(8초 안에 갱신 없으면 풀림)
   pj_files              { items:[...], del:[] }                    자료실
   pj_chat               채팅 { messages }

   무료 서버가 재시작되면 내용이 사라질 수 있어서, 글자 내용은 각자 브라우저에도 사본을 두고
   서버가 비어 있으면 들어오는 순간 자동으로 다시 채워요. (사진·파일 자체는 복구가 안 될 수 있어요) */

var PJ = {
  tab: 'deck', deckId: null, deck: null, slides: {}, locks: {}, cur: null,
  decks: null, files: null, poll: null, chatPoll: null, dirty: {}, saveT: null, lockT: null,
  chatSeen: 0, chatTracker: { lastSig: null, pending: [] }
};
var PJ_THEMES = [
  { name: '크림', bg: '#FFF8E7', fg: '#3a2f1e', accent: '#F2A65A' },
  { name: '하늘', bg: '#E8F4FF', fg: '#1e3550', accent: '#4A90D9' },
  { name: '민트', bg: '#E6F7EF', fg: '#1d3b2c', accent: '#3BAA75' },
  { name: '분홍', bg: '#FFEAF1', fg: '#4a2233', accent: '#E8508A' },
  { name: '칠판', bg: '#23382D', fg: '#F5F3E7', accent: '#F2C744' },
  { name: '밤하늘', bg: '#1E2340', fg: '#F0F2FF', accent: '#9C8CFF' }
];
var PJ_LAYOUTS = [
  { id: 'title', name: '표지' }, { id: 'text', name: '제목+내용' }, { id: 'textimg', name: '내용+사진' },
  { id: 'img', name: '사진 크게' }, { id: 'section', name: '소제목' }
];

function pjK(s) { return roomKey(s); }
function pjLocalKey() { return 'gamehub_pj_' + String(me.room || '').toUpperCase(); }
function pjLocal() { try { return JSON.parse(localStorage.getItem(pjLocalKey()) || 'null') || {}; } catch (e) { return {}; } }
function pjSaveLocal(fn) { try { var l = pjLocal(); fn(l); localStorage.setItem(pjLocalKey(), JSON.stringify(l)); } catch (e) {} }

function pjMergeList(a, b) {
  a = a || { items: [], del: [] }; b = b || { items: [], del: [] };
  var del = {};
  (a.del || []).concat(b.del || []).forEach(function (id) { del[id] = 1; });
  var map = {};
  (a.items || []).concat(b.items || []).forEach(function (it) {
    if (!it || !it.id || del[it.id]) return;
    if (!map[it.id] || (it.v || 0) > (map[it.id].v || 0)) map[it.id] = it;
  });
  var items = Object.keys(map).map(function (k) { return map[k]; }).sort(function (x, y) { return x.ts - y.ts; });
  return { items: items, del: Object.keys(del).slice(-300) };
}
function pjSig(l) { return (l.items || []).map(function (i) { return i.id + ':' + (i.v || 0); }).join(',') + '|' + (l.del || []).length; }

/* 접두어로 시작하는 키 한꺼번에 읽기 → { 뒷부분: data } */
function pjFetchPrefix(prefix) {
  if (cloudServerUrl && BATCH_SUPPORTED !== false && playMode === 'online') {
    return fetch(cloudServerUrl + '/api/states?room=' + encodeURIComponent(me.room) + '&prefix=' + encodeURIComponent(prefix), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('nobatch'); return r.json(); })
      .then(function (j) {
        var out = {}, data = (j && j.data) || {};
        Object.keys(data).forEach(function (k) { var d = data[k]; if (d && !d.__cleared) out[k.slice(prefix.length)] = d; });
        return out;
      })
      .catch(function () { return {}; });
  }
  return Promise.resolve({});
}

/* ---------------- 열기 / 닫기 / 탭 ---------------- */
function openHomework() {
  if (playMode !== 'online' || !roomJoined) return;
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('homework').classList.add('active');
  document.getElementById('hw-room-pill').textContent = me.room + ' 방';
  PJ.deckId = null;
  PJ.chatTracker = { lastSig: null, pending: [] };
  var l = pjLocal();
  if (l.decks) PJ.decks = l.decks;
  if (l.files) PJ.files = l.files;
  pjShowPane();
  pjRenderDecks();
  pjRenderFiles();
  startGameMembersBar();
  if (typeof ssRenderBar === 'function') ssRenderBar();
  pjPoll();
  clearInterval(PJ.poll); PJ.poll = setInterval(pjPoll, 1500);
  pjPollChat();
  clearInterval(PJ.chatPoll); PJ.chatPoll = setInterval(pjPollChat, 1300);
}

function closeHomework() {
  pjFlushSave();
  pjReleaseLock();
  clearInterval(PJ.poll); PJ.poll = null;
  clearInterval(PJ.chatPoll); PJ.chatPoll = null;
  clearInterval(PJ.lockT); PJ.lockT = null;
  PJ.deckId = null;
  stopGameMembersBar();
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('home').classList.add('active');
  /* 과제하기 모드: 방에 그대로 있으면서 게임 화면으로 (화면 공유도 계속돼요).
     게임 화면 위쪽의 '📚 과제방으로 돌아가기'로 다시 들어올 수 있어요 */
  var bb = document.getElementById('btn-back-hw');
  if (bb) bb.style.display = (typeof HW_MODE !== 'undefined' && HW_MODE) ? '' : 'none';
}
/* core.js의 방 나가기에서 부르는 정리용 (예전 이름 호환) */
var HW_POLL = null, HW_THREAD_POLL = null, HW_FOCUS_TICK = null;
function pjStopAll() { clearInterval(PJ.poll); clearInterval(PJ.chatPoll); clearInterval(PJ.lockT); }

function pjTab(t) {
  PJ.tab = t;
  document.querySelectorAll('#pj-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
  document.getElementById('homework').classList.toggle('pj-chat-open', t === 'chat');
  if (t === 'chat') { PJ.chatSeen = PJ.chatCount || 0; pjBadge(); var m = document.getElementById('pj-chat-messages'); if (m) m.scrollTop = m.scrollHeight; }
  pjShowPane();
}
function pjShowPane() {
  var t = PJ.tab;
  document.getElementById('pj-pane-decks').style.display = (t === 'deck' && !PJ.deckId) ? '' : 'none';
  document.getElementById('pj-pane-editor').style.display = (t === 'deck' && PJ.deckId && !PJ.ext) ? '' : 'none';
  document.getElementById('pj-pane-ext').style.display = (t === 'deck' && PJ.deckId && PJ.ext) ? '' : 'none';
  document.getElementById('pj-pane-files').style.display = t === 'files' ? '' : 'none';
}

/* ---------------- 주기적으로 읽기 (+ 자동 복구) ---------------- */
var PJ_POLL_BUSY = false;
function pjPoll() {
  if (PJ_POLL_BUSY) return;
  PJ_POLL_BUSY = true;
  var deckId = PJ.ext ? null : PJ.deckId;
  var jobs = [DBget(pjK('pj_decks')), DBget(pjK('pj_files'))];
  if (deckId) {
    jobs.push(DBget(pjK('pj_d_' + deckId)));
    jobs.push(pjFetchPrefix('pj_s_' + deckId + '_'));
    jobs.push(pjFetchPrefix('pj_l_' + deckId + '_'));
  }
  Promise.all(jobs).then(function (r) {
    PJ_POLL_BUSY = false;
    var l = pjLocal();
    /* 발표 자료 목록 */
    var decks = pjMergeList(r[0], l.decks);
    if (pjSig(decks) !== pjSig(pjMergeList(r[0], null)) && (decks.items.length || decks.del.length)) DBset(pjK('pj_decks'), decks);
    PJ.decks = decks;
    /* 자료실 */
    var files = pjMergeList(r[1], l.files);
    if (pjSig(files) !== pjSig(pjMergeList(r[1], null)) && (files.items.length || files.del.length)) DBset(pjK('pj_files'), files);
    PJ.files = files;
    pjSaveLocal(function (x) { x.decks = decks; x.files = files; });
    pjRenderDecks();
    pjRenderFiles();
    if (deckId && deckId === PJ.deckId) pjApplyDeck(r[2], r[3] || {}, r[4] || {});
  }).catch(function () { PJ_POLL_BUSY = false; });
}

/* ---------------- 발표 자료 목록 ---------------- */
function pjCreateDeck() {
  var inp = document.getElementById('pj-new-deck');
  var title = inp.value.trim() || '새 발표 자료';
  var id = chatNewId();
  var s1 = chatNewId();
  var deck = { id: id, title: title.slice(0, 40), theme: Math.floor(Math.random() * 4), order: [s1], v: 1 };
  var slide = { id: s1, layout: 'title', title: title.slice(0, 40), body: '', note: '', img: null, v: 1, byName: me.name };
  inp.value = '';
  DBget(pjK('pj_decks')).then(function (srv) {
    var list = pjMergeList(srv, PJ.decks);
    list.items.push({ id: id, title: deck.title, ts: Date.now(), byName: me.name, v: 1 });
    PJ.decks = list;
    pjSaveLocal(function (x) { x.decks = list; (x.deck = x.deck || {})[id] = deck; ((x.slides = x.slides || {})[id] = {})[s1] = slide; });
    return Promise.all([DBset(pjK('pj_decks'), list), DBset(pjK('pj_d_' + id), deck), DBset(pjK('pj_s_' + id + '_' + s1), slide)]);
  }).then(function () { pjOpenDeck(id); });
}

function pjDeleteDeck(id, title) {
  chatConfirmBox('"' + title + '" 발표 자료를 지울까요?', '모두의 화면에서 사라지고 되돌릴 수 없어요.', '삭제', function () {
    DBget(pjK('pj_decks')).then(function (srv) {
      var list = pjMergeList(srv, PJ.decks);
      list.del.push(id);
      list = pjMergeList(list, null);
      PJ.decks = list;
      pjSaveLocal(function (x) { x.decks = list; if (x.deck) delete x.deck[id]; if (x.slides) delete x.slides[id]; });
      pjRenderDecks();
      DBset(pjK('pj_decks'), list);
      DBget(pjK('pj_d_' + id)).then(function (d) {
        ((d && d.order) || []).forEach(function (sid) { DBset(pjK('pj_s_' + id + '_' + sid), null); });
        DBset(pjK('pj_d_' + id), null);
      });
    });
  });
}

function pjRenderDecks() {
  var el = document.getElementById('pj-deck-list');
  if (!el) return;
  var items = ((PJ.decks && PJ.decks.items) || []).slice().reverse();
  if (!items.length) { el.innerHTML = '<div class="pj-empty">아직 꽂아둔 발표 자료가 없어요.<br>위에서 미리캔버스 공유 링크를 붙여넣고 <b>📌 꽂기</b>를 눌러보세요!</div>'; return; }
  var html = items.map(function (d) {
    var pv = d.url ? pjProvider(d.url) : null;
    return '<div class="pj-deck-card' + (pv ? ' ext' : '') + '" onclick="pjOpenDeck(\'' + d.id + '\')">' +
      (pv ? '<div class="pj-deck-ico pj-pv" style="background:' + pv.color + '">' + pv.icon + '</div>' : '<div class="pj-deck-ico">🖼</div>') +
      '<div class="pj-deck-info"><div class="pj-deck-name">' + esc(d.title) + '</div>' +
      '<div class="pj-deck-meta">' + (pv ? pv.name + ' · ' + esc(d.byName || '') + '님이 꽂음' : esc(d.byName || '') + '님이 만듦') + '</div></div>' +
      (pv ? '<a class="btn btn-primary pj-deck-open" href="' + esc(d.url) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">✏️ 같이 편집 ↗</a>' : '') +
      '<button class="hw-icon-btn" title="삭제" onclick="event.stopPropagation();pjDeleteDeck(\'' + d.id + '\',\'' + esc(d.title).replace(/'/g, '&#39;') + '\')">🗑️</button>' +
    '</div>';
  }).join('');
  if (el.getAttribute('data-h') !== html) { el.innerHTML = html; el.setAttribute('data-h', html); }
}

/* ---------------- 편집기 ---------------- */
/* ---------------- 📌 미리캔버스 · 캔바 · 구글 슬라이드 링크 꽂기 ---------------- */
function pjProvider(url) {
  var u = String(url || '');
  if (/miricanvas\.com/i.test(u)) return { id: 'miri', name: '미리캔버스', icon: 'M', color: '#1EBC9C' };
  if (/canva\.com/i.test(u)) return { id: 'canva', name: '캔바', icon: 'C', color: '#7D2AE8' };
  if (/docs\.google\.com\/presentation/i.test(u)) return { id: 'gslides', name: '구글 슬라이드', icon: 'G', color: '#F4B400' };
  if (/figma\.com/i.test(u)) return { id: 'figma', name: '피그마', icon: 'F', color: '#A259FF' };
  if (/(sharepoint\.com|onedrive\.live\.com|1drv\.ms|office\.com)/i.test(u)) return { id: 'office', name: '파워포인트 온라인', icon: 'P', color: '#D24726' };
  return { id: 'web', name: '링크', icon: '🔗', color: '#6FC3DF' };
}
/* 미리보기로 화면에 띄울 수 있는 주소 (못 띄우는 곳은 null) */
function pjEmbedUrl(url) {
  var m;
  if ((m = url.match(/canva\.com\/design\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9_-]+))?/))) return 'https://www.canva.com/design/' + m[1] + '/' + (m[2] && !/^(edit|view|watch)$/.test(m[2]) ? m[2] + '/' : '') + 'view?embed';
  if ((m = url.match(/docs\.google\.com\/presentation\/d\/([A-Za-z0-9_-]+)/))) return 'https://docs.google.com/presentation/d/' + m[1] + '/embed?start=false&loop=false&delayms=3000';
  if (/miricanvas\.com\/v\//i.test(url)) return url; /* 미리캔버스 '웹으로 보기' 링크 */
  return null;
}
function pjAddExternal() {
  var u = document.getElementById('pj-ext-url'), n = document.getElementById('pj-ext-name'), err = document.getElementById('pj-ext-err');
  var url = u.value.trim();
  var m = url.match(/https?:\/\/[^\s"'<>]+/i);
  if (!m && /^[\w.-]+\.[a-z]{2,}\//i.test(url)) url = 'https://' + url;
  else if (m) url = m[0];
  if (!/^https?:\/\//i.test(url)) { err.textContent = '공유 링크(https://로 시작하는 주소)를 붙여넣어 주세요.'; u.focus(); return; }
  err.textContent = '';
  var pv = pjProvider(url);
  var title = n.value.trim() || (pv.name + ' 발표 자료');
  var item = { id: chatNewId(), title: title.slice(0, 40), url: url.slice(0, 500), ts: Date.now(), byName: me.name, v: 1 };
  u.value = ''; n.value = '';
  DBget(pjK('pj_decks')).then(function (srv) {
    var list = pjMergeList(srv, PJ.decks);
    list.items.push(item);
    PJ.decks = list;
    pjSaveLocal(function (x) { x.decks = list; });
    pjRenderDecks();
    DBset(pjK('pj_decks'), list);
    chatSendText(pjChatKey(), '📌 ' + pv.name + ' "' + item.title + '"을(를) 꽂았어요! 🖼 발표 자료에서 눌러서 같이 만들어요\n' + url).then(pjPollChat);
  });
}
function pjOpenExternal(d) {
  PJ.deckId = d.id;
  PJ.ext = d;
  var pv = pjProvider(d.url);
  document.getElementById('pj-ext-badge').innerHTML = '<span class="pj-pv sm" style="background:' + pv.color + '">' + pv.icon + '</span>';
  document.getElementById('pj-ext-title').textContent = d.title;
  document.getElementById('pj-ext-open').href = d.url;
  var emb = pjEmbedUrl(d.url);
  var wrap = document.getElementById('pj-ext-frame-wrap');
  wrap.innerHTML = emb
    ? '<iframe src="' + esc(emb) + '" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>'
    : '<div class="pj-ext-card"><div class="pj-pv big" style="background:' + pv.color + '">' + pv.icon + '</div><div class="pj-ext-card-t">' + esc(d.title) + '</div>' +
      '<div class="pj-ext-card-s">' + pv.name + ' 편집 화면은 여기 안에 바로 띄울 수 없어서 새 창으로 열려요.</div>' +
      '<a class="btn btn-primary" href="' + esc(d.url) + '" target="_blank" rel="noopener noreferrer">✏️ 열어서 같이 편집 ↗</a></div>';
  document.getElementById('pj-ext-tip').innerHTML = '💡 같이 편집하려면 각자 <b>' + pv.name + '</b>에 로그인해야 해요. 링크를 연 친구가 편집을 못 하면, 꽂은 사람이 ' + pv.name + ' 공유 설정에서 <b>"편집 가능"</b>으로 바꿔주세요.' +
    (emb ? '<br>미리보기가 안 보이거나 오래된 내용이면 <b>✏️ 열어서 같이 편집</b>을 눌러요. (미리보기는 "보기 공개"된 디자인만 보여요)' : '') +
    '<br>편집하면서 이 과제방의 💬 채팅으로 역할을 나눠요! (예: "1~3장은 내가 할게")';
  pjShowPane();
}
function pjCopyExt() {
  if (!PJ.ext) return;
  var url = PJ.ext.url;
  var done = function () { var b = document.querySelector('#pj-pane-ext .pj-ed-top .btn-ghost:nth-of-type(2)'); alert('링크를 복사했어요!'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt('이 링크를 복사하세요', url); });
  else prompt('이 링크를 복사하세요', url);
}

function pjOpenDeck(id) {
  var item = ((PJ.decks && PJ.decks.items) || []).filter(function (d) { return d.id === id; })[0];
  if (item && item.url) { pjOpenExternal(item); return; }
  PJ.ext = null;
  PJ.deckId = id;
  var l = pjLocal();
  PJ.deck = (l.deck && l.deck[id]) || null;
  PJ.slides = (l.slides && l.slides[id]) ? JSON.parse(JSON.stringify(l.slides[id])) : {};
  PJ.locks = {};
  PJ.cur = PJ.deck && PJ.deck.order && PJ.deck.order[0] || null;
  PJ.dirty = {};
  PJ.tab = 'deck';
  document.querySelectorAll('#pj-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === 'deck'); });
  document.getElementById('homework').classList.remove('pj-chat-open');
  pjShowPane();
  pjRenderEditor(true);
  PJ_POLL_BUSY = false;
  pjPoll();
  clearInterval(PJ.lockT);
  PJ.lockT = setInterval(pjLockBeat, 3000);
}

function pjCloseDeck() {
  pjFlushSave();
  pjReleaseLock();
  clearInterval(PJ.lockT); PJ.lockT = null;
  PJ.deckId = null;
  PJ.ext = null;
  var wrap = document.getElementById('pj-ext-frame-wrap'); if (wrap) wrap.innerHTML = '';
  pjShowPane();
  pjRenderDecks();
}

/* 서버 내용 반영: 내가 고치는 중인 슬라이드는 덮어쓰지 않아요 */
function pjApplyDeck(deck, slides, locks) {
  var id = PJ.deckId;
  var l = pjLocal();
  var localDeck = l.deck && l.deck[id];
  var localSlides = (l.slides && l.slides[id]) || {};
  if (!deck && localDeck) { deck = localDeck; DBset(pjK('pj_d_' + id), deck); } /* 복구 */
  if (!deck) return;
  if (!PJ.deck || (deck.v || 0) >= (PJ.deck.v || 0)) PJ.deck = deck;
  (PJ.deck.order || []).forEach(function (sid) {
    var srv = slides[sid];
    if (!srv && localSlides[sid]) { srv = localSlides[sid]; DBset(pjK('pj_s_' + id + '_' + sid), srv); } /* 복구 */
    if (!srv) return;
    var mine = PJ.slides[sid];
    if (PJ.dirty[sid]) return;
    if (!mine || (srv.v || 0) > (mine.v || 0)) PJ.slides[sid] = srv;
  });
  PJ.locks = locks || {};
  if (!PJ.cur || (PJ.deck.order || []).indexOf(PJ.cur) < 0) PJ.cur = (PJ.deck.order || [])[0] || null;
  pjSaveLocal(function (x) { (x.deck = x.deck || {})[id] = PJ.deck; (x.slides = x.slides || {})[id] = PJ.slides; });
  pjRenderEditor(false);
}

function pjLockOf(sid) {
  var lk = PJ.locks[sid];
  if (!lk || lk.pid === myPlayerId || Date.now() - lk.ts > 8000) return null;
  return lk;
}

function pjTheme() { return PJ_THEMES[(PJ.deck && PJ.deck.theme) || 0] || PJ_THEMES[0]; }

/* 슬라이드 한 장 그리기 (편집 화면/썸네일/발표 공용). 크기는 바깥 상자 기준 비율(cqw)로 맞춰져요 */
function pjSlideHtml(s, theme) {
  theme = theme || pjTheme();
  if (!s) return '<div class="pj-slide" style="background:' + theme.bg + '"></div>';
  var lines = String(s.body || '').split('\n').filter(function (x) { return x.trim(); });
  var body = lines.length ? '<ul>' + lines.map(function (x) { return '<li>' + esc(x.replace(/^[-•·*]\s*/, '')) + '</li>'; }).join('') + '</ul>' : '';
  var img = s.img && s.img.fileId ? '<div class="pj-s-img" data-fid="' + esc(s.img.fileId) + '">' + pjImgTag(s.img.fileId) + '</div>' : '';
  var lay = s.layout || 'text';
  var title = '<div class="pj-s-title" style="color:' + theme.fg + '">' + (esc(s.title || '') || '<span class="pj-ph">제목</span>') + '</div>';
  var inner;
  if (lay === 'title') inner = '<div class="pj-l-title"><div class="pj-s-bar" style="background:' + theme.accent + '"></div>' + title + (lines.length ? '<div class="pj-s-sub" style="color:' + theme.fg + '">' + esc(lines.join(' · ')) + '</div>' : '') + (img ? '<div class="pj-l-title-img">' + img + '</div>' : '') + '</div>';
  else if (lay === 'section') inner = '<div class="pj-l-section" style="border-color:' + theme.accent + '">' + title + '</div>';
  else if (lay === 'img') inner = '<div class="pj-l-img">' + title + (img || '<div class="pj-s-img empty">사진을 넣어주세요</div>') + '</div>';
  else if (lay === 'textimg') inner = '<div class="pj-l-textimg">' + title + '<div class="pj-l-cols"><div class="pj-s-body" style="color:' + theme.fg + '">' + body + '</div>' + (img || '<div class="pj-s-img empty">사진</div>') + '</div></div>';
  else inner = '<div class="pj-l-text">' + title + '<div class="pj-s-line" style="background:' + theme.accent + '"></div><div class="pj-s-body" style="color:' + theme.fg + '">' + body + '</div>' + (img ? '<div class="pj-l-text-img">' + img + '</div>' : '') + '</div>';
  return '<div class="pj-slide" style="background:' + theme.bg + ';--acc:' + theme.accent + '">' + inner + '</div>';
}
function pjImgTag(fid) {
  var f = CHAT_FILE_CACHE[fid];
  if (f && f.data) return '<img src="' + f.data + '" alt="" />';
  chatLoadFile(fid).then(function (ff) {
    if (!ff || !ff.data) return;
    document.querySelectorAll('.pj-s-img[data-fid="' + fid + '"]').forEach(function (box) { if (!box.querySelector('img')) box.innerHTML = '<img src="' + ff.data + '" alt="" />'; });
  });
  return '<span class="pj-img-loading">🖼</span>';
}

function pjRenderEditor(force) {
  if (!PJ.deckId) return;
  var deck = PJ.deck;
  var titleIn = document.getElementById('pj-deck-title');
  if (!deck) {
    document.getElementById('pj-canvas').innerHTML = '<div class="pj-empty">불러오는 중...</div>';
    return;
  }
  if (document.activeElement !== titleIn) titleIn.value = deck.title || '';
  /* 테마 */
  var th = PJ_THEMES.map(function (t, i) {
    return '<button class="pj-theme' + (i === (deck.theme || 0) ? ' on' : '') + '" title="' + t.name + '" style="background:' + t.bg + ';border-color:' + t.accent + '" onclick="pjSetTheme(' + i + ')"></button>';
  }).join('');
  var thEl = document.getElementById('pj-themes');
  if (thEl.getAttribute('data-h') !== th) { thEl.innerHTML = th; thEl.setAttribute('data-h', th); }
  /* 썸네일 */
  var order = deck.order || [];
  var thumbs = order.map(function (sid, i) {
    var lk = pjLockOf(sid);
    return '<div class="pj-thumb' + (sid === PJ.cur ? ' on' : '') + '" onclick="pjSelect(\'' + sid + '\')">' +
      '<span class="pj-thumb-n">' + (i + 1) + '</span>' +
      '<div class="pj-thumb-box">' + pjSlideHtml(PJ.slides[sid]) + '</div>' +
      (lk ? '<span class="pj-thumb-lock" style="background:' + chatAvatarColor(lk.pid) + '">✏️ ' + esc(lk.name) + '</span>' : '') +
    '</div>';
  }).join('') +
  '<div class="pj-thumb-tools">' +
    '<button class="btn btn-primary" onclick="pjAddSlide()">+ 슬라이드</button>' +
    '<div class="pj-thumb-row"><button class="btn btn-ghost" title="위로" onclick="pjMove(-1)">▲</button><button class="btn btn-ghost" title="아래로" onclick="pjMove(1)">▼</button><button class="btn btn-ghost" title="복제" onclick="pjDuplicate()">⧉</button><button class="btn btn-ghost" title="삭제" onclick="pjDeleteSlide()">🗑</button></div>' +
  '</div>';
  var tEl = document.getElementById('pj-thumbs');
  if (tEl.getAttribute('data-h') !== thumbs) { tEl.innerHTML = thumbs; tEl.setAttribute('data-h', thumbs); }
  /* 현재 슬라이드 */
  var s = PJ.slides[PJ.cur];
  var cv = pjSlideHtml(s);
  var cEl = document.getElementById('pj-canvas');
  if (cEl.getAttribute('data-h') !== cv) { cEl.innerHTML = cv; cEl.setAttribute('data-h', cv); }
  var lk = pjLockOf(PJ.cur);
  var lockEl = document.getElementById('pj-lock');
  lockEl.style.display = lk ? '' : 'none';
  if (lk) lockEl.innerHTML = '✏️ <b>' + esc(lk.name) + '</b>님이 이 슬라이드를 고치는 중이에요. 잠깐만 기다리거나 다른 슬라이드를 고쳐주세요.';
  var form = document.getElementById('pj-form');
  form.classList.toggle('locked', !!lk);
  ['pj-s-title', 'pj-s-body', 'pj-s-note'].forEach(function (fid) { document.getElementById(fid).disabled = !!lk || !s; });
  /* 입력칸: 내가 지금 그 칸을 고치는 중이 아니면 서버 내용으로 */
  if (s && (force || !PJ.dirty[PJ.cur])) {
    var map = { 'pj-s-title': 'title', 'pj-s-body': 'body', 'pj-s-note': 'note' };
    Object.keys(map).forEach(function (fid) {
      var el = document.getElementById(fid);
      if (document.activeElement !== el || force) { if (el.value !== (s[map[fid]] || '')) el.value = s[map[fid]] || ''; }
    });
  }
  var lays = PJ_LAYOUTS.map(function (L) {
    return '<button class="pj-lay' + (s && s.layout === L.id ? ' on' : '') + '" onclick="pjSetLayout(\'' + L.id + '\')">' + L.name + '</button>';
  }).join('');
  var lEl = document.getElementById('pj-layouts');
  if (lEl.getAttribute('data-h') !== lays) { lEl.innerHTML = lays; lEl.setAttribute('data-h', lays); }
  document.getElementById('pj-img-remove').style.display = s && s.img ? '' : 'none';
}

function pjSelect(sid) {
  if (sid === PJ.cur) return;
  pjFlushSave();
  pjReleaseLock();
  PJ.cur = sid;
  pjRenderEditor(true);
}

/* ---- 슬라이드 내용 저장 (입력 0.6초 뒤 자동 저장) ---- */
function pjEditCur(fn) {
  var sid = PJ.cur;
  var s = PJ.slides[sid];
  if (!s || pjLockOf(sid)) return false;
  fn(s);
  s.v = (s.v || 0) + 1;
  s.byName = me.name;
  PJ.dirty[sid] = true;
  pjTakeLock();
  pjRenderEditor(false);
  document.getElementById('pj-saved').textContent = '저장 중...';
  clearTimeout(PJ.saveT);
  PJ.saveT = setTimeout(pjFlushSave, 600);
  return true;
}
function pjFlushSave() {
  clearTimeout(PJ.saveT);
  var id = PJ.deckId;
  if (!id) return;
  Object.keys(PJ.dirty).forEach(function (sid) {
    var s = PJ.slides[sid];
    delete PJ.dirty[sid];
    if (!s) return;
    DBset(pjK('pj_s_' + id + '_' + sid), s).then(function () {
      var el = document.getElementById('pj-saved'); if (el) el.textContent = '✔ 저장됨';
    });
  });
  pjSaveLocal(function (x) { (x.slides = x.slides || {})[id] = PJ.slides; });
}

/* ---- '편집 중' 표시 ---- */
function pjTakeLock() {
  if (!PJ.deckId || !PJ.cur) return;
  var now = Date.now();
  if (PJ.myLock && PJ.myLock.sid === PJ.cur && now - PJ.myLock.ts < 2500) return;
  PJ.myLock = { sid: PJ.cur, ts: now };
  DBset(pjK('pj_l_' + PJ.deckId + '_' + PJ.cur), { pid: myPlayerId, name: me.name, ts: now });
}
function pjLockBeat() {
  /* 최근 10초 안에 고친 적 있을 때만 계속 잡고 있어요 */
  if (PJ.myLock && Date.now() - (PJ.lastEdit || 0) < 10000) {
    PJ.myLock.ts = 0;
    pjTakeLock();
  } else if (PJ.myLock) pjReleaseLock();
}
function pjReleaseLock() {
  if (PJ.myLock && PJ.deckId) DBset(pjK('pj_l_' + PJ.deckId + '_' + PJ.myLock.sid), null);
  PJ.myLock = null;
}

function pjSetLayout(lay) { pjEditCur(function (s) { s.layout = lay; }); PJ.lastEdit = Date.now(); }
function pjRemoveImage() { pjEditCur(function (s) { s.img = null; }); PJ.lastEdit = Date.now(); }

/* ---- 덱 정보(순서/테마/제목) 바꾸기: 최신 서버 값을 읽고 고쳐서 저장 ---- */
function pjUpdateDeck(fn) {
  var id = PJ.deckId;
  return DBget(pjK('pj_d_' + id)).then(function (srv) {
    var d = srv && (srv.v || 0) >= ((PJ.deck && PJ.deck.v) || 0) ? srv : PJ.deck;
    d = JSON.parse(JSON.stringify(d));
    fn(d);
    d.v = (d.v || 0) + 1;
    PJ.deck = d;
    pjSaveLocal(function (x) { (x.deck = x.deck || {})[id] = d; });
    pjRenderEditor(false);
    return DBset(pjK('pj_d_' + id), d);
  });
}
function pjSetTheme(i) { pjUpdateDeck(function (d) { d.theme = i; }); }
function pjAddSlide(copyFrom) {
  var sid = chatNewId();
  var s = copyFrom ? JSON.parse(JSON.stringify(copyFrom)) : { layout: 'text', title: '', body: '', note: '', img: null };
  s.id = sid; s.v = 1; s.byName = me.name;
  PJ.slides[sid] = s;
  var after = PJ.cur;
  DBset(pjK('pj_s_' + PJ.deckId + '_' + sid), s);
  pjFlushSave(); pjReleaseLock();
  PJ.cur = sid;
  pjUpdateDeck(function (d) {
    var i = d.order.indexOf(after);
    d.order.splice(i < 0 ? d.order.length : i + 1, 0, sid);
  }).then(function () { pjRenderEditor(true); var t = document.getElementById('pj-s-title'); if (t && !t.disabled) t.focus(); });
}
function pjDuplicate() { if (PJ.slides[PJ.cur]) pjAddSlide(PJ.slides[PJ.cur]); }
function pjDeleteSlide() {
  var sid = PJ.cur;
  if (!sid || !PJ.deck) return;
  if ((PJ.deck.order || []).length <= 1) { alert('슬라이드는 최소 1장은 있어야 해요.'); return; }
  if (pjLockOf(sid)) { alert('다른 친구가 고치는 중인 슬라이드는 지울 수 없어요.'); return; }
  chatConfirmBox('이 슬라이드를 지울까요?', '모두의 화면에서 사라져요.', '삭제', function () {
    var idx = PJ.deck.order.indexOf(sid);
    pjUpdateDeck(function (d) { d.order = d.order.filter(function (x) { return x !== sid; }); }).then(function () {
      DBset(pjK('pj_s_' + PJ.deckId + '_' + sid), null);
      delete PJ.slides[sid];
      PJ.cur = PJ.deck.order[Math.max(0, idx - 1)];
      pjRenderEditor(true);
    });
  });
}
function pjMove(dir) {
  var sid = PJ.cur;
  pjUpdateDeck(function (d) {
    var i = d.order.indexOf(sid), j = i + dir;
    if (i < 0 || j < 0 || j >= d.order.length) return;
    d.order[i] = d.order[j]; d.order[j] = sid;
  });
}

/* ---- 사진 ---- */
function pjUploadToFiles(file) {
  /* 사진/파일을 올려서 자료실에 추가하고, 올린 자료 정보를 돌려줘요 */
  return chatPrepareFile(file).then(function (prep) {
    var fid = chatNewId();
    return chatStoreFile(fid, { data: prep.data, name: prep.name, mime: prep.mime, size: prep.size }).then(function (ok) {
      if (!ok) throw new Error('upload');
      CHAT_FILE_CACHE[fid] = { data: prep.data, name: prep.name, mime: prep.mime, size: prep.size };
      var item = { id: chatNewId(), type: 'file', fileId: fid, fname: prep.name, fsize: prep.size, fmime: prep.mime, isImage: prep.isImage, byName: me.name, by: myPlayerId, ts: Date.now(), v: 1 };
      return DBget(pjK('pj_files')).then(function (srv) {
        var list = pjMergeList(srv, PJ.files);
        list.items.push(item);
        PJ.files = list;
        pjSaveLocal(function (x) { x.files = list; });
        pjRenderFiles();
        return DBset(pjK('pj_files'), list).then(function () { return item; });
      });
    });
  });
}
function pjFileErr(err, name) {
  var msg = err && err.message === 'too_big' ? '"' + name + '" 파일이 너무 커요. (사진은 자동으로 줄여주지만 다른 파일은 700KB까지)' : '"' + name + '" 올리기에 실패했어요.';
  var el = document.getElementById('pj-file-err'); if (el) el.textContent = msg;
  alert(msg);
}
function pjPickFromFiles() {
  var imgs = ((PJ.files && PJ.files.items) || []).filter(function (f) { return f.isImage; }).reverse();
  if (!imgs.length) { alert('자료실에 사진이 아직 없어요. 📁 자료실에서 먼저 올리거나 "사진 올리기"를 눌러주세요.'); return; }
  var box = chatModal('<div class="chat-modal-title">📁 자료실 사진 고르기</div><div class="pj-pick-grid">' +
    imgs.map(function (f) { return '<button class="pj-pick" data-fid="' + esc(f.fileId) + '" data-name="' + esc(f.fname) + '"><div class="pj-s-img" data-fid="' + esc(f.fileId) + '">' + pjImgTag(f.fileId) + '</div></button>'; }).join('') +
    '</div><div class="chat-modal-btns"><button class="btn btn-ghost" data-act="cancel">닫기</button></div>');
  box.querySelector('[data-act="cancel"]').onclick = function () { box.style.display = 'none'; };
  box.querySelectorAll('.pj-pick').forEach(function (b) {
    b.onclick = function () {
      box.style.display = 'none';
      var fid = b.getAttribute('data-fid'), nm = b.getAttribute('data-name');
      pjEditCur(function (s) { s.img = { fileId: fid, fname: nm }; if (s.layout === 'text' || s.layout === 'section') s.layout = 'textimg'; });
      PJ.lastEdit = Date.now();
    };
  });
}
function pjInsertImage(fid, name) {
  if (!PJ.deckId || !PJ.cur) { alert('먼저 🖼 발표 자료에서 슬라이드를 열어주세요.'); return; }
  pjTab('deck');
  pjEditCur(function (s) { s.img = { fileId: fid, fname: name }; if (s.layout === 'text' || s.layout === 'section') s.layout = 'textimg'; });
  PJ.lastEdit = Date.now();
}

/* ---------------- 📁 자료실 ---------------- */
function pjAddLink() {
  var u = document.getElementById('pj-link-url'), m = document.getElementById('pj-link-memo');
  var url = u.value.trim();
  if (!url) { u.focus(); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  var item = { id: chatNewId(), type: 'link', url: url.slice(0, 300), memo: m.value.trim().slice(0, 60), byName: me.name, by: myPlayerId, ts: Date.now(), v: 1 };
  u.value = ''; m.value = '';
  DBget(pjK('pj_files')).then(function (srv) {
    var list = pjMergeList(srv, PJ.files);
    list.items.push(item);
    PJ.files = list;
    pjSaveLocal(function (x) { x.files = list; });
    pjRenderFiles();
    DBset(pjK('pj_files'), list);
  });
}
function pjDeleteFile(id) {
  chatConfirmBox('이 자료를 자료실에서 지울까요?', '슬라이드에 이미 넣은 사진은 남아 있어요.', '삭제', function () {
    DBget(pjK('pj_files')).then(function (srv) {
      var list = pjMergeList(srv, PJ.files);
      list.del.push(id);
      list = pjMergeList(list, null);
      PJ.files = list;
      pjSaveLocal(function (x) { x.files = list; });
      pjRenderFiles();
      DBset(pjK('pj_files'), list);
    });
  });
}
function pjRenderFiles() {
  var items = ((PJ.files && PJ.files.items) || []).slice().reverse();
  var n = document.getElementById('pj-files-n'); if (n) n.textContent = items.length ? items.length : '';
  var el = document.getElementById('pj-file-grid');
  if (!el) return;
  if (!items.length) { el.innerHTML = '<div class="pj-empty">아직 자료가 없어요.<br>조사한 사진, 파일, 참고 링크를 모아보세요!</div>'; el.removeAttribute('data-h'); return; }
  var html = items.map(function (f) {
    var who = '<div class="pj-file-who">' + esc(f.byName || '') + ' · ' + chatFmtTime(f.ts) + '</div>';
    var del = '<button class="hw-icon-btn pj-file-del" title="삭제" onclick="pjDeleteFile(\'' + f.id + '\')">🗑️</button>';
    if (f.type === 'link') {
      return '<div class="pj-file link"><a href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer" class="pj-link-a">🔗 ' + esc(f.memo || f.url) + '</a>' +
        (f.memo ? '<div class="pj-link-url">' + esc(f.url) + '</div>' : '') + who + del + '</div>';
    }
    if (f.isImage) {
      return '<div class="pj-file img"><div class="pj-s-img" data-fid="' + esc(f.fileId) + '" onclick="pjViewImage(\'' + esc(f.fileId) + '\')">' + pjImgTag(f.fileId) + '</div>' +
        '<button class="btn btn-ghost pj-to-slide" onclick="pjInsertImage(\'' + esc(f.fileId) + '\',\'' + esc(f.fname).replace(/'/g, '&#39;') + '\')">슬라이드에 넣기</button>' + who + del + '</div>';
    }
    return '<div class="pj-file doc"><button class="pj-doc-btn" onclick="chatDownload(\'' + esc(f.fileId) + '\')"><span class="cmsg-file-icon">' + chatFileIcon(f.fname, f.fmime) + '</span><span class="pj-doc-name">' + esc(f.fname) + '<small>' + chatFmtSize(f.fsize || 0) + ' · 눌러서 저장</small></span></button>' + who + del + '</div>';
  }).join('');
  if (el.getAttribute('data-h') !== html) { el.innerHTML = html; el.setAttribute('data-h', html); }
}
function pjViewImage(fid) { chatLoadFile(fid).then(function (f) { if (f && f.data) chatOpenLightbox(f.data, f.name); }); }
function pjUploadFiles(fileList) {
  var files = Array.prototype.slice.call(fileList || [], 0, 8);
  var err = document.getElementById('pj-file-err'); if (err) err.textContent = '';
  var chain = Promise.resolve();
  files.forEach(function (f) {
    chain = chain.then(function () {
      if (err) err.textContent = '⏳ "' + f.name + '" 올리는 중...';
      return pjUploadToFiles(f).then(function () { if (err) err.textContent = ''; }).catch(function (e) { pjFileErr(e, f.name); });
    });
  });
}

/* ---------------- 💬 채팅 ---------------- */
function pjChatKey() { return pjK('pj_chat'); }
function pjPollChat() {
  DBget(pjChatKey()).then(function (st) {
    var msgs = (st && st.messages) || [];
    PJ.chatCount = msgs.length ? msgs[msgs.length - 1].ts : 0;
    var l = pjLocal();
    if (!msgs.length && l.chat && l.chat.length) { msgs = l.chat; DBset(pjChatKey(), { messages: msgs }); }
    else if (msgs.length) pjSaveLocal(function (x) { x.chat = msgs.slice(-60); });
    chatRenderInto(document.getElementById('pj-chat-messages'), msgs, PJ.chatTracker, '친구들과 이야기하면서 같이 만들어요! 👋');
    var who = document.getElementById('pj-chat-who');
    if (who) who.textContent = (roomPlayersList || []).length + '명';
    if (PJ.tab === 'chat' || window.innerWidth >= 900) PJ.chatSeen = PJ.chatCount;
    pjBadge(msgs);
  });
}
function pjBadge(msgs) {
  var b = document.getElementById('pj-chat-badge');
  if (!b) return;
  var unseen = (PJ.chatCount || 0) > (PJ.chatSeen || 0);
  b.textContent = unseen ? '●' : '';
}
function pjSendChat() {
  var input = document.getElementById('pj-chat-input');
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  chatAutoGrow(input);
  chatSendText(pjChatKey(), text).then(pjPollChat);
}
function pjSendChatFiles(files) {
  chatSendFiles(pjChatKey(), files, PJ.chatTracker, pjPollChat, function (msg) { var e = document.getElementById('pj-upload-err'); if (e) e.textContent = msg; });
}

/* ---------------- ▶ 발표하기 ---------------- */
function pjPresent(startIdx) {
  if (!PJ.deck) return;
  var order = PJ.deck.order || [];
  var i = typeof startIdx === 'number' ? startIdx : Math.max(0, order.indexOf(PJ.cur));
  var box = document.getElementById('pj-present');
  if (!box) {
    box = document.createElement('div');
    box.id = 'pj-present';
    box.className = 'pj-present';
    box.innerHTML = '<div class="pj-present-slide" id="pj-present-slide"></div>' +
      '<div class="pj-present-bar"><button class="btn btn-ghost" data-a="prev">◀</button><span id="pj-present-n"></span><button class="btn btn-ghost" data-a="next">▶</button>' +
      '<span class="pj-present-note" id="pj-present-note"></span><button class="btn btn-ghost" data-a="close">✕ 끝내기</button></div>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'prev') pjPresentGo(-1);
      else if (a === 'next') pjPresentGo(1);
      else if (a === 'close') pjPresentClose();
      else if (e.target.closest && e.target.closest('#pj-present-slide')) pjPresentGo(1);
    });
    document.addEventListener('keydown', function (e) {
      if (!box || box.style.display === 'none') return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); pjPresentGo(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); pjPresentGo(-1); }
      else if (e.key === 'Escape') pjPresentClose();
    });
  }
  PJ.presentIdx = i;
  box.style.display = 'flex';
  try { if (box.requestFullscreen) box.requestFullscreen(); } catch (e) {}
  pjPresentDraw();
}
function pjPresentGo(d) {
  var order = (PJ.deck && PJ.deck.order) || [];
  var n = PJ.presentIdx + d;
  if (n < 0 || n >= order.length) return;
  PJ.presentIdx = n;
  pjPresentDraw();
}
function pjPresentDraw() {
  var order = (PJ.deck && PJ.deck.order) || [];
  var s = PJ.slides[order[PJ.presentIdx]];
  document.getElementById('pj-present-slide').innerHTML = pjSlideHtml(s);
  document.getElementById('pj-present-n').textContent = (PJ.presentIdx + 1) + ' / ' + order.length;
  document.getElementById('pj-present-note').textContent = s && s.note ? '📝 ' + s.note : '';
}
function pjPresentClose() {
  var box = document.getElementById('pj-present');
  if (box) box.style.display = 'none';
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
}

/* ---------------- ⬇ PPT 파일로 내려받기 (pptx-writer.js, 인터넷 없이도 돼요) ---------------- */
function pjImgSize(dataUrl) {
  return new Promise(function (res) {
    var im = new Image();
    im.onload = function () { res({ w: im.naturalWidth, h: im.naturalHeight }); };
    im.onerror = function () { res({ w: 4, h: 3 }); };
    im.src = dataUrl;
  });
}
function pjExportPptx() {
  if (!PJ.deck) return;
  pjFlushSave();
  var msg = document.getElementById('pj-saved');
  if (msg) msg.textContent = '⏳ PPT 만드는 중...';
  var order = PJ.deck.order || [];
  var theme = pjTheme();
  var hex = function (c) { return c.replace('#', '').toUpperCase(); };
  Promise.all(order.map(function (sid) {
    var s = PJ.slides[sid];
    if (!(s && s.img && s.img.fileId)) return null;
    return chatLoadFile(s.img.fileId).then(function (f) {
      if (!f || !f.data) return null;
      return pjImgSize(f.data).then(function (sz) { return { data: f.data, w: sz.w, h: sz.h }; });
    });
  })).then(function (imgs) {
    var deck = PPTW.create({ title: PJ.deck.title || '발표 자료', bg: hex(theme.bg) });
    var W = deck.W, H = deck.H, fg = hex(theme.fg), acc = hex(theme.accent);
    order.forEach(function (sid, i) {
      var s = PJ.slides[sid] || {};
      var sl = deck.slide({ bg: hex(theme.bg), notes: s.note || '' });
      var lay = s.layout || 'text';
      var lines = String(s.body || '').split('\n').filter(function (q) { return q.trim(); }).map(function (q) { return q.replace(/^[-•·*]\s*/, ''); });
      var img = imgs[i];
      var addImg = function (x, y, w, h) { if (img) sl.image(img.data, { x: x, y: y, w: w, h: h, iw: img.w, ih: img.h }); };
      if (lay === 'title') {
        sl.rect({ x: W / 2 - 0.8, y: img ? 1.4 : 2.3, w: 1.6, h: 0.1, color: acc, round: true });
        sl.text(s.title || '', { x: 0.8, y: img ? 1.6 : 2.5, w: W - 1.6, h: 1.4, size: 44, bold: true, color: fg, align: 'center', valign: 'middle' });
        if (lines.length) sl.text(lines.join(' · '), { x: 0.8, y: img ? 3.0 : 3.9, w: W - 1.6, h: 0.8, size: 22, color: fg, align: 'center' });
        addImg(W / 2 - 2, 3.9, 4, 3.0);
      } else if (lay === 'section') {
        sl.rect({ x: 0.8, y: 2.9, w: 0.16, h: 1.7, color: acc });
        sl.text(s.title || '', { x: 1.25, y: 2.9, w: W - 2.1, h: 1.7, size: 40, bold: true, color: fg, valign: 'middle' });
      } else {
        sl.text(s.title || '', { x: 0.7, y: 0.45, w: W - 1.4, h: 0.95, size: 32, bold: true, color: fg });
        sl.rect({ x: 0.8, y: 1.45, w: 1.3, h: 0.08, color: acc, round: true });
        if (lay === 'img') addImg(0.8, 1.8, W - 1.6, H - 2.3);
        else if (lay === 'textimg') {
          if (lines.length) sl.text(lines, { x: 0.7, y: 1.8, w: W * 0.47 - 0.7, h: H - 2.3, size: 22, color: fg, bullets: true, bulletColor: acc });
          addImg(W * 0.5, 1.8, W * 0.46, H - 2.3);
        } else {
          if (lines.length) sl.text(lines, { x: 0.7, y: 1.8, w: img ? W * 0.6 : W - 1.4, h: H - 2.3, size: 22, color: fg, bullets: true, bulletColor: acc });
          addImg(W * 0.65, 2.6, W * 0.3, H - 3.3);
        }
      }
    });
    deck.save((PJ.deck.title || '발표자료').replace(/[\\/:*?"<>|]/g, '') + '.pptx');
    if (msg) msg.textContent = '✔ PPT 파일을 내려받았어요';
  }).catch(function (e) {
    if (msg) msg.textContent = '';
    alert('PPT 파일을 만들지 못했어요. (' + (e && e.message || e) + ')');
  });
}

/* ---------------- 입력 연결 ---------------- */
(function pjSetup() {
  var map = { 'pj-s-title': 'title', 'pj-s-body': 'body', 'pj-s-note': 'note' };
  Object.keys(map).forEach(function (fid) {
    var el = document.getElementById(fid);
    if (!el) return;
    el.addEventListener('input', function () {
      var v = el.value;
      PJ.lastEdit = Date.now();
      pjEditCur(function (s) { s[map[fid]] = v; });
    });
    el.addEventListener('focus', function () { PJ.lastEdit = Date.now(); pjTakeLock(); });
  });
  var dt = document.getElementById('pj-deck-title');
  if (dt) dt.addEventListener('change', function () {
    var t = dt.value.trim() || '발표 자료';
    var id = PJ.deckId;
    pjUpdateDeck(function (d) { d.title = t; });
    DBget(pjK('pj_decks')).then(function (srv) {
      var list = pjMergeList(srv, PJ.decks);
      list.items.forEach(function (it) { if (it.id === id) { it.title = t; it.v = (it.v || 0) + 1; } });
      PJ.decks = list; DBset(pjK('pj_decks'), list);
    });
  });
  var imgIn = document.getElementById('pj-img-input');
  if (imgIn) imgIn.addEventListener('change', function () {
    var f = imgIn.files && imgIn.files[0];
    imgIn.value = '';
    if (!f) return;
    if (pjLockOf(PJ.cur)) return;
    document.getElementById('pj-saved').textContent = '⏳ 사진 올리는 중...';
    pjUploadToFiles(f).then(function (item) {
      pjEditCur(function (s) { s.img = { fileId: item.fileId, fname: item.fname }; if (s.layout === 'text' || s.layout === 'section') s.layout = 'textimg'; });
      PJ.lastEdit = Date.now();
    }).catch(function (e) { document.getElementById('pj-saved').textContent = ''; pjFileErr(e, f.name); });
  });
  var up = document.getElementById('pj-file-up');
  if (up) up.addEventListener('change', function () { var fl = up.files; pjUploadFiles(fl); up.value = ''; });
  var grid = document.getElementById('pj-pane-files');
  if (grid) {
    grid.addEventListener('dragover', function (e) { e.preventDefault(); });
    grid.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files) pjUploadFiles(e.dataTransfer.files); });
  }
  var cm = document.getElementById('pj-chat-messages');
  if (cm) {
    chatBindMessageArea(cm, pjSendChatFiles, function () { return pjChatKey(); }, pjPollChat);
    chatBindComposer({ inputId: 'pj-chat-input', attachBtnId: 'pj-attach-btn', fileInputId: 'pj-file-input', onFiles: pjSendChatFiles });
    chatSetupMultiline(document.getElementById('pj-chat-input'), pjSendChat);
  }
  var nd = document.getElementById('pj-new-deck');
  if (nd) nd.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); pjCreateDeck(); } });
  window.addEventListener('pagehide', function () { pjFlushSave(); pjReleaseLock(); });
})();
