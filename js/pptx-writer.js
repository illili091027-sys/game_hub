/* ===================== 작은 PPT(.pptx) 만들기 도구 =====================
   인터넷에서 따로 프로그램을 불러오지 않고, 브라우저 안에서 바로 파워포인트 파일을 만들어요.
   .pptx 는 사실 XML 파일 여러 개를 zip으로 묶은 거라서, 아주 작은 zip 묶기 + 최소한의 PPT 구조만 직접 써요.
   사용법:
     var deck = PPTW.create({ title: '발표', bg: 'FFF8E7' });
     var s = deck.slide({ bg: 'FFF8E7', notes: '메모' });
     s.text('제목', { x, y, w, h, size, bold, color, align, bullets })   // 단위: 인치 (16:9 = 13.333 x 7.5)
     s.rect({ x, y, w, h, color })
     s.image(dataUrl, { x, y, w, h, iw, ih })   // iw/ih: 원본 크기 → 비율 맞춰 가운데에 넣어요
     deck.save('파일이름.pptx') */
var PPTW = (function () {
  var EMU = 914400;
  function emu(v) { return Math.round(v * EMU); }
  function x(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var enc = new TextEncoder();

  /* ---- zip (압축 없이 묶기만) ---- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
      c.setUint32(38, 0, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  }
  function dataUrlBytes(u) { var b = atob(u.split(',')[1] || ''); var a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }

  var NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  var XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  var REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var FONT = '맑은 고딕';

  function theme() {
    var clr = function (n, v) { return '<a:' + n + '><a:srgbClr val="' + v + '"/></a:' + n + '>'; };
    var font = '<a:latin typeface="' + FONT + '"/><a:ea typeface="' + FONT + '"/><a:cs typeface=""/>';
    var fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    var ln = '<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>';
    return XML + '<a:theme ' + NS + ' name="Office"><a:themeElements><a:clrScheme name="Office">' +
      '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
      clr('dk2', '1F497D') + clr('lt2', 'EEECE1') + clr('accent1', '4F81BD') + clr('accent2', 'C0504D') + clr('accent3', '9BBB59') +
      clr('accent4', '8064A2') + clr('accent5', '4BACC6') + clr('accent6', 'F79646') + clr('hlink', '0000FF') + clr('folHlink', '800080') +
      '</a:clrScheme><a:fontScheme name="Office"><a:majorFont>' + font + '</a:majorFont><a:minorFont>' + font + '</a:minorFont></a:fontScheme>' +
      '<a:fmtScheme name="Office"><a:fillStyleLst>' + fill + fill + fill + '</a:fillStyleLst><a:lnStyleLst>' + ln + ln + ln + '</a:lnStyleLst>' +
      '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
      '<a:bgFillStyleLst>' + fill + fill + fill + '</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';
  }
  var EMPTY_TREE = '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>';

  function create(opts) {
    opts = opts || {};
    var W = 13.333, H = 7.5;
    var slides = [];
    var media = [];
    function slide(sopts) {
      sopts = sopts || {};
      var shapes = [], rels = [], id = 2;
      var api = {
        text: function (t, o) {
          o = o || {};
          var lines = o.bullets ? t : [t];
          var paras = lines.map(function (line) {
            var pPr = '<a:pPr algn="' + ({ center: 'ctr', right: 'r' }[o.align] || 'l') + '"' + (o.bullets ? ' marL="342900" indent="-342900"' : '') + '>' +
              (o.bullets ? '<a:spcAft><a:spcPts val="900"/></a:spcAft><a:buClr><a:srgbClr val="' + (o.bulletColor || o.color || '333333') + '"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="•"/>' : '<a:buNone/>') + '</a:pPr>';
            return '<a:p>' + pPr + '<a:r><a:rPr lang="ko-KR" altLang="en-US" sz="' + Math.round((o.size || 20) * 100) + '" b="' + (o.bold ? 1 : 0) + '" dirty="0"><a:solidFill><a:srgbClr val="' + (o.color || '333333') + '"/></a:solidFill><a:latin typeface="' + FONT + '"/><a:ea typeface="' + FONT + '"/></a:rPr><a:t>' + x(line) + '</a:t></a:r></a:p>';
          }).join('');
          shapes.push('<p:sp><p:nvSpPr><p:cNvPr id="' + (id++) + '" name="Text ' + id + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
            '<p:spPr><a:xfrm><a:off x="' + emu(o.x) + '" y="' + emu(o.y) + '"/><a:ext cx="' + emu(o.w) + '" cy="' + emu(o.h) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
            '<p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="' + (o.valign === 'middle' ? 'ctr' : 't') + '"><a:normAutofit/></a:bodyPr><a:lstStyle/>' + paras + '</p:txBody></p:sp>');
        },
        rect: function (o) {
          shapes.push('<p:sp><p:nvSpPr><p:cNvPr id="' + (id++) + '" name="Shape ' + id + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
            '<p:spPr><a:xfrm><a:off x="' + emu(o.x) + '" y="' + emu(o.y) + '"/><a:ext cx="' + emu(o.w) + '" cy="' + emu(o.h) + '"/></a:xfrm><a:prstGeom prst="' + (o.round ? 'roundRect' : 'rect') + '"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="' + o.color + '"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>');
        },
        image: function (dataUrl, o) {
          var ext = /^data:image\/png/.test(dataUrl) ? 'png' : (/^data:image\/gif/.test(dataUrl) ? 'gif' : 'jpeg');
          var name = 'image' + (media.length + 1) + '.' + ext;
          media.push({ name: 'ppt/media/' + name, data: dataUrlBytes(dataUrl), ext: ext });
          var rid = 'rId' + (rels.length + 2);
          rels.push('<Relationship Id="' + rid + '" Type="' + REL + '/image" Target="../media/' + name + '"/>');
          var bx = o.x, by = o.y, bw = o.w, bh = o.h;
          if (o.iw && o.ih) { var sc = Math.min(o.w / o.iw, o.h / o.ih); bw = o.iw * sc; bh = o.ih * sc; bx = o.x + (o.w - bw) / 2; by = o.y + (o.h - bh) / 2; }
          shapes.push('<p:pic><p:nvPicPr><p:cNvPr id="' + (id++) + '" name="Picture ' + id + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
            '<p:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
            '<p:spPr><a:xfrm><a:off x="' + emu(bx) + '" y="' + emu(by) + '"/><a:ext cx="' + emu(bw) + '" cy="' + emu(bh) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>');
        }
      };
      slides.push({ shapes: shapes, rels: rels, bg: sopts.bg || opts.bg || 'FFFFFF', notes: sopts.notes || '' });
      return api;
    }
    function save(fileName) {
      var files = [];
      var n = slides.length;
      var ct = XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Default Extension="gif" ContentType="image/gif"/>' +
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
        '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
        '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>' +
        '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
        '<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>';
      for (var i = 1; i <= n; i++) {
        ct += '<Override PartName="/ppt/slides/slide' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>';
        if (slides[i - 1].notes) ct += '<Override PartName="/ppt/notesSlides/notesSlide' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>';
      }
      files.push({ name: '[Content_Types].xml', data: ct + '</Types>' });
      files.push({ name: '_rels/.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="' + REL + '/officeDocument" Target="ppt/presentation.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3" Type="' + REL + '/extended-properties" Target="docProps/app.xml"/></Relationships>' });
      files.push({ name: 'docProps/core.xml', data: XML + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + x(opts.title || '') + '</dc:title><dc:creator>쉬는 시간 게임판</dc:creator></cp:coreProperties>' });
      files.push({ name: 'docProps/app.xml', data: XML + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>쉬는 시간 게임판</Application><Slides>' + n + '</Slides></Properties>' });
      var sldIds = '', prels = '<Relationship Id="rId1" Type="' + REL + '/slideMaster" Target="slideMasters/slideMaster1.xml"/>';
      for (var j = 1; j <= n; j++) {
        sldIds += '<p:sldId id="' + (255 + j) + '" r:id="rId' + (j + 3) + '"/>';
        prels += '<Relationship Id="rId' + (j + 3) + '" Type="' + REL + '/slide" Target="slides/slide' + j + '.xml"/>';
      }
      prels += '<Relationship Id="rId2" Type="' + REL + '/theme" Target="theme/theme1.xml"/><Relationship Id="rId3" Type="' + REL + '/notesMaster" Target="notesMasters/notesMaster1.xml"/>';
      files.push({ name: 'ppt/presentation.xml', data: XML + '<p:presentation ' + NS + ' saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
        '<p:notesMasterIdLst><p:notesMasterId r:id="rId3"/></p:notesMasterIdLst><p:sldIdLst>' + sldIds + '</p:sldIdLst>' +
        '<p:sldSz cx="' + emu(W) + '" cy="' + emu(H) + '"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>' });
      files.push({ name: 'ppt/_rels/presentation.xml.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + prels + '</Relationships>' });
      files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: XML + '<p:sldMaster ' + NS + '>' + EMPTY_TREE +
        '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
        '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>' });
      files.push({ name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="' + REL + '/theme" Target="../theme/theme1.xml"/></Relationships>' });
      files.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: XML + '<p:sldLayout ' + NS + ' type="blank" preserve="1">' + EMPTY_TREE.replace('<p:cSld>', '<p:cSld name="Blank">') + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>' });
      files.push({ name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>' });
      files.push({ name: 'ppt/notesMasters/notesMaster1.xml', data: XML + '<p:notesMaster ' + NS + '>' + EMPTY_TREE + '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:notesMaster>' });
      files.push({ name: 'ppt/notesMasters/_rels/notesMaster1.xml.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/theme" Target="../theme/theme2.xml"/></Relationships>' });
      files.push({ name: 'ppt/theme/theme1.xml', data: theme() });
      files.push({ name: 'ppt/theme/theme2.xml', data: theme() });
      slides.forEach(function (s, k) {
        var i = k + 1;
        var bg = '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="' + s.bg + '"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>';
        files.push({ name: 'ppt/slides/slide' + i + '.xml', data: XML + '<p:sld ' + NS + '><p:cSld>' + bg + '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' + s.shapes.join('') + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>' });
        var rels = '<Relationship Id="rId1" Type="' + REL + '/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' + s.rels.join('');
        if (s.notes) rels += '<Relationship Id="rId99" Type="' + REL + '/notesSlide" Target="../notesSlides/notesSlide' + i + '.xml"/>';
        files.push({ name: 'ppt/slides/_rels/slide' + i + '.xml.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>' });
        if (s.notes) {
          files.push({ name: 'ppt/notesSlides/notesSlide' + i + '.xml', data: XML + '<p:notes ' + NS + '><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
            '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
            '<p:txBody><a:bodyPr/><a:lstStyle/>' + String(s.notes).split('\n').map(function (l) { return '<a:p><a:r><a:rPr lang="ko-KR"/><a:t>' + x(l) + '</a:t></a:r></a:p>'; }).join('') + '</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>' });
          files.push({ name: 'ppt/notesSlides/_rels/notesSlide' + i + '.xml.rels', data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/notesMaster" Target="../notesMasters/notesMaster1.xml"/><Relationship Id="rId2" Type="' + REL + '/slide" Target="../slides/slide' + i + '.xml"/></Relationships>' });
        }
      });
      media.forEach(function (m) { files.push({ name: m.name, data: m.data }); });
      var blob = zip(files);
      if (fileName) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      }
      return blob;
    }
    return { slide: slide, save: save, W: W, H: H };
  }
  return { create: create };
})();
