/* ---------------- 양세찬 게임 (온라인, 2~8명) ----------------
   모두의 이마에 단어 포스트잇이 붙어 있어요. 친구들 단어는 다 보이는데 내 단어만 안 보여요!
   돌아가면서 질문자가 "예/아니오"로 답할 수 있는 질문을 하고, 나머지는 답해줘요.
   자기 차례에 질문 대신 '정답 외치기'를 한 번 할 수 있어요. 맞히면 성공, 틀리면 다음 사람 차례.
   - 방 공용 상태 roomKey('yang'): 방장만 씀 (단어, 차례, 채팅 기록, 맞힌 순서)
   - 내 메시지 roomKey('yg_'+내id): 나만 씀 → 방장이 모아서 채팅 기록에 넣어요 */
var YG_MIN = 2, YG_MAX = 8, YG_TURN_S = 45, YG_WRITE_S = 50, YG_MAX_ROUNDS = 10;
var YG_CATS = {
  animal: { name: '🐶 동물', words: ['강아지', '고양이', '토끼', '코끼리', '기린', '사자', '호랑이', '펭귄', '돼지', '거북이', '상어', '고래', '문어', '뱀', '개구리', '나비', '달팽이', '오리', '닭', '부엉이', '원숭이', '판다', '곰', '말', '소', '양', '하마', '악어', '캥거루', '다람쥐', '햄스터', '앵무새', '낙타', '얼룩말', '공작새', '박쥐', '해파리', '오징어', '거미', '두더지'] },
  food: { name: '🍕 음식', words: ['사과', '바나나', '수박', '딸기', '포도', '피자', '햄버거', '라면', '김밥', '떡볶이', '치킨', '아이스크림', '케이크', '초콜릿', '짜장면', '짬뽕', '탕수육', '삼겹살', '비빔밥', '김치찌개', '된장찌개', '불고기', '만두', '순대', '어묵', '붕어빵', '호떡', '팥빙수', '마라탕', '탕후루', '도넛', '샌드위치', '스파게티', '돈가스', '우동', '초밥', '컵라면', '감자튀김', '핫도그', '계란말이'] },
  job: { name: '👩‍⚕️ 직업', words: ['의사', '간호사', '선생님', '경찰', '소방관', '요리사', '가수', '배우', '운동선수', '유튜버', '프로게이머', '우주비행사', '과학자', '농부', '어부', '택배기사', '버스기사', '조종사', '승무원', '판사', '변호사', '기자', '화가', '사진작가', '미용사', '제빵사', '수의사', '약사', '군인', '마술사', '개그맨', '아이돌', '작가', '건축가', '프로그래머', '디자이너', '바리스타', '사육사', '탐정', '대통령'] },
  thing: { name: '✏️ 물건', words: ['연필', '지우개', '가위', '시계', '안경', '우산', '모자', '신발', '양말', '가방', '휴대폰', '컴퓨터', '텔레비전', '냉장고', '선풍기', '에어컨', '전자레인지', '세탁기', '침대', '의자', '책상', '거울', '칫솔', '치약', '수건', '베개', '이불', '열쇠', '지갑', '카메라', '헤드폰', '리모컨', '자전거', '킥보드', '풍선', '인형', '필통', '공책', '달력', '손전등'] },
  chara: { name: '🦸 캐릭터', words: ['피카츄', '뽀로로', '스폰지밥', '도라에몽', '짱구', '엘사', '미키마우스', '마리오', '해리포터', '슈렉', '토토로', '헬로키티', '둘리', '아이언맨', '스파이더맨', '배트맨', '신데렐라', '백설공주', '피노키오', '흥부', '심청이', '홍길동', '커비', '코난', '라이언', '춘식이', '치이카와', '하치와레', '산타클로스', '인어공주', '알라딘', '곰돌이 푸', '스누피', '미니언즈', '포비', '크롱', '에디', '헐크', '슈퍼맨', '원더우먼'] },
  sport: { name: '⚽ 운동·놀이', words: ['축구', '야구', '농구', '배구', '탁구', '배드민턴', '테니스', '수영', '스키', '스케이트', '태권도', '유도', '복싱', '줄넘기', '달리기', '피구', '볼링', '골프', '양궁', '체조', '숨바꼭질', '술래잡기', '공기놀이', '딱지치기', '팽이치기', '윷놀이', '오목', '바둑', '체스', '가위바위보', '무궁화 꽃이 피었습니다', '얼음땡', '닭싸움', '줄다리기', '림보', '훌라후프', '썰매', '눈싸움', '물총놀이', '보물찾기'] }
};
var YG_POLL = null, YG_HOST = null, YG_TICK = null;
var YG_STATE = null;
var YG_MY = { gameId: null, msgs: [], s: 0 };
var YG_GUESS_MODE = false;
var YG_HOST_BUSY = false;

function ygKey() { return roomKey('yang'); }
function ygMyKey() { return roomKey('yg_' + myPlayerId); }
function ygNorm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }
function ygIsHost() { return myPlayerId === roomHostId; }

function stopYangGame() {
  clearInterval(YG_POLL); YG_POLL = null;
  clearInterval(YG_HOST); YG_HOST = null;
  clearInterval(YG_TICK); YG_TICK = null;
}

function startYangGame() {
  stopYangGame();
  YG_STATE = null; YG_MY = { gameId: null, msgs: [], s: 0 }; YG_GUESS_MODE = false;
  document.getElementById('yg-feed').innerHTML = '';
  var n = (roomPlayersList || []).length, err = document.getElementById('yg-error');
  if (n < YG_MIN || n > YG_MAX) {
    err.style.display = ''; err.textContent = '양세찬 게임은 ' + YG_MIN + '~' + YG_MAX + '명이 필요해요. 지금 ' + n + '명이에요.';
    document.getElementById('yg-main').style.display = 'none';
    return;
  }
  err.style.display = 'none';
  document.getElementById('yg-main').style.display = '';
  var starter = ygIsHost() ? ygHostInit() : Promise.resolve();
  starter.then(function () {
    ygPoll();
    YG_POLL = setInterval(ygPoll, 500);
    YG_TICK = setInterval(ygRenderTimer, 200);
    if (ygIsHost()) YG_HOST = setInterval(ygHostTick, 500);
  });
}

/* ---- 방장 ---- */
function ygHostInit() {
  var order = shuffleArray((roomPlayersList || []).map(function (p) { return p.id; }));
  var names = {};
  (roomPlayersList || []).forEach(function (p) { names[p.id] = p.name; });
  var st = { gameId: Date.now(), order: order, names: names, phase: 'setup', words: {}, feed: [], seen: {}, solved: {}, round: 1, turn: 0 };
  return DBset(ygKey(), st).then(function () { YG_STATE = st; ygRender(); });
}
function ygHostRestart() { if (ygIsHost()) ygHostInit(); }

/* 방장이 주제 고르기 */
function ygPickCat(cat) {
  if (!ygIsHost() || !YG_STATE || YG_STATE.phase !== 'setup') return;
  var st = YG_STATE;
  st.cat = cat;
  if (cat === 'custom') {
    /* 서로 정해주기: 각자 '내 다음 사람' 단어를 정해요 (그 사람만 못 봐요) */
    st.phase = 'write';
    st.writeFor = {};
    st.order.forEach(function (pid, i) { st.writeFor[pid] = st.order[(i + 1) % st.order.length]; });
    st.deadline = Date.now() + YG_WRITE_S * 1000;
  } else {
    var pool = cat === 'mix' ? Object.keys(YG_CATS).reduce(function (a, k) { return a.concat(YG_CATS[k].words); }, []) : YG_CATS[cat].words;
    var ws = shuffleArray(pool.slice());
    st.order.forEach(function (pid, i) { st.words[pid] = ws[i]; });
    ygHostBeginPlay(st);
  }
  DBset(ygKey(), st).then(function () { ygRender(); });
}
function ygHostBeginPlay(st) {
  st.phase = 'play';
  st.turn = 0; st.round = 1;
  st.feed.push({ k: 's', v: '게임 시작! 친구들 단어는 보이고, 내 단어만 안 보여요 🙈' });
  ygHostStartTurn(st);
}
function ygHostStartTurn(st) {
  st.turnEnd = Date.now() + YG_TURN_S * 1000;
  st.feed.push({ k: 's', v: (st.names[st.order[st.turn]] || '?') + '님 차례! 예/아니오로 답할 수 있는 질문을 해요' });
}
function ygActive(st) {
  var here = {};
  (roomPlayersList || []).forEach(function (p) { here[p.id] = 1; });
  return st.order.filter(function (pid) { return here[pid] && !st.solved[pid]; });
}
/* 다음 사람 차례로 (맞힌 사람·나간 사람은 건너뛰어요) */
function ygHostNextTurn(st) {
  var left = ygActive(st);
  var n = st.order.length;
  if (!left.length || (left.length === 1 && n >= 3) || st.round > YG_MAX_ROUNDS) return ygHostEnd(st);
  for (var i = 1; i <= n; i++) {
    var idx = (st.turn + i) % n;
    if (idx <= st.turn) { /* 한 바퀴 돌았어요 */ }
    if (left.indexOf(st.order[idx]) >= 0) {
      if (idx <= st.turn) st.round++;
      st.turn = idx;
      break;
    }
  }
  if (st.round > YG_MAX_ROUNDS) return ygHostEnd(st);
  ygHostStartTurn(st);
}
function ygHostEnd(st) {
  st.phase = 'end';
  st.feed.push({ k: 's', v: '게임 끝! 모두의 단어를 공개해요 🎉' });
}
/* 질문자 단어(아직 못 맞힌 사람 단어)가 채팅에 그대로 나오면 가려요 (직접 정답 말하기 금지) */
function ygMask(st, text, from) {
  var t = String(text);
  st.order.forEach(function (pid) {
    var w = st.words[pid];
    if (!w || st.solved[pid] || pid === from) return;
    var re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split('').join('\\s*'), 'gi');
    t = t.replace(re, function (m) { return '🤐'.repeat(Math.min(4, m.replace(/\s/g, '').length)); });
  });
  return t;
}
function ygHostTick() {
  if (!ygIsHost() || YG_HOST_BUSY || !YG_STATE) return;
  if (!document.getElementById('yang').classList.contains('active')) return;
  YG_HOST_BUSY = true;
  var st0 = YG_STATE;
  DBgetPrefix('yg_', st0.order).then(function (all) {
    YG_HOST_BUSY = false;
    var st = YG_STATE;
    if (!st || st.gameId !== st0.gameId || st.phase === 'setup') return;
    var changed = false, now = Date.now();
    /* 서로 정해주기: 단어 모으기 */
    if (st.phase === 'write') {
      st.order.forEach(function (pid) {
        var d = all[pid];
        if (d && d.gameId === st.gameId && d.write && d.write.v) {
          var target = st.writeFor[pid];
          if (st.words[target] !== d.write.v) { st.words[target] = d.write.v; changed = true; }
        }
      });
      var need = st.order.filter(function (pid) { return !st.words[pid]; });
      if (!need.length || now > st.deadline) {
        /* 시간 안에 못 정한 건 랜덤으로 */
        var pool = shuffleArray(Object.keys(YG_CATS).reduce(function (a, k) { return a.concat(YG_CATS[k].words); }, []));
        need.forEach(function (pid, i) { st.words[pid] = pool[i]; });
        ygHostBeginPlay(st); changed = true;
      }
      if (changed) DBset(ygKey(), st).then(ygRender);
      return;
    }
    /* 채팅/정답 외치기 처리 (게임 끝난 뒤에도 수다는 계속) */
    var q = st.order[st.turn];
    st.order.forEach(function (pid) {
      var d = all[pid];
      if (!d || d.gameId !== st.gameId || !d.msgs) return;
      var seen = st.seen[pid] || 0;
      d.msgs.forEach(function (m) {
        if (m.s <= seen) return;
        seen = m.s;
        if (m.k === 'chat') {
          st.feed.push({ pid: pid, k: st.phase === 'play' && pid === q ? 'q' : 'a', v: st.phase === 'end' ? String(m.v).slice(0, 80) : ygMask(st, String(m.v).slice(0, 80), pid) });
          changed = true;
        } else if (m.k === 'guess' && st.phase === 'play' && pid === q && !st.solved[pid]) {
          var ok = ygNorm(m.v) === ygNorm(st.words[pid]);
          st.feed.push({ pid: pid, k: 'g', v: String(m.v).slice(0, 30), ok: ok ? 1 : 0 });
          if (ok) {
            var rank = Object.keys(st.solved).length + 1;
            st.solved[pid] = { round: st.round, rank: rank };
          }
          ygHostNextTurn(st); q = st.order[st.turn];
          changed = true;
        } else if (m.k === 'next' && st.phase === 'play' && pid === q) {
          ygHostNextTurn(st); q = st.order[st.turn];
          changed = true;
        }
      });
      st.seen[pid] = seen;
    });
    if (st.phase === 'play') {
      var here = {};
      (roomPlayersList || []).forEach(function (p) { here[p.id] = 1; });
      if (now > st.turnEnd || !here[q] || st.solved[q]) {
        if (now > st.turnEnd && here[q]) st.feed.push({ k: 's', v: '⏰ 시간 끝!' });
        ygHostNextTurn(st); changed = true;
      }
    }
    if (st.feed.length > 120) st.feed = st.feed.slice(-120);
    if (changed) DBset(ygKey(), st).then(ygRender);
  }, function () { YG_HOST_BUSY = false; });
}

/* ---- 모두 ---- */
function ygPoll() {
  if (ygIsHost()) { ygRender(); return; }
  DBget(ygKey()).then(function (st) {
    if (!st || !st.order) return;
    var prev = YG_STATE;
    if (prev && prev.gameId !== st.gameId) { YG_MY = { gameId: null, msgs: [], s: 0 }; document.getElementById('yg-feed').innerHTML = ''; }
    if (prev && prev.gameId === st.gameId && prev.turn !== st.turn && st.order[st.turn] === myPlayerId && typeof mmSound === 'function') mmSound('plop');
    YG_STATE = st;
    ygRender();
  });
}
function ygSend(kind, v) {
  var st = YG_STATE;
  if (!st) return;
  if (YG_MY.gameId !== st.gameId) YG_MY = { gameId: st.gameId, msgs: [], s: 0 };
  YG_MY.s++;
  YG_MY.msgs.push({ s: YG_MY.s, k: kind, v: v });
  if (YG_MY.msgs.length > 30) YG_MY.msgs.shift();
  DBset(ygMyKey(), { gameId: st.gameId, msgs: YG_MY.msgs.slice(), write: YG_MY.write || null });
}
function ygSubmit() {
  var inp = document.getElementById('yg-input'), v = inp.value.trim();
  if (!v || !YG_STATE) return;
  inp.value = '';
  if (YG_GUESS_MODE) {
    ygSetGuessMode(false);
    ygSend('guess', v);
    return;
  }
  ygSend('chat', v);
}
function ygQuick(v) { ygSend('chat', v); }
function ygNextTurn() { ygSend('next', 1); }
function ygSetGuessMode(on) {
  YG_GUESS_MODE = !!on;
  var inp = document.getElementById('yg-input');
  inp.classList.toggle('guess', YG_GUESS_MODE);
  inp.placeholder = YG_GUESS_MODE ? '📣 내 단어는…? 정답을 외쳐요! (한 번만)' : ygPlaceholder(YG_STATE);
  document.getElementById('yg-guess-btn').classList.toggle('on', YG_GUESS_MODE);
  if (YG_GUESS_MODE) inp.focus();
}
function ygSubmitWrite() {
  var st = YG_STATE, inp = document.getElementById('yg-write-input'), v = inp.value.trim();
  if (!st || !v) return;
  YG_MY.write = { v: v.slice(0, 20) };
  if (YG_MY.gameId !== st.gameId) YG_MY = { gameId: st.gameId, msgs: [], s: 0, write: YG_MY.write };
  DBset(ygMyKey(), { gameId: st.gameId, msgs: YG_MY.msgs.slice(), write: YG_MY.write });
  document.getElementById('yg-write-msg').textContent = '✔ "' + v + '"(으)로 정했어요! 다른 친구들을 기다려요…';
}
function ygPlaceholder(st) {
  if (!st || st.phase !== 'play') return '채팅을 입력하세요';
  return st.order[st.turn] === myPlayerId ? '❓ 예/아니오로 답할 수 있는 질문을 해요!' : '💬 답변을 입력하세요';
}

/* ---- 화면 ---- */
var YG_AV_COLORS = ['#b14cf0', '#4c8cf0', '#f0a04c', '#4cc38a', '#f06c8c', '#46c4d6', '#c0ca33', '#8d6e63'];
function ygRender() {
  var st = YG_STATE;
  if (!st || !document.getElementById('yang').classList.contains('active')) return;
  var me_ = myPlayerId, isHost = ygIsHost(), q = st.order[st.turn];
  var here = {};
  (roomPlayersList || []).forEach(function (p) { here[p.id] = 1; });
  /* 위: 친구들 + 이마 포스트잇 */
  var av = st.order.map(function (pid, i) {
    var mine = pid === me_, solved = st.solved[pid], w = st.words[pid];
    var note;
    if (st.phase === 'setup' || (st.phase === 'write' && !w)) note = '<span class="yg-note empty">…</span>';
    else if (mine && !solved && st.phase !== 'end') note = '<span class="yg-note me">???</span>';
    else note = '<span class="yg-note' + (solved ? ' ok' : '') + '">' + (solved ? '✅ ' : '') + esc(w || '…') + '</span>';
    if (st.phase === 'write' && mine) note = '<span class="yg-note me">???</span>';
    var cls = (st.phase === 'play' && pid === q ? ' turn' : '') + (mine ? ' me' : '') + (here[pid] ? '' : ' gone') + (solved ? ' solved' : '');
    var nm = st.names[pid] || '?';
    return '<div class="yg-av' + cls + '">' + note + '<div class="yg-face" style="background:' + YG_AV_COLORS[i % YG_AV_COLORS.length] + '">' + esc(nm.slice(0, 1)) + '</div><div class="yg-name">' + esc(nm) + (mine ? ' (나)' : '') + '</div></div>';
  }).join('');
  var avEl = document.getElementById('yg-avatars');
  if (avEl.getAttribute('data-h') !== av) { avEl.innerHTML = av; avEl.setAttribute('data-h', av); }
  /* 가운데 정보 */
  document.getElementById('yg-round').textContent = st.phase === 'play' ? st.round : '-';
  document.getElementById('yg-count').textContent = Object.keys(here).filter(function (p) { return st.order.indexOf(p) >= 0; }).length + '/' + st.order.length;
  var info = '';
  if (st.phase === 'setup') info = isHost ? '주제를 골라주세요!' : '방장이 주제를 고르는 중…';
  else if (st.phase === 'write') info = '서로 단어를 정해주는 중… ✍️';
  else if (st.phase === 'play') info = '현재 질문자 : <b class="yg-q">' + esc(st.names[q] || '?') + '</b><br>정답어 : <b class="yg-w">' + (q === me_ ? '???' : esc(st.words[q] || '')) + '</b>';
  else info = '🎉 게임 끝!';
  var infoEl = document.getElementById('yg-info');
  if (infoEl.getAttribute('data-h') !== info) { infoEl.innerHTML = info; infoEl.setAttribute('data-h', info); }
  /* 주제 고르기 / 단어 정해주기 / 결과 */
  var setup = document.getElementById('yg-setup');
  setup.style.display = st.phase === 'setup' && isHost ? '' : 'none';
  var wr = document.getElementById('yg-write');
  wr.style.display = st.phase === 'write' ? '' : 'none';
  if (st.phase === 'write') {
    var target = st.writeFor && st.writeFor[me_];
    var t = document.getElementById('yg-write-title');
    var th = '<b>' + esc(st.names[target] || '?') + '</b>님 이마에 붙일 단어를 정해주세요! <small>(' + esc(st.names[target] || '?') + '님만 못 봐요)</small>';
    if (t.getAttribute('data-h') !== th) { t.innerHTML = th; t.setAttribute('data-h', th); document.getElementById('yg-write-msg').textContent = ''; document.getElementById('yg-write-input').value = ''; }
  }
  var res = document.getElementById('yg-result');
  if (st.phase === 'end') {
    res.style.display = '';
    if (res.getAttribute('data-g') !== String(st.gameId)) {
      res.setAttribute('data-g', st.gameId);
      var rows = st.order.slice().sort(function (a, b) { var A = st.solved[a], B = st.solved[b]; return (A ? A.rank : 99) - (B ? B.rank : 99); });
      if (st.solved[rows[0]]) typeof celebrateWin === 'function' && celebrateWin('yang:' + st.gameId, [st.names[rows[0]]], '양세찬 게임 · 「' + (st.words[rows[0]] || '') + '」 제일 먼저 맞힘');
      renderRankBoard('yg-result-rank', rows.map(function (pid) {
        var s = st.solved[pid];
        return { name: st.names[pid] || '?', isMe: pid === me_, label: '「' + esc(st.words[pid] || '') + '」 ' + (s ? s.round + '라운드에 맞힘' : '못 맞힘 😢') };
      }));
    }
    document.getElementById('yg-restart').style.display = isHost ? '' : 'none';
  } else res.style.display = 'none';
  /* 채팅 기록 */
  var feed = document.getElementById('yg-feed'), fl = st.feed || [];
  if (feed.getAttribute('data-n') !== String(fl.length) + ':' + st.gameId) {
    var stick = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 60;
    feed.innerHTML = fl.map(function (f) {
      if (f.k === 's') return '<div class="yg-m sys">' + esc(f.v) + '</div>';
      var nm = esc(st.names[f.pid] || '?'), mine = f.pid === me_;
      if (f.k === 'g') return '<div class="yg-m guess ' + (f.ok ? 'ok' : 'no') + '">📣 <b>' + nm + '</b> 정답 외치기 : 「' + esc(f.v) + '」 → ' + (f.ok ? '정답! 🎉' : '땡! 😵') + '</div>';
      return '<div class="yg-m ' + f.k + (mine ? ' mine' : '') + '"><span class="yg-who">' + (f.k === 'q' ? '❓ ' : '') + nm + '</span><span class="yg-bub">' + esc(f.v) + '</span></div>';
    }).join('');
    feed.setAttribute('data-n', String(fl.length) + ':' + st.gameId);
    if (stick || fl.length < 4) feed.scrollTop = feed.scrollHeight;
    var last = fl[fl.length - 1];
    if (last && last.k === 'g' && typeof mmSound === 'function' && ygRender.lastG !== fl.length) { ygRender.lastG = fl.length; mmSound(last.ok ? 'catch' : 'wrong'); }
  }
  /* 아래 입력 줄: 질문자는 [정답 외치기][다음 차례], 나머지는 [예][아니오][애매해요] */
  var amQ = st.phase === 'play' && q === me_ && !st.solved[me_];
  document.getElementById('yg-q-tools').style.display = amQ ? '' : 'none';
  document.getElementById('yg-a-tools').style.display = st.phase === 'play' && !amQ ? '' : 'none';
  if (!amQ && YG_GUESS_MODE) ygSetGuessMode(false);
  var inp = document.getElementById('yg-input');
  if (!YG_GUESS_MODE) inp.placeholder = ygPlaceholder(st);
  ygRenderTimer();
}
function ygRenderTimer() {
  var st = YG_STATE, bar = document.getElementById('yg-bar'), num = document.getElementById('yg-bar-num');
  if (!st) return;
  var total, left;
  if (st.phase === 'play') { total = YG_TURN_S * 1000; left = st.turnEnd - Date.now(); }
  else if (st.phase === 'write') { total = YG_WRITE_S * 1000; left = st.deadline - Date.now(); }
  else { bar.style.width = '0%'; num.textContent = ''; return; }
  left = Math.max(0, left);
  bar.style.width = (left / total * 100).toFixed(1) + '%';
  bar.classList.toggle('hurry', left < 10000);
  num.textContent = Math.ceil(left / 1000);
}
