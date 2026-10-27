/* One connection per page, with catch-up for mobile sleep and missed events. */
window.KagopitaLiveUpdates = (() => {
  let source = null, timer = null, poll = null, refresh = null, notify = null;
  let running = false, pending = false, generation = 0;
  function schedule() {
    if (!refresh) return;
    pending = true;
    if (document.hidden || running || timer) return;
    timer = setTimeout(flush, 100);
  }
  async function flush() {
    timer = null;
    if (!refresh || document.hidden) return;
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
    if (event.type === 'membership-removed') {
      try { notify?.(JSON.parse(event.data)); } catch (error) { console.error(error); }
    }
    schedule();
  }
  function resume() { if (!document.hidden) schedule(); }
  function stop() {
    generation++;
    source?.close(); source = null;
    clearTimeout(timer); clearInterval(poll);
    timer = poll = refresh = notify = null;
    pending = running = false;
    window.removeEventListener('focus', resume);
    window.removeEventListener('online', resume);
    document.removeEventListener('visibilitychange', resume);
  }
  function start(onRefresh, onRemoved) {
    if (refresh) return;
    refresh = onRefresh; notify = onRemoved;
    if (window.EventSource) {
      source = new EventSource('/api/events');
      for (const type of ['update', 'channels', 'channel-completed', 'membership-removed']) source.addEventListener(type, receive);
      source.addEventListener('open', schedule);
      source.addEventListener('error', schedule);
    }
    // Also catches proxies that buffer an apparently healthy event stream.
    poll = setInterval(schedule, 15000);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    schedule();
  }
  return { start, stop };
})();
