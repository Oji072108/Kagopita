/* One moving selection surface; navigation and accessible state stay in app.js. */
(() => {
  const bar = document.querySelector('.bottom-nav');
  const links = bar?.querySelector('.bottom-nav-links');
  if (!links) return;
  let frame;
  const update = () => {
    frame = null;
    const selected = links.querySelector('.nav-item.active:not(.hidden)');
    if (!selected || !selected.getClientRects().length) {
      links.style.setProperty('--selection-visible', '0');
      return;
    }
    const parent = links.getBoundingClientRect();
    const rect = selected.getBoundingClientRect();
    links.style.setProperty('--selection-x', `${rect.left - parent.left}px`);
    links.style.setProperty('--selection-y', `${rect.top - parent.top}px`);
    links.style.setProperty('--selection-width', `${rect.width}px`);
    links.style.setProperty('--selection-height', `${rect.height}px`);
    links.style.setProperty('--selection-visible', '1');
    // Place the first highlight immediately, then animate subsequent selections.
    if (!links.classList.contains('selection-ready')) {
      requestAnimationFrame(() => links.classList.add('selection-ready'));
    }
  };
  const schedule = () => { if (frame == null) frame = requestAnimationFrame(update); };
  new MutationObserver(schedule).observe(bar, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-current']
  });
  const resize = new ResizeObserver(schedule);
  resize.observe(links);
  links.querySelectorAll('.nav-item').forEach(button => resize.observe(button));
  window.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
})();
