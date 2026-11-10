/* ---------------- 모락모락 피자가게 (혼자 하기 · 힐링 장사) ----------------
   손님 주문을 잘 알아듣고 피자를 만들어요. 손님들은 말을 빙빙 돌려서 해요!
   - "네?"를 누르면 다시 쉽게 말해줘요 (대신 팁이 줄어요)
   - 소스·치즈는 피자 위를 문질러서 바르고, 토핑은 눌러서(끌어서) 올려요
   - 오븐에 굽고(바삭하게면 두 번), 칼로 자르고(몇 조각?), 드리기!
   - 하루에 손님 6명. 돈을 벌면 다음 날 새 토핑이 생겨요. 진행은 이 기기에 저장돼요. */
var PZ = null, PZ_RAF = null;
var PZ_R = 150;          // 피자 반지름(캔버스 좌표)
var PZ_GRID = 36;        // 소스·치즈 칠한 곳 계산용 칸
var PZ_TOPS = {
  pep: { n: '페퍼로니', e: '🔴', day: 1, color: '#c62828', hint: ['빨갛고 동그란 거', '짭짤한 빨간 동그라미', '소시지를 동글게 썬 거'] },
  mush: { n: '버섯', e: '🍄', day: 2, color: '#d7ccc8', hint: ['숲에서 자라는 거', '우산처럼 생긴 거', '비 온 뒤에 쑥쑥 나는 거'] },
  onion: { n: '양파', e: '🧅', day: 3, color: '#e1bee7', hint: ['썰면 눈물 나는 거', '하얀 링 모양 채소', '눈물 쏙 빼는 채소'] },
  olive: { n: '올리브', e: '⚫', day: 4, color: '#263238', hint: ['까만 동그라미', '가운데 구멍 난 까만 열매', '까맣고 작은 열매'] },
  pepper: { n: '피망', e: '🫑', day: 5, color: '#43a047', hint: ['초록색 채소', '아이들이 제일 싫어하는 초록 채소', '종처럼 생긴 초록 채소'] },
  pine: { n: '파인애플', e: '🍍', day: 6, color: '#fdd835', hint: ['피자에 올리면 싸움 나는 과일', '노랗고 달콤한 열대 과일', '왕관 쓴 과일'] }
};
var PZ_FACES = ['🧑', '👩', '👨‍🦱', '👵', '👴', '🧑‍🎤', '👩‍🔬', '🧔', '👱‍♀️', '🧑‍🚀', '🤖', '🐱', '🐻', '👽', '🧛', '🦸'];
var PZ_PER_DAY = 6;

function pzLoad() { try { return JSON.parse(localStorage.getItem('gamehub_pizza_v1') || 'null'); } catch (e) { return null; } }
function pzSaveProg() { try { localStorage.setItem('gamehub_pizza_v1', JSON.stringify({ day: PZ.day, money: PZ.money, best: PZ.best })); } catch (e) {} }

function stopPizzaGame() { cancelAnimationFrame(PZ_RAF); PZ_RAF = null; }
function startPizzaGame() {
  stopPizzaGame();
  var s = pzLoad() || { day: 1, money: 20, best: 0 };
  PZ = { day: s.day, money: s.money, best: s.best || 0, cust: 0, dayEarn: 0, dayLog: [], tool: 'sauce', cv: document.getElementById('pz-canvas') };
  PZ.ctx = PZ.cv.getContext('2d');
  pzRenderTools();
  pzNextCustomer();
  cancelAnimationFrame(PZ_RAF);
  PZ_RAF = requestAnimationFrame(pzFrame);
}
function pzUnlocked() { return Object.keys(PZ_TOPS).filter(function (k) { return PZ_TOPS[k].day <= PZ.day; }); }
function pzRand(a) { return a[Math.floor(Math.random() * a.length)]; }

/* ---- 주문 만들기: 진짜 주문(want)과 손님 말투(say), 다시 물어보면 쉬운 말(clear) ---- */
function pzMakeOrder() {
  var tops = pzUnlocked(), r = Math.random(), want = { sauce: true, cheese: true, whole: [], halfA: [], halfB: [], bake: 1, cuts: 3 };
  var say = [], clear = [];
  var tn = function (k) { return PZ_TOPS[k].n; }, th = function (k) { return pzRand(PZ_TOPS[k].hint); };
  if (r < 0.08) {
    /* 빵만 */
    want.sauce = false; want.cheese = false;
    say.push(pzRand(['아무것도 없이 빵만 주세요.', '도우요. 그냥 도우.', '피자… 말고 피자 빵만요. 아무것도 올리지 마세요!']));
    clear.push('소스도 치즈도 없이 도우만 구워 주세요.');
  } else if (r < 0.22) {
    /* 치즈 피자 (가끔 함정) */
    if (Math.random() < 0.5 && tops.length) { var k0 = pzRand(tops); say.push(tn(k0) + ' 피자 주세요. ' + tn(k0) + '은(는) 빼고요.'); }
    else say.push(pzRand(['치즈 피자 하나요!', '기본 중의 기본으로 주세요.', '토핑은 필요 없어요. 쭉 늘어나는 걸로!']));
    clear.push('소스랑 치즈만 올린 치즈 피자요.');
  } else if (r < 0.62 || tops.length < 2) {
    var k1 = pzRand(tops);
    want.whole.push(k1);
    if (Math.random() < 0.55) { say.push(th(k1) + ' 잔뜩 올려 주세요.'); } else say.push(tn(k1) + ' 피자 주세요!');
    clear.push(tn(k1) + ' 피자요. 피자 전체에 골고루!');
    if (Math.random() < 0.15) { want.cheese = false; say.push('아, 치즈는 빼 주세요.'); clear.push('치즈는 빼고요.'); }
    else if (Math.random() < 0.1) { want.sauce = false; say.push('소스는 없이요.'); clear.push('소스는 빼고요.'); }
  } else if (r < 0.82) {
    var two = pzShuffle(tops).slice(0, 2);
    want.halfA = [two[0]]; want.halfB = [two[1]];
    say.push(pzRand(['반은 ' + th(two[0]) + ', 반은 ' + th(two[1]) + '요.', '반반으로요! ' + tn(two[0]) + ' 반, ' + tn(two[1]) + ' 반.', '한쪽엔 ' + tn(two[0]) + ', 다른 쪽엔 ' + tn(two[1]) + '!']));
    clear.push('반반 피자요. 한쪽은 ' + tn(two[0]) + ', 다른 쪽은 ' + tn(two[1]) + '.');
  } else {
    var two2 = pzShuffle(tops).slice(0, Math.min(2, tops.length));
    want.whole = two2;
    say.push(pzRand([two2.map(tn).join('랑 ') + ' 둘 다 잔뜩이요.', two2.map(th).join(', 그리고 ') + ' 다 올려 주세요.']));
    clear.push(two2.map(tn).join(', ') + '을(를) 피자 전체에 다 올려 주세요.');
  }
  /* 굽기 */
  if (Math.random() < 0.18) { want.bake = 2; var b = pzRand(['바삭하게', '바싹', '웰던으로', '오븐에 두 번']); say.push(b + ' 부탁해요.'); clear.push('오븐에 두 번 구워 주세요.'); }
  /* 자르기 */
  var cr = Math.random();
  if (cr < 0.12) { want.cuts = 0; say.push(pzRand(['자르지 마세요. 통째로 먹을 거예요.', '조각은 필요 없어요.'])); clear.push('안 잘라도 돼요.'); }
  else if (cr < 0.22) { want.cuts = 1; say.push(pzRand(['반으로만 잘라 주세요.', '두 조각이요.'])); clear.push('한 번만 잘라서 두 조각!'); }
  else if (cr < 0.32) { want.cuts = 2; say.push(pzRand(['큰 조각으로요. 네 조각!', '두 번만 잘라 주세요.'])); clear.push('두 번 잘라서 네 조각!'); }
  else if (cr < 0.42) { want.cuts = 4; say.push(pzRand(['작게작게 여덟 조각!', '네 번 잘라 주세요.'])); clear.push('네 번 잘라서 여덟 조각!'); }
  else clear.push('자르는 건 보통(세 번, 여섯 조각)으로요.');
  return { want: want, say: say.join(' '), clear: clear.join(' ') };
}
function pzShuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

function pzNextCustomer() {
  if (PZ.cust >= PZ_PER_DAY) { pzEndDay(); return; }
  PZ.cust++;
  PZ.order = pzMakeOrder();
  PZ.asked = 0;
  PZ.face = pzRand(PZ_FACES);
  pzNewPizza();
  PZ.phase = 'order';
  pzRenderCounter();
  pzHud();
}
function pzNewPizza() {
  PZ.pz = { sauce: new Uint8Array(PZ_GRID * PZ_GRID), cheese: new Uint8Array(PZ_GRID * PZ_GRID), tops: [], bake: 0, cuts: 0, baking: 0 };
}
function pzAsk() {
  PZ.asked++;
  if (typeof mmSound === 'function') mmSound('bubble');
  pzRenderCounter();
}
function pzOk() { PZ.phase = 'make'; pzRenderCounter(); }

/* ---- 화면 ---- */
function pzHud() {
  document.getElementById('pz-day').textContent = PZ.day + '일째';
  document.getElementById('pz-money').textContent = '$' + PZ.money.toFixed(2);
  document.getElementById('pz-cust').textContent = '손님 ' + PZ.cust + ' / ' + PZ_PER_DAY;
}
function pzRenderCounter() {
  var el = document.getElementById('pz-counter');
  var o = PZ.order;
  var talk = PZ.asked ? o.clear : o.say;
  el.innerHTML = '<div class="pz-face">' + PZ.face + '</div><div class="pz-bubble">' + esc(talk) + (PZ.asked ? ' <small>(' + (PZ.asked > 1 ? '😤 몇 번을 말해요!' : '다시 말해줬어요') + ')</small>' : '') +
    (PZ.phase === 'order' ? '<div class="pz-bubble-btns"><button class="btn btn-primary" onclick="pzOk()">알겠어요!</button><button class="btn btn-ghost" onclick="pzAsk()">네?</button></div>' : '') + '</div>';
}
function pzRenderTools() {
  var tops = pzUnlocked();
  var html = '<button class="pz-tool" data-t="sauce">🍅<span>소스</span></button><button class="pz-tool" data-t="cheese">🧀<span>치즈</span></button>' +
    tops.map(function (k) { return '<button class="pz-tool" data-t="' + k + '">' + PZ_TOPS[k].e + '<span>' + PZ_TOPS[k].n + '</span></button>'; }).join('');
  var box = document.getElementById('pz-tools');
  box.innerHTML = html;
  box.querySelectorAll('.pz-tool').forEach(function (b) { b.onclick = function () { pzSetTool(b.getAttribute('data-t')); }; });
  pzSetTool('sauce');
}
function pzSetTool(t) {
  PZ.tool = t;
  document.querySelectorAll('.pz-tool').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
}
function pzToast(t) {
  var el = document.getElementById('pz-toast');
  el.textContent = t; el.classList.add('show');
  clearTimeout(pzToast.t); pzToast.t = setTimeout(function () { el.classList.remove('show'); }, 1800);
}

/* ---- 만들기 ---- */
function pzCanvasPos(e) {
  var r = PZ.cv.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * PZ.cv.width - PZ.cv.width / 2, (e.clientY - r.top) / r.height * PZ.cv.height - PZ.cv.height / 2];
}
function pzPaint(layer, x, y) {
  var g = PZ_GRID, rad = 2.2;
  var gx = (x / PZ_R + 1) / 2 * g, gy = (y / PZ_R + 1) / 2 * g;
  for (var yy = Math.floor(gy - rad); yy <= gy + rad; yy++) for (var xx = Math.floor(gx - rad); xx <= gx + rad; xx++) {
    if (xx < 0 || yy < 0 || xx >= g || yy >= g) continue;
    var dx = (xx + 0.5) - g / 2, dy = (yy + 0.5) - g / 2;
    if (dx * dx + dy * dy > (g / 2 - 1.2) * (g / 2 - 1.2)) continue;
    if ((xx + 0.5 - gx) * (xx + 0.5 - gx) + (yy + 0.5 - gy) * (yy + 0.5 - gy) <= rad * rad) layer[yy * g + xx] = 1;
  }
}
function pzCoverage(layer) {
  var g = PZ_GRID, inside = 0, on = 0;
  for (var y = 0; y < g; y++) for (var x = 0; x < g; x++) {
    var dx = (x + 0.5) - g / 2, dy = (y + 0.5) - g / 2;
    if (dx * dx + dy * dy > (g / 2 - 1.2) * (g / 2 - 1.2)) continue;
    inside++; if (layer[y * g + x]) on++;
  }
  return on / inside;
}
function pzAddTop(type, x, y) {
  if (x * x + y * y > (PZ_R - 14) * (PZ_R - 14)) return;
  var close = PZ.pz.tops.some(function (t) { return (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y) < 18 * 18; });
  if (close) return;
  PZ.pz.tops.push({ t: type, x: x, y: y, r: Math.random() * 6 });
  if (typeof mmSound === 'function') mmSound('pop');
}
function pzBake() {
  if (PZ.phase !== 'make' || PZ.pz.baking) return;
  if (PZ.pz.bake >= 3) { pzToast('더 구우면 숯이 돼요!'); return; }
  PZ.pz.baking = Date.now();
  if (typeof mmSound === 'function') mmSound('bubble');
}
function pzCut() {
  if (PZ.phase !== 'make' || PZ.pz.baking) return;
  if (!PZ.pz.bake) { pzToast('먼저 오븐에 구워요 🔥'); return; }
  PZ.pz.cuts = (PZ.pz.cuts + 1) % 10;
  if (typeof mmSound === 'function') mmSound('mash');
}
function pzTrash() {
  if (PZ.phase !== 'make') return;
  PZ.money -= 1; pzHud();
  pzNewPizza(); pzToast('🗑 새 도우를 꺼냈어요 (-$1)');
}

/* ---- 채점 ---- */
function pzServe() {
  if (PZ.phase !== 'make' || PZ.pz.baking) return;
  if (!PZ.pz.bake) { pzToast('안 구운 피자는 못 드려요! 🔥'); return; }
  var w = PZ.order.want, p = PZ.pz, score = 100, notes = [];
  var sc = pzCoverage(p.sauce), cc = pzCoverage(p.cheese);
  if (w.sauce && sc < 0.6) { score -= 30; notes.push('소스가 부족해요'); } else if (w.sauce && sc < 0.85) { score -= 8; }
  if (!w.sauce && sc > 0.05) { score -= 35; notes.push('소스는 빼 달랬는데…'); }
  if (w.cheese && cc < 0.6) { score -= 30; notes.push('치즈가 부족해요'); } else if (w.cheese && cc < 0.85) { score -= 8; }
  if (!w.cheese && cc > 0.05) { score -= 35; notes.push('치즈는 빼 달랬는데…'); }
  /* 토핑: 왼쪽/오른쪽 반으로 나눠서 셈 */
  var cnt = {};
  p.tops.forEach(function (t) { var c = cnt[t.t] || (cnt[t.t] = { L: 0, R: 0 }); if (t.x < 0) c.L++; else c.R++; });
  var wanted = {};
  w.whole.forEach(function (k) {
    wanted[k] = 1;
    var c = cnt[k] || { L: 0, R: 0 }, tot = c.L + c.R;
    if (tot < 6) { score -= 40; notes.push(PZ_TOPS[k].n + '이(가) ' + (tot ? '너무 적어요' : '없어요!')); }
    else if (Math.min(c.L, c.R) < 2) { score -= 15; notes.push(PZ_TOPS[k].n + '을(를) 골고루 올려 주세요'); }
    else if (tot < 10) score -= 6;
  });
  if (w.halfA.length) {
    var a = w.halfA[0], b = w.halfB[0], ca = cnt[a] || { L: 0, R: 0 }, cb = cnt[b] || { L: 0, R: 0 };
    wanted[a] = wanted[b] = 1;
    /* 어느 쪽에 올려도 되지만, 서로 반대쪽이어야 해요 */
    var ok1 = ca.L >= 4 && cb.R >= 4 && ca.R <= 1 && cb.L <= 1, ok2 = ca.R >= 4 && cb.L >= 4 && ca.L <= 1 && cb.R <= 1;
    if (!ok1 && !ok2) {
      if (ca.L + ca.R < 4 || cb.L + cb.R < 4) { score -= 40; notes.push('반반 토핑이 부족해요'); }
      else { score -= 25; notes.push('반반이 섞였어요'); }
    }
  }
  Object.keys(cnt).forEach(function (k) { if (!wanted[k] && cnt[k].L + cnt[k].R > 0) { score -= 25; notes.push(PZ_TOPS[k].n + '은(는) 안 시켰어요'); } });
  if (p.bake !== w.bake) { score -= p.bake > w.bake + 0 && p.bake >= 3 ? 40 : 20; notes.push(p.bake > w.bake ? '너무 많이 구웠어요' : '덜 구워졌어요'); }
  if (p.cuts !== w.cuts) { score -= 15; notes.push('조각 수가 달라요 (' + (w.cuts ? w.cuts * 2 : 1) + '조각 원했어요)'); }
  score -= PZ.asked > 1 ? 10 : 0;
  score = Math.max(0, Math.min(100, score));
  /* 돈: 기본 $7 + 토핑 종류마다 $1.5, 만족도에 따라. 재료비는 토핑 개수만큼 조금씩 */
  var price = (w.sauce || w.cheese ? 7 : 5) + (w.whole.length + (w.halfA.length ? 1 : 0)) * 1.5;
  var cost = 0.6 + p.tops.length * 0.04;
  var pay = score >= 40 ? price * (score >= 70 ? 1 : 0.5) : 0;
  var tip = score >= 85 ? Math.round((score - 80) / 4 * (PZ.asked ? 0.4 : 1)) : 0;
  var earn = pay + tip - cost;
  PZ.money += earn; PZ.dayEarn += earn;
  PZ.dayLog.push({ face: PZ.face, score: score, earn: earn });
  PZ.phase = 'result';
  var mood = score >= 85 ? '😍' : score >= 70 ? '🙂' : score >= 40 ? '😕' : '😡';
  var line = score >= 85 ? pzRand(['완벽해요! 단골할게요!', '바로 이거예요!', '최고의 피자예요!']) : score >= 70 ? pzRand(['음, 괜찮네요.', '먹을 만해요!']) : score >= 40 ? pzRand(['이게 뭐예요…? 반만 낼게요.', '다음엔 잘 들어 주세요.']) : pzRand(['돈 못 내요!! 😤', '이건 제가 시킨 피자가 아니에요!']);
  document.getElementById('pz-counter').innerHTML = '<div class="pz-face">' + PZ.face + '</div><div class="pz-bubble">' + mood + ' ' + esc(line) +
    (notes.length ? '<div class="pz-notes">' + notes.slice(0, 3).map(esc).join(' · ') + '</div>' : '') +
    '<div class="pz-earn ' + (earn >= 0 ? 'plus' : 'minus') + '">' + (earn >= 0 ? '+' : '') + '$' + earn.toFixed(2) + (tip ? ' <small>(팁 $' + tip + ')</small>' : '') + '</div>' +
    '<div class="pz-bubble-btns"><button class="btn btn-primary" onclick="pzNextCustomer()">다음 손님 ▶</button></div></div>';
  if (typeof mmSound === 'function') mmSound(score >= 70 ? 'win' : 'fail');
  pzHud();
  pzSaveProg();
}
function pzEndDay() {
  PZ.phase = 'day';
  var newTop = Object.keys(PZ_TOPS).filter(function (k) { return PZ_TOPS[k].day === PZ.day + 1; })[0];
  document.getElementById('pz-counter').innerHTML = '<div class="pz-face">🌙</div><div class="pz-bubble"><b>' + PZ.day + '일째 영업 끝!</b><div class="pz-daylog">' + PZ.dayLog.map(function (d) { return '<span>' + d.face + ' ' + (d.earn >= 0 ? '+' : '') + '$' + d.earn.toFixed(1) + '</span>'; }).join('') + '</div>' +
    '오늘 번 돈 <b>' + (PZ.dayEarn >= 0 ? '+' : '') + '$' + PZ.dayEarn.toFixed(2) + '</b>' + (newTop ? '<br>🎁 내일부터 <b>' + PZ_TOPS[newTop].e + ' ' + PZ_TOPS[newTop].n + '</b> 토핑을 쓸 수 있어요!' : '') +
    '<div class="pz-bubble-btns"><button class="btn btn-primary" onclick="pzNextDay()">다음 날 ☀️</button></div></div>';
  if (PZ.dayEarn > PZ.best) PZ.best = PZ.dayEarn;
  pzSaveProg();
}
function pzNextDay() {
  PZ.day++; PZ.cust = 0; PZ.dayEarn = 0; PZ.dayLog = [];
  pzSaveProg();
  pzRenderTools();
  pzNextCustomer();
}
function pzResetSave() {
  if (!confirm('처음(1일째)부터 다시 시작할까요?')) return;
  try { localStorage.removeItem('gamehub_pizza_v1'); } catch (e) {}
  startPizzaGame();
}

/* ---- 그리기 ---- */
function pzFrame() {
  PZ_RAF = requestAnimationFrame(pzFrame);
  if (!PZ || !document.getElementById('pizza').classList.contains('active')) return;
  var p = PZ.pz;
  if (p.baking && Date.now() - p.baking > 1600) { p.baking = 0; p.bake++; pzToast(p.bake === 1 ? '🔥 노릇노릇 구워졌어요' : p.bake === 2 ? '🔥 바삭하게 두 번 구웠어요' : '😱 탔어요…'); }
  pzDraw();
}
function pzDraw() {
  var cv = PZ.cv, ctx = PZ.ctx, W = cv.width, H = cv.height, p = PZ.pz, R = PZ_R;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#e9d8bd'; ctx.fillRect(0, 0, W, H);
  /* 나무 판 */
  ctx.fillStyle = '#c99a62'; ctx.beginPath(); ctx.arc(W / 2, H / 2, R + 22, 0, Math.PI * 2); ctx.fill();
  ctx.translate(W / 2, H / 2);
  var bk = Math.min(3, p.bake);
  /* 도우 */
  var dough = ['#f3dcae', '#e7b96e', '#d39a4a', '#8d5a2b'][bk];
  ctx.fillStyle = dough; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,20,0.35)'; ctx.lineWidth = 6; ctx.stroke();
  /* 소스 / 치즈 (칸 단위로 칠한 걸 부드럽게) */
  var g = PZ_GRID, cs = 2 * R / g;
  var layer = function (arr, col, blob) {
    ctx.fillStyle = col;
    for (var y = 0; y < g; y++) for (var x = 0; x < g; x++) if (arr[y * g + x]) { ctx.beginPath(); ctx.arc(-R + (x + 0.5) * cs, -R + (y + 0.5) * cs, cs * blob, 0, Math.PI * 2); ctx.fill(); }
  };
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 9, 0, Math.PI * 2); ctx.clip();
  layer(p.sauce, bk >= 2 ? '#a3321f' : '#d84a2b', 0.85);
  layer(p.cheese, bk === 0 ? '#fff3c4' : (bk === 1 ? '#ffd970' : '#e8a845'), 0.72);
  ctx.restore();
  /* 토핑 */
  p.tops.forEach(function (t) { pzDrawTop(ctx, t, bk); });
  if (bk >= 3) { ctx.fillStyle = 'rgba(30,20,10,0.35)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); }
  /* 반반 가이드 (가운데 점선) */
  if (!p.bake) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(0, R); ctx.stroke(); ctx.setLineDash([]); }
  /* 자른 선 */
  ctx.strokeStyle = 'rgba(80,40,10,0.7)'; ctx.lineWidth = 3;
  for (var c = 0; c < p.cuts; c++) { var a = Math.PI / p.cuts * c + Math.PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(-Math.cos(a) * R, -Math.sin(a) * R); ctx.stroke(); }
  /* 오븐 안 */
  if (p.baking) {
    var t = (Date.now() - p.baking) / 1600;
    ctx.fillStyle = 'rgba(255,120,30,' + (0.35 * Math.sin(t * Math.PI)) + ')'; ctx.beginPath(); ctx.arc(0, 0, R + 22, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🔥 굽는 중…', 0, 10);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(60,40,20,0.75)'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('굽기 ' + p.bake + '번 · 자르기 ' + p.cuts + '번(' + (p.cuts ? p.cuts * 2 : 1) + '조각) · 토핑 ' + p.tops.length + '개', 12, H - 12);
}
function pzDrawTop(ctx, t, bk) {
  var x = t.x, y = t.y, dark = bk >= 2 ? 0.8 : 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(t.r);
  if (t.t === 'pep') { ctx.fillStyle = bk ? '#a31f1f' : '#c62828'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,200,200,0.4)'; ctx.beginPath(); ctx.arc(-3, -2, 2, 0, Math.PI * 2); ctx.arc(3, 3, 1.6, 0, Math.PI * 2); ctx.fill(); }
  else if (t.t === 'mush') { ctx.fillStyle = '#efe4dc'; ctx.beginPath(); ctx.arc(0, -2, 9, Math.PI, 0); ctx.fill(); ctx.fillRect(-3, -2, 6, 9); ctx.strokeStyle = '#a1887f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -2, 9, Math.PI, 0); ctx.stroke(); }
  else if (t.t === 'onion') { ctx.strokeStyle = '#ce93d8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
  else if (t.t === 'olive') { ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill(); }
  else if (t.t === 'pepper') { ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 8, 0.3, Math.PI * 1.7); ctx.stroke(); }
  else if (t.t === 'pine') { ctx.fillStyle = '#fbc02d'; ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(8, 6); ctx.lineTo(0, -8); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#f57f17'; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore();
}

(function pzSetupInput() {
  var cv = document.getElementById('pz-canvas');
  if (!cv) return;
  var down = false, last = null;
  var act = function (e) {
    if (!PZ || PZ.phase !== 'make' || PZ.pz.baking) return;
    var q = pzCanvasPos(e), t = PZ.tool;
    if (PZ.pz.bake && (t === 'sauce' || t === 'cheese' || PZ_TOPS[t])) { if (!act.warned) { act.warned = 1; pzToast('구운 다음엔 더 못 올려요. 🗑 버리고 새로 해요'); } return; }
    if (q[0] * q[0] + q[1] * q[1] > (PZ_R + 6) * (PZ_R + 6)) return;
    if (t === 'sauce') pzPaint(PZ.pz.sauce, q[0], q[1]);
    else if (t === 'cheese') pzPaint(PZ.pz.cheese, q[0], q[1]);
    else if (PZ_TOPS[t]) {
      if (last && (q[0] - last[0]) * (q[0] - last[0]) + (q[1] - last[1]) * (q[1] - last[1]) < 26 * 26) return;
      pzAddTop(t, q[0], q[1]); last = q;
    }
  };
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); down = true; last = null; act.warned = 0; try { cv.setPointerCapture(e.pointerId); } catch (er) {} act(e); });
  cv.addEventListener('pointermove', function (e) { if (down) act(e); });
  ['pointerup', 'pointercancel'].forEach(function (ev) { cv.addEventListener(ev, function () { down = false; }); });
})();
