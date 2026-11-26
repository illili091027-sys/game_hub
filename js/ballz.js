/* 🧱 벽돌깨기 (혼자 하기)
   화면을 눌러 끌면서 방향을 정하고, 손을 떼면 공이 줄줄이 발사돼요.
   - 숫자 벽돌은 공에 맞을 때마다 숫자가 1씩 줄고, 0이 되면 부서져요.
   - 초록 동그라미(+)를 먹으면 다음 턴부터 공이 하나 늘어요.
   - 한 턴이 끝나면 벽돌이 한 칸씩 내려와요. 맨 아래까지 닿으면 끝!
   - 점수 = 도착한 턴(라운드). 최고 기록은 'gamehub_ballz_best'에 저장돼요(로그인하면 서버에도 저장). */

var BZ_W = 420, BZ_H = 620, BZ_COLS = 7, BZ_CELL = 60, BZ_ROWS = 9;
var BZ_FLOOR = 596, BZ_R = 7, BZ_SPEED = 14, BZ_GAP = 5;   /* 공 사이 간격(프레임) */
var BZ_MIN_VY = 0.14;                                      /* 거의 수평으로 쏘면 너무 오래 걸려서 막아요 */
var BZ = null, BZ_RAF = null;

function bzBestLoad() { try { return parseInt(localStorage.getItem('gamehub_ballz_best') || '0', 10) || 0; } catch (e) { return 0; } }
function bzBestSave(n) { try { localStorage.setItem('gamehub_ballz_best', String(n)); } catch (e) {} }

function bzNew() {
  BZ = { round: 1, balls: 1, lx: BZ_W / 2, bricks: [], items: [], state: 'aim', flying: [], fired: 0, frames: 0,
         collected: 0, firstLand: null, aim: null, over: false, best: bzBestLoad(), dirx: 0, diry: -1 };
  bzSpawnRow();
}

/* 맨 윗줄에 새 벽돌과 + 아이템을 만들어요 */
function bzSpawnRow() {
  var itemCol = Math.floor(Math.random() * BZ_COLS), any = false, c;
  BZ.items.push({ c: itemCol, row: 0 });
  for (c = 0; c < BZ_COLS; c++) {
    if (c === itemCol) continue;
    if (Math.random() < 0.55) {
      var hp = BZ.round + (Math.random() < 0.3 ? BZ.round : 0);
      BZ.bricks.push({ c: c, row: 0, hp: hp, hit: 0 }); any = true;
    }
  }
  if (!any) {
    c = (itemCol + 1 + Math.floor(Math.random() * (BZ_COLS - 1))) % BZ_COLS;
    BZ.bricks.push({ c: c, row: 0, hp: BZ.round, hit: 0 });
  }
}

/* 발사: 방향(dx, dy)은 위쪽을 향하는 단위 벡터 */
function bzFire(dx, dy) {
  if (!BZ || BZ.state !== 'aim' || BZ.over) return false;
  BZ.dirx = dx; BZ.diry = dy;
  BZ.state = 'fire'; BZ.frames = 0; BZ.fired = 0; BZ.collected = 0; BZ.firstLand = null; BZ.flying = [];
  BZ.aim = null;
  return true;
}

function bzClampDir(dx, dy) {
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= len; dy /= len;
  if (dy > -BZ_MIN_VY) { dx = (dx >= 0 ? 1 : -1) * Math.sqrt(1 - BZ_MIN_VY * BZ_MIN_VY); dy = -BZ_MIN_VY; }
  return { x: dx, y: dy };
}

/* 한 프레임(1/60초) 진행 */
function bzUpdate() {
  if (!BZ || BZ.over || BZ.state !== 'fire') return;
  BZ.frames++;
  /* 공을 하나씩 내보내요 */
  if (BZ.fired < BZ.balls && BZ.frames >= 1 + BZ.fired * BZ_GAP) {
    BZ.flying.push({ x: BZ.lx, y: BZ_FLOOR - BZ_R, vx: BZ.dirx * BZ_SPEED, vy: BZ.diry * BZ_SPEED, done: false });
    BZ.fired++;
  }
  var STEPS = 4, i, s;
  for (i = 0; i < BZ.flying.length; i++) {
    var b = BZ.flying[i];
    if (b.done) continue;
    for (s = 0; s < STEPS && !b.done; s++) bzStep(b, 1 / STEPS);
  }
  /* 30초가 넘으면 남은 공을 모아요 (안 끝나는 경우 방지) */
  if (BZ.frames > 60 * 30) bzRecall();
  if (BZ.fired >= BZ.balls && BZ.flying.every(function (b) { return b.done; })) bzEndTurn();
}

function bzStep(b, f) {
  b.x += b.vx * f; b.y += b.vy * f;
  if (b.x < BZ_R) { b.x = BZ_R; b.vx = Math.abs(b.vx); }
  else if (b.x > BZ_W - BZ_R) { b.x = BZ_W - BZ_R; b.vx = -Math.abs(b.vx); }
  if (b.y < BZ_R) { b.y = BZ_R; b.vy = Math.abs(b.vy); }
  if (b.y >= BZ_FLOOR - BZ_R && b.vy > 0) {   /* 바닥에 닿음 */
    b.y = BZ_FLOOR - BZ_R; b.done = true;
    if (BZ.firstLand === null) BZ.firstLand = Math.max(BZ_R, Math.min(BZ_W - BZ_R, b.x));
    return;
  }
  /* 아이템(+) 먹기 */
  var k;
  for (k = BZ.items.length - 1; k >= 0; k--) {
    var it = BZ.items[k], ix = it.c * BZ_CELL + BZ_CELL / 2, iy = it.row * BZ_CELL + BZ_CELL / 2;
    if ((b.x - ix) * (b.x - ix) + (b.y - iy) * (b.y - iy) < (BZ_R + 11) * (BZ_R + 11)) { BZ.items.splice(k, 1); BZ.collected++; }
  }
  /* 벽돌 부딪히기 (한 걸음에 한 개만) */
  for (k = 0; k < BZ.bricks.length; k++) {
    var br = BZ.bricks[k];
    var x0 = br.c * BZ_CELL + 3, y0 = br.row * BZ_CELL + 3, x1 = x0 + BZ_CELL - 6, y1 = y0 + BZ_CELL - 6;
    var cx = Math.max(x0, Math.min(b.x, x1)), cy = Math.max(y0, Math.min(b.y, y1));
    var dx = b.x - cx, dy = b.y - cy;
    if (dx * dx + dy * dy < BZ_R * BZ_R) {
      if (dx === 0 && dy === 0) {   /* 공 중심이 벽돌 안: 가장 가까운 면으로 밀어내요 */
        var dl = b.x - x0, dr = x1 - b.x, dt = b.y - y0, db = y1 - b.y, m = Math.min(dl, dr, dt, db);
        if (m === dl) { b.x = x0 - BZ_R; b.vx = -Math.abs(b.vx); }
        else if (m === dr) { b.x = x1 + BZ_R; b.vx = Math.abs(b.vx); }
        else if (m === dt) { b.y = y0 - BZ_R; b.vy = -Math.abs(b.vy); }
        else { b.y = y1 + BZ_R; b.vy = Math.abs(b.vy); }
      } else if (Math.abs(dx) > Math.abs(dy)) {
        b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx); b.x = cx + (dx > 0 ? BZ_R : -BZ_R) + (dx > 0 ? 0.01 : -0.01);
      } else {
        b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy); b.y = cy + (dy > 0 ? BZ_R : -BZ_R) + (dy > 0 ? 0.01 : -0.01);
      }
      br.hp--; br.hit = 6;
      if (br.hp <= 0) BZ.bricks.splice(k, 1);
      /* 속도가 일정하게 유지되도록 다시 맞춰요 */
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
      b.vx = b.vx / sp * BZ_SPEED; b.vy = b.vy / sp * BZ_SPEED;
      break;
    }
  }
}

function bzRecall() {   /* 날아다니는 공을 전부 바닥으로 */
  if (!BZ || BZ.state !== 'fire') return;
  BZ.fired = BZ.balls;
  BZ.flying.forEach(function (b) {
    if (!b.done) { b.done = true; if (BZ.firstLand === null) BZ.firstLand = Math.max(BZ_R, Math.min(BZ_W - BZ_R, b.x)); }
  });
  if (BZ.firstLand === null) BZ.firstLand = BZ.lx;
}

function bzEndTurn() {
  if (BZ.firstLand !== null) BZ.lx = BZ.firstLand;
  BZ.balls += BZ.collected;
  BZ.round++;
  BZ.state = 'aim'; BZ.flying = [];
  BZ.bricks.forEach(function (b) { b.row++; });
  BZ.items.forEach(function (i) { i.row++; });
  BZ.items = BZ.items.filter(function (i) { return i.row < BZ_ROWS; });
  bzSpawnRow();
  if (BZ.bricks.some(function (b) { return b.row >= BZ_ROWS; })) bzGameOver();
}

function bzGameOver() {
  BZ.over = true; BZ.state = 'over';
  var score = BZ.round - 1;   /* 마지막으로 막아낸 턴 수 */
  if (score > BZ.best) { BZ.best = score; bzBestSave(score); }
  bzHud();
  var o = document.getElementById('bz-over');
  if (o) { o.innerHTML = '<b>게임 끝!</b> ' + score + '턴을 버텼어요' + (score >= BZ.best && score > 0 ? ' · 👑 최고 기록' : ''); o.style.display = 'flex'; }
}

/* ---------- 화면 ---------- */
function startBallzGame() {
  stopBallzGame();
  document.getElementById('bz-root').innerHTML =
    '<div class="bz-hud"><span>SCORE <b id="bz-score">1</b></span><span>👑 <b id="bz-best">0</b></span><span>⚪ x<b id="bz-balls">1</b></span></div>' +
    '<div class="bz-board"><canvas id="bz-canvas" class="bz-canvas"></canvas>' +
    '<div id="bz-over" class="bz-over" style="display:none"></div></div>' +
    '<div class="bz-btns"><button class="btn btn-ghost" id="bz-recall" onclick="bzRecallClick()">⏬ 공 모으기</button>' +
    '<button class="btn btn-ghost" onclick="startBallzGame()">↻ 처음부터</button></div>' +
    '<p class="bz-help">화면을 누른 채 끌어서 방향을 정하고 손을 떼면 발사! 초록 +를 먹으면 공이 늘어요. 위쪽으로만 쏠 수 있어요.</p>';
  bzNew();
  var cv = document.getElementById('bz-canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = BZ_W * dpr; cv.height = BZ_H * dpr;
  BZ.cv = cv; BZ.ctx = cv.getContext('2d'); BZ.dpr = dpr;
  function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * BZ_W / r.width, y: (e.clientY - r.top) * BZ_H / r.height }; }
  function aimTo(e) {
    var p = pt(e), ly = BZ_FLOOR - BZ_R;
    if (p.y >= ly - 12) { BZ.aim = null; return; }   /* 아래쪽이면 취소 */
    BZ.aim = bzClampDir(p.x - BZ.lx, p.y - ly);
  }
  cv.addEventListener('pointerdown', function (e) { if (BZ.state !== 'aim') return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} BZ.dragging = true; aimTo(e); });
  cv.addEventListener('pointermove', function (e) { if (BZ.dragging && BZ.state === 'aim') aimTo(e); });
  function up() { if (!BZ.dragging) return; BZ.dragging = false; if (BZ.aim) bzFire(BZ.aim.x, BZ.aim.y); BZ.aim = null; }
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', function () { BZ.dragging = false; BZ.aim = null; });
  bzHud();
  var last = performance.now(), acc = 0;
  (function loop(now) {
    acc += Math.min(100, now - last); last = now;
    while (acc >= 1000 / 60) { bzUpdate(); acc -= 1000 / 60; }
    bzDraw(); bzHud();
    BZ_RAF = requestAnimationFrame(loop);
  })(last);
}
function stopBallzGame() { if (BZ_RAF) cancelAnimationFrame(BZ_RAF); BZ_RAF = null; }
function bzRecallClick() { bzRecall(); }

function bzHud() {
  var s = document.getElementById('bz-score'); if (!s || !BZ) return;
  s.textContent = BZ.over ? BZ.round - 1 : BZ.round;
  document.getElementById('bz-best').textContent = BZ.best;
  document.getElementById('bz-balls').textContent = BZ.balls;
  var rc = document.getElementById('bz-recall'); if (rc) rc.disabled = BZ.state !== 'fire';
}

/* 조준선: 벽에 한 번 튕기는 것까지, 벽돌에 닿으면 거기서 멈춰요 */
function bzAimPoints() {
  var pts = [], x = BZ.lx, y = BZ_FLOOR - BZ_R, vx = BZ.aim.x * 4, vy = BZ.aim.y * 4, bounced = 0, d;
  for (d = 0; d < 900; d += 4) {
    x += vx; y += vy;
    if (x < BZ_R) { x = BZ_R; vx = -vx; bounced++; } else if (x > BZ_W - BZ_R) { x = BZ_W - BZ_R; vx = -vx; bounced++; }
    if (y < BZ_R) { y = BZ_R; vy = -vy; bounced++; }
    if (bounced > 2 || y > BZ_FLOOR) break;
    var hit = BZ.bricks.some(function (b) { var x0 = b.c * BZ_CELL + 3, y0 = b.row * BZ_CELL + 3; return x > x0 - BZ_R && x < x0 + BZ_CELL - 6 + BZ_R && y > y0 - BZ_R && y < y0 + BZ_CELL - 6 + BZ_R; });
    if (hit) break;
    if (d % 20 === 0) pts.push([x, y]);
  }
  return pts;
}

function bzDraw() {
  var ctx = BZ.ctx; if (!ctx) return;
  ctx.setTransform(BZ.dpr, 0, 0, BZ.dpr, 0, 0);
  ctx.clearRect(0, 0, BZ_W, BZ_H);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, 0, BZ_W, BZ_H);
  /* 바닥선 */
  ctx.strokeStyle = 'rgba(245,243,231,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, BZ_FLOOR); ctx.lineTo(BZ_W, BZ_FLOOR); ctx.stroke();
  /* 벽돌 */
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 20px "LeeSeoyun", sans-serif';
  BZ.bricks.forEach(function (b) {
    var t = Math.min(1, b.hp / Math.max(4, BZ.round * 1.6)), x = b.c * BZ_CELL + 3, y = b.row * BZ_CELL + 3, w = BZ_CELL - 6;
    ctx.fillStyle = 'hsl(' + (32 - 32 * t) + ',85%,' + (64 - 14 * t + (b.hit > 0 ? 12 : 0)) + '%)';
    ctx.fillRect(x, y, w, w);
    ctx.fillStyle = '#fff'; ctx.fillText(b.hp, x + w / 2, y + w / 2 + 1);
    if (b.hit > 0) b.hit--;
  });
  /* 아이템 */
  BZ.items.forEach(function (it) {
    var x = it.c * BZ_CELL + BZ_CELL / 2, y = it.row * BZ_CELL + BZ_CELL / 2;
    ctx.strokeStyle = '#6fd49b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.stroke();
    ctx.fillStyle = '#6fd49b'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
  });
  /* 조준선 */
  if (BZ.aim && BZ.state === 'aim') {
    ctx.fillStyle = 'rgba(245,243,231,0.75)';
    bzAimPoints().forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, 7); ctx.fill(); });
  }
  /* 공 */
  ctx.fillStyle = '#f5f3e7';
  var ly = BZ_FLOOR - BZ_R;
  if (BZ.state === 'aim' || BZ.over) { ctx.beginPath(); ctx.arc(BZ.lx, ly, BZ_R, 0, 7); ctx.fill(); }
  else {
    var waiting = BZ.balls - BZ.fired;
    if (waiting > 0) { ctx.beginPath(); ctx.arc(BZ.lx, ly, BZ_R, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(245,243,231,0.7)'; ctx.font = '12px "LeeSeoyun", sans-serif'; ctx.fillText('x' + waiting, BZ.lx, ly - 16); ctx.fillStyle = '#f5f3e7'; }
    var landed = false;
    BZ.flying.forEach(function (b) {
      if (b.done) { if (!landed && BZ.firstLand !== null) { landed = true; ctx.beginPath(); ctx.arc(BZ.firstLand, ly, BZ_R, 0, 7); ctx.fill(); } return; }
      ctx.beginPath(); ctx.arc(b.x, b.y, BZ_R, 0, 7); ctx.fill();
    });
  }
}
