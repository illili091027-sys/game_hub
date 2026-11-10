/* 🚇 지하철 타이핑 (혼자 하기)
   노선을 고르면 역 이름을 순서대로 쳐서 열차를 운행해요.
   - 보고 치기: 다음 역 이름이 보여요
   - 외워 치기: 다음 역이 ? 로 가려져요 (💡 힌트: 초성 → 정답)
   타수 = 1분 동안 누른 자판 수(한글 자모 기준), 정확도 = 틀린 자판을 뺀 비율 */

var MT_LINES = [
  { id: 'l1', num: '1', name: '1호선', sub: '서울역 ↔ 청량리', color: '#0052A4',
    st: ['서울역', '시청', '종각', '종로3가', '종로5가', '동대문', '동묘앞', '신설동', '제기동', '청량리'] },
  { id: 'l2', num: '2', name: '2호선', sub: '순환선 한 바퀴', color: '#00A84D', loop: true,
    st: ['시청', '을지로입구', '을지로3가', '을지로4가', '동대문역사문화공원', '신당', '상왕십리', '왕십리', '한양대', '뚝섬', '성수', '건대입구', '구의', '강변', '잠실나루', '잠실', '잠실새내', '종합운동장', '삼성', '선릉', '역삼', '강남', '교대', '서초', '방배', '사당', '낙성대', '서울대입구', '봉천', '신림', '신대방', '구로디지털단지', '대림', '신도림', '문래', '영등포구청', '당산', '합정', '홍대입구', '신촌', '이대', '아현', '충정로'] },
  { id: 'l3', num: '3', name: '3호선', sub: '대화 ↔ 오금', color: '#EF7C1C',
    st: ['대화', '주엽', '정발산', '마두', '백석', '대곡', '화정', '원당', '원흥', '삼송', '지축', '구파발', '연신내', '불광', '녹번', '홍제', '무악재', '독립문', '경복궁', '안국', '종로3가', '을지로3가', '충무로', '동대입구', '약수', '금호', '옥수', '압구정', '신사', '잠원', '고속터미널', '교대', '남부터미널', '양재', '매봉', '도곡', '대치', '학여울', '대청', '일원', '수서', '가락시장', '경찰병원', '오금'] },
  { id: 'l4', num: '4', name: '4호선', sub: '상계 ↔ 사당', color: '#00A5DE',
    st: ['상계', '노원', '창동', '쌍문', '수유', '미아', '미아사거리', '길음', '성신여대입구', '한성대입구', '혜화', '동대문', '동대문역사문화공원', '충무로', '명동', '회현', '서울역', '숙대입구', '삼각지', '신용산', '이촌', '동작', '총신대입구', '사당'] },
  { id: 'sb', num: '신', name: '신분당선', sub: '신사 ↔ 광교', color: '#D4003B',
    st: ['신사', '논현', '신논현', '강남', '양재', '양재시민의숲', '청계산입구', '판교', '정자', '미금', '동천', '수지구청', '성복', '상현', '광교중앙', '광교'] }
];
/* 다른 이름으로 쳐도 인정 */
var MT_ALIAS = { '총신대입구': ['이수'], '성신여대입구': ['돈암'], '잠실새내': ['신천'] };

var MT = { line: null, mode: 'see', rev: false, stations: [], idx: 0, t0: 0, keys: 0, bad: 0, lastJ: 0, wrong: 0, hint: 0, hints: 0, timer: null, done: false };

/* ---------- 한글 자모 나누기 (겹모음·겹받침은 자판 2번) ---------- */
var MT_CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
var MT_JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
var MT_JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
var MT_SPLIT = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ', 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };
function mtJamo(s) {
  var out = '';
  s = String(s || '').replace(/\s+/g, '');
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 0xAC00 && c <= 0xD7A3) {
      var k = c - 0xAC00;
      out += MT_CHO[Math.floor(k / 588)] + MT_JUNG[Math.floor((k % 588) / 28)] + MT_JONG[k % 28];
    } else out += MT_SPLIT[s[i]] || s[i];
  }
  return out;
}
function mtChosung(s) {
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    out += (c >= 0xAC00 && c <= 0xD7A3) ? MT_CHO[Math.floor((c - 0xAC00) / 588)] : s[i];
  }
  return out;
}

/* ---------- 기록 ---------- */
function mtBestKey(lineId, mode) { return 'gamehub_metro_best_' + lineId + '_' + mode; }
function mtLoadBest(lineId, mode) { try { return JSON.parse(localStorage.getItem(mtBestKey(lineId, mode)) || 'null'); } catch (e) { return null; } }
function mtSaveBest(lineId, mode, rec) { try { localStorage.setItem(mtBestKey(lineId, mode), JSON.stringify(rec)); } catch (e) {} }

/* ---------- 화면 ---------- */
function startMetroGame() { stopMetroGame(); mtShowSelect(); }
function stopMetroGame() { clearInterval(MT.timer); MT.timer = null; }

function mtShowSelect() {
  stopMetroGame();
  var root = document.getElementById('mt-root');
  var html = '<div class="mt-select">' +
    '<div class="mt-modes">' +
      '<button class="mt-mode' + (MT.mode === 'see' ? ' on' : '') + '" onclick="mtSetMode(\'see\')">🚆 보고 치기</button>' +
      '<button class="mt-mode' + (MT.mode === 'memo' ? ' on' : '') + '" onclick="mtSetMode(\'memo\')">🧠 외워 치기</button>' +
      '<button class="mt-mode mt-rev' + (MT.rev ? ' on' : '') + '" onclick="mtToggleRev()">⇄ 반대 방향</button>' +
    '</div>' +
    '<div class="mt-lines">';
  MT_LINES.forEach(function (L) {
    var b = mtLoadBest(L.id, MT.mode);
    var a = MT.rev ? L.st[L.st.length - 1] : L.st[0];
    var z = MT.rev ? L.st[0] : L.st[L.st.length - 1];
    var sub = L.loop ? L.sub + (MT.rev ? ' (반대로)' : '') : a + ' → ' + z;
    html += '<button class="mt-line" style="--lc:' + L.color + '" onclick="mtStart(\'' + L.id + '\')">' +
      '<span class="mt-badge">' + L.num + '</span>' +
      '<span class="mt-line-txt"><b>' + L.name + '</b><small>' + sub + ' · ' + L.st.length + '역</small></span>' +
      '<span class="mt-line-best">' + (b ? '👑 ' + b.cpm + '타' : '') + '</span>' +
    '</button>';
  });
  html += '</div></div>';
  root.innerHTML = html;
}
function mtSetMode(m) { MT.mode = m; mtShowSelect(); }
function mtToggleRev() { MT.rev = !MT.rev; mtShowSelect(); }

function mtStart(lineId) {
  var L = MT_LINES.filter(function (x) { return x.id === lineId; })[0];
  if (!L) return;
  stopMetroGame();
  MT.line = L;
  MT.stations = MT.rev ? L.st.slice().reverse() : L.st.slice();
  if (L.loop) MT.stations.push(MT.stations[0]);   /* 순환선: 한 바퀴 돌아 처음 역으로 */
  MT.idx = 1;  /* 0번 역에서 출발 → 1번 역부터 쳐요 */
  MT.t0 = 0; MT.keys = 0; MT.bad = 0; MT.lastJ = 0; MT.wrong = 0; MT.hint = 0; MT.hints = 0; MT.done = false;
  var root = document.getElementById('mt-root');
  root.innerHTML =
    '<div class="mt-play" style="--lc:' + L.color + '">' +
      '<div class="mt-stats">' +
        '<span class="mt-pill"><span class="mt-badge sm">' + L.num + '</span>' + L.name + '</span>' +
        '<span>⏱ <b id="mt-time">0.0</b>초</span>' +
        '<span>⌨️ <b id="mt-cpm">0</b>타</span>' +
        '<span>🎯 <b id="mt-acc">100</b>%</span>' +
        '<span>🚉 <b id="mt-left"></b></span>' +
      '</div>' +
      '<div class="mt-route" id="mt-route"><div class="mt-track" id="mt-track"></div></div>' +
      '<div class="mt-board">' +
        '<div class="mt-now" id="mt-now"></div>' +
        '<div class="mt-next-label">다음 역은</div>' +
        '<div class="mt-next" id="mt-next"></div>' +
        '<div class="mt-hint-line" id="mt-hint-line"></div>' +
        '<input id="mt-input" class="mt-input" type="text" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="역 이름을 치고 Enter" maxlength="20" />' +
        '<div class="mt-btns">' +
          (MT.mode === 'memo' ? '<button class="btn btn-ghost" onclick="mtHint()">💡 힌트</button>' : '') +
          '<button class="btn btn-ghost" onclick="mtShowSelect()">노선 바꾸기</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  mtBuildTrack();
  mtRender();
  var inp = document.getElementById('mt-input');
  inp.addEventListener('input', mtOnInput);
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      /* 한글 조합 중에 누른 Enter도 조합이 끝난 뒤 처리 */
      setTimeout(mtSubmit, 0);
    }
  });
  setTimeout(function () { inp.focus(); }, 50);
}

function mtBuildTrack() {
  var tr = document.getElementById('mt-track');
  var html = '';
  MT.stations.forEach(function (s, i) {
    html += '<div class="mt-node" id="mt-node-' + i + '"><span class="mt-dot"></span><span class="mt-st"></span></div>';
  });
  html += '<div class="mt-train" id="mt-train">🚇</div>';
  tr.innerHTML = html;
}

function mtRender() {
  var n = MT.stations.length;
  for (var i = 0; i < n; i++) {
    var node = document.getElementById('mt-node-' + i);
    if (!node) continue;
    node.className = 'mt-node' + (i < MT.idx ? ' past' : (i === MT.idx ? ' cur' : ''));
    var hide = MT.mode === 'memo' && i >= MT.idx && !MT.done;
    node.querySelector('.mt-st').textContent = hide ? '?' : MT.stations[i];
  }
  var cur = Math.min(MT.idx, n - 1);
  var at = document.getElementById('mt-node-' + Math.max(0, MT.done ? n - 1 : MT.idx - 1));
  var train = document.getElementById('mt-train');
  if (at && train) train.style.left = (at.offsetLeft + at.offsetWidth / 2) + 'px';
  var route = document.getElementById('mt-route');
  var target = document.getElementById('mt-node-' + cur);
  if (route && target) {
    var want = target.offsetLeft - route.clientWidth / 2 + target.offsetWidth / 2;
    try { route.scrollTo({ left: Math.max(0, want), behavior: 'smooth' }); } catch (e) { route.scrollLeft = want; }
  }
  document.getElementById('mt-left').textContent = MT.done ? '도착!' : ('남은 역 ' + (n - MT.idx));
  document.getElementById('mt-now').textContent = MT.done ? '' : ('지금 역: ' + MT.stations[MT.idx - 1]);
  var next = document.getElementById('mt-next');
  var hl = document.getElementById('mt-hint-line');
  if (MT.done) { next.textContent = ''; hl.textContent = ''; return; }
  var name = MT.stations[MT.idx];
  if (MT.mode === 'memo' && MT.hint < 2) {
    next.textContent = '? '.repeat(name.length).trim();
    next.classList.add('hidden');
    hl.textContent = MT.hint === 1 ? '초성: ' + mtChosung(name) : '';
  } else {
    next.textContent = name;
    next.classList.remove('hidden');
    hl.textContent = '';
  }
}

function mtTick() {
  if (!MT.t0) return;
  var sec = (Date.now() - MT.t0) / 1000;
  var el = document.getElementById('mt-time'); if (el) el.textContent = sec.toFixed(1);
  var c = document.getElementById('mt-cpm'); if (c) c.textContent = mtCpm();
}
function mtCpm() {
  if (!MT.t0) return 0;
  var min = Math.max(1 / 60, (Date.now() - MT.t0) / 60000);
  return Math.round(MT.good / min) || 0;
}
function mtAcc() { return MT.keys ? Math.max(0, Math.round((MT.keys - MT.bad) / MT.keys * 100)) : 100; }

function mtAccepts(name) { return [name].concat(MT_ALIAS[name] || []).map(mtJamo); }

function mtOnInput() {
  if (MT.done) return;
  var inp = document.getElementById('mt-input');
  if (!MT.t0) { MT.t0 = Date.now(); MT.good = 0; MT.timer = setInterval(mtTick, 100); }
  var j = mtJamo(inp.value);
  var ok = mtAccepts(MT.stations[MT.idx]).some(function (t) { return t.indexOf(j) === 0; });
  if (j.length > MT.lastJ) {
    var add = j.length - MT.lastJ;
    MT.keys += add;
    if (!ok) MT.bad += add;
  }
  MT.lastJ = j.length;
  inp.classList.toggle('bad', !ok && j.length > 0);
  document.getElementById('mt-acc').textContent = mtAcc();
}

function mtSubmit() {
  if (MT.done) return;
  var inp = document.getElementById('mt-input');
  if (!inp) return;
  var name = MT.stations[MT.idx];
  var j = mtJamo(inp.value);
  if (!j) return;
  if (mtAccepts(name).indexOf(j) !== -1) {
    MT.good = (MT.good || 0) + mtJamo(name).length + 1;   /* Enter도 한 번 */
    MT.keys += 1;
    MT.idx++; MT.wrong = 0; MT.hint = 0;
    inp.value = ''; MT.lastJ = 0; inp.classList.remove('bad');
    mtDing();
    if (MT.idx >= MT.stations.length) { mtFinish(); return; }
    mtRender();
  } else {
    MT.wrong++; MT.bad += 1; MT.keys += 1;
    inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake');
    if (MT.mode === 'memo' && MT.wrong >= 2 && MT.hint < 1) { MT.hint = 1; MT.hints++; }
    if (MT.mode === 'memo' && MT.wrong >= 4 && MT.hint < 2) { MT.hint = 2; MT.hints++; }
    inp.select();
    mtRender();
  }
  document.getElementById('mt-acc').textContent = mtAcc();
}

function mtHint() {
  if (MT.done || MT.hint >= 2) return;
  MT.hint++; MT.hints++;
  mtRender();
  var inp = document.getElementById('mt-input'); if (inp) inp.focus();
}

var MT_AC = null;
function mtDing() {
  try {
    MT_AC = MT_AC || new (window.AudioContext || window.webkitAudioContext)();
    var t = MT_AC.currentTime;
    [880, 1320].forEach(function (f, i) {
      var o = MT_AC.createOscillator(), g = MT_AC.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.07 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.25);
      o.connect(g); g.connect(MT_AC.destination); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.3);
    });
  } catch (e) {}
}

function mtFinish() {
  MT.done = true;
  clearInterval(MT.timer); MT.timer = null;
  var sec = (Date.now() - MT.t0) / 1000;
  var cpm = mtCpm(), acc = mtAcc();
  mtRender();
  var L = MT.line;
  var best = mtLoadBest(L.id, MT.mode);
  var isBest = !best || cpm > best.cpm;
  if (isBest) mtSaveBest(L.id, MT.mode, { cpm: cpm, acc: acc, sec: Math.round(sec * 10) / 10 });
  /* 분필: 역 수만큼(외워 치기는 2배) × 정확도, 힌트 쓴 만큼 조금 빼요 */
  var count = MT.stations.length - 1;
  var coin = Math.round(count * (MT.mode === 'memo' ? 1 : 0.5) * (acc / 100)) - MT.hints;
  if (playMode === 'solo' && typeof soloCoin === 'function') soloCoin(Math.max(1, coin), L.name + ' 운행 완료');
  var board = document.querySelector('#mt-root .mt-board');
  board.innerHTML =
    '<div class="mt-result">' +
      '<div class="mt-res-title">🚉 종착역 도착!</div>' +
      '<div class="mt-res-sub">' + L.name + ' · ' + (MT.mode === 'memo' ? '외워 치기' : '보고 치기') + ' · ' + count + '역</div>' +
      '<div class="mt-res-grid">' +
        '<div><small>타수</small><b>' + cpm + '</b></div>' +
        '<div><small>정확도</small><b>' + acc + '%</b></div>' +
        '<div><small>시간</small><b>' + sec.toFixed(1) + '초</b></div>' +
      '</div>' +
      '<div class="mt-res-best">' + (isBest ? '🎉 새 최고 기록!' : '👑 최고 ' + best.cpm + '타') + (MT.hints ? ' · 💡 힌트 ' + MT.hints + '번' : '') + '</div>' +
      '<div class="mt-btns">' +
        '<button class="btn btn-primary" onclick="mtStart(\'' + L.id + '\')">다시 운행</button>' +
        '<button class="btn btn-ghost" onclick="mtShowSelect()">노선 바꾸기</button>' +
      '</div>' +
    '</div>';
}
