/* ---------------- Sudoku ---------------- */
var SD_SOLUTION = null;
var SD_VALUES = null;    // current value in each cell (0 = empty)
var SD_GIVEN = null;     // fixed clue cells
var SD_MEMOS = null;     // SD_MEMOS[r][c] = [bool x9] pencil marks
var SD_SELECTED = null;  // { r, c } or null
var SD_MEMO_MODE = false;
var SD_MISTAKES = 0;
var SD_MAX_MISTAKES = 3;
var SD_SCORE = 0;
var SD_GAME_OVER = false;
var SD_PAUSED = false;
var SD_SECONDS = 0;
var SD_TIMER = null;
var SD_HISTORY = [];
var SD_HINTS_LEFT = 3;
var SD_HINTS_MAX = 3;
var SD_BLANKS = 45;
var SD_CURRENT_DIFF = 'medium';
var SD_DIFF_LABELS = { easy: '쉬움', medium: '보통', hard: '어려움' };
var SD_DIFF_BLANKS = { easy: 36, medium: 45, hard: 54 };
var SD_PUZZLE_ID = 0;
var SD_MOVESEQ = 0;

function sudokuEmptyGrid() {
  var g = [];
  for (var i = 0; i < 9; i++) g.push([0,0,0,0,0,0,0,0,0]);
  return g;
}

function sudokuValid(g, r, c, val) {
  for (var i = 0; i < 9; i++) {
    if (g[r][i] === val) return false;
    if (g[i][c] === val) return false;
  }
  var br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 3; j++) {
      if (g[br + i][bc + j] === val) return false;
    }
  }
  return true;
}

function sudokuFill(g) {
  for (var r = 0; r < 9; r++) {
    for (var c = 0; c < 9; c++) {
      if (g[r][c] === 0) {
        var nums = shuffleArray([1,2,3,4,5,6,7,8,9]);
        for (var k = 0; k < nums.length; k++) {
          var val = nums[k];
          if (sudokuValid(g, r, c, val)) {
            g[r][c] = val;
            if (sudokuFill(g)) return true;
            g[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function generateSolvedSudoku() {
  var g = sudokuEmptyGrid();
  sudokuFill(g);
  return g;
}

function emptyMemoGrid() {
  var g = [];
  for (var r = 0; r < 9; r++) {
    var row = [];
    for (var c = 0; c < 9; c++) row.push([false,false,false,false,false,false,false,false,false]);
    g.push(row);
  }
  return g;
}

var SD_VOTE_STOP = null;

function startSudokuGame() {
  clearInterval(pollTimer);
  document.getElementById('sd-difficulty-select').style.display = '';
  document.getElementById('sd-game-area').style.display = 'none';
  stopSudokuTimer();
  if (SD_VOTE_STOP) { SD_VOTE_STOP(); SD_VOTE_STOP = null; }
  if (playMode === 'online') {
    SD_VOTE_STOP = ctStartVoteUI('sudoku', 'sd-difficulty-select', 'sd-vote-hint', function (resolved) {
      SD_VOTE_STOP = null;
      if (!document.getElementById('sudoku').classList.contains('active')) return;
      chooseSudokuDifficulty(resolved);
    });
  } else {
    document.getElementById('sd-vote-hint').style.display = 'none';
  }
}

/* 난이도 버튼 클릭: 혼자하기는 바로 선택, 온라인은 다수결 투표에 한 표를 던집니다. */
function sdDifficultyClick(level) {
  if (playMode !== 'online') { chooseSudokuDifficulty(level); return; }
  ctCastVote('sudoku', level, function (resolved) {
    if (SD_VOTE_STOP) { SD_VOTE_STOP(); SD_VOTE_STOP = null; }
    if (!document.getElementById('sudoku').classList.contains('active')) return;
    chooseSudokuDifficulty(resolved);
  }, 'sd-difficulty-select', 'sd-vote-hint');
}

function chooseSudokuDifficulty(level) {
  SD_CURRENT_DIFF = level;
  SD_BLANKS = SD_DIFF_BLANKS[level];
  document.getElementById('sd-difficulty-select').style.display = 'none';
  document.getElementById('sd-game-area').style.display = '';
  if (playMode === 'solo') {
    newSudokuGame();
  } else {
    startSudokuOnline(level);
  }
}

function newSudokuGameBtn() {
  if (playMode === 'solo') { newSudokuGame(); return; }
  startSudokuOnline(SD_CURRENT_DIFF, true);
}

function backToSudokuDifficulty() {
  clearInterval(pollTimer);
  document.getElementById('sd-difficulty-select').style.display = '';
  document.getElementById('sd-game-area').style.display = 'none';
  stopSudokuTimer();
  if (SD_VOTE_STOP) { SD_VOTE_STOP(); SD_VOTE_STOP = null; }
  if (playMode === 'online') {
    SD_VOTE_STOP = ctStartVoteUI('sudoku', 'sd-difficulty-select', 'sd-vote-hint', function (resolved) {
      SD_VOTE_STOP = null;
      if (!document.getElementById('sudoku').classList.contains('active')) return;
      chooseSudokuDifficulty(resolved);
    });
  } else {
    document.getElementById('sd-vote-hint').style.display = 'none';
  }
}

/* ---- 온라인: 같은 스도쿠 판을 다 같이 채워나가는 협동 모드 ---- */
function startSudokuOnline(level, forceNew) {
  stopSudokuTimer();
  DBget(roomKey('sudoku')).then(function (state) {
    if (!forceNew && state && state.solution && !state.gameOver) {
      applySudokuState(state);
    } else {
      var solution = generateSolvedSudoku();
      var values = solution.map(function (row) { return row.slice(); });
      var positions = [];
      for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) positions.push([r, c]);
      positions = shuffleArray(positions);
      var blanks = SD_DIFF_BLANKS[level];
      for (var i = 0; i < blanks; i++) values[positions[i][0]][positions[i][1]] = 0;
      var given = values.map(function (row) { return row.map(function (v) { return v !== 0; }); });
      var newState = { puzzleId: Date.now(), solution: solution, given: given, values: values, memos: emptyMemoGrid(), mistakes: 0, maxMistakes: SD_MAX_MISTAKES, score: 0, gameOver: false, lastBy: '', moveSeq: 0, difficulty: level };
      DBset(roomKey('sudoku'), newState).then(function () { applySudokuState(newState); });
    }
  });
  clearInterval(pollTimer);
  pollTimer = setInterval(pollSudoku, 1500);
}

function pollSudoku() {
  DBget(roomKey('sudoku')).then(function (state) {
    if (!state) return;
    if (state.puzzleId !== SD_PUZZLE_ID || state.moveSeq !== SD_MOVESEQ) applySudokuState(state);
  });
}

function checkGridSolved(values, solution) {
  for (var r = 0; r < 9; r++) {
    for (var c = 0; c < 9; c++) {
      if (values[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

function applySudokuState(state) {
  var isNewPuzzle = state.puzzleId !== SD_PUZZLE_ID;
  SD_PUZZLE_ID = state.puzzleId;
  SD_MOVESEQ = state.moveSeq || 0;
  SD_SOLUTION = state.solution;
  SD_VALUES = state.values.map(function (row) { return row.slice(); });
  SD_GIVEN = state.given;
  SD_MISTAKES = state.mistakes;
  SD_MAX_MISTAKES = state.maxMistakes || 3;
  SD_SCORE = state.score;
  SD_GAME_OVER = state.gameOver;
  SD_CURRENT_DIFF = state.difficulty || SD_CURRENT_DIFF;
  SD_PAUSED = false;
  SD_HISTORY = [];
  /* 메모(연필 표시)도 이제 다 같이 공유되는 상태에 저장됩니다 - 예전엔 각자 화면에만 남아있어서
     같은 방 친구들끼리 메모가 안 보이는 문제가 있었습니다. */
  SD_MEMOS = state.memos ? state.memos.map(function (row) { return row.map(function (cell) { return cell.slice(); }); }) : emptyMemoGrid();
  if (isNewPuzzle) {
    SD_SELECTED = null;
    SD_SECONDS = 0;
    document.getElementById('sd-pause-overlay').style.display = 'none';
    document.getElementById('sd-pause-btn').textContent = '⏸️';
  }
  document.getElementById('sd-diff-pill').textContent = SD_DIFF_LABELS[SD_CURRENT_DIFF];
  updateSudokuStatsUI();
  renderSudoku();
  var msgEl = document.getElementById('sd-msg');
  if (state.gameOver) {
    stopSudokuTimer();
    if (checkGridSolved(state.values, state.solution)) {
      msgEl.textContent = '정답이에요! 다 같이 스도쿠 완성 🎉';
      msgEl.classList.add('win');
      msgEl.classList.remove('over');
    } else {
      msgEl.textContent = '아쉬워요! 실수를 너무 많이 했어요 😢 "새 게임"으로 다시 도전해보세요.';
      msgEl.classList.add('over');
      msgEl.classList.remove('win');
    }
  } else {
    msgEl.textContent = (state.lastBy && state.lastBy !== me.name) ? (state.lastBy + '님이 방금 칸을 채웠어요') : '';
    msgEl.classList.remove('win', 'over');
    /* 예전엔 새 퍼즐을 시작할 때만 타이머를 다시 돌렸는데, 그러면 게임 화면을 나갔다가 같은 판으로
       다시 들어왔을 때(예: 홈에 갔다가 재입장) 타이머가 멈춘 채로 안 움직이는 버그가 있었습니다.
       상태를 받아올 때마다 항상 타이머를 다시 걸어주면(이미 돌고 있어도 그냥 이어서 도는 것과 같음),
       이 문제 없이 항상 정확히 흘러갑니다. */
    startSudokuTimer();
  }
}

function pressSudokuNumberOnline(n, r, c) {
  if (SD_MEMO_MODE) {
    if (SD_VALUES[r][c]) return;
    SD_MEMOS[r][c][n - 1] = !SD_MEMOS[r][c][n - 1];
    renderSudoku();
    DBget(roomKey('sudoku')).then(function (state) {
      if (!state || state.gameOver) { if (state) applySudokuState(state); return; }
      state.memos = state.memos || emptyMemoGrid();
      state.memos[r][c][n - 1] = SD_MEMOS[r][c][n - 1];
      state.moveSeq = (state.moveSeq || 0) + 1;
      SD_MOVESEQ = state.moveSeq;
      DBset(roomKey('sudoku'), state);
    });
    return;
  }
  DBget(roomKey('sudoku')).then(function (state) {
    if (!state || state.gameOver) { if (state) applySudokuState(state); return; }
    if (state.values[r][c]) { applySudokuState(state); return; }
    state.values[r][c] = n;
    state.memos = state.memos || emptyMemoGrid();
    state.memos[r][c] = [false, false, false, false, false, false, false, false, false];
    var wasCorrect = (n === state.solution[r][c]);
    if (!wasCorrect) state.mistakes++;
    else state.score += 10;
    state.lastBy = me.name;
    state.moveSeq = (state.moveSeq || 0) + 1;
    if (!wasCorrect && state.mistakes >= (state.maxMistakes || 3)) state.gameOver = true;
    else if (wasCorrect && checkGridSolved(state.values, state.solution)) state.gameOver = true;
    DBset(roomKey('sudoku'), state).then(function () { applySudokuState(state); });
  });
}

function eraseSudokuCellOnline(r, c) {
  if (!SD_VALUES[r][c] && SD_MEMOS[r][c].indexOf(true) === -1) return;
  SD_MEMOS[r][c] = [false, false, false, false, false, false, false, false, false];
  DBget(roomKey('sudoku')).then(function (state) {
    if (!state || state.gameOver) { if (state) applySudokuState(state); return; }
    state.memos = state.memos || emptyMemoGrid();
    state.memos[r][c] = [false, false, false, false, false, false, false, false, false];
    state.values[r][c] = 0;
    state.lastBy = me.name;
    state.moveSeq = (state.moveSeq || 0) + 1;
    DBset(roomKey('sudoku'), state).then(function () { applySudokuState(state); });
  });
}

function useSudokuHintOnline() {
  var target = SD_SELECTED;
  if (!target || SD_GIVEN[target.r][target.c] || SD_VALUES[target.r][target.c] === SD_SOLUTION[target.r][target.c]) {
    var candidates = [];
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        if (!SD_GIVEN[r][c] && SD_VALUES[r][c] !== SD_SOLUTION[r][c]) candidates.push({ r: r, c: c });
      }
    }
    if (!candidates.length) return;
    target = candidates[Math.floor(Math.random() * candidates.length)];
  }
  SD_HINTS_LEFT--;
  SD_SELECTED = target;
  DBget(roomKey('sudoku')).then(function (state) {
    if (!state || state.gameOver) { if (state) applySudokuState(state); return; }
    state.values[target.r][target.c] = state.solution[target.r][target.c];
    state.memos = state.memos || emptyMemoGrid();
    state.memos[target.r][target.c] = [false, false, false, false, false, false, false, false, false];
    state.score += 10;
    state.lastBy = me.name;
    state.moveSeq = (state.moveSeq || 0) + 1;
    if (checkGridSolved(state.values, state.solution)) state.gameOver = true;
    DBset(roomKey('sudoku'), state).then(function () { applySudokuState(state); updateSudokuStatsUI(); });
  });
}

function newSudokuGame() {
  stopSudokuTimer();
  SD_SOLUTION = generateSolvedSudoku();
  SD_VALUES = SD_SOLUTION.map(function (row) { return row.slice(); });
  var positions = [];
  for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) positions.push([r, c]);
  positions = shuffleArray(positions);
  for (var i = 0; i < SD_BLANKS; i++) {
    SD_VALUES[positions[i][0]][positions[i][1]] = 0;
  }
  SD_GIVEN = SD_VALUES.map(function (row) { return row.map(function (v) { return v !== 0; }); });
  SD_MEMOS = emptyMemoGrid();
  SD_SELECTED = null;
  SD_MEMO_MODE = false;
  SD_MISTAKES = 0;
  SD_SCORE = 0;
  SD_GAME_OVER = false;
  SD_PAUSED = false;
  SD_SECONDS = 0;
  SD_HISTORY = [];
  SD_HINTS_LEFT = SD_HINTS_MAX;
  var memoBtn = document.getElementById('sd-memo-btn');
  if (memoBtn) memoBtn.classList.remove('active');
  document.getElementById('sd-memo-badge').textContent = 'OFF';
  document.getElementById('sd-diff-pill').textContent = SD_DIFF_LABELS[SD_CURRENT_DIFF];
  document.getElementById('sd-pause-overlay').style.display = 'none';
  document.getElementById('sd-pause-btn').textContent = '⏸️';
  updateSudokuStatsUI();
  renderSudoku();
  var msgEl = document.getElementById('sd-msg');
  msgEl.textContent = '';
  msgEl.classList.remove('win', 'over');
  startSudokuTimer();
}

function updateSudokuStatsUI() {
  document.getElementById('sd-mistakes').textContent = SD_MISTAKES + '/' + SD_MAX_MISTAKES;
  document.getElementById('sd-score').textContent = SD_SCORE;
  var m = Math.floor(SD_SECONDS / 60), s = SD_SECONDS % 60;
  document.getElementById('sd-timer').textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  var undoBtn = document.getElementById('sd-undo-btn');
  if (undoBtn) undoBtn.disabled = SD_HISTORY.length === 0 || SD_GAME_OVER;
  var hintBtn = document.getElementById('sd-hint-btn');
  if (hintBtn) hintBtn.disabled = SD_HINTS_LEFT <= 0 || SD_GAME_OVER;
  var hintBadge = document.getElementById('sd-hint-badge');
  if (hintBadge) hintBadge.textContent = SD_HINTS_LEFT;
}

function startSudokuTimer() {
  stopSudokuTimer();
  SD_TIMER = setInterval(function () {
    if (SD_PAUSED || SD_GAME_OVER) return;
    SD_SECONDS++;
    updateSudokuStatsUI();
  }, 1000);
}

function stopSudokuTimer() {
  if (SD_TIMER) { clearInterval(SD_TIMER); SD_TIMER = null; }
}

function toggleSudokuPause() {
  if (SD_GAME_OVER || !SD_VALUES) return;
  SD_PAUSED = !SD_PAUSED;
  document.getElementById('sd-pause-overlay').style.display = SD_PAUSED ? '' : 'none';
  document.getElementById('sd-pause-btn').textContent = SD_PAUSED ? '▶️' : '⏸️';
}

function renderSudoku() {
  var el = document.getElementById('sd-grid');
  var html = '<div class="sd-pause-overlay" id="sd-pause-overlay" style="display:' + (SD_PAUSED ? '' : 'none') + '"><p>일시정지</p><button class="btn btn-primary" onclick="toggleSudokuPause()">계속하기</button></div>';
  var selR = SD_SELECTED ? SD_SELECTED.r : -1;
  var selC = SD_SELECTED ? SD_SELECTED.c : -1;
  var selVal = (SD_SELECTED && SD_VALUES[selR][selC]) ? SD_VALUES[selR][selC] : 0;
  for (var r = 0; r < 9; r++) {
    for (var c = 0; c < 9; c++) {
      var given = SD_GIVEN[r][c];
      var val = SD_VALUES[r][c];
      var cls = 'sd-cell';
      if ((c + 1) % 3 === 0 && c !== 8) cls += ' sd-border-r';
      if ((r + 1) % 3 === 0 && r !== 8) cls += ' sd-border-b';
      if (given) cls += ' sd-given';
      var isSelected = (r === selR && c === selC);
      var isPeer = SD_SELECTED && !isSelected && (r === selR || c === selC || (Math.floor(r / 3) === Math.floor(selR / 3) && Math.floor(c / 3) === Math.floor(selC / 3)));
      if (isPeer) cls += ' sd-peer';
      if (selVal && val === selVal && !isSelected) cls += ' sd-same-num';
      var inner = '';
      if (given) {
        inner = String(val);
      } else if (val) {
        cls += (val === SD_SOLUTION[r][c]) ? ' sd-correct' : ' sd-wrong';
        inner = String(val);
      } else {
        var memos = SD_MEMOS[r][c];
        if (memos.indexOf(true) !== -1) {
          var mhtml = '<div class="sd-memo-grid">';
          for (var d = 1; d <= 9; d++) mhtml += '<div class="sd-memo-digit">' + (memos[d - 1] ? d : '') + '</div>';
          mhtml += '</div>';
          inner = mhtml;
        }
      }
      if (isSelected) cls += ' sd-selected';
      var clickAttr = (SD_GAME_OVER || SD_PAUSED) ? '' : (' onclick="selectSudokuCell(' + r + ',' + c + ')"');
      html += '<div class="' + cls + '" id="sd-cell-' + r + '-' + c + '"' + clickAttr + '>' + inner + '</div>';
    }
  }
  el.innerHTML = html;
}

function selectSudokuCell(r, c) {
  if (SD_GAME_OVER || SD_PAUSED) return;
  SD_SELECTED = { r: r, c: c };
  renderSudoku();
}

function toggleSudokuMemo() {
  SD_MEMO_MODE = !SD_MEMO_MODE;
  document.getElementById('sd-memo-btn').classList.toggle('active', SD_MEMO_MODE);
  document.getElementById('sd-memo-badge').textContent = SD_MEMO_MODE ? 'ON' : 'OFF';
}

function pressSudokuNumber(n) {
  if (SD_GAME_OVER || SD_PAUSED || !SD_SELECTED) return;
  var r = SD_SELECTED.r, c = SD_SELECTED.c;
  if (SD_GIVEN[r][c]) return;
  if (playMode !== 'solo') { pressSudokuNumberOnline(n, r, c); return; }
  var msgEl = document.getElementById('sd-msg');
  if (SD_MEMO_MODE) {
    if (SD_VALUES[r][c]) return;
    SD_HISTORY.push({ r: r, c: c, type: 'memo', prevMemos: SD_MEMOS[r][c].slice() });
    SD_MEMOS[r][c][n - 1] = !SD_MEMOS[r][c][n - 1];
    updateSudokuStatsUI();
    renderSudoku();
    return;
  }
  SD_HISTORY.push({ r: r, c: c, type: 'value', prevValue: SD_VALUES[r][c], prevMemos: SD_MEMOS[r][c].slice(), prevMistakes: SD_MISTAKES, prevScore: SD_SCORE });
  SD_VALUES[r][c] = n;
  SD_MEMOS[r][c] = [false,false,false,false,false,false,false,false,false];
  msgEl.textContent = '';
  msgEl.classList.remove('win');
  var wasCorrect = (n === SD_SOLUTION[r][c]);
  if (!wasCorrect) {
    SD_MISTAKES++;
  } else {
    SD_SCORE += 10;
  }
  updateSudokuStatsUI();
  renderSudoku();
  if (!wasCorrect && SD_MISTAKES >= SD_MAX_MISTAKES) {
    sudokuGameOver();
  } else if (wasCorrect) {
    checkSudokuComplete();
  }
}

function eraseSudokuCell() {
  if (SD_GAME_OVER || SD_PAUSED || !SD_SELECTED) return;
  var r = SD_SELECTED.r, c = SD_SELECTED.c;
  if (SD_GIVEN[r][c]) return;
  if (playMode !== 'solo') { eraseSudokuCellOnline(r, c); return; }
  if (!SD_VALUES[r][c] && SD_MEMOS[r][c].indexOf(true) === -1) return;
  SD_HISTORY.push({ r: r, c: c, type: 'value', prevValue: SD_VALUES[r][c], prevMemos: SD_MEMOS[r][c].slice(), prevMistakes: SD_MISTAKES, prevScore: SD_SCORE });
  SD_VALUES[r][c] = 0;
  SD_MEMOS[r][c] = [false,false,false,false,false,false,false,false,false];
  updateSudokuStatsUI();
  renderSudoku();
}

function undoSudoku() {
  if (SD_GAME_OVER || SD_PAUSED || SD_HISTORY.length === 0) return;
  var last = SD_HISTORY.pop();
  var r = last.r, c = last.c;
  if (last.type === 'memo') {
    SD_MEMOS[r][c] = last.prevMemos;
  } else {
    SD_VALUES[r][c] = last.prevValue;
    SD_MEMOS[r][c] = last.prevMemos;
    if (typeof last.prevMistakes === 'number') SD_MISTAKES = last.prevMistakes;
    if (typeof last.prevScore === 'number') SD_SCORE = last.prevScore;
  }
  SD_SELECTED = { r: r, c: c };
  updateSudokuStatsUI();
  renderSudoku();
}

function useSudokuHint() {
  if (SD_GAME_OVER || SD_PAUSED || SD_HINTS_LEFT <= 0) return;
  if (playMode !== 'solo') { useSudokuHintOnline(); return; }
  var target = SD_SELECTED;
  if (!target || SD_GIVEN[target.r][target.c] || SD_VALUES[target.r][target.c] === SD_SOLUTION[target.r][target.c]) {
    var candidates = [];
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        if (!SD_GIVEN[r][c] && SD_VALUES[r][c] !== SD_SOLUTION[r][c]) candidates.push({ r: r, c: c });
      }
    }
    if (!candidates.length) return;
    target = candidates[Math.floor(Math.random() * candidates.length)];
  }
  SD_HINTS_LEFT--;
  SD_HISTORY.push({ r: target.r, c: target.c, type: 'value', prevValue: SD_VALUES[target.r][target.c], prevMemos: SD_MEMOS[target.r][target.c].slice(), prevMistakes: SD_MISTAKES, prevScore: SD_SCORE });
  SD_VALUES[target.r][target.c] = SD_SOLUTION[target.r][target.c];
  SD_MEMOS[target.r][target.c] = [false,false,false,false,false,false,false,false,false];
  SD_SELECTED = target;
  updateSudokuStatsUI();
  renderSudoku();
  checkSudokuComplete();
}

function checkSudokuComplete() {
  for (var r = 0; r < 9; r++) {
    for (var c = 0; c < 9; c++) {
      if (SD_VALUES[r][c] !== SD_SOLUTION[r][c]) return false;
    }
  }
  var msgEl = document.getElementById('sd-msg');
  msgEl.textContent = '정답이에요! 스도쿠 완성 🎉';
  msgEl.classList.add('win');
  SD_GAME_OVER = true;
  stopSudokuTimer();
  updateSudokuStatsUI();
  return true;
}

function sudokuGameOver() {
  SD_GAME_OVER = true;
  stopSudokuTimer();
  var msgEl = document.getElementById('sd-msg');
  msgEl.textContent = '아쉬워요! 실수를 너무 많이 했어요 😢 다시 도전해보세요.';
  msgEl.classList.add('over');
  updateSudokuStatsUI();
}


