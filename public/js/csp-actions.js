const cspActions = {
  'open-navigation': () => openNavigationMenu(),
  'switch-add': () => switchTab('add'),
  'switch-complete': () => switchTab('complete'),
  'switch-list': () => switchTab('list'),
  'reset-list': () => handleResetList(),
  'menu-list': () => runNavigationAction('list'),
  'menu-add': () => runNavigationAction('add'),
  'menu-share': () => runNavigationAction('share'),
  'menu-members': () => runNavigationAction('members'),
  'menu-account': () => runNavigationAction('account'),
  'menu-complete': () => runNavigationAction('complete')
};

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('[data-csp-action]') : null;
  const action = target && cspActions[target.dataset.cspAction];
  if (action) action();
});
