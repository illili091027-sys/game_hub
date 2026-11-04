/* ===================== 📺 화면 공유 (WebRTC) =====================
   과제하기 방, 채널 라운지 대화방에서 쓸 수 있어요.
   - 공유: PC 크롬/엣지/웨일 (휴대폰 브라우저는 화면 공유 기능이 없어서 '보기'만 가능)
   - 연결: 게임판 서버로는 "연결 신호(SDP)"만 주고받고, 화면 영상은 친구 기기끼리 직접 보내요.
   - 한 공간에서 한 번에 한 명만 공유. 보는 사람은 4~5명 정도까지가 무난해요.
   - 학교 와이파이가 기기끼리 직접 연결하는 걸 막아두면 연결이 안 될 수 있어요(중계 서버 없음).

   서버 키 (scope = 'hw' 또는 'ch_<채널id>'):
   ss_<scope>_info        : { sid, by, name, ts }      지금 누가 공유 중인지 (공유자가 2초마다 갱신)
   ss_<scope>_r_<보는사람> : { sid, n, name, ts }       "보여주세요" 요청 (n = 재연결 번호)
   ss_<scope>_o_<보는사람> : { sid, n, sdp }            공유자가 보낸 연결 제안(offer)
   ss_<scope>_a_<보는사람> : { sid, n, sdp }            보는 사람이 보낸 답(answer) */

var SS_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
var SS = { scope: null, bar: null, timer: null, info: null, share: null, view: null };

function ssKey(s) { return roomKey('ss_' + SS.scope + '_' + s); }
function ssCanShare() { return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent); }

/* ss_<scope>_<kind>_ 로 시작하는 키 전부 읽기 → { 보는사람id: data } */
function ssFetchPrefix(kind) {
  var prefix = 'ss_' + SS.scope + '_' + kind + '_';
  if (cloudServerUrl && BATCH_SUPPORTED !== false) {
    return fetch(cloudServerUrl + '/api/states?room=' + encodeURIComponent(me.room) + '&prefix=' + encodeURIComponent(prefix), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('nobatch'); return r.json(); })
      .then(function (j) {
        var out = {}, data = (j && j.data) || {};
        Object.keys(data).forEach(function (k) { var d = data[k]; if (d && !d.__cleared) out[k.slice(prefix.length)] = d; });
        return out;
      })
      .catch(function () { return DBgetPrefix(prefix); });
  }
  return DBgetPrefix(prefix);
}

/* ICE 후보를 다 모을 때까지(최대 2.5초) 기다렸다가 SDP를 한 번에 보내요 (주고받기 단순하게) */
function ssWaitIce(pc) {
  return new Promise(function (resolve) {
    if (pc.iceGatheringState === 'complete') return resolve();
    var done = false;
    var fin = function () { if (done) return; done = true; resolve(); };
    pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') fin(); });
    setTimeout(fin, 2500);
  });
}

/* ---------- 붙이기 / 떼기 ---------- */
function ssMount(scope, barId) {
  ssUnmount();
  SS.scope = scope;
  SS.bar = document.getElementById(barId);
  if (SS.bar) SS.bar.removeAttribute('data-html');
  SS.info = null;
  ssRenderBar();
  ssTick();
  SS.timer = setInterval(ssTick, 1000);
}
function ssUnmount() {
  clearInterval(SS.timer); SS.timer = null;
  if (SS.share) ssStopShare();
  if (SS.view) ssStopView();
  if (SS.bar) { SS.bar.innerHTML = ''; SS.bar.removeAttribute('data-html'); }
  SS.scope = null; SS.bar = null; SS.info = null;
}

var SS_TICK_BUSY = false, SS_TICK_N = 0;
function ssTick() {
  if (!SS.scope || SS_TICK_BUSY) return;
  SS_TICK_BUSY = true;
  SS_TICK_N++;
  var scope = SS.scope;
  var jobs = [];
  /* 공유 중이 아니면 2초에 한 번만 '누가 공유 중인지' 확인 */
  if (SS.share || SS.view || SS_TICK_N % 2 === 0) jobs.push(DBget(ssKey('info')).then(function (info) {
    if (SS.scope !== scope) return;
    var fresh = info && info.sid && Date.now() - info.ts < 9000;
    SS.info = fresh ? info : null;
    if (SS.view && (!SS.info || SS.info.sid !== SS.view.sid)) { ssStopView('공유가 끝났어요.'); }
  }));
  if (SS.share) jobs.push(ssShareTick());
  if (SS.view) jobs.push(ssViewTick());
  Promise.all(jobs).then(function () { SS_TICK_BUSY = false; ssRenderBar(); }, function () { SS_TICK_BUSY = false; });
}

function ssRenderBar() {
  var bar = SS.bar;
  if (!bar) return;
  var info = SS.info;
  var html;
  if (SS.share) {
    var n = Object.keys(SS.share.peers).filter(function (k) { var pc = SS.share.peers[k].pc; return pc && pc.connectionState === 'connected'; }).length;
    html = '<span class="ss-live">● LIVE</span><span class="ss-text">내 화면을 공유하는 중 · 보는 사람 <b>' + n + '</b>명</span>' +
      '<button class="btn ss-stop" onclick="ssStopShare()">공유 끄기</button>';
  } else if (info && info.by !== myPlayerId) {
    html = '<span class="ss-live">● LIVE</span><span class="ss-text"><b>' + esc(info.name || '친구') + '</b>님이 화면을 공유하는 중</span>' +
      '<button class="btn btn-primary" onclick="ssStartView()">📺 보기</button>';
  } else {
    var can = ssCanShare();
    html = '<span class="ss-text">📺 화면 공유</span>' +
      (can ? '<button class="btn btn-ghost" onclick="ssStartShare()">내 화면 공유하기</button>'
           : '<span class="ss-note">휴대폰은 공유는 못 하고 보기만 할 수 있어요 (PC 크롬·엣지에서 공유 가능)</span>');
  }
  if (bar.getAttribute('data-html') !== html) { bar.innerHTML = html; bar.setAttribute('data-html', html); }
}

/* ---------- 공유하는 쪽 ---------- */
function ssStartShare() {
  if (!SS.scope) return;
  if (SS.info && SS.info.by !== myPlayerId) { alert(SS.info.name + '님이 이미 공유 중이에요. 한 번에 한 명만 공유할 수 있어요.'); return; }
  if (!ssCanShare()) { alert('이 기기에서는 화면 공유를 할 수 없어요. PC의 크롬이나 엣지에서 해주세요.'); return; }
  navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 24 } }, audio: true }).then(function (stream) {
    var sid = chatNewId();
    SS.share = { sid: sid, stream: stream, peers: {} };
    stream.getVideoTracks().forEach(function (t) {
      try { t.contentHint = 'detail'; } catch (e) {}
      t.addEventListener('ended', function () { ssStopShare(); }); /* 브라우저의 '공유 중지' 버튼을 눌러도 끝나게 */
    });
    SS.info = { sid: sid, by: myPlayerId, name: me.name, ts: Date.now() };
    DBset(ssKey('info'), SS.info);
    ssRenderBar();
  }).catch(function (e) {
    if (e && e.name === 'NotAllowedError') return; /* 사용자가 취소 */
    alert('화면 공유를 시작하지 못했어요. (' + (e && e.message || e) + ')');
  });
}

function ssStopShare() {
  var sh = SS.share;
  if (!sh) return;
  SS.share = null;
  try { sh.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
  Object.keys(sh.peers).forEach(function (k) { try { sh.peers[k].pc.close(); } catch (e) {} });
  if (SS.scope) DBset(ssKey('info'), null);
  SS.info = null;
  ssRenderBar();
}

function ssShareTick() {
  var sh = SS.share;
  if (!sh) return Promise.resolve();
  /* 살아있다고 알리기 */
  if (Date.now() - (sh.lastInfo || 0) > 2000) {
    sh.lastInfo = Date.now();
    DBset(ssKey('info'), { sid: sh.sid, by: myPlayerId, name: me.name, ts: Date.now() });
  }
  return Promise.all([ssFetchPrefix('r'), ssFetchPrefix('a')]).then(function (res) {
    if (SS.share !== sh) return;
    var reqs = res[0], answers = res[1];
    /* 새 요청 → 연결 제안 만들기 */
    Object.keys(reqs).forEach(function (vid) {
      var rq = reqs[vid];
      if (!rq || rq.sid !== sh.sid || vid === myPlayerId) return;
      var cur = sh.peers[vid];
      if (cur && cur.n === rq.n) return;
      if (cur) { try { cur.pc.close(); } catch (e) {} }
      ssMakeOffer(sh, vid, rq.n);
    });
    /* 답 받기 */
    Object.keys(answers).forEach(function (vid) {
      var an = answers[vid], peer = sh.peers[vid];
      if (!an || !peer || an.sid !== sh.sid || an.n !== peer.n || peer.answered) return;
      peer.answered = true;
      peer.pc.setRemoteDescription({ type: 'answer', sdp: an.sdp }).catch(function () {});
    });
    /* 끊긴 연결 정리 */
    Object.keys(sh.peers).forEach(function (vid) {
      var st = sh.peers[vid].pc.connectionState;
      if (st === 'closed' || st === 'failed') { try { sh.peers[vid].pc.close(); } catch (e) {} delete sh.peers[vid]; }
    });
  });
}

function ssMakeOffer(sh, vid, n) {
  var pc = new RTCPeerConnection({ iceServers: SS_ICE });
  sh.peers[vid] = { pc: pc, n: n, answered: false };
  sh.stream.getTracks().forEach(function (t) { pc.addTrack(t, sh.stream); });
  pc.addEventListener('connectionstatechange', ssRenderBar);
  pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () {
    return ssWaitIce(pc);
  }).then(function () {
    if (SS.share !== sh || !sh.peers[vid] || sh.peers[vid].pc !== pc) return;
    DBset(ssKey('o_' + vid), { sid: sh.sid, n: n, sdp: pc.localDescription.sdp });
  }).catch(function () {});
}

/* ---------- 보는 쪽 ---------- */
function ssStartView() {
  var info = SS.info;
  if (!info || !SS.scope) return;
  if (SS.view) ssStopView();
  var n = Date.now();
  SS.view = { sid: info.sid, n: n, pc: null, started: Date.now(), name: info.name };
  ssOpenViewer(info.name);
  DBset(ssKey('r_' + myPlayerId), { sid: info.sid, n: n, name: me.name, ts: Date.now() });
}

function ssViewTick() {
  var v = SS.view;
  if (!v) return Promise.resolve();
  if (v.pc) {
    var st = v.pc.connectionState;
    if (st === 'connected') { ssViewerMsg(''); v.okOnce = true; }
    else if (st === 'failed' || (st !== 'connected' && Date.now() - v.started > 20000 && !v.okOnce)) {
      ssViewerMsg('연결이 안 돼요 😢 학교 와이파이가 기기끼리 직접 연결하는 걸 막고 있을 수 있어요.', true);
    }
    return Promise.resolve();
  }
  return DBget(ssKey('o_' + myPlayerId)).then(function (of) {
    if (SS.view !== v || v.pc || !of || of.sid !== v.sid || of.n !== v.n) return;
    var pc = new RTCPeerConnection({ iceServers: SS_ICE });
    v.pc = pc;
    pc.addEventListener('track', function (e) {
      var vid = document.getElementById('ss-video');
      if (vid && e.streams && e.streams[0]) { vid.srcObject = e.streams[0]; vid.play().catch(function () {}); }
    });
    pc.addEventListener('connectionstatechange', function () { if (SS.view === v) ssViewTick(); });
    return pc.setRemoteDescription({ type: 'offer', sdp: of.sdp }).then(function () { return pc.createAnswer(); })
      .then(function (a) { return pc.setLocalDescription(a); })
      .then(function () { return ssWaitIce(pc); })
      .then(function () {
        if (SS.view !== v) return;
        DBset(ssKey('a_' + myPlayerId), { sid: v.sid, n: v.n, sdp: pc.localDescription.sdp });
        ssViewerMsg('연결하는 중...');
      });
  }).catch(function () {});
}

function ssStopView(msg) {
  var v = SS.view;
  SS.view = null;
  if (v && v.pc) { try { v.pc.close(); } catch (e) {} }
  if (v && SS.scope) DBset(ssKey('r_' + myPlayerId), null);
  var box = document.getElementById('ss-viewer');
  if (box) {
    var vid = document.getElementById('ss-video');
    if (vid) vid.srcObject = null;
    if (msg) { ssViewerMsg(msg, true); setTimeout(function () { if (!SS.view) box.style.display = 'none'; }, 1800); }
    else box.style.display = 'none';
  }
  ssRenderBar();
}

function ssOpenViewer(name) {
  var box = document.getElementById('ss-viewer');
  if (!box) {
    box = document.createElement('div');
    box.id = 'ss-viewer';
    box.className = 'ss-viewer';
    box.innerHTML =
      '<div class="ss-viewer-bar"><span class="ss-live">● LIVE</span><span class="ss-viewer-name" id="ss-viewer-name"></span>' +
      '<span class="hw-spacer"></span>' +
      '<button class="btn btn-ghost" id="ss-full-btn">⛶ 크게</button>' +
      '<button class="btn btn-ghost" id="ss-close-btn">닫기 ✕</button></div>' +
      '<div class="ss-video-wrap"><video id="ss-video" autoplay playsinline muted></video><div class="ss-viewer-msg" id="ss-viewer-msg"></div>' +
      '<button class="ss-unmute" id="ss-unmute">🔇 소리 켜기</button></div>';
    document.body.appendChild(box);
    box.querySelector('#ss-close-btn').onclick = function () { ssStopView(); };
    box.querySelector('#ss-full-btn').onclick = function () {
      var el = box.querySelector('.ss-video-wrap');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen();
      else { var vv = document.getElementById('ss-video'); if (vv.webkitEnterFullscreen) vv.webkitEnterFullscreen(); }
    };
    box.querySelector('#ss-unmute').onclick = function () {
      var vv = document.getElementById('ss-video');
      vv.muted = !vv.muted;
      this.textContent = vv.muted ? '🔇 소리 켜기' : '🔊 소리 끄기';
    };
  }
  document.getElementById('ss-viewer-name').textContent = (name || '친구') + '님의 화면';
  var vv = document.getElementById('ss-video'); vv.muted = true; document.getElementById('ss-unmute').textContent = '🔇 소리 켜기';
  ssViewerMsg('화면 받아오는 중...');
  box.style.display = 'flex';
}

function ssViewerMsg(text, isErr) {
  var m = document.getElementById('ss-viewer-msg');
  if (!m) return;
  m.textContent = text || '';
  m.style.display = text ? '' : 'none';
  m.className = 'ss-viewer-msg' + (isErr ? ' err' : '');
}

window.addEventListener('pagehide', function () { if (SS.share) ssStopShare(); });
