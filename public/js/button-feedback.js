/* Delegation covers current and dynamically rendered buttons without delaying actions. */
(() => {
  const selector = 'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new WeakMap();
  const starts = new WeakMap();
  const control = event => {
    const button = event.target instanceof Element ? event.target.closest(selector) : null;
    return button && !button.matches(':disabled, [aria-disabled="true"]') && !button.closest('[inert]') ? button : null;
  };
  function animate(button) {
    if (reduced.matches || !button.animate) return;
    animations.get(button)?.cancel();
    // Navigation geometry drives the sliding selection: never scale its hit area.
    const frames = button.matches('.nav-item')
      ? [{ filter: 'brightness(.75)' }, { filter: 'brightness(1)' }]
      : [{ scale: '.94', filter: 'brightness(.84)' }, { scale: '1.02', filter: 'brightness(1)' }, { scale: '1', filter: 'brightness(1)' }];
    const animation = button.animate(frames, { duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)', id: 'button-tap-feedback' });
    animations.set(button, animation);
  }
  const iconArt = {
    list: '<g data-motion="list-row" data-row="0"><path d="M12 6h8"/><path data-motion="list-tick" data-row="0" d="m3 6 2 2 4-5"/></g><g data-motion="list-row" data-row="1"><path d="M12 12h8"/><path data-motion="list-tick" data-row="1" d="m3 12 2 2 4-5"/></g><g data-motion="list-row" data-row="2"><path d="M12 18h8"/><path data-motion="list-tick" data-row="2" d="m3 18 2 2 4-5"/></g>',
    channels: '<path d="M7 5V3h6l2 2h6v12h-2"/><path d="M3 8V6h6l2 2h8v12H3Z"/><path data-motion="lid" d="M3 20 5 11h17l-3 9Z"/>',
    add: '<circle cx="12" cy="12" r="9"/><path data-motion="plus" d="M12 7v10M7 12h10"/>',
    members: '<g data-motion="member-left"><circle cx="5" cy="7" r="2.5"/><path d="M1 16v-1c0-3 1.5-4 4-4h1"/></g><g data-motion="member-right"><circle cx="19" cy="7" r="2.5"/><path d="M18 11h1c2.5 0 4 1 4 4v1"/></g><g data-motion="member-center"><circle cx="12" cy="11" r="3"/><path d="M6 21c0-4 2-6 6-6s6 2 6 6"/></g>',
    account: '<circle cx="12" cy="12" r="10"/><g data-motion="avatar"><circle cx="11" cy="8" r="2.7"/><path d="M5.5 19c0-3.5 1.7-6 5.5-6 2 0 3.5.7 4.5 2"/></g><path data-motion="wave" d="M15.5 18v-4.5L18 10"/>'
  };
  function prepareNavIcon(button) {
    const icon = button.querySelector(':scope > i');
    const key = button.dataset.navigationAction || ({ 'nav-list': 'list', 'nav-add': 'add', 'nav-account': 'account' })[button.id];
    if (!icon || !iconArt[key] || icon.dataset.navMotion === key) return icon;
    icon.dataset.navMotion = key;
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + iconArt[key] + '</svg>';
    return icon;
  }
  function animateNavContent(button) {
    const icon = prepareNavIcon(button);
    if (reduced.matches || !icon) return;
    const play = (part, frames, duration = 520, easing = 'cubic-bezier(.22, 1, .36, 1)') => {
      animations.get(part)?.cancel();
      animations.set(part, part.animate(frames, { duration, easing, id: 'button-tap-feedback' }));
    };
    for (const part of icon.querySelectorAll('[data-motion]')) {
      switch (part.dataset.motion) {
        case 'lid': {
          const end = button.classList.contains('active') ? 'rotateX(-28deg)' : 'rotateX(0deg)';
          play(part, [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-48deg)', offset: .55 }, { transform: end }], 600);
          break;
        }
        case 'check': {
          const length = part.getTotalLength();
          play(part, [{ strokeDasharray: String(length), strokeDashoffset: length }, { strokeDasharray: String(length), strokeDashoffset: 0, offset: .8 }, { strokeDasharray: String(length), strokeDashoffset: 0 }]);
          break;
        }
        case 'plus': play(part, [{ transform: 'rotate(-90deg)' }, { transform: 'rotate(0deg)' }]); break;
        case 'member-left':
        case 'member-right': {
          const direction = part.dataset.motion === 'member-left' ? 1 : -1;
          play(part, [
            { transform: `translateX(${direction * 6}px)`, opacity: 0, offset: 0 },
            { transform: `translateX(${direction * 6}px)`, opacity: 0, offset: .12 },
            { transform: 'translateX(0px)', opacity: 1, offset: .42 },
            { transform: 'translateX(0px)', opacity: 1, offset: .72 },
            { transform: `translateX(${direction * 2}px)`, opacity: 1, offset: .86 },
            { transform: 'translateX(0px)', opacity: 1, offset: 1 }
          ], 1100, 'ease-in-out');
          break;
        }
        case 'member-center': play(part, [
          { transform: 'translateX(-3px)', opacity: .25, offset: 0 },
          { transform: 'translateX(3px)', opacity: 1, offset: .25 },
          { transform: 'translateX(0px)', opacity: 1, offset: .48 },
          { transform: 'translateX(0px)', opacity: 1, offset: 1 }
        ], 1100, 'ease-in-out'); break;
        case 'list-row': {
          const start = Number(part.dataset.row) * .18;
          play(part, [
            { transform: 'translateX(-4px)', opacity: .2, offset: 0 },
            { transform: 'translateX(-4px)', opacity: .2, offset: start },
            { transform: 'translateX(0px)', opacity: 1, offset: start + .28 },
            { transform: 'translateX(0px)', opacity: 1, offset: 1 }
          ], 900, 'linear');
          break;
        }
        case 'list-tick': {
          const length = part.getTotalLength();
          const start = .12 + Number(part.dataset.row) * .18;
          play(part, [
            { strokeDasharray: String(length), strokeDashoffset: length, offset: 0 },
            { strokeDasharray: String(length), strokeDashoffset: length, offset: start },
            { strokeDasharray: String(length), strokeDashoffset: 0, offset: start + .22 },
            { strokeDasharray: String(length), strokeDashoffset: 0, offset: 1 }
          ], 900, 'linear');
          break;
        }
        case 'avatar': play(part, [
          { transform: 'translateX(0px)' },
          { transform: 'translateX(-1.5px)', offset: .2 },
          { transform: 'translateX(-1.5px)', offset: .8 },
          { transform: 'translateX(0px)' }
        ], 950, 'ease-in-out'); break;
        case 'wave': play(part, [
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(-35deg)', offset: .18 },
          { transform: 'rotate(18deg)', offset: .34 },
          { transform: 'rotate(-35deg)', offset: .50 },
          { transform: 'rotate(18deg)', offset: .66 },
          { transform: 'rotate(-20deg)', offset: .82 },
          { transform: 'rotate(0deg)' }
        ], 950, 'linear'); break;
      }
    }
  }
  let tappedNav = null, navFrame = null, playedIcon = null;
  function scheduleNavFeedback(button) {
    if (button) { tappedNav = { button, until: performance.now() + 450 }; playedIcon = null; }
    if (!tappedNav || performance.now() > tappedNav.until || navFrame !== null) return;
    navFrame = requestAnimationFrame(() => {
      navFrame = null;
      const icon = tappedNav.button.querySelector(':scope > i');
      if (icon && icon !== playedIcon) { playedIcon = icon; animateNavContent(tappedNav.button); }
    });
  }
  const bottomBar = document.querySelector('.bottom-nav-links');
  if (bottomBar) {
    const prepare = () => bottomBar.querySelectorAll('.nav-item').forEach(prepareNavIcon);
    prepare();
    new MutationObserver(() => { prepare(); scheduleNavFeedback(); }).observe(bottomBar, { childList: true, subtree: true });
  }
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    const button = control(event);
    if (button) { starts.set(button, performance.now()); animate(button); }
  }, true);
  document.addEventListener('keydown', event => {
    if (event.repeat || !['Enter', ' '].includes(event.key)) return;
    const button = control(event);
    if (button) { starts.set(button, performance.now()); animate(button); }
  }, true);
  document.addEventListener('click', event => {
    const button = control(event);
    if (button && performance.now() - (starts.get(button) ?? -Infinity) > 500) animate(button);
    // Shortcut rendering replaces its icon during the click handler. Animate the new one.
    if (button?.matches('.bottom-nav .nav-item')) scheduleNavFeedback(button);
  }, true);
  reduced.addEventListener('change', () => {
    if (reduced.matches) document.getAnimations().filter(animation => animation.id === 'button-tap-feedback').forEach(animation => animation.cancel());
  });
  const share = document.getElementById('shareButton');
  const dialog = document.getElementById('shareDialog');
  if (share && dialog) {
    const sync = () => share.setAttribute('aria-expanded', String(dialog.open));
    new MutationObserver(sync).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    sync();
  }
})();
