/* ---------------- 공용 캐릭터 고르기 (먼작귀 키우기 / 똥벼락 대탈출) ----------------
   data/baby-chars.js의 BB_CHARS(사용자가 넣은 캐릭터 이미지 9개)에서 하나를 고릅니다.
   마지막으로 고른 캐릭터는 이 브라우저에 기억해 두었다가 다음에 자동으로 골라둡니다. */
var CHAR_PICK_KEY = 'gamehub_char';
var CHAR_IMG_CACHE = {};

function charList() { return (typeof BB_CHARS !== 'undefined') ? BB_CHARS : []; }
function charById(id) {
  var list = charList();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return list[0] || null;
}
function charLoadChoice() {
  var id = null;
  try { id = localStorage.getItem(CHAR_PICK_KEY); } catch (e) {}
  return charById(id);
}
function charSaveChoice(id) { try { localStorage.setItem(CHAR_PICK_KEY, id); } catch (e) {} }

/* 캔버스에 그리기 위한 Image 객체(미리 불러둠) */
function charImage(id) {
  var c = charById(id);
  if (!c) return null;
  if (!CHAR_IMG_CACHE[c.id]) {
    var img = new Image();
    img.src = c.src;
    CHAR_IMG_CACHE[c.id] = img;
  }
  return CHAR_IMG_CACHE[c.id];
}

/* containerId 안에 캐릭터 9개 버튼을 그립니다. onSelect(id)는 고를 때마다 호출. */
function charRenderPicker(containerId, selectedId, onSelect) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = charList().map(function (c) {
    return '<button type="button" class="char-opt' + (c.id === selectedId ? ' on' : '') + '" data-id="' + c.id + '">' +
      '<span class="char-opt-img"><img src="' + c.src + '" alt="' + c.name + '" /></span>' +
      '<span class="char-opt-name">' + c.name + '</span></button>';
  }).join('');
  el.onclick = function (e) {
    var btn = e.target.closest && e.target.closest('.char-opt');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    el.querySelectorAll('.char-opt').forEach(function (b) { b.classList.toggle('on', b === btn); });
    charSaveChoice(id);
    onSelect(id);
  };
}

charList().forEach(function (c) { charImage(c.id); });
