/* 🎰 도박방 (혼자 하기)
   분필(게임 속 점수)로 룰렛 · 주사위 · 동전 · 슬롯을 즐겨요. 진짜 돈과는 아무 상관 없어요.
   - 한 번에 걸 수 있는 분필: 10 / 20 / 50 / 100개
   - 하루 순손실이 CS_DAILY_LIMIT(300)개에 닿으면 그날은 문을 닫아요 (내일 다시!)
   - 분필 지갑은 livechat.js의 walletLoad / walletSave를 그대로 써요. */

var CS_DAILY_LIMIT = 300;
var CS_BETS = [10, 20, 50, 100];
var CS_RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
var CS_DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
var CS_SYM = ['🍒', '🍋', '🔔', '⭐', '7️⃣'];
var CS = { tab: 'roulette', bet: 10, busy: false, pick: { roulette: 'red', dice: 'high', coin: 'H' }, num: 7, timers: [] };

function csRand(n) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function csLater(fn, ms) { var t = setTimeout(fn, ms); CS.timers.push(t); }

/* ---------- 하루 한도 ---------- */
function csLoss() {
  var w = walletLoad(), today = new Date().toDateString();
  return (w.casino && w.casino.d === today) ? w.casino.loss : 0;
}
function csAllow() { return Math.max(0, CS_DAILY_LIMIT - csLoss()); }
function csMaxBet() { return Math.min(walletCoins(), csAllow(), 100); }

function startCasinoGame() { stopCasinoGame(); CS.busy = false; csBuild(); csShowTab(CS.tab); }
function stopCasinoGame() { CS.timers.forEach(clearTimeout); CS.timers = []; CS.busy = false; }

function csBuild() {
  var tabs = [['roulette', '🎡 룰렛'], ['dice', '🎲 주사위'], ['coin', '🪙 동전'], ['slot', '🎰 슬롯']];
  var html = '<div class="cs-top"><span>내 분필 ' + CHALK_IMG + ' <b class="coin-balance">0</b></span><span id="cs-allow"></span></div>' +
    '<div class="cs-note">분필은 게임 속 점수일 뿐 진짜 돈이 아니에요. 하루 순손실이 ' + CS_DAILY_LIMIT + '개가 되면 그날은 쉬어요.</div>' +
    '<div class="cs-tabs">';
  tabs.forEach(function (t) { html += '<button class="cs-tab" data-t="' + t[0] + '" onclick="csShowTab(\'' + t[0] + '\')">' + t[1] + '</button>'; });
  html += '</div><div class="cs-bet"><span>걸 분필</span><div id="cs-chips"></div></div>' +
    '<div id="cs-game" class="cs-game"></div><div id="cs-msg" class="cs-msg"></div>';
  document.getElementById('cs-root').innerHTML = html;
}

function csShowTab(t) {
  if (CS.busy) return;
  CS.tab = t;
  document.querySelectorAll('.cs-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
  var g = document.getElementById('cs-game');
  if (t === 'roulette') {
    g.innerHTML = '<div class="cs-stage"><div id="cs-wheel" class="cs-wheel green">0</div></div>' +
      '<div class="cs-picks" id="cs-picks">' +
        '<button data-p="red" onclick="csPick(\'red\')">🔴 빨강 x2</button><button data-p="black" onclick="csPick(\'black\')">⚫ 검정 x2</button>' +
        '<button data-p="odd" onclick="csPick(\'odd\')">홀 x2</button><button data-p="even" onclick="csPick(\'even\')">짝 x2</button>' +
        '<button data-p="num" onclick="csPick(\'num\')">숫자 x36 <input id="cs-num" type="number" min="0" max="36" value="' + CS.num + '" onclick="event.stopPropagation()" oninput="csNum(this.value)" /></button>' +
      '</div><p class="cs-help">0이 나오면 모두 진 걸로 해요.</p><button class="btn btn-primary cs-go" onclick="csRoulette()">🎡 돌리기</button>';
  } else if (t === 'dice') {
    g.innerHTML = '<div class="cs-stage"><span id="cs-d1" class="cs-die">⚀</span><span id="cs-d2" class="cs-die">⚀</span></div>' +
      '<div class="cs-picks" id="cs-picks"><button data-p="low" onclick="csPick(\'low\')">낮음 2~6 x2.3</button><button data-p="seven" onclick="csPick(\'seven\')">딱 7 x5.5</button><button data-p="high" onclick="csPick(\'high\')">높음 8~12 x2.3</button></div>' +
      '<p class="cs-help">주사위 두 개의 합을 맞혀요.</p><button class="btn btn-primary cs-go" onclick="csDice()">🎲 굴리기</button>';
  } else if (t === 'coin') {
    g.innerHTML = '<div class="cs-stage"><div id="cs-coin" class="cs-coin">?</div></div>' +
      '<div class="cs-picks" id="cs-picks"><button data-p="H" onclick="csPick(\'H\')">앞면 x1.95</button><button data-p="T" onclick="csPick(\'T\')">뒷면 x1.95</button></div>' +
      '<button class="btn btn-primary cs-go" onclick="csCoin()">🪙 던지기</button>';
  } else {
    g.innerHTML = '<div class="cs-stage"><span class="cs-reel" id="cs-r0">❔</span><span class="cs-reel" id="cs-r1">❔</span><span class="cs-reel" id="cs-r2">❔</span></div>' +
      '<p class="cs-help">세 개가 같으면 x10, 두 개가 같으면 x1.2</p><button class="btn btn-primary cs-go" onclick="csSlot()">🎰 레버 당기기</button>';
  }
  csRefresh();
}

function csPick(p) { if (CS.busy) return; CS.pick[CS.tab] = p; csRefresh(); }
function csNum(v) { v = parseInt(v, 10); if (isNaN(v)) v = 0; CS.num = Math.max(0, Math.min(36, v)); CS.pick.roulette = 'num'; csRefresh(); }
function csSetBet(n) { if (CS.busy) return; CS.bet = n; csRefresh(); }

function csRefresh() {
  walletRender();
  var max = csMaxBet();
  if (CS.bet > max) { var ok = CS_BETS.filter(function (b) { return b <= max; }); CS.bet = ok.length ? ok[ok.length - 1] : CS_BETS[0]; }
  var h = '';
  CS_BETS.forEach(function (b) { h += '<button class="cs-chip' + (b === CS.bet ? ' on' : '') + '"' + (b > max ? ' disabled' : '') + ' onclick="csSetBet(' + b + ')">' + b + '</button>'; });
  var chips = document.getElementById('cs-chips'); if (chips) chips.innerHTML = h;
  var al = document.getElementById('cs-allow');
  if (al) al.textContent = csAllow() > 0 ? '오늘 더 잃어도 되는 분필 ' + csAllow() + '개' : '오늘은 여기까지! 내일 또 와요 🌙';
  document.querySelectorAll('#cs-picks button').forEach(function (b) { b.classList.toggle('on', b.dataset.p === CS.pick[CS.tab]); });
  document.querySelectorAll('.cs-go').forEach(function (b) { b.disabled = CS.busy; });
}

function csMsg(text, cls) { var m = document.getElementById('cs-msg'); if (m) { m.className = 'cs-msg ' + (cls || ''); m.textContent = text; } }

/* 판 시작 전 확인: 걸 수 있으면 걸 분필을 돌려줘요 */
function csCanBet() {
  if (CS.busy) return 0;
  if (csAllow() <= 0) { csMsg('오늘은 여기까지! 내일 다시 와요 🌙'); return 0; }
  if (walletCoins() < CS_BETS[0]) { csMsg('분필이 모자라요 😢 다른 게임에서 분필을 모아 와요!'); return 0; }
  var stake = Math.min(CS.bet, csMaxBet());
  if (stake < 1) { csMsg('걸 수 있는 분필이 없어요.'); return 0; }
  return stake;
}

/* 정산: mult배를 돌려받음 (0이면 걸었던 분필을 잃음) */
function csSettle(stake, mult, winText) {
  var back = Math.floor(stake * mult), net = back - stake;
  var w = walletLoad(), today = new Date().toDateString();
  if (!w.casino || w.casino.d !== today) w.casino = { d: today, loss: 0 };
  w.casino.loss -= net;
  w.coins = Math.max(0, Math.round(w.coins + net));
  walletSave(w);
  if (net > 0) csMsg('🎉 ' + winText + ' +' + net + '분필!', 'win');
  else if (net === 0) csMsg('😮 ' + winText + ' 본전이에요.', '');
  else csMsg('😢 아쉬워요! -' + stake + '분필', 'lose');
  CS.busy = false;
  csRefresh();
}

/* 숫자가 점점 느리게 바뀌는 연출 */
function csSpin(steps, tick, done) {
  CS.busy = true; csRefresh(); csMsg('');
  var i = 0;
  (function next() {
    tick(i);
    i++;
    if (i < steps) csLater(next, 45 + i * 11); else csLater(done, 260);
  })();
}

/* ---------- 룰렛 ---------- */
function csRoulette() {
  var stake = csCanBet(); if (!stake) return;
  var pick = CS.pick.roulette, r = csRand(37), wheel = document.getElementById('cs-wheel');
  function paint(n) { wheel.textContent = n; wheel.className = 'cs-wheel ' + (n === 0 ? 'green' : CS_RED.indexOf(n) > -1 ? 'red' : 'black'); }
  csSpin(20, function () { paint(csRand(37)); }, function () {
    paint(r);
    var win = false, mult = 0;
    if (r !== 0) {
      if (pick === 'red') { win = CS_RED.indexOf(r) > -1; mult = 2; }
      else if (pick === 'black') { win = CS_RED.indexOf(r) === -1; mult = 2; }
      else if (pick === 'odd') { win = r % 2 === 1; mult = 2; }
      else if (pick === 'even') { win = r % 2 === 0; mult = 2; }
    }
    if (pick === 'num') { win = r === CS.num; mult = 36; }
    csSettle(stake, win ? mult : 0, r + '번! 맞혔어요');
  });
}

/* ---------- 주사위 ---------- */
function csDice() {
  var stake = csCanBet(); if (!stake) return;
  var pick = CS.pick.dice, a = csRand(6), b = csRand(6), d1 = document.getElementById('cs-d1'), d2 = document.getElementById('cs-d2');
  csSpin(14, function () { d1.textContent = CS_DICE[csRand(6)]; d2.textContent = CS_DICE[csRand(6)]; }, function () {
    d1.textContent = CS_DICE[a]; d2.textContent = CS_DICE[b];
    var sum = a + b + 2, mult = 0;
    if (pick === 'low' && sum <= 6) mult = 2.3;
    else if (pick === 'high' && sum >= 8) mult = 2.3;
    else if (pick === 'seven' && sum === 7) mult = 5.5;
    csSettle(stake, mult, '합이 ' + sum + '! 맞혔어요');
    if (!mult) csMsg('😢 합은 ' + sum + '이었어요! -' + stake + '분필', 'lose');
  });
}

/* ---------- 동전 ---------- */
function csCoin() {
  var stake = csCanBet(); if (!stake) return;
  var pick = CS.pick.coin, side = csRand(2) ? 'H' : 'T', c = document.getElementById('cs-coin');
  csSpin(12, function (i) { c.textContent = i % 2 ? '뒤' : '앞'; c.classList.toggle('flip'); }, function () {
    c.textContent = side === 'H' ? '앞' : '뒤';
    csSettle(stake, pick === side ? 1.95 : 0, (side === 'H' ? '앞면' : '뒷면') + '! 맞혔어요');
  });
}

/* ---------- 슬롯 ---------- */
function csSlot() {
  var stake = csCanBet(); if (!stake) return;
  var res = [csRand(5), csRand(5), csRand(5)], rs = [0, 1, 2].map(function (i) { return document.getElementById('cs-r' + i); });
  csSpin(18, function (i) { rs.forEach(function (el, k) { if (i < 10 + k * 3) el.textContent = CS_SYM[csRand(5)]; }); }, function () {
    rs.forEach(function (el, k) { el.textContent = CS_SYM[res[k]]; });
    var same = (res[0] === res[1] ? 1 : 0) + (res[1] === res[2] ? 1 : 0) + (res[0] === res[2] ? 1 : 0);
    var mult = same === 3 ? 10 : same === 1 ? 1.2 : 0;
    csSettle(stake, mult, same === 3 ? '잭팟!' : '두 개 일치!');
  });
}
