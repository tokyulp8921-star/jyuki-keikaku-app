// ウィザードエンジン: 共通ヘッダー→機械ブロック(繰り返し)→画像挿入→保存 の流れを制御する
const Wizard = (() => {
  let root = null;
  let plan = null;
  let phase = 'header'; // header | machine | confirmNext | image | saving | done
  let stepIdx = 0;
  let machineIndex = 0;
  let pendingNextPlanAfterSave = false;
  let master = null;
  let lastError = '';
  let reuseMode = false; // 再利用時: 入力2・入力3(打合せ日時・作業日昼夜別)だけ確認させ、完了後は保存前確認へ直行する

  function ctxBase() {
    return {
      plan,
      master,
      machine: plan.machines[machineIndex],
      machineIndex,
      goNext: () => { stepIdx++; renderCurrent(); },
      goBack: () => { stepIdx--; renderCurrent(); },
      hasBack: stepIdx > 0,
    };
  }

  function totalHeaderSteps() { return HeaderSteps.length; }
  function totalMachineSteps() { return MachineSteps.length; }

  function saveDraftNow() { Storage.saveDraft({ plan, phase, stepIdx, machineIndex, pendingNextPlanAfterSave }); }

  function renderCurrent() {
    root.innerHTML = '';
    saveDraftNow();
    if (phase === 'header') {
      if (reuseMode && stepIdx > 2) { reuseMode = false; phase = 'confirmName'; return renderCurrent(); }
      if (stepIdx >= totalHeaderSteps()) { phase = 'machine'; stepIdx = 0; return renderCurrent(); }
      UI.progress(root, stepIdx + 1, totalHeaderSteps() + totalMachineSteps(), `共通情報 ${stepIdx + 1}/${totalHeaderSteps()}`);
      const ctx = ctxBase();
      ctx.goBack = stepIdx > 0 ? () => { stepIdx--; renderCurrent(); } : null;
      HeaderSteps[stepIdx].render(root, ctx);
      return;
    }
    if (phase === 'machine') {
      if (stepIdx >= totalMachineSteps()) { phase = 'confirmNext'; return renderCurrent(); }
      UI.progress(root, totalHeaderSteps() + stepIdx + 1, totalHeaderSteps() + totalMachineSteps(),
        `機械${machineIndex + 1}の入力 ${stepIdx + 1}/${totalMachineSteps()}`);
      const ctx = ctxBase();
      ctx.goBack = () => {
        if (stepIdx > 0) { stepIdx--; renderCurrent(); }
        else if (machineIndex === 0) { phase = 'header'; stepIdx = totalHeaderSteps() - 1; renderCurrent(); }
        else { toast_back(); }
      };
      MachineSteps[stepIdx].render(root, ctx);
      return;
    }
    if (phase === 'confirmNext') {
      const c = UI.card('次の機械を登録しますか？');
      const row = UI.el('div', { class: 'btn-row', style: 'padding:0 14px 14px;' });
      const yes = UI.el('button', { class: 'btn btn-primary', text: '次の機械を登録する' });
      const no = UI.el('button', { class: 'btn btn-secondary', text: 'しない（画像挿入へ）' });
      yes.addEventListener('click', () => {
        if (machineIndex < 2) {
          plan.machines.push(PlanState.newMachine());
          machineIndex++;
          stepIdx = 0;
          phase = 'machine';
        } else {
          // 3機械目まで完了→このPDFは保存し、新しいPDF(ヘッダー引継ぎ)で機械1から再開
          pendingNextPlanAfterSave = true;
          phase = 'image';
        }
        renderCurrent();
      });
      no.addEventListener('click', () => { phase = 'image'; renderCurrent(); });
      row.appendChild(yes); row.appendChild(no);
      c._body.appendChild(row);
      root.appendChild(c);
      return;
    }
    if (phase === 'image') { return renderImageStep(); }
    if (phase === 'confirmName') { return renderConfirmNameStep(); }
    if (phase === 'saving') {
      root.appendChild(UI.el('div', { class: 'empty-state', text: 'PDFを生成・保存しています…' }));
      return;
    }
    if (phase === 'done') { return renderDoneScreen(); }
  }

  function toast_back() { UI.toast('これ以上戻れません'); }

  let pendingImage = null; // {dataUrl, naturalW, naturalH}
  function renderImageStep() {
    if (lastError) {
      const errCard = UI.el('div', { class: 'card', style: 'border:1.5px solid var(--danger);' });
      errCard.appendChild(UI.el('div', { class: 'card-title', style: 'color:var(--danger);background:#fdeceb;', text: 'PDF生成でエラーが発生しました' }));
      const body = UI.el('div', { class: 'field' });
      body.appendChild(UI.el('div', { style: 'font-size:12.5px;color:var(--danger);word-break:break-all;white-space:pre-wrap;', text: lastError }));
      const hint = UI.el('div', { class: 'hint', text: 'この内容をそのままコピーして開発者に伝えてください。' });
      body.appendChild(hint);
      errCard.appendChild(body);
      root.appendChild(errCard);
    }
    const c = UI.card('画像挿入', '作業計画図・現場写真などを挿入します（赤枠のサイズに合わせて配置されます）');
    const pickRow = UI.el('div', { class: 'btn-row' });
    const fileBtn = UI.el('button', { class: 'btn btn-secondary', text: 'フォルダーから選択' });
    const camBtn = UI.el('button', { class: 'btn btn-secondary', text: 'カメラで撮影' });
    const fileInput = UI.el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    const camInput = UI.el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });
    fileBtn.addEventListener('click', () => fileInput.click());
    camBtn.addEventListener('click', () => camInput.click());
    function onPicked(e) {
      const f = e.target.files[0];
      if (!f) return;
      UI.toast('画像を読み込んでいます…');
      const reader = new FileReader();
      reader.onload = () => {
        // 実機カメラのJPEGはpdf-libの簡易JPEGパーサーで解析エラーになることがあるため、
        // 一度canvasに描画してJPEGとして再エンコードしてから使う(サイズが大きい場合は縮小も行う)。
        const img = new Image();
        img.onload = () => {
          try {
            const MAX_DIM = 1280;
            let w = img.naturalWidth, h = img.naturalHeight;
            if (!w || !h) throw new Error('画像サイズを取得できません');
            if (w > MAX_DIM || h > MAX_DIM) {
              const scale = MAX_DIM / Math.max(w, h);
              w = Math.round(w * scale); h = Math.round(h * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            pendingImage = jpegDataUrl; plan.image.dataUrl = jpegDataUrl; renderPreviewImg();
            UI.toast('画像を読み込みました');
          } catch (err) {
            console.error(err);
            UI.toast('画像の変換に失敗しました。別の画像でお試しください。');
          }
        };
        img.onerror = () => UI.toast('画像の読み込みに失敗しました。別の画像でお試しください。');
        img.src = reader.result;
      };
      reader.onerror = () => UI.toast('画像ファイルの読み込みに失敗しました。');
      reader.readAsDataURL(f);
    }
    fileInput.addEventListener('change', onPicked);
    camInput.addEventListener('change', onPicked);
    pickRow.appendChild(fileBtn); pickRow.appendChild(camBtn);
    c._body.appendChild(pickRow);
    c._body.appendChild(fileInput);
    c._body.appendChild(camInput);

    const previewWrap = UI.el('div', { style: 'margin-top:12px;' });
    c._body.appendChild(previewWrap);
    function renderPreviewImg() {
      previewWrap.innerHTML = '';
      if (plan.image.dataUrl) {
        const img = UI.el('img', { src: plan.image.dataUrl, style: 'max-width:100%;border-radius:8px;border:1px solid var(--border);' });
        previewWrap.appendChild(img);
      }
    }
    renderPreviewImg();
    root.appendChild(c);

    UI.nextBar(root, {
      onBack: () => { phase = 'confirmNext'; renderCurrent(); },
      nextLabel: '次へ（保存前の確認）',
      onNext: () => { phase = 'confirmName'; renderCurrent(); },
    });
  }

  let pendingFileName = null;
  function renderConfirmNameStep() {
    const existing = Storage.getPdfIndex().map((e) => e.fileName);
    if (pendingFileName == null) pendingFileName = PlanState.fileNameFor(plan, existing).replace(/\.pdf$/i, '');
    const c = UI.card('保存前の確認', 'ファイル名は「日付6桁+業者名」で自動作成されます。必要であれば変更してください。');
    const f = UI.el('div', { class: 'field' });
    f.appendChild(UI.el('label', { class: 'field-label', text: 'ファイル名' }));
    const row = UI.el('div', { style: 'display:flex;align-items:center;gap:6px;' });
    const input = UI.el('input', { type: 'text', value: pendingFileName });
    input.addEventListener('input', () => { pendingFileName = input.value; });
    row.appendChild(input);
    row.appendChild(UI.el('div', { style: 'color:var(--muted);font-size:13px;', text: '.pdf' }));
    f.appendChild(row);
    c._body.appendChild(f);
    root.appendChild(c);

    UI.nextBar(root, {
      onBack: () => { phase = 'image'; renderCurrent(); },
      nextLabel: 'この内容で保存する',
      onNext: () => {
        if (!pendingFileName || !pendingFileName.trim()) return UI.toast('ファイル名を入力してください');
        doFinalize(pendingFileName.trim());
      },
    });
  }

  async function doFinalize(customBaseName) {
    phase = 'saving'; lastError = ''; renderCurrent();
    try {
      const existing = Storage.getPdfIndex().map((e) => e.fileName);
      let fileName;
      if (customBaseName) {
        let final = customBaseName + '.pdf';
        let n = 1;
        while (existing.includes(final)) { final = `${customBaseName}${String(n).padStart(2, '0')}.pdf`; n++; }
        fileName = final;
      } else {
        fileName = PlanState.fileNameFor(plan, existing);
      }
      pendingFileName = null;
      plan.header.uchiawaseTime = new Date().toTimeString().slice(0, 5);
      plan.savedFileName = fileName;
      const { bytes: pdfBytes, warnings } = await PdfGen.generate(plan);
      let dropboxPath = null;
      if (window.Dropbox && Dropbox.isLinked()) {
        try { dropboxPath = await Dropbox.uploadPdf(fileName, pdfBytes); } catch (e) { console.warn('dropbox upload failed', e); }
      }
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      await IdbStore.put(fileName, blob); // ページ再読み込み後も開けるようIndexedDBに実体を保存
      try { await IdbStore.putPlan(fileName, plan); } catch (e) { console.warn('plan保存に失敗', e); } // 「再利用」用の入力データ
      const verify = await IdbStore.get(fileName); // 書き込みが確実に反映されたか読み戻して検証
      const hasLocal = !!verify;
      if (!hasLocal && !dropboxPath) {
        throw new Error('PDFの保存(IndexedDB書き込み)を検証できませんでした。端末のストレージ設定(プライベートブラウジング等)をご確認ください。');
      }
      Storage.addPdfIndexEntry({
        fileName, createdAt: Date.now(), gyoshamei: plan.header.gyoshamei, sagyobi: plan.header.sagyobi,
        tantosha6: (plan.header.tantosha && plan.header.tantosha[0]) || '',
        docType: plan.docType || 'kiki',
        dropboxPath, hasLocal,
      });
      if (warnings && warnings.length) {
        UI.toast(`${fileName} を保存しました（一部注意あり: ${warnings.join(' ')}）`);
      } else {
        UI.toast(`${fileName} を保存しました`);
      }
      if (pendingNextPlanAfterSave) {
        pendingNextPlanAfterSave = false;
        const carried = plan.header;
        plan = PlanState.newPlan(carried);
        machineIndex = 0; stepIdx = 0; phase = 'machine';
        renderCurrent();
      } else {
        Storage.clearDraft();
        phase = 'done';
        renderCurrent();
      }
    } catch (e) {
      console.error(e);
      lastError = (e && e.stack) ? e.stack : ((e && e.message) ? e.message : String(e));
      UI.toast('PDF生成中にエラーが発生しました');
      phase = 'image';
      renderCurrent();
    }
  }

  function renderDoneScreen() {
    const c = UI.card('保存が完了しました');
    const p = UI.el('div', { class: 'field', text: `ファイル名: ${plan.savedFileName}` });
    c._body.appendChild(p);
    const row = UI.el('div', { class: 'btn-row', style: 'padding:0 14px 14px;' });
    const toList = UI.el('button', { class: 'btn btn-secondary', text: '一覧を見る' });
    const newOne = UI.el('button', { class: 'btn btn-primary', text: '新しい計画を作成' });
    toList.addEventListener('click', () => App.navigate('list'));
    newOne.addEventListener('click', () => Wizard.startNew());
    row.appendChild(toList); row.appendChild(newOne);
    c._body.appendChild(row);
    root.appendChild(c);
  }

  let forceFreshState = false; // startNew/startFromPlanの直後は下書き復元をスキップする

  async function mount(container) {
    root = container;
    master = await MasterData.load();
    await Holidays.load();
    if (forceFreshState) {
      forceFreshState = false;
      renderCurrent();
      return;
    }
    const draft = Storage.loadDraft();
    if (draft && draft.plan) {
      plan = draft.plan; phase = draft.phase; stepIdx = draft.stepIdx; machineIndex = draft.machineIndex;
      pendingNextPlanAfterSave = draft.pendingNextPlanAfterSave || false;
    } else {
      startNew();
      return;
    }
    renderCurrent();
  }

  function startNew() {
    plan = PlanState.newPlan();
    phase = 'header'; stepIdx = 0; machineIndex = 0; pendingNextPlanAfterSave = false; pendingFileName = null;
    reuseMode = false;
    forceFreshState = true;
    if (root) renderCurrent();
  }

  // 一覧の「再利用」ボタンから呼ばれる: 保存済みplanを引き継ぎつつ、
  // 打合せ日(入力2)は今日、作業日(入力4)は翌平日に自動更新した新しい計画として開始する。
  // 入力2(打合せ日時)・入力3(作業日・昼夜別)の2ステップだけ確認・修正させ、
  // 完了後はそれ以降の入力(担当者・署名・機械情報等)を再入力させず保存前確認へ直行する。
  function startFromPlan(sourcePlan) {
    plan = JSON.parse(JSON.stringify(sourcePlan));
    plan.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    plan.savedFileName = '';
    plan.createdAt = Date.now();
    const today = Holidays.fmt(new Date());
    plan.header.uchiawaseDate = today;
    plan.header.sagyobi = Holidays.nextBusinessDayAfter(today);
    plan.header.uchiawaseTime = '';
    machineIndex = Math.max(0, plan.machines.length - 1);
    pendingNextPlanAfterSave = false; pendingFileName = null;
    phase = 'header'; stepIdx = 1; // h2(入力2: 打合せ日時)から開始
    reuseMode = true;
    forceFreshState = true;
    if (root) renderCurrent();
  }

  function currentPlan() { return plan; }

  return { mount, startNew, startFromPlan, currentPlan };
})();
