/* Populate only with real responsive Display ad slot IDs from this publisher's AdSense account. */
(() => {
  'use strict';
  const publisher = 'ca-pub-5805938506004625';
  const slots = Object.freeze({
    'below-header': '',
    'below-list': '',
    'page-bottom': ''
  });
  // No slots: no ad elements, queue pushes, or empty spaces. The head owns the sole loader.
  const prepare = container => {
    const slot = slots[container.dataset.adPlacement];
    if (!/^\d+$/.test(slot || '') || container.dataset.adInitialized === 'true') return;
    container.dataset.adInitialized = 'true';
    const unit = document.createElement('ins');
    unit.className = 'adsbygoogle';
    unit.dataset.adClient = publisher;
    unit.dataset.adSlot = slot;
    unit.dataset.adFormat = 'auto';
    unit.dataset.fullWidthResponsive = 'true';
    container.append(unit);
    const sync = () => {
      const filled = unit.getAttribute('data-ad-status') === 'filled';
      container.classList.toggle('is-filled', filled);
      container.setAttribute('aria-hidden', String(!filled));
    };
    new MutationObserver(sync).observe(unit, { attributes: true, attributeFilter: ['data-ad-status'] });
    container.hidden = false;
    sync();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Blocked/unavailable advertising must not interfere with shopping or authentication.
      container.hidden = true;
    }
  };
  const containers = [...document.querySelectorAll('.ad-container[data-ad-placement]')];
  // Hidden SPA views have no usable width; wait until they are actually visible.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.target.getBoundingClientRect().width < 1) continue;
        prepare(entry.target);
        observer.unobserve(entry.target);
      }
    });
    for (const container of containers) {
      if (!/^\d+$/.test(slots[container.dataset.adPlacement] || '')) continue;
      container.hidden = false;
      observer.observe(container);
    }
  }
})();
