// 機械ブロック(入力12〜38相当)のウィザードステップ定義。機械1・2・3すべて同じフル項目を繰り返す。
const MachineSteps = (() => {
  const { card, selectField, textField, textAreaWithHistory, chipGroup, nextBar, toast, field, el } = UI;

  function haveNoField(container, m, key, subKey, labelHave, opts) {
    // 有/無 + (有の場合の)追加フィールドを1ステップで扱う共通処理
    const c = card(opts.title, opts.hint);
    const state = m[key];
    let extraWrap = el('div', {});
    function renderExtra() {
      extraWrap.innerHTML = '';
      if (state.has) opts.renderExtra(extraWrap, state);
    }
    chipGroup(c, {
      label: labelHave, value: state.has === true ? '有' : (state.has === false ? '無' : ''),
      options: ['有', '無'],
      onChange: (v) => { state.has = v === '有'; renderExtra(); },
    });
    c._body.appendChild(extraWrap);
    renderExtra();
    container.appendChild(c);
  }

  function nameTrio(container, names, label) {
    const f = field(container, label);
    ['1人目', '2人目', '3人目'].forEach((ph, i) => {
      const inp = el('input', { type: 'text', placeholder: `氏名（${ph}）`, value: names[i] || '', style: 'margin-bottom:6px;' });
      inp.addEventListener('input', () => { names[i] = inp.value; });
      f.appendChild(inp);
    });
  }

  const steps = [
    { id: 'm-category', title: '対象機械',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card(`対象機械（機械${ctx.machineIndex + 1}）`);
        selectField(c, {
          label: '対象機械カテゴリ', value: m.category, options: ctx.master.machineCategories,
          onChange: (v) => { m.category = v; m.name = ''; render2(); },
        });
        const nameField = el('div', {});
        c._body.appendChild(nameField);
        function render2() {
          nameField.innerHTML = '';
          const opts = MasterData.machinesFor(m.category);
          selectField({ _body: nameField }, {
            label: '機械名称', value: m.name, options: opts,
            onChange: (v) => { m.name = v; },
          });
        }
        if (m.category) render2();
        container.appendChild(c);
        nextBar(container, {
          onBack: ctx.goBack,
          onNext: () => { if (!m.category) return toast('対象機械カテゴリを選択してください'); ctx.goNext(); },
        });
      } },
    { id: 'm-time', title: '作業予定時間',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('作業予定時間', '12時〜13時、24時〜翌1時をまたぐ場合はPDF上で自動的に2段書きになります');
        textField(c, { label: '開始時刻', type: 'time', value: m.workStart, onChange: (v) => { m.workStart = v; } });
        textField(c, { label: '終了時刻', type: 'time', value: m.workEnd, onChange: (v) => { m.workEnd = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'm-capacity', title: '使用能力',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('使用能力');
        textField(c, { label: '使用能力', value: m.capacity, onChange: (v) => { m.capacity = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'm-owner', title: '所有者',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('所有者');
        selectField(c, { label: '所有者', value: m.owner, options: ctx.master.owners, onChange: (v) => { m.owner = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'm-driver', title: '運転者',
      render(container, ctx) {
        const m = ctx.machine;
        const driverOpts = MasterData.driversFor(m.owner);
        const c = card('運転者', m.owner ? `「${m.owner}」に登録されている運転者候補から選択、または自由入力できます` : 'プルダウン選択、または自由入力できます');
        selectField(c, { label: '運転者（候補）', value: driverOpts.includes(m.driver) ? m.driver : '', options: driverOpts, onChange: (v) => { m.driver = v; refreshText(); } });
        const txt = el('div', {});
        c._body.appendChild(txt);
        function refreshText() {
          txt.innerHTML = '';
          textField({ _body: txt }, { label: '運転者（自由入力）', value: m.driver, onChange: (v) => { m.driver = v; } });
        }
        refreshText();
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'm-location', title: '使用場所',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('使用場所');
        selectField(c, { label: '使用場所', value: m.location, options: ctx.master.locations, onChange: (v) => { m.location = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'm-content', title: '作業内容',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('作業内容');
        textAreaWithHistory(c, { label: '作業内容', value: m.content, historyKey: 'content', onChange: (v) => { m.content = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => { Storage.pushHistory('content', m.content); ctx.goNext(); } });
      } },
    { id: 'm-method', title: '作業方法',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('作業方法');
        textAreaWithHistory(c, { label: '作業方法', value: m.method, historyKey: 'method', onChange: (v) => { m.method = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => { Storage.pushHistory('method', m.method); ctx.goNext(); } });
      } },
    { id: 'm-safety', title: '安全対策',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('安全対策（予測危険に対する措置内容）');
        textAreaWithHistory(c, { label: '安全対策', value: m.safety, historyKey: 'safety', onChange: (v) => { m.safety = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => { Storage.pushHistory('safety', m.safety); ctx.goNext(); } });
      } },
    { id: 'm-chief', title: '作業主任者',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('作業主任者（法定）');
        textAreaWithHistory(c, { label: '作業主任者', value: m.chiefSupervisor, historyKey: 'chief', onChange: (v) => { m.chiefSupervisor = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => { Storage.pushHistory('chief', m.chiefSupervisor); ctx.goNext(); } });
      } },
    { id: 'm-director', title: '作業指揮者',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('作業指揮者（法定）');
        textAreaWithHistory(c, { label: '作業指揮者', value: m.director, historyKey: 'director', onChange: (v) => { m.director = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => { Storage.pushHistory('director', m.director); ctx.goNext(); } });
      } },
    { id: 'm-aizusha', title: '合図者',
      render(container, ctx) {
        const m = ctx.machine;
        haveNoField(container, m, 'aizusha', null, '合図者', {
          title: '合図者', hint: '有の場合、氏名を最大3名まで入力できます（1〜2名のみでも次へ進めます）',
          renderExtra: (wrap, state) => nameTrio(wrap, state.names, '氏名'),
        });
        nextBar(container, {
          onBack: ctx.goBack,
          onNext: () => { if (m.aizusha.has === null) return toast('有／無を選択してください'); ctx.goNext(); },
        });
      } },
    { id: 'm-yudosha', title: '誘導者/監視員',
      render(container, ctx) {
        const m = ctx.machine;
        haveNoField(container, m, 'yudosha', null, '誘導者/監視員', {
          title: '誘導者/監視員', hint: '有の場合、氏名を最大3名まで入力できます（1〜2名のみでも次へ進めます）',
          renderExtra: (wrap, state) => nameTrio(wrap, state.names, '氏名'),
        });
        nextBar(container, {
          onBack: ctx.goBack,
          onNext: () => { if (m.yudosha.has === null) return toast('有／無を選択してください'); ctx.goNext(); },
        });
      } },
    { id: 'm-aizuhoho', title: '合図方法',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('合図方法', '複数選択可能です');
        chipGroup(c, { label: '合図方法', value: m.aizuHoho, multi: true, options: ['手', '笛', '旗', '無線'], onChange: (v) => { m.aizuHoho = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'm-kikenhani', title: '危険範囲立入禁止措置',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('危険範囲立入禁止措置', '複数選択可能です');
        chipGroup(c, { label: '措置', value: m.kikenHani, multi: true, options: ['監視員', 'バリケード', 'トラロープ', 'カラーコーン', '警報装置'], onChange: (v) => { m.kikenHani = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'm-chikei', title: '地形',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('地形');
        const angleWrap = el('div', {});
        chipGroup(c, {
          label: '地形', value: m.chikei.type, options: ['平地', '傾斜地', '段差地', '作業面'],
          onChange: (v) => { m.chikei.type = v; renderAngle(); },
        });
        c._body.appendChild(angleWrap);
        function renderAngle() {
          angleWrap.innerHTML = '';
          if (m.chikei.type === '傾斜地') {
            const f = field({ _body: angleWrap }, `傾斜角度: ${m.chikei.angle}度`);
            const input = el('input', { type: 'range', min: 0, max: 45, step: 2, value: m.chikei.angle });
            input.addEventListener('input', () => { m.chikei.angle = Number(input.value); f.querySelector('.field-label').textContent = `傾斜角度: ${input.value}度`; });
            f.appendChild(input);
          }
        }
        renderAngle();
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'm-jiban', title: '地盤',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('地盤', '複数選択可能です');
        chipGroup(c, { label: '地盤', value: m.jiban, multi: true, options: ['硬岩', '軟岩', '礫', 'シルト', '粘性土', '砂礫', '泥炭', 'コンクリート', 'アスファルト'], onChange: (v) => { m.jiban = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'm-jibanyojo', title: '地盤養生',
      render(container, ctx) {
        const m = ctx.machine;
        const c = card('地盤養生');
        chipGroup(c, { label: '地盤養生', value: m.jibanYojo, options: ['敷き鉄板', '地盤改良', '無'], onChange: (v) => { m.jibanYojo = v; } });
        container.appendChild(c);
        nextBar(container, { onBack: ctx.goBack, onNext: () => ctx.goNext() });
      } },
    { id: 'm-maisetsu', title: '埋設物',
      render(container, ctx) {
        const m = ctx.machine;
        haveNoField(container, m, 'maisetsu', null, '埋設物', {
          title: '埋設物', hint: '有の場合、防護の方法を選択してください',
          renderExtra: (wrap, state) => {
            chipGroup(wrap, { label: '防護の方法', value: state.hogo, multi: true, options: ['移設', '監視員', 'その他'], onChange: (v) => { state.hogo = v; renderOther(); } });
            const otherWrap = el('div', {});
            wrap.appendChild(otherWrap);
            function renderOther() {
              otherWrap.innerHTML = '';
              if (state.hogo.includes('その他')) textField({ _body: otherWrap }, { label: 'その他（内容）', value: state.hogoOther, onChange: (v) => { state.hogoOther = v; } });
            }
            renderOther();
          },
        });
        nextBar(container, { onBack: ctx.goBack, onNext: () => { if (m.maisetsu.has === null) return toast('有／無を選択してください'); ctx.goNext(); } });
      } },
    { id: 'm-kakudenryoku', title: '架空線近接(電力)',
      render(container, ctx) {
        const m = ctx.machine;
        haveNoField(container, m, 'kakuDenryoku', null, '架空線近接(電力)', {
          title: '架空線近接（電力）', hint: '有の場合、距離・離隔・防護の方法を入力してください',
          renderExtra: (wrap, state) => {
            const f = field({ _body: wrap }, '距離(m) / 離隔(m)');
            const row = el('div', { style: 'display:flex;gap:8px;' });
            const d = el('input', { type: 'number', placeholder: '距離m', value: state.distance || '' });
            const r = el('input', { type: 'number', placeholder: '離隔m', value: state.ridaku || '' });
            d.addEventListener('input', () => { state.distance = d.value; });
            r.addEventListener('input', () => { state.ridaku = r.value; });
            row.appendChild(d); row.appendChild(r);
            f.appendChild(row);
            chipGroup(wrap, { label: '防護の方法', value: state.hogo, multi: true, options: ['移設', '絶縁用防具', '監視員', 'その他'], onChange: (v) => { state.hogo = v; renderOther(); } });
            const otherWrap = el('div', {});
            wrap.appendChild(otherWrap);
            function renderOther() {
              otherWrap.innerHTML = '';
              if (state.hogo.includes('その他')) textField({ _body: otherWrap }, { label: 'その他（内容）', value: state.hogoOther, onChange: (v) => { state.hogoOther = v; } });
            }
            renderOther();
          },
        });
        nextBar(container, { onBack: ctx.goBack, onNext: () => { if (m.kakuDenryoku.has === null) return toast('有／無を選択してください'); ctx.goNext(); } });
      } },
    { id: 'm-kakudensha', title: '架空線近接(電車)',
      render(container, ctx) {
        const m = ctx.machine;
        haveNoField(container, m, 'kakuDensha', null, '架空線近接(電車)', {
          title: '架空線近接（電車）', hint: '有の場合、距離・離隔・防護の方法を入力してください',
          renderExtra: (wrap, state) => {
            const f = field({ _body: wrap }, '距離(m) / 離隔(m)');
            const row = el('div', { style: 'display:flex;gap:8px;' });
            const d = el('input', { type: 'number', placeholder: '距離m', value: state.distance || '' });
            const r = el('input', { type: 'number', placeholder: '離隔m', value: state.ridaku || '' });
            d.addEventListener('input', () => { state.distance = d.value; });
            r.addEventListener('input', () => { state.ridaku = r.value; });
            row.appendChild(d); row.appendChild(r);
            f.appendChild(row);
            chipGroup(wrap, { label: '防護の方法', value: state.hogo, multi: true, options: ['移設', '絶縁用防具', '監視員', 'その他'], onChange: (v) => { state.hogo = v; renderOther(); } });
            const otherWrap = el('div', {});
            wrap.appendChild(otherWrap);
            function renderOther() {
              otherWrap.innerHTML = '';
              if (state.hogo.includes('その他')) textField({ _body: otherWrap }, { label: 'その他（内容）', value: state.hogoOther, onChange: (v) => { state.hogoOther = v; } });
            }
            renderOther();
          },
        });
        nextBar(container, { onBack: ctx.goBack, onNext: () => { if (m.kakuDensha.has === null) return toast('有／無を選択してください'); ctx.goNext(); } });
      } },
    { id: 'm-tento', title: '機械転倒危険場所',
      render(container, ctx) {
        const m = ctx.machine;
        haveNoField(container, m, 'tento', null, '機械転倒危険場所', {
          title: '機械転倒危険場所', hint: '有の場合、転倒防止措置を入力してください',
          renderExtra: (wrap, state) => textField({ _body: wrap }, { label: '転倒防止措置', value: state.boshi, onChange: (v) => { state.boshi = v; } }),
        });
        nextBar(container, {
          onBack: ctx.goBack, nextLabel: 'この機械の入力を完了',
          onNext: () => { if (m.tento.has === null) return toast('有／無を選択してください'); ctx.goNext(); },
        });
      } },
  ];
  return steps;
})();
