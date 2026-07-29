// アプリのルーター/エントリーポイント
const App = (() => {
  const viewRoot = document.getElementById('view-root');
  const headerSub = document.getElementById('header-sub');
  let current = 'list';

  const TITLES = { list: '一覧', wizard: '入力', 'crane-wizard': 'クレーン入力', preview: 'プレビュー', master: 'マスタ管理' };

  function navigate(view) {
    current = view;
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    headerSub.textContent = TITLES[view] || '';
    viewRoot.innerHTML = '';
    if (view === 'list') ListView.mount(viewRoot);
    else if (view === 'wizard') Wizard.mount(viewRoot);
    else if (view === 'crane-wizard') CraneWizard.mount(viewRoot);
    else if (view === 'preview') PreviewView.mount(viewRoot);
    else if (view === 'master') MasterAdmin.mount(viewRoot);
  }

  function init() {
    document.querySelectorAll('.nav-btn').forEach((b) => {
      b.addEventListener('click', () => navigate(b.dataset.view));
    });
    if (location.protocol === 'file:') {
      const banner = document.createElement('div');
      banner.style.cssText = 'background:#fdeceb;color:#d93025;font-size:12px;padding:8px 12px;text-align:center;';
      banner.textContent = 'このページはfile://で開かれています。データの読込・PDF生成が失敗します。サーバー経由のURL(http://...)で開き直してください。';
      document.getElementById('app-header').after(banner);
    }
    Dropbox.tryAutoLink().catch(() => {});
    navigate('list');
  }

  // app.jsは動的スクリプトローダー経由で読み込まれ、DOMContentLoadedが既に発火済みのことがあるため
  // readyStateを見て即座にinitするフォールバックを持つ。
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { navigate };
})();
