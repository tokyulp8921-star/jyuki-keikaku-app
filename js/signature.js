// 手書き署名キャンバスコンポーネント(デジタルインク)。
// Pointer Events APIでマウス・タッチ・スタイラスペンを単一のロジックで扱う(筆圧にも対応)。
function createSignaturePad(container, opts = {}) {
  const height = opts.height || 160;
  const wrap = document.createElement('div');
  wrap.className = 'sig-canvas-wrap';
  wrap.style.height = height + 'px';
  wrap.style.touchAction = 'none'; // スクロール等のブラウザ標準ジェスチャーを無効化しペン入力を優先
  const canvas = document.createElement('canvas');
  canvas.style.touchAction = 'none';
  wrap.appendChild(canvas);
  container.appendChild(wrap);

  const ctx = canvas.getContext('2d');
  let drawing = false;
  let hasInk = false;
  let last = null;
  const BASE_WIDTH = 2.6;

  function resize() {
    const rect = wrap.getBoundingClientRect();
    if (rect.width < 1) {
      // まだDOMに接続されておらずレイアウト前(幅0)の場合は、接続されるまで再試行する
      requestAnimationFrame(resize);
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const prevData = hasInk ? canvas.toDataURL() : null;
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
    if (prevData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, height);
      img.src = prevData;
    }
  }
  window.addEventListener('resize', resize);
  resize();

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5 };
  }

  function start(e) {
    // マウスは左ボタンのみ、タッチ/ペンはそのまま受け付ける
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 一部環境ではpointerIdが無効な場合があるため無視 */ }
    drawing = true;
    last = pos(e);
    // タップだけでも点が残るように小さな円を打つ
    const p = last.pressure && e.pointerType === 'pen' ? last.pressure : 0.5;
    ctx.beginPath();
    ctx.arc(last.x, last.y, (BASE_WIDTH * (0.5 + p)) / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    hasInk = true;
  }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    const pressure = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
    ctx.lineWidth = BASE_WIDTH * (0.6 + pressure);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
    hasInk = true;
  }
  function end(e) {
    if (!drawing) return;
    drawing = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
  }

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') end(e); });

  const actions = document.createElement('div');
  actions.className = 'sig-actions';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn btn-secondary';
  clearBtn.textContent = '消去';
  clearBtn.onclick = () => {
    const rect = wrap.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, height);
    hasInk = false;
  };
  actions.appendChild(clearBtn);
  container.appendChild(actions);

  return {
    isEmpty: () => !hasInk,
    toDataURL: () => canvas.toDataURL('image/png'),
    clear: () => clearBtn.onclick(),
    loadDataURL: (dataUrl) => {
      if (!dataUrl) return;
      const rect = wrap.getBoundingClientRect();
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, rect.width, height); hasInk = true; };
      img.src = dataUrl;
    },
  };
}
