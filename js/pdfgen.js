// PDF生成エンジン。ベースPDF(assets/base_template.pdf)の上に、Noto Sans JP(OFLライセンス、app/assets/fonts)を
// 埋め込んでテキストを直接描画し、署名画像・挿入写真を重ね描きする。
const PdfGen = (() => {
  const { PAGE_H, MACHINE_COLS, ROWS, rowBottom, HEADER_COORDS, IMAGE_FRAME } = window.PDF_COORDS;
  let baseBytesCache = null;
  let fontBytesCache = null;

  const MIN_FONT_BYTES = 4 * 1024 * 1024; // 正常なフォントは約5.7MB。転送破損の簡易検知用しきい値
  const MIN_BASE_PDF_BYTES = 100 * 1024;
  let gridLinesCache = null;

  async function loadGridLines() {
    if (gridLinesCache) return gridLinesCache;
    const res = await fetch(`data/grid_lines.json?v=${Date.now()}`, { cache: 'no-store' });
    gridLinesCache = await res.json();
    return gridLinesCache;
  }

  // テキスト欄の白塗りが罫線にかぶって線が消えてしまうのを防ぐため、
  // 全ての描画が終わった後にベーステンプレートの罫線を正確な位置に再描画して復元する。
  function redrawGridLines(page, lines) {
    lines.forEach((l) => {
      if (l.type === 'h') {
        const y = PAGE_H - l.y;
        page.drawLine({ start: { x: l.x0, y }, end: { x: l.x1, y }, thickness: 0.6, color: PDFLib.rgb(0, 0, 0) });
      } else {
        const y0 = PAGE_H - l.y0;
        const y1 = PAGE_H - l.y1;
        page.drawLine({ start: { x: l.x, y: y0 }, end: { x: l.x, y: y1 }, thickness: 0.6, color: PDFLib.rgb(0, 0, 0) });
      }
    });
  }

  async function fetchWithCacheBust(url) {
    const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${url} の取得に失敗しました (HTTP ${res.status})`);
    return res.arrayBuffer();
  }

  async function loadBaseBytes() {
    if (baseBytesCache) return baseBytesCache;
    let buf = await fetchWithCacheBust('assets/base_template.pdf');
    if (buf.byteLength < MIN_BASE_PDF_BYTES) {
      buf = await fetchWithCacheBust('assets/base_template.pdf'); // 破損の疑いがあるため1回だけ再取得
      if (buf.byteLength < MIN_BASE_PDF_BYTES) throw new Error(`テンプレートPDFの取得サイズが異常です(${buf.byteLength}bytes)。通信環境を確認して再度お試しください。`);
    }
    baseBytesCache = buf;
    return baseBytesCache;
  }
  async function loadFontBytes() {
    if (fontBytesCache) return fontBytesCache;
    let buf = await fetchWithCacheBust('assets/fonts/NotoSansJP-Regular.ttf');
    if (buf.byteLength < MIN_FONT_BYTES) {
      buf = await fetchWithCacheBust('assets/fonts/NotoSansJP-Regular.ttf'); // 破損の疑いがあるため1回だけ再取得
      if (buf.byteLength < MIN_FONT_BYTES) throw new Error(`フォントファイルの取得サイズが異常です(${buf.byteLength}bytes)。通信環境を確認して再度お試しください。`);
    }
    fontBytesCache = buf;
    return fontBytesCache;
  }

  function wrapTextByFont(font, text, maxWidthPt, fontSizePt) {
    const lines = [];
    String(text ?? '').split('\n').forEach((para) => {
      let current = '';
      for (const ch of para) {
        const test = current + ch;
        let w;
        try { w = font.widthOfTextAtSize(test, fontSizePt); } catch (e) { w = 0; }
        if (w > maxWidthPt && current) { lines.push(current); current = ch; }
        else current = test;
      }
      lines.push(current);
    });
    return lines;
  }

  function drawTextBox(page, font, text, { x, top, width, height, fontSizePt = 6.5, whiteOut = true }) {
    const y = PAGE_H - top - height;
    if (whiteOut) page.drawRectangle({ x, y, width, height, color: PDFLib.rgb(1, 1, 1) });
    if (text == null || text === '') return;
    try {
      const lines = wrapTextByFont(font, text, width, fontSizePt);
      const lineHeight = fontSizePt * 1.3;
      const maxLines = Math.max(1, Math.floor(height / lineHeight) || 1);
      let cy = PAGE_H - top - fontSizePt;
      lines.slice(0, maxLines).forEach((line) => {
        page.drawText(line, { x: x + 1, y: cy, size: fontSizePt, font, color: PDFLib.rgb(0, 0, 0) });
        cy -= lineHeight;
      });
    } catch (e) {
      console.warn('drawTextBox failed for text:', text, e);
    }
  }

  function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // ブラウザの<img>でデコードしてcanvasに描画し直し、綺麗なPNGバイト列を得る(pdf-libの簡易JPEGパーサーの
  // 癖(実機カメラJPEGでRangeErrorになる等)を回避するための最終手段のフォールバック)
  function reencodeToPngBytes(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const pngDataUrl = canvas.toDataURL('image/png');
        resolve(dataUrlToBytes(pngDataUrl));
      };
      img.onerror = () => reject(new Error('画像の再エンコードに失敗しました'));
      img.src = dataUrl;
    });
  }

  async function embedImageRobust(pdfDoc, dataUrl) {
    const bytes = dataUrlToBytes(dataUrl);
    try { return await pdfDoc.embedPng(bytes); } catch (e1) {
      try { return await pdfDoc.embedJpg(bytes); } catch (e2) {
        // pdf-libの内蔵パーサーが両方失敗した場合、canvas再エンコードで最後の手当てを行う
        const pngBytes = await reencodeToPngBytes(dataUrl);
        return pdfDoc.embedPng(pngBytes);
      }
    }
  }

  async function drawImageDataUrl(pdfDoc, page, dataUrl, { x, top, width, height, fit = 'cover' }) {
    const img = await embedImageRobust(pdfDoc, dataUrl);
    const y = PAGE_H - top - height;
    page.drawRectangle({ x, y, width, height, color: PDFLib.rgb(1, 1, 1) });
    // cover: 枠を埋めてはみ出た部分をクリップ(写真向け) / contain: 枠内に全体を収める(署名向け、はみ出し・欠けなし)
    const scale = fit === 'contain'
      ? Math.min(width / img.width, height / img.height)
      : Math.max(width / img.width, height / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = x - (dw - width) / 2;
    const dy = y - (dh - height) / 2;
    page.pushOperators(
      PDFLib.pushGraphicsState(),
      PDFLib.moveTo(x, y),
      PDFLib.lineTo(x + width, y),
      PDFLib.lineTo(x + width, y + height),
      PDFLib.lineTo(x, y + height),
      PDFLib.closePath(),
      PDFLib.clip(),
      PDFLib.endPath(),
    );
    page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });
    page.pushOperators(PDFLib.popGraphicsState());
  }

  function formatWorkTime(start, end) {
    if (!start || !end) return '';
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    let s = toMin(start);
    let e = toMin(end);
    let rollover = false;
    if (e <= s) { e += 24 * 60; rollover = true; }
    const gapStart = rollover ? 24 * 60 : 12 * 60;
    const gapEnd = rollover ? 25 * 60 : 13 * 60;
    // 日またぎの場合は現場慣習に合わせ24:00以降も繰り上げずに表記する(例: 23:00〜26:00)
    const fmt = (min) => {
      const h = rollover ? Math.floor(min / 60) : Math.floor(min / 60) % 24;
      const mm = min % 60;
      return `${String(h).padStart(2, '0')}：${String(mm).padStart(2, '0')}`;
    };
    if (s < gapStart && e > gapEnd) {
      return `${fmt(s)}～${fmt(gapStart)}\n${fmt(gapEnd)}～${fmt(e)}`;
    }
    return `${fmt(s)}～${fmt(e)}`;
  }

  function machineFieldTexts(m) {
    const aizusha = m.aizusha.has === true ? `有（氏名：${m.aizusha.names.filter(Boolean).join('・')}）` : (m.aizusha.has === false ? '無' : '');
    const yudosha = m.yudosha.has === true ? `有（氏名：${m.yudosha.names.filter(Boolean).join('・')}）` : (m.yudosha.has === false ? '無' : '');
    const chikei = m.chikei.type + (m.chikei.type === '傾斜地' ? `（${m.chikei.angle}度）` : '');
    const hogoText = (state) => (state.hogo && state.hogo.length ? state.hogo.join('・') + (state.hogo.includes('その他') && state.hogoOther ? `（${state.hogoOther}）` : '') : '');
    const maisetsu = m.maisetsu.has === true ? '有' : (m.maisetsu.has === false ? '無' : '');
    const kakuDenryoku = m.kakuDenryoku.has === true ? `有（距離${m.kakuDenryoku.distance || ''}m、離隔${m.kakuDenryoku.ridaku || ''}m）` : (m.kakuDenryoku.has === false ? '無' : '');
    const kakuDensha = m.kakuDensha.has === true ? `有（距離${m.kakuDensha.distance || ''}m、離隔${m.kakuDensha.ridaku || ''}m）` : (m.kakuDensha.has === false ? '無' : '');
    const tento = m.tento.has === true ? '有' : (m.tento.has === false ? '無' : '');
    return {
      taisho: [m.category, m.name].filter(Boolean).join(' / '),
      yotei: formatWorkTime(m.workStart, m.workEnd),
      meisho: m.name,
      noryoku: m.capacity,
      shoyusha: m.owner,
      untensha: m.driver,
      basho: m.location,
      naiyo: m.content,
      hoho: m.method,
      taisaku: m.safety,
      shunin: m.chiefSupervisor,
      shikisha: m.director,
      aizusha, yudosha,
      aizuhoho: m.aizuHoho.join('・'),
      kikenhani: m.kikenHani.join('・'),
      chikei,
      jiban: m.jiban.join('・'),
      jibanyojo: m.jibanYojo,
      maisetsu, maisetsuHogo: hogoText(m.maisetsu),
      kaku_denryoku: kakuDenryoku, kaku_denryoku_hogo: hogoText(m.kakuDenryoku),
      kaku_densha: kakuDensha, kaku_densha_hogo: hogoText(m.kakuDensha),
      tento, tentoBoshi: m.tento.has ? m.tento.boshi : '',
    };
  }

  async function loadPdfDocAndFont() {
    const [pdfBytes, fontBytes] = await Promise.all([loadBaseBytes(), loadFontBytes()]);
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);
    // 注意: subset:true にすると一部のグリフで異常な文字送り(グリフ崩れ)が発生するため、フルフォント埋め込みにしている。
    // (この副作用でPDFサイズが大きくなる: 生成PDFは概ね4MB前後)
    const font = await pdfDoc.embedFont(fontBytes, { subset: false });
    return { pdfDoc, font };
  }

  async function generate(plan) {
    let pdfDoc, font;
    try {
      ({ pdfDoc, font } = await loadPdfDocAndFont());
    } catch (e) {
      // フォント/テンプレートの破損(転送中断等)が疑われるため、キャッシュを破棄して1回だけ再取得を試みる
      console.warn('初回のフォント/テンプレート読込に失敗。再取得します。', e);
      baseBytesCache = null; fontBytesCache = null;
      ({ pdfDoc, font } = await loadPdfDocAndFont());
    }
    const page = pdfDoc.getPages()[0];

    // ヘッダー
    const h = plan.header;
    const H = HEADER_COORDS;
    const boxFrom = (c) => ({ x: c.x0, top: c.top, width: c.x1 - c.x0, height: c.bottom - c.top });
    drawTextBox(page, font, h.gyoshamei, { ...boxFrom(H.gyoshamei1), fontSizePt: 8 });
    drawTextBox(page, font, h.uchiawaseDate, { ...boxFrom(H.uchiawase_date), fontSizePt: 8 });
    drawTextBox(page, font, h.uchiawaseTime, { ...boxFrom(H.uchiawase_time), fontSizePt: 8 });
    drawTextBox(page, font, h.sagyobi, { ...boxFrom(H.sagyobi), fontSizePt: 8 });
    drawTextBox(page, font, h.chuyabetsu, { ...boxFrom(H.chuyabetsu), fontSizePt: 8 });
    const tantoshaText = h.tantosha.filter(Boolean).join(' ');
    drawTextBox(page, font, tantoshaText, { x: H.tantosha6.x0, top: H.tantosha6.top, width: 330 - H.tantosha6.x0, height: 13, fontSizePt: 7 });
    drawTextBox(page, font, h.gyoshamei2, { ...boxFrom(H.gyoshamei10), fontSizePt: 8 });
    drawTextBox(page, font, h.gyoshamei, { ...boxFrom(H.gyoshamei1_col1), fontSizePt: 8 });
    const warnings = [];
    async function drawImageSafe(dataUrl, box, label, fit) {
      try { await drawImageDataUrl(pdfDoc, page, dataUrl, { ...box, fit }); }
      catch (e) {
        console.warn(`${label}の埋め込みに失敗しました`, e);
        warnings.push(`${label}を埋め込めなかったため、この項目は空欄のまま保存されました。`);
      }
    }
    if (h.sign9) await drawImageSafe(h.sign9, boxFrom(H.sign9), '署名(1次業者名)', 'contain');
    else drawTextBox(page, font, '', boxFrom(H.sign9));
    if (h.sign11) await drawImageSafe(h.sign11, boxFrom(H.sign11), '署名(2次業者名)', 'contain');
    else drawTextBox(page, font, '', boxFrom(H.sign11));

    // 機械ブロック(最大3列)
    for (let i = 0; i < plan.machines.length && i < 3; i++) {
      const col = MACHINE_COLS[i];
      const width = col.x1 - col.x0;
      const texts = machineFieldTexts(plan.machines[i]);
      for (const rowKey of Object.keys(ROWS)) {
        if (rowKey === 'tableEnd' || rowKey === 'shiyosha') continue;
        const row = ROWS[rowKey];
        const bottom = rowBottom(rowKey);
        const val = texts[rowKey];
        if (val === undefined) continue;
        drawTextBox(page, font, val, { x: col.x0 + 2, top: row.top - 2, width: width - 4, height: bottom - row.top, fontSizePt: 6.5 });
      }
      // 使用者(1次業者名) = 業者名を再掲
      const sr = ROWS.shiyosha;
      drawTextBox(page, font, plan.header.gyoshamei, { x: col.x0 + 2, top: sr.top - 2, width: width - 4, height: rowBottom('shiyosha') - sr.top, fontSizePt: 6.5 });
    }
    // 未使用の機械列(「入力39」「入力40」等の残プレースホルダーを消去)
    for (let i = plan.machines.length; i < 3; i++) {
      const col = MACHINE_COLS[i];
      const row = ROWS.taisho;
      drawTextBox(page, font, '', { x: col.x0 + 2, top: row.top - 2, width: (col.x1 - col.x0) - 4, height: rowBottom('taisho') - row.top });
    }

    // 画像挿入
    if (plan.image && plan.image.dataUrl) {
      await drawImageSafe(plan.image.dataUrl, {
        x: IMAGE_FRAME.x0 + 1, top: IMAGE_FRAME.top + 1,
        width: (IMAGE_FRAME.x1 - IMAGE_FRAME.x0) - 2, height: (IMAGE_FRAME.bottom - IMAGE_FRAME.top) - 2,
      }, '挿入画像');
    }

    // 文字の白塗りで消えてしまった罫線を最後に復元する
    try {
      const gridLines = await loadGridLines();
      redrawGridLines(page, gridLines);
    } catch (e) { console.warn('罫線の復元に失敗しました', e); }

    const bytes = await pdfDoc.save();
    return { bytes, warnings };
  }

  return { generate, formatWorkTime };
})();
