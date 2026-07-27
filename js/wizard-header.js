// 共通ヘッダー(入力1〜11)のウィザードステップ定義
const HeaderSteps = (() => {
  const { card, selectField, textField, chipGroup, nextBar, toast } = UI;

  const steps = [
    { // 入力1 業者名
      id: 'h1', title: '業者名',
      render(container, ctx) {
        const c = card('入力1: 業者名');
        selectField(c, {
          label: '業者名（プルダウン）', value: ctx.plan.header.gyoshamei,
          options: ctx.master.contractors,
          onChange: (v) => { ctx.plan.header.gyoshamei = v; },
        });
        container.appendChild(c);
        nextBar(container, {
          onBack: ctx.hasBack ? ctx.goBack : null,
          onNext: () => {
            if (!ctx.plan.header.gyoshamei) return toast('業者名を選択してください');
            ctx.goNext();
          },
        });
      },
    },
    { // 入力2 打合せ日時 → 入力4 自動計算
      id: 'h2', title: '打合せ日時',
      render(container, ctx) {
        const c = card('入力2: 打合せ日時');
        textField(c, {
          label: '打合せ日（カレンダーから選択可）', type: 'date', value: ctx.plan.header.uchiawaseDate,
          onChange: (v) => {
            ctx.plan.header.uchiawaseDate = v;
            ctx.plan.header.sagyobi = Holidays.nextBusinessDayAfter(v);
          },
        });
        container.appendChild(c);
        nextBar(container, {
          onBack: ctx.goBack,
          onNext: () => {
            if (!ctx.plan.header.uchiawaseDate) return toast('打合せ日を入力してください');
            ctx.plan.header.sagyobi = Holidays.nextBusinessDayAfter(ctx.plan.header.uchiawaseDate);
            ctx.goNext();
          },
        });
      },
    },
    { // 作業日(自動) + 昼夜別
      id: 'h3', title: '作業日・昼夜別',
      render(container, ctx) {
        const c = card('入力4: 作業日', '打合せ日の翌日を自動計算します（土日祝日の場合は次の平日）。カレンダーから手動で変更することもできます。');
        textField(c, {
          label: '作業日（自動計算・カレンダーで変更可）', type: 'date', value: ctx.plan.header.sagyobi,
          onChange: (v) => { ctx.plan.header.sagyobi = v; },
        });
        container.appendChild(c);

        const c2 = card('入力5: 昼夜別');
        chipGroup(c2, {
          label: '昼夜別', value: ctx.plan.header.chuyabetsu, options: ['昼', '夜'],
          onChange: (v) => { ctx.plan.header.chuyabetsu = v; },
        });
        container.appendChild(c2);

        nextBar(container, {
          onBack: ctx.goBack,
          onNext: () => {
            if (!ctx.plan.header.chuyabetsu) return toast('昼夜別を選択してください');
            ctx.goNext();
          },
        });
      },
    },
    { // 入力6,7,8 担当者(最大3名)
      id: 'h4', title: '担当者',
      render(container, ctx) {
        const c = card('入力6・7・8: 担当者', '最大3名まで選択できます（1名の場合は2・3人目は空欄になります）');
        const selected = ctx.plan.header.tantosha.filter((x) => x);
        chipGroup(c, {
          label: '担当者（複数選択可・最大3名）', value: selected, multi: true,
          options: ctx.master.staff,
          onChange: (v) => {
            if (v.length > 3) v.splice(3);
            ctx.plan.header.tantosha = [v[0] || '', v[1] || '', v[2] || ''];
          },
        });
        container.appendChild(c);
        nextBar(container, {
          onBack: ctx.goBack,
          onNext: () => ctx.goNext(),
        });
      },
    },
    { // 入力9 署名(1次業者)
      id: 'h5', title: '署名（1次業者名）',
      render(container, ctx) {
        const c = card('入力9: 手書き署名（1次業者名）');
        container.appendChild(c); // キャンバスのサイズ計測が正しく行えるよう、DOM接続後にsignature padを作る
        const pad = createSignaturePad(c._body);
        if (ctx.plan.header.sign9) pad.loadDataURL(ctx.plan.header.sign9);
        nextBar(container, {
          onBack: ctx.goBack,
          onNext: () => { ctx.plan.header.sign9 = pad.isEmpty() ? '' : pad.toDataURL(); ctx.goNext(); },
        });
      },
    },
    { // 入力10 2次業者名
      id: 'h6', title: '2次業者名',
      render(container, ctx) {
        const c = card('入力10: 2次業者名', `入力1で選択した「${ctx.plan.header.gyoshamei}」に登録されている2次業者名から選択します。`);
        selectField(c, {
          label: '2次業者名（プルダウン）', value: ctx.plan.header.gyoshamei2,
          options: MasterData.secondTierFor(ctx.plan.header.gyoshamei),
          onChange: (v) => { ctx.plan.header.gyoshamei2 = v; },
        });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      },
    },
    { // 入力11 署名(2次業者)
      id: 'h7', title: '署名（2次業者名）',
      render(container, ctx) {
        const c = card('入力11: 手書き署名（2次業者名）');
        container.appendChild(c); // キャンバスのサイズ計測が正しく行えるよう、DOM接続後にsignature padを作る
        const pad = createSignaturePad(c._body);
        if (ctx.plan.header.sign11) pad.loadDataURL(ctx.plan.header.sign11);
        nextBar(container, {
          onBack: ctx.goBack, nextLabel: '機械情報の入力へ',
          onNext: () => { ctx.plan.header.sign11 = pad.isEmpty() ? '' : pad.toDataURL(); ctx.goNext(); },
        });
      },
    },
  ];
  return steps;
})();
