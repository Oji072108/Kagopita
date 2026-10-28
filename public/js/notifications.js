/* Persistent in-app inbox, refreshed by SSE and the existing reconnect/poll loop. */
window.KagopitaNotifications = (() => {
  let userId = null, requestId = 0, highestSeen = null, notifications = [], toastTimer, page = 1, totalPages = 1, unread = 0, latestId = 0, total = 0;
  const element = id => document.getElementById(id);
  function message(entry) {
    const actions = feedTranslations[document.documentElement.lang];
    const translated = actions?.[entry.action];
    if (translated) return `${entry.actorName} ${typeof translated === 'function' ? translated(entry.item) : translated}`;
    const labels = {added:'追加', edited:'編集', deleted:'削除', completed:'チェック', uncompleted:'チェック解除', restored:'復元', recurring:'繰り返し再開'};
    return `${entry.actorName} · ${labels[entry.action] || translateFeature('商品が更新されました')} · ${entry.item}`;
  }
  let openFromPush = new URLSearchParams(location.search).get('notifications') === '1';
  function openPushInbox() {
    if (!userId || document.querySelector('dialog[open]')) { openFromPush = true; return; }
    if (!element('notificationsDialog').classList.contains('is-open')) element('notificationsButton').click();
    const url = new URL(location.href); url.searchParams.delete('notifications');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    openFromPush = false;
  }
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'kagopita:open-notifications') openPushInbox();
  });
  document.addEventListener('close', () => { if (openFromPush) openPushInbox(); }, true);
  function render() {
    element('notificationsButton').classList.toggle('hidden', !userId);
    const badge = element('notificationCount');
    badge.textContent = String(unread); badge.classList.toggle('hidden', unread === 0);
    element('notificationsButton').setAttribute('aria-label', `${translateFeature('通知')}${unread ? ` (${translateFeature('未読')}: ${unread})` : ''}`);
    element('readNotifications').disabled = !total;
    element('notificationsPage').textContent = `${page} / ${totalPages}`;
    element('notificationsPrevious').disabled = page <= 1;
    element('notificationsNext').disabled = page >= totalPages;
    document.querySelector('.notification-pagination').hidden = totalPages <= 1;
    const list = element('notificationsList'); list.replaceChildren();
    if (!notifications.length) {
      const empty = document.createElement('p'); empty.textContent = translateFeature('通知はまだありません。'); list.append(empty);
    }
    for (const entry of notifications) {
      const row = document.createElement('button'); row.type = 'button'; row.className = `notification-entry${entry.readAt ? '' : ' unread'}`;
      row.dataset.i18nIgnore = 'true'; row.dataset.notificationId = entry.id;
      const text = document.createElement('strong'); text.textContent = message(entry);
      const meta = document.createElement('small');
      meta.textContent = `${entry.channelName} · ${new Date(entry.createdAt).toLocaleString(document.documentElement.lang)}`;
      row.append(text, meta);
      row.addEventListener('click', async () => {
        row.disabled = true;
        try {
          close();
          await refreshChannels(entry.channelId);
          await switchTab('list');
        } catch (error) { KagopitaDialogs.notice(error.message); }
        finally { row.disabled = false; }
      });
      list.append(row);
    }
  }
  async function refresh(id = userId) {
    if (!id) return;
    if (id !== userId) { reset(); userId = id; }
    const version = ++requestId;
    try {
      const data = await api(`/api/notifications?page=${page}`);
      if (version !== requestId || userId !== id) return;
      page = data.page; totalPages = data.totalPages; unread = data.unreadCount; latestId = data.latestId; total = data.total;
      notifications = Array.isArray(data.notifications) ? data.notifications : [];
      const latest = notifications[0];
      if (!element('notificationsDialog').classList.contains('is-open') && page === 1 && latest && highestSeen !== null && latest.id > highestSeen && !latest.readAt) {
        const toast = element('notificationToast');
        toast.textContent = `${latest.channelName}: ${message(latest)}`;
        toast.classList.remove('hidden'); clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.add('hidden'), 6000);
      }
      highestSeen = Math.max(highestSeen || 0, latest?.id || 0);
      element('notificationsError').textContent = '';
      render();
      if (openFromPush) openPushInbox();
    } catch (error) {
      if (version === requestId && userId) element('notificationsError').textContent = error.message;
    }
  }
  function reset() {
    userId = null; ++requestId; notifications = []; highestSeen = null; page = 1; totalPages = 1; unread = latestId = total = 0;
    clearTimeout(toastTimer); element('notificationToast').classList.add('hidden');
    close(); render();
  }
  function close(restoreFocus = false) {
    const panel = element('notificationsDialog');
    panel.classList.remove('is-open'); panel.inert = true; panel.setAttribute('aria-hidden', 'true');
    element('notificationsButton').setAttribute('aria-expanded', 'false');
    if (restoreFocus) element('notificationsButton').focus();
  }
  element('notificationsButton').addEventListener('click', () => {
    const panel = element('notificationsDialog');
    if (panel.classList.contains('is-open')) return close(true);
    closeNavigationMenu(); clearTimeout(toastTimer); element('notificationToast').classList.add('hidden'); render();
    panel.inert = false; panel.classList.add('is-open'); panel.setAttribute('aria-hidden', 'false');
    element('notificationsButton').setAttribute('aria-expanded', 'true');
    element('closeNotifications').focus({preventScroll:true}); refresh();
  });
  element('closeNotifications').addEventListener('click', () => close(true));
  document.addEventListener('pointerdown', event => {
    if (!element('notificationsDialog').contains(event.target) && !element('notificationsButton').contains(event.target)) close();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && element('notificationsDialog').classList.contains('is-open')) close(true); });
  for (const [id, delta] of [['notificationsPrevious', -1], ['notificationsNext', 1]]) element(id).addEventListener('click', async () => {
    page = Math.min(totalPages, Math.max(1, page + delta)); await refresh();
    element('notificationsDialog').scrollTop = 0;
  });
  element('readNotifications').addEventListener('click', async () => {
    const id = userId;
    element('readNotifications').disabled = true;
    try {
      await api('/api/notifications/read', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({throughId: latestId}) });
      if (userId === id) await refresh();
    } catch (error) { element('notificationsError').textContent = error.message; render(); }
  });
  return {refresh, render, reset, close};
})();
