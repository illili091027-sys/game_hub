/* ---------------- 비틀비틀 세이렌 (혼자하기 전용, 균형 잡고 오래 걷기) ----------------
   세이렌이 저절로 앞으로 걸어가는데, 몸이 계속 앞뒤로 기우뚱거려요. ←/→ 를 톡톡 눌러서
   몸을 반대쪽으로 밀어 균형을 잡고, 넘어지기 전까지 최대한 멀리(m) 걸어가면 돼요.
   멀리 갈수록 더 빨리 기울고 바람(흔들림)도 세져요.
   물리: 거꾸로 세운 막대(역진자) - 기울어진 쪽으로 점점 더 빨리 넘어가려는 힘 + 무작위 바람.
   (화면 그림은 전부 코드로 직접 그린 오리지널 그림이에요) */
var SK_W = 800, SK_H = 450, SK_GROUND = 370;
var SK = null;
var SK_RAF = null;
var SK_CANVAS = null, SK_CTX = null, SK_SCALE = 1;
var SK_BEST = 0;
var SK_FALL_ANGLE = 1.0;     // 이 각도(라디안, 약 57도)를 넘으면 넘어짐
var SK_PUSH = 0.95;          // 한 번 누를 때 반대로 밀어주는 힘
var SK_PX_PER_M = 60;

function stopStorkGame() {
  cancelAnimationFrame(SK_RAF);
  SK_RAF = null;
  if (SK) SK.running = false;
}

function startStorkGame() {
  stopStorkGame();
  SK_CANVAS = document.getElementById('sk-canvas');
  SK_CTX = SK_CANVAS.getContext('2d');
  skResize();
  skReset();
  skShowOverlay('start');
  skDraw();
}

function skReset() {
  SK = {
    running: false, over: false, falling: false,
    theta: (Math.random() < 0.5 ? -1 : 1) * 0.04, omega: 0,
    wind: 0, dist: 0, walkPhase: 0, t: 0, lastTs: 0,
    fallDir: 0, fallT: 0
  };
}

function skBegin() {
  if (SK && SK.running) return;
  skReset();
  skHideOverlay();
  SK.running = true;
  SK.lastTs = 0;
  cancelAnimationFrame(SK_RAF);
  SK_RAF = requestAnimationFrame(skTick);
}

function skPush(dir) {
  if (!SK || !SK.running || SK.falling) return;
  SK.omega += dir * SK_PUSH;
  SK.flash = { dir: dir, life: 0.18 };
}

function skLevel() { return Math.min(1, SK.dist / 400); } // 0 → 1 (400m에서 최고 난이도)

function skTick(ts) {
  if (!SK || !SK.running) return;
  var dt = SK.lastTs ? Math.min(0.033, (ts - SK.lastTs) / 1000) : 0.016;
  SK.lastTs = ts;
  SK.t += dt;
  var lv = skLevel();

  if (!SK.falling) {
    // 기울어진 쪽으로 넘어가려는 힘(멀리 갈수록 강해짐) + 바람
    var k = 2.4 + lv * 3.4;
    SK.wind += (Math.random() - 0.5) * (1.6 + lv * 4.5) * dt * 6;
    SK.wind *= 0.985;
    SK.wind = Math.max(-1.2 - lv, Math.min(1.2 + lv, SK.wind));
    // 걸음마다 살짝 흔들림
    var stepWobble = Math.sin(SK.walkPhase * 2) * (0.25 + lv * 0.35);
    var alpha = k * Math.sin(SK.theta) + SK.wind * 0.55 + stepWobble * 0.3;
    SK.omega += alpha * dt;
    SK.omega *= (1 - 0.55 * dt);
    SK.theta += SK.omega * dt;
    // 걷기
    var speed = 1.3 + lv * 1.6; // m/s
    SK.dist += speed * dt;
    SK.walkPhase += speed * dt * 3.2;
    if (Math.abs(SK.theta) > SK_FALL_ANGLE) {
      SK.falling = true;
      if (typeof playFart === 'function') playFart();
      SK.fallDir = SK.theta > 0 ? 1 : -1;
      SK.fallT = 0;
    }
  } else {
    // 쓰러지는 연출
    SK.fallT += dt;
    SK.omega += SK.fallDir * 7 * dt;
    SK.theta += SK.omega * dt;
    if (Math.abs(SK.theta) >= 1.62) {
      SK.theta = 1.62 * SK.fallDir;
      if (SK.fallT > 0.6) { skGameOver(); return; }
    }
  }
  if (SK.flash) { SK.flash.life -= dt; if (SK.flash.life <= 0) SK.flash = null; }
  skDraw();
  document.getElementById('sk-dist').textContent = Math.floor(SK.dist);
  SK_RAF = requestAnimationFrame(skTick);
}

function skGameOver() {
  SK.running = false;
  SK.over = true;
  var m = Math.floor(SK.dist);
  var isBest = m > SK_BEST;
  if (isBest) SK_BEST = m;
  document.getElementById('sk-best').textContent = SK_BEST;
  skDraw();
  skShowOverlay('over', m, isBest);
}

function skShowOverlay(kind, m, isBest) {
  var ov = document.getElementById('sk-overlay');
  ov.style.display = '';
  if (kind === 'start') {
    ov.className = 'sk-overlay start';
    ov.innerHTML = '<div class="sk-ov-title">비틀비틀 세이렌</div>' +
      '<div class="sk-ov-text">←/→ 를 톡톡 눌러서 세이렌이 넘어지지 않게 균형을 잡아요.<br>최대한 멀리 걸어가 보세요!</div>' +
      '<button class="btn btn-primary sk-ov-btn" onclick="skBegin()">시작하기 (스페이스바)</button>';
  } else {
    ov.className = 'sk-overlay over';
    ov.innerHTML = '<div class="sk-ov-big">' + m + '<span>m</span></div>' +
      '<div class="sk-ov-text">' + (isBest && m > 0 ? '🎉 최고 기록!' : '최고 기록 ' + SK_BEST + 'm') + '</div>' +
      '<div class="sk-ov-btns"><button class="btn btn-primary" onclick="skBegin()">다시 하기 (스페이스바)</button>' +
      '<button class="btn btn-ghost" onclick="goHome()">그만하기</button></div>';
  }
}
function skHideOverlay() { document.getElementById('sk-overlay').style.display = 'none'; }

/* ---- 그리기 ---- */
function skResize() {
  if (!SK_CANVAS) return;
  var rect = SK_CANVAS.getBoundingClientRect();
  var w = rect.width || SK_W;
  var dpr = window.devicePixelRatio || 1;
  SK_CANVAS.width = Math.round(w * dpr);
  SK_CANVAS.height = Math.round(w * (SK_H / SK_W) * dpr);
  SK_SCALE = (w * dpr) / SK_W;
}

function skHash(n) { var x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }

function skDrawScenery(ctx) {
  var off = SK ? SK.dist * SK_PX_PER_M : 0;
  // 하늘
  var g = ctx.createLinearGradient(0, 0, 0, SK_H);
  g.addColorStop(0, '#dff3ff');
  g.addColorStop(1, '#f6fbff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SK_W, SK_H);
  // 먼 언덕 덤불 (천천히)
  var far = off * 0.25;
  ctx.fillStyle = '#7cc6e8';
  ctx.strokeStyle = '#4fa9d4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, SK_GROUND - 40);
  for (var x = -60; x <= SK_W + 60; x += 30) {
    var wx = x + far;
    var idx = Math.floor(wx / 30);
    var h = 55 + skHash(idx) * 45;
    ctx.lineTo(x - (far % 30), SK_GROUND - 40 - h);
  }
  ctx.lineTo(SK_W, SK_GROUND - 40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 들판
  var fg = ctx.createLinearGradient(0, SK_GROUND - 120, 0, SK_GROUND);
  fg.addColorStop(0, '#9fd8f0');
  fg.addColorStop(1, '#e8f6fb');
  ctx.fillStyle = fg;
  ctx.fillRect(0, SK_GROUND - 70, SK_W, 70);
  // 울타리 (중간 속도)
  var mid = off * 0.6;
  var gap = 190;
  ctx.strokeStyle = '#9a9a9a';
  ctx.lineWidth = 2;
  [SK_GROUND - 95, SK_GROUND - 60, SK_GROUND - 28].forEach(function (y, i) {
    ctx.beginPath();
    for (var x2 = 0; x2 <= SK_W; x2 += 20) {
      var yy = y + Math.sin((x2 + mid) / 70 + i) * 2;
      if (x2 === 0) ctx.moveTo(x2, yy); else ctx.lineTo(x2, yy);
    }
    ctx.stroke();
    if (i === 0) {
      for (var b = -(mid % 40); b < SK_W; b += 40) {
        ctx.beginPath(); ctx.moveTo(b - 4, y - 4); ctx.lineTo(b + 4, y + 4); ctx.moveTo(b + 4, y - 4); ctx.lineTo(b - 4, y + 4); ctx.stroke();
      }
    }
  });
  for (var px = -(mid % gap) - 20; px < SK_W + 20; px += gap) {
    var pIdx = Math.floor((px + mid) / gap);
    var lean = (skHash(pIdx) - 0.5) * 0.08;
    ctx.save();
    ctx.translate(px, SK_GROUND - 4);
    ctx.rotate(lean);
    ctx.fillStyle = '#ecefe8';
    ctx.strokeStyle = '#a8aaa4';
    ctx.lineWidth = 2;
    ctx.fillRect(-7, -110, 14, 110);
    ctx.strokeRect(-7, -110, 14, 110);
    ctx.restore();
  }
  // 땅 + 낙엽 (가장 빠르게)
  ctx.fillStyle = '#f6e7c1';
  ctx.fillRect(0, SK_GROUND, SK_W, SK_H - SK_GROUND);
  ctx.strokeStyle = '#d8d2c0';
  ctx.beginPath(); ctx.moveTo(0, SK_GROUND); ctx.lineTo(SK_W, SK_GROUND); ctx.stroke();
  var cols = ['#f4a3a8', '#ffffff', '#e8c48a', '#9fd3e6']; // 조개껍데기·조약돌
  var leafGap = 26;
  var start = Math.floor(off / leafGap) - 2;
  for (var li = start; li < start + SK_W / leafGap + 4; li++) {
    for (var row = 0; row < 3; row++) {
      var seed = li * 3 + row;
      var lx = li * leafGap - off + skHash(seed) * 20;
      var ly = SK_GROUND + 16 + row * 22 + skHash(seed + 9) * 10;
      ctx.fillStyle = cols[Math.floor(skHash(seed + 3) * 4)];
      ctx.beginPath();
      ctx.ellipse(lx, ly, 9 + skHash(seed + 5) * 5, 3.5, skHash(seed + 7) * 0.8 - 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* 세이렌: 사용자가 넣은 캐릭터 그림을 발밑(아래 가운데)을 기준으로 기울기(theta)만큼 돌려서 그려요.
   걸을 때는 통통 튀면서 좌우로 왔다 갔다(뒤뚱뒤뚱), 넘어지면 땅에 철퍼덕 누워요. */
var SK_IMG = null;
function skDrawStork(ctx) {
  if (!SK_IMG && typeof SIREN_IMG_SRC !== 'undefined') { SK_IMG = new Image(); SK_IMG.src = SIREN_IMG_SRC; }
  var th = SK ? SK.theta : 0;
  var phase = SK ? SK.walkPhase : 0;
  var walking = SK && SK.running && !SK.falling;
  var h = 210, w = h * (typeof SIREN_W !== 'undefined' ? SIREN_W / SIREN_H : 0.9);
  // 왔다 갔다: 걸음에 맞춰 좌우로 살랑 + 위아래로 통통
  var sway = walking ? Math.sin(phase) * 18 : 0;
  var hop = walking ? Math.abs(Math.sin(phase)) * 14 : 0;
  var wob = walking ? Math.sin(phase) * 0.06 : 0;
  var footX = 340 + sway, footY = SK_GROUND + 6;
  // 그림자
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.beginPath(); ctx.ellipse(footX, SK_GROUND + 4, 70 - hop * 1.5, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(footX, footY - hop);
  ctx.rotate(th + wob);
  if (SK_IMG && SK_IMG.complete && SK_IMG.naturalWidth) {
    ctx.drawImage(SK_IMG, -w / 2, -h, w, h);
  } else {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(0, -h / 2, w / 2.4, h / 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // 넘어지면 머리 위에 별 빙글빙글
  if (SK && (SK.falling || SK.over)) {
    var t = (SK.t || 0) * 4;
    var cx = footX + Math.sin(th) * h * 0.85, cy = footY - Math.cos(th) * h * 0.85;
    ctx.fillStyle = '#f2c744';
    ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
    for (var i = 0; i < 3; i++) ctx.fillText('★', cx + Math.cos(t + i * 2.1) * 34, cy - 20 + Math.sin(t + i * 2.1) * 10);
  }
}

function skDrawBalanceMeter(ctx) {
  if (!SK) return;
  var cx = SK_W / 2, y = 40, w = 260;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(cx - w / 2, y - 6, w, 12);
  var danger = Math.min(1, Math.abs(SK.theta) / SK_FALL_ANGLE);
  var col = danger < 0.5 ? '#6fc364' : (danger < 0.8 ? '#f2c744' : '#f2836b');
  var px = cx + (SK.theta / SK_FALL_ANGLE) * (w / 2);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(Math.max(cx - w / 2, Math.min(cx + w / 2, px)), y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, y - 12); ctx.lineTo(cx, y + 12); ctx.stroke();
  if (SK.flash) {
    ctx.fillStyle = 'rgba(111,195,223,' + (SK.flash.life * 4) + ')';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(SK.flash.dir < 0 ? '◀' : '▶', cx + SK.flash.dir * (w / 2 + 30), y + 10);
  }
  ctx.restore();
}

function skDraw() {
  if (!SK_CTX) return;
  var ctx = SK_CTX;
  ctx.setTransform(SK_SCALE, 0, 0, SK_SCALE, 0, 0);
  skDrawScenery(ctx);
  skDrawStork(ctx);
  if (SK && SK.running) skDrawBalanceMeter(ctx);
}

(function skSetupInput() {
  var canvas = document.getElementById('sk-canvas');
  if (!canvas) return;
  function active() { return document.getElementById('stork').classList.contains('active'); }
  document.addEventListener('keydown', function (e) {
    if (!active()) return;
    if (document.getElementById('rules-overlay').style.display === 'flex') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (!e.repeat) skPush(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (!e.repeat) skPush(1); }
    else if (e.key === ' ') { e.preventDefault(); if (!SK || !SK.running) skBegin(); }
  });
  // 화면 왼쪽/오른쪽 절반을 눌러도 조작
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!SK || !SK.running) return;
    var rect = canvas.getBoundingClientRect();
    skPush(e.clientX - rect.left < rect.width / 2 ? -1 : 1);
  });
  ['sk-btn-left', 'sk-btn-right'].forEach(function (id, i) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (!SK || !SK.running) { if (!SK || !SK.falling) skBegin(); return; }
      skPush(i === 0 ? -1 : 1);
    });
  });
  window.addEventListener('resize', function () { if (SK_CANVAS && active()) { skResize(); skDraw(); } });
})();
