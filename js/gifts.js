/* 🎁 후원 선물 (틱톡 선물처럼)
   후원할 때 선물을 고르면 그 값만큼 분필이 가고, 방 모두의 화면에 고양이 영상이 크게 떠요.
   영상이 길고 화려할수록 비싸요. 제일 싼 건 분필 10개.
   - GIFTS: 선물 목록 (id, 이름, 값, 보여주는 시간 ms, 화려함 단계 lv)
   - giftPlay(id, host): host(보통 화면 전체) 위에 선물 연출을 띄워요
   - 이미지: img/gifts/*.webp (움직이는 webp) */

var GIFT_IMG = {
  heart: 'img/gifts/heart.webp', punch: 'img/gifts/punch.webp', wiggle: 'img/gifts/wiggle.webp', sniff: 'img/gifts/sniff.webp',
  clap: 'img/gifts/clap.webp', dance: 'img/gifts/dance.webp', ballet: 'img/gifts/ballet.webp'
};
var GIFTS = [
  { id: 'heart',    name: '볼하트 냥',     price: 10,   dur: 3200,  lv: 1, thumb: 'heart' },
  { id: 'punch',    name: '냥냥 펀치',     price: 30,   dur: 4600,  lv: 2, thumb: 'punch' },
  { id: 'wiggle',   name: '흔들흔들 냥',   price: 50,   dur: 4800,  lv: 2, thumb: 'wiggle' },
  { id: 'sniff',    name: '킁킁 냥',       price: 80,   dur: 6400,  lv: 3, thumb: 'sniff' },
  { id: 'clap',     name: '짝짝 냥',       price: 100,  dur: 6400,  lv: 3, thumb: 'clap' },
  { id: 'dance',    name: '춤신춤왕 냥',   price: 200,  dur: 7400,  lv: 4, thumb: 'dance' },
  { id: 'ballet',   name: '발레 공주들',   price: 300,  dur: 7000,  lv: 4, thumb: 'ballet' },
  { id: 'trio',     name: '냥 트리오',     price: 500,  dur: 9000,  lv: 5, thumb: 'wiggle', combo: true },
  { id: 'concert',  name: '고양이 콘서트', price: 1000, dur: 12000, lv: 6, thumb: 'clap', combo: true },
  { id: 'festival', name: '고양이 대축제', price: 3000, dur: 15000, lv: 7, thumb: 'dance', combo: true }
];
function giftById(id) { for (var i = 0; i < GIFTS.length; i++) if (GIFTS[i].id === id) return GIFTS[i]; return null; }
/* 따로 띄운 채팅 창(about:blank)에서도 이미지가 보이게 절대 주소로 */
function giftSrc(k) { try { return new URL(GIFT_IMG[k], location.href).href; } catch (e) { return GIFT_IMG[k]; } }

/* 선물 고르는 칸 (후원 창 · 채팅 후원 바 공용). onPick(gift) */
function giftGridHtml(cls, selId) {
  return GIFTS.map(function (g) {
    return '<button type="button" class="gift-tile ' + (cls || '') + (g.id === selId ? ' on' : '') + '" data-gift="' + g.id + '" title="' + g.name + ' · ' + (g.dur / 1000).toFixed(0) + '초">' +
      '<span class="gift-thumb">' + (g.combo ? '<i class="gift-x">' + (g.id === 'trio' ? '×3' : g.id === 'concert' ? '×5' : '×7') + '</i>' : '') + '<img src="' + giftSrc(g.thumb) + '" alt=""></span>' +
      '<span class="gift-name">' + g.name + '</span><span class="gift-price">' + CHALK_IMG + g.price + '</span></button>';
  }).join('');
}

/* ---------- 연출 ---------- */
var GIFT_CSS = '\
.gift-layer{position:fixed;inset:0;z-index:9690;pointer-events:none;overflow:hidden;display:flex;align-items:center;justify-content:center;animation:gfIn .35s ease-out both}\
.gift-layer.out{animation:gfOut .6s ease-in both}\
@keyframes gfIn{from{opacity:0}to{opacity:1}}@keyframes gfOut{to{opacity:0}}\
.gift-bg{position:absolute;inset:0}\
.gift-bg.dim{background:radial-gradient(circle at 50% 55%,rgba(40,10,60,.25),rgba(10,0,25,.72))}\
.gift-bg.rainbow{background:linear-gradient(120deg,rgba(255,94,98,.45),rgba(255,195,0,.4),rgba(76,217,100,.4),rgba(52,170,220,.45),rgba(175,82,222,.45));background-size:400% 400%;animation:gfRain 3s linear infinite}\
@keyframes gfRain{0%{background-position:0 50%}100%{background-position:400% 50%}}\
.gift-glow{position:absolute;width:min(520px,90vw);height:min(520px,90vw);border-radius:50%;background:radial-gradient(circle,rgba(255,236,150,.85),rgba(255,180,80,.35) 45%,transparent 70%);animation:gfPulse 1.2s ease-in-out infinite}\
@keyframes gfPulse{50%{transform:scale(1.12)}}\
.gift-rays{position:absolute;width:min(900px,160vw);height:min(900px,160vw);border-radius:50%;background:repeating-conic-gradient(rgba(255,230,120,.42) 0 10deg,transparent 10deg 24deg);animation:gfSpin 6s linear infinite;-webkit-mask:radial-gradient(circle,#000 20%,transparent 68%);mask:radial-gradient(circle,#000 20%,transparent 68%)}\
@keyframes gfSpin{to{transform:rotate(360deg)}}\
.gift-spot{position:absolute;top:-10%;width:34vw;height:130%;background:linear-gradient(to bottom,rgba(255,255,220,.65),rgba(255,255,200,0));clip-path:polygon(45% 0,55% 0,100% 100%,0 100%);transform-origin:50% 0;mix-blend-mode:screen}\
.gift-spot.l{left:8%;animation:gfSweepL 3.2s ease-in-out infinite}.gift-spot.r{right:8%;animation:gfSweepR 3.2s ease-in-out infinite}\
@keyframes gfSweepL{0%,100%{transform:rotate(-25deg)}50%{transform:rotate(20deg)}}@keyframes gfSweepR{0%,100%{transform:rotate(25deg)}50%{transform:rotate(-20deg)}}\
.gift-cat{position:relative;display:block;filter:drop-shadow(0 10px 18px rgba(0,0,0,.35));animation:gfPop .7s cubic-bezier(.2,1.6,.4,1) both}\
.gift-cat.bob{animation:gfPop .7s cubic-bezier(.2,1.6,.4,1) both,gfBob 1.1s ease-in-out .7s infinite}\
@keyframes gfPop{from{transform:scale(.1) rotate(-12deg);opacity:0}to{transform:scale(1);opacity:1}}\
@keyframes gfBob{50%{transform:translateY(-14px)}}\
.gift-cat.peek{position:absolute;bottom:-6px;animation:gfPeek 1s cubic-bezier(.2,1.3,.4,1) both}\
@keyframes gfPeek{from{transform:translateY(105%)}to{transform:translateY(0)}}\
.gift-frame{border-radius:28px;border:6px solid #ffd54f;box-shadow:0 0 0 6px #fff8e1,0 0 50px 12px rgba(255,213,79,.85)}\
.gift-row{position:relative;display:flex;align-items:flex-end;justify-content:center;gap:min(18px,2vw)}\
.gift-row .gift-cat:nth-child(2n){animation-delay:.15s,.85s}.gift-row .gift-cat:nth-child(3n){animation-delay:.3s,1s}\
.gift-parade{position:absolute;bottom:4%;left:0;display:flex;gap:40px;animation:gfParade 7s linear infinite;white-space:nowrap}\
.gift-parade img{height:min(150px,22vh)}\
@keyframes gfParade{from{transform:translateX(100vw)}to{transform:translateX(-110%)}}\
.gift-banner{position:absolute;top:9%;left:50%;transform:translateX(-50%);font-weight:900;font-size:min(46px,8vw);color:#fff;white-space:nowrap;text-shadow:0 3px 0 #d81b60,0 6px 18px rgba(0,0,0,.4);animation:gfBanner 1s cubic-bezier(.2,1.6,.4,1) both,gfWobble 1.4s ease-in-out 1s infinite}\
@keyframes gfBanner{from{transform:translateX(-50%) scale(0)}to{transform:translateX(-50%) scale(1)}}\
@keyframes gfWobble{50%{transform:translateX(-50%) scale(1.07) rotate(-2deg)}}\
.gift-banner.low{top:auto;bottom:5%;animation:gfBannerB 1s cubic-bezier(.2,1.6,.4,1) both,gfWobble 1.4s ease-in-out 1s infinite}\
.gift-banner.low2{bottom:calc(min(150px,22vh) + 7%)}\
@keyframes gfBannerB{from{transform:translateX(-50%) scale(0)}to{transform:translateX(-50%) scale(1)}}\
.gift-p{position:absolute;font-size:28px;line-height:1;will-change:transform}\
.gift-p.up{bottom:-40px;animation:gfUp linear forwards}\
.gift-p.down{top:-40px;animation:gfDown linear forwards}\
.gift-p.burst{animation:gfBurst ease-out forwards}\
@keyframes gfUp{to{transform:translate(var(--dx),-115vh) rotate(var(--rot));opacity:.2}}\
@keyframes gfDown{to{transform:translate(var(--dx),115vh) rotate(var(--rot))}}\
@keyframes gfBurst{0%{transform:translate(0,0) scale(.3);opacity:1}80%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1);opacity:0}}\
.gift-conf{position:absolute;top:-20px;width:10px;height:16px;border-radius:2px;animation:gfDown linear forwards}\
.gift-tag{position:absolute;bottom:6%;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.92);color:#3b2300;border-radius:99px;padding:6px 18px;font-weight:800;font-size:min(18px,4.4vw);white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.25)}\
';
function giftEnsureCss(doc) {
  if (doc.getElementById('gift-css')) return;
  var st = doc.createElement('style'); st.id = 'gift-css'; st.textContent = GIFT_CSS;
  (doc.head || doc.body).appendChild(st);
}
function giftR(a, b) { return a + Math.random() * (b - a); }
/* 떠오르는 하트 / 떨어지는 반짝이 / 터지는 불꽃 / 꽃가루 */
function giftParticles(layer, doc, kind, n, emojis, span) {
  for (var i = 0; i < n; i++) (function (i) {
    setTimeout(function () {
      if (!layer.parentNode) return;
      var p = doc.createElement('span');
      if (kind === 'conf') {
        p.className = 'gift-conf';
        p.style.background = ['#ff5e62', '#ffc300', '#4cd964', '#34aadc', '#af52de', '#ff9ff3'][i % 6];
      } else { p.className = 'gift-p ' + kind; p.textContent = emojis[i % emojis.length]; p.style.fontSize = giftR(20, 42) + 'px'; }
      var dur = kind === 'burst' ? giftR(900, 1400) : giftR(2600, 4600);
      p.style.left = giftR(2, 96) + '%';
      p.style.setProperty('--dx', giftR(-120, 120) + 'px');
      p.style.setProperty('--rot', giftR(-540, 540) + 'deg');
      p.style.animationDuration = dur + 'ms';
      layer.appendChild(p);
      setTimeout(function () { p.remove(); }, dur + 50);
    }, giftR(0, span));
  })(i);
}
/* 불꽃놀이: 한 점에서 사방으로 */
function giftFirework(layer, doc) {
  var cx = giftR(15, 85), cy = giftR(15, 55), cols = ['✨', '💥', '⭐', '💖', '🎇'];
  for (var i = 0; i < 16; i++) {
    var p = doc.createElement('span'), a = i / 16 * Math.PI * 2, d = giftR(90, 170);
    p.className = 'gift-p burst'; p.textContent = cols[i % cols.length];
    p.style.left = cx + '%'; p.style.top = cy + '%'; p.style.fontSize = '22px';
    p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d + 'px');
    p.style.animationDuration = '1200ms';
    layer.appendChild(p);
    (function (p) { setTimeout(function () { p.remove(); }, 1300); })(p);
  }
}
function giftCat(doc, key, size, cls) {
  var im = doc.createElement('img');
  im.src = giftSrc(key); im.className = 'gift-cat ' + (cls || '');
  im.style.width = size; im.alt = '';
  return im;
}

/* 방송 후원 알림처럼: 알림 위에 뜨는 움짤 (비쌀수록 크게) */
function giftAlertImg(g) {
  if (g.combo) return '';                                    /* 콤보는 화면 가운데에 고양이들이 따로 나와요 */
  var px = Math.round(Math.min(340, 150 + Math.log10(g.price / 10 + 1) * 90));
  if (g.id === 'dance') px = Math.round(px * 1.5);           /* 그림 속 고양이가 작아서 크게 */
  return '<img class="da-gift' + (g.id === 'ballet' ? ' framed' : '') + '" src="' + giftSrc(g.thumb) + '" style="width:min(' + px + 'px,62vw)" alt="">';
}
function giftPlay(id, host, label, fxOnly) {
  var g = giftById(id); if (!g) return 0;
  host = host || document.body;
  var doc = host.ownerDocument || document;
  giftEnsureCss(doc);
  var L = doc.createElement('div'); L.className = 'gift-layer';
  var add = function (el) { L.appendChild(el); return el; };
  var div = function (cls) { var d = doc.createElement('div'); d.className = cls; return d; };
  var row, i;
  switch (g.id) {
    case 'heart':
      if (!fxOnly) add(giftCat(doc, 'heart', 'min(240px,55vw)'));
      giftParticles(L, doc, 'up', 10, ['💗', '💕', '🩷'], 1500);
      break;
    case 'punch':
      if (!fxOnly) add(giftCat(doc, 'punch', 'min(280px,62vw)', 'bob'));
      giftParticles(L, doc, 'up', 14, ['💥', '👊', '💗'], 3000);
      break;
    case 'wiggle':
      if (!fxOnly) add(giftCat(doc, 'wiggle', 'min(280px,62vw)', 'bob'));
      giftParticles(L, doc, 'up', 16, ['🎵', '🎶', '✨'], 3200);
      break;
    case 'sniff':
      add(div('gift-glow'));
      if (!fxOnly) add(giftCat(doc, 'sniff', 'min(440px,92vw)', 'peek'));
      giftParticles(L, doc, 'up', 24, ['💗', '👃', '✨', '💕'], 5000);
      break;
    case 'clap':
      add(div('gift-glow'));
      if (!fxOnly) add(giftCat(doc, 'clap', 'min(330px,72vw)', 'bob'));
      giftParticles(L, doc, 'down', 30, ['✨', '⭐', '👏'], 5000);
      break;
    case 'dance':
      add(div('gift-rays')); add(div('gift-glow'));
      if (!fxOnly) add(giftCat(doc, 'dance', 'min(380px,84vw)', 'bob'));
      giftParticles(L, doc, 'up', 30, ['💖', '🎵', '💃'], 6000);
      giftParticles(L, doc, 'down', 30, ['✨', '⭐'], 6000);
      break;
    case 'ballet':
      add(div('gift-rays'));
      if (!fxOnly) add(giftCat(doc, 'ballet', 'min(400px,86vw)', 'gift-frame bob'));
      giftParticles(L, doc, 'down', 44, ['✨', '💎', '👑', '🩰', '🌸'], 5800);
      giftParticles(L, doc, 'conf', 30, null, 4000);
      break;
    case 'trio':
      add(div('gift-glow'));
      row = add(div('gift-row'));
      ['punch', 'wiggle', 'clap'].forEach(function (k) { row.appendChild(giftCat(doc, k, 'min(230px,30vw)', 'bob')); });
      giftParticles(L, doc, 'conf', 60, null, 7500);
      giftParticles(L, doc, 'up', 36, ['💖', '💗', '🎉', '✨'], 7500);
      break;
    case 'concert':
      add(div('gift-bg dim')); add(div('gift-spot l')); add(div('gift-spot r'));
      add(div('gift-banner low')).textContent = '🎤 고양이 콘서트 🎤';
      row = add(div('gift-row'));
      ['punch', 'wiggle', 'dance', 'clap', 'heart'].forEach(function (k, j) { row.appendChild(giftCat(doc, k, j === 2 ? 'min(260px,24vw)' : 'min(180px,17vw)', 'bob')); });
      giftParticles(L, doc, 'conf', 110, null, 10500);
      giftParticles(L, doc, 'up', 40, ['🎵', '🎶', '💖', '⭐'], 10500);
      for (i = 0; i < 6; i++) setTimeout(function () { if (L.parentNode) giftFirework(L, doc); }, 1500 + i * 1600);
      break;
    case 'festival':
      add(div('gift-bg rainbow')); add(div('gift-rays'));
      add(div('gift-banner low low2')).textContent = '🎉 고양이 대축제 🎉';
      var par = add(div('gift-parade'));
      ['punch', 'wiggle', 'clap', 'heart', 'dance', 'sniff', 'ballet'].forEach(function (k) { var im = doc.createElement('img'); im.src = giftSrc(k); par.appendChild(im); });
      row = add(div('gift-row')); row.style.marginBottom = '8vh';
      row.appendChild(giftCat(doc, 'dance', 'min(250px,34vw)', 'bob'));
      row.appendChild(giftCat(doc, 'ballet', 'min(270px,36vw)', 'gift-frame bob'));
      giftParticles(L, doc, 'conf', 180, null, 13500);
      giftParticles(L, doc, 'up', 60, ['💖', '🎊', '🎉', '🌈', '⭐', '🐱'], 13500);
      giftParticles(L, doc, 'down', 40, ['✨', '💎', '👑'], 13500);
      for (i = 0; i < 14; i++) setTimeout(function () { if (L.parentNode) giftFirework(L, doc); }, 600 + i * 900);
      break;
  }
  if (label) add(div('gift-tag')).textContent = label;
  host.appendChild(L);
  setTimeout(function () { L.classList.add('out'); }, g.dur - 600);
  setTimeout(function () { L.remove(); }, g.dur);
  return g.dur;
}
