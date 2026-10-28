/* Acceptance is scoped to the displayed version. Acknowledging an update is not consent. */
(() => {
  const byId = id => document.getElementById(id);
  const dialog = byId('termsDialog');
  const documentView = byId('termsDocument');
  let terms = null, origin = null, readVersion = null, loading = null, previousFocus = null;
  const read = new Map();
  const blocks = [...document.querySelectorAll('[data-terms-consent]')];
  const tr = text => window.translateFeature ? window.translateFeature(text) : text;
  function updateButtons() {
    for (const block of blocks) {
      const key = block.dataset.termsConsent;
      const checkbox = block.querySelector('input');
      checkbox.disabled = !terms || read.get(key) !== terms.version;
      if (checkbox.disabled) checkbox.checked = false;
      block.closest('form').querySelector('[type="submit"]').disabled = checkbox.disabled || !checkbox.checked || block.closest('form').dataset.termsSubmitting === 'true';
    }
  }
  function localizedTerms() {
    const language = document.documentElement.lang || 'ja';
    const content = terms.translations?.[language];
    return { language: content ? language : 'ja', content: content || terms };
  }
  function renderSummary() {
    if (!terms) return;
    const { language, content } = localizedTerms();
    byId('termsUpdateSummary').lang = language;
    byId('termsUpdateSummary').textContent = `${terms.updatedAt} · ${content.summary}`;
  }
  function renderDocument() {
    const { language, content } = localizedTerms();
    documentView.lang = language;
    byId('termsTitle').lang = language;
    byId('termsTitle').textContent = content.title;
    documentView.replaceChildren();
    for (const section of content.sections) {
      const heading = document.createElement('h3'), paragraph = document.createElement('p');
      heading.textContent = section.heading; paragraph.textContent = section.body;
      documentView.append(heading, paragraph);
    }
    readVersion = null;
    documentView.scrollTop = 0;
    byId('termsReadDone').disabled = true;
    byId('termsReadDone').classList.toggle('hidden', !origin);
    byId('termsReadStatus').textContent = origin ? tr('最後までスクロールして内容を確認してください。') : '';
    requestAnimationFrame(checkEnd);
  }
  function checkEnd() {
    if (!dialog.open || !terms || !origin) return;
    if (documentView.scrollHeight - documentView.clientHeight - documentView.scrollTop <= 4) {
      readVersion = terms.version;
      byId('termsReadDone').disabled = false;
      byId('termsReadStatus').textContent = tr('内容を確認したら、下のボタンで登録画面に戻ってください。');
    }
  }
  async function refresh() {
    if (loading) return loading;
    loading = (async () => {
      try {
        const next = await window.KagopitaActions.request(async signal => {
          const response = await fetch('/api/terms', { cache: 'no-store', signal });
          if (!response.ok) throw Error('Terms unavailable');
          const data = await response.json();
          signal.throwIfAborted();
          return data;
        });
        if (!next.version || !Array.isArray(next.sections)) throw Error('Invalid terms');
        const changed = terms && terms.version !== next.version;
        terms = next;
        if (changed) {
          read.clear(); updateButtons();
          if (dialog.open) renderDocument();
        }
        byId('termsUpdateNotice').classList.toggle('hidden', !next.notify);
        renderSummary();
      } catch {
        // An already-read copy can stay on screen, but first-time consent fails closed.
        if (!terms) for (const block of blocks) block.querySelector('.terms-error').textContent = tr('利用規約を読み込めません。もう一度お試しください。');
      } finally { loading = null; updateButtons(); }
    })();
    return loading;
  }
  async function open(key = null) {
    previousFocus = document.activeElement;
    try {
      await window.KagopitaActions.request(async signal => {
        await refresh();
        signal.throwIfAborted();
        if (!terms) return;
        origin = key; renderDocument(); dialog.showModal(); documentView.scrollTop = 0; requestAnimationFrame(checkEnd);
      });
    } catch { /* The shared timeout notice explains how to retry. */ }
  }
  for (const block of blocks) {
    block.querySelector('.terms-open').addEventListener('click', () => open(block.dataset.termsConsent));
    block.querySelector('input').addEventListener('change', () => { block.querySelector('.terms-error').textContent = ''; updateButtons(); });
  }
  byId('termsReadDone').addEventListener('click', () => {
    if (!origin || readVersion !== terms?.version) return;
    read.set(origin, terms.version); updateButtons(); dialog.close();
    document.querySelector(`[data-terms-consent="${origin}"] input`).focus();
  });
  byId('termsClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (origin && read.get(origin) === terms?.version) return;
    previousFocus?.focus();
  });
  documentView.addEventListener('scroll', checkEnd);
  new ResizeObserver(checkEnd).observe(documentView);
  byId('termsUpdateRead').addEventListener('click', () => open());
  byId('termsUpdateDismiss').addEventListener('click', async () => {
    if (!terms) return;
    try {
      const response = await window.KagopitaActions.request(signal => fetch('/api/terms/seen', { signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: terms.version }) }));
      if (!response.ok) { await refresh(); return; }
      byId('termsUpdateNotice').classList.add('hidden');
    } catch { /* Leave the notice visible so it can be retried. */ }
  });
  window.KagopitaTerms = {
    refresh, sync: updateButtons,
    requireAcceptance(key) {
      const block = document.querySelector(`[data-terms-consent="${key}"]`);
      const accepted = terms && read.get(key) === terms.version && block.querySelector('input').checked;
      if (!accepted) {
        block.querySelector('.terms-error').textContent = tr('最新の利用規約を最後まで確認し、同意してください。');
        block.querySelector('.terms-open').focus();
      }
      return Boolean(accepted);
    },
    acceptance(key) { return { termsAccepted: Boolean(terms && read.get(key) === terms.version && document.querySelector(`[data-terms-consent="${key}"] input`).checked), termsVersion: terms?.version }; }
  };
  let displayedLanguage = document.documentElement.lang;
  new MutationObserver(() => {
    const language = document.documentElement.lang;
    if (language === displayedLanguage) return;
    displayedLanguage = language;
    renderSummary();
    if (terms && dialog.open) renderDocument();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  updateButtons(); refresh();
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
})();
