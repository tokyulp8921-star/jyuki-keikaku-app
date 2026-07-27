// 一覧画面: 保存済みPDFの一覧表示・検索・閲覧
const ListView = (() => {
  let root = null;
  let entries = [];
  let query = '';
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

  async function openEntry(e) {
    UI.toast('PDFを開いています…');
    try {
      let blob;
      if (e.dropboxPath && window.Dropbox && Dropbox.isLinked()) {
        blob = await Dropbox.downloadFile(e.dropboxPath);
      } else if (e.hasLocal || e.localUrl) {
        blob = await IdbStore.get(e.fileName);
      }
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

  function render() {
    root.innerHTML = '';
    const searchBar = UI.el('div', { class: 'search-bar' });
    const input = UI.el('input', { type: 'text', placeholder: '日付・業者名で検索（例: 260504 オズモ）', value: query });
    input.addEventListener('input', () => { query = input.value; renderList(); });
    searchBar.appendChild(input);
    root.appendChild(searchBar);

    const listCard = UI.el('div', { class: 'card' });
    root.appendChild(listCard);
    renderListInto(listCard);

    const fab = UI.el('button', { class: 'fab-new', text: '＋ 新しい計画の作成' });
    fab.addEventListener('click', () => { Wizard.startNew(); App.navigate('wizard'); });
    root.appendChild(fab);

    function renderList() { renderListInto(listCard); }
    function renderListInto(container) {
      container.innerHTML = '';
      const filtered = entries.filter(matches);
      if (!filtered.length) {
        container.appendChild(UI.el('div', { class: 'empty-state', text: '保存されたPDFがありません' }));
        return;
      }
      filtered.forEach((e) => {
        const item = UI.el('div', { class: 'list-item' });
        const parsed = parseFileName(e.fileName);
        const clickArea = UI.el('div', { style: 'display:flex;align-items:center;gap:10px;flex:1;min-width:0;cursor:pointer;' });
        clickArea.appendChild(UI.el('div', { class: 'li-date', text: parsed.ymd || '-' }));
        clickArea.appendChild(UI.el('div', { class: 'li-name', text: parsed.gyoshamei || e.fileName }));
        clickArea.appendChild(UI.el('div', { class: 'li-status', text: e.dropboxPath ? 'Dropbox' : 'ローカル' }));
        clickArea.addEventListener('click', () => openEntry(e));
        item.appendChild(clickArea);
        const reuseBtn = UI.el('button', { class: 'btn btn-secondary', style: 'padding:6px 10px;font-size:12px;flex:0 0 auto;', text: '再利用' });
        reuseBtn.addEventListener('click', (ev) => { ev.stopPropagation(); reuseEntry(e); });
        item.appendChild(reuseBtn);
        container.appendChild(item);
      });
    }
  }

  async function mount(container) {
    root = container;
    root.innerHTML = '<div class="empty-state">読み込み中…</div>';
    await loadEntries();
    render();
  }

  return { mount };
})();
