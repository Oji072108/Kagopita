(function () {
  const saved = localStorage.getItem('kagopita-theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialDark = saved ? saved === 'dark' : prefersDark;

  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark-mode', dark);
    localStorage.setItem('kagopita-theme', dark ? 'dark' : 'light');
    const button = document.querySelector('[data-theme-toggle]');
    if (button) {
      button.innerHTML = dark
        ? '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
        : '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z"/></svg>';
      button.setAttribute('aria-label', dark ? 'ライトモードに切り替え' : 'ダークモードに切り替え');
      button.title = dark ? 'ライトモード' : 'ダークモード';
    }
  }

  function setup() {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.themeToggle = 'true';
    button.className = 'theme-toggle';
    button.addEventListener('click', () => applyTheme(!document.documentElement.classList.contains('dark-mode')));
    document.body.appendChild(button);
    applyTheme(initialDark);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
