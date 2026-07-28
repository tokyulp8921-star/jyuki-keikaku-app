// Dropbox連携。ユーザー提供の資格情報(アクセストークン、または App Key)を使い、
// 生成PDF・master.jsonの保存/一覧取得/ダウンロードを行う。
const Dropbox = (() => {
  // App Key・共有フォルダURL・パスワードはソースコードに含めず、マスタ管理画面から入力して
  // 端末のlocalStorageにのみ保存する(公開リポジトリに秘密情報を含めないため)。
  const API = 'https://api.dropboxapi.com/2';
  const CONTENT_API = 'https://content.dropboxapi.com/2';

  let folderPathCache = null;

  // Dropbox-API-Argヘッダーはブラウザの制約でISO-8859-1範囲外の文字(日本語など)を直接渡せないため、
  // \uXXXXエスケープに変換してASCII安全な文字列にする
  function apiArgHeader(obj) {
    return JSON.stringify(obj).replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  }

  function getConfig() { return Storage.loadDropboxConfig() || { appKey: '', folderUrl: '', folderPassword: '' }; }
  function saveConfig(cfg) { Storage.saveDropboxConfig(cfg); folderPathCache = null; }
  function hasConfig() { const c = getConfig(); return !!(c.appKey && c.folderUrl); }

  function getAuth() { return Storage.loadDropboxAuth(); }
  function isLinked() { const a = getAuth(); return !!(a && a.accessToken); }

  async function apiCall(path, body, { content = false, extraHeaders = {} } = {}, _retried = false) {
    const auth = getAuth();
    if (!auth || !auth.accessToken) throw new Error('Dropbox未連携です');
    const base = content ? CONTENT_API : API;
    const headers = { Authorization: `Bearer ${auth.accessToken}`, ...extraHeaders };
    if (!content) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${base}${path}`, {
      method: 'POST', headers, body: content ? body : JSON.stringify(body || {}),
    });
    if (res.status === 401 && auth.refreshToken && !_retried) {
      await refreshAccessToken();
      return apiCall(path, body, { content, extraHeaders }, true);
    }
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Dropbox API error ${res.status}: ${errText}`);
    }
    return res;
  }

  async function refreshAccessToken() {
    const auth = getAuth();
    if (!auth || !auth.refreshToken) throw new Error('リフレッシュトークンがありません。再連携してください。');
    const body = new URLSearchParams({ refresh_token: auth.refreshToken, grant_type: 'refresh_token', client_id: getConfig().appKey });
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!res.ok) throw new Error('アクセストークンの更新に失敗しました。再連携してください。');
    const data = await res.json();
    Storage.saveDropboxAuth({ accessToken: data.access_token, refreshToken: auth.refreshToken });
  }

  // 起動時チェック: 既にOAuth連携済みなら何もしない(与えられた値はApp Keyと判明したため自動トークン推測は行わない)
  async function tryAutoLink() {
    return isLinked();
  }

  async function linkWithToken(token) {
    Storage.saveDropboxAuth({ accessToken: token });
    await apiCall('/users/get_current_account', null); // 検証(失敗時は例外)
    return true;
  }

  function unlink() { Storage.clearDropboxAuth(); folderPathCache = null; }

  async function resolveFolderPath() {
    if (folderPathCache) return folderPathCache;
    const cfg = getConfig();
    if (!cfg.folderUrl) throw new Error('Dropboxの保存先フォルダが設定されていません。マスタ管理画面で設定してください。');
    const body = { url: cfg.folderUrl };
    if (cfg.folderPassword) body.link_password = cfg.folderPassword;
    const res = await apiCall('/sharing/get_shared_link_metadata', body);
    const meta = await res.json();
    let path = meta.path_lower || meta.path_display;
    if (!path) {
      // 連携アカウント自身の「マイDropbox」にまだ追加(マウント)されていない共有フォルダの場合、
      // パスが返らないため自動でマウントを試みる
      const sharedFolderId = meta.shared_folder_id || meta.id;
      if (sharedFolderId) {
        try {
          const mountRes = await apiCall('/sharing/mount_folder', { shared_folder_id: sharedFolderId });
          const mounted = await mountRes.json();
          path = mounted.path_lower || mounted.path_display;
        } catch (e) { /* マウント不可・既にマウント済み等。下のエラーで案内する */ }
      }
    }
    if (!path) {
      throw new Error('共有フォルダのパスを取得できませんでした。Dropboxアプリ/サイトでこの共有フォルダを開き、「自分のDropboxに追加」を行ってから、もう一度お試しください。');
    }
    folderPathCache = path;
    return folderPathCache;
  }

  async function uploadPdf(fileName, bytes) {
    const folder = await resolveFolderPath();
    const res = await apiCall('/files/upload', bytes, {
      content: true,
      extraHeaders: {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': apiArgHeader({ path: `${folder}/${fileName}`, mode: 'add', autorename: true, mute: false }),
      },
    });
    const meta = await res.json();
    return meta.path_lower;
  }

  async function uploadMasterJson(data) {
    const folder = await resolveFolderPath();
    const bytes = new TextEncoder().encode(JSON.stringify(data, null, 1));
    await apiCall('/files/upload', bytes, {
      content: true,
      extraHeaders: {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': apiArgHeader({ path: `${folder}/master.json`, mode: 'overwrite', mute: true }),
      },
    });
  }

  async function listFolder() {
    const folder = await resolveFolderPath();
    const res = await apiCall('/files/list_folder', { path: folder });
    const data = await res.json();
    let entries = data.entries || [];
    let cursor = data.cursor;
    while (data.has_more) {
      const more = await apiCall('/files/list_folder/continue', { cursor });
      const moreData = await more.json();
      entries = entries.concat(moreData.entries);
      if (!moreData.has_more) break;
      cursor = moreData.cursor;
    }
    return entries.filter((e) => e['.tag'] === 'file' && e.name.toLowerCase().endsWith('.pdf'));
  }

  async function deleteFile(path) {
    await apiCall('/files/delete_v2', { path });
  }

  async function downloadFile(path) {
    const res = await apiCall('/files/download', null, {
      content: true,
      extraHeaders: { 'Dropbox-API-Arg': apiArgHeader({ path }) },
    });
    return res.blob();
  }

  // --- OAuth2 (PKCE, 手動コード貼付) フォールバック ---
  function b64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function pkceChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return b64url(digest);
  }
  function randomVerifier() {
    const arr = new Uint8Array(64);
    crypto.getRandomValues(arr);
    return b64url(arr.buffer);
  }
  async function startOAuth() {
    const appKey = getConfig().appKey;
    if (!appKey) throw new Error('先にDropbox App Keyを設定してください。');
    const verifier = randomVerifier();
    sessionStorage.setItem('dbx_pkce_verifier', verifier);
    const challenge = await pkceChallenge(verifier);
    const url = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&code_challenge=${challenge}&code_challenge_method=S256&token_access_type=offline`;
    window.open(url, '_blank');
  }
  async function exchangeCode(code) {
    const verifier = sessionStorage.getItem('dbx_pkce_verifier');
    const body = new URLSearchParams({
      code, grant_type: 'authorization_code', client_id: getConfig().appKey, code_verifier: verifier,
    });
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!res.ok) throw new Error('認証コードの交換に失敗しました');
    const data = await res.json();
    Storage.saveDropboxAuth({ accessToken: data.access_token, refreshToken: data.refresh_token });
    return true;
  }

  return {
    isLinked, tryAutoLink, linkWithToken, unlink,
    resolveFolderPath, uploadPdf, uploadMasterJson, listFolder, downloadFile, deleteFile,
    startOAuth, exchangeCode, refreshAccessToken,
    getConfig, saveConfig, hasConfig,
  };
})();
