/* ===================== 인어조림 만들기 (혼자 하기) =====================
   제한 시간(2분 30초) 동안 손님 주문을 받아 인어조림을 최대한 많이 만드는 가게 게임!
   주문마다: ① 인어 사냥(세이렌 조심) → ② 레시피 순서대로 재료 넣기 → ③ 보글보글(불 끄기 타이밍) → 손님에게 내기
   요리를 망치면 그 주문만 실패(매달린 친구들 그림)하고 다음 손님으로, 세이렌에게 잡히면 가게 문 닫기(게임 끝). */
var MM = null;
var MM_TIMERS = [];
var MM_RAF = 0;
var MM_AC = null;

var MM_HUNT_GOAL = 3;        /* 주문마다 잡아야 하는 인어 수 (주문이 쌓이면 늘어나요) */
var MM_HUNT_SECONDS = 28;
var MM_SHOP_SECONDS = 150;   /* 가게 영업 시간 */
var MMS = null;              /* 한 판(영업) 전체 상태: 남은 시간, 완성 수, 코인 */
var MMS_TIMER = 0;
var MM_CUSTOMERS = ['치이카와', '하치와레', '우사기', '모몽가', '쿠리만쥬', '시사', '랏코', '포셰트', '고블린'];
var MM_MASH_NEED = 30;       /* 세이렌 쫓아내는 데 필요한 연타 수 (손을 멈추면 게이지가 줄어요) */
var MM_MASH_SECONDS = 4;
var MM_MISS_PENALTY = 1.5;   /* 빈 물결을 누르면 시간 -1.5초 */
var MM_RECIPE_PEEK = 2;      /* 레시피 외울 시간(초) */
var MM_MAX_MISTAKES = 2;

var MM_ING = [
  { id: 'fish',  name: '잡은 인어', svg: null },
  { id: 'scale', name: '인어 비늘',
    svg: '<svg viewBox="0 0 64 64"><g stroke="#7a3b4a" stroke-width="3" fill="#f6a8bd"><path d="M12 30a10 10 0 0 1 20 0z"/><path d="M32 30a10 10 0 0 1 20 0z"/><path d="M22 44a10 10 0 0 1 20 0z"/></g><circle cx="18" cy="24" r="2.5" fill="#fff"/><circle cx="38" cy="24" r="2.5" fill="#fff"/></svg>' },
  { id: 'water', name: '바닷물',
    svg: '<svg viewBox="0 0 64 64"><path d="M32 6C24 20 14 30 14 40a18 18 0 0 0 36 0C50 30 40 20 32 6z" fill="#9fd8f5" stroke="#3d7fa6" stroke-width="3"/><path d="M22 40c0 5 4 9 9 10" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/></svg>' },
  { id: 'pearl', name: '진주',
    svg: '<svg viewBox="0 0 64 64"><path d="M8 44c6-14 42-14 48 0-10 8-38 8-48 0z" fill="#ffd9e4" stroke="#b46a82" stroke-width="3"/><circle cx="32" cy="32" r="13" fill="#fdfbff" stroke="#9a8fb5" stroke-width="3"/><circle cx="27" cy="27" r="4" fill="#fff"/><circle cx="36" cy="36" r="3" fill="#e8e0f5"/></svg>' },
  { id: 'coral', name: '산호',
    svg: '<svg viewBox="0 0 64 64"><path d="M32 58V34M32 40l-12-12V16M20 28l-8-6M32 34l12-12V10M44 22l8-4M26 46l-10-4" stroke="#ff8a8a" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M32 58V34M32 40l-12-12V16M32 34l12-12V10" stroke="#ffc2c2" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>' },
  { id: 'soy',   name: '마법 간장',
    svg: '<svg viewBox="0 0 64 64"><rect x="26" y="6" width="12" height="10" rx="3" fill="#e65a5a" stroke="#6b2f2f" stroke-width="3"/><path d="M24 16h16v8c6 4 8 9 8 15v13a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V39c0-6 2-11 8-15z" fill="#8a5a3c" stroke="#4b2c1c" stroke-width="3"/><rect x="20" y="34" width="24" height="14" rx="4" fill="#fff4d6"/><path d="M32 36l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" fill="#f5b83d"/></svg>' }
];
var MM_DECOY = [
  { id: 'seaweed', name: '미역', decoy: true,
    svg: '<svg viewBox="0 0 64 64"><path d="M24 58c-8-10 8-16 0-26s6-16 0-26M38 58c8-10-8-16 0-26s-6-16 2-26" stroke="#4f9a5e" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M24 58c-8-10 8-16 0-26M38 58c8-10-8-16 0-26" stroke="#9fd8a5" stroke-width="2" fill="none"/></svg>' },
  { id: 'clam', name: '조개', decoy: true,
    svg: '<svg viewBox="0 0 64 64"><path d="M8 40C8 20 56 20 56 40z" fill="#ffd9a8" stroke="#8a5a3c" stroke-width="3"/><path d="M32 22v18M20 25l6 15M44 25l-6 15" stroke="#8a5a3c" stroke-width="2.5"/><rect x="24" y="40" width="16" height="8" rx="3" fill="#ffd9a8" stroke="#8a5a3c" stroke-width="3"/></svg>' },
  { id: 'salt', name: '왕소금', decoy: true,
    svg: '<svg viewBox="0 0 64 64"><rect x="20" y="8" width="24" height="10" rx="4" fill="#cfd8e6" stroke="#556" stroke-width="3"/><circle cx="27" cy="13" r="1.6" fill="#556"/><circle cx="32" cy="13" r="1.6" fill="#556"/><circle cx="37" cy="13" r="1.6" fill="#556"/><path d="M18 18h28l-3 38H21z" fill="#fff" stroke="#556" stroke-width="3"/><path d="M24 34h16" stroke="#9ab" stroke-width="3"/></svg>' }
];
var MM_ING_COLOR = { fish: '#f4b6a6', scale: '#f19fb3', water: '#9fd8f5', pearl: '#f2ecff', coral: '#ff9c9c', soy: '#9b5d3f' };

function mmEl(id) { return document.getElementById(id); }
function mmLater(fn, ms) { var t = setTimeout(fn, ms); MM_TIMERS.push(t); return t; }
function mmClearTimers() {
  MM_TIMERS.forEach(function (t) { clearTimeout(t); clearInterval(t); });
  MM_TIMERS = [];
  if (MM && MM.sirenRaf) cancelAnimationFrame(MM.sirenRaf);
  if (MM) MM.watching = false;
  cancelAnimationFrame(MM_RAF);
  MM_RAF = 0;
}

/* ---------- 효과음 (WebAudio) ---------- */
function mmSound(kind) {
  try {
    if (!MM_AC) MM_AC = new (window.AudioContext || window.webkitAudioContext)();
    if (MM_AC.state === 'suspended') MM_AC.resume();
    var ac = MM_AC, now = ac.currentTime;
    var tone = function (freq, freq2, dur, type, vol, delay) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine';
      var t0 = now + (delay || 0);
      o.frequency.setValueAtTime(freq, t0);
      if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, t0 + dur);
      g.gain.setValueAtTime(vol || 0.15, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    };
    if (kind === 'catch') { tone(700, 1400, 0.12, 'sine', 0.18); tone(1400, 1800, 0.1, 'sine', 0.1, 0.08); }
    else if (kind === 'miss') tone(260, 180, 0.12, 'triangle', 0.08);
    else if (kind === 'plop') { tone(500, 160, 0.18, 'sine', 0.2); tone(900, 1200, 0.06, 'sine', 0.07, 0.12); }
    else if (kind === 'bubble') tone(300 + Math.random() * 300, 700 + Math.random() * 300, 0.07, 'sine', 0.05);
    else if (kind === 'wrong') { tone(220, 200, 0.15, 'square', 0.06); tone(180, 160, 0.18, 'square', 0.06, 0.12); }
    else if (kind === 'siren') { for (var i = 0; i < 4; i++) tone(500, 900, 0.18, 'sawtooth', 0.05, i * 0.2); }
    else if (kind === 'mash') tone(600 + Math.random() * 200, 0, 0.04, 'square', 0.04);
    else if (kind === 'fail') { tone(400, 300, 0.25, 'triangle', 0.12); tone(300, 200, 0.3, 'triangle', 0.12, 0.25); tone(200, 90, 0.5, 'triangle', 0.12, 0.55); }
    else if (kind === 'win') { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0, 0.18, 'sine', 0.14, i * 0.12); }); }
    else if (kind === 'pop') tone(900, 1300, 0.06, 'sine', 0.06);
  } catch (e) {}
}

/* ---------- 시작 / 정지 ---------- */
function startMermaidGame() {
  mmClearTimers();
  clearInterval(MMS_TIMER);
  MMS = null;
  MM = { phase: 'intro' };
  mmRenderSession();
  mmRenderIntro();
}
function stopMermaidGame() {
  mmClearTimers();
  clearInterval(MMS_TIMER);
  MMS = null;
  MM = null;
  var st = mmEl('mm-stage');
  if (st) { st.innerHTML = ''; st.onpointerdown = null; }
}

function mmSetStep(step) {
  var box = mmEl('mm-steps');
  if (!box) return;
  var order = ['hunt', 'cook', 'boil', 'done'];
  var idx = order.indexOf(step);
  box.querySelectorAll('span').forEach(function (s) {
    var i = order.indexOf(s.getAttribute('data-s'));
    s.className = i === idx ? 'on' : (i < idx ? 'past' : '');
  });
}

/* ---------- 영업(한 판) 관리 ---------- */
function mmBest() { try { return JSON.parse(localStorage.getItem('gamehub_mermaid_best') || 'null'); } catch (e) { return null; } }
function mmSaveBest(b) { try { localStorage.setItem('gamehub_mermaid_best', JSON.stringify(b)); } catch (e) {} }

function mmRenderSession() {
  var bar = mmEl('mm-session');
  if (!bar) return;
  if (!MMS) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  var s = Math.max(0, Math.ceil(MMS.left));
  var mm = Math.floor(s / 60), ss = s % 60;
  bar.innerHTML =
    '<span class="mm-s-time' + (MMS.left <= 15 ? ' hurry' : '') + '">⏱ ' + mm + ':' + (ss < 10 ? '0' : '') + ss + '</span>' +
    '<span>🍲 <b>' + MMS.dishes + '</b>그릇</span>' +
    '<span>⭐ <b>' + MMS.stars + '</b></span>' +
    '<span>💰 <b>' + MMS.coins + '</b></span>';
}

function mmStartShop() {
  mmClearTimers();
  clearInterval(MMS_TIMER);
  MMS = { left: MM_SHOP_SECONDS, dishes: 0, stars: 0, coins: 0, orderNo: 0, failed: 0, combo: 0, over: false };
  mmRenderSession();
  var last = performance.now();
  MMS_TIMER = setInterval(function () {
    var now = performance.now(), dt = (now - last) / 1000; last = now;
    if (!MMS || MMS.over) return;
    /* 세이렌과 싸우는 동안은 가게 시계도 멈춰요 */
    var frozen = MM && ((MM.sirenActive && MM.paused) || MM.freeze);
    if (!frozen) MMS.left -= dt;
    mmRenderSession();
    if (MMS.left <= 0) mmShopClose(false);
  }, 100);
  mmNextOrder();
}

function mmNextOrder() {
  if (!MMS || MMS.over) return;
  mmClearTimers();
  MMS.orderNo++;
  var n = MMS.orderNo;
  /* 주문이 쌓일수록 조금씩 어려워져요 */
  var ingCount = Math.min(5, 2 + Math.ceil(n / 2));            /* 인어 말고 넣을 재료 수: 3 → 5 */
  var pool = mmShuffle(MM_ING.slice(1).map(function (g) { return g.id; }));
  var who = MM_CUSTOMERS[Math.floor(Math.random() * MM_CUSTOMERS.length)];
  var charImg = null;
  if (typeof BB_CHARS !== 'undefined' && BB_CHARS.length) {
    var c = BB_CHARS[Math.floor(Math.random() * BB_CHARS.length)];
    charImg = c.src || c.img || null; who = c.name || who;
  }
  MMS.order = {
    no: n, who: who, img: charImg,
    fish: Math.min(5, MM_HUNT_GOAL + Math.floor((n - 1) / 3)),
    recipe: ['fish'].concat(pool.slice(0, ingCount)),
    sirenChance: Math.min(0.75, 0.3 + n * 0.06),
    boilSpeed: 1 + Math.min(0.5, (n - 1) * 0.06)
  };
  var o = MMS.order;
  mmSetStep('');
  var st = mmEl('mm-stage');
  st.className = 'mm-stage mm-shop';
  st.onpointerdown = null;
  st.innerHTML =
    '<div class="mm-card mm-ordercard">' +
      '<div class="mm-order-no">주문 #' + n + '</div>' +
      (o.img ? '<img class="mm-cust-img" src="' + o.img + '" alt="">' : '<div class="mm-cust-emoji">🙋</div>') +
      '<div class="mm-bubble-say">' + esc(o.who) + ': "인어조림 하나 주세요!"</div>' +
      '<p>인어 <b>' + o.fish + '마리</b> · 재료 <b>' + (o.recipe.length - 1) + '가지</b></p>' +
      '<button class="mm-btn mm-btn-go" onclick="mmStartHunt()">사냥하러 가기 🎣</button>' +
    '</div>';
  /* 버튼을 안 눌러도 잠시 뒤 자동으로 출발 */
  mmLater(function () { if (MM && MM.phase === 'order') mmStartHunt(); }, 1800);
  MM = { phase: 'order' };
}

/* 요리 한 그릇 실패: 그림을 잠깐 보여주고 다음 손님 */
function mmDishFail(title, sub) {
  mmClearTimers();
  if (!MMS || MMS.over) return;
  MM.phase = 'dishfail';
  MMS.failed++;
  MMS.combo = 0;
  mmSound('fail');
  var st = mmEl('mm-stage');
  st.onpointerdown = null;
  st.className = 'mm-stage mm-failbg';
  st.innerHTML =
    '<div class="mm-card mm-failcard">' +
      '<img class="mm-dead-img" src="' + MM_IMG.dead + '" alt="">' +
      '<div class="mm-big">' + title + '</div>' +
      '<p>' + sub + '<br>손님이 화나서 돌아갔어요… 다음 손님!</p>' +
    '</div>';
  mmLater(mmNextOrder, 2200);
}

/* 한 그릇 완성 → 손님에게 내기 */
function mmServe() {
  if (!MMS || MMS.over) return;
  MM.phase = 'served';
  MMS.dishes++;
  MMS.stars += MM.stars;
  MMS.combo++;
  var coin = MM.stars * 100 + (MMS.combo >= 2 ? (MMS.combo - 1) * 30 : 0);
  MMS.coins += coin;
  mmRenderSession();
  mmSound('win');
  var starHtml = '';
  for (var i = 0; i < 3; i++) starHtml += '<span class="mm-star' + (i < MM.stars ? ' on' : '') + '" style="animation-delay:' + (0.15 + i * 0.12) + 's">★</span>';
  var st = mmEl('mm-stage');
  st.className = 'mm-stage mm-donebg';
  st.innerHTML =
    '<div class="mm-card mm-donecard">' +
      '<div class="mm-big">인어조림 완성!</div>' +
      '<img class="mm-dish" src="' + MM_IMG.dish + '" alt="인어조림">' +
      '<div class="mm-stars">' + starHtml + '</div>' +
      '<p class="mm-comment">💰 +' + coin + (MMS.combo >= 2 ? ' <span class="mm-combo">🔥 ' + MMS.combo + '연속!</span>' : '') + '</p>' +
    '</div>';
  mmLater(mmNextOrder, 1500);
}

/* 영업 끝: 시간이 다 됐거나(timeUp) 세이렌에게 잡혔을 때(caught) */
function mmShopClose(caught, title, sub) {
  if (!MMS || MMS.over) return;
  MMS.over = true;
  clearInterval(MMS_TIMER);
  mmClearTimers();
  if (MM) MM.phase = 'closed';
  mmRenderSession();
  var best = mmBest();
  var isBest = !best || MMS.coins > best.coins;
  typeof soloCoin === 'function' && soloCoin(Math.min(40, Math.floor(MMS.coins / 25)), '인어조림 장사 끝!');
  if (isBest) mmSaveBest({ coins: MMS.coins, dishes: MMS.dishes });
  mmSound(caught ? 'fail' : 'win');
  var st = mmEl('mm-stage');
  st.onpointerdown = null;
  st.className = 'mm-stage ' + (caught ? 'mm-failbg' : 'mm-donebg');
  var head = caught
    ? '<img class="mm-dead-img" src="' + MM_IMG.dead + '" alt=""><div class="mm-big">' + (title || '세이렌에게 붙잡혔어…') + '</div><p>' + (sub || '') + '<br>가게 문을 닫아요!</p>'
    : '<div class="mm-big">⏰ 영업 끝!</div><img class="mm-dish" src="' + MM_IMG.dish + '" alt="">';
  st.innerHTML =
    '<div class="mm-card mm-resultcard">' + head +
      '<div class="mm-result-grid">' +
        '<div><span>만든 인어조림</span><b>' + MMS.dishes + '그릇</b></div>' +
        '<div><span>받은 별</span><b>⭐ ' + MMS.stars + '</b></div>' +
        '<div><span>번 돈</span><b>💰 ' + MMS.coins + '</b></div>' +
        '<div><span>망친 요리</span><b>' + MMS.failed + '번</b></div>' +
      '</div>' +
      '<p class="mm-detail">' + (isBest ? '🏆 <b>새 최고 기록!</b>' : '최고 기록: 💰 ' + best.coins + ' (' + best.dishes + '그릇)') + '</p>' +
      '<button class="mm-btn mm-btn-go" onclick="mmStartShop()">다시 영업하기</button>' +
    '</div>';
}

function mmRenderIntro() {
  mmSetStep('');
  var st = mmEl('mm-stage');
  st.className = 'mm-stage mm-sea';
  st.innerHTML =
    '<div class="mm-card mm-intro">' +
      '<div class="mm-intro-pics"><img src="' + MM_IMG.fish1 + '" alt=""><img src="' + MM_IMG.fish2 + '" alt=""></div>' +
      '<div class="mm-big">인어조림 가게 오픈!</div>' +
      '<p><b>' + Math.floor(MM_SHOP_SECONDS / 60) + '분 ' + (MM_SHOP_SECONDS % 60) + '초</b> 동안 손님 주문을 받아<br>인어조림을 <b>최대한 많이</b> 만들어요!<br>' +
      '<b class="mm-red">세이렌</b>에게 잡히면 가게 문을 닫아요.</p>' +
      (mmBest() ? '<p class="mm-detail">🏆 최고 기록: 💰 ' + mmBest().coins + ' (' + mmBest().dishes + '그릇)</p>' : '') +
      '<button class="mm-btn mm-btn-go" onclick="mmStartShop()">영업 시작!</button>' +
    '</div>';
}

/* ---------- 실패 화면 (거꾸로 매달린 친구들) ---------- */
function mmFail(title, sub) {
  if (MMS && !MMS.over) {
    /* 세이렌에게 잡힘 = 영업 끝, 요리 실패 = 이 주문만 실패 */
    if (MM && MM.phase === 'hunt') mmShopClose(true, title, sub);
    else mmDishFail(title, sub);
    return;
  }
  mmClearTimers();
  if (!MM) return;
  MM.phase = 'fail';
  mmSound('fail');
  var st = mmEl('mm-stage');
  st.onpointerdown = null;
  st.className = 'mm-stage mm-failbg';
  st.innerHTML =
    '<div class="mm-card mm-failcard">' +
      '<img class="mm-dead-img" src="' + MM_IMG.dead + '" alt="">' +
      '<div class="mm-big">' + title + '</div>' +
      '<p>' + sub + '</p>' +
      '<button class="mm-btn mm-btn-go" onclick="mmStartShop()">처음부터 다시</button>' +
    '</div>';
}

/* =============== ① 인어 사냥 =============== */
function mmStartHunt() {
  mmClearTimers();
  if (!MMS || MMS.over) return;
  var order = MMS.order;
  MM_HUNT_GOAL = order.fish;
  MM = { phase: 'hunt', caught: 0, left: MM_HUNT_SECONDS, holes: [], sirenTimes: [], paused: false, mistakes: 0 };
  /* 주문마다 정해진 확률로 세이렌이 한 번 나타나요 (사냥 초반에) */
  MM.sirenTimes = Math.random() < order.sirenChance ? [0.8 + Math.random() * 1.8] : [];
  /* 방식은 4가지 중 하나 (영업 중에는 골고루 돌아가며) */
  if (!MMS.sirenBag || !MMS.sirenBag.length) MMS.sirenBag = mmShuffle(['tug', 'song', 'look', 'ring']);
  MM.sirenBag = MMS.sirenBag;
  MM.sirenActive = false;
  MM.freeze = false;
  MM.elapsed = 0;
  mmSetStep('hunt');
  var st = mmEl('mm-stage');
  st.className = 'mm-stage mm-sea';
  var holes = '';
  for (var i = 0; i < 6; i++) {
    holes += '<div class="mm-hole" data-i="' + i + '"><div class="mm-pop"></div><div class="mm-wave"></div></div>';
  }
  st.innerHTML =
    '<div class="mm-hud"><span>🧜 <b id="mm-caught">0</b> / ' + MM_HUNT_GOAL + '</span><span class="mm-hud-order">주문 #' + order.no + '</span></div>' +
    '<div class="mm-holes">' + holes + '</div>' +
    '<p class="mm-tip">쏙 올라온 인어를 톡! (빈 물결 누르면 -' + MM_MISS_PENALTY + '초)</p>';
  st.onpointerdown = null;
  st.querySelectorAll('.mm-hole').forEach(function (h) {
    h.addEventListener('pointerdown', function (e) { e.preventDefault(); mmTapHole(+h.getAttribute('data-i')); });
  });
  for (var k = 0; k < 6; k++) MM.holes.push({ who: null, until: 0 });
  var last = performance.now();
  var spawnAcc = 0;
  var tick = function (now) {
    if (!MM || MM.phase !== 'hunt') return;
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!MM.paused) {
      if (!MM.freeze) MM.elapsed += dt;

      /* 인어 나오고 들어가기 */
      spawnAcc += dt;
      var gap = 0.55 - Math.min(0.25, MM.elapsed * 0.012);
      if (spawnAcc > gap) { spawnAcc = 0; mmSpawnFish(); }
      MM.holes.forEach(function (h, i) { if (h.who && now > h.until) mmHideHole(i, false); });
      /* 세이렌 등장 */
      if (!MM.sirenActive && MM.sirenTimes.length && MM.elapsed >= MM.sirenTimes[0]) { MM.sirenTimes.shift(); mmSirenAppear(); }
    }
    MM_RAF = requestAnimationFrame(tick);
  };
  MM_RAF = requestAnimationFrame(tick);
}

function mmSpawnFish() {
  var free = [];
  MM.holes.forEach(function (h, i) { if (!h.who) free.push(i); });
  if (!free.length) return;
  var i = free[Math.floor(Math.random() * free.length)];
  var pics = ['fish1', 'fish2'];
  var who = pics[Math.floor(Math.random() * pics.length)];
  var stay = 800 - Math.min(380, MM.elapsed * 16) + Math.random() * 220;
  /* 가끔(약 12%) 레어 인어가 튀어나와요! 잡으면 2마리로 쳐요. 대신 더 빨리 숨어요. */
  var rare = Math.random() < 0.12;
  if (rare) { who = Math.random() < 0.5 ? 'rare1' : 'rare2'; stay *= 0.75; }
  MM.holes[i] = { who: who, until: performance.now() + stay };
  var hole = document.querySelector('.mm-hole[data-i="' + i + '"]');
  if (!hole) return;
  var pop = hole.querySelector('.mm-pop');
  pop.innerHTML = '<img src="' + MM_IMG[who] + '" alt="">';
  hole.classList.remove('caught');
  hole.classList.toggle('rare', rare);
  hole.classList.add('up');
  mmSound('pop');
}

function mmHideHole(i, caught) {
  MM.holes[i] = { who: null, until: 0 };
  var hole = document.querySelector('.mm-hole[data-i="' + i + '"]');
  if (!hole) return;
  hole.classList.remove('up');
  if (caught) hole.classList.add('caught');
}

function mmTapHole(i) {
  if (!MM || MM.phase !== 'hunt' || MM.paused) return;
  if (MM.watching) { mmSirenLose('들켜버렸어…', '세이렌이 보고 있을 때 움직이면 안 돼요!'); return; }
  var h = MM.holes[i];
  var hole = document.querySelector('.mm-hole[data-i="' + i + '"]');
  if (!h.who) {
    mmSound('miss');
    if (MMS) MMS.left -= MM_MISS_PENALTY;
    mmFloatText(hole, '-' + MM_MISS_PENALTY + '초');
    return;
  }
  var isRare = h.who === 'rare1' || h.who === 'rare2';
  MM.caught = Math.min(MM_HUNT_GOAL, MM.caught + (isRare ? 2 : 1));
  mmSound('catch');
  if (isRare) mmSound('win');
  mmHideHole(i, true);
  mmFloatText(hole, isRare ? '✨레어! +2' : '잡았다!');
  mmEl('mm-caught').textContent = MM.caught;
  if (MM.caught >= MM_HUNT_GOAL) {
    MM.phase = 'huntdone';
    cancelAnimationFrame(MM_RAF);
    mmSound('win');
    var st = mmEl('mm-stage');
    var msg = document.createElement('div');
    msg.className = 'mm-banner';
    msg.textContent = '인어 ' + MM_HUNT_GOAL + '마리 잡았다! 🎉';
    st.appendChild(msg);
    mmLater(mmStartCook, 700);
  }
}

function mmFloatText(anchor, text) {
  if (!anchor) return;
  var f = document.createElement('div');
  f.className = 'mm-float';
  f.textContent = text;
  anchor.appendChild(f);
  setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 800);
}

/* ---------- 세이렌 연타 ---------- */
/* ---------- 세이렌 등장: 4가지 방식 중 하나 ---------- */
var MM_SIREN_INFO = {
  tug:  { title: '줄다리기!', how: '화면을 연타해서 리본을 내 쪽 끝까지 당겨요!' },
  song: { title: '세이렌의 노래', how: '날아오는 음표 ♪ 를 눌러 터뜨려요! 3개 맞으면 홀려요' },
  look: { title: '세이렌이 뒤돌아본다', how: '세이렌이 <b>보고 있을 땐</b> 아무것도 누르지 마요!' },
  ring: { title: '타이밍 반격', how: '줄어드는 동그라미가 <b>노란 원</b>에 겹칠 때 톡! 3번 성공' }
};

function mmSirenAppear() {
  MM.sirenActive = true;
  MM.paused = true;
  for (var i = 0; i < MM.holes.length; i++) if (MM.holes[i].who) mmHideHole(i, false);
  var mode = MM.sirenBag.length ? MM.sirenBag.shift() : ['tug', 'song', 'look', 'ring'][Math.floor(Math.random() * 4)];
  mmSound('siren');
  var info = MM_SIREN_INFO[mode];
  var st = mmEl('mm-stage');
  var ov = document.createElement('div');
  ov.className = 'mm-siren-ov';
  ov.id = 'mm-siren-ov';
  ov.innerHTML =
    '<div class="mm-siren-warn">⚠️ 세이렌이 나타났다! ⚠️</div>' +
    '<img class="mm-siren-img" src="' + MM_IMG.siren + '" alt="">' +
    '<div class="mm-mash-text">' + info.title + '</div>' +
    '<div class="mm-siren-how">' + info.how + '</div>';
  st.appendChild(ov);
  /* 1.8초 동안 방법을 보여주고 시작 */
  mmLater(function () {
    if (!MM || MM.phase !== 'hunt') return;
    if (ov.parentNode) ov.parentNode.removeChild(ov);
    if (mode === 'tug') mmSirenTug();
    else if (mode === 'song') mmSirenSong();
    else if (mode === 'look') mmSirenLook();
    else mmSirenRing();
  }, 1800);
}

function mmSirenOverlay(cls, inner) {
  var st = mmEl('mm-stage');
  var ov = document.createElement('div');
  ov.className = 'mm-siren-ov ' + cls;
  ov.id = 'mm-siren-ov';
  ov.innerHTML = inner;
  st.appendChild(ov);
  return ov;
}

function mmSirenWin(text) {
  if (!MM || MM.phase !== 'hunt') return;
  cancelAnimationFrame(MM.sirenRaf);
  MM.watching = false;
  mmSound('win');
  var old = mmEl('mm-siren-ov');
  var watcher = mmEl('mm-watcher');
  if (watcher && watcher.parentNode) watcher.parentNode.removeChild(watcher);
  var ov = old || mmSirenOverlay('', '');
  ov.className = 'mm-siren-ov win';
  ov.innerHTML = '<img class="mm-siren-img flee" src="' + MM_IMG.siren + '" alt=""><div class="mm-mash-text">' + (text || '세이렌을 쫓아냈다!') + '</div>';
  mmLater(function () {
    if (ov.parentNode) ov.parentNode.removeChild(ov);
    if (MM && MM.phase === 'hunt') { MM.paused = false; MM.freeze = false; MM.sirenActive = false; }
  }, 900);
}

function mmSirenLose(title, sub) {
  if (!MM) return;
  cancelAnimationFrame(MM.sirenRaf);
  MM.watching = false;
  mmFail(title, sub);
}

/* --- 1) 줄다리기 --- */
function mmSirenTug() {
  var ov = mmSirenOverlay('mm-tug',
    '<div class="mm-tug-top"><img class="mm-tug-siren" id="mm-tug-siren" src="' + MM_IMG.siren + '" alt=""><div class="mm-tug-say" id="mm-tug-say"></div></div>' +
    '<div class="mm-tug-rope"><div class="mm-tug-end l">세이렌</div><div class="mm-tug-line"></div><div class="mm-tug-ribbon" id="mm-tug-ribbon">🎀</div><div class="mm-tug-end r">나</div></div>' +
    '<div class="mm-mash-text">연타! 연타!</div>' +
    '<p class="mm-siren-how">리본이 <b>세이렌 끝</b>에 닿으면 잡혀요</p>');
  var won = false, pos = 0.5, last = performance.now(), nextSpurt = performance.now() + 1400 + Math.random() * 900, spurtUntil = 0;
  ov.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (won) return;
    pos = Math.min(1, pos + 0.06);
    mmSound('mash');
    if (pos >= 0.985) { won = true; mmSirenWin('영차! 줄다리기 승리!'); return; }
    var s = mmEl('mm-tug-siren');
    if (s) { s.classList.remove('hit'); void s.offsetWidth; s.classList.add('hit'); }
  });
  var tick = function (now) {
    if (!MM || MM.phase !== 'hunt') return;
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (now > nextSpurt) {
      spurtUntil = now + 550;
      nextSpurt = now + 1700 + Math.random() * 1200;
      var say = mmEl('mm-tug-say');
      if (say) { say.textContent = ['흥!', '이리 와!', '내 거야!'][Math.floor(Math.random() * 3)]; say.classList.remove('show'); void say.offsetWidth; say.classList.add('show'); }
    }
    var pull = now < spurtUntil ? 0.35 : 0.08;
    pos -= pull * dt;
    var r = mmEl('mm-tug-ribbon');
    if (r) r.style.left = (pos * 100) + '%';
    ov.classList.toggle('danger', pos < 0.25);
    if (won) return;
    if (pos <= 0) { mmSirenLose('세이렌에게 끌려가 버렸어…', '줄다리기에서 졌어요!'); return; }
    MM.sirenRaf = requestAnimationFrame(tick);
  };
  MM.sirenRaf = requestAnimationFrame(tick);
}

/* --- 2) 세이렌의 노래 (음표 터뜨리기) --- */
function mmSirenSong() {
  var ov = mmSirenOverlay('mm-song',
    '<div class="mm-song-hud"><span id="mm-song-hearts">❤️❤️❤️</span><span>버티기 <b id="mm-song-left">8.0</b>초</span></div>' +
    '<img class="mm-song-siren" src="' + MM_IMG.siren + '" alt="">' +
    '<div class="mm-song-me" id="mm-song-me">🙉</div>');
  var notes = [], hp = 3, start = performance.now(), last = start, spawnAcc = 0.5, DUR = 7;
  /* 음표를 정확히 못 눌러도 '근처'를 누르면 가장 가까운 음표가 터져요 (휴대폰에서 잘 안 눌리던 문제 수정) */
  var popNote = function (n) {
    if (!n || n.dead) return;
    n.dead = true; mmSound('catch');
    n.el.classList.add('pop');
    setTimeout(function () { if (n.el.parentNode) n.el.parentNode.removeChild(n.el); }, 250);
  };
  ov.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var r = ov.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    var best = null, bd = 85;
    notes.forEach(function (n) {
      if (n.dead) return;
      var d = Math.hypot(n.x - px, n.y - py);
      if (d < bd) { bd = d; best = n; }
    });
    popNote(best);
  });
  var rect = function () { return ov.getBoundingClientRect(); };
  var spawn = function () {
    var r = rect(), w = r.width, h = r.height;
    var el = document.createElement('div');
    el.className = 'mm-note';
    el.textContent = ['♪', '♫', '♬', '♩'][Math.floor(Math.random() * 4)];
    /* 위쪽 세 변 중 아무 데서나 */
    var side = Math.random(), x, y;
    if (side < 0.5) { x = Math.random() * w; y = -10; }
    else if (side < 0.75) { x = -10; y = Math.random() * h * 0.6; }
    else { x = w + 10; y = Math.random() * h * 0.6; }
    var n = { el: el, x: x, y: y, sp: 85 + Math.random() * 35 + (performance.now() - start) / 1000 * 6 };
    ov.appendChild(el);
    notes.push(n);
  };
  var tick = function (now) {
    if (!MM || MM.phase !== 'hunt') return;
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    var r = rect(), tx = r.width / 2, ty = r.height - 50;
    var el = (now - start) / 1000;
    spawnAcc += dt;
    if (spawnAcc > Math.max(0.55, 0.95 - el * 0.06)) { spawnAcc = 0; spawn(); }
    notes.forEach(function (n) {
      if (n.dead) return;
      var dx = tx - n.x, dy = ty - n.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 30) {
        n.dead = true; hp--;
        mmSound('wrong');
        if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
        var me = mmEl('mm-song-me');
        if (me) { me.classList.remove('hurt'); void me.offsetWidth; me.classList.add('hurt'); }
        var hs = mmEl('mm-song-hearts');
        if (hs) hs.textContent = '❤️❤️❤️'.slice(0, hp * 2) + '🤍🤍🤍'.slice(0, (3 - hp) * 2);
        return;
      }
      n.x += dx / d * n.sp * dt; n.y += dy / d * n.sp * dt;
      n.el.style.transform = 'translate(' + (n.x - 28) + 'px,' + (n.y - 28) + 'px)';
    });
    notes = notes.filter(function (n) { return !n.dead; });
    var left = DUR - el;
    var le = mmEl('mm-song-left'); if (le) le.textContent = Math.max(0, left).toFixed(1);
    if (hp <= 0) { mmSirenLose('노래에 홀려버렸어…', '음표를 3개나 맞았어요!'); return; }
    if (left <= 0) { mmSirenWin('노래를 다 막아냈다!'); return; }
    MM.sirenRaf = requestAnimationFrame(tick);
  };
  MM.sirenRaf = requestAnimationFrame(tick);
}

/* --- 3) 세이렌이 뒤돌아본다 (무궁화 꽃이 피었습니다) --- */
function mmSirenLook() {
  var st = mmEl('mm-stage');
  var w = document.createElement('div');
  w.className = 'mm-watcher away';
  w.id = 'mm-watcher';
  w.innerHTML = '<img src="' + MM_IMG.siren + '" alt=""><div class="mm-watch-say" id="mm-watch-say">지금이야! 잡아!</div><div class="mm-watch-count" id="mm-watch-count"></div>';
  st.appendChild(w);
  MM.paused = false;      /* 사냥은 계속돼요 */
  MM.watching = false;
  var rounds = 3, round = 0;
  var say = function (txt) { var s = mmEl('mm-watch-say'); if (s) s.innerHTML = txt; };
  var cnt = function () { var c = mmEl('mm-watch-count'); if (c) c.textContent = '남은 감시 ' + (rounds - round) + '번'; };
  cnt();
  var awayThen = function () {
    if (!MM || MM.phase !== 'hunt') return;
    if (round >= rounds) { mmSirenWin('세이렌이 지쳐서 돌아갔다!'); return; }
    w.className = 'mm-watcher away';
    MM.watching = false; MM.freeze = false;
    say('지금이야! 잡아!');
    mmLater(warn, 1800 + Math.random() * 1500);
  };
  var warn = function () {
    if (!MM || MM.phase !== 'hunt') return;
    w.className = 'mm-watcher warn';
    say('흐음…? 🤔');
    mmSound('pop');
    mmLater(watch, 550);
  };
  var watch = function () {
    if (!MM || MM.phase !== 'hunt') return;
    w.className = 'mm-watcher watch';
    MM.watching = true; MM.freeze = true;   /* 보고 있는 동안은 시간도 멈춰요 */
    say('👀 보고 있어! 멈춰!');
    mmSound('siren');
    round++; cnt();
    mmLater(function () { if (MM && MM.watching) awayThen(); }, 1300 + Math.random() * 1000);
  };
  awayThen();
}

/* --- 4) 타이밍 반격 --- */
function mmSirenRing() {
  var ov = mmSirenOverlay('mm-ring',
    '<div class="mm-song-hud"><span id="mm-ring-hearts">❤️❤️❤️</span><span>성공 <b id="mm-ring-ok">0</b> / 3</span></div>' +
    '<div class="mm-ring-box"><img class="mm-ring-siren" src="' + MM_IMG.siren + '" alt=""><div class="mm-ring-target"></div><div class="mm-ring-shrink" id="mm-ring-shrink"></div></div>' +
    '<div class="mm-ring-msg" id="mm-ring-msg">노란 원에 겹칠 때 톡!</div>');
  var ok = 0, hp = 3, roundStart = 0, dur = 1.5, last = 0, locked = false;
  var TARGET = 0.5;           /* 목표 원 크기 (최대 대비) */
  var WINDOW = 0.085;
  var cur = 1;
  var setMsg = function (m, c) { var e = mmEl('mm-ring-msg'); if (e) { e.textContent = m; e.className = 'mm-ring-msg ' + (c || ''); } };
  var newRound = function () { roundStart = performance.now(); locked = false; cur = 1; };
  var miss = function (m) {
    hp--; locked = true; mmSound('wrong'); setMsg(m, 'bad');
    var hs = mmEl('mm-ring-hearts'); if (hs) hs.textContent = '❤️❤️❤️'.slice(0, hp * 2) + '🤍🤍🤍'.slice(0, (3 - hp) * 2);
    if (hp <= 0) { mmLater(function () { mmSirenLose('반격에 실패했어…', '타이밍이 안 맞았어요!'); }, 400); return; }
    mmLater(newRound, 700);
  };
  ov.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (locked) return;
    if (Math.abs(cur - TARGET) <= WINDOW) {
      ok++; locked = true; mmSound('catch');
      var k = mmEl('mm-ring-ok'); if (k) k.textContent = ok;
      setMsg(['좋아!', '딱 맞았어!', '퍼펙트!'][ok - 1] || '좋아!', 'good');
      ov.classList.remove('flash'); void ov.offsetWidth; ov.classList.add('flash');
      if (ok >= 3) { mmLater(function () { mmSirenWin('반격 성공! 세이렌 도망!'); }, 400); return; }
      dur = Math.max(0.95, dur - 0.2);
      mmLater(newRound, 600);
    } else miss(cur > TARGET ? '너무 빨라!' : '너무 늦어!');
  });
  newRound();
  var tick = function (now) {
    if (!MM || MM.phase !== 'hunt') return;
    if (!locked) {
      cur = Math.max(0, 1 - (now - roundStart) / 1000 / dur * (1 - 0.15) );
      if (cur <= 0.15) { cur = 0.15; miss('놓쳤어!'); }
    }
    var s = mmEl('mm-ring-shrink');
    if (s) { s.style.width = s.style.height = (cur * 100) + '%'; s.classList.toggle('in', Math.abs(cur - TARGET) <= WINDOW); }
    MM.sirenRaf = requestAnimationFrame(tick);
  };
  MM.sirenRaf = requestAnimationFrame(tick);
}

/* =============== ② 재료 넣기 =============== */
function mmShuffle(a) {
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
  return a;
}

function mmPotHtml() {
  return '<div class="mm-pot-wrap" id="mm-pot-wrap">' +
    '<div class="mm-steam" id="mm-steam"></div>' +
    '<svg class="mm-pot" viewBox="0 0 240 170">' +
      '<rect x="4" y="52" width="34" height="16" rx="8" fill="#ffc9d6" stroke="#6b4a55" stroke-width="4"/>' +
      '<rect x="202" y="52" width="34" height="16" rx="8" fill="#ffc9d6" stroke="#6b4a55" stroke-width="4"/>' +
      '<path d="M28 44h184v70a46 46 0 0 1-46 46H74a46 46 0 0 1-46-46z" fill="#ffe1ea" stroke="#6b4a55" stroke-width="5"/>' +
      '<ellipse cx="120" cy="46" rx="92" ry="17" fill="#fff5f8" stroke="#6b4a55" stroke-width="5"/>' +
      '<ellipse id="mm-soup" cx="120" cy="48" rx="82" ry="12" fill="#cfe9f7" opacity="0"/>' +
      '<path d="M60 100c10 8 22 8 32 0M148 100c10 8 22 8 32 0" stroke="#e6a4b7" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="70" cy="116" rx="10" ry="6" fill="#ffb3c5" opacity=".7"/><ellipse cx="170" cy="116" rx="10" ry="6" fill="#ffb3c5" opacity=".7"/>' +
      '<path d="M108 112q12 10 24 0" stroke="#6b4a55" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '</svg>' +
    '<div class="mm-pot-items" id="mm-pot-items"></div>' +
    '<div class="mm-fire" id="mm-fire"><span>🔥</span><span>🔥</span><span>🔥</span></div>' +
  '</div>';
}

function mmIngIcon(ing) {
  if (ing.id === 'fish') return '<img src="' + MM_IMG.fish1 + '" alt="">';
  return ing.svg;
}

function mmStartCook() {
  mmClearTimers();
  if (!MM) return;
  MM.phase = 'cook';
  MM.mistakes = 0;
  MM.added = [];
  MM.recipe = MMS && MMS.order ? MMS.order.recipe.slice() : ['fish'].concat(mmShuffle(MM_ING.slice(1).map(function (g) { return g.id; })));
  mmSetStep('cook');
  var st = mmEl('mm-stage');
  st.className = 'mm-stage mm-kitchen';
  st.onpointerdown = null;
  var recipe = MM.recipe.map(function (id, i) {
    var g = MM_ING.filter(function (x) { return x.id === id; })[0];
    return '<li data-id="' + id + '"><span class="mm-rnum">' + (i + 1) + '</span>' + g.name + '</li>';
  }).join('');
  var shelf = mmShuffle(MM_ING.concat(MM_DECOY)).map(function (g) {
    return '<button class="mm-ing" data-id="' + g.id + '"><span class="mm-ing-ic">' + mmIngIcon(g) + '</span><span class="mm-ing-name">' + g.name + '</span></button>';
  }).join('');
  st.innerHTML =
    '<div class="mm-cook-top">' +
      '<div class="mm-recipe"><div class="mm-recipe-title">📜 레시피</div><ol id="mm-recipe">' + recipe + '</ol></div>' +
      '<div class="mm-mistakes">실수 <b id="mm-miss">0</b> / ' + MM_MAX_MISTAKES + '</div>' +
    '</div>' +
    mmPotHtml() +
    '<div class="mm-msg" id="mm-msg">레시피를 외워요! <b id="mm-peek">' + MM_RECIPE_PEEK + '</b>초 뒤에 사라져요 👀</div>' +
    '<div class="mm-shelf">' + shelf + '</div>' +
    '<button class="mm-btn mm-btn-cook" id="mm-cook-btn" disabled>🔥 조리 시작</button>';
  st.querySelectorAll('.mm-ing').forEach(function (b) {
    b.addEventListener('click', function () { mmAddIng(b); });
  });
  MM.peeking = true;
  st.querySelector('.mm-shelf').classList.add('locked');
  mmMarkRecipe();
  var peekLeft = MM_RECIPE_PEEK;
  var pt = setInterval(function () {
    if (!MM || MM.phase !== 'cook') { clearInterval(pt); return; }
    peekLeft--;
    var el = mmEl('mm-peek');
    if (el) el.textContent = peekLeft;
    if (peekLeft <= 0) {
      clearInterval(pt);
      MM.peeking = false;
      st.querySelector('.mm-shelf').classList.remove('locked');
      mmEl('mm-recipe').classList.add('hidden');
      mmMarkRecipe();
      mmEl('mm-msg').innerHTML = '기억나는 순서대로 재료를 넣어요! (미끼 재료 조심)';
    }
  }, 1000);
  MM_TIMERS.push(pt);
}

function mmMarkRecipe() {
  var lis = document.querySelectorAll('#mm-recipe li');
  lis.forEach(function (li, i) {
    li.className = i < MM.added.length ? 'done' : (MM.peeking ? '' : 'secret');
  });
}

function mmShuffleShelf() {
  var shelf = document.querySelector('.mm-shelf');
  if (!shelf) return;
  var btns = Array.prototype.slice.call(shelf.children);
  mmShuffle(btns).forEach(function (b) { shelf.appendChild(b); });
}

function mmAddIng(btn) {
  if (!MM || MM.phase !== 'cook' || MM.peeking) return;
  var id = btn.getAttribute('data-id');
  if (btn.classList.contains('used')) return;
  var want = MM.recipe[MM.added.length];
  if (id !== want) {
    MM.mistakes++;
    mmSound('wrong');
    mmEl('mm-miss').textContent = MM.mistakes;
    btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
    var pw = mmEl('mm-pot-wrap'); pw.classList.remove('shake'); void pw.offsetWidth; pw.classList.add('shake');
    var isDecoy = MM_DECOY.some(function (x) { return x.id === id; });
    mmEl('mm-msg').innerHTML = isDecoy ? '으악! 그건 <b>레시피에 없는 재료</b>예요!' : '앗! 그 재료는 <b>지금 차례가 아니에요</b>';
    if (MM.mistakes >= MM_MAX_MISTAKES) {
      MM.phase = 'failwait';
      mmLater(function () { mmFail('요리가 엉망이 됐어…', '재료를 ' + MM_MAX_MISTAKES + '번이나 잘못 넣어서 냄비가 펑!'); }, 600);
    }
    return;
  }
  btn.classList.add('used');
  MM.added.push(id);
  mmFlyToPot(btn, id);
  mmMarkRecipe();
  setTimeout(mmShuffleShelf, 500); /* 넣을 때마다 선반이 뒤섞여요 */
  var gname = MM_ING.filter(function (x) { return x.id === id; })[0].name;
  mmEl('mm-msg').innerHTML = '<b>' + gname + '</b> 퐁당! 💦';
  if (MM.added.length === MM.recipe.length) {
    var cb = mmEl('mm-cook-btn');
    cb.disabled = false;
    cb.classList.add('ready');
    cb.onclick = mmStartBoil;
    mmEl('mm-msg').innerHTML = '재료를 다 넣었어요! <b>조리 시작</b>을 눌러요';
  }
}

function mmFlyToPot(btn, id) {
  var st = mmEl('mm-stage');
  var pot = mmEl('mm-pot-wrap');
  var sr = st.getBoundingClientRect(), br = btn.getBoundingClientRect(), pr = pot.getBoundingClientRect();
  var fly = document.createElement('div');
  fly.className = 'mm-fly';
  fly.innerHTML = btn.querySelector('.mm-ing-ic').innerHTML;
  fly.style.left = (br.left - sr.left + br.width / 2 - 24) + 'px';
  fly.style.top = (br.top - sr.top + 4) + 'px';
  st.appendChild(fly);
  var tx = pr.left - sr.left + pr.width / 2 - 24 + (Math.random() * 40 - 20);
  var ty = pr.top - sr.top + pr.height * 0.18;
  requestAnimationFrame(function () {
    fly.style.transform = 'translate(' + (tx - parseFloat(fly.style.left)) + 'px,' + (ty - parseFloat(fly.style.top)) + 'px) scale(.7) rotate(25deg)';
  });
  setTimeout(function () {
    if (fly.parentNode) fly.parentNode.removeChild(fly);
    if (!MM) return;
    mmSound('plop');
    var soup = mmEl('mm-soup');
    if (soup) {
      soup.setAttribute('opacity', '1');
      soup.setAttribute('fill', mmMixColor());
    }
    mmSplash();
    var items = mmEl('mm-pot-items');
    if (items) {
      var it = document.createElement('span');
      it.className = 'mm-pot-item';
      it.innerHTML = btn.querySelector('.mm-ing-ic').innerHTML;
      it.style.left = (12 + Math.random() * 64) + '%';
      items.appendChild(it);
    }
  }, 480);
}

function mmMixColor() {
  var r = 0, g = 0, b = 0;
  MM.added.forEach(function (id) {
    var c = MM_ING_COLOR[id];
    r += parseInt(c.substr(1, 2), 16); g += parseInt(c.substr(3, 2), 16); b += parseInt(c.substr(5, 2), 16);
  });
  var n = MM.added.length || 1;
  return 'rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')';
}

function mmSplash() {
  var pw = mmEl('mm-pot-wrap');
  if (!pw) return;
  for (var i = 0; i < 6; i++) {
    var d = document.createElement('span');
    d.className = 'mm-drop';
    d.style.left = (40 + Math.random() * 20) + '%';
    d.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
    pw.appendChild(d);
    (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 600); })(d);
  }
}

/* =============== ③ 보글보글 =============== */
var MM_ZONE = { okLo: 55, perfLo: 71, perfHi: 79, okHi: 88 };

function mmStartBoil() {
  if (!MM || MM.phase !== 'cook') return;
  MM.phase = 'boil';
  mmSetStep('boil');
  var st = mmEl('mm-stage');
  st.querySelector('.mm-shelf').style.display = 'none';
  var cb = mmEl('mm-cook-btn');
  cb.textContent = '🧯 불 끄기!';
  cb.classList.remove('ready');
  cb.classList.add('stop');
  mmEl('mm-msg').innerHTML = '보글보글… <b class="mm-green">진한 초록 칸</b>에서 불을 꺼요!';
  mmEl('mm-fire').classList.add('on');
  mmEl('mm-pot-wrap').classList.add('boiling');
  var gauge = document.createElement('div');
  gauge.className = 'mm-gauge';
  gauge.innerHTML =
    '<div class="mm-gauge-track">' +
      '<div class="mm-z mm-z-ok" style="left:' + MM_ZONE.okLo + '%;width:' + (MM_ZONE.okHi - MM_ZONE.okLo) + '%"></div>' +
      '<div class="mm-z mm-z-perf" style="left:' + MM_ZONE.perfLo + '%;width:' + (MM_ZONE.perfHi - MM_ZONE.perfLo) + '%"></div>' +
      '<div class="mm-z mm-z-burn" style="left:' + MM_ZONE.okHi + '%;width:' + (100 - MM_ZONE.okHi) + '%"></div>' +
      '<div class="mm-needle" id="mm-needle"></div>' +
    '</div>' +
    '<div class="mm-gauge-labels"><span>덜 익음</span><span>딱 좋아!</span><span>탐</span></div>';
  st.insertBefore(gauge, mmEl('mm-msg'));
  MM.heat = 0;
  var dur = (2.6 + Math.random() * 1.0) / (MMS && MMS.order ? MMS.order.boilSpeed : 1);
  var wob = Math.random() * 6;
  var last = performance.now(), bubAcc = 0;
  var tick = function (now) {
    if (!MM || MM.phase !== 'boil') return;
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    /* 끓을수록 조금씩 빨라짐 */
    /* 속도가 들쭉날쭉해서 타이밍 맞추기 어려워요 */
    var speed = 0.75 + MM.heat / 200 + 0.55 * Math.sin(now / 260 + wob);
    MM.heat += dt / dur * 100 * Math.max(0.25, speed);
    var n = mmEl('mm-needle');
    if (n) n.style.left = Math.min(100, MM.heat) + '%';
    bubAcc += dt;
    if (bubAcc > 0.12 - Math.min(0.08, MM.heat / 1200)) { bubAcc = 0; mmBubble(); }
    if (MM.heat >= 100) { mmEndBoil(true); return; }
    MM_RAF = requestAnimationFrame(tick);
  };
  MM_RAF = requestAnimationFrame(tick);
  cb.onclick = function () { mmEndBoil(false); };
}

function mmBubble() {
  var pw = mmEl('mm-pot-wrap');
  if (!pw) return;
  var b = document.createElement('span');
  b.className = 'mm-bub';
  var s = 8 + Math.random() * 14;
  b.style.width = b.style.height = s + 'px';
  b.style.left = (20 + Math.random() * 60) + '%';
  pw.appendChild(b);
  if (Math.random() < 0.35) mmSound('bubble');
  setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 1100);
  if (Math.random() < 0.3) {
    var sm = document.createElement('span');
    sm.className = 'mm-smoke';
    sm.style.left = (25 + Math.random() * 50) + '%';
    var steam = mmEl('mm-steam');
    if (steam) steam.appendChild(sm);
    setTimeout(function () { if (sm.parentNode) sm.parentNode.removeChild(sm); }, 1600);
  }
}

function mmEndBoil(burned) {
  if (!MM || MM.phase !== 'boil') return;
  cancelAnimationFrame(MM_RAF);
  MM.phase = 'judge';
  mmEl('mm-fire').classList.remove('on');
  var cb = mmEl('mm-cook-btn');
  cb.disabled = true;
  var h = MM.heat;
  if (burned || h >= MM_ZONE.okHi) {
    mmEl('mm-pot-wrap').classList.add('burnt');
    mmEl('mm-msg').innerHTML = '앗 뜨거! 냄비가 <b>홀랑 탔어요</b> 🔥';
    mmLater(function () { mmFail('인어조림이 새까맣게 탔어…', '불을 너무 늦게 껐어요.'); }, 900);
    return;
  }
  if (h < MM_ZONE.okLo) {
    mmEl('mm-msg').innerHTML = '아직 <b>하나도 안 익었어요…</b>';
    mmLater(function () { mmFail('덜 익은 인어가 도망갔어…', '불을 너무 빨리 껐어요.'); }, 900);
    return;
  }
  var perfect = h >= MM_ZONE.perfLo && h <= MM_ZONE.perfHi;
  var stars = 3;
  if (MM.mistakes >= 1) stars--;
  if (!perfect) stars--;
  stars = Math.max(1, stars);
  MM.stars = stars;
  MM.perfect = perfect;
  mmEl('mm-msg').innerHTML = perfect ? '<b>딱 좋게</b> 익었어요! ✨' : '조금 아쉽지만 <b>먹을 만해요!</b>';
  mmLater(function () { if (MMS && !MMS.over) mmServe(); else mmShowDone(); }, 800);
}

/* =============== ④ 완성 =============== */
function mmShowDone() {
  if (!MM) return;
  MM.phase = 'done';
  mmSetStep('done');
  mmSound('win');
  var st = mmEl('mm-stage');
  st.className = 'mm-stage mm-donebg';
  var starHtml = '';
  for (var i = 0; i < 3; i++) starHtml += '<span class="mm-star' + (i < MM.stars ? ' on' : '') + '" style="animation-delay:' + (0.3 + i * 0.25) + 's">★</span>';
  var comment = MM.stars === 3 ? '완벽한 인어조림! 요리왕 탄생 👑' : (MM.stars === 2 ? '맛있는 인어조림 완성! 조금만 더 하면 별 3개!' : '먹을 수는 있는 인어조림… 다시 도전해 봐요!');
  var detail = [];
  detail.push(MM.mistakes ? '재료 순서 실수 ' + MM.mistakes + '번' : '재료 순서 완벽 ✔');
  detail.push(MM.perfect ? '익힘 딱 좋아 ✔' : '익힘 조금 아쉬움');
  st.innerHTML =
    '<div class="mm-card mm-donecard">' +
      '<div class="mm-sparkle">✨</div>' +
      '<div class="mm-big">인어조림 완성!</div>' +
      '<img class="mm-dish" src="' + MM_IMG.dish + '" alt="인어조림">' +
      '<div class="mm-stars">' + starHtml + '</div>' +
      '<p class="mm-comment">' + comment + '</p>' +
      '<p class="mm-detail">' + detail.join(' · ') + '</p>' +
      '<button class="mm-btn mm-btn-go" onclick="mmStartShop()">다시 만들기</button>' +
    '</div>';
}
