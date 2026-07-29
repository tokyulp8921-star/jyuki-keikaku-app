// クレーン計画書ウィザードエンジン:
// ヘッダー1(業者名・打合日)→登録機種数→機種1台目→ヘッダー2(クレーン業者〜安全チェック)
// →(機種2・3台目、登録数が2以上の場合)→ヘッダー3(元請担当者確認欄)→吊り荷計画(繰り返し,最大3)→画像挿入→保存
const CraneWizard = (() => {
  let root = null;
  let plan = null;
  // header1 | craneCount | craneType | craneTonnage | header2 | header3 | lift | confirmNextLift | image | confirmName | saving | done
  let phase = 'header1';
  let stepIdx = 0;
  let liftIndex = 0;
  let craneTypeIndex = 0;
  let master = null;
  let lastError = '';
  let forceFreshState = false;
  let reuseMode = false; // 再利用時: 入力2(打合日・作業日)だけ確認させ、完了後は保存前確認へ直行する

  const HEADER2_OFFSET = 2; // CraneHeaderStepsの中でヘッダー2(c3〜c9)が始まるindex
  const HEADER2_LEN = 7; // c3,c4,c5,c6,c7,c8,c9
  const HEADER3_INDEX = 9; // c10

  function ctxBase() {
    return {
      plan,
      master,
      lift: plan.lifts[liftIndex],
      liftIndex,
      goNext: () => { stepIdx++; renderCurrent(); },
      goBack: () => { stepIdx--; renderCurrent(); },
      hasBack: stepIdx > 0,
    };
  }

  function totalLiftSteps() { return CraneLiftSteps.length; }

  function saveDraftNow() { Storage.saveCraneDraft({ plan, phase, stepIdx, liftIndex, craneTypeIndex }); }

  function renderCurrent() {
    root.innerHTML = '';
    saveDraftNow();

    if (phase === 'header1') {
      if (reuseMode && stepIdx >= 2) { reuseMode = false; phase = 'confirmName'; return renderCurrent(); }
      if (stepIdx >= 2) { phase = 'craneCount'; stepIdx = 0; return renderCurrent(); }
      UI.progress(root, stepIdx + 1, 12, `共通情報 ${stepIdx + 1}/2`);
      const ctx = ctxBase();
      ctx.goBack = stepIdx > 0 ? () => { stepIdx--; renderCurrent(); } : null;
      CraneHeaderSteps[stepIdx].render(root, ctx);
      return;
    }
    if (phase === 'craneCount') {
      UI.progress(root, 3, 12, '登録するクレーンの機種数');
      const ctx = {
        plan,
        goNext: () => { craneTypeIndex = 0; phase = 'craneType'; renderCurrent(); },
        goBack: () => { phase = 'header1'; stepIdx = 1; renderCurrent(); },
      };
      CraneTypeSteps.renderCount(root, ctx);
      return;
    }
    if (phase === 'craneType') {
      UI.progress(root, 4, 12, `機種・性能（${craneTypeIndex + 1}台目）`);
      const ctx = {
        plan, craneTypeIndex,
        goNext: () => { phase = 'craneTonnage'; renderCurrent(); },
        goBack: () => {
          if (craneTypeIndex === 0) { phase = 'craneCount'; renderCurrent(); }
          else { UI.toast('これ以上戻れません'); }
        },
      };
      CraneTypeSteps.renderType(root, ctx);
      return;
    }
    if (phase === 'craneTonnage') {
      UI.progress(root, 5, 12, `トン数（${craneTypeIndex + 1}台目）`);
      const ctx = {
        plan, craneTypeIndex,
        goNext: () => {
          if (craneTypeIndex === 0) { phase = 'header2'; stepIdx = 0; renderCurrent(); }
          else {
            craneTypeIndex++;
            if (craneTypeIndex < plan.header.craneCount) { phase = 'craneType'; renderCurrent(); }
            else { phase = 'header3'; stepIdx = 0; renderCurrent(); }
          }
        },
        goBack: () => { phase = 'craneType'; renderCurrent(); },
      };
      CraneTypeSteps.renderTonnage(root, ctx);
      return;
    }
    if (phase === 'header2') {
      if (stepIdx >= HEADER2_LEN) {
        if (plan.header.craneCount > 1) { craneTypeIndex = 1; phase = 'craneType'; return renderCurrent(); }
        phase = 'header3'; stepIdx = 0; return renderCurrent();
      }
      UI.progress(root, 6 + stepIdx, 12, `共通情報 ${stepIdx + 1}/${HEADER2_LEN}`);
      const ctx = ctxBase();
      ctx.goBack = () => {
        if (stepIdx > 0) { stepIdx--; renderCurrent(); }
        else { phase = 'craneTonnage'; craneTypeIndex = 0; renderCurrent(); }
      };
      CraneHeaderSteps[HEADER2_OFFSET + stepIdx].render(root, ctx);
      return;
    }
    if (phase === 'header3') {
      if (stepIdx >= 1) { phase = 'lift'; stepIdx = 0; return renderCurrent(); }
      UI.progress(root, 11, 12, '元請担当者確認欄');
      const ctx = ctxBase();
      ctx.goBack = () => {
        if (plan.header.craneCount > 1) { phase = 'craneTonnage'; craneTypeIndex = plan.header.craneCount - 1; renderCurrent(); }
        else { phase = 'header2'; stepIdx = HEADER2_LEN - 1; renderCurrent(); }
      };
      CraneHeaderSteps[HEADER3_INDEX].render(root, ctx);
      return;
    }
    if (phase === 'lift') {
      if (stepIdx >= totalLiftSteps()) { phase = 'confirmNextLift'; return renderCurrent(); }
      UI.progress(root, 12, 12 + totalLiftSteps(), `吊り荷計画${liftIndex + 1}の入力 ${stepIdx + 1}/${totalLiftSteps()}`);
      const ctx = ctxBase();
      ctx.goBack = () => {
        if (stepIdx > 0) { stepIdx--; renderCurrent(); }
        else if (liftIndex === 0) { phase = 'header3'; stepIdx = 0; renderCurrent(); }
        else { UI.toast('これ以上戻れません'); }
      };
      CraneLiftSteps[stepIdx].render(root, ctx);
      return;
    }
    if (phase === 'confirmNextLift') {
      const c = UI.card('次の吊り荷計画を追加しますか？', '1日の中で異なる吊り荷プランがある場合、最大3回分まで登録できます。');
      const row = UI.el('div', { class: 'btn-row', style: 'padding:0 14px 14px;' });
      const yes = UI.el('button', { class: 'btn btn-primary', text: '次の吊り荷計画を追加する' });
      const no = UI.el('button', { class: 'btn btn-secondary', text: 'しない（画像挿入へ）' });
      if (plan.lifts.length >= 3) yes.disabled = true;
      yes.addEventListener('click', () => {
        plan.lifts.push(CranePlanState.newLift());
        liftIndex++; stepIdx = 0; phase = 'lift';
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

  function renderImageStep() {
    if (lastError) {
      const errCard = UI.el('div', { class: 'card', style: 'border:1.5px solid var(--danger);' });
      errCard.appendChild(UI.el('div', { class: 'card-title', style: 'color:var(--danger);background:#fdeceb;', text: 'PDF生成でエラーが発生しました' }));
      const body = UI.el('div', { class: 'field' });
      body.appendChild(UI.el('div', { style: 'font-size:12.5px;color:var(--danger);word-break:break-all;white-space:pre-wrap;', text: lastError }));
      body.appendChild(UI.el('div', { class: 'hint', text: 'この内容をそのままコピーして開発者に伝えてください。' }));
      errCard.appendChild(body);
      root.appendChild(errCard);
    }
    const c = UI.card('画像・図面挿入', 'クレーン設置位置・運行経路・旋回範囲等の図面や写真を挿入します（赤枠のサイズに合わせて配置されます）');
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
            plan.image.dataUrl = jpegDataUrl; renderPreviewImg();
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
        previewWrap.appendChild(UI.el('img', { src: plan.image.dataUrl, style: 'max-width:100%;border-radius:8px;border:1px solid var(--border);' }));
      }
    }
    renderPreviewImg();
    root.appendChild(c);

    UI.nextBar(root, {
      onBack: () => { phase = 'confirmNextLift'; renderCurrent(); },
      nextLabel: '次へ（保存前の確認）',
      onNext: () => { phase = 'confirmName'; renderCurrent(); },
    });
  }

  let pendingFileName = null;
  function renderConfirmNameStep() {
    const existing = Storage.getPdfIndex().map((e) => e.fileName);
    if (pendingFileName == null) pendingFileName = CranePlanState.fileNameFor(plan, existing).replace(/\.pdf$/i, '');
    const c = UI.card('保存前の確認', 'ファイル名は「日付6桁+業者名+クレーン」で自動作成されます。必要であれば変更してください。');
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
        fileName = CranePlanState.fileNameFor(plan, existing);
      }
      pendingFileName = null;
      plan.savedFileName = fileName;
      const { bytes: pdfBytes, warnings } = await CranePdfGen.generate(plan);
      let dropboxPath = null;
      if (window.Dropbox && Dropbox.isLinked()) {
        try { dropboxPath = await Dropbox.uploadPdf(fileName, pdfBytes); } catch (e) { console.warn('dropbox upload failed', e); }
      }
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      await IdbStore.put(fileName, blob);
      try { await IdbStore.putPlan(fileName, plan); } catch (e) { console.warn('plan保存に失敗', e); }
      const verify = await IdbStore.get(fileName);
      const hasLocal = !!verify;
      if (!hasLocal && !dropboxPath) {
        throw new Error('PDFの保存(IndexedDB書き込み)を検証できませんでした。端末のストレージ設定(プライベートブラウジング等)をご確認ください。');
      }
      Storage.addPdfIndexEntry({
        fileName, createdAt: Date.now(), gyoshamei: plan.header.gyoshamei, sagyobi: plan.header.sagyobi,
        tantosha6: plan.tantosha127 || '',
        docType: 'crane',
        dropboxPath, hasLocal,
      });
      if (warnings && warnings.length) UI.toast(`${fileName} を保存しました（一部注意あり: ${warnings.join(' ')}）`);
      else UI.toast(`${fileName} を保存しました`);
      Storage.clearCraneDraft();
      phase = 'done';
      renderCurrent();
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
    c._body.appendChild(UI.el('div', { class: 'field', text: `ファイル名: ${plan.savedFileName}` }));
    const row = UI.el('div', { class: 'btn-row', style: 'padding:0 14px 14px;' });
    const toList = UI.el('button', { class: 'btn btn-secondary', text: '一覧を見る' });
    const newOne = UI.el('button', { class: 'btn btn-primary', text: '新しいクレーン計画を作成' });
    toList.addEventListener('click', () => App.navigate('list'));
    newOne.addEventListener('click', () => CraneWizard.startNew());
    row.appendChild(toList); row.appendChild(newOne);
    c._body.appendChild(row);
    root.appendChild(c);
  }

  async function mount(container) {
    root = container;
    master = await MasterData.load();
    await Holidays.load();
    if (forceFreshState) {
      forceFreshState = false;
      renderCurrent();
      return;
    }
    const draft = Storage.loadCraneDraft();
    if (draft && draft.plan) {
      plan = draft.plan; phase = draft.phase; stepIdx = draft.stepIdx; liftIndex = draft.liftIndex || 0;
      craneTypeIndex = draft.craneTypeIndex || 0;
    } else {
      startNew();
      return;
    }
    renderCurrent();
  }

  function startNew() {
    plan = CranePlanState.newPlan();
    phase = 'header1'; stepIdx = 0; liftIndex = 0; craneTypeIndex = 0;
    reuseMode = false;
    forceFreshState = true;
    if (root) renderCurrent();
  }

  // 一覧の「再利用」ボタンから呼ばれる: 保存済みplanを引き継ぎつつ、
  // 打合日は今日、作業日は翌平日に自動更新した新しい計画として開始する。
  // 打合日・作業日の1ステップだけ確認・修正させ、完了後は保存前確認へ直行する。
  function startFromPlan(sourcePlan) {
    plan = JSON.parse(JSON.stringify(sourcePlan));
    plan.id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    plan.savedFileName = '';
    plan.createdAt = Date.now();
    const today = Holidays.fmt(new Date());
    plan.header.uchiawaseDate = today;
    plan.header.sagyobi = Holidays.nextBusinessDayAfter(today);
    liftIndex = Math.max(0, plan.lifts.length - 1);
    phase = 'header1'; stepIdx = 1; // c2(打合日・作業日)から開始
    reuseMode = true;
    forceFreshState = true;
    if (root) renderCurrent();
  }

  function currentPlan() { return plan; }

  return { mount, startNew, startFromPlan, currentPlan };
})();
