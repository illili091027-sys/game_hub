/* ---------------- 빙고 대작전 (온라인, 2~10명) ----------------
   1) 채우기: 주제에 맞는 단어(또는 숫자)로 내 4×4 빙고판을 겹치지 않게 채워요.
      "자동 채우기"를 누르면 주제에 맞는 단어로 빈칸을 알아서 채워줘요.
   2) 부르기: 차례대로 내 판에 있는 단어 하나를 눌러서 불러요. 누가 부르든 그 단어가
      내 판에 있으면 자동으로 동그라미! (띄어쓰기/대소문자는 무시하고 비교)
   3) 가로·세로·대각선 3줄을 먼저 완성하면 빙고! (동시에 완성하면 공동 우승)
   진행 상태 roomKey('bingo')는 방장 + 지금 차례인 사람만 쓰고, 각자 판은 roomKey('bg_'+id)에 따로 저장. */
var BG_MIN = 2, BG_MAX = 10, BG_GOAL = 3;
var BG_N = 4, BG_CELLS = 16;
var BG_FILL_SECONDS = 240, BG_TURN_SECONDS = 40;
var BG_TOPICS = ['숫자 (1~50)', '과일', '동물', '나라 이름', '음식', '직업', '과자·간식', '탈것', '운동·스포츠', '가수·아이돌', '게임 이름', '학교에 있는 것', '색깔 이름', '채소', '바다에 사는 것'];
/* 주제별 자동 채우기 단어장 (각 30개 이상) */
var BG_WORDS = {
  '과일': '사과 배 포도 딸기 수박 참외 복숭아 자두 귤 오렌지 레몬 라임 바나나 파인애플 망고 키위 체리 블루베리 감 곶감 석류 무화과 멜론 코코넛 두리안 리치 용과 아보카도 자몽 살구 매실 대추 산딸기 한라봉',
  '동물': '사자 호랑이 코끼리 기린 얼룩말 하마 코뿔소 원숭이 고릴라 판다 곰 여우 늑대 사슴 토끼 다람쥐 고양이 강아지 말 소 돼지 양 염소 닭 오리 펭귄 캥거루 코알라 낙타 수달 너구리 고슴도치 거북 악어 뱀',
  '나라 이름': '한국 일본 중국 미국 캐나다 멕시코 브라질 아르헨티나 영국 프랑스 독일 이탈리아 스페인 포르투갈 네덜란드 스위스 스웨덴 노르웨이 핀란드 러시아 인도 태국 베트남 필리핀 인도네시아 호주 뉴질랜드 이집트 케냐 남아공 튀르키예 그리스 몽골 칠레 페루',
  '음식': '김치찌개 된장찌개 불고기 비빔밥 떡볶이 김밥 라면 짜장면 짬뽕 탕수육 피자 햄버거 치킨 스테이크 파스타 초밥 우동 돈가스 카레 삼겹살 냉면 칼국수 만두 순대 갈비 잡채 볶음밥 오므라이스 샌드위치 타코 쌀국수 마라탕 부대찌개 감자탕',
  '직업': '의사 간호사 선생님 경찰관 소방관 요리사 미용사 가수 배우 작가 화가 기자 변호사 판사 군인 비행기조종사 승무원 운전기사 프로그래머 디자이너 농부 어부 과학자 우주비행사 건축가 약사 수의사 운동선수 유튜버 사진작가 은행원 회계사 통역사 택배기사',
  '과자·간식': '새우깡 감자칩 초코파이 꼬깔콘 빼빼로 포카칩 홈런볼 오징어땅콩 고래밥 칸쵸 맛동산 바나나킥 꿀꽈배기 썬칩 다이제 쿠크다스 마가렛트 몽쉘 오예스 젤리 사탕 초콜릿 아이스크림 붕어빵 호떡 와플 마카롱 쿠키 도넛 츄러스 팝콘 핫도그 떡꼬치 솜사탕',
  '탈것': '자동차 버스 택시 기차 지하철 비행기 헬리콥터 배 요트 잠수함 자전거 오토바이 킥보드 스케이트보드 트럭 구급차 소방차 경찰차 열기구 로켓 우주선 케이블카 모노레일 트랙터 포크레인 레미콘 마차 썰매 카누 보트 유모차 휠체어 전동휠 크루즈',
  '운동·스포츠': '축구 농구 야구 배구 탁구 테니스 배드민턴 수영 육상 마라톤 체조 태권도 유도 검도 복싱 레슬링 펜싱 양궁 사격 골프 볼링 스키 스노보드 스케이트 컬링 아이스하키 핸드볼 럭비 클라이밍 승마 요트 서핑 줄넘기 피구',
  '가수·아이돌': '아이유 방탄소년단 블랙핑크 뉴진스 아이브 르세라핌 에스파 세븐틴 트와이스 엔시티 스트레이키즈 투모로우바이투게더 엔하이픈 있지 레드벨벳 빅뱅 소녀시대 엑소 샤이니 마마무 오마이걸 여자아이들 임영웅 싸이 악뮤 태연 지코 볼빨간사춘기 데이식스 잔나비 에픽하이 거미 성시경 박효신',
  '게임 이름': '마인크래프트 로블록스 포켓몬 마리오 젤다 동물의숲 리그오브레전드 배틀그라운드 오버워치 피파 카트라이더 메이플스토리 쿠키런 브롤스타즈 클래시로얄 테트리스 스타크래프트 서든어택 피파온라인 발로란트 원신 어몽어스 폴가이즈 스플래툰 커비 소닉 팩맨 슈퍼마리오카트 스트리트파이터 철권 모여봐요 피크민 젤리크러시 애니팡 테일즈런너',
  '학교에 있는 것': '칠판 분필 책상 의자 사물함 교과서 공책 연필 지우개 필통 실내화 급식실 운동장 체육관 도서관 보건실 교무실 과학실 음악실 미술실 컴퓨터실 방송실 화장실 복도 계단 창문 시계 태극기 게시판 정수기 선풍기 에어컨 청소함 빗자루',
  '색깔 이름': '빨강 주황 노랑 초록 파랑 남색 보라 분홍 하양 검정 회색 갈색 하늘색 연두색 민트색 베이지 금색 은색 살구색 자주색 청록색 올리브색 와인색 라벤더 코랄 네이비 카키 버건디 크림색 연보라 진초록 진파랑 연분홍 형광색 아이보리',
  '채소': '배추 무 당근 감자 고구마 양파 마늘 대파 쪽파 오이 호박 애호박 가지 토마토 파프리카 피망 고추 시금치 상추 깻잎 양배추 브로콜리 콜리플라워 버섯 콩나물 숙주 연근 우엉 생강 셀러리 아스파라거스 비트 옥수수 완두콩 부추',
  '바다에 사는 것': '고래 상어 돌고래 문어 오징어 낙지 꽃게 새우 랍스터 해파리 불가사리 성게 조개 굴 전복 소라 해마 거북 물개 바다표범 바다사자 펭귄 가오리 참치 고등어 연어 광어 갈치 멸치 복어 니모 산호 미역 다시마 해삼'
};

var BG_POLL = null;
var BG_STATE = null;
var BG_MY = null;          // 내 판 {gameId, cells, ready, lines}
var BG_LAST_LINES = -1;

function bgKey() { return roomKey('bingo'); }
function bgMyKey() { return roomKey('bg_' + myPlayerId); }
function bgNorm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }
function stopBingoGame() { clearInterval(BG_POLL); BG_POLL = null; }

function startBingoGame() {
  stopBingoGame();
  BG_STATE = null; BG_MY = null; BG_LAST_LINES = -1;
  document.querySelectorAll('#bingo .bg-phase').forEach(function (el) { el.style.display = 'none'; });
  var n = (roomPlayersList || []).length;
  if (n < BG_MIN || n > BG_MAX) {
    document.getElementById('bg-error').style.display = '';
    document.getElementById('bg-error').textContent = '빙고 대작전은 ' + BG_MIN + '~' + BG_MAX + '명이 필요해요. 지금 ' + n + '명이에요.';
    return;
  }
  bgBuildFillGrid();
  var starter = myPlayerId === roomHostId ? bgHostInit() : Promise.resolve();
  starter.then(function () { bgPoll(); BG_POLL = setInterval(bgPoll, 1000); });
}

function bgHostInit(topic) {
  var order = shuffleArray((roomPlayersList || []).map(function (p) { return p.id; }));
  var names = {};
  (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; });
  var st = { gameId: Date.now(), order: order, names: names, topic: topic || BG_TOPICS[Math.floor(Math.random() * BG_TOPICS.length)], phase: 'fill', deadline: Date.now() + BG_FILL_SECONDS * 1000, turnIdx: 0, calls: [], winners: [] };
  return DBset(bgKey(), st);
}
function bgHostRestart() { if (myPlayerId === roomHostId) bgHostInit().then(bgPoll); }
function bgHostChangeTopic() {
  if (myPlayerId !== roomHostId) return;
  DBget(bgKey()).then(function (st) {
    if (!st || st.phase !== 'fill') return;
    var others = BG_TOPICS.filter(function (t) { return t !== st.topic; });
    st.topic = others[Math.floor(Math.random() * others.length)];
    st.deadline = Date.now() + BG_FILL_SECONDS * 1000;
    DBset(bgKey(), st).then(bgPoll);
  });
}

function bgPoll() {
  DBget(bgKey()).then(function (st) {
    if (!st || !st.order) return;
    if (!BG_STATE || BG_STATE.gameId !== st.gameId) {
      BG_MY = { gameId: st.gameId, cells: [], ready: false, lines: 0 };
      BG_LAST_LINES = -1;
      document.querySelectorAll('#bg-fill-grid input').forEach(function (i) { i.value = ''; i.disabled = false; });
    }
    var topicChanged = BG_STATE && BG_STATE.gameId === st.gameId && BG_STATE.topic !== st.topic;
    BG_STATE = st;
    if (topicChanged && BG_MY && !BG_MY.ready) document.querySelectorAll('#bg-fill-grid input').forEach(function (i) { i.value = ''; });
    bgRender(st);
    if (myPlayerId === roomHostId) bgHostCheck(st);
  });
}

function bgHostCheck(st) {
  if (st.phase === 'fill') {
    DBgetPrefix('bg_', st.order).then(function (all) {
      var ready = st.order.filter(function (pid) { return all[pid] && all[pid].gameId === st.gameId && all[pid].ready; }).length;
      document.getElementById('bg-ready-count').textContent = '완료 ' + ready + '/' + st.order.length;
      if (ready < st.order.length && Date.now() < st.deadline + 3000) return;
      DBget(bgKey()).then(function (cur) {
        if (!cur || cur.gameId !== st.gameId || cur.phase !== 'fill') return;
        cur.phase = 'play'; cur.turnIdx = 0; cur.deadline = Date.now() + BG_TURN_SECONDS * 1000;
        DBset(bgKey(), cur).then(bgPoll);
      });
    });
  } else if (st.phase === 'play') {
    DBgetPrefix('bg_', st.order).then(function (all) {
      var winners = st.order.filter(function (pid) { var d = all[pid]; return d && d.gameId === st.gameId && d.callCount === st.calls.length && (d.lines || 0) >= BG_GOAL; });
      if (winners.length) {
        DBget(bgKey()).then(function (cur) {
          if (!cur || cur.gameId !== st.gameId || cur.phase !== 'play') return;
          cur.phase = 'end'; cur.winners = winners; cur.deadline = null;
          DBset(bgKey(), cur).then(bgPoll);
        });
        return;
      }
      if (Date.now() > st.deadline + 500) {
        var idx = st.turnIdx;
        DBget(bgKey()).then(function (cur) {
          if (!cur || cur.gameId !== st.gameId || cur.phase !== 'play' || cur.turnIdx !== idx) return;
          cur.turnIdx++; cur.deadline = Date.now() + BG_TURN_SECONDS * 1000;
          cur.skipped = (cur.skipped || 0) + 1;
          DBset(bgKey(), cur).then(bgPoll);
        });
      }
    });
  }
}

/* ---- 채우기 ---- */
function bgBuildFillGrid() {
  var g = document.getElementById('bg-fill-grid');
  if (g.childElementCount) return;
  var html = '';
  for (var i = 0; i < BG_CELLS; i++) html += '<input type="text" maxlength="10" data-i="' + i + '" autocomplete="off" />';
  g.innerHTML = html;
  g.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    var i = +e.target.getAttribute('data-i');
    var next = g.querySelector('input[data-i="' + ((i + 1) % BG_CELLS) + '"]');
    if (next) next.focus();
  });
}

/* 자동 채우기: 이미 적은 칸은 그대로 두고 빈칸만 주제에 맞는 단어로 채워요 (겹치지 않게) */
function bgRandomFill() {
  if (!BG_STATE) return;
  var pool;
  if (BG_STATE.topic.indexOf('숫자') === 0) pool = Array.from({ length: 50 }, function (_, i) { return String(i + 1); });
  else pool = (BG_WORDS[BG_STATE.topic] || '').split(' ').filter(Boolean);
  var inputs = Array.prototype.slice.call(document.querySelectorAll('#bg-fill-grid input'));
  var used = {};
  inputs.forEach(function (inp) { if (inp.value.trim()) used[bgNorm(inp.value)] = 1; });
  var cand = shuffleArray(pool.filter(function (w) { return !used[bgNorm(w)]; }));
  inputs.forEach(function (inp) { if (!inp.value.trim() && cand.length) inp.value = cand.pop(); });
  document.getElementById('bg-fill-err').textContent = '';
}

function bgSubmitBoard(force) {
  var st = BG_STATE;
  if (!st || st.phase !== 'fill') return;
  if (force) bgRandomFill(); // 시간이 다 되면 빈칸은 자동으로 채워서 제출
  var vals = Array.prototype.map.call(document.querySelectorAll('#bg-fill-grid input'), function (i) { return i.value.trim(); });
  var err = document.getElementById('bg-fill-err');
  if (!force) {
    var empty = vals.filter(function (v) { return !v; }).length;
    if (empty) { err.textContent = '빈칸이 ' + empty + '개 있어요!'; return; }
    var seen = {}, dup = null;
    vals.forEach(function (v) { var k = bgNorm(v); if (seen[k]) dup = v; seen[k] = 1; });
    if (dup) { err.textContent = '"' + dup + '"이(가) 두 번 들어갔어요. 겹치지 않게 써주세요!'; return; }
  }
  err.textContent = '';
  vals = vals.map(function (v, i) { return v || ('?' + (i + 1)); });
  BG_MY = { gameId: st.gameId, cells: vals, ready: true, lines: 0, callCount: 0 };
  document.querySelectorAll('#bg-fill-grid input').forEach(function (i) { i.disabled = true; });
  DBset(bgMyKey(), BG_MY);
  bgRender(st);
}

function bgUnready() {
  if (!BG_MY || !BG_STATE || BG_STATE.phase !== 'fill') return;
  BG_MY.ready = false;
  document.querySelectorAll('#bg-fill-grid input').forEach(function (i) { i.disabled = false; });
  DBset(bgMyKey(), BG_MY);
  bgRender(BG_STATE);
}

/* ---- 부르기 ---- */
function bgMarkedSet(st) {
  var s = {};
  (st.calls || []).forEach(function (c) { s[bgNorm(c.word)] = c; });
  return s;
}
function bgCountLines(marks) {
  var N = BG_N, lines = 0, r, c;
  for (r = 0; r < N; r++) { var ok = true; for (c = 0; c < N; c++) if (!marks[r * N + c]) ok = false; if (ok) lines++; }
  for (c = 0; c < N; c++) { var ok2 = true; for (r = 0; r < N; r++) if (!marks[r * N + c]) ok2 = false; if (ok2) lines++; }
  var d1 = true, d2 = true;
  for (var i = 0; i < N; i++) { if (!marks[i * (N + 1)]) d1 = false; if (!marks[i * N + (N - 1 - i)]) d2 = false; }
  return lines + (d1 ? 1 : 0) + (d2 ? 1 : 0);
}

function bgCall(i) {
  var st = BG_STATE;
  if (!st || st.phase !== 'play' || !BG_MY || !BG_MY.cells.length) return;
  if (st.order[st.turnIdx % st.order.length] !== myPlayerId) return;
  var word = BG_MY.cells[i];
  if (bgMarkedSet(st)[bgNorm(word)]) return;
  DBget(bgKey()).then(function (cur) {
    if (!cur || cur.gameId !== st.gameId || cur.phase !== 'play' || cur.turnIdx !== st.turnIdx) return;
    cur.calls = (cur.calls || []).concat([{ word: word, by: myPlayerId }]);
    cur.turnIdx++;
    cur.deadline = Date.now() + BG_TURN_SECONDS * 1000;
    DBset(bgKey(), cur).then(bgPoll);
  });
}

function bgRender(st) {
  if (!document.getElementById('bingo').classList.contains('active')) return;
  document.querySelectorAll('#bingo .bg-phase').forEach(function (el) { el.style.display = 'none'; });
  var isHost = myPlayerId === roomHostId;
  var remain = st.deadline ? Math.max(0, Math.ceil((st.deadline - Date.now()) / 1000)) : 0;
  document.getElementById('bg-topic').textContent = st.topic;
  if (st.phase === 'fill') {
    document.getElementById('bg-fill').style.display = '';
    document.getElementById('bg-fill-timer').textContent = '⏱ ' + remain + '초';
    var ready = BG_MY && BG_MY.ready;
    document.getElementById('bg-random-btn').style.display = !ready ? '' : 'none';
    document.getElementById('bg-submit-btn').style.display = ready ? 'none' : '';
    document.getElementById('bg-unready-btn').style.display = ready ? '' : 'none';
    document.getElementById('bg-topic-btn').style.display = isHost && !ready ? '' : 'none';
    document.getElementById('bg-fill-msg').textContent = ready ? '✅ 완료! 다른 친구들을 기다리는 중…' : '주제에 맞는 단어로 16칸을 겹치지 않게 채워요 (🎲 자동 채우기도 있어요)';
    if (remain <= 1 && !ready) bgSubmitBoard(true);
    if (!isHost) document.getElementById('bg-ready-count').textContent = '';
    return;
  }
  // 내 판 + 체크
  var marks = bgMarkedSet(st);
  var myMarks = (BG_MY && BG_MY.cells.length) ? BG_MY.cells.map(function (w) { return !!marks[bgNorm(w)]; }) : [];
  var lines = myMarks.length ? bgCountLines(myMarks) : 0;
  if (BG_MY && BG_MY.cells.length && (BG_MY.lines !== lines || BG_MY.callCount !== st.calls.length)) {
    BG_MY.lines = lines; BG_MY.callCount = st.calls.length;
    DBset(bgMyKey(), BG_MY);
  }
  if (lines > BG_LAST_LINES && BG_LAST_LINES >= 0 && lines > 0) {
    var pop = document.getElementById('bg-pop');
    pop.textContent = lines >= BG_GOAL ? '🎉 빙고!!' : (lines + '줄 완성!');
    pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
  }
  BG_LAST_LINES = lines;
  if (st.phase === 'play' || st.phase === 'end') {
    document.getElementById('bg-play').style.display = '';
    var turnPid = st.order[st.turnIdx % st.order.length];
    var myTurn = st.phase === 'play' && turnPid === myPlayerId;
    document.getElementById('bg-turn').innerHTML = st.phase === 'end' ? '' :
      (myTurn ? '👉 <b>내 차례!</b> 내 판에서 부를 단어를 눌러요 <span class="bg-t">⏱ ' + remain + '초</span>' : '⏳ <b>' + esc(st.names[turnPid] || '?') + '</b>님이 고르는 중… <span class="bg-t">⏱ ' + remain + '초</span>');
    var lastCall = st.calls[st.calls.length - 1];
    document.getElementById('bg-last-call').innerHTML = lastCall ? ('방금 부른 단어: <b>' + esc(lastCall.word) + '</b> <small>(' + esc(st.names[lastCall.by] || '?') + ')</small>') : '아직 부른 단어가 없어요';
    document.getElementById('bg-lines').textContent = '내 빙고 ' + lines + ' / ' + BG_GOAL + '줄';
    var html = '';
    (BG_MY && BG_MY.cells.length ? BG_MY.cells : []).forEach(function (w, i) {
      var m = myMarks[i];
      var isLast = lastCall && bgNorm(lastCall.word) === bgNorm(w);
      html += '<button class="bg-cell' + (m ? ' marked' : '') + (isLast ? ' last' : '') + (myTurn && !m ? ' callable' : '') + '" onclick="bgCall(' + i + ')">' + esc(w) + '</button>';
    });
    document.getElementById('bg-board').innerHTML = html || '<div class="lobby-hint">빙고판을 못 채워서 구경 중이에요</div>';
    document.getElementById('bg-calls').innerHTML = st.calls.slice().reverse().map(function (c) { return '<span class="bg-call-chip">' + esc(c.word) + '</span>'; }).join('');
    if (st.phase === 'end') {
      document.getElementById('bg-end').style.display = '';
      document.getElementById('bg-end-banner').textContent = '🏆 ' + st.winners.map(function (p) { return st.names[p]; }).join(', ') + ' 빙고 우승!';
      typeof celebrateWin === 'function' && celebrateWin('bingo:' + st.gameId, st.winners.map(function (p) { return st.names[p]; }), '빙고 대작전');
      document.getElementById('bg-restart-btn').style.display = isHost ? '' : 'none';
    }
  }
}
