// 計画書(1PDF分)のデータモデルと生成ヘルパー
const PlanState = (() => {
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function newHeader() {
    return {
      gyoshamei: '', uchiawaseDate: '', uchiawaseTime: '', sagyobi: '', chuyabetsu: '',
      tantosha: ['', '', ''], sign9: '', gyoshamei2: '', sign11: '',
    };
  }

  function newMachine() {
    return {
      category: '', name: '',
      workStart: '', workEnd: '',
      capacity: '', owner: '', driver: '', location: '',
      content: '', method: '', safety: '', chiefSupervisor: '', director: '',
      aizusha: { has: null, names: ['', '', ''] },
      yudosha: { has: null, names: ['', '', ''] },
      aizuHoho: [], kikenHani: [],
      chikei: { type: '', angle: 20 },
      jiban: [],
      jibanYojo: '',
      maisetsu: { has: null, hogo: [], hogoOther: '' },
      kakuDenryoku: { has: null, distance: '', ridaku: '', hogo: [], hogoOther: '' },
      kakuDensha: { has: null, distance: '', ridaku: '', hogo: [], hogoOther: '' },
      tento: { has: null, boshi: '' },
    };
  }

  function newPlan(carryHeaderFrom) {
    return {
      id: uid(),
      docType: 'kiki', // 'kiki'=重機作業計画書 / 'crane'=クレーン計画書
      header: carryHeaderFrom ? JSON.parse(JSON.stringify(carryHeaderFrom)) : newHeader(),
      machines: [newMachine()],
      image: { dataUrl: '', rect: null },
      savedFileName: '',
      createdAt: Date.now(),
    };
  }

  function fileNameFor(plan, existingNames) {
    const ymd = Holidays.toYYMMDD(plan.header.sagyobi);
    const name = plan.header.gyoshamei || '未設定';
    const location = (plan.machines && plan.machines[0] && plan.machines[0].location) || '';
    const base = `${ymd}${name}${location}`;
    let final = base;
    let n = 1;
    const set = new Set(existingNames || []);
    while (set.has(final + '.pdf')) { final = `${base}${String(n).padStart(2, '0')}`; n++; }
    return final + '.pdf';
  }

  return { newHeader, newMachine, newPlan, fileNameFor };
})();
