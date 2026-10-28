/* Per-device opt-in. Never ask for permission outside an explicit button tap. */
window.KagopitaPush = (() => {
  const byId = id => document.getElementById(id);
  const button = byId('pushToggle'), test = byId('pushTest'), status = byId('pushStatus');
  const tr = text => typeof translateFeature === 'function' ? translateFeature(text) : text;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = () => isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const offer = byId('pushPermissionDialog');
  let offerTimer;
  let userId = null, enabled = false, busy = false, generation = 0, config = null, registration = null, pending = null;
  async function request(url, body, method = 'POST') {
    const response = await fetch('/api/push/' + url, {
      method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || tr('通知を設定できませんでした。もう一度お試しください。'));
    return result;
  }
  function render(message) {
    byId('pushSettings').hidden = !userId;
    byId('pushMenuButton').hidden = !userId;
    const denied = supported() && Notification.permission === 'denied';
    byId('pushPermissionHelp').hidden = !denied;
    byId('pushPermissionHelp').open = denied;
    byId('pushRecheck').hidden = !userId || !supported() || (ios && !standalone()) || (!denied && config !== null);
    byId('pushRecheck').disabled = busy;
    button.textContent = tr(enabled ? 'この端末の通知をオフにする' : 'この端末の通知をオンにする');
    button.setAttribute('aria-pressed', String(enabled));
    button.disabled = busy || !config || !supported() || (ios && !standalone()) || (!enabled && Notification.permission === 'denied');
    test.hidden = !enabled; test.disabled = busy || !enabled;
    const text = !isSecureContext ? '通知はHTTPSのサイトで設定してください。' :
      ios && !standalone() ? 'iPhone・iPadはホーム画面に追加し、追加したアプリを開いて通知を有効にしてください（iOS 16.4以降）。' :
      !supported() ? 'このブラウザはプッシュ通知に対応していません。' :
      Notification.permission === 'denied' ? '通知がブロックされています。端末またはブラウザの設定で許可してください。' :
      enabled ? 'この端末の通知はオンです。他の端末でも個別に有効にしてください。' :
      'アプリを閉じていても、他のメンバーによるリストの変更を受信できます。';
    status.textContent = message || tr(text);
  }
  async function refresh() {
    if (!userId || busy || pending) { render(); return; }
    if (!supported() || (ios && !standalone())) { render(); return; }
    const version = generation;
    pending = (async () => {
      try {
        config = await request('config', null, 'GET');
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        const subscription = await registration.pushManager.getSubscription();
        const state = subscription ? await request('status', { endpoint: subscription.endpoint }) : { enabled: false };
        if (version !== generation) return;
        enabled = state.enabled;
        if (enabled && Notification.permission === 'denied') {
          await request('subscriptions', { endpoint: subscription.endpoint }, 'DELETE');
          enabled = false;
        }
        render();
        scheduleOffer();
      } catch {
        if (version === generation) { config = null; render(tr('通知を設定できませんでした。もう一度お試しください。')); }
      } finally { pending = null; }
    })();
    await pending;
  }
  function setUser(id) {
    if (id === userId) { if (id && !config && !pending && !busy) refresh(); return; }
    clearTimeout(offerTimer);
    if (offer.open) offer.close();
    userId = id; enabled = false; config = null; generation++;
    render(); if (id) refresh();
  }
  async function toggle() {
    if (busy || !userId || !config || !supported()) return;
    // Permission must be requested before any await, especially on iOS.
    rememberOffer();
    const permission = !enabled && Notification.permission === 'default' ? Notification.requestPermission() : Promise.resolve(Notification.permission);
    busy = true; render();
    let subscription;
    try {
      if (!enabled && await permission !== 'granted') { render(); return; }
      // Ensure the worker has activated before calling pushManager.subscribe().
      registration = await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('worker timeout')), 15000))]);
      subscription = await registration.pushManager.getSubscription();
      if (enabled) {
        if (subscription) {
          await request('subscriptions', { endpoint: subscription.endpoint }, 'DELETE');
          enabled = false;
          await subscription.unsubscribe();
        }
        enabled = false;
        await clear();
      } else {
        const key = Uint8Array.from(atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await request('subscriptions', { subscription: subscription.toJSON() });
        enabled = true;
      }
      render();
    } catch { render(tr('通知を設定できませんでした。もう一度お試しください。')); }
    finally { busy = false; button.disabled = false; render(status.textContent); }
  }
  button.addEventListener('click', toggle);
  test.addEventListener('click', async () => {
    if (busy || !enabled) return;
    busy = true; render();
    try {
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw new Error('missing');
      await request('test', { endpoint: subscription.endpoint });
      render(tr('テスト通知を送信待ちにしました。届かない場合は端末の通知設定を確認してください。'));
    } catch { render(tr('テスト通知を送れませんでした。1分後にもう一度お試しください。')); }
    finally { busy = false; render(status.textContent); }
  });
  async function clear() {
    try {
      const worker = await navigator.serviceWorker.getRegistration('/');
      for (const notification of await worker?.getNotifications() || []) notification.close();
    } catch {}
  }
  function rememberOffer() {
    if (!userId) return;
    try { localStorage.setItem('kagopita-push-offer:' + userId, 'seen'); } catch {}
  }
  function scheduleOffer() {
    clearTimeout(offerTimer);
    offerTimer = setTimeout(() => {
      if (!userId || enabled || busy || !config || !supported() || document.hidden ||
          (ios && !standalone()) || Notification.permission === 'denied' ||
          document.querySelector('dialog[open]') || byId('navigationDialog').classList.contains('is-open') ||
          document.activeElement?.matches('input, textarea, select')) return;
      try { if (localStorage.getItem('kagopita-push-offer:' + userId)) return; } catch { return; }
      rememberOffer();
      offer.showModal();
    }, 1000);
  }
  byId('pushOfferLater').addEventListener('click', () => offer.close());
  byId('pushOfferEnable').addEventListener('click', () => { offer.close(); toggle(); });
  offer.addEventListener('close', () => { if (userId) byId('nav-menu').focus({preventScroll:true}); });
  byId('pushMenuButton').addEventListener('click', async () => {
    rememberOffer(); clearTimeout(offerTimer);
    if (offer.open) offer.close();
    window.closeNavigationMenu();
    await switchTab('account');
    await refresh();
    byId('pushSettings').scrollIntoView({block:'center'});
    byId('pushTitle').focus({preventScroll:true});
  });
  byId('pushRecheck').addEventListener('click', () => refresh());
  document.addEventListener('close', event => { if (event.target !== offer) scheduleOffer(); }, true);
  document.addEventListener('kagopita:idle', scheduleOffer);
  window.addEventListener('focus', () => { if (userId) refresh(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && userId) refresh(); });
  return { setUser, render, clear };
})();
