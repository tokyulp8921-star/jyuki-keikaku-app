// ウィザード画面共通のUI構築ヘルパー
const UI = (() => {
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function card(title, hint) {
    const c = el('div', { class: 'card' });
    if (title) c.appendChild(el('div', { class: 'card-title', text: title }));
    const body = el('div', {});
    if (hint) body.appendChild(el('div', { class: 'field', style: '' }, el('div', { class: 'section-hint', text: hint })));
    c.appendChild(body);
    c._body = body;
    return c;
  }
  function field(container, labelText) {
    const f = el('div', { class: 'field' });
    if (labelText) f.appendChild(el('label', { class: 'field-label', text: labelText }));
    (container._body || container).appendChild(f);
    return f;
  }

  function selectField(container, { label, value, options, placeholder, onChange }) {
    const f = field(container, label);
    const sel = el('select');
    sel.appendChild(el('option', { value: '' }, placeholder || '選択してください'));
    options.forEach((o) => {
      const opt = el('option', { value: o }, o);
      if (o === value) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    f.appendChild(sel);
    return sel;
  }

  function textField(container, { label, value, placeholder, type = 'text', onChange }) {
    const f = field(container, label);
    const input = el('input', { type, value: value || '', placeholder: placeholder || '' });
    input.addEventListener('input', () => onChange(input.value));
    f.appendChild(input);
    return input;
  }

  function textAreaWithHistory(container, { label, value, historyKey, onChange }) {
    const f = field(container, label);
    const ta = el('textarea', {}, value || '');
    ta.addEventListener('input', () => onChange(ta.value));
    f.appendChild(ta);
    const hist = Storage.getHistory(historyKey);
    if (hist.length) {
      const list = el('div', { class: 'history-list' });
      hist.forEach((h) => {
        const chip = el('div', { class: 'history-chip', text: h });
        chip.addEventListener('click', () => { ta.value = h; onChange(h); });
        list.appendChild(chip);
      });
      f.appendChild(list);
    }
    return ta;
  }

  function chipGroup(container, { label, value, options, multi, danger, onChange }) {
    const f = field(container, label);
    const grp = el('div', { class: 'chip-group' });
    let selected = multi ? (Array.isArray(value) ? [...value] : []) : value;
    function render() {
      grp.innerHTML = '';
      options.forEach((o) => {
        const isSel = multi ? selected.includes(o) : selected === o;
        const chip = el('div', { class: 'chip' + (isSel ? ' selected' : '') + (danger ? ' danger' : ''), text: o });
        chip.addEventListener('click', () => {
          if (multi) {
            selected = selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o];
          } else {
            selected = selected === o ? '' : o;
          }
          onChange(selected);
          render();
        });
        grp.appendChild(chip);
      });
    }
    render();
    f.appendChild(grp);
    return { get: () => selected };
  }

  function nextBar(container, { onNext, onBack, nextLabel, disabled }) {
    const row = el('div', { class: 'btn-row' });
    if (onBack) {
      const b = el('button', { class: 'btn btn-secondary', text: '戻る' });
      b.addEventListener('click', onBack);
      row.appendChild(b);
    }
    const n = el('button', { class: 'btn btn-primary', text: nextLabel || '次へ' });
    if (disabled) n.disabled = true;
    n.addEventListener('click', onNext);
    row.appendChild(n);
    container.appendChild(row);
    return n;
  }

  function progress(container, current, total, label) {
    const wrap = el('div', {});
    wrap.appendChild(el('div', { class: 'progress-bar' }, el('div', { class: 'progress-fill', style: `width:${Math.round((current / total) * 100)}%` })));
    wrap.appendChild(el('div', { class: 'step-label', text: label || `${current} / ${total}` }));
    container.appendChild(wrap);
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  return { el, card, field, selectField, textField, textAreaWithHistory, chipGroup, nextBar, progress, toast };
})();
