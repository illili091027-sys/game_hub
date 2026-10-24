/* ---------------- 아기 키우기 (구름 점프) - 혼자하기 + 온라인 ----------------
   엄마를 잃은 아기가 구름을 타고 하늘 높이 올라가 엄마를 찾는 게임.
   - 조작: 마우스(손가락)를 움직이면 아기가 그쪽으로 이동, 클릭(탭)하면 점프. 키보드 ←/→ + 스페이스/↑ 도 가능.
   - 점프는 구름을 밟고 서 있을 때만 할 수 있어요.
   - 구름 종류: 하얀 구름(보통) / 먹구름(가짜 - 밟을 수 없음) / 무지개 구름(엄청 높이 튀어오름) /
     구멍난 구름(한 번 밟으면 곧 부서짐) / 나중엔 좌우로 움직이는 구름도 나와요.
   - 올라갈수록 AGE(나이)가 1살씩 늘고, 화면이 저절로 조금씩 올라가요. 화면 아래로 떨어지면 끝.
   - 풍선을 잡으면 보너스 점수!
   온라인: 똥벼락처럼 모두 동시에 시작해서 각자 플레이하고, 다른 사람의 나이/점수가 실시간으로
   보여요. 기록(나이·점수)은 "첫 번째 판"만 인정되고, 죽은 뒤에는 연습 모드로 계속 놀 수 있어요.
   모두 첫 판이 끝나면 최종 순위가 나와요. 내 상태는 roomKey('baby_p_'+내id) 에 올립니다. */
var BB_W = 400, BB_H = 500;
var BB_GRAVITY = 1500, BB_JUMP_V = 770, BB_RAINBOW_V = 1200;
var BB = null;          // 현재 판 상태
var BB_RAF = null;
var BB_CANVAS = null, BB_CTX = null, BB_SCALE = 1;
var BB_KEYS = { left: false, right: false };
var BB_OPP_TIMER = null;
var BB_COUNTDOWN_TIMER = null;
var BB_OFFICIAL = null;   // 온라인: 첫 판 기록 {age, score} (null이면 아직 첫 판 중)
var BB_BEST_SOLO = 0;
var BB_LAST_POST = 0;
var BB_FINAL_SHOWN = false;
var BB_BG_PUFFS = [];

function bbKey(pid) { return roomKey('baby_p_' + pid); }

function stopBabyGame() {
  cancelAnimationFrame(BB_RAF);
  BB_RAF = null;
  clearInterval(BB_OPP_TIMER);
  BB_OPP_TIMER = null;
  clearInterval(BB_COUNTDOWN_TIMER);
  BB_COUNTDOWN_TIMER = null;
  if (BB) BB.running = false;
}

function startBabyGame() {
  stopBabyGame();
  BB_OFFICIAL = null;
  BB_FINAL_SHOWN = false;
  BB_CANVAS = document.getElementById('bb-canvas');
  BB_CTX = BB_CANVAS.getContext('2d');
  bbResize();
  var online = playMode === 'online';
  document.getElementById('bb-side').style.display = online ? '' : 'none';
  document.getElementById('bb-final').style.display = 'none';
  document.getElementById('bb-final').innerHTML = '<div class="board-box-title">🏁 최종 순위 (모두 첫 판 끝!)</div><div id="bb-final-rank"></div>';
  if (BB_BG_PUFFS.length === 0) {
    for (var i = 0; i < 9; i++) BB_BG_PUFFS.push({ x: Math.random() * BB_W, y: Math.random() * 900, s: 0.6 + Math.random() * 0.9 });
  }
  if (online) {
    DBset(bbKey(myPlayerId), { name: me.name, status: 'playing', age: 1, score: 0, done: false, ts: Date.now() });
    clearInterval(BB_OPP_TIMER);
    BB_OPP_TIMER = setInterval(bbRenderOpponents, 1000);
    bbRenderOpponents();
  }
  bbNewRun(true);
}

/* 새 판 준비 + 3,2,1 카운트다운 */
function bbNewRun(withCountdown) {
  cancelAnimationFrame(BB_RAF);
  clearInterval(BB_COUNTDOWN_TIMER);
  var ground = { x: BB_W / 2, y: 40, w: 320, type: 'ground' };
  BB = {
    running: false, over: false, t: 0, lastTs: 0,
    baby: { x: BB_W / 2, y: 40, vx: 0, vy: 0, on: ground, face: 1 },
    targetX: BB_W / 2, pointerActive: false,
    camY: 0, maxH: 0, bonus: 0, started: false,
    clouds: [ground], balloons: [], sparkles: [], pops: [],
    lastPathY: 40, lastPathX: BB_W / 2, nextBalloonY: 600,
    practice: playMode === 'online' && BB_OFFICIAL !== null
  };
  bbGenerate();
  document.getElementById('bb-over').style.display = 'none';
  document.getElementById('bb-mode-tag').textContent = BB.practice ? '🎈 연습 중 (기록 안 남아요)' : (playMode === 'online' ? '🏁 기록 도전 중 (첫 판만 인정!)' : '');
  document.getElementById('bb-mode-tag').style.display = playMode === 'online' ? '' : 'none';
  bbUpdateHud();
  bbDraw();
  var cd = document.getElementById('bb-countdown');
  if (!withCountdown) { cd.style.display = 'none'; bbGo(); return; }
  var n = 3;
  cd.style.display = '';
  cd.textContent = n;
  BB_COUNTDOWN_TIMER = setInterval(function () {
    n--;
    if (n > 0) { cd.textContent = n; return; }
    clearInterval(BB_COUNTDOWN_TIMER);
    cd.textContent = '출발!';
    setTimeout(function () { cd.style.display = 'none'; }, 450);
    bbGo();
  }, 700);
}

function bbGo() {
  BB.running = true;
  BB.lastTs = 0;
  BB_RAF = requestAnimationFrame(bbTick);
}

function bbAge() { return Math.floor(BB.maxH / 650) + 1; }
function bbScore() { return Math.floor(BB.maxH / 4) + BB.bonus; }

/* ---- 구름 만들기 ---- */
function bbGenerate() {
  while (BB.lastPathY < BB.camY + BB_H + 260) {
    var age = Math.floor(BB.lastPathY / 650) + 1;
    var gap = Math.min(172, 82 + Math.random() * 55 + Math.min(age, 14) * 4);
    var y = BB.lastPathY + gap;
    var maxDx = 165;
    var x = BB.lastPathX + (Math.random() * 2 - 1) * maxDx;
    if (x < 50) x = 50 + Math.random() * 40;
    if (x > BB_W - 50) x = BB_W - 50 - Math.random() * 40;
    var w = Math.max(62, 112 - age * 3.2);
    var r = Math.random();
    var type = 'normal';
    var pHoled = Math.min(0.05 + age * 0.025, 0.32);
    if (r < 0.06 && age >= 2) type = 'rainbow';
    else if (r < 0.06 + pHoled) type = 'holed';
    var cloud = { x: x, y: y, w: w, type: type };
    if (age >= 4 && type !== 'rainbow' && Math.random() < Math.min(0.05 * age, 0.35)) {
      cloud.baseX = x; cloud.amp = 40 + Math.random() * 50; cloud.speed = 0.8 + Math.random() * 0.8 + age * 0.03; cloud.phase = Math.random() * 6.28;
    }
    BB.clouds.push(cloud);
    // 가짜 먹구름(장식이자 함정)
    if (age >= 2 && Math.random() < Math.min(0.12 + age * 0.03, 0.45)) {
      var dx = (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 90);
      var fx = Math.max(45, Math.min(BB_W - 45, x + dx));
      BB.clouds.push({ x: fx, y: y - gap * (0.3 + Math.random() * 0.4), w: w * (0.9 + Math.random() * 0.3), type: 'dark' });
    }
    if (y > BB.nextBalloonY) {
      BB.balloons.push({ x: 40 + Math.random() * (BB_W - 80), y: y + 40 + Math.random() * 40, color: ['#F2836B', '#6FC364', '#6FC3DF', '#B79CE8', '#F2C744'][Math.floor(Math.random() * 5)], bob: Math.random() * 6 });
      BB.nextBalloonY = y + 700 + Math.random() * 600;
    }
    BB.lastPathY = y;
    BB.lastPathX = x;
  }
  BB.clouds = BB.clouds.filter(function (c) { return c.y > BB.camY - 120 && !c.gone; });
  BB.balloons = BB.balloons.filter(function (b) { return b.y > BB.camY - 120 && !b.taken; });
}

/* ---- 조작 ---- */
function bbJump() {
  if (!BB || !BB.running || BB.over) return;
  var b = BB.baby;
  if (!b.on) return;
  b.vy = BB_JUMP_V;
  b.on = null;
  BB.started = true;
  for (var i = 0; i < 5; i++) BB.sparkles.push({ x: b.x + (Math.random() * 16 - 8), y: b.y - 4, life: 0.6, vy: -40 - Math.random() * 60 });
}

function bbPointerToWorldX(e) {
  var rect = BB_CANVAS.getBoundingClientRect();
  return ((e.clientX - rect.left) / rect.width) * BB_W;
}

/* ---- 한 프레임 ---- */
function bbTick(ts) {
  if (!BB || !BB.running) return;
  var dt = BB.lastTs ? Math.min(0.033, (ts - BB.lastTs) / 1000) : 0.016;
  BB.lastTs = ts;
  BB.t += dt;
  var b = BB.baby;
  var age = bbAge();

  // 좌우 이동
  if (BB_KEYS.left || BB_KEYS.right) {
    b.vx = (BB_KEYS.right ? 1 : 0) - (BB_KEYS.left ? 1 : 0);
    b.vx *= 280;
    BB.targetX = b.x;
    BB.pointerActive = false;
  } else if (BB.pointerActive) {
    b.vx = Math.max(-300, Math.min(300, (BB.targetX - b.x) * 7));
  } else {
    b.vx *= 0.8;
  }
  if (Math.abs(b.vx) > 8) b.face = b.vx > 0 ? 1 : -1;

  // 움직이는 구름
  BB.clouds.forEach(function (c) {
    if (c.amp) {
      var nx = c.baseX + Math.sin(BB.t * c.speed + c.phase) * c.amp;
      nx = Math.max(c.w / 2 + 4, Math.min(BB_W - c.w / 2 - 4, nx));
      c.dx = nx - c.x;
      c.x = nx;
    }
    if (c.crumbleAt && BB.t > c.crumbleAt) { c.gone = true; }
  });

  if (b.on) {
    var c0 = b.on;
    if (c0.dx) b.x += c0.dx;
    b.x += b.vx * dt;
    if (c0.gone || Math.abs(b.x - c0.x) > c0.w / 2 + 6) { b.on = null; b.vy = 0; }
    else b.y = c0.y;
  } else {
    var prevY = b.y;
    b.vy -= BB_GRAVITY * dt;
    b.y += b.vy * dt;
    b.x += b.vx * dt;
    if (b.vy <= 0) {
      for (var i = 0; i < BB.clouds.length; i++) {
        var c = BB.clouds[i];
        if (c.type === 'dark' || c.gone) continue;
        if (prevY >= c.y - 1 && b.y <= c.y && Math.abs(b.x - c.x) <= c.w / 2 + 6) {
          b.y = c.y;
          b.vy = 0;
          b.on = c;
          if (c.type === 'rainbow') {
            b.on = null;
            b.vy = BB_RAINBOW_V;
            BB.pops.push({ x: c.x, y: c.y + 20, text: '🌈 슈퍼 점프!', life: 1 });
            for (var k = 0; k < 10; k++) BB.sparkles.push({ x: b.x + (Math.random() * 30 - 15), y: b.y, life: 0.9, vy: -60 - Math.random() * 80 });
          } else if (c.type === 'holed' && !c.crumbleAt) {
            c.crumbleAt = BB.t + 0.75;
          }
          break;
        }
      }
    }
  }
  b.x = Math.max(14, Math.min(BB_W - 14, b.x));

  // 풍선
  BB.balloons.forEach(function (bl) {
    if (bl.taken) return;
    if (Math.abs(bl.x - b.x) < 26 && Math.abs((bl.y + Math.sin(BB.t * 2 + bl.bob) * 6) - (b.y + 24)) < 34) {
      bl.taken = true;
      BB.bonus += 100;
      BB.pops.push({ x: bl.x, y: bl.y, text: '+100', life: 1 });
    }
  });

  // 높이/나이
  var prevAge = bbAge();
  if (b.y > BB.maxH) BB.maxH = b.y;
  if (bbAge() > prevAge) BB.pops.push({ x: BB_W / 2, y: BB.camY + BB_H * 0.7, text: '🎂 ' + bbAge() + '살!', life: 1.4, fixed: true });

  // 카메라: 아기를 따라 올라가고, 첫 점프 이후엔 저절로 조금씩 올라감
  var want = b.y - BB_H * 0.42;
  if (want > BB.camY) BB.camY += (want - BB.camY) * Math.min(1, dt * 6);
  if (BB.started) BB.camY += Math.min(18 + age * 5, 85) * dt;

  // 효과
  BB.sparkles.forEach(function (s) { s.life -= dt; s.y += s.vy * dt; });
  BB.sparkles = BB.sparkles.filter(function (s) { return s.life > 0; });
  if (!b.on && b.vy > 0 && Math.random() < 0.5) BB.sparkles.push({ x: b.x + (Math.random() * 8 - 4), y: b.y - 2, life: 0.5, vy: -20 });
  BB.pops.forEach(function (p) { p.life -= dt; if (!p.fixed) p.y += 30 * dt; });
  BB.pops = BB.pops.filter(function (p) { return p.life > 0; });

  bbGenerate();

  if (b.y < BB.camY - 50) { bbDie(); return; }

  bbDraw();
  bbUpdateHud();
  bbPostState(false);
  BB_RAF = requestAnimationFrame(bbTick);
}

function bbUpdateHud() {
  var a = bbAge();
  document.getElementById('bb-age').textContent = (a < 10 ? '0' : '') + a;
  var sc = String(bbScore());
  document.getElementById('bb-score').textContent = ('0000000' + sc).slice(-Math.max(7, sc.length));
}

function bbPostState(force) {
  if (playMode !== 'online' || !roomJoined || BB_OFFICIAL !== null) return;
  var now = Date.now();
  if (!force && now - BB_LAST_POST < 450) return;
  BB_LAST_POST = now;
  DBset(bbKey(myPlayerId), { name: me.name, status: BB.over ? 'dead' : 'playing', age: bbAge(), score: bbScore(), done: BB.over, ts: now });
}

function bbDie() {
  BB.running = false;
  BB.over = true;
  bbDraw();
  var age = bbAge(), score = bbScore();
  var over = document.getElementById('bb-over');
  var html;
  if (playMode === 'online') {
    if (BB_OFFICIAL === null) {
      BB_OFFICIAL = { age: age, score: score };
      DBset(bbKey(myPlayerId), { name: me.name, status: 'dead', age: age, score: score, done: true, practicing: false, ts: Date.now() });
      html = '<div class="bb-over-title">😢 으앙! 떨어졌어요</div>' +
        '<div class="bb-over-rec">공식 기록 <b>AGE ' + age + '</b> · <b>' + score + '점</b></div>' +
        '<div class="bb-over-sub">기록은 이 첫 판으로 확정! 이제부터는 연습 모드로 계속 놀 수 있어요.</div>';
    } else {
      html = '<div class="bb-over-title">연습 끝!</div>' +
        '<div class="bb-over-rec">이번 판 AGE ' + age + ' · ' + score + '점</div>' +
        '<div class="bb-over-sub">공식 기록은 그대로: AGE ' + BB_OFFICIAL.age + ' · ' + BB_OFFICIAL.score + '점</div>';
    }
    bbRenderOpponents();
  } else {
    var isBest = score > BB_BEST_SOLO;
    if (isBest) BB_BEST_SOLO = score;
    html = '<div class="bb-over-title">😢 으앙! 떨어졌어요</div>' +
      '<div class="bb-over-rec">AGE <b>' + age + '</b> · <b>' + score + '점</b></div>' +
      '<div class="bb-over-sub">' + (isBest ? '🎉 최고 기록!' : '최고 기록 ' + BB_BEST_SOLO + '점') + '</div>';
  }
  html += '<button class="btn btn-primary" onclick="bbRetry()">' + (playMode === 'online' ? '연습 계속하기' : '다시 하기') + '</button>';
  over.innerHTML = html;
  over.style.display = '';
}

function bbRetry() {
  if (playMode === 'online' && roomJoined) {
    DBget(bbKey(myPlayerId)).then(function (d) {
      d = d || { name: me.name, status: 'dead', age: 0, score: 0, done: true };
      d.practicing = true;
      d.ts = Date.now();
      DBset(bbKey(myPlayerId), d);
    });
  }
  bbNewRun(false);
}

/* ---- 온라인: 다른 사람 현황 + 최종 순위 ---- */
function bbRenderOpponents() {
  if (playMode !== 'online' || !roomJoined) return;
  var list = roomPlayersList || [];
  Promise.all(list.map(function (p) {
    return DBget(bbKey(p.id)).then(function (d) { return { p: p, d: d }; });
  })).then(function (rows) {
    if (!document.getElementById('baby').classList.contains('active')) return;
    var allDone = rows.length > 0 && rows.every(function (r) { return r.d && r.d.done; });
    var sorted = rows.slice().sort(function (a, b) { return ((b.d && b.d.score) || 0) - ((a.d && a.d.score) || 0); });
    document.getElementById('bb-players').innerHTML = sorted.map(function (r) {
      var d = r.d || {};
      var isMe = r.p.id === myPlayerId;
      var status = !r.d ? '준비 중' : !d.done ? '🍼 올라가는 중' : (d.practicing ? '🎈 연습 중' : '💤 기록 확정');
      return '<div class="bb-player' + (isMe ? ' me' : '') + (d.done ? ' done' : '') + '">' +
        '<div class="bb-player-top"><span class="bb-player-name">' + esc(r.p.name) + (isMe ? ' (나)' : '') + '</span><span class="bb-player-age">AGE ' + (d.age || 1) + '</span></div>' +
        '<div class="bb-player-bottom"><span>' + status + '</span><b>' + (d.score || 0) + '점</b></div></div>';
    }).join('');
    var finalEl = document.getElementById('bb-final');
    if (allDone) {
      finalEl.style.display = '';
      renderRankBoard('bb-final-rank', sorted.map(function (r) {
        return { name: r.p.name, isMe: r.p.id === myPlayerId, label: 'AGE ' + ((r.d && r.d.age) || 1) + ' · ' + ((r.d && r.d.score) || 0) + '점' };
      }));
    } else {
      finalEl.style.display = 'none';
    }
  });
}

/* ---- 그리기 ---- */
function bbResize() {
  if (!BB_CANVAS) return;
  var rect = BB_CANVAS.getBoundingClientRect();
  var w = rect.width || 400;
  var dpr = window.devicePixelRatio || 1;
  BB_CANVAS.width = Math.round(w * dpr);
  BB_CANVAS.height = Math.round(w * (BB_H / BB_W) * dpr);
  BB_SCALE = (w * dpr) / BB_W;
}

function bbSY(y) { return BB_H - (y - BB.camY); }

function bbCloudShape(ctx, cx, top, w, fill, stroke) {
  var h = w * 0.36;
  var cy = top + h * 0.55;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.moveTo(cx - w * 0.18 + w * 0.2, top + h * 0.3);
  ctx.arc(cx - w * 0.18, top + h * 0.3, w * 0.2, 0, Math.PI * 2);
  ctx.moveTo(cx + w * 0.15 + w * 0.24, top + h * 0.22);
  ctx.arc(cx + w * 0.15, top + h * 0.22, w * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fill();
}

function bbDrawCloud(ctx, c) {
  var top = bbSY(c.y) - 2;
  if (top < -80 || top > BB_H + 80) return;
  if (c.type === 'ground') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#8cc4f0';
    ctx.lineWidth = 3;
    for (var i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(c.x - c.w / 2 + 30 + i * (c.w - 60) / 5, top + 34, 40, 0, Math.PI * 2);
      ctx.stroke(); ctx.fill();
    }
    return;
  }
  ctx.save();
  if (c.crumbleAt) {
    var left = c.crumbleAt - BB.t;
    ctx.globalAlpha = Math.max(0.15, Math.min(1, left / 0.75));
    ctx.translate((Math.random() - 0.5) * 3, 0);
  }
  if (c.type === 'dark') {
    bbCloudShape(ctx, c.x, top - 6, c.w, '#8d97a8', '#606b7d');
    ctx.strokeStyle = 'rgba(120,150,200,0.7)';
    ctx.lineWidth = 2;
    for (var r = 0; r < 4; r++) {
      var rx = c.x - c.w * 0.3 + r * c.w * 0.2;
      var off = (BB.t * 60 + r * 9) % 18;
      ctx.beginPath(); ctx.moveTo(rx, top + c.w * 0.36 + off); ctx.lineTo(rx - 3, top + c.w * 0.36 + off + 7); ctx.stroke();
    }
  } else {
    if (c.type === 'rainbow') {
      var cols = ['#ff6b6b', '#ffb84d', '#ffe66d', '#7bd389', '#6fc3df', '#b79ce8'];
      cols.forEach(function (col, i) {
        ctx.beginPath();
        ctx.strokeStyle = col;
        ctx.lineWidth = 4;
        ctx.arc(c.x, top + 14, c.w * 0.48 - i * 4, Math.PI, 0);
        ctx.stroke();
      });
    }
    bbCloudShape(ctx, c.x, top - 6, c.w, '#ffffff', '#8cc4f0');
    if (c.type === 'holed') {
      ctx.fillStyle = 'rgba(70,110,160,0.55)';
      ctx.beginPath(); ctx.ellipse(c.x - c.w * 0.15, top + c.w * 0.14, c.w * 0.08, c.w * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x + c.w * 0.17, top + c.w * 0.2, c.w * 0.06, c.w * 0.04, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (c.amp) {
      ctx.fillStyle = 'rgba(111,195,223,0.9)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('◀ ▶', c.x, top + c.w * 0.3);
    }
  }
  ctx.restore();
}

/* 아기 그리기 - 둥근 얼굴, 앞머리 한 줌, 기저귀. 점프 중엔 팔을 번쩍 들어요. */
function bbDrawBaby(ctx) {
  var b = BB.baby;
  var x = b.x, feet = bbSY(b.y);
  var air = !b.on;
  var skin = '#ffd8b5', line = '#7a4a2a';
  ctx.save();
  ctx.translate(x, feet);
  ctx.scale(b.face, 1);
  ctx.lineWidth = 2;
  ctx.strokeStyle = line;
  // 다리
  ctx.fillStyle = skin;
  var legSpread = air ? 9 : 6;
  ctx.beginPath(); ctx.ellipse(-legSpread, -5, 5, 6, air ? -0.5 : 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(legSpread, -5, 5, 6, air ? 0.5 : 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 기저귀
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(0, -14, 12, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 몸통
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(0, -25, 10, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 팔
  var armY = air ? -46 : -24;
  ctx.beginPath(); ctx.ellipse(-14, armY + (air ? 6 : 0), 4.5, air ? 9 : 6, air ? 0.4 : -0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(14, armY + (air ? 6 : 0), 4.5, air ? 9 : 6, air ? -0.4 : 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 머리
  ctx.beginPath(); ctx.arc(0, -45, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 앞머리 한 줌
  ctx.fillStyle = '#9a6a3c';
  ctx.beginPath();
  ctx.moveTo(-6, -58); ctx.quadraticCurveTo(-2, -70, 4, -63); ctx.quadraticCurveTo(7, -69, 9, -58); ctx.quadraticCurveTo(2, -55, -6, -58);
  ctx.fill();
  // 얼굴
  ctx.fillStyle = '#3a2a20';
  ctx.beginPath(); ctx.arc(-5, -45, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, -45, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,120,0.5)';
  ctx.beginPath(); ctx.arc(-9, -40, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(10, -40, 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#a0402a';
  ctx.beginPath();
  if (BB.over) { ctx.arc(1, -36, 3, Math.PI, 0); } else { ctx.arc(1, -39, 3, 0.1, Math.PI - 0.1); }
  ctx.stroke();
  ctx.restore();
}

function bbDraw() {
  if (!BB_CTX || !BB) return;
  var ctx = BB_CTX;
  ctx.setTransform(BB_SCALE, 0, 0, BB_SCALE, 0, 0);
  // 하늘: 올라갈수록 조금씩 노을빛 → 밤하늘
  var age = bbAge();
  var tNight = Math.min(1, Math.max(0, (age - 6) / 14));
  var g = ctx.createLinearGradient(0, 0, 0, BB_H);
  g.addColorStop(0, tNight > 0.5 ? '#2b3a78' : (tNight > 0 ? '#7da7e8' : '#79b9f2'));
  g.addColorStop(1, tNight > 0.5 ? '#5d6fb8' : '#bfe3ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BB_W, BB_H);
  if (tNight > 0.5) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (var s = 0; s < 25; s++) {
      var sx = (s * 97) % BB_W, sy = ((s * 53 + BB.camY * 0.1) % BB_H);
      ctx.fillRect(sx, sy, 2, 2);
    }
  }
  // 멀리 있는 배경 구름(천천히 움직임)
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  BB_BG_PUFFS.forEach(function (p) {
    var y = ((p.y - BB.camY * 0.25) % 900 + 900) % 900 - 200;
    var x = (p.x + BB.t * 6 * p.s) % (BB_W + 120) - 60;
    ctx.beginPath();
    ctx.ellipse(x, BB_H - y, 50 * p.s, 18 * p.s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 26 * p.s, BB_H - y - 10 * p.s, 30 * p.s, 16 * p.s, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  BB.clouds.forEach(function (c) { bbDrawCloud(ctx, c); });
  // 풍선
  BB.balloons.forEach(function (bl) {
    if (bl.taken) return;
    var y = bbSY(bl.y + Math.sin(BB.t * 2 + bl.bob) * 6);
    ctx.strokeStyle = 'rgba(120,80,60,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bl.x, y + 18); ctx.quadraticCurveTo(bl.x + 6, y + 34, bl.x, y + 48); ctx.stroke();
    ctx.fillStyle = bl.color;
    ctx.beginPath(); ctx.ellipse(bl.x, y, 14, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(bl.x - 5, y - 6, 3, 5, -0.4, 0, Math.PI * 2); ctx.fill();
  });
  // 반짝이
  BB.sparkles.forEach(function (s) {
    var y = bbSY(s.y);
    ctx.fillStyle = 'rgba(255,240,150,' + Math.max(0, Math.min(1, s.life * 2)) + ')';
    ctx.beginPath();
    ctx.moveTo(s.x, y - 5); ctx.lineTo(s.x + 1.5, y - 1.5); ctx.lineTo(s.x + 5, y); ctx.lineTo(s.x + 1.5, y + 1.5);
    ctx.lineTo(s.x, y + 5); ctx.lineTo(s.x - 1.5, y + 1.5); ctx.lineTo(s.x - 5, y); ctx.lineTo(s.x - 1.5, y - 1.5);
    ctx.fill();
  });
  bbDrawBaby(ctx);
  // 떠오르는 글자
  BB.pops.forEach(function (p) {
    ctx.globalAlpha = Math.min(1, p.life * 1.5);
    ctx.font = 'bold 20px "Gaegu", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    var y = p.fixed ? BB_H * 0.32 : bbSY(p.y);
    ctx.strokeText(p.text, p.x, y);
    ctx.fillStyle = '#e8508a';
    ctx.fillText(p.text, p.x, y);
    ctx.globalAlpha = 1;
  });
}

(function bbSetupInput() {
  var canvas = document.getElementById('bb-canvas');
  if (!canvas) return;
  canvas.addEventListener('pointermove', function (e) {
    if (!BB) return;
    BB.targetX = bbPointerToWorldX(e);
    BB.pointerActive = true;
  });
  canvas.addEventListener('pointerdown', function (e) {
    if (!BB) return;
    e.preventDefault();
    BB.targetX = bbPointerToWorldX(e);
    BB.pointerActive = true;
    bbJump();
  });
  document.addEventListener('keydown', function (e) {
    if (!document.getElementById('baby').classList.contains('active')) return;
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowLeft') { BB_KEYS.left = true; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { BB_KEYS.right = true; e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); bbJump(); }
  });
  document.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft') BB_KEYS.left = false;
    else if (e.key === 'ArrowRight') BB_KEYS.right = false;
  });
  window.addEventListener('resize', function () { if (BB_CANVAS && document.getElementById('baby').classList.contains('active')) { bbResize(); bbDraw(); } });
})();
