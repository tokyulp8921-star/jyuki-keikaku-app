// マスタ管理画面: 各プルダウン候補のCRUD、およびDropbox連携設定
const MasterAdmin = (() => {
  let root = null;
  let activeCat = 'contractors';

  const CATS = [
    { key: 'contractors', label: '業者名' },
    { key: 'staff', label: '担当者' },
    { key: 'machines', label: '機械カテゴリ/機械名' },
    { key: 'owners', label: '所有者' },
    { key: 'locations', label: '使用場所' },
    { key: 'secondTier', label: '2次業者名' },
    { key: 'drivers', label: '運転者候補' },
  ];

  function renderDiagnostics(container) {
    const c = UI.el('div', { class: 'card' });
    c.appendChild(UI.el('div', { class: 'card-title', text: '診断' }));
    const body = UI.el('div', {});
    c.appendChild(body);
    const resultBox = UI.el('div', { class: 'field', style: 'font-size:11.5px;white-space:pre-wrap;word-break:break-all;color:var(--muted);', text: 'ボタンを押すと診断結果がここに表示されます。表示内容をそのままコピーして開発者に伝えてください。' });
    const runBtn = UI.el('button', { class: 'btn btn-secondary btn-block', text: '診断を実行' });
    runBtn.addEventListener('click', async () => {
      resultBox.textContent = '診断中…';
      const lines = [];
      lines.push('UA: ' + navigator.userAgent);
      lines.push('URL: ' + location.href);
      lines.push('indexedDB存在: ' + (!!window.indexedDB));
      // IndexedDB 書き込み/読み出しテスト
      try {
        const testBlob = new Blob(['diagnostic-test'], { type: 'text/plain' });
        const key = '__diag_test__';
        const t0 = performance.now();
        await IdbStore.put(key, testBlob);
        const got = await IdbStore.get(key);
        await IdbStore.remove(key);
        lines.push(`IndexedDB read/write: OK (${Math.round(performance.now() - t0)}ms, size=${got ? got.size : 'null'})`);
      } catch (e) {
        lines.push('IndexedDB read/write: 失敗 - ' + e.message);
      }
      // localStorage状況
      try {
        const idx = Storage.getPdfIndex();
        lines.push(`保存済み索引件数: ${idx.length}`);
        idx.slice(0, 10).forEach((e, i) => {
          lines.push(`  [${i}] ${e.fileName} hasLocal=${!!e.hasLocal} localUrl=${!!e.localUrl} dropboxPath=${e.dropboxPath || 'なし'}`);
        });
      } catch (e) {
        lines.push('localStorage索引取得: 失敗 - ' + e.message);
      }
      // Service Worker状況
      try {
        const regs = ('serviceWorker' in navigator) ? await navigator.serviceWorker.getRegistrations() : [];
        lines.push('Service Worker登録数: ' + regs.length);
      } catch (e) { lines.push('Service Worker確認: 失敗 - ' + e.message); }
      // PDF生成の疎通テスト(実際にgenerateを1回動かす)
      try {
        const plan = PlanState.newPlan();
        plan.header.gyoshamei = '診断'; plan.header.uchiawaseDate = '2026-08-01'; plan.header.sagyobi = '2026-08-03'; plan.header.chuyabetsu = '昼';
        plan.machines[0].category = '掘削用機械'; plan.machines[0].name = '油圧シャベル';
        const t0 = performance.now();
        const { bytes } = await PdfGen.generate(plan);
        lines.push(`PDF生成テスト: OK (${bytes.length}bytes, ${Math.round(performance.now() - t0)}ms)`);
      } catch (e) {
        lines.push('PDF生成テスト: 失敗 - ' + (e.stack || e.message));
      }
      resultBox.textContent = lines.join('\n');
    });
    body.appendChild(UI.el('div', { class: 'field' }, runBtn));
    body.appendChild(resultBox);
    container.appendChild(c);
  }

  function renderDropboxConfigSettings(container) {
    const cfg = Dropbox.getConfig();
    const c = UI.el('div', { class: 'card' });
    c.appendChild(UI.el('div', { class: 'card-title', text: 'Dropbox基本設定' }));
    const body = UI.el('div', {});
    c.appendChild(body);
    body.appendChild(UI.el('div', { class: 'field' }, UI.el('div', { class: 'section-hint', text: 'App Key・保存先フォルダのURL・パスワードは、この端末のブラウザ内にのみ保存されます（ソースコードやサーバーには保存されません）。' })));
    const appKeyInput = UI.el('input', { type: 'text', placeholder: 'Dropbox App Key', value: cfg.appKey || '' });
    const urlInput = UI.el('input', { type: 'text', placeholder: '保存先フォルダの共有URL', value: cfg.folderUrl || '', style: 'margin-top:8px;' });
    const pwInput = UI.el('input', { type: 'text', placeholder: '共有URLのパスワード（設定されていれば）', value: cfg.folderPassword || '', style: 'margin-top:8px;' });
    const saveBtn = UI.el('button', { class: 'btn btn-primary', style: 'margin-top:8px;', text: '設定を保存' });
    saveBtn.addEventListener('click', () => {
      Dropbox.saveConfig({ appKey: appKeyInput.value.trim(), folderUrl: urlInput.value.trim(), folderPassword: pwInput.value.trim() });
      UI.toast('Dropbox設定を保存しました');
      renderAll();
    });
    const f = UI.el('div', { class: 'field' }, [appKeyInput, urlInput, pwInput, saveBtn]);
    body.appendChild(f);
    container.appendChild(c);
  }

  function renderDropboxSettings(container) {
    const c = UI.el('div', { class: 'card' });
    c.appendChild(UI.el('div', { class: 'card-title', text: 'Dropbox連携設定' }));
    const body = UI.el('div', {});
    c.appendChild(body);
    if (!Dropbox.hasConfig()) {
      body.appendChild(UI.el('div', { class: 'field' }, UI.el('div', { class: 'section-hint', text: '先に上の「Dropbox基本設定」でApp Keyと保存先フォルダURLを保存してください。' })));
      container.appendChild(c);
      return;
    }
    const status = UI.el('div', { class: 'field', text: Dropbox.isLinked() ? '状態: 連携済み' : '状態: 未連携' });
    body.appendChild(status);
    if (!Dropbox.isLinked()) {
      const f1 = UI.el('div', { class: 'field' });
      f1.appendChild(UI.el('div', { class: 'section-hint', text: '① 下のボタンでDropboxの認証ページを開き、ログイン・許可してください。② 表示された認証コードをコピーし、下の欄に貼り付けて「連携する」を押してください。' }));
      const openBtn = UI.el('button', { class: 'btn btn-secondary btn-block', text: 'Dropboxの認証ページを開く' });
      openBtn.addEventListener('click', () => Dropbox.startOAuth());
      f1.appendChild(openBtn);
      body.appendChild(f1);

      const f = UI.el('div', { class: 'field' });
      const input = UI.el('input', { type: 'text', placeholder: '認証コードを貼り付け', style: 'margin-bottom:8px;' });
      const btn = UI.el('button', { class: 'btn btn-primary', text: '連携する' });
      btn.addEventListener('click', async () => {
        try { await Dropbox.exchangeCode(input.value.trim()); UI.toast('Dropboxと連携しました'); renderAll(); }
        catch (e) { UI.toast('連携に失敗しました: ' + e.message); }
      });
      f.appendChild(input); f.appendChild(btn);
      body.appendChild(f);

      const f2 = UI.el('div', { class: 'field' });
      f2.appendChild(UI.el('div', { class: 'section-hint', text: '（上級者向け）App Console で発行したアクセストークンを直接お持ちの場合はこちら' }));
      const tokenInput = UI.el('input', { type: 'text', placeholder: 'アクセストークンを貼り付け', style: 'margin-bottom:8px;' });
      const tokenBtn = UI.el('button', { class: 'btn btn-secondary', text: 'トークンで連携' });
      tokenBtn.addEventListener('click', async () => {
        try { await Dropbox.linkWithToken(tokenInput.value.trim()); UI.toast('Dropboxと連携しました'); renderAll(); }
        catch (e) { UI.toast('連携に失敗しました: ' + e.message); }
      });
      f2.appendChild(tokenInput); f2.appendChild(tokenBtn);
      body.appendChild(f2);
    } else {
      const btn = UI.el('button', { class: 'btn btn-danger', text: '連携を解除' });
      btn.addEventListener('click', () => { Dropbox.unlink(); UI.toast('連携を解除しました'); renderAll(); });
      body.appendChild(UI.el('div', { class: 'field' }, btn));
    }
    container.appendChild(c);
  }

  function simpleListEditor(container, listKey, label) {
    const master = MasterData.get();
    const c = UI.el('div', { class: 'card' });
    c.appendChild(UI.el('div', { class: 'card-title', text: label }));
    const body = UI.el('div', {});
    c.appendChild(body);
    function renderItems() {
      body.innerHTML = '';
      (master[listKey] || []).forEach((v) => {
        const row = UI.el('div', { class: 'field', style: 'display:flex;align-items:center;justify-content:space-between;' });
        row.appendChild(UI.el('div', { text: v }));
        const del = UI.el('button', { class: 'btn btn-danger', style: 'padding:6px 10px;font-size:12px;', text: '削除' });
        del.addEventListener('click', () => { MasterData.removeFromList(listKey, v); renderItems(); });
        row.appendChild(del);
        body.appendChild(row);
      });
      const addRow = UI.el('div', { class: 'field', style: 'display:flex;gap:8px;' });
      const input = UI.el('input', { type: 'text', placeholder: '新規追加' });
      const addBtn = UI.el('button', { class: 'btn btn-primary', text: '追加' });
      addBtn.addEventListener('click', () => { if (input.value.trim()) { MasterData.addToList(listKey, input.value.trim()); input.value = ''; renderItems(); } });
      addRow.appendChild(input); addRow.appendChild(addBtn);
      body.appendChild(addRow);
    }
    renderItems();
    container.appendChild(c);
  }

  function machineEditor(container) {
    const master = MasterData.get();
    const c = UI.el('div', { class: 'card' });
    c.appendChild(UI.el('div', { class: 'card-title', text: '機械カテゴリ / 機械名' }));
    const body = UI.el('div', {});
    c.appendChild(body);
    function renderCats() {
      body.innerHTML = '';
      master.machineCategories.forEach((cat) => {
        const catRow = UI.el('div', { class: 'field' });
        catRow.appendChild(UI.el('div', { class: 'field-label', text: cat }));
        (master.machinesByCategory[cat] || []).forEach((mname) => {
          const row = UI.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;' });
          row.appendChild(UI.el('div', { text: '・' + mname }));
          const del = UI.el('button', { class: 'btn btn-danger', style: 'padding:4px 8px;font-size:11px;', text: '削除' });
          del.addEventListener('click', () => { MasterData.removeMachine(cat, mname); renderCats(); });
          row.appendChild(del);
          catRow.appendChild(row);
        });
        const addRow = UI.el('div', { style: 'display:flex;gap:8px;margin-top:6px;' });
        const input = UI.el('input', { type: 'text', placeholder: `${cat}に機械名を追加` });
        const addBtn = UI.el('button', { class: 'btn btn-primary', text: '追加' });
        addBtn.addEventListener('click', () => { if (input.value.trim()) { MasterData.addMachine(cat, input.value.trim()); input.value = ''; renderCats(); } });
        addRow.appendChild(input); addRow.appendChild(addBtn);
        catRow.appendChild(addRow);
        body.appendChild(catRow);
      });
    }
    renderCats();
    container.appendChild(c);
  }

  function secondTierEditor(container) {
    const master = MasterData.get();
    const c = UI.el('div', { class: 'card' });
    c.appendChild(UI.el('div', { class: 'card-title', text: '2次業者名（1次業者ごと）' }));
    const body = UI.el('div', {});
    c.appendChild(body);
    function renderTree() {
      body.innerHTML = '';
      (master.contractors || []).forEach((contractor) => {
        const row = UI.el('div', { class: 'field' });
        row.appendChild(UI.el('div', { class: 'field-label', text: contractor }));
        (master.secondTierByContractor[contractor] || []).forEach((name) => {
          const r = UI.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin:2px 0 2px 16px;' });
          r.appendChild(UI.el('div', { text: '└ ' + name }));
          const del = UI.el('button', { class: 'btn btn-danger', style: 'padding:4px 8px;font-size:11px;', text: '削除' });
          del.addEventListener('click', () => { MasterData.removeSecondTier(contractor, name); renderTree(); });
          r.appendChild(del);
          row.appendChild(r);
        });
        const addRow = UI.el('div', { style: 'display:flex;gap:8px;margin:6px 0 0 16px;' });
        const input = UI.el('input', { type: 'text', placeholder: `${contractor}の2次業者名を追加` });
        const addBtn = UI.el('button', { class: 'btn btn-primary', text: '追加' });
        addBtn.addEventListener('click', () => { if (input.value.trim()) { MasterData.addSecondTier(contractor, input.value.trim()); input.value = ''; renderTree(); } });
        addRow.appendChild(input); addRow.appendChild(addBtn);
        row.appendChild(addRow);
        body.appendChild(row);
      });
    }
    renderTree();
    container.appendChild(c);
  }

  function renderAll() {
    root.innerHTML = '';
    renderDiagnostics(root);
    renderDropboxConfigSettings(root);
    renderDropboxSettings(root);
    const catBar = UI.el('div', { class: 'master-cat' });
    CATS.forEach((cat) => {
      const chip = UI.el('div', { class: 'chip' + (activeCat === cat.key ? ' selected' : ''), text: cat.label });
      chip.addEventListener('click', () => { activeCat = cat.key; renderAll(); });
      catBar.appendChild(chip);
    });
    root.appendChild(catBar);

    if (activeCat === 'machines') machineEditor(root);
    else if (activeCat === 'secondTier') secondTierEditor(root);
    else {
      const map = { contractors: '業者名', staff: '担当者', owners: '所有者', locations: '使用場所', drivers: '運転者候補' };
      simpleListEditor(root, activeCat, map[activeCat]);
    }
  }

  async function mount(container) {
    root = container;
    await MasterData.load();
    renderAll();
  }

  return { mount };
})();
