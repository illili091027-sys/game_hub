/* ---------------- Bomb game (똥 피하기) ---------------- */
var bmRunning = false;
var bmStageEl = null;
var bmPlayerEl = null;
var bmBombs = [];
var bmPlayerX = 0;
var bmKeyLeft = false;
var bmKeyRight = false;
var bmStartTime = 0;
var bmScore = 0;
var bmSpawnCooldown = 0;
var bmLastTs = 0;
var bmRAF = null;

var BM_PLAYER_SPEED = 340; // px / sec
var BM_PLAYER_SIZE = 56;
var BM_BOMB_SIZE = 34;
var BM_MAX_HP = 3;
var BM_HP = BM_MAX_HP;
var BM_INVINCIBLE_UNTIL = 0; // performance.now() 기준, 이 시간 전까지는 똥에 맞아도 안 아픔(깜빡임 연출)
var BM_INVINCIBLE_MS = 1000;

/* ---- 온라인: 화면 분할 (상대방 화면 보기) ---- */
var BM_LAST_POST = 0;
var BM_OPP_POLL_TIMER = null;
var BM_STATUS = 'waiting'; // 'waiting' | 'playing' | 'dead'
var BM_ALL_DONE_HANDLED = false;

function bmOpponentKey(pid) { return roomKey('bomb_p_' + pid); }

var BM_CHAR = null;
function bmCharSrc(id) {
  var c = id ? charById(id) : null;
  if (c) return c.src;
  return (typeof BOMB_CHAR_IMG !== 'undefined') ? BOMB_CHAR_IMG : '';
}
function bmApplyChar() {
  var img = document.getElementById('bm-player-img');
  if (img) img.src = bmCharSrc(BM_CHAR);
}

function bmPostState(force) {
  if (playMode !== 'online' || !roomJoined || !myPlayerId || !bmStageEl) return;
  var now = performance.now();
  if (!force && now - BM_LAST_POST < 180) return;
  BM_LAST_POST = now;
  var stageW = bmStageEl.clientWidth || 1;
  var stageH = bmStageEl.clientHeight || 1;
  var bombsData = bmBombs.slice(0, 20).map(function (b) {
    return [Math.round((b.x / stageW) * 1000) / 1000, Math.round((b.y / stageH) * 1000) / 1000];
  });
  DBset(bmOpponentKey(myPlayerId), {
    name: me.name,
    status: BM_STATUS,
    xFrac: Math.round((bmPlayerX / stageW) * 1000) / 1000,
    bombs: bombsData,
    score: bmScore,
    hp: BM_HP,
    char: BM_CHAR,
    ts: Date.now()
  });
}

function bmRenderOpponents() {
  var panel = document.getElementById('bm-opponents');
  if (!panel) return;
  if (playMode !== 'online' || !roomJoined || !roomPlayersList) { panel.innerHTML = ''; return; }
  var others = roomPlayersList.filter(function (p) { return p.id !== myPlayerId; });
  if (!others.length) { panel.innerHTML = '<div class="lobby-hint">아직 다른 참가자가 없어요.</div>'; return; }
  Promise.all(others.map(function (p) {
    return DBget(bmOpponentKey(p.id)).then(function (data) { return { p: p, data: data }; });
  })).then(function (results) {
    var html = '';
    var allOthersDead = true;
    var miniBg = (typeof BOMB_BG_IMG !== 'undefined' && BOMB_BG_IMG) ? BOMB_BG_IMG : '';
    var miniChar = (typeof BOMB_CHAR_IMG !== 'undefined' && BOMB_CHAR_IMG) ? BOMB_CHAR_IMG : '';
    results.forEach(function (r) {
      var d = r.data;
      html += '<div class="bm-mini-stage" style="background-image:url(\'' + miniBg + '\')"><div class="bm-mini-name">' + esc(r.p.name) + '</div>';
      if (!d || d.status === 'waiting') {
        allOthersDead = false;
        html += '<div class="bm-mini-status">대기 중</div>';
      } else if (d.status === 'dead') {
        html += '<div class="bm-mini-status">💀 탈락<br>' + (d.score || 0) + '점</div>';
      } else {
        allOthersDead = false;
        html += '<div class="bm-mini-score">' + (d.score || 0) + '점</div>';
        html += '<img class="bm-mini-player" src="' + (d.char ? bmCharSrc(d.char) : miniChar) + '" alt="" style="left:' + ((d.xFrac || 0.5) * 100) + '%;" />';
        (d.bombs || []).forEach(function (b) {
          html += '<div class="bm-mini-bomb" style="left:' + (b[0] * 100) + '%; top:' + (b[1] * 100) + '%;"></div>';
        });
      }
      html += '</div>';
    });
    panel.innerHTML = html;
    if (BM_STATUS === 'dead' && allOthersDead && !BM_ALL_DONE_HANDLED) {
      BM_ALL_DONE_HANDLED = true;
      bmShowFinalResults(results);
    }
  });
}

function bmShowFinalResults(results) {
  document.getElementById('bm-my-status').style.display = 'none';
  document.getElementById('bm-game-area').style.display = 'none';
  document.getElementById('bm-over-area').style.display = '';
  var allScores = results.map(function (r) { return { name: (r.data && r.data.name) || r.p.name, score: (r.data && r.data.score) || 0 }; });
  allScores.push({ name: me.name, score: bmScore });
  allScores.sort(function (a, b) { return b.score - a.score; });
  var lines = allScores.map(function (s, i) {
    return (i + 1) + '등: ' + esc(s.name) + (s.name === me.name ? ' (나)' : '') + ' - ' + s.score + '점';
  });
  document.getElementById('bm-over-msg').innerHTML = '모두 탈락! 최종 결과<br>' + lines.join('<br>');
}

function bmStartOppPoll() {
  bmStopOppPoll();
  if (playMode !== 'online') return;
  bmRenderOpponents();
  BM_OPP_POLL_TIMER = setInterval(bmRenderOpponents, 400);
}

function bmStopOppPoll() {
  clearInterval(BM_OPP_POLL_TIMER);
  BM_OPP_POLL_TIMER = null;
}

function bmLoadBest() {
  try {
    var v = parseInt(localStorage.getItem('gamehub_bm_best'), 10);
    return isNaN(v) ? 0 : v;
  } catch (e) { return 0; }
}
function bmSaveBest(score) {
  try {
    var best = bmLoadBest();
    if (score > best) { localStorage.setItem('gamehub_bm_best', String(score)); return score; }
    return best;
  } catch (e) { return score; }
}
function bmBestText(v) { return v > 0 ? (v + '점') : '기록 없음'; }

function startBombGame() {
  bmRunning = false;
  bmStageEl = document.getElementById('bm-stage');
  bmPlayerEl = document.getElementById('bm-player');
  /* 캐릭터 고르기(먼작귀 9명) - 시작 화면에서 고르고, 고른 캐릭터가 내 캐릭터로 나와요 */
  BM_CHAR = (charLoadChoice() || {}).id || null;
  bmApplyChar();
  charRenderPicker('bm-char-pick', BM_CHAR, function (id) {
    BM_CHAR = id;
    bmApplyChar();
    bmPostState(true);
  });
  bmStageEl.style.backgroundImage = (typeof BOMB_BG_IMG !== 'undefined') ? 'url(' + BOMB_BG_IMG + ')' : 'none';
  var best = bmLoadBest();
  document.getElementById('bm-best-intro').textContent = bmBestText(best);
  document.getElementById('bm-best-val').textContent = bmBestText(best);
  document.getElementById('bm-intro').style.display = '';
  document.getElementById('bm-game-area').style.display = 'none';
  document.getElementById('bm-over-area').style.display = 'none';
  document.getElementById('bm-my-status').style.display = 'none';
  document.getElementById('bm-opponents').style.display = playMode === 'online' ? '' : 'none';
  BM_STATUS = 'waiting';
  BM_ALL_DONE_HANDLED = false;
  bmClearBombs();
  if (playMode === 'online') { bmPostState(true); bmStartOppPoll(); } else { bmStopOppPoll(); }
}

function bmClearBombs() {
  for (var i = 0; i < bmBombs.length; i++) {
    if (bmBombs[i].el && bmBombs[i].el.parentNode) bmBombs[i].el.parentNode.removeChild(bmBombs[i].el);
  }
  bmBombs = [];
}

function bmResetPlayerVisual() {
  bmPlayerEl.classList.remove('hit');
  bmPlayerEl.classList.remove('invincible');
  bmPlayerEl.style.transition = '';
  bmPlayerEl.style.transform = 'translateX(-50%)';
  bmPlayerEl.style.opacity = '1';
  var ufo = document.getElementById('bm-ufo');
  if (ufo) { ufo.style.opacity = '0'; ufo.style.display = 'none'; }
}

function bmUpdateHpDisplay() {
  var el = document.getElementById('bm-hp-val');
  if (!el) return;
  var text = '';
  for (var i = 0; i < BM_MAX_HP; i++) text += (i < BM_HP) ? '❤️' : '🖤';
  el.textContent = text;
}

function bmBeginGame() {
  document.getElementById('bm-intro').style.display = 'none';
  document.getElementById('bm-over-area').style.display = 'none';
  document.getElementById('bm-game-area').style.display = '';
  document.getElementById('bm-my-status').style.display = 'none';
  BM_STATUS = 'playing';
  BM_ALL_DONE_HANDLED = false;
  bmClearBombs();
  bmScore = 0;
  BM_HP = BM_MAX_HP;
  BM_INVINCIBLE_UNTIL = 0;
  bmUpdateHpDisplay();
  bmSpawnCooldown = 500;
  bmStartTime = performance.now();
  bmLastTs = bmStartTime;
  var stageW = bmStageEl.clientWidth;
  bmPlayerX = stageW / 2;
  bmPlayerEl.style.left = bmPlayerX + 'px';
  bmResetPlayerVisual();
  document.getElementById('bm-score-val').textContent = '0';
  var readyOverlay = document.getElementById('bm-ready-overlay');
  if (readyOverlay) readyOverlay.style.display = '';
  bmRunning = false;
  bmPostState(true);
  setTimeout(function () {
    if (readyOverlay) readyOverlay.style.display = 'none';
    bmRunning = true;
    bmLastTs = performance.now();
    bmRAF = requestAnimationFrame(bmTick);
  }, 900);
}

/* 2단계 강화: 최고 속도/최소 낙하 간격을 늘리고(더 빨리, 더 자주), 시간이 갈수록 한 번에
   두 개씩 떨어질 확률(multiChance)도 생겨서 후반부로 갈수록 확실히 더 어려워집니다. */
function bmDifficulty(elapsedSec) {
  var speed = Math.min(560, 150 + elapsedSec * 18);
  var spawnMs = Math.max(180, 850 - elapsedSec * 32);
  var multiChance = Math.min(0.35, Math.max(0, (elapsedSec - 15) / 70));
  return { speed: speed, spawnMs: spawnMs, multiChance: multiChance };
}

/* 떨어지는 것마다 항상 똥은 아닙니다 - 가끔은 회복 아이템(💚, 체력이 가득 차 있지 않을 때만
   등장)이나, 닿으면 체력과 상관없이 바로 탈락하는 위험한 해골 아이템(☠️)이 섞여 떨어집니다. */
function bmPickItemType() {
  if (BM_HP < BM_MAX_HP && Math.random() < 0.08) return 'heal';
  if (Math.random() < 0.08) return 'danger';
  return 'bomb';
}

function bmSpawnBomb(speed, type) {
  type = type || 'bomb';
  var stageW = bmStageEl.clientWidth;
  var x = BM_BOMB_SIZE / 2 + Math.random() * (stageW - BM_BOMB_SIZE);
  var el = document.createElement('div');
  el.className = 'bm-bomb' + (type === 'heal' ? ' bm-item-heal' : type === 'danger' ? ' bm-item-danger' : '');
  if (type === 'heal') {
    el.textContent = '💚';
  } else if (type === 'danger') {
    el.textContent = '☠️';
  } else if (typeof BOMB_POOP_IMG !== 'undefined' && BOMB_POOP_IMG) {
    var img = document.createElement('img');
    img.src = BOMB_POOP_IMG;
    img.alt = '';
    el.appendChild(img);
  } else {
    el.textContent = '💩';
  }
  el.style.left = x + 'px';
  el.style.top = '-20px';
  bmStageEl.appendChild(el);
  bmBombs.push({ el: el, x: x, y: -20, speed: speed, type: type });
}

function bmTick(ts) {
  if (!bmRunning) return;
  var dt = Math.min(0.05, (ts - bmLastTs) / 1000);
  bmLastTs = ts;
  var elapsedSec = (ts - bmStartTime) / 1000;
  var diff = bmDifficulty(elapsedSec);

  var stageW = bmStageEl.clientWidth;
  var stageH = bmStageEl.clientHeight;
  var half = BM_PLAYER_SIZE / 2;
  if (bmKeyLeft) bmPlayerX -= BM_PLAYER_SPEED * dt;
  if (bmKeyRight) bmPlayerX += BM_PLAYER_SPEED * dt;
  if (bmPlayerX < half) bmPlayerX = half;
  if (bmPlayerX > stageW - half) bmPlayerX = stageW - half;
  bmPlayerEl.style.left = bmPlayerX + 'px';

  bmSpawnCooldown -= dt * 1000;
  if (bmSpawnCooldown <= 0) {
    bmSpawnBomb(diff.speed, bmPickItemType());
    if (Math.random() < diff.multiChance) bmSpawnBomb(diff.speed, bmPickItemType());
    bmSpawnCooldown = diff.spawnMs;
  }

  for (var i = bmBombs.length - 1; i >= 0; i--) {
    var b = bmBombs[i];
    b.y += b.speed * dt;
    b.el.style.top = b.y + 'px';
    if (b.y > stageH + 30) {
      b.el.parentNode.removeChild(b.el);
      bmBombs.splice(i, 1);
    }
  }

  var playerBottom = 10 + half; // matches CSS bottom:10px, half height above that
  var playerCy = stageH - playerBottom;
  var pr = half * 0.55;
  for (var j = bmBombs.length - 1; j >= 0; j--) {
    var bb = bmBombs[j];
    var dx = bb.x - bmPlayerX;
    var dy = bb.y - playerCy;
    var br = (BM_BOMB_SIZE / 2) * 0.75;
    if (Math.sqrt(dx * dx + dy * dy) < pr + br) {
      if (bb.type === 'heal') {
        /* 회복 아이템: 체력을 하나 채우고 사라짐 (이미 가득 찼으면 그냥 지나침) */
        if (BM_HP < BM_MAX_HP) { BM_HP++; bmUpdateHpDisplay(); }
        bb.el.parentNode.removeChild(bb.el);
        bmBombs.splice(j, 1);
        continue;
      }
      if (bb.type === 'danger') {
        /* 위험한 해골 아이템: 체력이 남아있어도 바로 탈락 */
        bmEndGame();
        return;
      }
      /* 일반 똥: 무적 시간 중이면 맞아도 아프지 않고 그냥 스쳐 지나감 */
      if (ts < BM_INVINCIBLE_UNTIL) {
        bb.el.parentNode.removeChild(bb.el);
        bmBombs.splice(j, 1);
        continue;
      }
      bb.el.parentNode.removeChild(bb.el);
      bmBombs.splice(j, 1);
      BM_HP--;
      bmUpdateHpDisplay();
      if (BM_HP <= 0) { bmEndGame(); return; }
      BM_INVINCIBLE_UNTIL = ts + BM_INVINCIBLE_MS;
      bmPlayerEl.classList.add('invincible');
      setTimeout(function () { bmPlayerEl.classList.remove('invincible'); }, BM_INVINCIBLE_MS);
    }
  }

  bmScore = Math.floor(elapsedSec * 10);
  document.getElementById('bm-score-val').textContent = String(bmScore);
  bmPostState(false);

  bmRAF = requestAnimationFrame(bmTick);
}

function bmFinishRoundLocal(soloMsg) {
  if (playMode === 'online') {
    document.getElementById('bm-game-area').style.display = '';
    document.getElementById('bm-my-status').style.display = '';
    document.getElementById('bm-my-status').textContent = '💀 탈락! 다른 사람이 다 끝날 때까지 기다리는 중... (내 점수: ' + bmScore + '점)';
  } else {
    document.getElementById('bm-game-area').style.display = 'none';
    document.getElementById('bm-over-area').style.display = '';
    document.getElementById('bm-over-msg').textContent = soloMsg;
  }
}

function bmEndGame() {
  bmRunning = false;
  if (bmRAF) cancelAnimationFrame(bmRAF);
  bmClearBombs();
  bmPlayerEl.classList.add('hit');
  BM_STATUS = 'dead';
  bmPostState(true);

  var best = bmSaveBest(bmScore);
  document.getElementById('bm-best-val').textContent = bmBestText(best);

  var stageW = bmStageEl.clientWidth;
  var stageH = bmStageEl.clientHeight;
  var half = BM_PLAYER_SIZE / 2;
  var playerCy = stageH - (10 + half);

  var ufo = document.getElementById('bm-ufo');
  var ufoSize = Math.max(90, Math.min(220, stageW * 0.55));
  if (ufo && typeof BOMB_UFO_IMG !== 'undefined' && BOMB_UFO_IMG) {
    ufo.src = BOMB_UFO_IMG;
    ufo.style.width = ufoSize + 'px';
    ufo.style.height = ufoSize + 'px';
    var ufoLeft = Math.max(ufoSize / 2, Math.min(stageW - ufoSize / 2, bmPlayerX));
    ufo.style.left = ufoLeft + 'px';
    ufo.style.transform = 'translateX(-50%)';
    var ufoTop = Math.max(-ufoSize * 0.1, playerCy - ufoSize * 0.9);
    ufo.style.top = ufoTop + 'px';
    ufo.style.display = 'block';
    // eslint-disable-next-line no-unused-expressions
    ufo.offsetWidth; // force reflow so the opacity transition plays
    ufo.style.opacity = '1';

    // 살짝 붉게 번쩍인 다음, 초록 빛줄기 속으로 캐릭터가 빨려 올라가는 연출
    setTimeout(function () {
      bmPlayerEl.classList.remove('hit');
      var liftTo = Math.max(0, playerCy - ufoTop - ufoSize * 0.12);
      bmPlayerEl.style.transition = 'transform 0.85s cubic-bezier(.5,0,.75,0), opacity 0.85s ease-in 0.15s';
      bmPlayerEl.style.transform = 'translate(-50%, -' + liftTo + 'px) scale(0.1)';
      bmPlayerEl.style.opacity = '0';
    }, 180);

    setTimeout(function () {
      bmFinishRoundLocal('앗, 똥에 맞아서 외계인한테 납치됐어요! 이번 점수: ' + bmScore + '점  (최고 기록: ' + bmBestText(best) + ')');
    }, 1250);
  } else {
    setTimeout(function () {
      bmFinishRoundLocal('이번 점수: ' + bmScore + '점  (최고 기록: ' + bmBestText(best) + ')');
    }, 350);
  }
}

function stopBombGame() {
  bmRunning = false;
  bmKeyLeft = false;
  bmKeyRight = false;
  if (bmRAF) cancelAnimationFrame(bmRAF);
  bmClearBombs();
  if (bmPlayerEl) bmResetPlayerVisual();
  bmStopOppPoll();
}

document.addEventListener('keydown', function (e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (!document.getElementById('bomb').classList.contains('active')) return;
  e.preventDefault();
  if (e.key === 'ArrowLeft') bmKeyLeft = true;
  else bmKeyRight = true;
});
document.addEventListener('keyup', function (e) {
  if (e.key === 'ArrowLeft') bmKeyLeft = false;
  else if (e.key === 'ArrowRight') bmKeyRight = false;
});

(function bmSetupTouchButtons() {
  var leftBtn = document.getElementById('bm-btn-left');
  var rightBtn = document.getElementById('bm-btn-right');
  if (!leftBtn || !rightBtn) return;
  var setLeft = function (v) { return function (e) { e.preventDefault(); bmKeyLeft = v; }; };
  var setRight = function (v) { return function (e) { e.preventDefault(); bmKeyRight = v; }; };
  leftBtn.addEventListener('mousedown', setLeft(true));
  leftBtn.addEventListener('mouseup', setLeft(false));
  leftBtn.addEventListener('mouseleave', setLeft(false));
  leftBtn.addEventListener('touchstart', setLeft(true), { passive: false });
  leftBtn.addEventListener('touchend', setLeft(false));
  rightBtn.addEventListener('mousedown', setRight(true));
  rightBtn.addEventListener('mouseup', setRight(false));
  rightBtn.addEventListener('mouseleave', setRight(false));
  rightBtn.addEventListener('touchstart', setRight(true), { passive: false });
  rightBtn.addEventListener('touchend', setRight(false));
})();
