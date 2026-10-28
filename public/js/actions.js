/* Shared request deadlines and a top-layer interaction lock, without changing
   controls' disabled states or blocking periodic background synchronization. */
window.KagopitaActions = (() => {
  const TIMEOUT_MS = 30000;
  const timeoutKey = '処理に30秒以上かかったため、待機を中止しました。最新の状態を確認してから、もう一度お試しください。';
  let intent = null, active = null;
  const overlay = document.createElement('dialog');
  overlay.id = 'actionLoadingDialog';
  overlay.className = 'action-loading-dialog';
  overlay.setAttribute('aria-labelledby', 'actionLoadingLabel');
  overlay.setAttribute('aria-describedby', 'actionLoadingHint');
  overlay.tabIndex = -1;
  overlay.innerHTML = '<div class="action-loading-content" role="status"><span class="action-spinner" aria-hidden="true"></span><strong id="actionLoadingLabel"></strong><p id="actionLoadingHint"></p></div>';
  document.body.append(overlay);
  overlay.addEventListener('cancel', event => event.preventDefault());
  const tr = key => {
    const row = window.kagopitaLocaleRows?.find(row => row[0] === key);
    return row?.[['ja', 'en', 'ko', 'zh', 'es'].indexOf(document.documentElement.lang)] || key;
  };
  function timeoutError() {
    const error = new Error(tr(timeoutKey));
    error.name = 'TimeoutError';
    return error;
  }
  function showError(error) {
    let notice = document.getElementById('actionRequestError');
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'actionRequestError';
      notice.className = 'action-request-error';
      notice.setAttribute('role', 'alert');
    }
    // Keep the error in the accessible subtree, even when another modal is open.
    const dialogs = [...document.querySelectorAll('dialog[open]')].filter(dialog => dialog !== overlay);
    (dialogs.at(-1) || document.body).append(notice);
    notice.dataset.i18nSource = timeoutKey;
    notice.textContent = error.message;
  }
  function start(trigger) {
    const group = { controller: new AbortController(), pending: 0, release: null, trigger,
      previousBusy: trigger?.getAttribute('aria-busy') };
    active = group;
    document.getElementById('actionRequestError')?.remove();
    overlay.querySelector('strong').textContent = tr('処理中…');
    overlay.querySelector('p').textContent = tr('しばらくお待ちください。');
    trigger?.classList.add('is-loading');
    trigger?.setAttribute('aria-busy', 'true');
    document.documentElement.classList.add('action-is-loading');
    overlay.showModal();
    overlay.focus({ preventScroll: true });
    group.timer = setTimeout(() => group.controller.abort(timeoutError()), TIMEOUT_MS);
    return group;
  }
  function finish(group) {
    if (active !== group || group.pending) return;
    clearTimeout(group.timer);
    active = null;
    overlay.close();
    document.documentElement.classList.remove('action-is-loading');
    group.trigger?.classList.remove('is-loading');
    if (group.trigger) {
      if (group.previousBusy === null) group.trigger.removeAttribute('aria-busy');
      else group.trigger.setAttribute('aria-busy', group.previousBusy);
    }
    document.dispatchEvent(new Event('kagopita:idle'));
  }
  async function request(task, { signal: callerSignal, foreground = Boolean(intent || active) } = {}) {
    const group = foreground ? active || start(intent?.trigger) : null;
    if (group) { clearTimeout(group.release); group.pending++; }
    const controller = new AbortController();
    const sources = [callerSignal, group?.controller.signal].filter(Boolean);
    const abort = event => controller.abort(event.target.reason);
    for (const signal of sources) {
      if (signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener('abort', abort, { once: true });
    }
    const timer = group ? null : setTimeout(() => controller.abort(timeoutError()), TIMEOUT_MS);
    let rejectAbort;
    const canceled = new Promise((_, reject) => { rejectAbort = () => reject(controller.signal.reason); });
    controller.signal.addEventListener('abort', rejectAbort, { once: true });
    try {
      controller.signal.throwIfAborted();
      return await Promise.race([task(controller.signal), canceled]);
    } catch (error) {
      if (error?.name === 'TimeoutError' && group && !group.timeoutShown) {
        group.timeoutShown = true;
        // Show after the loading layer has been dismissed and handlers have settled.
        setTimeout(() => showError(error), 0);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', rejectAbort);
      for (const signal of sources) signal.removeEventListener('abort', abort);
      if (group && --group.pending === 0) {
        // Keep sequential await api(...) calls in the same 30-second action.
        group.release = setTimeout(() => finish(group), 0);
      }
    }
  }
  function capture(event) {
    if (active) {
      event.preventDefault(); event.stopImmediatePropagation();
      return;
    }
    if (!['click', 'submit', 'change'].includes(event.type)) return;
    const trigger = event.submitter || event.target.closest?.('button, input[type="submit"], a, summary, select');
    if (!trigger) return;
    if (trigger.matches('.custom-select-trigger, #notificationsButton')) { intent = null; return; }
    const destination = trigger.dataset.navigationAction || trigger.dataset.menuTab || (trigger.id === 'nav-list' ? 'list' : null);
    if (['list', 'members'].includes(destination)) { intent = null; return; }
    const entry = { trigger };
    intent = entry;
    setTimeout(() => { if (intent === entry) intent = null; }, 0);
    trigger.classList.add('action-pressed');
    setTimeout(() => trigger.classList.remove('action-pressed'), 180);
  }
  for (const type of ['pointerdown', 'click', 'dblclick', 'submit', 'keydown', 'keyup', 'beforeinput', 'change']) {
    window.addEventListener(type, capture, { capture: true, passive: false });
  }
  // A handler may open an ordinary dialog after its response; keep loading on top
  // until all related requests finish. Ignore our own dialog's mutations.
  new MutationObserver(records => {
    if (active && records.some(record => record.target !== overlay && record.target.open)) {
      overlay.close(); overlay.showModal(); overlay.focus({ preventScroll: true });
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  return { request, get busy() { return Boolean(active); } };
})();
