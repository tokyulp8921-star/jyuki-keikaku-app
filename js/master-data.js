// マスタデータ(業者名・担当者・機械カテゴリ等)の読込・保存。Excel初期値 + ローカル編集をマージする。
const MasterData = (() => {
  let data = null;

  async function load() {
    if (data) return data;
    const res = await fetch(`data/master.json?v=${Date.now()}`, { cache: 'no-store' });
    const base = await res.json();
    const local = Storage.getMasterLocal();
    data = local ? local : base;
    migrateSecondTier();
    migrateStaff();
    migrateDrivers();
    return data;
  }

  // 旧形式(secondTierの単純リスト)からの移行、および未登録業者名分の初期化
  function migrateSecondTier() {
    if (!data.secondTierByContractor) data.secondTierByContractor = {};
    delete data.secondTier;
    (data.contractors || []).forEach((name) => {
      if (!data.secondTierByContractor[name]) data.secondTierByContractor[name] = [];
    });
  }

  // 旧形式(staffが氏名の単純リスト)から {name, email} 形式への移行
  function migrateStaff() {
    if (!Array.isArray(data.staff)) { data.staff = []; return; }
    data.staff = data.staff.map((s) => (typeof s === 'string' ? { name: s, email: '' } : s));
  }

  // 旧形式(driversの単純リスト、または所有者ごとの形式)からの移行、および未登録業者名分の初期化
  function migrateDrivers() {
    if (!data.driversByContractor) data.driversByContractor = data.driversByOwner || {};
    delete data.drivers;
    delete data.driversByOwner;
    (data.contractors || []).forEach((name) => {
      if (!data.driversByContractor[name]) data.driversByContractor[name] = [];
    });
  }

  function get() { return data; }

  async function save(newData) {
    data = newData;
    Storage.saveMasterLocal(newData);
    if (window.Dropbox && Dropbox.isLinked && Dropbox.isLinked()) {
      try { await Dropbox.uploadMasterJson(newData); } catch (e) { console.warn('master sync failed', e); }
    }
    return data;
  }

  // カテゴリ名から機械名一覧を取得
  function machinesFor(category) {
    if (!data || !category) return [];
    return data.machinesByCategory[category] || [];
  }

  function addToList(listKey, value) {
    if (!value || !value.trim()) return;
    if (!data[listKey]) data[listKey] = [];
    if (!data[listKey].includes(value)) data[listKey].push(value);
    save(data);
  }

  function removeFromList(listKey, value) {
    if (!data[listKey]) return;
    data[listKey] = data[listKey].filter((v) => v !== value);
    save(data);
  }

  function addMachine(category, name) {
    if (!data.machinesByCategory[category]) data.machinesByCategory[category] = [];
    if (!data.machinesByCategory[category].includes(name)) data.machinesByCategory[category].push(name);
    save(data);
  }

  function removeMachine(category, name) {
    if (!data.machinesByCategory[category]) return;
    data.machinesByCategory[category] = data.machinesByCategory[category].filter((v) => v !== name);
    save(data);
  }

  // 1次業者名から2次業者名一覧を取得
  function secondTierFor(contractor) {
    if (!data || !contractor) return [];
    return data.secondTierByContractor[contractor] || [];
  }

  function addSecondTier(contractor, name) {
    if (!data.secondTierByContractor[contractor]) data.secondTierByContractor[contractor] = [];
    if (!data.secondTierByContractor[contractor].includes(name)) data.secondTierByContractor[contractor].push(name);
    save(data);
  }

  function removeSecondTier(contractor, name) {
    if (!data.secondTierByContractor[contractor]) return;
    data.secondTierByContractor[contractor] = data.secondTierByContractor[contractor].filter((v) => v !== name);
    save(data);
  }

  // 担当者(staff)は {name, email} のオブジェクト配列
  function staffNames() {
    return (data.staff || []).map((s) => s.name);
  }

  function staffEmailFor(name) {
    const s = (data.staff || []).find((x) => x.name === name);
    return s ? s.email : '';
  }

  function addStaff(name, email) {
    if (!name || !name.trim()) return;
    if (!data.staff) data.staff = [];
    const existing = data.staff.find((s) => s.name === name);
    if (existing) existing.email = email || '';
    else data.staff.push({ name: name.trim(), email: (email || '').trim() });
    save(data);
  }

  function removeStaff(name) {
    data.staff = (data.staff || []).filter((s) => s.name !== name);
    save(data);
  }

  // 業者名(1次業者)ごとの運転者候補
  function driversFor(contractor) {
    if (!data || !contractor) return [];
    return data.driversByContractor[contractor] || [];
  }

  function addDriver(contractor, name) {
    if (!data.driversByContractor[contractor]) data.driversByContractor[contractor] = [];
    if (!data.driversByContractor[contractor].includes(name)) data.driversByContractor[contractor].push(name);
    save(data);
  }

  function removeDriver(contractor, name) {
    if (!data.driversByContractor[contractor]) return;
    data.driversByContractor[contractor] = data.driversByContractor[contractor].filter((v) => v !== name);
    save(data);
  }

  return {
    load, get, save, machinesFor, addToList, removeFromList, addMachine, removeMachine,
    secondTierFor, addSecondTier, removeSecondTier,
    staffNames, staffEmailFor, addStaff, removeStaff,
    driversFor, addDriver, removeDriver,
  };
})();
