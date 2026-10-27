(function () {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = localStorage.getItem('kagopita-theme');
  const icon = content => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
  function labels() {
    const button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    const dark = document.documentElement.classList.contains('dark-mode');
    const translate = text => {
      const row = window.kagopitaLocaleRows?.find(row => row[0] === text);
      return row?.[['ja','en','ko','zh','es'].indexOf(document.documentElement.lang)] || text;
    };
    button.setAttribute('aria-label', translate('ダークモード'));
    button.setAttribute('aria-checked', String(dark));
    button.title = translate(dark ? 'ライトモードに切り替え' : 'ダークモードに切り替え');
  }
  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark-mode', dark);
    document.body.classList.toggle('dark-mode', dark);
    labels();
  }
  function setup() {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.themeToggle = 'true';
    button.className = 'theme-toggle';
    button.setAttribute('role', 'switch');
    button.innerHTML = '<span class="theme-toggle-thumb" aria-hidden="true"></span>'
      + '<span class="theme-toggle-sun" aria-hidden="true">' + icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>') + '</span>'
      + '<span class="theme-toggle-moon" aria-hidden="true">' + icon('<path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z"/>') + '</span>';
    button.addEventListener('click', () => {
      const dark = !document.documentElement.classList.contains('dark-mode');
      preference = dark ? 'dark' : 'light';
      localStorage.setItem('kagopita-theme', preference);
      applyTheme(dark);
    });
    document.querySelector('.header-actions').appendChild(button);
    applyTheme(preference ? preference === 'dark' : media.matches);
    new MutationObserver(labels).observe(document.documentElement, {attributes:true,attributeFilter:['lang']});
    media.addEventListener('change', event => { if (!preference) applyTheme(event.matches); });
    window.addEventListener('storage', event => {
      if (event.key !== 'kagopita-theme') return;
      preference = event.newValue;
      applyTheme(preference ? preference === 'dark' : media.matches);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
