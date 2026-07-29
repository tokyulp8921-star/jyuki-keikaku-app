// 一覧画面: 保存済みPDFの一覧表示・検索・閲覧
const ListView = (() => {
  let root = null;
  let entries = [];
  let query = '';
  let selected = new Set();
  const RETENTION_MS = 62 * 24 * 60 * 60 * 1000; // 約2か月

  function parseFileName(name) {
    const base = name.replace(/\.pdf$/i, '');
    const m = base.match(/^(\d{6})(.*)$/);
    if (m) return { ymd: m[1], gyoshamei: m[2] };
    return { ymd: '', gyoshamei: base };
  }

  // 作業日(sagyobi)から2か月以上経過したローカル保存分を自動削除する(Dropbox上のファイルは削除しない)
  async function purgeOldEntries() {
    const local = Storage.getPdfIndex();
    const now = Date.now();
    const keep = [];
    for (const e of local) {
      if (!e.sagyobi) { keep.push(e); continue; }
      const t = new Date(e.sagyobi + 'T00:00:00').getTime();
      if (Number.isNaN(t) || now - t < RETENTION_MS) { keep.push(e); continue; }
      // 期限切れ: ローカルの実体(PDF・入力データ)を削除。索引からも外す
      try { await IdbStore.remove(e.fileName); } catch (err) { /* noop */ }
      try { await IdbStore.removePlan(e.fileName); } catch (err) { /* noop */ }
    }
    if (keep.length !== local.length) Storage.setPdfIndex(keep);
  }

  async function loadEntries() {
    await purgeOldEntries();
    const local = Storage.getPdfIndex();
    let merged = [...local];
    if (window.Dropbox && Dropbox.isLinked()) {
      try {
        const remote = await Dropbox.listFolder();
        const localNames = new Set(local.map((e) => e.fileName));
        remote.forEach((r) => {
          if (!localNames.has(r.name)) {
            const parsed = parseFileName(r.name);
            merged.push({
              fileName: r.name, createdAt: new Date(r.client_modified || r.server_modified).getTime(),
              gyoshamei: parsed.gyoshamei, sagyobi: parsed.ymd ? yymmddToIso(parsed.ymd) : '', dropboxPath: r.path_lower, localUrl: null,
            });
          }
        });
      } catch (e) { console.warn('dropbox list failed', e); }
    }
    // 作業日(sagyobi)が新しい順。sagyobiが無いものは末尾に回す
    merged.sort((a, b) => {
      const ta = a.sagyobi ? new Date(a.sagyobi).getTime() : -Infinity;
      const tb = b.sagyobi ? new Date(b.sagyobi).getTime() : -Infinity;
      if (tb !== ta) return tb - ta;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    entries = merged;
  }

  function yymmddToIso(ymd) {
    if (!/^\d{6}$/.test(ymd)) return '';
    const y = 2000 + Number(ymd.slice(0, 2));
    return `${y}-${ymd.slice(2, 4)}-${ymd.slice(4, 6)}`;
  }

  function matches(e) {
    if (!query) return true;
    const q = query.toLowerCase();
    return (e.fileName || '').toLowerCase().includes(q) || (e.gyoshamei || '').toLowerCase().includes(q) || (e.sagyobi || '').includes(q);
  }

  function docTypeOf(e) { return e.docType || 'kiki'; }

  async function fetchEntryBlob(e) {
    if (e.dropboxPath && window.Dropbox && Dropbox.isLinked()) {
      return Dropbox.downloadFile(e.dropboxPath);
    }
    if (e.hasLocal || e.localUrl) {
      return IdbStore.get(e.fileName);
    }
    return null;
  }

  async function openEntry(e) {
    UI.toast('PDFを開いています…');
    try {
      const blob = await fetchEntryBlob(e);
      if (!blob) {
        return UI.toast(`PDFを取得できませんでした（fileName=${e.fileName} / hasLocal=${!!e.hasLocal} / dropboxPath=${e.dropboxPath || 'なし'}）`);
      }
      const url = URL.createObjectURL(blob);
      PreviewView.showUrl(url, e.fileName);
      App.navigate('preview');
    } catch (err) {
      console.error(err);
      UI.toast('PDFを開けませんでした');
    }
  }

  const PRINT_INSTRUCTIONS = [
    '【印刷方法】',
    '① OKを押すと、選択したPDFをまとめた新しいタブが開きます',
    '② 開いたPDF画面の共有アイコン（またはメニュー）から「印刷」を選択',
    '③ 印刷設定で用紙サイズを「A3」に、倍率を「実際のサイズ／100%」に設定',
    '④ 印刷を実行してください',
    '',
    '※ 用紙サイズを自動調整（用紙に合わせる）にすると、原寸と異なるサイズで印刷される場合があります',
  ].join('\n');

  // チェックした複数PDFを1つのPDFにまとめて新しいタブで開く(A3サイズのまま結合されるので、
  // 印刷ダイアログでは「実際のサイズ」または用紙をA3に指定して印刷する)
  async function printSelected() {
    const targets = entries.filter((e) => selected.has(e.fileName));
    if (!targets.length) return window.alert('印刷したい計画書のチェックボックスにチェックを入れてください。');
    if (!window.confirm(PRINT_INSTRUCTIONS)) return;
    UI.toast('印刷用PDFを準備しています…');
    try {
      const merged = await PDFLib.PDFDocument.create();
      const printedNames = [];
      for (const e of targets) {
        const blob = await fetchEntryBlob(e);
        if (!blob) { console.warn('印刷対象を取得できませんでした', e.fileName); continue; }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const src = await PDFLib.PDFDocument.load(bytes);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
        printedNames.push(e.fileName);
      }
      if (merged.getPageCount() === 0) return UI.toast('印刷対象のPDFを取得できませんでした');
      const bytes = await merged.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      window.open(url, '_blank');
      Storage.markPrinted(printedNames);
      render();
      UI.toast('新しいタブでPDFを開きました。印刷/共有ボタンからA3で印刷してください');
    } catch (err) {
      console.error(err);
      UI.toast('印刷用PDFの作成に失敗しました: ' + err.message);
    }
  }

  async function reuseEntry(e) {
    UI.toast('入力データを読み込んでいます…');
    try {
      const plan = await IdbStore.getPlan(e.fileName);
      if (!plan) return UI.toast('この項目には再利用できる入力データが保存されていません（古い保存分、またはDropboxのみの項目）');
      Wizard.startFromPlan(plan);
      App.navigate('wizard');
    } catch (err) {
      console.error(err);
      UI.toast('再利用データの読み込みに失敗しました');
    }
  }

  async function deleteEntry(e) {
    const dropboxNote = e.dropboxPath ? '\n※Dropbox上のファイルも削除されます。' : '';
    const ok = window.confirm(`「${e.fileName}」を削除しますか？この操作は取り消せません。${dropboxNote}`);
    if (!ok) return;
    UI.toast('削除しています…');
    try {
      if (e.dropboxPath && window.Dropbox && Dropbox.isLinked()) {
        try { await Dropbox.deleteFile(e.dropboxPath); } catch (err) { console.warn('Dropbox削除に失敗', err); }
      }
      try { await IdbStore.remove(e.fileName); } catch (err) { /* noop */ }
      try { await IdbStore.removePlan(e.fileName); } catch (err) { /* noop */ }
      Storage.setPdfIndex(Storage.getPdfIndex().filter((x) => x.fileName !== e.fileName));
      selected.delete(e.fileName);
      UI.toast(`${e.fileName} を削除しました`);
      await loadEntries();
      render();
    } catch (err) {
      console.error(err);
      UI.toast('削除に失敗しました: ' + err.message);
    }
  }

  function render() {
    root.innerHTML = '';
    const searchBar = UI.el('div', { class: 'search-bar' });
    const input = UI.el('input', { type: 'text', placeholder: '日付・業者名で検索（例: 260504 オズモ）', value: query });
    input.addEventListener('input', () => { query = input.value; renderList(); });
    searchBar.appendChild(input);
    root.appendChild(searchBar);

    root.appendChild(UI.el('div', { class: 'section-hint', text: '印刷する場合は、印刷したい計画書のチェックボックスにチェックを入れてから「🖨 選択したPDFを印刷」を押してください。' }));

    const columns = UI.el('div', { class: 'list-columns' });
    root.appendChild(columns);

    const kikiCol = UI.el('div', { class: 'list-col' });
    kikiCol.appendChild(UI.el('div', { class: 'list-col-title', text: '重機作業計画書' }));
    const kikiCard = UI.el('div', { class: 'card' });
    kikiCol.appendChild(kikiCard);
    columns.appendChild(kikiCol);

    const craneCol = UI.el('div', { class: 'list-col' });
    craneCol.appendChild(UI.el('div', { class: 'list-col-title', text: 'クレーン計画書' }));
    const craneCard = UI.el('div', { class: 'card' });
    craneCol.appendChild(craneCard);
    columns.appendChild(craneCol);

    renderListInto(kikiCard, 'kiki');
    renderListInto(craneCard, 'crane');

    const printFab = UI.el('button', { class: 'fab-print', text: '🖨 選択したPDFを印刷' });
    printFab.addEventListener('click', printSelected);
    root.appendChild(printFab);

    const fab = UI.el('button', { class: 'fab-new', text: '＋ 新しい計画書を作成' });
    fab.addEventListener('click', () => {
      UI.choiceModal('作成する計画書を選択してください', [
        { label: '重機作業計画書', primary: true, onClick: () => { Wizard.startNew(); App.navigate('wizard'); } },
        { label: 'クレーン計画書', onClick: () => { UI.toast('クレーン計画書は準備中です（テンプレートPDFをいただき次第、対応します）'); } },
      ]);
    });
    root.appendChild(fab);

    function renderList() { renderListInto(kikiCard, 'kiki'); renderListInto(craneCard, 'crane'); }
    function renderListInto(container, docType) {
      container.innerHTML = '';
      const filtered = entries.filter((e) => matches(e) && docTypeOf(e) === docType);
      if (!filtered.length) {
        if (docType === 'crane') {
          container.appendChild(UI.el('div', { class: 'empty-state', text: 'クレーン計画書は準備中です（テンプレートPDFをいただき次第、対応します）' }));
        } else {
          container.appendChild(UI.el('div', { class: 'empty-state', text: '保存されたPDFがありません' }));
        }
        return;
      }
      const printedNames = new Set(Storage.getPrintedFileNames());
      filtered.forEach((e) => {
        const item = UI.el('div', { class: 'list-item' });
        const parsed = parseFileName(e.fileName);
        const checkbox = UI.el('input', { type: 'checkbox' });
        checkbox.checked = selected.has(e.fileName);
        checkbox.addEventListener('click', (ev) => ev.stopPropagation());
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selected.add(e.fileName); else selected.delete(e.fileName);
        });
        item.appendChild(checkbox);
        if (e.tantosha6) item.appendChild(UI.el('div', { style: 'font-size:11px;color:var(--muted);flex:0 0 auto;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;', text: e.tantosha6 }));
        const clickArea = UI.el('div', { style: 'display:flex;align-items:center;gap:10px;flex:1;min-width:0;cursor:pointer;' });
        clickArea.appendChild(UI.el('div', { class: 'li-date', text: parsed.ymd || '-' }));
        clickArea.appendChild(UI.el('div', { class: 'li-name', text: parsed.gyoshamei || e.fileName }));
        clickArea.appendChild(UI.el('div', { class: 'li-status', text: e.dropboxPath ? 'Dropbox' : 'ローカル' }));
        if (printedNames.has(e.fileName)) clickArea.appendChild(UI.el('div', { class: 'badge', text: '印刷済み' }));
        clickArea.addEventListener('click', () => openEntry(e));
        item.appendChild(clickArea);
        const reuseBtn = UI.el('button', { class: 'btn btn-secondary', style: 'padding:6px 10px;font-size:12px;flex:0 0 auto;', text: '再利用' });
        reuseBtn.addEventListener('click', (ev) => { ev.stopPropagation(); reuseEntry(e); });
        item.appendChild(reuseBtn);
        const delBtn = UI.el('button', { class: 'btn btn-danger', style: 'padding:6px 10px;font-size:12px;flex:0 0 auto;', text: '削除' });
        delBtn.addEventListener('click', (ev) => { ev.stopPropagation(); deleteEntry(e); });
        item.appendChild(delBtn);
        container.appendChild(item);
      });
    }
  }

  async function mount(container) {
    root = container;
    selected = new Set();
    root.innerHTML = '<div class="empty-state">読み込み中…</div>';
    await loadEntries();
    render();
  }

  return { mount };
})();
