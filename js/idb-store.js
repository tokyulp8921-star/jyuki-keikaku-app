// IndexedDBを使い、生成したPDF本体(Blob)と、再利用用の入力データ(plan)を永続保存する。
// localStorageのblob URL文字列はページ再読み込みで無効になるため、実データはこちらに保存する。
// 一部端末でIndexedDBの処理が完了しない(ハングする)事例があるため、全操作にタイムアウトを設けて必ず結果を返す。
const IdbStore = (() => {
  const DB_NAME = 'jyuki_pdfs_db';
  const STORE = 'pdfs';
  const PLAN_STORE = 'plans';
  const DB_VERSION = 2;
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
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(PLAN_STORE)) db.createObjectStore(PLAN_STORE);
      };
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

  function putIn(storeName, key, value) {
    return getDb().then((db) => withTimeout(new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('保存トランザクションが中断されました'));
    }), 'put'));
  }

  function getFrom(storeName, key) {
    return getDb().then((db) => withTimeout(new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error || new Error('取得トランザクションが中断されました'));
    }), 'get'));
  }

  function removeFrom(storeName, key) {
    return getDb().then((db) => withTimeout(new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }), 'remove'));
  }

  const put = (key, blob) => putIn(STORE, key, blob);
  const get = (key) => getFrom(STORE, key);
  const remove = (key) => removeFrom(STORE, key);
  const putPlan = (key, plan) => putIn(PLAN_STORE, key, plan);
  const getPlan = (key) => getFrom(PLAN_STORE, key);
  const removePlan = (key) => removeFrom(PLAN_STORE, key);

  return { put, get, remove, putPlan, getPlan, removePlan };
})();
