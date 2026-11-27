/* 📅 출석체크 + 🎁 홈 화면 분필 상자
   - 출석: 하루 한 번. 분필 10~40개 랜덤, 가끔 대박(100~300), 아주 가끔 잭팟(1000). 7일 연속이면 보너스 +150
   - 분필 상자: 홈 화면에 가끔 둥실 떠올라요. 누르면 랜덤 분필 (하루 5번까지)
   기록은 이 기기(localStorage 'gamehub_attend')에 저장돼요. */
var ATT_KEY = 'gamehub_attend', ATT_BOX_MAX = 5, ATT_BOX_T = null;
function attLoad() { try { return JSON.parse(localStorage.getItem(ATT_KEY) || 'null') || {}; } catch (e) { return {}; } }
function attSave(d) { try { localStorage.setItem(ATT_KEY, JSON.stringify(d)); } catch (e) {} }
function attDay(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function attYesterday() { var d = new Date(); d.setDate(d.getDate() - 1); return attDay(d); }
function attGive(n, text) {
  if (typeof walletAdd === 'function') walletAdd(n); else return;
  if (typeof walletRender === 'function') walletRender();
  if (typeof coinToast === 'function') coinToast(text);
}
/* 랜덤 보상: 대부분 소소하게, 가끔 많이 */
function attRoll() {
  var r = Math.random();
  if (r < 0.01) return { n: 1000, tag: '🎰 잭팟!!' };
  if (r < 0.10) return { n: 100 + Math.floor(Math.random() * 201), tag: '🎉 대박!' };
  return { n: 10 + Math.floor(Math.random() * 31), tag: '' };
}
function attRender() {
  var el = document.getElementById('att-box'); if (!el) return;
  var d = attLoad(), today = attDay(), done = d.last === today;
  var streak = done ? (d.streak || 1) : (d.last === attYesterday() ? (d.streak || 0) : 0);
  var dots = '';
  for (var i = 1; i <= 7; i++) dots += '<i class="' + (i <= ((streak - 1) % 7) + 1 && streak ? 'on' : '') + (i === 7 ? ' gift' : '') + '">' + (i === 7 ? '🎁' : i) + '</i>';
  el.innerHTML = '<div class="att-l"><b>📅 출석체크</b><span>' + (streak ? '연속 ' + streak + '일째' : '오늘 첫 출석!') + ' · 7일 연속이면 🎁 +150</span><div class="att-dots">' + (streak || done ? dots : dots.replace(/ on/g, '')) + '</div></div>' +
    '<button class="att-btn" ' + (done ? 'disabled' : 'onclick="attCheck()"') + '>' + (done ? '✅ 오늘 출석 완료<small>' + (d.lastGot ? '분필 +' + d.lastGot : '') + '</small>' : '🖍️ 출석하고 분필 받기<small>랜덤 · 가끔 대박!</small>') + '</button>';
}
function attCheck() {
  var d = attLoad(), today = attDay(); if (d.last === today) return;
  d.streak = d.last === attYesterday() ? (d.streak || 0) + 1 : 1;
  d.last = today; d.total = (d.total || 0) + 1;
  var roll = attRoll(), bonus = d.streak % 7 === 0 ? 150 : 0, got = roll.n + bonus;
  d.lastGot = got; attSave(d);
  attGive(got, (roll.tag ? roll.tag + ' ' : '📅 출석 ') + '+' + got + ' 🖍️' + (bonus ? ' (7일 연속 보너스 포함!)' : ''));
  attRender();
  var b = document.querySelector('#att-box .att-btn'); if (b) { b.classList.add('pop'); }
  if (roll.tag) attBurst(roll.n >= 1000 ? 40 : 22);
}
/* 축하 꽃가루 */
function attBurst(n) {
  for (var i = 0; i < n; i++) {
    var s = document.createElement('span'); s.className = 'att-conf'; s.textContent = ['🖍️', '✨', '🎉', '⭐'][i % 4];
    s.style.left = (10 + Math.random() * 80) + 'vw'; s.style.animationDuration = (1.4 + Math.random() * 1.2) + 's'; s.style.animationDelay = (Math.random() * 0.4) + 's';
    document.body.appendChild(s); setTimeout(function (x) { return function () { x.remove(); }; }(s), 3200);
  }
}
/* 🎁 홈 화면 분필 상자: 홈에 있을 때 가끔 떠올라요 */
function attBoxTry() {
  var home = document.getElementById('home');
  if (!home || !home.classList.contains('active') || document.getElementById('att-gift')) return;
  var d = attLoad(), today = attDay(); if (d.boxDay !== today) { d.boxDay = today; d.boxN = 0; attSave(d); }
  if ((d.boxN || 0) >= ATT_BOX_MAX || Math.random() > 0.35) return;
  var g = document.createElement('button'); g.id = 'att-gift'; g.className = 'att-gift'; g.title = '눌러서 분필 받기!'; g.textContent = '🎁';
  g.style.left = (8 + Math.random() * 78) + 'vw'; g.style.top = (22 + Math.random() * 55) + 'vh';
  g.onclick = function () {
    var dd = attLoad(); if (dd.boxDay !== attDay()) { dd.boxDay = attDay(); dd.boxN = 0; }
    if ((dd.boxN || 0) >= ATT_BOX_MAX) { g.remove(); return; }
    dd.boxN = (dd.boxN || 0) + 1; attSave(dd);
    var r = Math.random(), n = r < 0.03 ? 300 : r < 0.18 ? 50 + Math.floor(Math.random() * 51) : 5 + Math.floor(Math.random() * 21);
    attGive(n, (n >= 300 ? '🎰 상자 대박!! ' : n >= 50 ? '🎉 상자 대박! ' : '🎁 분필 상자 ') + '+' + n + ' 🖍️ (오늘 ' + dd.boxN + '/' + ATT_BOX_MAX + ')');
    if (n >= 50) attBurst(n >= 300 ? 30 : 14);
    g.classList.add('open'); setTimeout(function () { g.remove(); }, 500);
  };
  document.body.appendChild(g);
  setTimeout(function () { if (g.parentNode) { g.classList.add('bye'); setTimeout(function () { g.remove(); }, 600); } }, 14000);   /* 14초 뒤 둥실 사라져요 */
}
function attInit() {
  attRender();
  clearInterval(ATT_BOX_T); ATT_BOX_T = setInterval(attBoxTry, 20000);
  /* 홈을 벗어나면 떠 있던 상자는 바로 치워요 */
  setInterval(function () { var g = document.getElementById('att-gift'), h = document.getElementById('home'); if (g && h && !h.classList.contains('active')) g.remove(); }, 800);
  setTimeout(attBoxTry, 4000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attInit); else attInit();
