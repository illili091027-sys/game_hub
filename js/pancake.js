/* 🥞 그림 팬케이크 (혼자 하기)
   반죽으로 그림을 그리고 → 노릇해지면 반죽을 부어 덮고 → 거품이 터지면 뒤집으면 그림 팬케이크 완성!
   점수는 없어요. 굽기 정도는 숫자 대신 색 · 거품 · 가장자리로 보여요.
   순서: 불 켜기 → 그리기 → 선 굽기 → 붓기 → 거품 보고 뒤집기 → 뒷면 굽기 → 이름 붙이기 → 사진 저장
   지난 작품은 이 기기(localStorage 'gamehub_pancake')에만 저장돼요. */

var PC_S = 520, PC_CX = 260, PC_CY = 260, PC_PAN = 222;   /* 캔버스 크기 · 팬 중심/반지름 */
var PC = null, PC_RAF = null, PC_SAVE_KEY = 'gamehub_pancake';
var PC_HEAT = [{ n: '끔', t: 0 }, { n: '약', t: 0.55 }, { n: '강', t: 1 }];

/* 익은 정도(0=생반죽 → 1=갈색 → 1.4=탐) → 색 */
var PC_STOPS = [[0, [247, 236, 208]], [0.28, [242, 214, 146]], [0.5, [222, 160, 74]], [0.75, [170, 100, 45]], [1.0, [112, 62, 30]], [1.25, [58, 34, 18]], [1.5, [30, 20, 14]]];
function pcColor(c, a) {
  c = Math.max(0, Math.min(1.5, c));
  for (var i = 1; i < PC_STOPS.length; i++) if (c <= PC_STOPS[i][0]) {
    var A = PC_STOPS[i - 1], B = PC_STOPS[i], k = (c - A[0]) / (B[0] - A[0]);
    var r = Math.round(A[1][0] + (B[1][0] - A[1][0]) * k), g = Math.round(A[1][1] + (B[1][1] - A[1][1]) * k), b = Math.round(A[1][2] + (B[1][2] - A[1][2]) * k);
    return a == null ? 'rgb(' + r + ',' + g + ',' + b + ')' : 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  return 'rgb(30,20,14)';
}
function pcLoadSave() { try { return JSON.parse(localStorage.getItem(PC_SAVE_KEY) || '{}') || {}; } catch (e) { return {}; } }
function pcStore(d) { try { localStorage.setItem(PC_SAVE_KEY, JSON.stringify(d)); } catch (e) {} }

function startPancakeGame() {
  stopPancakeGame();
  var keepHeat = 1, keepT = 0;
  PC = { heat: keepHeat, T: keepT, shake: false };
  pcReset(true);
  var root = document.getElementById('pc-root');
  root.innerHTML =
    '<div class="pc-layout">' +
      '<div class="pc-stage"><canvas id="pc-canvas" class="pc-canvas"></canvas>' +
        '<div id="pc-done" class="pc-done" style="display:none">' +
          '<input id="pc-name" maxlength="24" placeholder="나의 팬케이크">' +
          '<div class="pc-done-b"><button class="btn btn-primary" onclick="pcSaveWork()">💾 이름 붙여 저장</button><button class="btn btn-ghost" onclick="pcPhoto()">📷 사진 저장</button><button class="btn btn-ghost" onclick="pcAgain()">🥞 한 장 더</button></div>' +
        '</div></div>' +
      '<div class="pc-side">' +
        '<div class="pc-hint" id="pc-hint"></div>' +
        '<div class="pc-bar"><i id="pc-bar"></i></div>' +
        '<div class="pc-steps">' +
          '<button class="pc-step" id="pc-b-draw" onclick="pcSetPhase(\'draw\')">✏️ 그리기</button>' +
          '<button class="pc-step" id="pc-b-pour" onclick="pcSetPhase(\'pour\')">🫗 붓기</button>' +
          '<button class="pc-step" id="pc-b-flip" onclick="pcFlip()">🔄 뒤집기</button>' +
          '<button class="pc-step" id="pc-b-done" onclick="pcFinish()">✅ 완성</button>' +
        '</div>' +
        '<div class="pc-knob-row"><button class="pc-knob" id="pc-knob" onclick="pcCycleHeat()" title="눌러서 불 조절"><i></i></button>' +
          '<div class="pc-heat">' + PC_HEAT.map(function (h, i) { return '<button id="pc-h' + i + '" onclick="pcSetHeat(' + i + ')">' + h.n + '</button>'; }).join('') + '</div></div>' +
        '<div class="pc-tools"><button class="btn btn-ghost" onclick="pcToggleHelp()">📖 굽는 법</button><button class="btn btn-ghost" id="pc-shake" onclick="pcToggleShake()">📱 흔들어 뒤집기</button><button class="btn btn-ghost" onclick="pcRestart()">↺ 처음부터</button></div>' +
        '<div class="pc-help" id="pc-help" style="display:none">' +
          '<ol><li>🔥 불을 켜요 (약불 추천)</li><li>✏️ 팬 위를 따라 그리면 가는 반죽 선이 나와요</li><li>⏳ 선이 노릇하게 갈색이 될 때까지 기다려요 (막대가 다 차면 신호)</li>' +
          '<li>🫗 붓기를 누르고 꾹 누른 채 움직여 그림을 다 덮어요</li><li>🫧 거품이 올라와 톡톡 터지고, 가장자리가 마르면</li><li>🔄 뒤집어요! (폰은 흔들어도 돼요)</li><li>✅ 뒷면을 조금 굽고 완성 → 이름을 붙여요</li></ol>' +
          '<p><b>이럴 땐?</b> 그림이 흐려요 → 선을 더 오래 구운 뒤 부어요 · 너무 일찍 뒤집으면 반죽이 흘러요 · 연기가 나면 불을 줄이거나 꺼요 · 그림은 뒤집히니까 글씨는 좌우가 바뀌어요!</p></div>' +
        '<div class="pc-gal-t">🖼 지난 작품 <small>(이 기기에만 저장)</small></div><div class="pc-gal" id="pc-gal"></div>' +
      '</div>' +
    '</div>';
  var cv = document.getElementById('pc-canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = PC_S * dpr; cv.height = PC_S * dpr; PC.dpr = dpr; PC.ctx = cv.getContext('2d');
  pcSetupInput(cv);
  pcGallery(); pcUi();
  var last = 0;
  (function loop(now) {
    PC_RAF = requestAnimationFrame(loop);
    if (!PC) return;
    var dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    pcTick(dt); pcDraw(); pcHud();
  })(0);
}
function stopPancakeGame() {
  if (PC_RAF) cancelAnimationFrame(PC_RAF); PC_RAF = null;
  if (PC && PC.motionH) window.removeEventListener('devicemotion', PC.motionH);
  PC = null;
}
/* 반죽 · 굽기 기록만 지우고 불 세기와 팬 온도는 그대로 */
function pcReset() {
  PC.phase = 'draw'; PC.strokes = []; PC.cur = null; PC.blobs = []; PC.bubbles = []; PC.pourCook = 0; PC.back = 0;
  PC.flipA = 0; PC.flipped = false; PC.early = false; PC.drips = []; PC.smoke = []; PC.held = null; PC.msg = ''; PC.msgT = 0; PC.done = false; PC.rewarded = false;
}
function pcRestart() { if (!PC) return; if (PC.strokes.length && !confirm('반죽과 굽기 기록이 지워져요. 불 세기와 팬 온도는 그대로예요. 처음부터 할까요?')) return; pcReset(); pcUi(); }
function pcAgain() { pcReset(); pcUi(); }
function pcSetHeat(i) { PC.heat = i; pcUi(); }
function pcCycleHeat() { PC.heat = (PC.heat + 1) % 3; pcUi(); }
function pcToggleHelp() { var h = document.getElementById('pc-help'); h.style.display = h.style.display === 'none' ? '' : 'none'; }
function pcSay(t, sec) { PC.msg = t; PC.msgT = sec || 2.5; }

function pcSetPhase(p) {
  if (!PC || PC.flipped) return;
  if (p === 'draw' && PC.blobs.length) { pcSay('반죽을 부은 뒤에는 더 그릴 수 없어요'); return; }
  if (p === 'pour' && !PC.strokes.length) { pcSay('먼저 그림을 그려요! (그림 없이 부어도 돼요)'); }
  PC.phase = p; pcUi();
}

/* ---------- 입력 ---------- */
function pcSetupInput(cv) {
  function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * PC_S / r.width, y: (e.clientY - r.top) * PC_S / r.height }; }
  function inPan(p, m) { return Math.hypot(p.x - PC_CX, p.y - PC_CY) < PC_PAN - (m || 0); }
  cv.addEventListener('pointerdown', function (e) {
    if (!PC || PC.flipped) return;
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    var p = pt(e); if (!inPan(p, 6)) return;
    if (PC.phase === 'draw') { PC.cur = { pts: [p], cook: 0 }; PC.strokes.push(PC.cur); }
    else if (PC.phase === 'pour') { PC.held = { x: p.x, y: p.y }; pcAddBlob(p, 10); }
  });
  cv.addEventListener('pointermove', function (e) {
    if (!PC) return;
    var p = pt(e);
    if (PC.cur) { var l = PC.cur.pts[PC.cur.pts.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 3 && inPan(p, 6)) PC.cur.pts.push(p); }
    else if (PC.held) {
      var b = PC.blobs[PC.blobs.length - 1];
      if (Math.hypot(p.x - b.x, p.y - b.y) > Math.max(8, b.r * 0.45)) pcAddBlob(p, Math.max(14, b.r * 0.85));
      PC.held.x = p.x; PC.held.y = p.y;
    }
  });
  function up() { PC && (PC.cur = null, PC.held = null); }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', function () { if (PC && PC.held) PC.held = null; });
}
function pcAddBlob(p, r) {
  var d = Math.hypot(p.x - PC_CX, p.y - PC_CY), lim = PC_PAN - 10 - r;
  var x = p.x, y = p.y; if (d > lim && d > 0) { x = PC_CX + (p.x - PC_CX) / d * Math.max(0, lim); y = PC_CY + (p.y - PC_CY) / d * Math.max(0, lim); }
  var b = { x: x, y: y, r: r }; PC.blobs.push(b);
  for (var i = 0; i < (Math.random() < 0.5 ? 1 : 0); i++) {     /* 표면 거품: 몇 개만 반짝 올라왔다가 톡 사라져요 */
    var a = Math.random() * 6.283, rr = Math.random() * r * 0.8, t0 = 0.22 + Math.random() * 0.25;
    PC.bubbles.push({ b: b, dx: Math.cos(a) * rr, dy: Math.sin(a) * rr, s: 2 + Math.random() * 3.5, t0: t0, t1: t0 + 0.1 + Math.random() * 0.16 });
  }
}
/* 반죽(원)들이 그림 선을 얼마나 덮었는지 0~1 */
function pcCover() {
  var n = 0, c = 0;
  PC.strokes.forEach(function (s) { for (var i = 0; i < s.pts.length; i += 2) { n++; var p = s.pts[i]; if (PC.blobs.some(function (b) { return Math.hypot(p.x - b.x, p.y - b.y) < b.r - 3; })) c++; } });
  return n ? c / n : (PC.blobs.length ? 1 : 0);
}
function pcAvgLine() { var t = 0, n = 0; PC.strokes.forEach(function (s) { t += s.cook; n++; }); return n ? t / n : 0; }

/* ---------- 굽기 ---------- */
function pcTick(dt) {
  var target = PC_HEAT[PC.heat].t;
  PC.T += (target - PC.T) * (target > PC.T ? 0.16 : 0.07) * dt * 6;
  var rate = 0.1 * Math.pow(Math.max(0, PC.T), 1.4) * dt, burning = false;
  if (!PC.flipped) {
    PC.strokes.forEach(function (s) { s.cook += rate * 1.15; if (s.cook > 1.05) burning = true; });
    if (PC.blobs.length) { PC.pourCook += rate; if (PC.pourCook > 1.05) burning = true; }
    if (PC.held) { var b = PC.blobs[PC.blobs.length - 1]; if (b && b.r < 70) { b.r = Math.min(70, b.r + 46 * dt); } }
  } else if (PC.flipA >= 1 && !PC.done) { PC.back += rate; if (PC.back > 1.05) burning = true; }
  if (PC.flipA > 0 && PC.flipA < 1) PC.flipA = Math.min(1, PC.flipA + dt / 0.9);
  if (burning && PC.T > 0.25 && Math.random() < dt * 14) PC.smoke.push({ x: PC_CX + (Math.random() - 0.5) * 260, y: PC_CY + (Math.random() - 0.5) * 200, a: 0.5, r: 12 + Math.random() * 12 });
  PC.smoke.forEach(function (s) { s.y -= 40 * dt; s.r += 16 * dt; s.a -= 0.25 * dt; });
  PC.smoke = PC.smoke.filter(function (s) { return s.a > 0; });
  if (PC.msgT > 0) PC.msgT -= dt;
}

function pcFlip() {
  if (!PC || PC.flipped) return;
  if (!PC.blobs.length) { pcSay('반죽을 먼저 부어요! (🫗 붓기)'); return; }
  PC.flipped = true; PC.flipA = 0.001; PC.phase = 'back'; PC.held = null;
  PC.early = PC.pourCook < 0.34;
  if (PC.early) {                                                /* 너무 일찍 뒤집으면 생반죽이 흘러요 */
    for (var i = 0; i < 14; i++) { var b = PC.blobs[Math.floor(Math.random() * PC.blobs.length)], a = Math.random() * 6.283; PC.drips.push({ x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, r: 6 + Math.random() * 16, a: a }); }
    pcSay('앗, 너무 일찍 뒤집어서 반죽이 흘렀어요!', 3.5);
  } else if (PC.pourCook > 1) pcSay('윽, 아랫면이 좀 탔어요…', 3);
  else pcSay('뒤집기 성공! 뒷면을 살짝 구워요', 2.5);
  if (typeof mmSound === 'function') try { mmSound('catch'); } catch (e) {}
  pcUi();
}
function pcFinish() {
  if (!PC || !PC.flipped || PC.flipA < 1) { pcSay('먼저 뒤집어요!'); return; }
  PC.done = true; PC.phase = 'done';
  var d = document.getElementById('pc-done'); d.style.display = 'flex';
  document.getElementById('pc-name').value = '';
  if (!PC.rewarded && typeof soloCoin === 'function') { PC.rewarded = true; soloCoin(3, '팬케이크 완성!'); }
  pcUi();
}
/* 완성 한 줄 평 */
function pcReview() {
  var lines = PC.strokes.length, diff = pcAvgLine() - PC.pourCook, out = [];
  if (PC.early) out.push('반죽이 흘렀지만 맛은 있어요 😋');
  else if (PC.pourCook > 1.05 || PC.back > 1.1) out.push('살짝 탄 맛이 나요 🔥');
  else if (PC.back < 0.2) out.push('뒷면이 조금 덜 익었어요');
  if (lines) { if (diff > 0.3) out.push('그림이 또렷해요! ✨'); else if (diff > 0.15) out.push('그림이 은은하게 보여요'); else out.push('그림이 흐려요 · 선을 더 구운 뒤 부어 봐요'); }
  if (!out.length) out.push('노릇노릇 완벽해요! 🥞');
  return out.join(' · ');
}

/* ---------- 그리기 ---------- */
function pcBlobPath(ctx, grow) { ctx.beginPath(); PC.blobs.forEach(function (b) { ctx.moveTo(b.x + b.r + grow, b.y); ctx.arc(b.x, b.y, b.r + grow, 0, 6.2832); }); }
/* 뒤집은 뒤 보이는 면 (원래 아랫면, 좌우 반전) */
function pcDrawBottom(ctx) {
  ctx.save();
  ctx.translate(PC_CX, PC_CY); ctx.scale(-1, 1); ctx.translate(-PC_CX, -PC_CY);
  if (PC.early) { ctx.fillStyle = pcColor(Math.min(0.3, PC.pourCook)); PC.drips.forEach(function (d) { ctx.beginPath(); ctx.ellipse(d.x + Math.cos(d.a) * d.r, d.y + Math.sin(d.a) * d.r, d.r * 1.4, d.r, d.a, 0, 6.2832); ctx.fill(); }); }
  pcBlobPath(ctx, 2); ctx.fillStyle = pcColor(Math.max(0, PC.pourCook - 0.12)); ctx.fill();    /* 가장자리는 조금 연해요 */
  pcBlobPath(ctx, -8); ctx.fillStyle = pcColor(PC.pourCook); ctx.fill();
  ctx.save(); pcBlobPath(ctx, 0); ctx.clip();
  if (PC.early) ctx.filter = 'blur(2.5px)';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  PC.strokes.forEach(function (s) {
    if (s.pts.length < 2) { ctx.fillStyle = pcColor(Math.max(s.cook, PC.pourCook)); ctx.beginPath(); ctx.arc(s.pts[0].x, s.pts[0].y, 4, 0, 6.2832); ctx.fill(); return; }
    ctx.beginPath(); s.pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.strokeStyle = pcColor(Math.max(s.cook, PC.pourCook)); ctx.lineWidth = 8; ctx.stroke();
  });
  ctx.filter = 'none';
  /* 굽는 무늬 (작은 점) */
  var tg = ctx.createRadialGradient(PC_CX, PC_CY, 20, PC_CX, PC_CY, PC_PAN); tg.addColorStop(0, 'rgba(160,90,30,.10)'); tg.addColorStop(1, 'rgba(255,240,200,.08)'); ctx.fillStyle = tg; ctx.fillRect(0, 0, PC_S, PC_S);   /* 가운데가 조금 더 노릇하게 */
  ctx.restore(); ctx.restore();
}
function pcDrawTop(ctx) {
  /* 그림 선 (팬에 닿은 면) */
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  PC.strokes.forEach(function (s) {
    ctx.beginPath(); s.pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    if (s.pts.length === 1) ctx.lineTo(s.pts[0].x + 0.1, s.pts[0].y);
    ctx.strokeStyle = pcColor(s.cook); ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.stroke();   /* 반죽 윤기 */
  });
  if (!PC.blobs.length) return;
  /* 부은 반죽 윗면: 가장자리가 마를수록 진하고 탁해져요 */
  var dry = Math.max(0, Math.min(1, (PC.pourCook - 0.2) / 0.45));
  pcBlobPath(ctx, 3); ctx.fillStyle = 'rgb(' + Math.round(246 - dry * 26) + ',' + Math.round(228 - dry * 42) + ',' + Math.round(178 - dry * 70) + ')'; ctx.fill();
  pcBlobPath(ctx, -5); ctx.fillStyle = 'rgba(250,236,196,.97)'; ctx.fill();
  ctx.save(); pcBlobPath(ctx, -4); ctx.clip();
  var gl = ctx.createRadialGradient(PC_CX - 70, PC_CY - 90, 10, PC_CX, PC_CY, PC_PAN);   /* 생반죽 윤기 → 익으면 사라져요 */
  gl.addColorStop(0, 'rgba(255,255,255,' + (0.45 * (1 - dry)) + ')'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, PC_S, PC_S);
  PC.strokes.forEach(function (s) {                                      /* 아래 그림이 살짝 비쳐요 */
    ctx.beginPath(); s.pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.strokeStyle = 'rgba(160,110,50,' + (0.07 + Math.min(0.1, s.cook * 0.08)) + ')'; ctx.lineWidth = 9; ctx.stroke();
  });
  PC.bubbles.forEach(function (q) {
    var x = q.b.x + q.dx, y = q.b.y + q.dy, c = PC.pourCook;
    if (c < q.t0) return;
    ctx.beginPath(); ctx.arc(x, y, q.s, 0, 6.2832);
    if (c < q.t1) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.stroke(); }
    else { var fade = Math.max(0, 1 - (c - q.t1) / 0.12); if (fade <= 0) return; ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * fade) + ')'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, q.s * (1 + (1 - fade)), 0, 6.2832); ctx.stroke(); }   /* 톡! 하고 사라져요 */
  });
  ctx.restore();
}
function pcDrawPan(ctx) {
  ctx.fillStyle = '#efe4d3'; ctx.fillRect(0, 0, PC_S, PC_S);
  /* 손잡이 */
  ctx.save(); ctx.translate(PC_CX, PC_CY); ctx.rotate(0.62);
  ctx.fillStyle = '#5d4037'; if (typeof rr === 'function') { rr(ctx, PC_PAN - 6, -15, 120, 30, 14); ctx.fill(); } else ctx.fillRect(PC_PAN - 6, -15, 120, 30);
  ctx.restore();
  /* 불꽃 빛 */
  if (PC.T > 0.05) { var gl = ctx.createRadialGradient(PC_CX, PC_CY, PC_PAN - 6, PC_CX, PC_CY, PC_PAN + 22); gl.addColorStop(0, 'rgba(255,120,30,' + (0.55 * PC.T) + ')'); gl.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(PC_CX, PC_CY, PC_PAN + 22, 0, 6.2832); ctx.fill(); }
  ctx.beginPath(); ctx.arc(PC_CX, PC_CY, PC_PAN + 10, 0, 6.2832); ctx.fillStyle = '#3a3f44'; ctx.fill();
  var g = ctx.createRadialGradient(PC_CX - 60, PC_CY - 70, 20, PC_CX, PC_CY, PC_PAN);
  g.addColorStop(0, '#5b6168'); g.addColorStop(1, '#2b2f33');
  ctx.beginPath(); ctx.arc(PC_CX, PC_CY, PC_PAN, 0, 6.2832); ctx.fillStyle = g; ctx.fill();
}
function pcDrawPlate(ctx) {
  ctx.fillStyle = '#f6efe4'; ctx.fillRect(0, 0, PC_S, PC_S);
  ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.ellipse(PC_CX + 6, PC_CY + 12, 246, 238, 0, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(PC_CX, PC_CY, 244, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = '#e3d6c3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(PC_CX, PC_CY, 205, 0, 6.2832); ctx.stroke();
}
function pcDraw() {
  var ctx = PC.ctx; ctx.setTransform(PC.dpr, 0, 0, PC.dpr, 0, 0);
  if (PC.done) { pcRenderPlate(ctx, true); return; }
  pcDrawPan(ctx);
  var sy = 1;
  if (PC.flipA > 0 && PC.flipA < 1) sy = Math.abs(Math.cos(PC.flipA * Math.PI));   /* 뒤집는 동안 납작해졌다 펴져요 */
  ctx.save();
  if (PC.flipA > 0 && PC.flipA < 1) { var jump = Math.sin(PC.flipA * Math.PI) * 90; ctx.translate(PC_CX, PC_CY - jump); ctx.scale(1, Math.max(0.04, sy)); ctx.translate(-PC_CX, -PC_CY); }
  if (PC.flipped && PC.flipA >= 0.5) pcDrawBottom(ctx); else pcDrawTop(ctx);
  ctx.restore();
  PC.smoke.forEach(function (s) { ctx.fillStyle = 'rgba(90,90,90,' + s.a + ')'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill(); });
  if (PC.held && PC.phase === 'pour') { ctx.fillStyle = 'rgba(250,236,196,.9)'; ctx.fillRect(PC.held.x - 3, PC.held.y - 60, 6, 56); }   /* 붓는 줄기 */
  if (PC.msgT > 0 && PC.msg) {
    ctx.font = 'bold 19px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var w = ctx.measureText(PC.msg).width + 34; ctx.fillStyle = 'rgba(60,40,25,.85)';
    if (typeof rr === 'function') { rr(ctx, PC_CX - w / 2, 18, w, 40, 20); ctx.fill(); } else ctx.fillRect(PC_CX - w / 2, 18, w, 40);
    ctx.fillStyle = '#fff'; ctx.fillText(PC.msg, PC_CX, 39);
  }
}
/* 접시에 담은 완성 사진 (저장용) */
function pcRenderPlate(ctx, withText) {
  pcDrawPlate(ctx);
  ctx.save(); ctx.translate(PC_CX, PC_CY); ctx.scale(0.84, 0.84); ctx.translate(-PC_CX, -PC_CY);
  ctx.shadowColor = 'rgba(90,50,20,.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  pcDrawBottom(ctx); ctx.restore();
  if (withText) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#8d6e63';
    ctx.fillText(pcReview(), PC_CX, 22);
  }
}
function pcHud() {
  var bar = document.getElementById('pc-bar'), hint = document.getElementById('pc-hint'); if (!bar || !hint) return;
  var t = '', v = 0, c = '#ffb74d';
  if (PC.done) { t = '🎉 완성! 이름을 붙여 저장해요'; v = 1; }
  else if (PC.flipped) { t = PC.back > 1.05 ? '🔥 뒷면이 타요! 완성을 눌러요' : PC.back > 0.3 ? '✅ 뒷면도 익었어요. 완성을 눌러요' : '🍳 뒷면을 굽는 중…'; v = Math.min(1, PC.back / 0.3); }
  else if (PC.T < 0.12 && PC.heat === 0) { t = '🔥 먼저 불을 켜요 (오른쪽 손잡이)'; v = PC.T; c = '#ef5350'; }
  else if (PC.phase === 'draw') {
    var al = pcAvgLine();
    if (!PC.strokes.length) t = '✏️ 팬 위를 따라 그려요. 가는 반죽 선이 나와요';
    else if (al > 1.0) { t = '🔥 선이 타요! 불을 줄이고 얼른 부어요'; c = '#ef5350'; }
    else if (al >= 0.5) { t = '🫗 지금! 노릇해졌어요. 붓기를 눌러요'; c = '#66bb6a'; }
    else t = '⏳ 선이 노릇하게 익을 때까지 기다려요';
    v = Math.min(1, al / 0.5);
  } else {
    var cv = pcCover();
    if (!PC.blobs.length) t = '🫗 꾹 누른 채 움직여서 그림을 다 덮어요';
    else if (PC.pourCook > 1.0) { t = '🔥 타겠어요! 불을 줄이거나 꺼요'; c = '#ef5350'; }
    else if (PC.pourCook >= 0.5) { t = '🔄 거품이 터지고 가장자리가 말랐어요. 뒤집어요!'; c = '#66bb6a'; }
    else if (cv < 0.9 && PC.strokes.length) t = '🫗 그림을 다 덮어요 (' + Math.round(cv * 100) + '%)';
    else if (PC.pourCook >= 0.3) t = '🫧 거품이 올라와요… 톡톡 터질 때까지 조금만';
    else t = '⏳ 반죽이 익기를 기다려요';
    v = PC.blobs.length ? Math.min(1, PC.pourCook / 0.5) : cv;
  }
  if (hint.textContent !== t) hint.textContent = t;
  bar.style.width = Math.round(v * 100) + '%'; bar.style.background = c;
}
function pcUi() {
  if (!PC) return;
  var $ = function (id) { return document.getElementById(id); };
  ['draw', 'pour'].forEach(function (p) { var b = $('pc-b-' + p); b.classList.toggle('on', PC.phase === p); b.disabled = PC.flipped || (p === 'draw' && PC.blobs.length > 0); });
  $('pc-b-flip').disabled = PC.flipped; $('pc-b-flip').classList.toggle('on', PC.phase === 'pour' && PC.pourCook >= 0.5);
  $('pc-b-done').disabled = !PC.flipped || PC.done; $('pc-b-done').classList.toggle('on', PC.flipped && !PC.done);
  for (var i = 0; i < 3; i++) $('pc-h' + i).classList.toggle('on', PC.heat === i);
  $('pc-knob').style.setProperty('--rot', (-60 + PC.heat * 60) + 'deg');
  $('pc-knob').classList.toggle('hot', PC.heat > 0);
  $('pc-shake').classList.toggle('on', PC.shake);
  if (!PC.done) $('pc-done').style.display = 'none';
}

/* ---------- 폰 흔들어 뒤집기 ---------- */
function pcToggleShake() {
  if (PC.shake) { PC.shake = false; window.removeEventListener('devicemotion', PC.motionH); pcUi(); return; }
  var on = function () {
    PC.shake = true; var last = null;
    PC.motionH = function (e) {
      var a = e.accelerationIncludingGravity || e.acceleration; if (!a || !PC) return;
      var cur = { x: a.x || 0, y: a.y || 0, z: a.z || 0 };
      if (last && PC.phase === 'pour' && !PC.flipped && Math.abs(cur.x - last.x) + Math.abs(cur.y - last.y) + Math.abs(cur.z - last.z) > 26) pcFlip();
      last = cur;
    };
    window.addEventListener('devicemotion', PC.motionH); pcSay('폰을 휙 흔들면 뒤집어요!'); pcUi();
  };
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission().then(function (r) { if (r === 'granted') on(); else pcSay('움직임 권한이 없어서 버튼으로 뒤집어요'); }, function () { pcSay('움직임 권한이 없어서 버튼으로 뒤집어요'); });
  } else if (typeof DeviceMotionEvent !== 'undefined') on();
  else pcSay('이 기기는 흔들기를 못 써요. 버튼으로 뒤집어요');
}

/* ---------- 저장 · 사진 · 지난 작품 ---------- */
function pcName() { var v = (document.getElementById('pc-name').value || '').trim().slice(0, 24); return v || '나의 팬케이크'; }
function pcPhotoCanvas(size) {
  var c = document.createElement('canvas'); c.width = size; c.height = size + Math.round(size * 0.14);
  var x = c.getContext('2d'); x.fillStyle = '#f6efe4'; x.fillRect(0, 0, c.width, c.height);
  x.save(); x.scale(size / PC_S, size / PC_S); pcRenderPlate(x, false); x.restore();
  x.fillStyle = '#5d4037'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold ' + Math.round(size * 0.055) + 'px sans-serif';
  x.fillText('🥞 ' + pcName(), size / 2, size + size * 0.07);
  return c;
}
function pcPhoto() {
  var a = document.createElement('a'); a.download = pcName().replace(/[\\/:*?"<>|]/g, '_') + '.png'; a.href = pcPhotoCanvas(720).toDataURL('image/png');
  document.body.appendChild(a); a.click(); a.remove();
}
function pcSaveWork() {
  var d = pcLoadSave(); d.works = d.works || [];
  d.works.unshift({ name: pcName(), img: pcPhotoCanvas(160).toDataURL('image/jpeg', 0.8), at: Date.now() });
  d.works = d.works.slice(0, 12); pcStore(d); pcGallery();
  pcSay('저장했어요! 아래 "지난 작품"에 걸려요 🖼', 3);
}
function pcGallery() {
  var el = document.getElementById('pc-gal'); if (!el) return;
  var w = (pcLoadSave().works || []);
  el.innerHTML = w.length ? w.map(function (x) { return '<figure><img src="' + x.img + '" alt=""><figcaption>' + esc(x.name) + '</figcaption></figure>'; }).join('') : '<span class="pc-gal-empty">아직 없어요. 첫 팬케이크를 구워 봐요!</span>';
}
