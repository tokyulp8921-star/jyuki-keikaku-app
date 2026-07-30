// クレーン計画書(1PDF分)のデータモデルと生成ヘルパー
const CranePlanState = (() => {
  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function newHeader() {
    return {
      uchiawaseDate: '', sagyobi: '', gyoshamei: '',
      craneCount: null, craneTypes: ['', '', ''], // 入力104: 機種・性能(登録数に応じて枠内を分割)
      craneGyosha: '', untenshaMei: ['', '', ''], // 運転者名(最大3名)
    };
  }

  function newWork() {
    return {
      yoteiJikanStart: '', yoteiJikanEnd: '', shiyoGyosha: '', basho: '', naiyo: '',
      choKaJuryo: '', sagyoHankei: '',
      slingKei: '', slingNagasa: '', slingHon: '',
      sekininsha: '', tamakakesha: ['', '', ''], aizusha: ['', '', ''], // 玉掛者・合図者(最大3名)
    };
  }

  function newSafety() {
    return {
      aizuHoho: [], chikei: '', jibanKyodo: '', jibanYojo: [],
      outriggerJotai: '', outriggerFukaDetail: '', creneShui: [], tsuriniKabu: [],
      kakusenKinsetsu: { has: null, hogo: [], hogoOther: '' },
    };
  }

  function newLift() {
    return {
      tsuriniMeisho: '', hitsuyoHankei: '', hitsuyoTakasa: '',
      niSoJuryo: '', ikkaiJuryo: '',
      boomNagasa: '', jibNagasa: '',
      teikakuSokaJu: '', hookJuryo: '', teikakuKaJu: '', teikaku90: '',
      shogaiHas: null, shogaiShurui: '',
      ichiKozo: '', saidaiSekisai: '',
      hokyoHitsuyo: '', balanceKeikaku: '',
    };
  }

  function newPlan() {
    return {
      id: uid(),
      docType: 'crane',
      header: newHeader(),
      work: newWork(),
      safety: newSafety(),
      lifts: [newLift()],
      tantosha127: ['', '', ''], kyoryokuKakuninsha128: '',
      image: { dataUrl: '', rect: null },
      savedFileName: '',
      createdAt: Date.now(),
    };
  }

  function fileNameFor(plan, existingNames) {
    const ymd = Holidays.toYYMMDD(plan.header.sagyobi);
    const name = plan.header.gyoshamei || '未設定';
    const base = `${ymd}${name}クレーン`;
    let final = base;
    let n = 1;
    const set = new Set(existingNames || []);
    while (set.has(final + '.pdf')) { final = `${base}${String(n).padStart(2, '0')}`; n++; }
    return final + '.pdf';
  }

  return { newHeader, newWork, newSafety, newLift, newPlan, fileNameFor };
})();
