// プレビュー画面: 入力中/選択したPDFをブラウザ内表示する
const PreviewView = (() => {
  let root = null;
  let currentUrl = null;
  let currentName = '';
  let lastError = '';

  function showUrl(url, name) {
    currentUrl = url; currentName = name || '';
    if (root) render();
  }

  function render() {
    root.innerHTML = '';
    if (!currentUrl) {
      if (lastError) {
        const errCard = UI.el('div', { class: 'card', style: 'border:1.5px solid var(--danger);' });
        errCard.appendChild(UI.el('div', { class: 'card-title', style: 'color:var(--danger);background:#fdeceb;', text: 'プレビュー生成でエラーが発生しました' }));
        const body = UI.el('div', { class: 'field' });
        body.appendChild(UI.el('div', { style: 'font-size:12.5px;color:var(--danger);word-break:break-all;white-space:pre-wrap;', text: lastError }));
        body.appendChild(UI.el('div', { class: 'hint', text: 'この内容をそのままコピーして開発者に伝えてください。' }));
        errCard.appendChild(body);
        root.appendChild(errCard);
      }
      const c = UI.card('プレビュー');
      c._body.appendChild(UI.el('div', { class: 'field' }, [
        UI.el('div', { class: 'section-hint', text: '入力中の内容からPDFプレビューを生成できます。' }),
      ]));
      const genBtn = UI.el('button', { class: 'btn btn-primary btn-block', text: '入力中の内容からプレビュー生成' });
      genBtn.addEventListener('click', generateFromDraft);
      c._body.appendChild(UI.el('div', { class: 'field' }, genBtn));
      root.appendChild(c);
      return;
    }
    const c = UI.card(currentName || 'プレビュー');
    const iframe = UI.el('iframe', { class: 'pdf-frame', src: currentUrl });
    c._body.appendChild(iframe);
    root.appendChild(c);
    const row = UI.el('div', { class: 'btn-row' });
    const back = UI.el('button', { class: 'btn btn-secondary', text: '閉じる' });
    back.addEventListener('click', () => { currentUrl = null; render(); });
    row.appendChild(back);
    root.appendChild(row);
  }

  async function generateFromDraft() {
    const plan = Wizard.currentPlan ? Wizard.currentPlan() : null;
    if (!plan) return UI.toast('入力中の計画がありません');
    lastError = '';
    UI.toast('生成中…');
    try {
      const { bytes, warnings } = await PdfGen.generate(plan);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (warnings && warnings.length) UI.toast('注意: ' + warnings.join(' '));
      showUrl(url, '(プレビュー)');
    } catch (e) {
      console.error(e);
      lastError = (e && e.stack) ? e.stack : ((e && e.message) ? e.message : String(e));
      UI.toast('プレビュー生成に失敗しました');
      render();
    }
  }

  function mount(container) {
    root = container;
    render();
  }

  return { mount, showUrl };
})();
