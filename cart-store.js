/* Shared request basket. Each position has its own key so tabs cannot overwrite other positions. */
(() => {
  const legacy = 'kitradeCatalogSelectionV1';
  const prefix = 'kitradeCartItemV2:';
  const marker = 'kitradeCartMigratedV2';
  const memory = new Map();
  let persistent = true;
  const parse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
  const put = (id, value) => {
    memory.set(String(id), value);
    try { localStorage.setItem(prefix + id, JSON.stringify(value)); } catch { persistent = false; }
  };
  try {
    if (!localStorage.getItem(marker)) {
      const old = parse(localStorage.getItem(legacy), []);
      (Array.isArray(old) ? old : old.ids || []).forEach(id => {
        if (!localStorage.getItem(prefix + id)) put(String(id), { id: String(id), active: true });
      });
      localStorage.setItem(marker, '1');
    }
  } catch { persistent = false; }
  const all = () => {
    try {
      const snapshot = new Map();
      for (let n = 0; n < localStorage.length; n++) {
        const key = localStorage.key(n);
        if (key?.startsWith(prefix)) snapshot.set(key.slice(prefix.length), parse(localStorage.getItem(key), {}));
      }
      if (persistent) memory.clear();
      snapshot.forEach((value, key) => memory.set(key, value));
    } catch { persistent = false; }
    return [...memory.values()].filter(item => item.active).map(item => ({ ...item, quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)) }));
  };
  const notify = () => window.dispatchEvent(new CustomEvent('kitrade:cart-change'));
  window.KITRADE_CART = {
    ids: () => all().map(item => item.id),
    items: all,
    get: id => all().find(item => item.id === String(id)),
    add(product) {
      const id = String(product.id || product.product_id);
      const current = all().find(item => item.id === id);
      put(id, { id, active: true, quantity: current?.quantity || 1, title: product.title, article: product.article || '',
        canonicalPath: product.canonicalPath || product.canonical_path || '/catalog/', addedAt: Date.now() });
      notify();
    },
    changeQuantity(id, delta) {
      const item = all().find(item => item.id === String(id));
      if (!item || !Number.isInteger(delta)) return;
      const quantity = Math.max(0, item.quantity + delta);
      put(String(id), { ...item, quantity, active: quantity > 0 });
      notify();
    },
    consume(products) {
      products.forEach(product => {
        const item = all().find(item => item.id === String(product.product_id));
        if (!item) return;
        const quantity = Math.max(0, item.quantity - (product.quantity || 1));
        put(item.id, { ...item, quantity, active: quantity > 0 });
      });
      notify();
    },
    remove(ids) { [].concat(ids).forEach(id => put(String(id), { id: String(id), active: false })); notify(); },
    get persistent() { return persistent; }
  };
  window.addEventListener('storage', event => {
    if (event.key === null) memory.clear();
    else if (!event.key.startsWith(prefix)) return;
    else if (event.newValue === null) memory.delete(event.key.slice(prefix.length));
    notify();
  });
  window.addEventListener('pageshow', notify);
  window.addEventListener('focus', notify);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') notify();
  });
  const mount = () => {
    document.querySelectorAll('.reference-header-actions, [data-mobile-nav]').forEach(nav => {
      const existing = nav.querySelector('.reference-contact, .mobile-nav-cta');
      if (existing) {
        existing.removeAttribute('data-cart-link');
        existing.dataset.odId = existing.matches('.reference-contact') ? 'header-cart' : 'mobile-header-contact';
        const base = String(window.KITRADE_SITE_CONFIG?.basePath || '').replace(/\/$/, '');
        existing.href = document.querySelector('#contacts') ? '#contacts' : base + '/#contacts';
        existing.textContent = 'Связаться с нами';
        return;
      }
    });
    if (!persistent) {
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = 'Сохранение в браузере недоступно. Корзина сохранится только до закрытия этой страницы.';
      document.querySelector('#requestSelection')?.append(status);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
