(() => {
  const cart = window.KITRADE_CART;
  if (!cart) return;
  const products = new Map((window.KITRADE_CATALOG_DATA?.items || []).map(item => [String(item.id), item]));
  const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const money = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
  let drawer, returnY, opener;
  function render() {
    if (!drawer) return;
    const list = drawer.querySelector('[data-basket-list]');
    const scroll = list.scrollTop;
    const active = document.activeElement;
    const activeId = active?.dataset.basketItem;
    const activeAction = active?.dataset.basketAction;
    let total = 0, units = 0, unknown = false;
    const entries = cart.items();
    list.innerHTML = entries.length ? entries.map(entry => {
      const product = products.get(entry.id) || entry;
      const price = Number(String(product.price || '').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      const photo = product.photos?.[0];
      const title = product.title || `Позиция ${entry.id}`;
      total += price * entry.quantity; units += entry.quantity; unknown ||= !price;
      return `<article class="basket-row" data-od-id="basket-item-${escape(entry.id)}">
        <div class="basket-row-photo">${photo ? `<img src="${escape(photo)}" alt="${escape(title)}" loading="lazy">` : '<span>Фото уточняется</span>'}</div>
        <div class="basket-row-info"><h3>${escape(title)}</h3>
          <p>${price ? money(price) + ' за шт.' : 'Цена уточняется'}</p>
          <div class="basket-row-actions"><div class="basket-stepper" role="group" aria-label="Количество: ${escape(title)}">
            <button type="button" data-basket-item="${escape(entry.id)}" data-basket-action="minus" aria-label="Уменьшить количество">−</button>
            <output>${entry.quantity}</output>
            <button type="button" data-basket-item="${escape(entry.id)}" data-basket-action="plus" aria-label="Увеличить количество">+</button>
          </div><button class="basket-remove" type="button" data-basket-item="${escape(entry.id)}" data-basket-action="remove">Удалить</button></div>
        </div><strong class="basket-row-total">${price ? money(price * entry.quantity) : 'По запросу'}</strong>
      </article>`;
    }).join('') : '<div class="basket-empty"><h3>В корзине пока пусто</h3><p>Вернитесь в каталог и добавьте нужные детали.</p><button type="button" data-basket-close>Вернуться в каталог</button></div>';
    drawer.querySelector('[data-basket-count]').textContent = `Позиций: ${entries.length} · Количество: ${units} шт.`;
    drawer.querySelector('[data-basket-total]').textContent = total ? (unknown ? 'от ' : '') + money(total) : 'По запросу';
    drawer.querySelector('[data-basket-checkout]').disabled = !entries.length;
    list.scrollTop = scroll;
    if (activeId) {
      const next = [...list.querySelectorAll('[data-basket-item]')].find(button => button.dataset.basketItem === activeId && button.dataset.basketAction === activeAction);
      (next || drawer.querySelector('[data-basket-close]')).focus({ preventScroll: true });
    }
    list.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.parentElement.textContent = 'Фото уточняется'; }, { once: true }));
  }
  function open() {
    if (!drawer) {
      drawer = document.createElement('dialog');
      drawer.className = 'basket-drawer';
      drawer.dataset.odId = 'basket-drawer';
      drawer.setAttribute('aria-labelledby', 'basket-drawer-title');
      drawer.innerHTML = `<div class="basket-drawer-shell">
        <header class="basket-drawer-head"><div><h2 id="basket-drawer-title">Ваша корзина</h2><p data-basket-count></p></div><button type="button" class="basket-close" data-basket-close aria-label="Закрыть корзину"><span></span></button></header>
        <div class="basket-drawer-list" data-basket-list></div>
        <footer class="basket-drawer-footer"><div class="basket-summary"><span>Стоимость деталей</span><strong data-basket-total></strong></div><p>Доставка рассчитывается отдельно. Минимальный заказ — 50 000 ₽.</p><button type="button" class="basket-checkout" data-basket-checkout>Перейти к оформлению →</button></footer>
      </div>`;
      document.documentElement.append(drawer);
      drawer.addEventListener('click', event => {
        if (event.target === drawer || event.target.closest('[data-basket-close]')) { drawer.close(); return; }
        const action = event.target.closest('[data-basket-action]');
        if (action) {
          if (action.dataset.basketAction === 'remove') cart.remove(action.dataset.basketItem);
          else cart.changeQuantity(action.dataset.basketItem, action.dataset.basketAction === 'plus' ? 1 : -1);
        }
        if (event.target.closest('[data-basket-checkout]') && cart.ids().length) {
          drawer.close();
          window.dispatchEvent(new CustomEvent('kitrade:open-request'));
          if (document.querySelector('#request')?.dataset.requestStep !== '2') document.querySelector('#requestSubmit')?.click();
          document.querySelector('#requestCustomerName')?.focus({ preventScroll: true });
        }
      });
      drawer.addEventListener('close', () => {
        document.documentElement.classList.remove('basket-drawer-open');
        window.scrollTo(0, returnY);
        if (!document.body.classList.contains('catalog-request-open')) opener?.focus({ preventScroll: true });
      });
    }
    returnY = window.scrollY;
    opener = document.activeElement;
    render();
    document.documentElement.classList.add('basket-drawer-open');
    drawer.showModal();
    drawer.querySelector('[data-basket-close]').focus({ preventScroll: true });
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-basket-expand]')) { event.preventDefault(); open(); }
  });
  window.addEventListener('kitrade:cart-change', () => { if (drawer?.open) render(); });
  window.addEventListener('kitrade:open-basket', open);
})();
