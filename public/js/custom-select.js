/* Keep native selects as the data/form source, with a consistent accessible UI. */
(() => {
  let opened = null;
  document.querySelectorAll('select').forEach(select => {
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    select.before(wrapper);
    wrapper.append(select);
    select.classList.add('custom-select-source');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.id = select.id + '-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const label = document.querySelector(`label[for="${select.id}"]`);
    if (label) {
      label.htmlFor = trigger.id;
      label.id ||= select.id + '-label';
      trigger.setAttribute('aria-labelledby', label.id + ' ' + trigger.id + '-value');
    }
    const value = document.createElement('span');
    value.id = trigger.id + '-value';
    const chevron = document.createElement('i');
    chevron.className = 'custom-select-chevron ph-bold ph-caret-down';
    chevron.setAttribute('aria-hidden', 'true');
    trigger.append(value, chevron);
    const list = document.createElement('div');
    list.className = 'custom-select-options';
    list.id = select.id + '-options';
    list.hidden = true;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', label?.textContent || select.getAttribute('aria-label') || '選択');
    if (!label && select.hasAttribute('aria-label')) trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
    trigger.setAttribute('aria-controls', list.id);
    wrapper.append(trigger, list);
    function close(restoreFocus = false) {
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      wrapper.classList.remove('is-open');
      if (opened?.wrapper === wrapper) opened = null;
      if (restoreFocus) trigger.focus();
    }
    function sync() {
      value.textContent = select.selectedOptions[0]?.textContent || '選択してください';
      value.dataset.i18nIgnore = select.selectedOptions[0]?.dataset.i18nIgnore || 'false';
      value.dataset.i18nSource = select.selectedOptions[0]?.dataset.i18nSource || select.selectedOptions[0]?.textContent || '選択してください';
      trigger.disabled = select.disabled;
      list.replaceChildren(...Array.from(select.options, option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'custom-select-option';
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(option.selected));
        button.tabIndex = -1;
        button.disabled = option.disabled;
        button.textContent = option.textContent;
        button.dataset.i18nIgnore = option.dataset.i18nIgnore || 'false';
        button.dataset.i18nSource = option.dataset.i18nSource || option.textContent;
        button.addEventListener('click', () => {
          select.value = option.value;
          select.dispatchEvent(new Event('change', {bubbles: true}));
          sync();
          close(true);
        });
        return button;
      }));
    }
    function open(last = false) {
      opened?.close();
      sync();
      list.hidden = false;
      wrapper.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      opened = {wrapper, close};
      // Respect the dialog's scroll viewport as well as the browser viewport.
      const rect = trigger.getBoundingClientRect();
      const dialog = select.closest('dialog, .header-navigation');
      const bounds = dialog?.getBoundingClientRect();
      const bottom = Math.min(innerHeight - 12, bounds ? bounds.bottom - 18 : innerHeight - 12);
      const top = Math.max(12, bounds ? bounds.top + 18 : 12);
      const below = bottom - rect.bottom - 6;
      const above = rect.top - top - 6;
      const flip = below < 220 && above > below;
      wrapper.classList.toggle('opens-up', flip);
      list.style.maxHeight = Math.min(240, Math.max(88, flip ? above : below)) + 'px';
      const options = Array.from(list.querySelectorAll('button:not(:disabled)'));
      (last ? options.at(-1) : list.querySelector('[aria-selected="true"]:not(:disabled)') || options[0])?.focus({preventScroll: true});
    }
    trigger.addEventListener('click', () => list.hidden ? open() : close());
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault(); open(event.key === 'ArrowUp');
      }
    });
    list.addEventListener('keydown', event => {
      const options = Array.from(list.querySelectorAll('button:not(:disabled)'));
      const index = options.indexOf(document.activeElement);
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next]?.focus();
      }
    });
    // Safari can report a null focus destination while tapping the trigger.
    // Close on actual outside focus, not that temporary blur (which reopened it).
    document.addEventListener('focusin', event => {
      if (!wrapper.contains(event.target)) close();
    });
    select.addEventListener('change', sync);
    select.form?.addEventListener('reset', () => setTimeout(sync, 0));
    new MutationObserver(sync).observe(select, {childList: true, subtree: true, attributes: true});
    // Programmatic selections (edit dialogs / reset shortcuts) must update the label too.
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(select, 'value', {
      get() { return descriptor.get.call(this); },
      set(next) { descriptor.set.call(this, next); sync(); }
    });
    select.closest('dialog')?.addEventListener('close', () => close());
    sync();
  });
  document.addEventListener('pointerdown', event => {
    if (opened && !opened.wrapper.contains(event.target)) opened.close();
  });

  // Re-measure from the inherited font every time, so short labels and wider
  // layouts immediately regain their default size. Keep the touch target intact.
  const labels = document.querySelectorAll(
    ':is(.custom-select-trigger, .category-picker-trigger, .language-trigger) > span:first-child'
  );
  let fitFrame;
  function fitLabels() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      labels.forEach(label => {
        label.style.removeProperty('font-size');
        if (!label.clientWidth) return; // A hidden panel is measured on reveal.
        const defaultSize = parseFloat(getComputedStyle(label).fontSize);
        if (label.scrollWidth > label.clientWidth) {
          const fittedSize = Math.max(10, Math.floor(
            defaultSize * (label.clientWidth - 1) / label.scrollWidth * 10
          ) / 10);
          label.style.fontSize = fittedSize + 'px';
        }
      });
    });
  }
  const labelResize = new ResizeObserver(fitLabels);
  const labelText = new MutationObserver(fitLabels);
  labels.forEach(label => {
    labelResize.observe(label.parentElement);
    labelText.observe(label, {childList: true, characterData: true, subtree: true});
  });
  window.addEventListener('resize', fitLabels);
  document.fonts?.ready.then(fitLabels);
  document.fonts?.addEventListener('loadingdone', fitLabels);
  fitLabels();
})();
