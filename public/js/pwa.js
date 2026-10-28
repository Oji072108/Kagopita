(() => {
  const container = document.getElementById('pwaInstall');
  const button = document.getElementById('pwaInstallButton');
  const dialog = document.getElementById('pwaInstallDialog');
  const status = document.getElementById('pwaInstallStatus');
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/i.test(ua) || (/Macintosh|MacIntel/i.test(ua + ' ' + navigator.platform) && navigator.maxTouchPoints > 1);
  const android = !ios && /Android/i.test(ua);
  const display = window.matchMedia('(display-mode: standalone)');
  let installed = false, deferredPrompt = null, busy = false, returnToMenu = false;
  const standalone = () => installed || display.matches || navigator.standalone === true;
  function update() {
    container.classList.toggle('hidden', standalone() || !(ios || (android && deferredPrompt)));
    button.disabled = busy;
    if (standalone() && dialog.open) dialog.close();
  }
  document.getElementById('pwaInstallLabel').textContent = android ? 'Kagopitaをインストール' : 'インストール方法';
  if (ios) button.setAttribute('aria-haspopup', 'dialog');
  window.addEventListener('beforeinstallprompt', event => {
    if (!android || standalone()) return;
    event.preventDefault();
    deferredPrompt = event;
    status.textContent = '';
    update();
  });
  window.addEventListener('appinstalled', () => {
    installed = true; deferredPrompt = null; status.textContent = ''; update();
  });
  display.addEventListener('change', update);
  button.addEventListener('click', async () => {
    if (standalone() || busy) return;
    if (ios) {
      returnToMenu = document.getElementById('navigationDialog').classList.contains('is-open');
      if (returnToMenu) window.closeNavigationMenu();
      dialog.showModal();
      document.getElementById('pwaInstallTitle').focus({ preventScroll: true });
      dialog.querySelector('.share-content').scrollTop = 0;
      return;
    }
    if (!android || !deferredPrompt) return;
    const prompt = deferredPrompt;
    busy = true; update();
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') installed = true;
    } catch {
      // A browser can withdraw a one-shot prompt; wait for a new eligible event.
    } finally {
      deferredPrompt = null; busy = false; update();
    }
  });
  document.getElementById('pwaInstallClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    // The trigger lives in an inert panel while the navigation is closed.
    if (returnToMenu && !standalone() && !document.getElementById('nav-menu').classList.contains('hidden')) {
      window.openNavigationMenu();
      button.focus({ preventScroll: true });
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
