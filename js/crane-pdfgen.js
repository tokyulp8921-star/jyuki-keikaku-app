// クレーン計画書PDF生成エンジン。重機作業計画書と同じ白塗り+再描画方式でオーバーレイする。
// 生成後、点検基準表(参考資料、入力不要)のページを末尾に結合して出力する。
const CranePdfGen = (() => {
  const { PAGE_H, HEADER, WORK, SAFETY_LABELS, CHECKBOXES, CONFIRM, LIFT, COL_OFFSETS, IMAGE_FRAME } = CranePdfCoords;

  let baseBytesCache = null;
  let fontBytesCache = null;
  let appendixBytesCache = null;
  let gridLinesCache = null;

  const MIN_FONT_BYTES = 4 * 1024 * 1024;
  const MIN_BASE_PDF_BYTES = 50 * 1024;

  async function fetchWithCacheBust(url) {
    const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${url} の取得に失敗しました (HTTP ${res.status})`);
    return res.arrayBuffer();
  }

  async function loadBaseBytes() {
    if (baseBytesCache) return baseBytesCache;
    let buf = await fetchWithCacheBust('assets/crane_base_template.pdf');
    if (buf.byteLength < MIN_BASE_PDF_BYTES) {
      buf = await fetchWithCacheBust('assets/crane_base_template.pdf');
      if (buf.byteLength < MIN_BASE_PDF_BYTES) throw new Error(`テンプレートPDFの取得サイズが異常です(${buf.byteLength}bytes)。通信環境を確認して再度お試しください。`);
    }
    baseBytesCache = buf;
    return baseBytesCache;
  }
  async function loadAppendixBytes() {
    if (appendixBytesCache) return appendixBytesCache;
    appendixBytesCache = await fetchWithCacheBust('assets/crane_reference_appendix.pdf');
    return appendixBytesCache;
  }
  async function loadFontBytes() {
    if (fontBytesCache) return fontBytesCache;
    let buf = await fetchWithCacheBust('assets/fonts/NotoSansJP-Regular.ttf');
    if (buf.byteLength < MIN_FONT_BYTES) {
      buf = await fetchWithCacheBust('assets/fonts/NotoSansJP-Regular.ttf');
      if (buf.byteLength < MIN_FONT_BYTES) throw new Error(`フォントファイルの取得サイズが異常です(${buf.byteLength}bytes)。通信環境を確認して再度お試しください。`);
    }
    fontBytesCache = buf;
    return fontBytesCache;
  }
  async function loadGridLines() {
    if (gridLinesCache) return gridLinesCache;
    const res = await fetch(`data/crane_grid_lines.json?v=${Date.now()}`, { cache: 'no-store' });
    gridLinesCache = await res.json();
    return gridLinesCache;
  }

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

  function drawTextBox(page, font, text, { x, top, width, height, fontSizePt = 7, whiteOut = true, fillColor = null }) {
    const y = PAGE_H - top - height;
    if (whiteOut) page.drawRectangle({ x, y, width, height, color: fillColor || PDFLib.rgb(1, 1, 1) });
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

  function markCheckbox(page, xTop, yTop) {
    const y = PAGE_H - yTop;
    const half = 4.3;
    const color = PDFLib.rgb(0, 0, 0);
    page.drawLine({ start: { x: xTop - half, y: y - half }, end: { x: xTop + half, y: y + half }, thickness: 1.1, color });
    page.drawLine({ start: { x: xTop - half, y: y + half }, end: { x: xTop + half, y: y - half }, thickness: 1.1, color });
  }

  function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function reencodeToPngBytes(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(dataUrlToBytes(canvas.toDataURL('image/png')));
      };
      img.onerror = () => reject(new Error('画像の再エンコードに失敗しました'));
      img.src = dataUrl;
    });
  }

  async function embedImageRobust(pdfDoc, dataUrl) {
    const bytes = dataUrlToBytes(dataUrl);
    try { return await pdfDoc.embedPng(bytes); } catch (e1) {
      try { return await pdfDoc.embedJpg(bytes); } catch (e2) {
        const pngBytes = await reencodeToPngBytes(dataUrl);
        return pdfDoc.embedPng(pngBytes);
      }
    }
  }

  async function drawImageDataUrl(pdfDoc, page, dataUrl, { x, top, width, height, fit = 'cover' }) {
    const img = await embedImageRobust(pdfDoc, dataUrl);
    const y = PAGE_H - top - height;
    page.drawRectangle({ x, y, width, height, color: PDFLib.rgb(1, 1, 1) });
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

  function boxFrom(c) { return { x: c.x, top: c.top, width: c.width, height: c.height }; }

  function shogaiText(lift) {
    if (lift.shogaiHas === true) return `有${lift.shogaiShurui ? '（' + lift.shogaiShurui + '）' : ''}`;
    if (lift.shogaiHas === false) return '無';
    return '';
  }

  async function loadPdfDocAndFont() {
    const [pdfBytes, fontBytes] = await Promise.all([loadBaseBytes(), loadFontBytes()]);
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fontBytes, { subset: false });
    return { pdfDoc, font };
  }

  async function generate(plan) {
    let pdfDoc, font;
    try {
      ({ pdfDoc, font } = await loadPdfDocAndFont());
    } catch (e) {
      console.warn('初回のフォント/テンプレート読込に失敗。再取得します。', e);
      baseBytesCache = null; fontBytesCache = null;
      ({ pdfDoc, font } = await loadPdfDocAndFont());
    }
    const page = pdfDoc.getPages()[0];
    const warnings = [];

    // ヘッダー(101-106)
    const h = plan.header;
    drawTextBox(page, font, h.uchiawaseDate, { ...boxFrom(HEADER.uchiawaseDate), fontSizePt: 8 });
    drawTextBox(page, font, h.sagyobi, { ...boxFrom(HEADER.sagyobi), fontSizePt: 8 });
    drawTextBox(page, font, h.gyoshamei, { ...boxFrom(HEADER.gyoshamei), fontSizePt: 8 });
    drawTextBox(page, font, h.gyoshamei, { ...boxFrom(HEADER.gyoshamei_dup), fontSizePt: 8 });
    // 機種・性能(104): 登録数(1〜3)に応じて枠内を均等分割し、それぞれの機種・トン数を描く
    {
      const box = HEADER.kishuSeino;
      const n = h.craneCount || 1;
      const segWidth = box.width / n;
      const craneTypes = h.craneTypes || [];
      for (let i = 0; i < n; i++) {
        drawTextBox(page, font, craneTypes[i] || '', {
          x: box.x + segWidth * i, top: box.top, width: segWidth - (i < n - 1 ? 3 : 0), height: box.height, fontSizePt: 7.5,
        });
      }
      if (n > 1) {
        const y0 = PAGE_H - box.top;
        const y1 = PAGE_H - box.top - box.height;
        for (let i = 1; i < n; i++) {
          const lineX = box.x + segWidth * i;
          page.drawLine({ start: { x: lineX, y: y0 }, end: { x: lineX, y: y1 }, thickness: 0.6, color: PDFLib.rgb(0, 0, 0) });
        }
      }
    }
    drawTextBox(page, font, h.craneGyosha, { ...boxFrom(HEADER.craneGyosha), fontSizePt: 7.5 });
    // 運転者名(最大3名)が空欄の場合は枠を黄色で塗りつぶして未記入を目立たせる
    const YELLOW = PDFLib.rgb(1, 1, 0);
    const untenshaText = (Array.isArray(h.untenshaMei) ? h.untenshaMei : [h.untenshaMei]).filter(Boolean).join('・');
    drawTextBox(page, font, untenshaText, { ...boxFrom(HEADER.untenshaMei), fontSizePt: 7.5, fillColor: untenshaText ? null : YELLOW });

    // 作業計画(107-118、列①のみ)
    const w = plan.work;
    const yoteiJikanText = PdfGen.formatWorkTime(w.yoteiJikanStart, w.yoteiJikanEnd);
    drawTextBox(page, font, yoteiJikanText, { ...boxFrom(WORK.yoteiJikan), fontSizePt: 7 });
    drawTextBox(page, font, w.shiyoGyosha, { ...boxFrom(WORK.shiyoGyosha), fontSizePt: 7 });
    drawTextBox(page, font, w.basho, { ...boxFrom(WORK.basho), fontSizePt: 7 });
    drawTextBox(page, font, w.naiyo, { ...boxFrom(WORK.naiyo), fontSizePt: 7 });
    drawTextBox(page, font, w.choKaJuryo, { ...boxFrom(WORK.choKaJuryo), fontSizePt: 7 });
    drawTextBox(page, font, w.sagyoHankei, { ...boxFrom(WORK.sagyoHankei), fontSizePt: 7 });
    drawTextBox(page, font, w.slingKei, { ...boxFrom(WORK.slingKei), fontSizePt: 7 });
    drawTextBox(page, font, w.slingNagasa, { ...boxFrom(WORK.slingNagasa), fontSizePt: 7 });
    drawTextBox(page, font, w.slingHon, { ...boxFrom(WORK.slingHon), fontSizePt: 7 });
    // 作業責任者・玉掛者・合図者が空欄の場合は枠を黄色で塗りつぶして未記入を目立たせる
    const tamakakeshaText = (Array.isArray(w.tamakakesha) ? w.tamakakesha : [w.tamakakesha]).filter(Boolean).join('・');
    const aizushaText = (Array.isArray(w.aizusha) ? w.aizusha : [w.aizusha]).filter(Boolean).join('・');
    drawTextBox(page, font, w.sekininsha, { ...boxFrom(WORK.sekininsha), fontSizePt: 7, fillColor: w.sekininsha ? null : YELLOW });
    drawTextBox(page, font, tamakakeshaText, { ...boxFrom(WORK.tamakakesha), fontSizePt: 7, fillColor: tamakakeshaText ? null : YELLOW });
    drawTextBox(page, font, aizushaText, { ...boxFrom(WORK.aizusha), fontSizePt: 7, fillColor: aizushaText ? null : YELLOW });

    // 安全チェック(119-126): ラベル位置は白塗りのみ、値はチェックボックスへのマークで表現
    const s = plan.safety;
    const DETAIL_KEYS = ['outriggerFukaDetail', 'kakusenOtherDetail'];
    Object.keys(SAFETY_LABELS).forEach((key) => {
      if (DETAIL_KEYS.includes(key)) return;
      drawTextBox(page, font, '', boxFrom(SAFETY_LABELS[key]));
    });
    // アウトリガー最大張出「不可：対策」選択時の詳細内容
    const outriggerDetailText = (s.outriggerJotai === '不可:対策' && s.outriggerFukaDetail) ? `（${s.outriggerFukaDetail}）` : '';
    drawTextBox(page, font, outriggerDetailText, { ...boxFrom(SAFETY_LABELS.outriggerFukaDetail), fontSizePt: 7 });
    // 架空線近接「その他」選択時の詳細内容
    const kakusenOtherText = (s.kakusenKinsetsu.hogo || []).includes('その他') && s.kakusenKinsetsu.hogoOther ? `（${s.kakusenKinsetsu.hogoOther}）` : '';
    drawTextBox(page, font, kakusenOtherText, { ...boxFrom(SAFETY_LABELS.kakusenOtherDetail), fontSizePt: 7 });
    function markChecked(key, selected) {
      const opts = CHECKBOXES[key];
      const sel = Array.isArray(selected) ? selected : (selected ? [selected] : []);
      opts.forEach((o) => { if (sel.includes(o.label)) markCheckbox(page, o.x, o.y); });
    }
    markChecked('aizuHoho', s.aizuHoho);
    markChecked('chikei', s.chikei);
    markChecked('jibanKyodo', s.jibanKyodo);
    markChecked('jibanYojo', s.jibanYojo);
    markChecked('outriggerJotai', s.outriggerJotai);
    markChecked('creneShui', s.creneShui);
    markChecked('tsuriniKabu', s.tsuriniKabu);
    {
      const sel = [];
      if (s.kakusenKinsetsu.has === true) { sel.push('有:対策'); sel.push(...(s.kakusenKinsetsu.hogo || [])); }
      else if (s.kakusenKinsetsu.has === false) { sel.push('無'); }
      markChecked('kakusenKinsetsu', sel);
    }

    // 元請担当者確認欄(127・128、最大3名)
    const tantosha127Text = (Array.isArray(plan.tantosha127) ? plan.tantosha127 : [plan.tantosha127]).filter(Boolean).join('・');
    drawTextBox(page, font, tantosha127Text, { ...boxFrom(CONFIRM.tantosha127), fontSizePt: 7 });
    drawTextBox(page, font, tantosha127Text, { ...boxFrom(CONFIRM.tantosha127_dup), fontSizePt: 7 });
    drawTextBox(page, font, plan.kyoryokuKakuninsha128, { ...boxFrom(CONFIRM.kyoryokuKakuninsha128), fontSizePt: 7 });

    // 吊り荷計画(129-144、作業予定①②③、最大3回)
    for (let i = 0; i < plan.lifts.length && i < 3; i++) {
      const lift = plan.lifts[i];
      const off = COL_OFFSETS[i];
      const shift = (c) => ({ x: c.x + off, top: c.top, width: c.width, height: c.height });
      drawTextBox(page, font, lift.tsuriniMeisho, { ...shift(LIFT.tsuriniMeisho), fontSizePt: 7 });
      drawTextBox(page, font, lift.hitsuyoHankei, { ...shift(LIFT.hitsuyoHankei), fontSizePt: 7 });
      drawTextBox(page, font, lift.hitsuyoTakasa, { ...shift(LIFT.hitsuyoTakasa), fontSizePt: 7 });
      drawTextBox(page, font, lift.niSoJuryo, { ...shift(LIFT.niSoJuryo), fontSizePt: 7 });
      drawTextBox(page, font, lift.ikkaiJuryo, { ...shift(LIFT.ikkaiJuryo), fontSizePt: 7 });
      drawTextBox(page, font, lift.boomNagasa, { ...shift(LIFT.boomNagasa), fontSizePt: 7 });
      drawTextBox(page, font, lift.jibNagasa, { ...shift(LIFT.jibNagasa), fontSizePt: 7 });
      drawTextBox(page, font, lift.teikakuSokaJu, { ...shift(LIFT.teikakuSokaJu), fontSizePt: 7 });
      drawTextBox(page, font, lift.hookJuryo, { ...shift(LIFT.hookJuryo), fontSizePt: 7 });
      drawTextBox(page, font, lift.teikakuKaJu, { ...shift(LIFT.teikakuKaJu), fontSizePt: 7 });
      drawTextBox(page, font, lift.teikaku90, { ...shift(LIFT.teikaku90), fontSizePt: 7 });
      drawTextBox(page, font, shogaiText(lift), { ...shift(LIFT.shogaiUmu), fontSizePt: 7 });
      drawTextBox(page, font, lift.ichiKozo, { ...shift(LIFT.ichiKozo), fontSizePt: 7 });
      drawTextBox(page, font, lift.saidaiSekisai, { ...shift(LIFT.saidaiSekisai), fontSizePt: 7 });
      drawTextBox(page, font, lift.hokyoHitsuyo, { ...shift(LIFT.hokyoHitsuyo), fontSizePt: 7 });
      drawTextBox(page, font, lift.balanceKeikaku, { ...shift(LIFT.balanceKeikaku), fontSizePt: 7 });
    }
    // 未使用分の残プレースホルダーを消去
    for (let i = plan.lifts.length; i < 3; i++) {
      const off = COL_OFFSETS[i];
      drawTextBox(page, font, '', { x: LIFT.tsuriniMeisho.x + off, top: LIFT.tsuriniMeisho.top, width: LIFT.tsuriniMeisho.width, height: LIFT.tsuriniMeisho.height });
    }

    // 画像/図面挿入(145)
    async function drawImageSafe(dataUrl, box, label, fit) {
      try { await drawImageDataUrl(pdfDoc, page, dataUrl, { ...box, fit }); }
      catch (e) {
        console.warn(`${label}の埋め込みに失敗しました`, e);
        warnings.push(`${label}を埋め込めなかったため、この項目は空欄のまま保存されました。`);
      }
    }
    if (plan.image && plan.image.dataUrl) {
      await drawImageSafe(plan.image.dataUrl, {
        x: IMAGE_FRAME.x0 + 1, top: IMAGE_FRAME.y0 + 1,
        width: (IMAGE_FRAME.x1 - IMAGE_FRAME.x0) - 2, height: (IMAGE_FRAME.y1 - IMAGE_FRAME.y0) - 2,
      }, '挿入画像・図面');
    }

    // 罫線復元
    try {
      const gridLines = await loadGridLines();
      redrawGridLines(page, gridLines);
    } catch (e) { console.warn('罫線の復元に失敗しました', e); }

    // 点検基準表(参考資料)を末尾に結合
    try {
      const appendixBytes = await loadAppendixBytes();
      const appendixDoc = await PDFLib.PDFDocument.load(appendixBytes);
      const copied = await pdfDoc.copyPages(appendixDoc, appendixDoc.getPageIndices());
      copied.forEach((p) => pdfDoc.addPage(p));
    } catch (e) {
      console.warn('参考資料ページの結合に失敗しました', e);
      warnings.push('点検基準表(参考資料)ページの結合に失敗しました。');
    }

    const bytes = await pdfDoc.save();
    return { bytes, warnings };
  }

  return { generate };
})();
