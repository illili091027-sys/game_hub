/* ---------------- 엉뚱 그림 릴레이 (온라인, 3~10명) ----------------
   1단계: 각자 엉뚱한 문장을 써요 → 2단계: 앞사람 문장을 보고 그림으로 그려요 →
   3단계: 앞사람 그림만 보고 무슨 문장인지 적어요 → (그리기/적기 반복) → 마지막에 처음 문장이
   어떻게 변했는지 한 줄씩 공개!
   - 진행 상태: roomKey('relay') (방장만 씀) / 각자 제출물: roomKey('rl_'+내id) (나만 씀)
     → 여러 명이 동시에 제출해도 서로 덮어쓰지 않아요.
   - 체인(이야기 줄) 개수 = 인원수. k단계에서 나는 (앞사람이 k-1단계에 만든 것)을 받아요. */
var RL_MIN = 3, RL_MAX = 10, RL_MAX_STEPS = 8;
var RL_SECONDS = { write: 45, draw: 120, guess: 45 };
var RL_REVEAL_MS = 2600;   /* 결과 공개 때 한 장씩 자동으로 넘어가는 간격 */
var RL_REVEAL_TICK = null;
var RL_POLL = null;
var RL_STATE = null;
var RL_MY = { gameId: null, entries: {} };
var RL_EDIT_STEP = -1;     // 지금 화면에 띄운 단계
var RL_SUBMITTED = {};     // 단계별 제출 여부
var RL_PREV_CACHE = {};    // 받은 앞사람 내용 캐시
var RL_ALL = null;         // 공개 단계: 모든 사람 제출물
var RL_DRAW = null;        // 그림판 상태
var RL_AWAY_SINCE = {};    // 연결이 끊긴 사람: 언제부터 끊겼는지
var RL_EXAMPLES = ['안경을 쓰고 선글라스를 낀 문어가 라면을 먹고 있다', '교장선생님이 구름 위에서 줄넘기를 한다', '고양이가 우주선을 타고 편의점에 간다', '수박이 축구공을 차서 골을 넣었다', '펭귄이 사막에서 아이스크림을 팔고 있다', '공룡이 버스 정류장에서 줄을 서 있다'];

function rlKey() { return roomKey('relay'); }
function rlMyKey() { return roomKey('rl_' + myPlayerId); }
function rlStepType(step) { return step === 0 ? 'write' : (step % 2 === 1 ? 'draw' : 'guess'); }

function stopRelayGame() { clearInterval(RL_POLL); RL_POLL = null; clearInterval(RL_REVEAL_TICK); RL_REVEAL_TICK = null; }

function startRelayGame() {
  stopRelayGame();
  RL_STATE = null; RL_ALL = null; RL_EDIT_STEP = -1; RL_SUBMITTED = {}; RL_PREV_CACHE = {};
  RL_MY = { gameId: null, entries: {} };
  document.querySelectorAll('#relay .rl-phase').forEach(function (el) { el.style.display = 'none'; });
  rlSetupCanvas();
  var n = (roomPlayersList || []).length;
  if (n < RL_MIN || n > RL_MAX) {
    document.getElementById('rl-error').style.display = '';
    document.getElementById('rl-error').textContent = '엉뚱 그림 릴레이는 ' + RL_MIN + '~' + RL_MAX + '명이 필요해요. 지금 ' + n + '명이에요.';
    return;
  }
  var starter = myPlayerId === roomHostId ? rlHostInit() : Promise.resolve();
  starter.then(function () { rlPoll(); RL_POLL = setInterval(rlPoll, 1200); });
}

function rlHostInit() {
  var order = shuffleArray((roomPlayersList || []).map(function (p) { return p.id; }));
  var names = {};
  (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; });
  var total = Math.min(order.length, RL_MAX_STEPS);
  if (total % 2 === 0 && total > 3) total--; // 마지막 단계가 "문장"으로 끝나게(홀수 개 단계)
  var st = { gameId: Date.now(), order: order, names: names, step: 0, total: total, phase: 'play', deadline: Date.now() + RL_SECONDS.write * 1000 };
  return DBset(rlKey(), st);
}

function rlHostRestart() {
  if (myPlayerId !== roomHostId) return;
  rlHostInit().then(rlPoll);
}

function rlPoll() {
  DBget(rlKey()).then(function (st) {
    if (!st || !st.order) return;
    if (!RL_STATE || RL_STATE.gameId !== st.gameId) {
      RL_MY = { gameId: st.gameId, entries: {} };
      RL_SUBMITTED = {}; RL_PREV_CACHE = {}; RL_ALL = null; RL_EDIT_STEP = -1;
    }
    RL_STATE = st;
    rlRender(st);
    if (myPlayerId === roomHostId) rlHostCheck(st);
  });
}

/* 방장: 모두 제출했거나 시간이 지나면 다음 단계로 */
function rlHostCheck(st) {
  if (st.phase !== 'play') return;
  DBgetPrefix('rl_', st.order).then(function (all) {
    /* 중간에 나간 사람은 그 사람 차례가 와도 기다리지 않고 바로 '완료'로 쳐요 */
    /* (방에서 나갔거나, 20초 넘게 연결이 끊긴 사람) */
    var here = {}, now = Date.now();
    (roomPlayersList || []).forEach(function (p) {
      if (p.away) { RL_AWAY_SINCE[p.id] = RL_AWAY_SINCE[p.id] || now; if (now - RL_AWAY_SINCE[p.id] > 20000) return; }
      else delete RL_AWAY_SINCE[p.id];
      here[p.id] = 1;
    });
    var done = st.order.filter(function (pid) {
      if (!here[pid]) return true;
      var d = all[pid]; return d && d.gameId === st.gameId && d.entries && d.entries[st.step];
    }).length;
    var el = document.getElementById('rl-progress');
    if (el) el.textContent = '제출 ' + done + '/' + st.order.length;
    var late = Date.now() > st.deadline + 3000;
    if (done < st.order.length && !late) return;
    DBget(rlKey()).then(function (cur) {
      if (!cur || cur.gameId !== st.gameId || cur.step !== st.step || cur.phase !== 'play') return;
      if (cur.step + 1 >= cur.total) { cur.phase = 'reveal'; cur.revealChain = 0; cur.revealStart = null; cur.deadline = null; }
      else { cur.step++; cur.deadline = Date.now() + RL_SECONDS[rlStepType(cur.step)] * 1000; }
      DBset(rlKey(), cur).then(rlPoll);
    });
  });
}

function rlMyIndex(st) { return st.order.indexOf(myPlayerId); }
function rlPrevPid(st) { var i = rlMyIndex(st); return st.order[(i - 1 + st.order.length) % st.order.length]; }

function rlSubmit(value, auto) {
  var st = RL_STATE;
  if (!st || st.phase !== 'play') return;
  var type = rlStepType(st.step);
  if (!auto && type !== 'draw' && !String(value || '').trim()) { document.getElementById('rl-err').textContent = '내용을 적어주세요!'; return; }
  document.getElementById('rl-err').textContent = '';
  RL_MY.gameId = st.gameId;
  RL_MY.entries[st.step] = { t: type === 'draw' ? 'img' : 'text', v: type === 'draw' ? value : (String(value || '').trim().slice(0, 80) || '(시간 초과로 비어 있음)') };
  RL_SUBMITTED[st.step] = true;
  DBset(rlMyKey(), { gameId: st.gameId, entries: RL_MY.entries });
  rlRender(st);
}

function rlSubmitText() { rlSubmit(document.getElementById('rl-text-input').value); }
function rlSubmitDrawing() { rlSubmit(rlCanvasData()); }
function rlEditAgain() {
  if (!RL_STATE) return;
  RL_SUBMITTED[RL_STATE.step] = false;
  rlRender(RL_STATE);
}

/* ---- 화면 ---- */
function rlRender(st) {
  if (!document.getElementById('relay').classList.contains('active')) return;
  var isHost = myPlayerId === roomHostId;
  /* 보여줄 화면만 켜고 나머지는 끄기 (매번 다 껐다 켜면 화면이 깜빡여요) */
  var show = function (ids) {
    document.querySelectorAll('#relay .rl-phase').forEach(function (el) {
      var want = ids.indexOf(el.id) >= 0 ? '' : 'none';
      if (el.style.display !== want) el.style.display = want;
    });
  };
  if (st.phase === 'play') {
    var type = rlStepType(st.step);
    var remain = Math.max(0, Math.ceil((st.deadline - Date.now()) / 1000));
    document.getElementById('rl-step').textContent = (st.step + 1) + '/' + st.total + ' 단계 · ' + ({ write: '✍️ 문장 쓰기', draw: '🎨 그림 그리기', guess: '🤔 그림 보고 문장 쓰기' })[type];
    document.getElementById('rl-timer').textContent = '⏱ ' + remain + '초';
    document.getElementById('rl-timer').classList.toggle('hurry', remain <= 10);
    // 시간이 다 되면 지금까지 한 걸로 자동 제출
    if (remain <= 1 && !RL_SUBMITTED[st.step]) {
      if (type === 'draw') rlSubmit(rlCanvasData(), true);
      else rlSubmit(document.getElementById('rl-text-input').value, true);
      return;
    }
    if (RL_SUBMITTED[st.step]) {
      show(['rl-head', 'rl-wait']);
      if (!isHost) document.getElementById('rl-progress').textContent = '';
      return;
    }
    if (RL_EDIT_STEP !== st.step) {
      RL_EDIT_STEP = st.step;
      document.getElementById('rl-text-input').value = '';
      document.getElementById('rl-err').textContent = '';
      if (type === 'draw') rlClearCanvas(true);
    }
    if (type === 'write') {
      show(['rl-head', 'rl-text-area']);
      document.getElementById('rl-text-title').textContent = '엉뚱하고 재밌는 문장을 써주세요!';
      document.getElementById('rl-received').innerHTML = '';
      document.getElementById('rl-text-input').placeholder = '예: ' + RL_EXAMPLES[st.gameId % RL_EXAMPLES.length];
    } else {
      /* 받은 내용이 오기 전에도 화면은 바로 보여주고, 내용만 나중에 채워요 */
      show(['rl-head', type === 'draw' ? 'rl-draw-area' : 'rl-text-area']);
      if (type !== 'draw') {
        document.getElementById('rl-text-title').textContent = '이 그림은 무슨 문장일까요?';
        document.getElementById('rl-text-input').placeholder = '그림을 보고 문장으로 적어요';
      }
      rlLoadPrev(st, function (entry) {
        if (!RL_STATE || RL_STATE.step !== st.step || RL_SUBMITTED[st.step]) return;
        var sig = st.gameId + ':' + st.step + ':' + (entry ? 1 : 0);
        if (type === 'draw') {
          var pe = document.getElementById('rl-draw-prompt');
          if (pe.getAttribute('data-sig') !== sig) { pe.setAttribute('data-sig', sig); pe.innerHTML = '<small>이 문장을 그림으로!</small>' + esc(entry ? entry.v : '(앞사람이 안 냈어요… 자유롭게 그려요)'); }
        } else {
          var re = document.getElementById('rl-received');
          if (re.getAttribute('data-sig') !== sig) { re.setAttribute('data-sig', sig); re.innerHTML = entry && entry.t === 'img' ? '<img class="rl-recv-img" src="' + entry.v + '" alt="받은 그림" />' : '<div class="rl-recv-empty">(앞사람 그림이 없어요… 상상해서 적어요!)</div>'; }
        }
      });
    }
  } else if (st.phase === 'reveal') {
    show(['rl-reveal']);
    rlRenderReveal(st, isHost);
  }
}

function rlLoadPrev(st, cb) {
  var key = st.gameId + ':' + st.step;
  var c = RL_PREV_CACHE[key];
  if (c && (c.e || Date.now() - c.at < 4000 || c.busy)) { cb(c.e); return; }
  var prev = rlPrevPid(st);
  RL_PREV_CACHE[key] = { e: null, at: Date.now(), busy: true };
  DBget(roomKey('rl_' + prev)).then(function (d) {
    var e = d && d.gameId === st.gameId && d.entries ? d.entries[st.step - 1] : null;
    RL_PREV_CACHE[key] = { e: e || null, at: Date.now() };
    cb(e);
  }, function () { RL_PREV_CACHE[key] = { e: null, at: Date.now() }; cb(null); });
}

/* ---- 결과 공개: 방장이 ▶ 시작을 누르면 한 이야기가 한 장씩 자동으로 넘어가요 ----
   revealStart(시작 시각)만 저장하고, 몇 장째인지는 각자 시계로 계산해서 모두 똑같이 보여요. */
function rlRevealCount(st) {
  if (!st.revealStart) return 0;
  return Math.min(st.total, 1 + Math.floor((Date.now() - st.revealStart) / RL_REVEAL_MS));
}
function rlChainEntries(st, c) {
  var N = st.order.length, list = [];
  for (var k = 0; k < st.total; k++) {
    var pid = st.order[(c + k) % N];
    var d = RL_ALL && RL_ALL[pid];
    var e = d && d.gameId === st.gameId && d.entries ? d.entries[k] : null;
    list.push({ k: k, pid: pid, name: st.names[pid] || '?', e: e, label: k === 0 ? '처음 문장' : (rlStepType(k) === 'draw' ? '의 그림' : '의 추측') });
  }
  return list;
}
function rlRenderReveal(st, isHost) {
  var N = st.order.length;
  if (!RL_REVEAL_TICK) RL_REVEAL_TICK = setInterval(function () { if (RL_STATE && RL_STATE.phase === 'reveal') rlRenderReveal(RL_STATE, myPlayerId === roomHostId); }, 300);
  var draw = function () {
    var c = st.revealChain;
    var owner = st.order[c % N];
    var count = rlRevealCount(st);
    var done = count >= st.total;
    var entries = rlChainEntries(st, c);
    var html = '<div class="rl-chain-title">📖 <b>' + esc(st.names[owner] || '?') + '</b>의 문장은 어떻게 변했을까? <small>(' + (c + 1) + '/' + N + ')</small></div>';
    if (!count) html += '<div class="rl-reveal-ready">' + (isHost ? '준비됐으면 <b>▶ 시작</b>을 눌러요! 한 장씩 자동으로 넘어가요' : '방장이 시작하면 한 장씩 자동으로 넘어가요… 두근두근') + '</div>';
    entries.slice(0, count).forEach(function (it, k) {
      var who = '<div class="rl-item-who">' + esc(it.name) + (k === 0 ? ' (처음 문장)' : it.label) + '</div>';
      var body = !it.e ? '<div class="rl-item-text">(제출 안 함)</div>' : (it.e.t === 'img' ? '<img class="rl-item-img" src="' + it.e.v + '" alt="" />' : '<div class="rl-item-text">' + esc(it.e.v) + '</div>');
      html += '<div class="rl-item' + (k === count - 1 && !done ? ' new' : '') + '" data-k="' + k + '">' + who + body + '</div>';
    });
    if (count && !done) html += '<div class="rl-next-dots"><span></span><span></span><span></span></div>';
    var album = document.getElementById('rl-album');
    var sig = st.gameId + ':' + c + ':' + count + ':' + (RL_ALL ? 1 : 0);
    if (album.getAttribute('data-sig') !== sig) {
      var grew = album.getAttribute('data-c') === String(c) && count > +(album.getAttribute('data-n') || 0);
      album.innerHTML = html;
      album.setAttribute('data-sig', sig); album.setAttribute('data-c', c); album.setAttribute('data-n', count);
      if (grew) { var last = album.querySelector('.rl-item[data-k="' + (count - 1) + '"]'); if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      else if (!count) document.getElementById('relay').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    var lastChain = c >= N - 1;
    var nb = document.getElementById('rl-next-btn');
    nb.style.display = isHost && (!count || (done && !lastChain)) ? '' : 'none';
    nb.textContent = !count ? '▶ 시작' : '다음 이야기 ▶';
    document.getElementById('rl-restart-btn').style.display = isHost && done && lastChain ? '' : 'none';
    document.getElementById('rl-save').style.display = done ? '' : 'none';
    document.getElementById('rl-reveal-wait').textContent = isHost ? (count && !done ? '자동으로 넘어가는 중…' : '') : (done ? (lastChain ? '모든 이야기 끝! 🎉' : '방장이 다음 이야기를 열어요…') : (count ? '두근두근…' : ''));
  };
  var needed = !RL_ALL || st.order.some(function (pid) { return !RL_ALL[pid] || RL_ALL[pid].gameId !== st.gameId; });
  if (needed && !rlRenderReveal.loading && Date.now() - (rlRenderReveal.lastLoad || 0) > 1500) {
    rlRenderReveal.loading = true;
    rlRenderReveal.lastLoad = Date.now();
    DBgetPrefix('rl_', st.order).then(function (all) { RL_ALL = all; rlRenderReveal.loading = false; draw(); }, function () { rlRenderReveal.loading = false; });
  }
  draw();
}

function rlHostNext() {
  if (myPlayerId !== roomHostId) return;
  DBget(rlKey()).then(function (st) {
    if (!st || st.phase !== 'reveal') return;
    if (!st.revealStart) st.revealStart = Date.now();                      /* ▶ 시작 */
    else if (st.revealChain < st.order.length - 1) { st.revealChain++; st.revealStart = Date.now(); } /* 다음 이야기도 바로 자동 재생 */
    DBset(rlKey(), st).then(rlPoll);
  });
}

/* ---- 결과 저장: 움짤(GIF) / 동영상 ---- */
function rlLoadImg(src) {
  return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src; });
}
function rlWrapText(ctx, text, maxW) {
  var words = String(text).split(''), lines = [], line = '';
  words.forEach(function (ch) {
    if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch.trim() ? ch : ''; }
    else line += ch;
  });
  if (line) lines.push(line);
  return lines;
}
/* 이야기 하나를 그림 여러 장(프레임)으로 만들어요: 표지 + 한 장씩 */
function rlBuildFrames(st, c) {
  var W = 540, H = 540;
  var entries = rlChainEntries(st, c);
  return Promise.all(entries.map(function (it) { return it.e && it.e.t === 'img' ? rlLoadImg(it.e.v) : Promise.resolve(null); })).then(function (imgs) {
    var frames = [];
    var mk = function (fn) { var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d'); fn(x); frames.push(cv); };
    var bg = function (x) { x.fillStyle = '#26402F'; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(255,255,255,0.06)'; for (var i = 0; i < 12; i++) x.fillRect(0, i * 46, W, 2); };
    var font = function (sz, bold) { return (bold ? '700 ' : '') + sz + "px 'Gaegu','Noto Sans KR',sans-serif"; };
    var owner = st.names[st.order[c % st.order.length]] || '?';
    mk(function (x) {
      bg(x);
      x.textAlign = 'center'; x.fillStyle = '#F2C744'; x.font = font(30, true); x.fillText('엉뚱 그림 릴레이', W / 2, 150);
      x.fillStyle = '#F5F3E7'; x.font = font(40, true);
      rlWrapText(x, owner + '의 문장은', W - 60).concat(['어떻게 변했을까?']).forEach(function (l, i) { x.fillText(l, W / 2, 250 + i * 54); });
      x.font = font(60); x.fillText('🎨 → 🤔 → 🎨', W / 2, 440);
    });
    entries.forEach(function (it, k) {
      mk(function (x) {
        bg(x);
        x.textAlign = 'left'; x.fillStyle = '#F2C744'; x.font = font(26, true);
        x.fillText((k + 1) + '. ' + it.name + (k === 0 ? ' (처음 문장)' : it.label), 28, 52);
        var img = imgs[k];
        if (img) {
          var bw = W - 56, bh = H - 110, sc = Math.min(bw / img.width, bh / img.height);
          var dw = img.width * sc, dh = img.height * sc, dx = (W - dw) / 2, dy = 80 + (bh - dh) / 2;
          x.fillStyle = '#fff'; x.fillRect(dx - 6, dy - 6, dw + 12, dh + 12);
          x.drawImage(img, dx, dy, dw, dh);
        } else {
          x.fillStyle = '#F5F3E7'; x.font = font(42, true); x.textAlign = 'center';
          var lines = rlWrapText(x, it.e ? it.e.v : '(제출 안 함)', W - 70);
          var y0 = H / 2 - (lines.length - 1) * 28;
          lines.forEach(function (l, i) { x.fillText(l, W / 2, y0 + i * 56); });
        }
      });
    });
    return frames;
  });
}
function rlDownloadBlob(blob, name) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
}
function rlSaveGif() {
  var st = RL_STATE; if (!st || st.phase !== 'reveal') return;
  var msg = document.getElementById('rl-save-msg'); msg.textContent = '⏳ 움짤 만드는 중...';
  rlBuildFrames(st, st.revealChain).then(function (frames) {
    var gif = GIFW.create(frames[0].width, frames[0].height);
    frames.forEach(function (cv, i) { gif.addFrame(cv.getContext('2d'), i === 0 ? 1600 : 2400); });
    rlDownloadBlob(gif.finish(), '엉뚱그림릴레이_' + (st.names[st.order[st.revealChain % st.order.length]] || '') + '.gif');
    msg.textContent = '✔ 움짤을 저장했어요!';
  }).catch(function () { msg.textContent = '움짤을 만들지 못했어요.'; });
}
function rlSaveVideo() {
  var st = RL_STATE; if (!st || st.phase !== 'reveal') return;
  var msg = document.getElementById('rl-save-msg');
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { msg.textContent = '이 브라우저는 동영상 저장이 안 돼요. 움짤로 저장해 주세요!'; return; }
  var mime = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].filter(function (m) { return MediaRecorder.isTypeSupported(m); })[0];
  if (!mime) { msg.textContent = '이 브라우저는 동영상 저장이 안 돼요. 움짤로 저장해 주세요!'; return; }
  msg.textContent = '⏳ 동영상 만드는 중... (끝까지 재생하며 녹화해요)';
  rlBuildFrames(st, st.revealChain).then(function (frames) {
    var cv = document.createElement('canvas'); cv.width = frames[0].width; cv.height = frames[0].height;
    var x = cv.getContext('2d');
    x.drawImage(frames[0], 0, 0);
    var stream = cv.captureStream(30);
    var rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      var ext = /mp4/.test(mime) ? 'mp4' : 'webm';
      rlDownloadBlob(new Blob(chunks, { type: mime.split(';')[0] }), '엉뚱그림릴레이_' + (st.names[st.order[st.revealChain % st.order.length]] || '') + '.' + ext);
      msg.textContent = '✔ 동영상을 저장했어요!';
    };
    rec.start();
    var i = 0, alpha = 0;
    /* 장면이 부드럽게 겹쳐지며 넘어가게(페이드) 그려요 */
    var per = 2400, fade = 400, t0 = performance.now();
    var tick = function () {
      var t = performance.now() - t0;
      var idx = Math.min(frames.length - 1, Math.floor(t / per));
      var into = t - idx * per;
      x.drawImage(frames[idx], 0, 0);
      if (idx > 0 && into < fade) { x.globalAlpha = 1 - into / fade; x.drawImage(frames[idx - 1], 0, 0); x.globalAlpha = 1; }
      if (t < frames.length * per) requestAnimationFrame(tick);
      else setTimeout(function () { rec.stop(); }, 200);
    };
    requestAnimationFrame(tick);
  }).catch(function () { msg.textContent = '동영상을 만들지 못했어요.'; });
}

/* ---- 그림판 ---- */
var RL_COLORS = ['#1d1d1d', '#5f5f5f', '#a8a8a8', '#ffffff', '#e53935', '#ff7a7a', '#fb8c00', '#ffb74d', '#fdd835', '#fff59d', '#7cb342', '#43a047', '#a5d6a7', '#00897b', '#4dd0e1', '#1e88e5', '#90caf9', '#3949ab', '#8e24aa', '#ce93d8', '#f06292', '#f8bbd0', '#8d6e63', '#ffcc80'];
function rlSetupCanvas() {
  if (RL_DRAW) return;
  var cv = document.getElementById('rl-canvas');
  var ctx = cv.getContext('2d');
  RL_DRAW = { cv: cv, ctx: ctx, color: RL_COLORS[0], size: 6, eraser: false, fill: false, drawing: false, last: null, undo: [] };
  document.getElementById('rl-colors').innerHTML = RL_COLORS.map(function (c, i) {
    return '<button type="button" class="rl-color' + (i === 0 ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '"></button>';
  }).join('') + '<label class="rl-color rl-picker" title="다른 색 고르기"><input type="color" id="rl-color-pick" value="#ff6f00" /></label>';
  var setColor = function (c) {
    RL_DRAW.color = c;
    if (RL_DRAW.eraser) rlSetTool('pen');
    document.getElementById('rl-cur-color').style.background = c;
  };
  document.getElementById('rl-colors').onclick = function (e) {
    var b = e.target.closest('.rl-color'); if (!b || b.classList.contains('rl-picker')) return;
    document.querySelectorAll('#rl-colors .rl-color').forEach(function (x) { x.classList.toggle('on', x === b); });
    setColor(b.getAttribute('data-c'));
  };
  document.getElementById('rl-color-pick').addEventListener('input', function () {
    document.querySelectorAll('#rl-colors .rl-color').forEach(function (x) { x.classList.toggle('on', x.classList.contains('rl-picker')); });
    this.parentNode.style.background = this.value;
    setColor(this.value);
  });
  document.getElementById('rl-tools-mode').onclick = function (e) {
    var b = e.target.closest('[data-tool]'); if (!b) return;
    rlSetTool(b.getAttribute('data-tool'));
  };
  /* Ctrl+Z (맥은 Cmd+Z): 한 획 되돌리기 */
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || (e.key !== 'z' && e.key !== 'Z')) return;
    if (!document.getElementById('relay').classList.contains('active')) return;
    if (document.getElementById('rl-draw-area').style.display === 'none') return;
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.type !== 'color') return;
    e.preventDefault();
    rlUndo();
  });
  document.getElementById('rl-sizes').onclick = function (e) {
    var b = e.target.closest('.rl-size'); if (!b) return;
    document.querySelectorAll('#rl-sizes .rl-size').forEach(function (x) { x.classList.toggle('on', x === b); });
    RL_DRAW.size = +b.getAttribute('data-s');
  };
  function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    RL_DRAW.undo.push(ctx.getImageData(0, 0, cv.width, cv.height));
    if (RL_DRAW.undo.length > 25) RL_DRAW.undo.shift();
    if (RL_DRAW.fill) { var fp = pos(e); rlFloodFill(Math.floor(fp.x), Math.floor(fp.y), RL_DRAW.color); return; }
    RL_DRAW.drawing = true;
    RL_DRAW.last = pos(e);
    rlStroke(RL_DRAW.last, RL_DRAW.last);
  });
  cv.addEventListener('pointermove', function (e) {
    if (!RL_DRAW.drawing) return;
    var p = pos(e);
    rlStroke(RL_DRAW.last, p);
    RL_DRAW.last = p;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { cv.addEventListener(ev, function () { RL_DRAW.drawing = false; }); });
  rlClearCanvas(true);
}
function rlStroke(a, b) {
  var ctx = RL_DRAW.ctx;
  ctx.strokeStyle = RL_DRAW.eraser ? '#ffffff' : RL_DRAW.color;
  ctx.lineWidth = RL_DRAW.eraser ? RL_DRAW.size * 3 : RL_DRAW.size;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 0.01, b.y + 0.01); ctx.stroke();
}
function rlClearCanvas(silent) {
  if (!RL_DRAW) return;
  if (!silent) RL_DRAW.undo.push(RL_DRAW.ctx.getImageData(0, 0, RL_DRAW.cv.width, RL_DRAW.cv.height));
  else RL_DRAW.undo = [];
  RL_DRAW.ctx.fillStyle = '#ffffff';
  RL_DRAW.ctx.fillRect(0, 0, RL_DRAW.cv.width, RL_DRAW.cv.height);
}
function rlUndo() {
  if (!RL_DRAW || !RL_DRAW.undo.length) return;
  RL_DRAW.ctx.putImageData(RL_DRAW.undo.pop(), 0, 0);
}
function rlSetTool(tool) {
  RL_DRAW.eraser = tool === 'eraser';
  RL_DRAW.fill = tool === 'fill';
  document.querySelectorAll('#rl-tools-mode [data-tool]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === tool); });
  RL_DRAW.cv.style.cursor = tool === 'fill' ? 'cell' : 'crosshair';
}
/* 🪣 색 채우기: 누른 곳과 비슷한 색으로 이어진 영역을 한 번에 칠해요 (선 가장자리 번짐까지 고려) */
function rlFloodFill(sx, sy, color) {
  var cv = RL_DRAW.cv, ctx = RL_DRAW.ctx, W = cv.width, H = cv.height;
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  var img = ctx.getImageData(0, 0, W, H), d = img.data;
  var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return;
  var fr = parseInt(m[1], 16), fg = parseInt(m[2], 16), fb = parseInt(m[3], 16);
  var p0 = (sy * W + sx) * 4, tr = d[p0], tg = d[p0 + 1], tb = d[p0 + 2];
  if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 10) return;
  RL_DRAW.undo.push(ctx.getImageData(0, 0, W, H));
  if (RL_DRAW.undo.length > 30) RL_DRAW.undo.shift();
  var TOL = 70;
  var seen = new Uint8Array(W * H);
  var match = function (i) { var q = i * 4; return Math.abs(d[q] - tr) + Math.abs(d[q + 1] - tg) + Math.abs(d[q + 2] - tb) <= TOL; };
  var stack = [sy * W + sx], filled = [];
  while (stack.length) {
    var i = stack.pop();
    var y = (i / W) | 0, x = i - y * W;
    while (x > 0 && !seen[i - 1] && match(i - 1)) { x--; i--; }
    var up = false, dn = false;
    for (; x < W && !seen[i] && match(i); x++, i++) {
      seen[i] = 1; filled.push(i);
      if (y > 0) { var u = i - W; if (!seen[u] && match(u)) { if (!up) { stack.push(u); up = true; } } else up = false; }
      if (y < H - 1) { var dd = i + W; if (!seen[dd] && match(dd)) { if (!dn) { stack.push(dd); dn = true; } } else dn = false; }
    }
  }
  /* 테두리 바로 옆 한 칸도 칠해서 하얀 틈이 안 남게 */
  var grow = [];
  filled.forEach(function (i) {
    var x = i % W;
    if (x > 0 && !seen[i - 1]) grow.push(i - 1);
    if (x < W - 1 && !seen[i + 1]) grow.push(i + 1);
    if (i >= W && !seen[i - W]) grow.push(i - W);
    if (i < W * (H - 1) && !seen[i + W]) grow.push(i + W);
  });
  filled.concat(grow).forEach(function (i) { var q = i * 4; d[q] = fr; d[q + 1] = fg; d[q + 2] = fb; d[q + 3] = 255; });
  ctx.putImageData(img, 0, 0);
}
function rlCanvasData() { return RL_DRAW ? RL_DRAW.cv.toDataURL('image/png') : ''; }
