/* Accessible, themed replacements for browser confirmations and alerts. */
window.KagopitaDialogs = (() => {
  const queue = [];
  let active = false;
  function translate(text, values = {}) {
    const language = document.documentElement.lang || 'ja';
    const row = window.kagopitaLocaleRows.find(row => row[0] === text);
    let result = row?.[['ja', 'en', 'ko', 'zh', 'es'].indexOf(language)] || window.translateFeature?.(text) || text;
    for (const [key, value] of Object.entries(values)) result = result.replaceAll(`{${key}}`, () => value);
    return result;
  }
  function next() {
    if (active || !queue.length) return;
    active = true;
    const { options, resolve } = queue.shift();
    const dialog = document.getElementById('actionDialog');
    const cancel = document.getElementById('actionDialogCancel');
    const submit = document.getElementById('actionDialogSubmit');
    const error = document.getElementById('actionDialogError');
    const icon = document.getElementById('actionDialogIcon');
    const previousFocus = document.activeElement;
    let busy = false;
    dialog.dataset.tone = options.danger ? 'danger' : 'info';
    document.getElementById('actionDialogTitle').textContent = translate(options.title);
    document.getElementById('actionDialogBody').textContent = translate(options.body, options.values);
    icon.className = `ph ${options.danger ? 'ph-warning-circle' : 'ph-info'}`;
    error.textContent = '';
    cancel.textContent = translate('キャンセル');
    cancel.hidden = !options.onConfirm;
    submit.textContent = translate(options.confirmLabel || '閉じる');
    submit.className = `btn ${options.danger ? 'btn-danger' : 'btn-primary'}`;
    submit.disabled = cancel.disabled = false;
    dialog.setAttribute('aria-busy', 'false');
    const finish = result => { dialog.close(); resolve(result); };
    cancel.onclick = () => finish(false);
    submit.onclick = async () => {
      if (busy) return;
      if (!options.onConfirm) return finish(true);
      busy = true;
      submit.disabled = cancel.disabled = true;
      dialog.setAttribute('aria-busy', 'true');
      submit.textContent = translate('処理中…');
      error.textContent = '';
      try {
        await options.onConfirm();
        finish(true);
      } catch (failure) {
        error.textContent = translate(failure.message || '処理できませんでした。もう一度お試しください。');
      } finally {
        busy = false;
        submit.disabled = cancel.disabled = false;
        dialog.setAttribute('aria-busy', 'false');
        submit.textContent = translate(options.confirmLabel || '閉じる');
      }
    };
    dialog.oncancel = event => { event.preventDefault(); if (!busy) finish(false); };
    dialog.onclick = event => {
      if (event.target !== dialog || busy) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) finish(false);
    };
    dialog.onclose = () => {
      resolve(false);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      active = false;
      next();
    };
    dialog.showModal();
    (options.onConfirm ? cancel : submit).focus({ preventScroll: true });
  }
  function show(options) {
    return new Promise(resolve => { queue.push({ options, resolve }); next(); });
  }
  return { show, notice: body => show({ title: 'お知らせ', body }) };
})();
