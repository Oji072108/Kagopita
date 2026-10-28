(() => {
  const container = document.getElementById('pwaInstall');
  const button = document.getElementById('pwaInstallButton');
  const dialog = document.getElementById('pwaInstallDialog');
  const status = document.getElementById('pwaInstallStatus');
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/i.test(ua) || (/Macintosh|MacIntel/i.test(ua + ' ' + navigator.platform) && navigator.maxTouchPoints > 1);
  const android = !ios && /Android/i.test(ua);
  const display = window.matchMedia('(display-mode: standalone)');
  let installed = false, deferredPrompt = null, busy = false;
  const standalone = () => installed || display.matches || navigator.standalone === true;
  function update() {
    container.classList.toggle('hidden', standalone() || !(ios || (android && deferredPrompt)));
    button.disabled = busy;
    if (standalone() && dialog.open) dialog.close();
  }
  button.textContent = android ? 'Kagopitaをインストール' : 'インストール方法';
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
    if (ios) { dialog.showModal(); return; }
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
  dialog.addEventListener('close', () => { if (!standalone()) button.focus({ preventScroll: true }); });
  update();
  // HTTPS in production; browsers also allow service workers on localhost for tests.
  if (window.isSecureContext && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(error => console.error('PWA service worker registration failed.', error));
  }
})();
