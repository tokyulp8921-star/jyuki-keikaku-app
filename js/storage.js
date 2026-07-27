// ローカル永続化ヘルパー(localStorage)。Dropboxトークン、入力履歴(最大5件)、下書き、PDF索引を扱う。
const Storage = (() => {
  const KEYS = {
    draft: 'jyuki_draft_v1',
    history: 'jyuki_history_v1',
    dropboxToken: 'jyuki_dropbox_token_v1',
    pdfIndex: 'jyuki_pdf_index_v1',
    masterLocal: 'jyuki_master_local_v1',
    masterUpdatedAt: 'jyuki_master_updated_at_v1',
    dropboxConfig: 'jyuki_dropbox_config_v1',
  };

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore quota */ }
  }
  function remove(key) { localStorage.removeItem(key); }

  // --- 下書き(進行中の入力状態) ---
  function saveDraft(plan) { set(KEYS.draft, plan); }
  function loadDraft() { return get(KEYS.draft, null); }
  function clearDraft() { remove(KEYS.draft); }

  // --- 自由入力の履歴(フィールドキーごとに最大5件、新しいものが先頭) ---
  function pushHistory(fieldKey, value) {
    if (!value || !value.trim()) return;
    const all = get(KEYS.history, {});
    const list = all[fieldKey] || [];
    const filtered = list.filter((v) => v !== value);
    filtered.unshift(value);
    all[fieldKey] = filtered.slice(0, 5);
    set(KEYS.history, all);
  }
  function getHistory(fieldKey) {
    const all = get(KEYS.history, {});
    return all[fieldKey] || [];
  }

  // --- Dropboxトークン ---
  function saveDropboxAuth(auth) { set(KEYS.dropboxToken, auth); }
  function loadDropboxAuth() { return get(KEYS.dropboxToken, null); }
  function clearDropboxAuth() { remove(KEYS.dropboxToken); }

  // --- 生成済みPDFのローカル索引 ---
  function getPdfIndex() { return get(KEYS.pdfIndex, []); }
  function addPdfIndexEntry(entry) {
    const list = getPdfIndex();
    list.unshift(entry);
    set(KEYS.pdfIndex, list);
  }
  function setPdfIndex(list) { set(KEYS.pdfIndex, list); }

  // --- マスタのローカル編集分(Excel初期値とのマージ用) ---
  function getMasterLocal() { return get(KEYS.masterLocal, null); }
  function saveMasterLocal(master) {
    set(KEYS.masterLocal, master);
    set(KEYS.masterUpdatedAt, Date.now());
  }
  function getMasterUpdatedAt() { return get(KEYS.masterUpdatedAt, 0); }

  // --- Dropbox設定(App Key・共有フォルダURL・パスワード。ソースコードに書かず端末に保存する) ---
  function saveDropboxConfig(cfg) { set(KEYS.dropboxConfig, cfg); }
  function loadDropboxConfig() { return get(KEYS.dropboxConfig, null); }

  return {
    saveDraft, loadDraft, clearDraft,
    pushHistory, getHistory,
    saveDropboxAuth, loadDropboxAuth, clearDropboxAuth,
    getPdfIndex, addPdfIndexEntry, setPdfIndex,
    getMasterLocal, saveMasterLocal, getMasterUpdatedAt,
    saveDropboxConfig, loadDropboxConfig,
  };
})();
