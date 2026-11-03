/* ---------------- 늑대인간 게임 (온라인 전용, 4~9명) ----------------
   마피아 게임과 진행 골격(밤→아침→낮→반복)은 같지만 역할 구성과 능력이 다릅니다:
   - 예언자(🔮): 마피아의 경찰과 달리 "늑대인간이다/아니다" 둘 중 하나만 아는 게 아니라,
     조사한 사람의 역할을 통째로(늑대인간/예언자/사냥꾼/주민 중 정확히 무엇인지) 알 수 있습니다.
   - 사냥꾼(🏹): 평소엔 아무 행동도 없는 평범한 사람이지만, 자신이 죽는 순간(밤에 당하거나
     낮 투표로 처형되거나) 곧바로 살아있는 사람 중 한 명을 추가로 데려갈 수 있습니다. 이 때문에
     "hunter_revenge"라는 중간 단계가 추가로 생깁니다: 밤이나 낮이 끝나고 죽은 사람이 사냥꾼이면,
     바로 다음 단계(아침/다음 밤)로 넘어가지 않고 먼저 사냥꾼의 복수를 기다렸다가, 그 결과까지
     반영한 뒤에 승리 조건을 확인하고 다음 단계로 넘어갑니다.
   의사(보호) 역할은 없습니다 - 그 대신 사냥꾼의 "죽으면서 복수" 능력이 이 게임만의 특징입니다.
   마피아 게임과 마찬가지로 이 앱은 로그인/권한 시스템이 없는 단순 방 코드 저장소라서, 역할
   데이터도 roomKey('werewolf') 공용 상태 안에 전부 들어있고 화면(UI)에서만 내 정보 위주로
   보여줍니다. mfPickMajority / mfRenderTargetButtons 같은 범용 함수와 .mf-role-badge 등
   공용 CSS는 마피아 게임(js/mafia.js, css/style.css)에서 만든 것을 그대로 재사용합니다. */

var WW_POLL_TIMER = null;
var WW_MIN_PLAYERS = 4;
var WW_MAX_PLAYERS = 9;
var WW_NIGHT_SECONDS = 25;
var WW_DAY_SECONDS = 70;
var WW_REVENGE_SECONDS = 20;

var WW_ROLE_TABLE = {
  4: { wolf: 1, seer: 1, hunter: 0, villager: 2 },
  5: { wolf: 1, seer: 1, hunter: 1, villager: 2 },
  6: { wolf: 1, seer: 1, hunter: 1, villager: 3 },
  7: { wolf: 2, seer: 1, hunter: 1, villager: 3 },
  8: { wolf: 2, seer: 1, hunter: 1, villager: 4 },
  9: { wolf: 2, seer: 1, hunter: 1, villager: 5 }
};
var WW_ROLE_LABEL = { wolf: '🐺 늑대인간', seer: '🔮 예언자', hunter: '🏹 사냥꾼', villager: '🙂 주민' };
var WW_ROLE_DESC = {
  wolf: '밤마다 다른 늑대인간과 함께(각자 투표) 한 명을 골라 해치우세요. 낮에는 주민인 척 숨어야 해요. 늑대인간 수가 늑대가 아닌 사람 수 이상이 되면 늑대인간 팀이 승리해요.',
  seer: '밤마다 한 명을 선택하면 다음 날 아침 그 사람의 정확한 역할을 알 수 있어요(늑대인간/예언자/사냥꾼/주민 중 무엇인지 정확히 보여요). 낮 투표에 단서로 활용하세요.',
  hunter: '평소에는 특별한 능력이 없는 평범한 주민이에요. 하지만 당신이 죽는 순간(밤에 당하거나 낮에 처형되거나) 바로 살아있는 사람 중 한 명을 골라 함께 데려갈 수 있어요!',
  villager: '특별한 능력은 없지만, 낮 토론과 투표로 늑대인간을 찾아내야 해요.'
};
var WW_DEATH_CAUSE_LABEL = { night: '밤에 사망', vote: '투표 처형', revenge: '사냥꾼의 복수' };

function wwKey() { return roomKey('werewolf'); }

function stopWerewolfGame() {
  clearInterval(WW_POLL_TIMER);
  WW_POLL_TIMER = null;
}

function startWerewolfGame() {
  document.querySelectorAll('#werewolf .ww-phase').forEach(function (el) { el.style.display = 'none'; });
  stopWerewolfGame();
  var n = (roomPlayersList || []).length;
  if (n < WW_MIN_PLAYERS || n > WW_MAX_PLAYERS) {
    document.getElementById('ww-error-area').style.display = '';
    document.getElementById('ww-error-msg').textContent =
      '늑대인간 게임은 ' + WW_MIN_PLAYERS + '~' + WW_MAX_PLAYERS + '명이 모여야 할 수 있어요. 지금 방 인원: ' + n + '명. 인원을 맞춘 뒤 홈에서 다시 골라주세요.';
    return;
  }
  var starter = (myPlayerId === roomHostId) ? wwHostInit() : Promise.resolve();
  starter.then(function () {
    wwPoll();
    WW_POLL_TIMER = setInterval(wwPoll, 1000);
  });
}

function wwAssignRoles() {
  var table = WW_ROLE_TABLE[roomPlayersList.length];
  var pool = [];
  var i;
  for (i = 0; i < table.wolf; i++) pool.push('wolf');
  for (i = 0; i < table.seer; i++) pool.push('seer');
  for (i = 0; i < table.hunter; i++) pool.push('hunter');
  for (i = 0; i < table.villager; i++) pool.push('villager');
  pool = shuffleArray(pool);
  return roomPlayersList.map(function (p, idx) {
    return { id: p.id, name: p.name, role: pool[idx], alive: true };
  });
}

/* 방장만 초기 상태를 만듭니다. (마피아 게임과 같은 패턴: 같은 인원으로 이미 진행 중인 판이
   있으면 이어받고, 아니면 새로 역할을 나눠서 시작합니다.) */
function wwHostInit() {
  return DBget(wwKey()).then(function (state) {
    var currentIds = (roomPlayersList || []).map(function (p) { return p.id; }).sort().join(',');
    var existingIds = (state && state.players) ? state.players.map(function (p) { return p.id; }).sort().join(',') : '';
    if (state && state.phase && existingIds === currentIds) return;
    var newState = {
      phase: 'reveal',
      round: 1,
      players: wwAssignRoles(),
      night: null,
      day: null,
      revenge: null,
      deathLog: [],
      winner: null
    };
    return DBset(wwKey(), newState);
  });
}

function wwPoll() {
  DBget(wwKey()).then(function (state) {
    if (!state) return;
    wwRender(state);
    wwMaybeResolve(state);
  });
}

function wwRender(state) {
  document.querySelectorAll('#werewolf .ww-phase').forEach(function (el) { el.style.display = 'none'; });
  var myP = state.players.filter(function (p) { return p.id === myPlayerId; })[0];
  if (state.phase === 'reveal') wwRenderReveal(state, myP);
  else if (state.phase === 'night') wwRenderNight(state, myP);
  else if (state.phase === 'hunter_revenge') wwRenderHunterRevenge(state, myP);
  else if (state.phase === 'morning') wwRenderMorning(state, myP);
  else if (state.phase === 'day') wwRenderDay(state, myP);
  else if (state.phase === 'end') { wwRenderEnd(state, myP); stopWerewolfGame(); }
}

function wwRenderReveal(state, myP) {
  document.getElementById('ww-role-area').style.display = '';
  if (!myP) return;
  document.getElementById('ww-my-role').textContent = WW_ROLE_LABEL[myP.role];
  document.getElementById('ww-my-role-desc').textContent = WW_ROLE_DESC[myP.role];
  var teammateEl = document.getElementById('ww-wolf-teammates');
  if (myP.role === 'wolf') {
    var teammates = state.players.filter(function (p) { return p.role === 'wolf' && p.id !== myPlayerId; }).map(function (p) { return p.name; });
    teammateEl.style.display = '';
    teammateEl.textContent = teammates.length ? ('함께하는 늑대인간: ' + teammates.join(', ')) : '이번 판에는 늑대인간이 나 혼자예요. 신중하게 행동하세요!';
  } else {
    teammateEl.style.display = 'none';
  }
  var isHost = myPlayerId === roomHostId;
  document.getElementById('ww-host-start-night-btn').style.display = isHost ? '' : 'none';
  document.getElementById('ww-reveal-wait-hint').style.display = isHost ? 'none' : '';
}

function wwHostStartNight() {
  if (myPlayerId !== roomHostId) return;
  DBget(wwKey()).then(function (state) {
    if (!state || state.phase !== 'reveal') return;
    state.phase = 'night';
    state.night = { deadline: Date.now() + WW_NIGHT_SECONDS * 1000, wolfVotes: {}, seerTarget: null, resolved: false, killedId: null, killedName: null, seerResult: null };
    DBset(wwKey(), state).then(wwPoll);
  });
}

function wwRenderNight(state, myP) {
  document.getElementById('ww-night-area').style.display = '';
  var remain = Math.max(0, Math.round((state.night.deadline - Date.now()) / 1000));
  document.getElementById('ww-night-timer').textContent = '🌙 밤 ' + remain + '초 남음';
  var alivePlayers = state.players.filter(function (p) { return p.alive; });
  var actionBox = document.getElementById('ww-night-action-box');
  var waitBox = document.getElementById('ww-night-wait-box');
  var amAlive = myP && myP.alive;
  if (!amAlive) {
    actionBox.style.display = 'none';
    waitBox.style.display = '';
    waitBox.textContent = '당신은 이미 탈락해서 행동할 수 없어요. 아침 결과를 기다려주세요...';
    return;
  }
  if (myP.role === 'wolf') {
    actionBox.style.display = '';
    waitBox.style.display = 'none';
    var targets = alivePlayers.filter(function (p) { return p.role !== 'wolf'; });
    var wolfAliveCount = alivePlayers.filter(function (p) { return p.role === 'wolf'; }).length;
    var votedCount = Object.keys(state.night.wolfVotes || {}).length;
    document.getElementById('ww-night-role-hint').textContent = '해치울 사람을 골라주세요. (' + votedCount + '/' + wolfAliveCount + '명 늑대인간 선택 완료)';
    mfRenderTargetButtons('ww-night-targets', targets, (state.night.wolfVotes || {})[myPlayerId], wwSubmitWolfVote);
  } else if (myP.role === 'seer') {
    actionBox.style.display = '';
    waitBox.style.display = 'none';
    var targets2 = alivePlayers.filter(function (p) { return p.id !== myPlayerId; });
    document.getElementById('ww-night-role-hint').textContent = '조사할 사람을 골라주세요. 다음 날 아침 정확한 역할을 알 수 있어요.';
    mfRenderTargetButtons('ww-night-targets', targets2, state.night.seerTarget, wwSubmitSeerTarget);
  } else {
    actionBox.style.display = 'none';
    waitBox.style.display = '';
    waitBox.textContent = '🌙 밤이 깊었어요... 늑대인간이 해칠 사람을 고르고, 예언자도 누군가를 조사하고 있어요. 아침까지 기다려주세요.';
  }
}

function wwSubmitWolfVote(targetId) {
  DBget(wwKey()).then(function (state) {
    if (!state || state.phase !== 'night' || !state.night || state.night.resolved) return;
    state.night.wolfVotes = state.night.wolfVotes || {};
    state.night.wolfVotes[myPlayerId] = targetId;
    DBset(wwKey(), state).then(wwPoll);
  });
}
function wwSubmitSeerTarget(targetId) {
  DBget(wwKey()).then(function (state) {
    if (!state || state.phase !== 'night' || !state.night || state.night.resolved) return;
    state.night.seerTarget = targetId;
    DBset(wwKey(), state).then(wwPoll);
  });
}

function wwAllNightActionsIn(state) {
  var alive = state.players.filter(function (p) { return p.alive; });
  var wolfAlive = alive.filter(function (p) { return p.role === 'wolf'; });
  var seerAlive = alive.filter(function (p) { return p.role === 'seer'; });
  var wolfVotes = state.night.wolfVotes || {};
  var wolfDone = wolfAlive.length > 0 && wolfAlive.every(function (p) { return Object.prototype.hasOwnProperty.call(wolfVotes, p.id); });
  var seerDone = seerAlive.length === 0 || !!state.night.seerTarget;
  return wolfDone && seerDone;
}

function wwCheckWin(players) {
  var aliveWolf = players.filter(function (p) { return p.alive && p.role === 'wolf'; }).length;
  var aliveOthers = players.filter(function (p) { return p.alive && p.role !== 'wolf'; }).length;
  if (aliveWolf === 0) return 'villager';
  if (aliveWolf >= aliveOthers) return 'wolf';
  return null;
}

function wwResolveNight(state) {
  var night = state.night;
  if (!night || night.resolved) return;
  var wolfVotes = night.wolfVotes || {};
  var voteCounts = {};
  Object.keys(wolfVotes).forEach(function (wid) {
    var t = wolfVotes[wid];
    voteCounts[t] = (voteCounts[t] || 0) + 1;
  });
  var killTargetId = mfPickMajority(voteCounts);

  var newPlayers = state.players.map(function (p) { return { id: p.id, name: p.name, role: p.role, alive: p.alive }; });
  var deathName = null;
  var victimRole = null;
  if (killTargetId) {
    newPlayers.forEach(function (p) { if (p.id === killTargetId) p.alive = false; });
    var victim = newPlayers.filter(function (p) { return p.id === killTargetId; })[0];
    deathName = victim ? victim.name : null;
    victimRole = victim ? victim.role : null;
  }
  var seerResult = null;
  if (night.seerTarget) {
    var target = state.players.filter(function (p) { return p.id === night.seerTarget; })[0];
    if (target) seerResult = { targetId: target.id, targetName: target.name, role: target.role };
  }

  var deathLog = (state.deathLog || []).slice();
  deathLog.push({ round: state.round, name: deathName, cause: 'night' });

  var newNight = {
    deadline: night.deadline, wolfVotes: wolfVotes, seerTarget: night.seerTarget,
    resolved: true, killedId: killTargetId, killedName: deathName, seerResult: seerResult
  };

  if (killTargetId && victimRole === 'hunter') {
    var newState1 = {
      phase: 'hunter_revenge', round: state.round, players: newPlayers,
      night: newNight, day: state.day, deathLog: deathLog, winner: null,
      revenge: { hunterId: killTargetId, hunterName: deathName, cause: 'night', deadline: Date.now() + WW_REVENGE_SECONDS * 1000, targetId: null, resolved: false, revengeKilledId: null, revengeKilledName: null }
    };
    return DBset(wwKey(), newState1).then(wwPoll);
  }
  var winner = wwCheckWin(newPlayers);
  var newState = {
    phase: winner ? 'end' : 'morning', round: state.round, players: newPlayers,
    night: newNight, day: state.day, deathLog: deathLog, winner: winner, revenge: null
  };
  return DBset(wwKey(), newState).then(wwPoll);
}

function wwRenderHunterRevenge(state, myP) {
  document.getElementById('ww-revenge-area').style.display = '';
  var revenge = state.revenge;
  var remain = Math.max(0, Math.round((revenge.deadline - Date.now()) / 1000));
  document.getElementById('ww-revenge-timer').textContent = '🏹 ' + remain + '초 남음';
  var isHunter = myP && myP.id === revenge.hunterId;
  var actionBox = document.getElementById('ww-revenge-action-box');
  var waitBox = document.getElementById('ww-revenge-wait-box');
  document.getElementById('ww-revenge-msg').textContent =
    '🏹 사냥꾼 ' + revenge.hunterName + '님이 쓰러지면서 마지막 복수를 준비하고 있어요!';
  if (isHunter && !revenge.resolved) {
    actionBox.style.display = '';
    waitBox.style.display = 'none';
    var targets = state.players.filter(function (p) { return p.alive; });
    document.getElementById('ww-revenge-hint').textContent = '함께 데려갈 한 명을 골라주세요. (안 골라도 시간이 지나면 그냥 넘어가요)';
    mfRenderTargetButtons('ww-revenge-targets', targets, revenge.targetId, wwSubmitRevengeTarget);
  } else {
    actionBox.style.display = 'none';
    waitBox.style.display = '';
    waitBox.textContent = isHunter ? '복수가 처리되는 중이에요...' : '사냥꾼이 복수할 대상을 고르는 중이에요. 잠시만 기다려주세요...';
  }
}

function wwSubmitRevengeTarget(targetId) {
  DBget(wwKey()).then(function (state) {
    if (!state || state.phase !== 'hunter_revenge' || !state.revenge || state.revenge.resolved) return;
    if (myPlayerId !== state.revenge.hunterId) return;
    state.revenge.targetId = targetId;
    DBset(wwKey(), state).then(wwPoll);
  });
}

function wwResolveRevenge(state) {
  var revenge = state.revenge;
  if (!revenge || revenge.resolved) return;
  var newPlayers = state.players.map(function (p) { return { id: p.id, name: p.name, role: p.role, alive: p.alive }; });
  var killId = null, killName = null;
  if (revenge.targetId) {
    var t = newPlayers.filter(function (p) { return p.id === revenge.targetId && p.alive; })[0];
    if (t) { t.alive = false; killId = t.id; killName = t.name; }
  }
  var deathLog = (state.deathLog || []).slice();
  if (killId) deathLog.push({ round: state.round, name: killName, cause: 'revenge' });

  var newRevenge = {
    hunterId: revenge.hunterId, hunterName: revenge.hunterName, cause: revenge.cause,
    deadline: revenge.deadline, targetId: revenge.targetId, resolved: true,
    revengeKilledId: killId, revengeKilledName: killName
  };

  var winner = wwCheckWin(newPlayers);
  var newState;
  if (winner) {
    newState = { phase: 'end', round: state.round, players: newPlayers, night: state.night, day: state.day, deathLog: deathLog, winner: winner, revenge: newRevenge };
  } else if (revenge.cause === 'night') {
    newState = { phase: 'morning', round: state.round, players: newPlayers, night: state.night, day: state.day, deathLog: deathLog, winner: null, revenge: newRevenge };
  } else {
    newState = {
      phase: 'night', round: state.round + 1, players: newPlayers,
      night: { deadline: Date.now() + WW_NIGHT_SECONDS * 1000, wolfVotes: {}, seerTarget: null, resolved: false, killedId: null, killedName: null, seerResult: null },
      day: state.day, deathLog: deathLog, winner: null, revenge: newRevenge
    };
  }
  return DBset(wwKey(), newState).then(wwPoll);
}

function wwRenderMorning(state, myP) {
  document.getElementById('ww-morning-area').style.display = '';
  var night = state.night || {};
  var msgEl = document.getElementById('ww-morning-msg');
  if (night.killedName) {
    msgEl.textContent = '☠️ 밤 사이 ' + night.killedName + '님이 목숨을 잃었어요.';
    msgEl.className = 'sd-msg over';
  } else {
    msgEl.textContent = '😌 아무도 목숨을 잃지 않았어요!';
    msgEl.className = 'sd-msg win';
  }
  var revengeEl = document.getElementById('ww-morning-revenge');
  if (state.revenge && state.revenge.cause === 'night' && state.revenge.revengeKilledName) {
    revengeEl.style.display = '';
    revengeEl.textContent = '🏹 사냥꾼 ' + state.revenge.hunterName + '님이 복수로 ' + state.revenge.revengeKilledName + '님을 함께 데려갔어요!';
  } else {
    revengeEl.style.display = 'none';
  }
  var seerEl = document.getElementById('ww-seer-result');
  if (myP && myP.role === 'seer' && night.seerResult) {
    seerEl.style.display = '';
    seerEl.innerHTML = '<div class="board-box-title">🔮 간밤의 조사 결과</div>' + esc(night.seerResult.targetName) + '님의 역할은 <b style="color:var(--coral)">' + WW_ROLE_LABEL[night.seerResult.role] + '</b> 입니다!';
  } else {
    seerEl.style.display = 'none';
  }
  var isHost = myPlayerId === roomHostId;
  document.getElementById('ww-host-start-day-btn').style.display = isHost ? '' : 'none';
  document.getElementById('ww-morning-wait-hint').style.display = isHost ? 'none' : '';
}

function wwHostStartDay() {
  if (myPlayerId !== roomHostId) return;
  DBget(wwKey()).then(function (state) {
    if (!state || state.phase !== 'morning') return;
    state.phase = 'day';
    state.day = { deadline: Date.now() + WW_DAY_SECONDS * 1000, votes: {}, resolved: false, executedId: null, executedName: null };
    DBset(wwKey(), state).then(wwPoll);
  });
}

function wwRenderDay(state, myP) {
  document.getElementById('ww-day-area').style.display = '';
  var remain = Math.max(0, Math.round((state.day.deadline - Date.now()) / 1000));
  var alivePlayers = state.players.filter(function (p) { return p.alive; });
  var votes = state.day.votes || {};
  var counts = {};
  Object.keys(votes).forEach(function (vid) { var t = votes[vid]; counts[t] = (counts[t] || 0) + 1; });
  var amAlive = myP && myP.alive;

  var wrap = document.getElementById('ww-day-targets');
  wrap.innerHTML = '';
  alivePlayers.forEach(function (p) {
    var btn = document.createElement('button');
    var c = counts[p.id] || 0;
    btn.className = 'cat-btn' + (votes[myPlayerId] === p.id ? ' voted' : '');
    btn.innerHTML = esc(p.name) + (p.id === myPlayerId ? ' (나)' : '') + (c > 0 ? ' <span class="cat-vote-count">' + c + '표</span>' : '');
    if (amAlive) btn.onclick = function () { wwSubmitDayVote(p.id); };
    else btn.disabled = true;
    wrap.appendChild(btn);
  });
  var skipBtn = document.getElementById('ww-day-skip-btn');
  var skipCount = counts.skip || 0;
  skipBtn.innerHTML = '🤷 기권' + (skipCount > 0 ? ' <span class="cat-vote-count">' + skipCount + '표</span>' : '');
  skipBtn.className = 'cat-btn' + (votes[myPlayerId] === 'skip' ? ' voted' : '');
  skipBtn.onclick = amAlive ? function () { wwSubmitDayVote('skip'); } : null;
  skipBtn.disabled = !amAlive;

  var votedCount = Object.keys(votes).filter(function (id) { return alivePlayers.some(function (p) { return p.id === id; }); }).length;
  document.getElementById('ww-day-timer').textContent = '☀️ 낮 ' + remain + '초 남음';
  document.getElementById('ww-day-hint').textContent = amAlive
    ? ('의심되는 사람에게 투표하세요 (' + votedCount + '/' + alivePlayers.length + '명 투표 완료). 동점이면 아무도 처형되지 않아요.')
    : '당신은 탈락해서 투표할 수 없지만, 계속 지켜볼 수 있어요.';

  var logEl = document.getElementById('ww-day-deathlog');
  logEl.innerHTML = (state.deathLog || []).map(function (d) {
    return '<div class="lb-row"><span>' + d.round + '라운드</span><span>' + (d.name ? (esc(d.name) + '님 (' + (WW_DEATH_CAUSE_LABEL[d.cause] || d.cause) + ')') : '아무도 사망하지 않음') + '</span></div>';
  }).join('') || '<div class="empty-lb">아직 기록이 없어요.</div>';
}

function wwSubmitDayVote(targetId) {
  DBget(wwKey()).then(function (state) {
    if (!state || state.phase !== 'day' || !state.day || state.day.resolved) return;
    var myP = state.players.filter(function (p) { return p.id === myPlayerId; })[0];
    if (!myP || !myP.alive) return;
    state.day.votes = state.day.votes || {};
    state.day.votes[myPlayerId] = targetId;
    DBset(wwKey(), state).then(wwPoll);
  });
}

function wwResolveDay(state) {
  var day = state.day;
  if (!day || day.resolved) return;
  var votes = day.votes || {};
  var counts = {};
  Object.keys(votes).forEach(function (vid) {
    var t = votes[vid];
    if (!t || t === 'skip') return;
    counts[t] = (counts[t] || 0) + 1;
  });
  var keys = Object.keys(counts);
  var executedId = null;
  if (keys.length) {
    var max = 0;
    keys.forEach(function (k) { if (counts[k] > max) max = counts[k]; });
    var top = keys.filter(function (k) { return counts[k] === max; });
    if (top.length === 1) executedId = top[0];
  }
  var newPlayers = state.players.map(function (p) { return { id: p.id, name: p.name, role: p.role, alive: p.alive }; });
  var execName = null;
  var execRole = null;
  if (executedId) {
    newPlayers.forEach(function (p) { if (p.id === executedId) p.alive = false; });
    var v = newPlayers.filter(function (p) { return p.id === executedId; })[0];
    execName = v ? v.name : null;
    execRole = v ? v.role : null;
  }
  var deathLog = (state.deathLog || []).slice();
  deathLog.push({ round: state.round, name: execName, cause: 'vote' });

  var newDay = { deadline: day.deadline, votes: votes, resolved: true, executedId: executedId, executedName: execName };

  if (executedId && execRole === 'hunter') {
    var newState1 = {
      phase: 'hunter_revenge', round: state.round, players: newPlayers,
      night: state.night, day: newDay, deathLog: deathLog, winner: null,
      revenge: { hunterId: executedId, hunterName: execName, cause: 'vote', deadline: Date.now() + WW_REVENGE_SECONDS * 1000, targetId: null, resolved: false, revengeKilledId: null, revengeKilledName: null }
    };
    return DBset(wwKey(), newState1).then(wwPoll);
  }
  var winner = wwCheckWin(newPlayers);
  var newState;
  if (winner) {
    newState = { phase: 'end', round: state.round, players: newPlayers, night: state.night, day: newDay, deathLog: deathLog, winner: winner, revenge: null };
  } else {
    newState = {
      phase: 'night', round: state.round + 1, players: newPlayers,
      night: { deadline: Date.now() + WW_NIGHT_SECONDS * 1000, wolfVotes: {}, seerTarget: null, resolved: false, killedId: null, killedName: null, seerResult: null },
      day: newDay, deathLog: deathLog, winner: null, revenge: null
    };
  }
  return DBset(wwKey(), newState).then(wwPoll);
}

function wwMaybeResolve(state) {
  if (state.phase === 'night' && state.night && !state.night.resolved) {
    if (Date.now() >= state.night.deadline || wwAllNightActionsIn(state)) wwResolveNight(state);
  } else if (state.phase === 'hunter_revenge' && state.revenge && !state.revenge.resolved) {
    if (Date.now() >= state.revenge.deadline || state.revenge.targetId) wwResolveRevenge(state);
  } else if (state.phase === 'day' && state.day && !state.day.resolved) {
    var aliveIds = state.players.filter(function (p) { return p.alive; }).map(function (p) { return p.id; });
    var votedCount = Object.keys(state.day.votes || {}).filter(function (id) { return aliveIds.indexOf(id) !== -1; }).length;
    if (Date.now() >= state.day.deadline || (aliveIds.length > 0 && votedCount >= aliveIds.length)) wwResolveDay(state);
  }
}

function wwRenderEnd(state) {
  document.getElementById('ww-end-area').style.display = '';
  var bannerEl = document.getElementById('ww-end-banner');
  if (state.winner === 'wolf') {
    bannerEl.textContent = '🐺 늑대인간 팀 승리!';
    bannerEl.style.color = 'var(--coral)';
  } else {
    bannerEl.textContent = '🙂 주민 팀 승리!';
    bannerEl.style.color = 'var(--sky)';
  }
  var listEl = document.getElementById('ww-end-roles');
  listEl.innerHTML = state.players.map(function (p) {
    return '<div class="lb-row"><span>' + (p.alive ? '🟢' : '⚫') + ' ' + esc(p.name) + (p.id === myPlayerId ? ' (나)' : '') + '</span><span>' + WW_ROLE_LABEL[p.role] + '</span></div>';
  }).join('');
}
