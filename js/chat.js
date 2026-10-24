/* ---------------- 공용 채팅: 말풍선(좌/우) · 링크 · 파일 업로드 · 위젯 드래그 ---------------- */
/* 오른쪽 채팅 위젯(core.js의 group*)과 0번 채널 라운지(channels.js)가 같은 화면 그리기/전송 코드를
   같이 씁니다.
   - 내 메시지는 오른쪽(노란 말풍선), 다른 사람 메시지는 왼쪽(프로필 동그라미 + 이름 + 말풍선).
     같은 사람이 2분 안에 연달아 보내면 이름/프로필을 한 번만 보여주고, 시간은 그 묶음의 마지막
     말풍선 옆에만 표시합니다. 날짜가 바뀌면 가운데에 날짜 구분선이 들어갑니다.
   - http(s):// 또는 www. 로 시작하는 글자는 자동으로 링크가 되어 누르면 새 탭에서 열립니다.
   - 파일/사진: 메시지 목록과 따로 roomKey('cfile_'+파일id) 에 저장하고(서버 요청 한 번에 1MB
     제한이 있어서 파일은 700KB까지), 메시지에는 파일 id만 넣습니다. 사진은 올리기 전에 자동으로
     줄여서(최대 1280px) 용량을 아낍니다. 오래된 메시지가 밀려나면 그 파일도 같이 지웁니다. */
var CHAT_MAX_FILE_BYTES = 700 * 1024;
var CHAT_MAX_MESSAGES = 60;
var CHAT_MAX_TEXT = 500;
var CHAT_FILE_CACHE = {};
var CHAT_FILE_LOADING = {};
var CHAT_AVATAR_COLORS = ['#F2C744', '#6FC3DF', '#F2836B', '#B79CE8', '#6FC364', '#E89CC8', '#F2A65A', '#7FD8BE'];
var CHAT_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function chatFileKey(fid) { return roomKey('cfile_' + fid); }
function chatNewId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function chatAvatarColor(pid) {
  var h = 0;
  String(pid || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
  return CHAT_AVATAR_COLORS[h % CHAT_AVATAR_COLORS.length];
}

function chatFmtTime(ts) {
  var d = new Date(ts);
  var h = d.getHours();
  var m = d.getMinutes();
  return (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m;
}
function chatDayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
function chatDayLabel(ts) {
  var d = new Date(ts);
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + CHAT_WEEKDAYS[d.getDay()] + '요일';
}
function chatFmtSize(n) {
  if (n < 1024) return n + 'B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + 'KB';
  return (n / 1024 / 1024).toFixed(1) + 'MB';
}

/* 글자를 안전하게 이스케이프한 뒤 주소처럼 생긴 부분만 링크로 바꿉니다. 따옴표/꺾쇠는 주소에
   포함하지 않아서 href 속성 밖으로 새어나가지 않고, http/https 주소만 링크가 됩니다. */
function chatLinkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi, function (url) {
    var trail = '';
    var m = url.match(/[).,!?:]+$/);
    if (m) { trail = m[0]; url = url.slice(0, -trail.length); }
    var href = /^www\./i.test(url) ? 'https://' + url : url;
    return '<a class="cmsg-link" href="' + href + '" target="_blank" rel="noopener noreferrer">' + url + '</a>' + trail;
  });
}

function chatFileIcon(name, mime) {
  var ext = (String(name).split('.').pop() || '').toLowerCase();
  if (/^image\//.test(mime)) return '🖼️';
  if (/^video\//.test(mime)) return '🎬';
  if (/^audio\//.test(mime)) return '🎵';
  if (ext === 'pdf') return '📕';
  if (/^(zip|rar|7z|tar|gz)$/.test(ext)) return '🗜️';
  if (/^(ppt|pptx|key)$/.test(ext)) return '📊';
  if (/^(xls|xlsx|csv)$/.test(ext)) return '📗';
  if (/^(doc|docx|hwp|hwpx|txt)$/.test(ext)) return '📝';
  return '📄';
}

function chatBubbleInner(m) {
  if (m.type === 'file') {
    if (m.isImage) {
      var cached = CHAT_FILE_CACHE[m.fileId];
      return '<div class="cmsg-img" data-fid="' + esc(m.fileId) + '">' +
        (cached ? '<img src="' + cached.data + '" alt="' + esc(m.fname) + '" />' : '<div class="cmsg-img-loading">🖼️ 사진 불러오는 중...</div>') +
        '</div>';
    }
    return '<button type="button" class="cmsg-file" data-fid="' + esc(m.fileId) + '">' +
      '<span class="cmsg-file-icon">' + chatFileIcon(m.fname, m.fmime) + '</span>' +
      '<span class="cmsg-file-meta"><span class="cmsg-file-name">' + esc(m.fname) + '</span>' +
      '<span class="cmsg-file-size">' + chatFmtSize(m.fsize || 0) + ' · 눌러서 저장</span></span>' +
      '</button>';
  }
  if (m.type === 'pending') {
    return '<div class="cmsg-pending">⏳ ' + esc(m.fname) + ' 올리는 중...</div>';
  }
  return chatLinkify(m.text || '');
}

/* tracker: 채팅창마다 하나씩 갖는 상태 객체 { lastSig, pending: [] } - 같은 내용이면 다시 안 그립니다.
   예전엔 메시지 "개수"만 비교해서, 개수가 상한(50개)에 걸린 뒤로는 새 메시지가 와도 화면이 안 바뀌는
   문제가 있었는데, 이제는 마지막 메시지 id까지 같이 비교합니다. */
function chatRenderInto(el, messages, tracker, emptyText) {
  if (!el) return;
  var all = messages.concat(tracker.pending || []);
  var last = all[all.length - 1];
  var sig = all.length + ':' + (last ? last.id : '');
  if (sig === tracker.lastSig) return;
  var firstRender = tracker.lastSig == null;
  tracker.lastSig = sig;
  var nearBottom = firstRender || (el.scrollHeight - el.scrollTop - el.clientHeight < 90);
  if (!all.length) {
    el.innerHTML = '<div class="cmsg-empty">' + esc(emptyText || '아직 대화가 없어요. 첫 메시지를 남겨보세요!') + '</div>';
    return;
  }
  var html = '';
  all.forEach(function (m, i) {
    var prev = all[i - 1];
    var next = all[i + 1];
    var mine = m.pid === myPlayerId;
    if (!prev || chatDayKey(prev.ts) !== chatDayKey(m.ts)) {
      html += '<div class="cmsg-day"><span>' + chatDayLabel(m.ts) + '</span></div>';
      prev = null;
    }
    var cont = prev && prev.pid === m.pid && (m.ts - prev.ts < 120000);
    var sameMinuteNext = next && next.pid === m.pid && chatDayKey(next.ts) === chatDayKey(m.ts) &&
      Math.floor(next.ts / 60000) === Math.floor(m.ts / 60000);
    var timeHtml = sameMinuteNext ? '' : '<span class="cmsg-time">' + (m.type === 'pending' ? '' : chatFmtTime(m.ts)) + '</span>';
    var isMedia = m.type === 'file';
    var bubble = '<div class="cmsg-bubble' + (isMedia ? ' media' : '') + '">' + chatBubbleInner(m) + '</div>';
    if (mine) {
      html += '<div class="cmsg mine' + (cont ? ' cont' : '') + '"><div class="cmsg-line">' + timeHtml + bubble + '</div></div>';
    } else {
      var initial = esc((m.name || '?').trim().charAt(0) || '?');
      html += '<div class="cmsg other' + (cont ? ' cont' : '') + '">' +
        (cont ? '<div class="cmsg-avatar ghost"></div>' : '<div class="cmsg-avatar" style="background:' + chatAvatarColor(m.pid) + '">' + initial + '</div>') +
        '<div class="cmsg-body">' + (cont ? '' : '<div class="cmsg-name">' + esc(m.name || '') + '</div>') +
        '<div class="cmsg-line">' + bubble + timeHtml + '</div></div></div>';
    }
  });
  el.innerHTML = html;
  chatHydrateImages(el);
  var lastIsMine = last && last.pid === myPlayerId;
  if (nearBottom || lastIsMine) el.scrollTop = el.scrollHeight;
}

function chatLoadFile(fid) {
  if (CHAT_FILE_CACHE[fid]) return Promise.resolve(CHAT_FILE_CACHE[fid]);
  if (CHAT_FILE_LOADING[fid]) return CHAT_FILE_LOADING[fid];
  CHAT_FILE_LOADING[fid] = DBget(chatFileKey(fid)).then(function (f) {
    delete CHAT_FILE_LOADING[fid];
    if (f && f.data) CHAT_FILE_CACHE[fid] = f;
    return f;
  });
  return CHAT_FILE_LOADING[fid];
}

function chatHydrateImages(el) {
  el.querySelectorAll('.cmsg-img[data-fid]').forEach(function (box) {
    if (box.querySelector('img')) return;
    var fid = box.getAttribute('data-fid');
    chatLoadFile(fid).then(function (f) {
      if (!box.isConnected) return;
      if (!f || !f.data) { box.innerHTML = '<div class="cmsg-img-loading">사진이 만료됐어요</div>'; return; }
      var atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
      var img = document.createElement('img');
      img.alt = f.name || '';
      img.onload = function () { if (atBottom) el.scrollTop = el.scrollHeight; };
      img.src = f.data;
      box.innerHTML = '';
      box.appendChild(img);
    });
  });
}

function chatDataUrlToBlob(dataUrl) {
  var parts = dataUrl.split(',');
  var mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  var bin = atob(parts[1] || '');
  var arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function chatDownload(fid) {
  chatLoadFile(fid).then(function (f) {
    if (!f || !f.data) { alert('파일을 찾을 수 없어요. (서버가 다시 켜지면 예전 파일은 사라져요)'); return; }
    var url = URL.createObjectURL(chatDataUrlToBlob(f.data));
    var a = document.createElement('a');
    a.href = url;
    a.download = f.name || 'file';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  });
}

function chatOpenLightbox(src, name) {
  var box = document.getElementById('chat-lightbox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'chat-lightbox';
    box.className = 'chat-lightbox';
    box.innerHTML = '<img alt="" /><div class="chat-lightbox-bar"><span class="chat-lightbox-name"></span><button type="button" class="btn btn-ghost" data-act="close">닫기 ✕</button></div>';
    box.addEventListener('click', function (e) {
      if (e.target === box || (e.target.getAttribute && e.target.getAttribute('data-act') === 'close')) box.style.display = 'none';
    });
    document.body.appendChild(box);
  }
  box.querySelector('img').src = src;
  box.querySelector('.chat-lightbox-name').textContent = name || '';
  box.style.display = 'flex';
}

/* 메시지 영역 하나에 클릭(사진 크게 보기/파일 저장)과 파일 끌어다 놓기를 연결합니다. */
function chatBindMessageArea(el, onDropFiles) {
  if (!el || el.getAttribute('data-chat-bound')) return;
  el.setAttribute('data-chat-bound', '1');
  el.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest('.cmsg-img img');
    if (img) { chatOpenLightbox(img.src, img.alt); return; }
    var fileBtn = e.target.closest && e.target.closest('.cmsg-file');
    if (fileBtn) chatDownload(fileBtn.getAttribute('data-fid'));
  });
  el.addEventListener('dragover', function (e) {
    if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') === -1) return;
    e.preventDefault();
    el.classList.add('drop-hover');
  });
  el.addEventListener('dragleave', function () { el.classList.remove('drop-hover'); });
  el.addEventListener('drop', function (e) {
    el.classList.remove('drop-hover');
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    onDropFiles(e.dataTransfer.files);
  });
}

/* 메시지 하나를 목록에 추가합니다. 상한을 넘어서 밀려난 오래된 파일 메시지의 파일 데이터도 같이 지웁니다. */
function chatPushMessage(key, msg) {
  return DBget(key).then(function (state) {
    state = state || { messages: [] };
    state.messages = state.messages || [];
    state.messages.push(msg);
    if (state.messages.length > CHAT_MAX_MESSAGES) {
      var removed = state.messages.splice(0, state.messages.length - CHAT_MAX_MESSAGES);
      removed.forEach(function (r) { if (r && r.type === 'file' && r.fileId) DBset(chatFileKey(r.fileId), null); });
    }
    return DBset(key, state);
  });
}

function chatSendText(key, text) {
  text = String(text || '').trim();
  if (!text) return Promise.resolve();
  return chatPushMessage(key, { id: chatNewId(), pid: myPlayerId, name: me.name, text: text.slice(0, CHAT_MAX_TEXT), ts: Date.now() });
}

/* 채팅방(목록 key)이 통째로 지워질 때 그 안에 있던 파일들도 같이 지웁니다. */
function chatDeleteFilesOf(messages) {
  (messages || []).forEach(function (m) { if (m && m.type === 'file' && m.fileId) DBset(chatFileKey(m.fileId), null); });
}

function chatReadAsDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = function () { reject(new Error('read')); };
    r.readAsDataURL(file);
  });
}

function chatDataUrlBytes(dataUrl) { var b64 = dataUrl.split(',')[1] || ''; return Math.floor(b64.length * 3 / 4); }

/* 사진은 화면에서 보기 좋은 크기(최대 1280px)로 줄이고 JPEG로 바꿔서 용량을 확 줄입니다.
   GIF(움짤)는 줄이면 움직임이 사라져서 원본 그대로 보내고, 용량 제한만 확인합니다. */
function chatPrepareFile(file) {
  var isResizable = /^image\/(png|jpeg|jpg|webp|bmp)$/i.test(file.type);
  var isImage = /^image\//i.test(file.type);
  if (!isResizable) {
    if (file.size > CHAT_MAX_FILE_BYTES) return Promise.reject(new Error('too_big'));
    return chatReadAsDataUrl(file).then(function (data) {
      return { data: data, name: file.name || 'file', mime: file.type || 'application/octet-stream', size: file.size, isImage: isImage };
    });
  }
  return chatReadAsDataUrl(file).then(function (src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var maxSide = 1280;
        var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement('canvas');
        var data = null;
        for (var attempt = 0; attempt < 6; attempt++) {
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          data = canvas.toDataURL('image/jpeg', 0.84 - attempt * 0.08);
          if (chatDataUrlBytes(data) <= CHAT_MAX_FILE_BYTES) break;
          w = Math.round(w * 0.8); h = Math.round(h * 0.8);
        }
        if (chatDataUrlBytes(data) > CHAT_MAX_FILE_BYTES) { reject(new Error('too_big')); return; }
        var base = (file.name || 'photo').replace(/\.[^.]+$/, '');
        resolve({ data: data, name: base + '.jpg', mime: 'image/jpeg', size: chatDataUrlBytes(data), isImage: true });
      };
      img.onerror = function () { reject(new Error('bad_image')); };
      img.src = src;
    });
  });
}

/* 파일은 서버에 "제대로 저장됐는지"를 꼭 확인해야 해서(용량 초과면 서버가 거절함) 일반 DBset 대신
   응답 코드를 직접 확인합니다. 혼자하기/서버 미연결 상태에서는 내 화면 메모리에만 둡니다. */
function chatStoreFile(fid, obj) {
  var key = chatFileKey(fid);
  memoryStore[key] = obj;
  if (playMode === 'solo' || cloudStatus !== 'connected' || !cloudServerUrl) return Promise.resolve(true);
  var p = keyParts(key);
  return fetch(cloudServerUrl + '/api/state?room=' + encodeURIComponent(p.room) + '&game=' + encodeURIComponent(p.game), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  }).then(function (r) { return r.ok; }).catch(function () { return false; });
}

/* 파일 여러 개를 차례대로 올립니다. tracker.pending에 "올리는 중" 말풍선을 잠깐 띄워둡니다.
   onRefresh(): 화면 다시 그리기, onError(msg): 오류 문구 표시 */
function chatSendFiles(key, fileList, tracker, onRefresh, onError) {
  var files = Array.prototype.slice.call(fileList || [], 0, 5);
  if (!files.length) return;
  onError('');
  var chain = Promise.resolve();
  files.forEach(function (file) {
    chain = chain.then(function () {
      var pend = { id: 'pend_' + chatNewId(), pid: myPlayerId, name: me.name, type: 'pending', fname: file.name || '파일', ts: Date.now() };
      tracker.pending = (tracker.pending || []).concat([pend]);
      onRefresh();
      var removePending = function () {
        tracker.pending = (tracker.pending || []).filter(function (p) { return p.id !== pend.id; });
      };
      return chatPrepareFile(file).then(function (prepared) {
        var fid = chatNewId();
        return chatStoreFile(fid, { data: prepared.data, name: prepared.name, mime: prepared.mime, size: prepared.size }).then(function (ok) {
          if (!ok) throw new Error('upload');
          CHAT_FILE_CACHE[fid] = { data: prepared.data, name: prepared.name, mime: prepared.mime, size: prepared.size };
          return chatPushMessage(key, {
            id: chatNewId(), pid: myPlayerId, name: me.name, ts: Date.now(),
            type: 'file', fileId: fid, fname: prepared.name, fsize: prepared.size, fmime: prepared.mime, isImage: prepared.isImage
          });
        });
      }).then(function () {
        removePending();
        onRefresh();
      }).catch(function (err) {
        removePending();
        onRefresh();
        var msg = err && err.message === 'too_big' ? ('"' + file.name + '" 파일이 너무 커요. 사진은 자동으로 줄여주지만, 다른 파일은 700KB까지만 올릴 수 있어요.')
          : err && err.message === 'bad_image' ? ('"' + file.name + '" 사진을 읽을 수 없어요.')
          : ('"' + file.name + '" 업로드에 실패했어요. 잠시 후 다시 시도해주세요.');
        onError(msg);
      });
    });
  });
}

/* 입력칸 하나에 📎 버튼/파일 선택창/사진 붙여넣기(Ctrl+V)를 연결합니다. */
function chatBindComposer(opts) {
  var input = document.getElementById(opts.inputId);
  var attachBtn = document.getElementById(opts.attachBtnId);
  var fileInput = document.getElementById(opts.fileInputId);
  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files.length) opts.onFiles(fileInput.files);
      fileInput.value = '';
    });
  }
  if (input) {
    input.addEventListener('paste', function (e) {
      var files = e.clipboardData && e.clipboardData.files;
      if (files && files.length) { e.preventDefault(); opts.onFiles(files); }
    });
  }
}

/* ---------------- 오른쪽 채팅 위젯: 끌어서 옮기기 ---------------- */
/* 💬 동그라미 버튼을 끌면 버튼이 옮겨지고(살짝 누르기만 하면 예전처럼 열기/닫기), 펼친 채팅창은
   위쪽 손잡이(═)를 끌어서 따로 옮길 수 있습니다. 옮긴 위치는 이 브라우저에 기억해두고, 손잡이를
   두 번 누르면 다시 버튼 옆 기본 위치로 돌아옵니다. */
var GW_BTN_POS = null;
var GW_PANEL_POS = null;
var GW_JUST_DRAGGED = false;

function gwLoadPos(k) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v.x === 'number' ? v : null; } catch (e) { return null; } }
function gwSavePos(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function gwClamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function gwApplyBtnPos() {
  var widget = document.getElementById('group-widget');
  var btn = document.getElementById('group-toggle-btn');
  if (!widget || !btn) return;
  var size = btn.offsetWidth || 48;
  var vw = window.innerWidth, vh = window.innerHeight;
  var pos = GW_BTN_POS || { x: vw - size - 10, y: Math.round(vh / 2 - size / 2) };
  var x = gwClamp(pos.x, 4, vw - size - 4);
  var y = gwClamp(pos.y, 4, vh - size - 4);
  widget.style.left = x + 'px';
  widget.style.top = y + 'px';
  widget.style.right = 'auto';
  widget.style.transform = 'none';
}

function gwPlacePanel() {
  var panel = document.getElementById('group-panel');
  var btn = document.getElementById('group-toggle-btn');
  if (!panel || !btn || panel.style.display === 'none') return;
  var vw = window.innerWidth, vh = window.innerHeight;
  var pw = panel.offsetWidth, ph = panel.offsetHeight;
  var x, y;
  if (GW_PANEL_POS) {
    x = GW_PANEL_POS.x; y = GW_PANEL_POS.y;
  } else {
    var r = btn.getBoundingClientRect();
    var onRight = (r.left + r.width / 2) > vw / 2;
    x = onRight ? r.left - pw - 10 : r.right + 10;
    if (x < 4 || x + pw > vw - 4) x = r.left + r.width / 2 - pw / 2;
    y = r.top + r.height / 2 - ph / 2;
  }
  panel.style.left = gwClamp(x, 4, Math.max(4, vw - pw - 4)) + 'px';
  panel.style.top = gwClamp(y, 4, Math.max(4, vh - ph - 4)) + 'px';
  panel.style.right = 'auto';
  panel.style.transform = 'none';
}

function gwMakeDraggable(handle, getStart, onMove, onEnd) {
  var startX = 0, startY = 0, base = null, dragging = false, active = false;
  handle.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest && e.target !== handle && e.target.closest('button') && e.target.closest('button') !== handle) return;
    active = true; dragging = false;
    startX = e.clientX; startY = e.clientY;
    base = getStart();
    try { handle.setPointerCapture(e.pointerId); } catch (err) {}
  });
  handle.addEventListener('pointermove', function (e) {
    if (!active) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    if (!dragging && Math.abs(dx) + Math.abs(dy) < 6) return;
    dragging = true;
    handle.classList.add('dragging');
    onMove(base.x + dx, base.y + dy);
    e.preventDefault();
  });
  function finish() {
    if (!active) return;
    active = false;
    handle.classList.remove('dragging');
    if (dragging) onEnd();
  }
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
}

(function gwSetupDrag() {
  var btn = document.getElementById('group-toggle-btn');
  var panel = document.getElementById('group-panel');
  var handle = document.getElementById('group-drag-handle');
  if (!btn || !panel) return;
  GW_BTN_POS = gwLoadPos('gamehub_chat_btn_pos');
  GW_PANEL_POS = gwLoadPos('gamehub_chat_panel_pos');
  btn.removeAttribute('onclick');
  btn.addEventListener('click', function () {
    if (GW_JUST_DRAGGED) { GW_JUST_DRAGGED = false; return; }
    toggleGroupPanel();
  });
  gwMakeDraggable(btn, function () {
    var r = btn.getBoundingClientRect();
    return { x: r.left, y: r.top };
  }, function (x, y) {
    GW_BTN_POS = { x: x, y: y };
    gwApplyBtnPos();
    if (!GW_PANEL_POS) gwPlacePanel();
  }, function () {
    GW_JUST_DRAGGED = true;
    setTimeout(function () { GW_JUST_DRAGGED = false; }, 350);
    gwSavePos('gamehub_chat_btn_pos', GW_BTN_POS);
  });
  if (handle) {
    gwMakeDraggable(handle, function () {
      var r = panel.getBoundingClientRect();
      return { x: r.left, y: r.top };
    }, function (x, y) {
      GW_PANEL_POS = { x: x, y: y };
      gwPlacePanel();
    }, function () {
      gwSavePos('gamehub_chat_panel_pos', GW_PANEL_POS);
    });
    handle.addEventListener('dblclick', function () {
      GW_PANEL_POS = null;
      try { localStorage.removeItem('gamehub_chat_panel_pos'); } catch (e) {}
      gwPlacePanel();
    });
  }
  window.addEventListener('resize', function () { gwApplyBtnPos(); gwPlacePanel(); });
  gwApplyBtnPos();
})();

/* 오른쪽 위젯 채팅창에도 파일 올리기/사진 크게 보기를 연결합니다. */
var GROUP_CHAT_TRACKER = { lastSig: null, pending: [] };
(function groupSetupRichChat() {
  var el = document.getElementById('group-chat-messages');
  var onFiles = function (files) {
    if (!roomJoined) return;
    chatSendFiles(groupChatKey(), files, GROUP_CHAT_TRACKER, function () { groupPoll(); }, function (msg) {
      var errEl = document.getElementById('group-upload-err');
      if (errEl) errEl.textContent = msg;
    });
  };
  chatBindMessageArea(el, onFiles);
  chatBindComposer({ inputId: 'group-chat-input', attachBtnId: 'group-attach-btn', fileInputId: 'group-file-input', onFiles: onFiles });
})();
