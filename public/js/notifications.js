/* Persistent in-app inbox, refreshed by SSE and the existing reconnect/poll loop. */
window.KagopitaNotifications = (() => {
  let userId = null, requestId = 0, highestSeen = null, notifications = [], toastTimer;
  const element = id => document.getElementById(id);
  function message(entry) {
    const actions = feedTranslations[document.documentElement.lang];
    const translated = actions?.[entry.action];
    if (translated) return `${entry.actorName} ${typeof translated === 'function' ? translated(entry.item) : translated}`;
    const labels = {added:'追加', edited:'編集', deleted:'削除', completed:'チェック', uncompleted:'チェック解除', restored:'復元', recurring:'繰り返し再開'};
    return `${entry.actorName} · ${labels[entry.action] || translateFeature('商品が更新されました')} · ${entry.item}`;
  }
  function render() {
    element('notificationsButton').classList.toggle('hidden', !userId);
    const unread = notifications.filter(entry => !entry.readAt).length;
    const badge = element('notificationCount');
    badge.textContent = String(unread); badge.classList.toggle('hidden', unread === 0);
    element('notificationsButton').setAttribute('aria-label', `${translateFeature('通知')}${unread ? ` (${translateFeature('未読')}: ${unread})` : ''}`);
    element('readNotifications').disabled = !unread;
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
          element('notificationsDialog').close();
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
      const data = await api('/api/notifications');
      if (version !== requestId || userId !== id) return;
      notifications = Array.isArray(data.notifications) ? data.notifications : [];
      const latest = notifications[0];
      if (latest && highestSeen !== null && latest.id > highestSeen && !latest.readAt) {
        const toast = element('notificationToast');
        toast.textContent = `${latest.channelName}: ${message(latest)}`;
        toast.classList.remove('hidden'); clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.add('hidden'), 6000);
      }
      highestSeen = Math.max(highestSeen || 0, latest?.id || 0);
      element('notificationsError').textContent = '';
      render();
    } catch (error) {
      if (version === requestId && userId) element('notificationsError').textContent = error.message;
    }
  }
  function reset() {
    userId = null; ++requestId; notifications = []; highestSeen = null;
    clearTimeout(toastTimer); element('notificationToast').classList.add('hidden');
    element('notificationsDialog').close(); render();
  }
  element('notificationsButton').addEventListener('click', () => {
    render(); element('notificationsDialog').showModal(); refresh();
  });
  element('closeNotifications').addEventListener('click', () => element('notificationsDialog').close());
  element('notificationsDialog').addEventListener('click', event => {
    if (event.target === element('notificationsDialog')) {
      const box = event.target.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.target.close();
    }
  });
  element('readNotifications').addEventListener('click', async () => {
    const id = userId;
    element('readNotifications').disabled = true;
    try {
      await api('/api/notifications/read', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({throughId: notifications[0]?.id || 0}) });
      if (userId === id) await refresh();
    } catch (error) { element('notificationsError').textContent = error.message; render(); }
  });
  return {refresh, render, reset};
})();
