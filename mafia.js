/* ---------------- 마피아 게임 (온라인 전용, 4~9명) ----------------
   한 방의 모든 진행 상태(역할/밤 행동/낮 투표/사망 기록)를 roomKey('mafia') 하나의
   공용 상태 객체에 통째로 저장합니다. 누가 어떤 역할인지도 이 객체 안에 같이 들어있는데,
   이 게임판은 서버에 로그인/권한 개념이 없는 단순 방 코드 저장소라서 "그 사람만 읽을 수
   있는 비밀 데이터"를 서버 차원에서 완전히 숨기는 건 애초에 불가능합니다(개발자 도구로
   네트워크 요청을 들여다보면 다른 사람 역할도 보일 수 있음). 대신 화면(UI)에는 항상 내
   역할과 관련된 정보만 보여주고 다른 사람 역할은 전부 가려서, 평소에 플레이할 때는 자연스럽게
   역할이 숨겨지도록 만들었습니다(이 앱의 다른 게임들도 같은 수준의 신뢰 기반으로 동작합니다).

   진행 순서: reveal(역할 확인) → night(마피아 제거/경찰 조사/의사 보호) → morning(결과 발표)
             → day(토론+투표) → (게임 안 끝났으면) night로 복귀, 끝났으면 end */

var MF_POLL_TIMER = null;
var MF_MIN_PLAYERS = 4;
var MF_MAX_PLAYERS = 9;
var MF_NIGHT_SECONDS = 25;
var MF_DAY_SECONDS = 70;

var MF_ROLE_TABLE = {
  4: { mafia: 1, police: 1, doctor: 0, citizen: 2 },
  5: { mafia: 1, police: 1, doctor: 1, citizen: 2 },
  6: { mafia: 1, police: 1, doctor: 1, citizen: 3 },
  7: { mafia: 2, police: 1, doctor: 1, citizen: 3 },
  8: { mafia: 2, police: 1, doctor: 1, citizen: 4 },
  9: { mafia: 2, police: 1, doctor: 1, citizen: 5 }
};
var MF_ROLE_LABEL = { mafia: '🔪 마피아', police: '🔍 경찰', doctor: '💉 의사', citizen: '🙂 시민' };
var MF_ROLE_DESC = {
  mafia: '밤마다 다른 마피아와 함께(각자 투표) 한 명을 골라 제거하세요. 낮에는 시민인 척 숨어야 해요. 마피아 수가 마피아 아닌 사람 수 이상이 되면 마피아 팀이 승리해요.',
  police: '밤마다 한 명을 조사하면 다음 날 아침 그 사람이 마피아인지 아닌지 알 수 있어요. 낮 투표에 단서로 활용하세요.',
  doctor: '밤마다 한 명을 선택해서 그날 밤 공격으로부터 지켜주세요. 나 자신을 지킬 수도 있어요.',
  citizen: '특별한 능력은 없지만, 낮 토론과 투표로 마피아를 찾아내야 해요.'
};

function mfKey() { return roomKey('mafia'); }

function stopMafiaGame() {
  clearInterval(MF_POLL_TIMER);
  MF_POLL_TIMER = null;
}

function startMafiaGame() {
  document.querySelectorAll('#mafia .mf-phase').forEach(function (el) { el.style.display = 'none'; });
  stopMafiaGame();
  var n = (roomPlayersList || []).length;
  if (n < MF_MIN_PLAYERS || n > MF_MAX_PLAYERS) {
    document.getElementById('mf-error-area').style.display = '';
    document.getElementById('mf-error-msg').textContent =
      '마피아 게임은 ' + MF_MIN_PLAYERS + '~' + MF_MAX_PLAYERS + '명이 모여야 할 수 있어요. 지금 방 인원: ' + n + '명. 인원을 맞춘 뒤 홈에서 다시 골라주세요.';
    return;
  }
  var starter = (myPlayerId === roomHostId) ? mfHostInit() : Promise.resolve();
  starter.then(function () {
    mfPoll();
    MF_POLL_TIMER = setInterval(mfPoll, 1000);
  });
}

function mfAssignRoles() {
  var table = MF_ROLE_TABLE[roomPlayersList.length];
  var pool = [];
  var i;
  for (i = 0; i < table.mafia; i++) pool.push('mafia');
  for (i = 0; i < table.police; i++) pool.push('police');
  for (i = 0; i < table.doctor; i++) pool.push('doctor');
  for (i = 0; i < table.citizen; i++) pool.push('citizen');
  pool = shuffleArray(pool);
  return roomPlayersList.map(function (p, idx) {
    return { id: p.id, name: p.name, role: pool[idx], alive: true };
  });
}

/* 방장만 초기 상태를 만듭니다. 이미 같은 인원으로 진행 중인 게임이 있으면(예: 새로고침
   후 재입장) 그 상태를 그대로 이어받고, 그게 아니면(처음 시작하거나 이전 판이 끝난 뒤
   다시 고른 경우) 새로 역할을 나눠서 시작합니다. */
function mfHostInit() {
  return DBget(mfKey()).then(function (state) {
    var currentIds = (roomPlayersList || []).map(function (p) { return p.id; }).sort().join(',');
    var existingIds = (state && state.players) ? state.players.map(function (p) { return p.id; }).sort().join(',') : '';
    if (state && state.phase && existingIds === currentIds) return;
    var newState = {
      phase: 'reveal',
      round: 1,
      players: mfAssignRoles(),
      night: null,
      day: null,
      deathLog: [],
      winner: null
    };
    return DBset(mfKey(), newState);
  });
}

function mfPoll() {
  DBget(mfKey()).then(function (state) {
    if (!state) return;
    mfRender(state);
    mfMaybeResolve(state);
  });
}

function mfRender(state) {
  document.querySelectorAll('#mafia .mf-phase').forEach(function (el) { el.style.display = 'none'; });
  var myP = state.players.filter(function (p) { return p.id === myPlayerId; })[0];
  if (state.phase === 'reveal') mfRenderReveal(state, myP);
  else if (state.phase === 'night') mfRenderNight(state, myP);
  else if (state.phase === 'morning') mfRenderMorning(state, myP);
  else if (state.phase === 'day') mfRenderDay(state, myP);
  else if (state.phase === 'end') { mfRenderEnd(state, myP); stopMafiaGame(); }
}

function mfRenderReveal(state, myP) {
  document.getElementById('mf-role-area').style.display = '';
  if (!myP) return;
  document.getElementById('mf-my-role').textContent = MF_ROLE_LABEL[myP.role];
  document.getElementById('mf-my-role-desc').textContent = MF_ROLE_DESC[myP.role];
  var teammateEl = document.getElementById('mf-mafia-teammates');
  if (myP.role === 'mafia') {
    var teammates = state.players.filter(function (p) { return p.role === 'mafia' && p.id !== myPlayerId; }).map(function (p) { return p.name; });
    teammateEl.style.display = '';
    teammateEl.textContent = teammates.length ? ('함께하는 마피아: ' + teammates.join(', ')) : '이번 판에는 마피아가 나 혼자예요. 신중하게 행동하세요!';
  } else {
    teammateEl.style.display = 'none';
  }
  var isHost = myPlayerId === roomHostId;
  document.getElementById('mf-host-start-night-btn').style.display = isHost ? '' : 'none';
  document.getElementById('mf-reveal-wait-hint').style.display = isHost ? 'none' : '';
}

function mfHostStartNight() {
  if (myPlayerId !== roomHostId) return;
  DBget(mfKey()).then(function (state) {
    if (!state || state.phase !== 'reveal') return;
    state.phase = 'night';
    state.night = { deadline: Date.now() + MF_NIGHT_SECONDS * 1000, mafiaVotes: {}, doctorTarget: null, policeTarget: null, resolved: false, killedId: null, killedName: null, savedByDoctor: false, policeResult: null };
    DBset(mfKey(), state).then(mfPoll);
  });
}

function mfRenderNight(state, myP) {
  document.getElementById('mf-night-area').style.display = '';
  var remain = Math.max(0, Math.round((state.night.deadline - Date.now()) / 1000));
  document.getElementById('mf-night-timer').textContent = '🌙 밤 ' + remain + '초 남음';
  var alivePlayers = state.players.filter(function (p) { return p.alive; });
  var actionBox = document.getElementById('mf-night-action-box');
  var waitBox = document.getElementById('mf-night-wait-box');
  var amAlive = myP && myP.alive;
  if (!amAlive) {
    actionBox.style.display = 'none';
    waitBox.style.display = '';
    waitBox.textContent = '당신은 이미 탈락해서 행동할 수 없어요. 아침 결과를 기다려주세요...';
    return;
  }
  if (myP.role === 'mafia') {
    actionBox.style.display = '';
    waitBox.style.display = 'none';
    var targets = alivePlayers.filter(function (p) { return p.role !== 'mafia'; });
    var mafiaAliveCount = alivePlayers.filter(function (p) { return p.role === 'mafia'; }).length;
    var votedCount = Object.keys(state.night.mafiaVotes || {}).length;
    document.getElementById('mf-night-role-hint').textContent = '제거할 사람을 골라주세요. (' + votedCount + '/' + mafiaAliveCount + '명 마피아 선택 완료)';
    mfRenderTargetButtons('mf-night-targets', targets, (state.night.mafiaVotes || {})[myPlayerId], mfSubmitMafiaVote);
  } else if (myP.role === 'police') {
    actionBox.style.display = '';
    waitBox.style.display = 'none';
    var targets2 = alivePlayers.filter(function (p) { return p.id !== myPlayerId; });
    document.getElementById('mf-night-role-hint').textContent = '조사할 사람을 골라주세요. 다음 날 아침 결과를 알 수 있어요.';
    mfRenderTargetButtons('mf-night-targets', targets2, state.night.policeTarget, mfSubmitPoliceTarget);
  } else if (myP.role === 'doctor') {
    actionBox.style.display = '';
    waitBox.style.display = 'none';
    document.getElementById('mf-night-role-hint').textContent = '보호할 사람을 골라주세요. (나 자신도 가능해요)';
    mfRenderTargetButtons('mf-night-targets', alivePlayers, state.night.doctorTarget, mfSubmitDoctorTarget);
  } else {
    actionBox.style.display = 'none';
    waitBox.style.display = '';
    waitBox.textContent = '🌙 밤이 깊었어요... 마피아가 범인을 고르고, 경찰과 의사도 각자 행동하고 있어요. 아침까지 기다려주세요.';
  }
}

function mfRenderTargetButtons(containerId, targets, selectedId, onClick) {
  var wrap = document.getElementById(containerId);
  wrap.innerHTML = '';
  targets.forEach(function (p) {
    var btn = document.createElement('button');
    btn.className = 'cat-btn' + (p.id === selectedId ? ' voted' : '');
    btn.textContent = p.name + (p.id === myPlayerId ? ' (나)' : '');
    btn.onclick = function () { onClick(p.id); };
    wrap.appendChild(btn);
  });
}

function mfSubmitMafiaVote(targetId) {
  DBget(mfKey()).then(function (state) {
    if (!state || state.phase !== 'night' || !state.night || state.night.resolved) return;
    state.night.mafiaVotes = state.night.mafiaVotes || {};
    state.night.mafiaVotes[myPlayerId] = targetId;
    DBset(mfKey(), state).then(mfPoll);
  });
}
function mfSubmitPoliceTarget(targetId) {
  DBget(mfKey()).then(function (state) {
    if (!state || state.phase !== 'night' || !state.night || state.night.resolved) return;
    state.night.policeTarget = targetId;
    DBset(mfKey(), state).then(mfPoll);
  });
}
function mfSubmitDoctorTarget(targetId) {
  DBget(mfKey()).then(function (state) {
    if (!state || state.phase !== 'night' || !state.night || state.night.resolved) return;
    state.night.doctorTarget = targetId;
    DBset(mfKey(), state).then(mfPoll);
  });
}

function mfAllNightActionsIn(state) {
  var alive = state.players.filter(function (p) { return p.alive; });
  var mafiaAlive = alive.filter(function (p) { return p.role === 'mafia'; });
  var policeAlive = alive.filter(function (p) { return p.role === 'police'; });
  var doctorAlive = alive.filter(function (p) { return p.role === 'doctor'; });
  var mafiaVotes = state.night.mafiaVotes || {};
  var mafiaDone = mafiaAlive.length > 0 && mafiaAlive.every(function (p) { return Object.prototype.hasOwnProperty.call(mafiaVotes, p.id); });
  var policeDone = policeAlive.length === 0 || !!state.night.policeTarget;
  var doctorDone = doctorAlive.length === 0 || !!state.night.doctorTarget;
  return mafiaDone && policeDone && doctorDone;
}

function mfPickMajority(counts) {
  var keys = Object.keys(counts);
  if (!keys.length) return null;
  var max = 0;
  keys.forEach(function (k) { if (counts[k] > max) max = counts[k]; });
  var top = keys.filter(function (k) { return counts[k] === max; }).sort();
  return top[0];
}

function mfCheckWin(players) {
  var aliveMafia = players.filter(function (p) { return p.alive && p.role === 'mafia'; }).length;
  var aliveOthers = players.filter(function (p) { return p.alive && p.role !== 'mafia'; }).length;
  if (aliveMafia === 0) return 'citizen';
  if (aliveMafia >= aliveOthers) return 'mafia';
  return null;
}

function mfResolveNight(state) {
  var night = state.night;
  if (!night || night.resolved) return;
  var mafiaVotes = night.mafiaVotes || {};
  var voteCounts = {};
  Object.keys(mafiaVotes).forEach(function (mid) {
    var t = mafiaVotes[mid];
    voteCounts[t] = (voteCounts[t] || 0) + 1;
  });
  var killTargetId = mfPickMajority(voteCounts);
  var savedByDoctor = !!(killTargetId && night.doctorTarget === killTargetId);
  var finalDeathId = (killTargetId && !savedByDoctor) ? killTargetId : null;

  var newPlayers = state.players.map(function (p) { return { id: p.id, name: p.name, role: p.role, alive: p.alive }; });
  var deathName = null;
  if (finalDeathId) {
    newPlayers.forEach(function (p) { if (p.id === finalDeathId) p.alive = false; });
    var victim = newPlayers.filter(function (p) { return p.id === finalDeathId; })[0];
    deathName = victim ? victim.name : null;
  }
  var policeResult = null;
  if (night.policeTarget) {
    var target = state.players.filter(function (p) { return p.id === night.policeTarget; })[0];
    if (target) policeResult = { targetId: target.id, targetName: target.name, isMafia: target.role === 'mafia' };
  }

  var deathLog = (state.deathLog || []).slice();
  deathLog.push({ round: state.round, name: deathName, cause: 'night' });

  var newNight = {
    deadline: night.deadline, mafiaVotes: mafiaVotes, doctorTarget: night.doctorTarget,
    policeTarget: night.policeTarget, resolved: true, killedId: finalDeathId,
    killedName: deathName, savedByDoctor: savedByDoctor, policeResult: policeResult
  };

  var winner = mfCheckWin(newPlayers);
  var newState = {
    phase: winner ? 'end' : 'morning', round: state.round, players: newPlayers,
    night: newNight, day: state.day, deathLog: deathLog, winner: winner
  };
  return DBset(mfKey(), newState).then(mfPoll);
}

function mfRenderMorning(state, myP) {
  document.getElementById('mf-morning-area').style.display = '';
  var night = state.night || {};
  var msgEl = document.getElementById('mf-morning-msg');
  if (night.killedName) {
    msgEl.textContent = '☠️ 밤 사이 ' + night.killedName + '님이 목숨을 잃었어요.';
    msgEl.className = 'sd-msg over';
  } else {
    msgEl.textContent = (night.savedByDoctor ? '🌟 의사가 공격을 막아내서' : '😌') + ' 아무도 목숨을 잃지 않았어요!';
    msgEl.className = 'sd-msg win';
  }
  var policeEl = document.getElementById('mf-police-result');
  if (myP && myP.role === 'police' && night.policeResult) {
    policeEl.style.display = '';
    policeEl.innerHTML = '<div class="board-box-title">🔍 간밤의 조사 결과</div>' + esc(night.policeResult.targetName) + '님은 ' + (night.policeResult.isMafia ? '<b style="color:var(--coral)">마피아입니다!</b>' : '마피아가 아니에요.');
  } else {
    policeEl.style.display = 'none';
  }
  var isHost = myPlayerId === roomHostId;
  document.getElementById('mf-host-start-day-btn').style.display = isHost ? '' : 'none';
  document.getElementById('mf-morning-wait-hint').style.display = isHost ? 'none' : '';
}

function mfHostStartDay() {
  if (myPlayerId !== roomHostId) return;
  DBget(mfKey()).then(function (state) {
    if (!state || state.phase !== 'morning') return;
    state.phase = 'day';
    state.day = { deadline: Date.now() + MF_DAY_SECONDS * 1000, votes: {}, resolved: false, executedId: null, executedName: null };
    DBset(mfKey(), state).then(mfPoll);
  });
}

function mfRenderDay(state, myP) {
  document.getElementById('mf-day-area').style.display = '';
  var remain = Math.max(0, Math.round((state.day.deadline - Date.now()) / 1000));
  var alivePlayers = state.players.filter(function (p) { return p.alive; });
  var votes = state.day.votes || {};
  var counts = {};
  Object.keys(votes).forEach(function (vid) { var t = votes[vid]; counts[t] = (counts[t] || 0) + 1; });
  var amAlive = myP && myP.alive;

  var wrap = document.getElementById('mf-day-targets');
  wrap.innerHTML = '';
  alivePlayers.forEach(function (p) {
    var btn = document.createElement('button');
    var c = counts[p.id] || 0;
    btn.className = 'cat-btn' + (votes[myPlayerId] === p.id ? ' voted' : '');
    btn.innerHTML = esc(p.name) + (p.id === myPlayerId ? ' (나)' : '') + (c > 0 ? ' <span class="cat-vote-count">' + c + '표</span>' : '');
    if (amAlive) btn.onclick = function () { mfSubmitDayVote(p.id); };
    else btn.disabled = true;
    wrap.appendChild(btn);
  });
  var skipBtn = document.getElementById('mf-day-skip-btn');
  var skipCount = counts.skip || 0;
  skipBtn.innerHTML = '🤷 기권' + (skipCount > 0 ? ' <span class="cat-vote-count">' + skipCount + '표</span>' : '');
  skipBtn.className = 'cat-btn' + (votes[myPlayerId] === 'skip' ? ' voted' : '');
  skipBtn.onclick = amAlive ? function () { mfSubmitDayVote('skip'); } : null;
  skipBtn.disabled = !amAlive;

  var votedCount = Object.keys(votes).filter(function (id) { return alivePlayers.some(function (p) { return p.id === id; }); }).length;
  document.getElementById('mf-day-timer').textContent = '☀️ 낮 ' + remain + '초 남음';
  document.getElementById('mf-day-hint').textContent = amAlive
    ? ('의심되는 사람에게 투표하세요 (' + votedCount + '/' + alivePlayers.length + '명 투표 완료). 동점이면 아무도 처형되지 않아요.')
    : '당신은 탈락해서 투표할 수 없지만, 계속 지켜볼 수 있어요.';

  var logEl = document.getElementById('mf-day-deathlog');
  logEl.innerHTML = (state.deathLog || []).map(function (d) {
    return '<div class="lb-row"><span>' + d.round + '라운드</span><span>' + (d.name ? (esc(d.name) + '님 (' + (d.cause === 'vote' ? '투표 처형' : '밤에 사망') + ')') : '아무도 사망하지 않음') + '</span></div>';
  }).join('') || '<div class="empty-lb">아직 기록이 없어요.</div>';
}

function mfSubmitDayVote(targetId) {
  DBget(mfKey()).then(function (state) {
    if (!state || state.phase !== 'day' || !state.day || state.day.resolved) return;
    var myP = state.players.filter(function (p) { return p.id === myPlayerId; })[0];
    if (!myP || !myP.alive) return;
    state.day.votes = state.day.votes || {};
    state.day.votes[myPlayerId] = targetId;
    DBset(mfKey(), state).then(mfPoll);
  });
}

function mfResolveDay(state) {
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
  if (executedId) {
    newPlayers.forEach(function (p) { if (p.id === executedId) p.alive = false; });
    var v = newPlayers.filter(function (p) { return p.id === executedId; })[0];
    execName = v ? v.name : null;
  }
  var deathLog = (state.deathLog || []).slice();
  deathLog.push({ round: state.round, name: execName, cause: 'vote' });

  var newDay = { deadline: day.deadline, votes: votes, resolved: true, executedId: executedId, executedName: execName };
  var winner = mfCheckWin(newPlayers);
  var newState;
  if (winner) {
    newState = { phase: 'end', round: state.round, players: newPlayers, night: state.night, day: newDay, deathLog: deathLog, winner: winner };
  } else {
    newState = {
      phase: 'night', round: state.round + 1, players: newPlayers,
      night: { deadline: Date.now() + MF_NIGHT_SECONDS * 1000, mafiaVotes: {}, doctorTarget: null, policeTarget: null, resolved: false, killedId: null, killedName: null, savedByDoctor: false, policeResult: null },
      day: newDay, deathLog: deathLog, winner: null
    };
  }
  return DBset(mfKey(), newState).then(mfPoll);
}

function mfMaybeResolve(state) {
  if (state.phase === 'night' && state.night && !state.night.resolved) {
    if (Date.now() >= state.night.deadline || mfAllNightActionsIn(state)) mfResolveNight(state);
  } else if (state.phase === 'day' && state.day && !state.day.resolved) {
    var aliveIds = state.players.filter(function (p) { return p.alive; }).map(function (p) { return p.id; });
    var votedCount = Object.keys(state.day.votes || {}).filter(function (id) { return aliveIds.indexOf(id) !== -1; }).length;
    if (Date.now() >= state.day.deadline || (aliveIds.length > 0 && votedCount >= aliveIds.length)) mfResolveDay(state);
  }
}

function mfRenderEnd(state) {
  document.getElementById('mf-end-area').style.display = '';
  var bannerEl = document.getElementById('mf-end-banner');
  if (state.winner === 'mafia') {
    bannerEl.textContent = '🔪 마피아 팀 승리!';
    bannerEl.style.color = 'var(--coral)';
  } else {
    bannerEl.textContent = '🙂 시민 팀 승리!';
    bannerEl.style.color = 'var(--sky)';
  }
  var listEl = document.getElementById('mf-end-roles');
  listEl.innerHTML = state.players.map(function (p) {
    return '<div class="lb-row"><span>' + (p.alive ? '🟢' : '⚫') + ' ' + esc(p.name) + (p.id === myPlayerId ? ' (나)' : '') + '</span><span>' + MF_ROLE_LABEL[p.role] + '</span></div>';
  }).join('');
}
