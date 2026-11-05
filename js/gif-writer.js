/* ===================== 작은 움짤(GIF) 만들기 도구 =====================
   인터넷 없이 브라우저 안에서 바로 GIF 를 만들어요.
   색은 256색 고정 팔레트(웹 216색 + 회색 40단계)로 맞춰요. 그림/글자 위주라 충분히 예뻐요.
   사용법: var gif = GIFW.create(w, h); gif.addFrame(ctx 또는 ImageData, 지연ms); var blob = gif.finish(); */
var GIFW = (function () {
  var PAL = new Uint8Array(768);
  (function () {
    var i = 0;
    for (var r = 0; r < 6; r++) for (var g = 0; g < 6; g++) for (var b = 0; b < 6; b++) { PAL[i * 3] = r * 51; PAL[i * 3 + 1] = g * 51; PAL[i * 3 + 2] = b * 51; i++; }
    for (var k = 0; k < 40; k++) { var v = Math.round(k * 255 / 39); PAL[i * 3] = PAL[i * 3 + 1] = PAL[i * 3 + 2] = v; i++; }
  })();
  function indexOf_unused(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 14) return 216 + Math.round((r + g + b) / 3 * 39 / 255); /* 회색 계열 */
    return Math.round(r / 51) * 36 + Math.round(g / 51) * 6 + Math.round(b / 51);
  }
  function lzw(idx, out) {
    var MIN = 8, CLEAR = 256, EOI = 257;
    var size = 9, next = 258, dict = new Map();
    var cur = 0, curBits = 0, buf = [];
    function emit(code) {
      cur |= code << curBits; curBits += size;
      while (curBits >= 8) { buf.push(cur & 0xFF); cur >>>= 8; curBits -= 8; }
    }
    emit(CLEAR);
    var prefix = idx[0];
    for (var i = 1; i < idx.length; i++) {
      var k = idx[i], key = prefix * 256 + k;
      var hit = dict.get(key);
      if (hit !== undefined) { prefix = hit; continue; }
      emit(prefix);
      if (next === 4096) { emit(CLEAR); dict = new Map(); size = 9; next = 258; }
      else { if (next >= (1 << size)) size++; dict.set(key, next++); }
      prefix = k;
    }
    emit(prefix);
    emit(EOI);
    if (curBits > 0) buf.push(cur & 0xFF);
    out.push(MIN);
    for (var p = 0; p < buf.length; p += 255) {
      var n = Math.min(255, buf.length - p);
      out.push(n);
      for (var q = 0; q < n; q++) out.push(buf[p + q]);
    }
    out.push(0);
  }
  /* 그림에 실제로 많이 쓰인 색 256개를 골라 팔레트를 만들어요 (그림판 그림은 색이 적어서 거의 원본 그대로) */
  function buildPalette(frames) {
    var hist = new Map();
    frames.forEach(function (f) {
      var d = f.data;
      for (var q = 0; q < d.length; q += 4) {
        var key = ((d[q] >> 3) << 10) | ((d[q + 1] >> 3) << 5) | (d[q + 2] >> 3);
        hist.set(key, (hist.get(key) || 0) + 1);
      }
    });
    var keys = Array.from(hist.keys()).sort(function (a, b) { return hist.get(b) - hist.get(a); });
    var pal = new Uint8Array(768), n = 0;
    if (keys.length <= 256) {
      keys.forEach(function (k) { pal[n * 3] = ((k >> 10) & 31) * 8 + 4; pal[n * 3 + 1] = ((k >> 5) & 31) * 8 + 4; pal[n * 3 + 2] = (k & 31) * 8 + 4; n++; });
      return { pal: pal, n: n };
    }
    /* 색이 많으면: 많이 쓰인 색 200개 + 고정 팔레트에서 골고루 56개 */
    keys.slice(0, 200).forEach(function (k) { pal[n * 3] = ((k >> 10) & 31) * 8 + 4; pal[n * 3 + 1] = ((k >> 5) & 31) * 8 + 4; pal[n * 3 + 2] = (k & 31) * 8 + 4; n++; });
    for (var i = 0; n < 256; i += 4) { var j = i % 256; pal[n * 3] = PAL[j * 3]; pal[n * 3 + 1] = PAL[j * 3 + 1]; pal[n * 3 + 2] = PAL[j * 3 + 2]; n++; }
    return { pal: pal, n: n };
  }
  function create(w, h) {
    var frames = [];
    return {
      addFrame: function (src, delayMs) {
        var img = src.getImageData ? src.getImageData(0, 0, w, h) : src;
        frames.push({ data: img.data, delay: delayMs || 1000 });
      },
      finish: function () {
        var P = buildPalette(frames), pal = P.pal;
        var cache = new Map();
        var nearest = function (r, g, b) {
          var key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
          var c = cache.get(key);
          if (c !== undefined) return c;
          var best = 0, bd = 1e9;
          for (var i = 0; i < P.n; i++) {
            var dr = pal[i * 3] - r, dg = pal[i * 3 + 1] - g, db = pal[i * 3 + 2] - b;
            var dd = dr * dr * 2 + dg * dg * 4 + db * db * 3;
            if (dd < bd) { bd = dd; best = i; }
          }
          cache.set(key, best);
          return best;
        };
        var out = [];
        var s = 'GIF89a';
        for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
        out.push(w & 255, w >> 8, h & 255, h >> 8, 0xF7, 0, 0);
        for (var j = 0; j < 768; j++) out.push(pal[j]);
        var ns = 'NETSCAPE2.0';
        out.push(0x21, 0xFF, 11); for (var n = 0; n < ns.length; n++) out.push(ns.charCodeAt(n)); out.push(3, 1, 0, 0, 0);
        frames.forEach(function (f) {
          var data = f.data, idx = new Uint8Array(w * h);
          for (var p = 0, q = 0; p < idx.length; p++, q += 4) idx[p] = nearest(data[q], data[q + 1], data[q + 2]);
          var d = Math.round(f.delay / 10);
          out.push(0x21, 0xF9, 4, 0, d & 255, d >> 8, 0, 0);
          out.push(0x2C, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0);
          lzw(idx, out);
        });
        out.push(0x3B);
        return new Blob([new Uint8Array(out)], { type: 'image/gif' });
      }
    };
  }
  return { create: create };
})();
