// IndexedDBを使い、生成したPDF本体(Blob)を永続保存する。
// localStorageのblob URL文字列はページ再読み込みで無効になるため、実データはこちらに保存する。
// 一部端末でIndexedDBの処理が完了しない(ハングする)事例があるため、全操作にタイムアウトを設けて必ず結果を返す。
const IdbStore = (() => {
  const DB_NAME = 'jyuki_pdfs_db';
  const STORE = 'pdfs';
  const TIMEOUT_MS = 8000;
  let dbPromise = null;

  function withTimeout(promise, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`IndexedDB操作がタイムアウトしました(${label})`)), TIMEOUT_MS)),
    ]);
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('この端末/ブラウザはIndexedDBに対応していません')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error('IndexedDBのオープンに失敗しました'));
      req.onblocked = () => reject(new Error('IndexedDBが他のタブにブロックされています。他のタブを閉じてください'));
    });
  }

  function getDb() {
    if (dbPromise) return dbPromise;
    dbPromise = withTimeout(openDb(), 'open').catch((e) => { dbPromise = null; throw e; });
    return dbPromise;
  }

  async function put(key, blob) {
    const db = await getDb();
    return withTimeout(new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('保存トランザクションが中断されました'));
    }), 'put');
  }

  async function get(key) {
    const db = await getDb();
    return withTimeout(new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error || new Error('取得トランザクションが中断されました'));
    }), 'get');
  }

  async function remove(key) {
    const db = await getDb();
    return withTimeout(new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }), 'remove');
  }

  return { put, get, remove };
})();
