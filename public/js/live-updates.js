/* One connection per page, with catch-up for mobile sleep and missed events. */
window.KagopitaLiveUpdates = (() => {
  let source = null, timer = null, refresh = null, notify = null;
  let running = false, pending = false, generation = 0;
  function schedule() {
    if (!refresh) return;
    pending = true;
    if (document.hidden || navigator.onLine === false || document.querySelector('dialog[open]') || window.KagopitaActions?.busy || running || timer) return;
    timer = setTimeout(flush, 100);
  }
  async function flush() {
    timer = null;
    if (!refresh || document.hidden || navigator.onLine === false || document.querySelector('dialog[open]') || window.KagopitaActions?.busy) return;
    const version = generation;
    pending = false; running = true;
    try { await refresh(); }
    catch (error) { console.error('Could not synchronize live updates.', error); }
    finally {
      if (version === generation) {
        running = false;
        if (pending) schedule();
      }
    }
  }
  function receive(event) {
    if (event.type === 'notifications') { window.KagopitaNotifications?.refresh(); return; }
    if (event.type === 'membership-removed') {
      try { notify?.(JSON.parse(event.data)); } catch (error) { console.error(error); }
    }
    schedule();
  }
  function connect() {
    if (source || !window.EventSource || document.hidden || navigator.onLine === false) return;
    source = new EventSource('/api/events');
    for (const type of ['update', 'channels', 'channel-completed', 'membership-removed', 'notifications']) source.addEventListener(type, receive);
    source.addEventListener('open', schedule);
    // EventSource reconnects automatically; catch up once it opens again.
    // No periodic list downloads, even while disconnected.
  }
  function resume() {
    if (document.hidden || navigator.onLine === false) {
      source?.close(); source = null;
      clearTimeout(timer); timer = null;
      return;
    }
    connect();
    schedule();
  }
  function drain() { if (pending) schedule(); }
  function stop() {
    generation++;
    source?.close(); source = null;
    clearTimeout(timer);
    timer = refresh = notify = null;
    pending = running = false;
    window.removeEventListener('focus', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener('offline', resume);
    document.removeEventListener('visibilitychange', resume);
    document.removeEventListener('close', drain, true);
    document.removeEventListener('kagopita:idle', drain);
  }
  function start(onRefresh, onRemoved) {
    if (refresh) return;
    refresh = onRefresh; notify = onRemoved;
    connect();
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', resume);
    document.addEventListener('visibilitychange', resume);
    document.addEventListener('close', drain, true);
    document.addEventListener('kagopita:idle', drain);
    schedule();
  }
  return { start, stop };
})();
