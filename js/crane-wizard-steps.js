// クレーン計画書ウィザードのステップ定義(ヘッダー部+吊り荷計画部)
const CraneHeaderSteps = (() => {
  const { card, selectField, textField, textAreaWithHistory, chipGroup, nextBar, toast, field, el } = UI;

  // 業者ごとの入力履歴(最大5件)付きテキスト入力
  function textFieldWithHistory(container, { label, value, historyKey, onChange }) {
    const f = field(container, label);
    const inp = el('input', { type: 'text', value: value || '' });
    inp.addEventListener('input', () => onChange(inp.value));
    f.appendChild(inp);
    const hist = Storage.getHistory(historyKey).slice(0, 5);
    if (hist.length) {
      const list = el('div', { class: 'history-list' });
      hist.forEach((h) => {
        const chip = el('div', { class: 'history-chip', text: h });
        chip.addEventListener('click', () => { inp.value = h; onChange(h); });
        list.appendChild(chip);
      });
      f.appendChild(list);
    }
    return inp;
  }

  // 最大3名までの氏名入力(運転者名・玉掛者・合図者など)
  function nameTrio(container, names, label) {
    const f = field(container, label);
    ['1人目', '2人目', '3人目'].forEach((ph, i) => {
      const inp = el('input', { type: 'text', placeholder: `氏名（${ph}）`, value: names[i] || '', style: 'margin-bottom:6px;' });
      inp.addEventListener('input', () => { names[i] = inp.value; });
      f.appendChild(inp);
    });
  }

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
    { id: 'c3', title: 'クレーン業者・運転者名',
      render(container, ctx) {
        const c = card('クレーン業者・運転者名');
        textField(c, { label: 'クレーン業者（自由入力）', value: ctx.plan.header.craneGyosha, onChange: (v) => { ctx.plan.header.craneGyosha = v; refreshSelect(); refreshNames(); } });
        const selectWrap = el('div', {});
        c._body.appendChild(selectWrap);
        function refreshSelect() {
          selectWrap.innerHTML = '';
          selectField({ _body: selectWrap }, {
            label: 'クレーン業者（プルダウンから選択）', value: ctx.master.contractors.includes(ctx.plan.header.craneGyosha) ? ctx.plan.header.craneGyosha : '',
            options: ctx.master.contractors, onChange: (v) => { ctx.plan.header.craneGyosha = v; refreshSelect(); refreshNames(); },
          });
        }
        refreshSelect();

        const namesWrap = el('div', {});
        c._body.appendChild(namesWrap);
        function historyKeyFor() { return `crane_untensha_${ctx.plan.header.craneGyosha || '_none_'}`; }
        function refreshNames() {
          namesWrap.innerHTML = '';
          const names = ctx.plan.header.untenshaMei;
          const f = field({ _body: namesWrap }, '運転者名（最大3名。業者ごとの入力履歴から選択も可能）');
          const inputs = [];
          ['1人目', '2人目', '3人目'].forEach((ph, i) => {
            const inp = el('input', { type: 'text', placeholder: `氏名（${ph}）`, value: names[i] || '', style: 'margin-bottom:4px;' });
            inp.addEventListener('input', () => { names[i] = inp.value; });
            inputs.push(inp);
            f.appendChild(inp);
          });
          const hist = Storage.getHistory(historyKeyFor()).slice(0, 5);
          if (hist.length) {
            const list = el('div', { class: 'history-list' });
            hist.forEach((h) => {
              const chip = el('div', { class: 'history-chip', text: h });
              chip.addEventListener('click', () => {
                const emptyIdx = names.findIndex((n) => !n);
                const idx = emptyIdx === -1 ? 2 : emptyIdx;
                names[idx] = h;
                inputs[idx].value = h;
              });
              list.appendChild(chip);
            });
            f.appendChild(list);
          }
        }
        refreshNames();

        container.appendChild(c);
        nextBar(container, {
          onBack: ctx.goBack,
          onNext: () => {
            ctx.plan.header.untenshaMei.filter(Boolean).forEach((n) => Storage.pushHistory(historyKeyFor(), n));
            ctx.goNext();
          },
        });
      } },
    { id: 'c4', title: '作業予定時間・使用業者・作業場所・作業内容',
      render(container, ctx) {
        const w = ctx.plan.work;
        const c = card('作業予定時間・使用業者・作業場所・作業内容', '12時〜13時、24時〜翌1時をまたぐ場合はPDF上で自動的に2段書きになります');
        textField(c, { label: '作業予定時間 開始', type: 'time', value: w.yoteiJikanStart, onChange: (v) => { w.yoteiJikanStart = v; } });
        textField(c, { label: '作業予定時間 終了', type: 'time', value: w.yoteiJikanEnd, onChange: (v) => { w.yoteiJikanEnd = v; } });
        selectField(c, { label: '使用業者（プルダウン）', value: w.shiyoGyosha, options: ctx.master.contractors, onChange: (v) => { w.shiyoGyosha = v; } });
        selectField(c, { label: '作業場所（プルダウン）', value: w.basho, options: ctx.master.locations, onChange: (v) => { w.basho = v; } });
        textAreaWithHistory(c, { label: '作業内容', value: w.naiyo, historyKey: 'crane_naiyo', onChange: (v) => { w.naiyo = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'c5', title: '吊荷重量・作業半径・玉掛ワイヤーナイロンスリング',
      render(container, ctx) {
        const w = ctx.plan.work;
        const c = card('吊荷重量・作業半径・玉掛ワイヤーナイロンスリング');
        textField(c, { label: '吊荷重量 (t)', value: w.choKaJuryo, onChange: (v) => { w.choKaJuryo = v; } });
        textField(c, { label: '作業半径 (m)', value: w.sagyoHankei, onChange: (v) => { w.sagyoHankei = v; } });
        textField(c, { label: '玉掛ワイヤーナイロンスリング 径 (mm)', value: w.slingKei, onChange: (v) => { w.slingKei = v; } });
        textField(c, { label: '玉掛ワイヤーナイロンスリング 長 (m)', value: w.slingNagasa, onChange: (v) => { w.slingNagasa = v; } });
        textField(c, { label: '玉掛ワイヤーナイロンスリング 本数', value: w.slingHon, onChange: (v) => { w.slingHon = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'c6', title: '作業責任者・玉掛者・合図者',
      render(container, ctx) {
        const w = ctx.plan.work;
        const c = card('作業責任者・玉掛者・合図者');
        const sekininshaKey = `crane_sekininsha_${w.shiyoGyosha || '_none_'}`;
        textFieldWithHistory(c, { label: '作業責任者（業者ごとの入力履歴から選択も可能）', value: w.sekininsha, historyKey: sekininshaKey, onChange: (v) => { w.sekininsha = v; } });
        nameTrio(c, w.tamakakesha, '玉掛者（最大3名）');
        nameTrio(c, w.aizusha, '合図者（最大3名）');
        container.appendChild(c);
        nextBar(container, {
          onBack: ctx.goBack,
          onNext: () => { Storage.pushHistory(sekininshaKey, w.sekininsha); ctx.goNext(); },
        });
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
        chipGroup(c, { label: 'アウトリガー最大張出', value: s.outriggerJotai, options: ['不可:対策', '可', '無'], onChange: (v) => { s.outriggerJotai = v; renderOutriggerDetail(); } });
        const outriggerWrap = el('div', {});
        c._body.appendChild(outriggerWrap);
        function renderOutriggerDetail() {
          outriggerWrap.innerHTML = '';
          if (s.outriggerJotai === '不可:対策') {
            textField({ _body: outriggerWrap }, { label: '不可：対策（内容）', value: s.outriggerFukaDetail, onChange: (v) => { s.outriggerFukaDetail = v; } });
          }
        }
        renderOutriggerDetail();
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
        chipGroup(c3, {
          label: '架空線近接', value: s.kakusenKinsetsu.has === true ? '有' : (s.kakusenKinsetsu.has === false ? '無' : ''), options: ['有', '無'],
          onChange: (v) => { s.kakusenKinsetsu.has = v === '有'; renderKakusenSub(); },
        });
        const kakusenWrap = el('div', {});
        c3._body.appendChild(kakusenWrap);
        function renderKakusenSub() {
          kakusenWrap.innerHTML = '';
          if (!s.kakusenKinsetsu.has) return;
          chipGroup({ _body: kakusenWrap }, {
            label: '対策（複数選択可）', value: s.kakusenKinsetsu.hogo, multi: true, options: ['移設', '絶縁用防具', '監視員', 'その他'],
            onChange: (v) => { s.kakusenKinsetsu.hogo = v; renderKakusenOther(); },
          });
          const otherWrap = el('div', {});
          kakusenWrap.appendChild(otherWrap);
          function renderKakusenOther() {
            otherWrap.innerHTML = '';
            if (s.kakusenKinsetsu.hogo.includes('その他')) {
              textField({ _body: otherWrap }, { label: 'その他（内容）', value: s.kakusenKinsetsu.hogoOther, onChange: (v) => { s.kakusenKinsetsu.hogoOther = v; } });
            }
          }
          renderKakusenOther();
        }
        renderKakusenSub();
        container.appendChild(c3);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'c10', title: '元請担当者確認欄',
      render(container, ctx) {
        const c = card('元請担当者確認欄', '最大3名まで選択できます');
        const selected127 = ctx.plan.tantosha127.filter((x) => x);
        chipGroup(c, {
          label: '担当者（複数選択可・最大3名）', value: selected127, multi: true, options: MasterData.staffNames(),
          onChange: (v) => {
            if (v.length > 3) v.splice(3);
            ctx.plan.tantosha127 = [v[0] || '', v[1] || '', v[2] || ''];
          },
        });
        textField(c, { label: '協力会社確認者', value: ctx.plan.kyoryokuKakuninsha128, onChange: (v) => { ctx.plan.kyoryokuKakuninsha128 = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, nextLabel: '吊り荷計画の入力へ', onNext: () => ctx.goNext() });
      } },
  ];
  return steps;
})();

// 吊り荷計画(作業予定①②③、最大3回繰り返し)のステップ定義
const CraneLiftSteps = (() => {
  const { card, textField, chipGroup, nextBar, field, el } = UI;

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
        const c = card('作業半径時の定格総荷重・フック等重量・定格荷重', '定格荷重は「定格総荷重-フック等重量」で自動計算されます');
        textField(c, { label: '作業半径時の定格総荷重 (ton)', value: l.teikakuSokaJu, onChange: (v) => { l.teikakuSokaJu = v; recalc(); } });
        textField(c, { label: 'フック等重量 (ton)', value: l.hookJuryo, onChange: (v) => { l.hookJuryo = v; recalc(); } });
        const calcField = field(c, '作業半径時の定格荷重 (ton)（自動計算）');
        const calcDisplay = el('div', { style: 'padding:10px 12px;background:#f0f0f0;border-radius:8px;font-size:15px;min-height:20px;' });
        calcField.appendChild(calcDisplay);
        const calc90Field = field(c, '定格荷重×90% (ton)（自動計算）');
        const calc90Display = el('div', { style: 'padding:10px 12px;background:#f0f0f0;border-radius:8px;font-size:15px;min-height:20px;' });
        calc90Field.appendChild(calc90Display);
        function recalc() {
          const a = parseFloat(l.teikakuSokaJu);
          const b = parseFloat(l.hookJuryo);
          if (!isNaN(a) && !isNaN(b)) l.teikakuKaJu = String(Math.round((a - b) * 100) / 100);
          else l.teikakuKaJu = '';
          calcDisplay.textContent = l.teikakuKaJu || '（総荷重・フック等重量を入力すると自動計算されます）';
          const c138 = parseFloat(l.teikakuKaJu);
          if (!isNaN(c138)) l.teikaku90 = String(Math.round(c138 * 0.9 * 100) / 100);
          else l.teikaku90 = '';
          calc90Display.textContent = l.teikaku90 || '（定格荷重が確定すると自動計算されます）';
        }
        recalc();
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
        textField(c2, { label: '荷降ろし場所 位置および構造', value: l.ichiKozo, placeholder: '（例）荷台、平地など', onChange: (v) => { l.ichiKozo = v; } });
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

// 入力104(機種・性能)の登録数・機種・トン数を尋ねるステップ群。
// CraneHeaderSteps/CraneLiftStepsとは別に、crane-wizard.jsからフェーズ制御で直接呼び出す。
const CraneTypeSteps = (() => {
  const { card, chipGroup, textField, nextBar, toast, el } = UI;
  const CRANE_TYPE_OPTIONS = ['油圧式TC', 'ｸﾛｰﾗｰC', '車両車載C', '機械式TC', 'ｸﾛｰﾗｰﾀﾜｰC', 'その他'];

  function renderCount(container, ctx) {
    const c = card('登録するクレーンの機種数', '入力104(機種・性能)の枠を、登録する数に応じて分割します。');
    chipGroup(c, {
      label: '登録する数', value: ctx.plan.header.craneCount ? String(ctx.plan.header.craneCount) : '',
      options: ['1', '2', '3'],
      onChange: (v) => {
        const n = Number(v);
        ctx.plan.header.craneCount = n;
        const kept = ctx.plan.header.craneTypes || ['', '', ''];
        ctx.plan.header.craneTypes = [kept[0] || '', kept[1] || '', kept[2] || ''];
      },
    });
    container.appendChild(c);
    nextBar(container, {
      onBack: ctx.goBack,
      onNext: () => { if (!ctx.plan.header.craneCount) return toast('登録する数を選択してください'); ctx.goNext(); },
    });
  }

  function renderType(container, ctx) {
    const idx = ctx.craneTypeIndex;
    const presets = CRANE_TYPE_OPTIONS.slice(0, -1); // 'その他'を除く5種
    let current = ctx.plan.header.craneTypes[idx] || '';
    let otherSelected = current !== '' && !presets.includes(current);
    const c = card(`機種・性能（${idx + 1}台目）`, '一覧から選択してください（該当がなければ「その他」を選び、自由入力できます）');
    const otherWrap = el('div', {});
    function renderOtherField() {
      otherWrap.innerHTML = '';
      if (otherSelected) {
        textField({ _body: otherWrap }, {
          label: '機種（自由入力）', value: presets.includes(current) ? '' : current,
          placeholder: '（例）0.7BH',
          onChange: (v) => { current = v; ctx.plan.header.craneTypes[idx] = v; },
        });
      }
    }
    chipGroup(c, {
      label: '機種', value: presets.includes(current) ? current : (otherSelected ? 'その他' : ''), options: CRANE_TYPE_OPTIONS,
      onChange: (v) => {
        if (v === 'その他') { otherSelected = true; current = ''; ctx.plan.header.craneTypes[idx] = ''; }
        else { otherSelected = false; current = v; ctx.plan.header.craneTypes[idx] = v; }
        renderOtherField();
      },
    });
    c._body.appendChild(otherWrap);
    renderOtherField();
    container.appendChild(c);
    nextBar(container, {
      onBack: ctx.goBack,
      onNext: () => {
        if (!ctx.plan.header.craneTypes[idx]) return toast('機種を選択（または入力）してください');
        ctx.goNext();
      },
    });
  }

  function renderTonnage(container, ctx) {
    const idx = ctx.craneTypeIndex;
    const label = ctx.plan.header.craneTypes[idx] || '';
    const c = card(`何トン吊りですか？（${idx + 1}台目: ${label}）`);
    let tonnage = '';
    textField(c, { label: 'トン数', type: 'number', value: '', onChange: (v) => { tonnage = v; } });
    container.appendChild(c);
    nextBar(container, {
      onBack: ctx.goBack,
      onNext: () => {
        if (!tonnage) return toast('トン数を入力してください');
        ctx.plan.header.craneTypes[idx] = `${label} ${tonnage}吊`;
        ctx.goNext();
      },
    });
  }

  return { CRANE_TYPE_OPTIONS, renderCount, renderType, renderTonnage };
})();
