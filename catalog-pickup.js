(() => {
  const card = document.querySelector('[data-od-id="catalog-pickup-card"]');
  if (!card) return;
  const mobile = matchMedia('(max-width: 1199px)');
  const key = 'kitradePickupSeenV1';
  let shown = false, elapsed = 0, previous = Date.now();
  try { shown = sessionStorage.getItem(key) === '1'; } catch {}
  const anchor = document.createComment('pickup-card-position');
  card.before(anchor);
  const popup = document.createElement('section');
  popup.className = 'catalog-pickup-popup';
  popup.dataset.odId = 'catalog-pickup-popup';
  popup.setAttribute('aria-label', 'Помощь с подбором запчасти');
  popup.hidden = true;
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'catalog-pickup-dismiss';
  close.dataset.odId = 'catalog-pickup-close';
  close.setAttribute('aria-label', 'Закрыть предложение подбора');
  close.textContent = '×';
  popup.append(close);
  document.documentElement.append(popup);
  const blocked = () => document.visibilityState === 'hidden' ||
    document.querySelector('dialog[open], .kit-cookie-banner:not([hidden])') ||
    ['menu-open', 'catalog-filter-open', 'catalog-request-open'].some(name => document.body.classList.contains(name));
  function dismiss() {
    const hadFocus = popup.contains(document.activeElement);
    popup.hidden = true;
    if (hadFocus) document.querySelector('[data-menu-toggle]')?.focus({ preventScroll: true });
  }
  function sync() {
    if (mobile.matches) { if (card.parentElement !== popup) popup.append(card); }
    else { dismiss(); anchor.after(card); }
  }
  sync(); mobile.addEventListener('change', sync);
  close.addEventListener('click', dismiss);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !popup.hidden) dismiss(); });
  new MutationObserver(() => { if (!popup.hidden && blocked()) dismiss(); })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('kitrade:open-basket', dismiss);
  document.addEventListener('visibilitychange', () => { previous = Date.now(); if (document.hidden) dismiss(); });
  const timer = setInterval(() => {
    const now = Date.now(), delta = Math.min(now - previous, 1500); previous = now;
    if (shown) { clearInterval(timer); return; }
    if (!mobile.matches || blocked()) return;
    elapsed += delta;
    if (elapsed < 20000) return;
    shown = true;
    try { sessionStorage.setItem(key, '1'); } catch {}
    popup.hidden = false;
    clearInterval(timer);
  }, 1000);
})();
