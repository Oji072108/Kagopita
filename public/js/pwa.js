(() => {
  const container = document.getElementById('pwaInstall');
  const button = document.getElementById('pwaInstallButton');
  const dialog = document.getElementById('pwaInstallDialog');
  const status = document.getElementById('pwaInstallStatus');
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/i.test(ua) || (/Macintosh|MacIntel/i.test(ua + ' ' + navigator.platform) && navigator.maxTouchPoints > 1);
  const android = !ios && /Android/i.test(ua);
  const display = window.matchMedia('(display-mode: standalone)');
  let returnToMenu = false;
  const standalone = () => display.matches || navigator.standalone === true;
  function update() {
    container.classList.toggle('hidden', standalone() || !(ios || android));
    if (standalone() && dialog.open) dialog.close();
  }
  document.getElementById('pwaInstallLabel').textContent = android ? 'Kagopitaをインストール' : 'インストール方法';
  if (android) {
    document.getElementById('pwaInstallLabel').textContent = 'Androidアプリをダウンロード';
    status.textContent = 'Google Play ストア版は近日公開予定です。';
  }
  if (ios) button.setAttribute('aria-haspopup', 'dialog');
  display.addEventListener('change', update);
  button.addEventListener('click', () => {
    if (standalone()) return;
    if (android) {
      window.location.href = 'https://kagopita.com/download/kagopita.apk';
      return;
    }
    if (ios) {
      returnToMenu = document.getElementById('navigationDialog').classList.contains('is-open');
      if (returnToMenu) window.closeNavigationMenu();
      dialog.showModal();
      document.getElementById('pwaInstallTitle').focus({ preventScroll: true });
      dialog.querySelector('.share-content').scrollTop = 0;
      return;
    }
  });
  document.getElementById('pwaInstallClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    // The trigger lives in an inert panel while the navigation is closed.
    if (returnToMenu && !standalone() && !document.getElementById('nav-menu').classList.contains('hidden')) {
      const menu = document.getElementById('navigationDialog');
      if (!menu.classList.contains('is-open')) window.openNavigationMenu();
      // Let the native dialog finish returning focus and the menu become visible.
      requestAnimationFrame(() => {
        if (!dialog.open && !menu.inert && menu.classList.contains('is-open')) button.focus({ preventScroll: true });
      });
    } else {
      document.getElementById('nav-menu').focus({ preventScroll: true });
    }
    returnToMenu = false;
  });
  update();
  // HTTPS in production; browsers also allow service workers on localhost for tests.
  if (window.isSecureContext && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(error => console.error('PWA service worker registration failed.', error));
  }
})();
