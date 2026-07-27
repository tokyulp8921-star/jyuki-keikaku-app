// 一覧画面: 保存済みPDFの一覧表示・検索・閲覧
const ListView = (() => {
  let root = null;
  let entries = [];
  let query = '';

  function parseFileName(name) {
    const base = name.replace(/\.pdf$/i, '');
    const m = base.match(/^(\d{6})(.*)$/);
    if (m) return { ymd: m[1], gyoshamei: m[2] };
    return { ymd: '', gyoshamei: base };
  }

  async function loadEntries() {
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
              gyoshamei: parsed.gyoshamei, sagyobi: '', dropboxPath: r.path_lower, localUrl: null,
            });
          }
        });
      } catch (e) { console.warn('dropbox list failed', e); }
    }
    merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    entries = merged;
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
        item.appendChild(UI.el('div', { class: 'li-date', text: parsed.ymd || '-' }));
        item.appendChild(UI.el('div', { class: 'li-name', text: parsed.gyoshamei || e.fileName }));
        item.appendChild(UI.el('div', { class: 'li-status', text: e.dropboxPath ? 'Dropbox' : 'ローカル' }));
        item.addEventListener('click', () => openEntry(e));
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
