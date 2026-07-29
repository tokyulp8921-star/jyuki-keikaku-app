// クレーン計画書ウィザードのステップ定義(ヘッダー部+吊り荷計画部)
const CraneHeaderSteps = (() => {
  const { card, selectField, textField, textAreaWithHistory, chipGroup, nextBar, toast, field, el } = UI;

  const steps = [
    { id: 'c1', title: '業者名',
      render(container, ctx) {
        const c = card('業者名');
        selectField(c, { label: '業者名（プルダウン）', value: ctx.plan.header.gyoshamei, options: ctx.master.contractors, onChange: (v) => { ctx.plan.header.gyoshamei = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.hasBack ? ctx.goBack : null, onNext: () => { if (!ctx.plan.header.gyoshamei) return toast('業者名を選択してください'); ctx.goNext(); } });
      } },
    { id: 'c2', title: '打合日・作業日',
      render(container, ctx) {
        if (!ctx.plan.header.uchiawaseDate) {
          ctx.plan.header.uchiawaseDate = Holidays.fmt(new Date());
          ctx.plan.header.sagyobi = Holidays.nextBusinessDayAfter(ctx.plan.header.uchiawaseDate);
        }
        const c = card('打合日・作業日');
        textField(c, { label: '打合日（カレンダーから選択可）', type: 'date', value: ctx.plan.header.uchiawaseDate, onChange: (v) => { ctx.plan.header.uchiawaseDate = v; ctx.plan.header.sagyobi = Holidays.nextBusinessDayAfter(v); } });
        textField(c, { label: '作業日（自動計算・カレンダーで変更可）', type: 'date', value: ctx.plan.header.sagyobi, onChange: (v) => { ctx.plan.header.sagyobi = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => { if (!ctx.plan.header.uchiawaseDate) return toast('打合日を入力してください'); ctx.goNext(); } });
      } },
    { id: 'c3', title: '機種・性能・クレーン業者・運転者名',
      render(container, ctx) {
        const c = card('機種・性能・クレーン業者・運転者名');
        textField(c, { label: '機種・性能', value: ctx.plan.header.kishuSeino, onChange: (v) => { ctx.plan.header.kishuSeino = v; } });
        selectField(c, { label: 'クレーン業者（プルダウン）', value: ctx.plan.header.craneGyosha, options: ctx.master.contractors, onChange: (v) => { ctx.plan.header.craneGyosha = v; } });
        textField(c, { label: '運転者名', value: ctx.plan.header.untenshaMei, onChange: (v) => { ctx.plan.header.untenshaMei = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'c4', title: '作業予定時間・使用業者・作業場所・作業内容',
      render(container, ctx) {
        const w = ctx.plan.work;
        const c = card('作業予定時間・使用業者・作業場所・作業内容');
        textField(c, { label: '作業予定時間', value: w.yoteiJikan, onChange: (v) => { w.yoteiJikan = v; } });
        selectField(c, { label: '使用業者（プルダウン）', value: w.shiyoGyosha, options: ctx.master.contractors, onChange: (v) => { w.shiyoGyosha = v; } });
        selectField(c, { label: '作業場所（プルダウン）', value: w.basho, options: ctx.master.locations, onChange: (v) => { w.basho = v; } });
        textAreaWithHistory(c, { label: '作業内容', value: w.naiyo, historyKey: 'crane_naiyo', onChange: (v) => { w.naiyo = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'c5', title: '吊荷重量・作業半径・ナイロンスリング',
      render(container, ctx) {
        const w = ctx.plan.work;
        const c = card('吊荷重量・作業半径・ナイロンスリング');
        textField(c, { label: '吊荷重量 (t)', value: w.choKaJuryo, onChange: (v) => { w.choKaJuryo = v; } });
        textField(c, { label: '作業半径 (m)', value: w.sagyoHankei, onChange: (v) => { w.sagyoHankei = v; } });
        textField(c, { label: 'ナイロンスリング 径 (mm)', value: w.slingKei, onChange: (v) => { w.slingKei = v; } });
        textField(c, { label: 'ナイロンスリング 長 (m)', value: w.slingNagasa, onChange: (v) => { w.slingNagasa = v; } });
        textField(c, { label: 'ナイロンスリング 本数', value: w.slingHon, onChange: (v) => { w.slingHon = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'c6', title: '作業責任者・玉掛者・合図者',
      render(container, ctx) {
        const w = ctx.plan.work;
        const c = card('作業責任者・玉掛者・合図者');
        textField(c, { label: '作業責任者', value: w.sekininsha, onChange: (v) => { w.sekininsha = v; } });
        textField(c, { label: '玉掛者', value: w.tamakakesha, onChange: (v) => { w.tamakakesha = v; } });
        textField(c, { label: '合図者', value: w.aizusha, onChange: (v) => { w.aizusha = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'c7', title: '合図の方法・地形・地盤強度',
      render(container, ctx) {
        const s = ctx.plan.safety;
        const c = card('合図の方法・地形・地盤強度');
        chipGroup(c, { label: '合図の方法（複数選択可）', value: s.aizuHoho, multi: true, options: ['無線', '手合図', '笛'], onChange: (v) => { s.aizuHoho = v; } });
        chipGroup(c, { label: '地形', value: s.chikei, options: ['平地', '傾斜地'], onChange: (v) => { s.chikei = v; } });
        chipGroup(c, { label: '地盤強度', value: s.jibanKyodo, options: ['堅固', '普通', '軟弱', '埋設物'], onChange: (v) => { s.jibanKyodo = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'c8', title: '地盤養生・アウトリガー最大張出',
      render(container, ctx) {
        const s = ctx.plan.safety;
        const c = card('地盤養生・アウトリガー最大張出');
        chipGroup(c, { label: '地盤養生（複数選択可）', value: s.jibanYojo, multi: true, options: ['皿受け', '敷鉄板', '地盤改良', '良質盛土', '無'], onChange: (v) => { s.jibanYojo = v; } });
        chipGroup(c, { label: 'アウトリガー最大張出', value: s.outriggerJotai, options: ['不可:対策', '可', '無'], onChange: (v) => { s.outriggerJotai = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'c9', title: '立入禁止措置(クレーン周囲・吊荷下部)・架空線近接',
      render(container, ctx) {
        const s = ctx.plan.safety;
        const c = card('立入禁止措置(クレーン周囲)');
        chipGroup(c, { label: 'クレーン周囲（複数選択可）', value: s.creneShui, multi: true, options: ['バリケード', 'ロープ', 'カラーコーン'], onChange: (v) => { s.creneShui = v; } });
        container.appendChild(c);
        const c2 = card('立入禁止措置(吊荷下部)');
        chipGroup(c2, { label: '吊荷下部（複数選択可）', value: s.tsuriniKabu, multi: true, options: ['誘導員', '声', '笛', 'ブザー', 'カラーコーン', 'ロープ'], onChange: (v) => { s.tsuriniKabu = v; } });
        container.appendChild(c2);
        const c3 = card('架空線近接');
        chipGroup(c3, { label: '架空線近接（複数選択可）', value: s.kakusenKinsetsu, multi: true, options: ['有:対策', '移設', '絶縁用防具', '監視員', 'その他', '無'], onChange: (v) => { s.kakusenKinsetsu = v; } });
        container.appendChild(c3);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'c10', title: '元請担当者確認欄',
      render(container, ctx) {
        const c = card('元請担当者確認欄');
        selectField(c, { label: '担当者（プルダウン）', value: ctx.plan.tantosha127, options: MasterData.staffNames(), onChange: (v) => { ctx.plan.tantosha127 = v; } });
        textField(c, { label: '協力会社確認者', value: ctx.plan.kyoryokuKakuninsha128, onChange: (v) => { ctx.plan.kyoryokuKakuninsha128 = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, nextLabel: '吊り荷計画の入力へ', onNext: () => ctx.goNext() });
      } },
  ];
  return steps;
})();

// 吊り荷計画(作業予定①②③、最大3回繰り返し)のステップ定義
const CraneLiftSteps = (() => {
  const { card, textField, chipGroup, nextBar } = UI;

  const steps = [
    { id: 'l1', title: '吊り荷名称・必要な作業半径・高さ',
      render(container, ctx) {
        const l = ctx.lift;
        const c = card(`吊り荷計画（作業予定${ctx.liftIndex + 1}）: 吊り荷名称・必要な作業半径・高さ`);
        textField(c, { label: '吊り荷名称', value: l.tsuriniMeisho, onChange: (v) => { l.tsuriniMeisho = v; } });
        textField(c, { label: '必要な作業半径 (m)', value: l.hitsuyoHankei, onChange: (v) => { l.hitsuyoHankei = v; } });
        textField(c, { label: '必要な高さ ※地上揚程 (m)', value: l.hitsuyoTakasa, onChange: (v) => { l.hitsuyoTakasa = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'l2', title: '荷の総重量・1回の吊り重量',
      render(container, ctx) {
        const l = ctx.lift;
        const c = card('荷の総重量・1回の吊り重量');
        textField(c, { label: '荷の総重量 (ton)', value: l.niSoJuryo, onChange: (v) => { l.niSoJuryo = v; } });
        textField(c, { label: '1回の吊り重量 (ton)', value: l.ikkaiJuryo, onChange: (v) => { l.ikkaiJuryo = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'l3', title: 'ブームおよびジブの長さ',
      render(container, ctx) {
        const l = ctx.lift;
        const c = card('ブームおよびジブの長さ');
        textField(c, { label: 'ブームの長さ (m)', value: l.boomNagasa, onChange: (v) => { l.boomNagasa = v; } });
        textField(c, { label: 'ジブの長さ (m)', value: l.jibNagasa, onChange: (v) => { l.jibNagasa = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'l4', title: '定格総荷重・フック等重量・定格荷重',
      render(container, ctx) {
        const l = ctx.lift;
        const c = card('作業半径時の定格総荷重・フック等重量・定格荷重');
        textField(c, { label: '作業半径時の定格総荷重 (ton)', value: l.teikakuSokaJu, onChange: (v) => { l.teikakuSokaJu = v; } });
        textField(c, { label: 'フック等重量 (ton)', value: l.hookJuryo, onChange: (v) => { l.hookJuryo = v; } });
        textField(c, { label: '作業半径時の定格荷重 (ton)', value: l.teikakuKaJu, onChange: (v) => { l.teikakuKaJu = v; } });
        textField(c, { label: '定格荷重×90% (ton)', value: l.teikaku90, onChange: (v) => { l.teikaku90 = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'l5', title: '障害物の有無・位置および構造',
      render(container, ctx) {
        const l = ctx.lift;
        const c = card('障害物の有無（障害物の種類）');
        chipGroup(c, { label: '障害物の有無', value: l.shogaiHas === true ? '有' : (l.shogaiHas === false ? '無' : ''), options: ['有', '無'], onChange: (v) => { l.shogaiHas = v === '有'; renderShurui(); } });
        const wrap = document.createElement('div');
        c._body.appendChild(wrap);
        function renderShurui() {
          wrap.innerHTML = '';
          if (l.shogaiHas) textField({ _body: wrap }, { label: '障害物の種類（例: 電線・足場）', value: l.shogaiShurui, onChange: (v) => { l.shogaiShurui = v; } });
        }
        renderShurui();
        container.appendChild(c);
        const c2 = card('位置および構造');
        textField(c2, { label: '荷降ろし場所 位置および構造', value: l.ichiKozo, onChange: (v) => { l.ichiKozo = v; } });
        container.appendChild(c2);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'l6', title: '最大積載荷重・補強の必要性・荷の置き方',
      render(container, ctx) {
        const l = ctx.lift;
        const c = card('最大積載荷重・補強の必要性・バランスを考慮した荷の置き方');
        textField(c, { label: '最大積載荷重', value: l.saidaiSekisai, onChange: (v) => { l.saidaiSekisai = v; } });
        chipGroup(c, { label: '補強の必要性', value: l.hokyoHitsuyo, options: ['必要', '必要なし'], onChange: (v) => { l.hokyoHitsuyo = v; } });
        chipGroup(c, { label: 'バランスを考慮した荷の置き方', value: l.balanceKeikaku, options: ['計画した', 'しない'], onChange: (v) => { l.balanceKeikaku = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, nextLabel: '次へ', onNext: () => ctx.goNext() });
      } },
  ];
  return steps;
})();
