(() => {
  const sitePath = (value) => {
    const path = String(value || "/");
    const base = String(window.KITRADE_SITE_CONFIG?.basePath || "").replace(/\/$/, "");
    return base && path.startsWith("/") && !path.startsWith(`${base}/`) ? `${base}${path}` : path;
  };
  const source = Array.isArray(window.KITRADE_CATALOG_DATA?.items) ? window.KITRADE_CATALOG_DATA.items : [];
  const itemsById = new Map(source.map((item) => [String(item.id), item]));
  let dialog;
  let activeItem;
  let returnFocus;
  let returnY = 0;
  const closeView = () => {
    if (history.state?.kitradeProduct) history.back();
    else dialog?.close();
  };
  window.addEventListener('popstate', () => {
    if (history.state?.kitradeProduct) {
      const item = itemsById.get(String(history.state.kitradeProduct));
      if (item && !dialog?.open) openQuickView(item, false);
    } else if (dialog?.open) dialog.close();
  });

  const normalizePhoto = (url) => {
    const value = String(url || "").trim();
    if (!value) return "";
    const match = value.match(/[?&]imageSlug=([^&]+)/);
    if (match) return `https://80.img.avito.st${decodeURIComponent(match[1])}`;
    return value.replace(/^http:\/\//i, "https://");
  };

  const fallbackPhoto = (item) => {
    const subject = [item.title, item.detail, item.category].filter(Boolean).join(" ").toLocaleLowerCase("ru");
    if (/фар|фонар|оптик/.test(subject)) return sitePath("/assets/01-catalog-led-headlamp.png");
    if (/крыл/.test(subject)) return sitePath("/assets/02-catalog-front-fender.png");
    if (/реш[её]тк|бампер/.test(subject)) return sitePath("/assets/03-catalog-lower-grille.png");
    return "";
  };

  const formatPrice = (value) => {
    const price = Number(String(value || "").replace(/[^\d.,]/g, "").replace(",", "."));
    return price ? `${new Intl.NumberFormat("ru-RU").format(price)} ₽` : "Цена по запросу";
  };

  function createDialog() {
    const element = document.createElement("dialog");
    element.className = "product-quick-view";
    element.dataset.odId = "product-fullscreen";
    element.setAttribute("aria-labelledby", "product-quick-view-title");
    element.innerHTML = `
      <div class="product-quick-view__shell">
        <button class="product-quick-view__back" type="button" data-od-id="product-back" data-quick-close><span aria-hidden="true">←</span> Назад в каталог</button>
        <div class="product-quick-view__media" data-od-id="product-photo" data-quick-media></div>
        <div class="product-quick-view__content" data-od-id="product-information">
          <p class="product-quick-view__category" data-quick-category></p>
          <h2 id="product-quick-view-title" data-od-id="product-title" data-quick-title></h2>
          <p class="product-quick-view__meta" data-quick-meta></p>
          <div class="product-quick-view__purchase" data-od-id="product-purchase">
          <span class="product-quick-view__price-label">Стоимость детали</span>
          <strong class="product-quick-view__price" data-quick-price></strong>
          <div class="product-quick-view__actions">
            <button type="button" data-od-id="product-add" data-quick-add>В заявку</button>
            <div class="product-quick-view__quantity" data-quick-quantity role="group" aria-label="Количество товара" hidden>
              <button type="button" data-quick-minus aria-label="Уменьшить количество">−</button>
              <output data-quick-count aria-live="polite">1</output>
              <button type="button" data-quick-plus aria-label="Увеличить количество">+</button>
            </div>
          </div>
          </div>
          <div class="product-quick-view__terms" data-od-id="product-terms">
            <h3>Условия заказа</h3>
            <p class="product-quick-view__description" data-quick-description></p>
          </div>
        </div>
      </div>`;
    element.querySelector('[data-quick-close]').addEventListener('click', closeView);
    element.addEventListener('cancel', event => { event.preventDefault(); closeView(); });
    element.addEventListener('close', () => {
      document.documentElement.classList.remove('product-view-open');
      window.scrollTo(0, returnY);
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    });
    element.querySelector("[data-quick-add]").addEventListener("click", () => {
      if (!activeItem) return;
      window.KITRADE_CART.add(activeItem);
      window.KITRADE_TRACK?.("add_to_request", { product_id: String(activeItem.id), page_type: "quick_view" });
      document.dispatchEvent(new CustomEvent("kitrade:add-product", { detail: { id: String(activeItem.id) } }));
      syncQuantity();
      element.querySelector('[data-quick-plus]').focus({ preventScroll: true });
    });
    element.querySelector('[data-quick-minus]').addEventListener('click', () => changeQuantity(-1));
    element.querySelector('[data-quick-plus]').addEventListener('click', () => changeQuantity(1));
    element.addEventListener("click", (event) => {
      if (event.target === element) closeView();
    });
    document.documentElement.append(element);
    return element;
  }

  function openQuickView(item, pushHistory = true) {
    if (!item) return false;
    activeItem = item;
    dialog ||= createDialog();
    const photo = normalizePhoto(item.photos?.[0]) || fallbackPhoto(item);
    const media = dialog.querySelector("[data-quick-media]");
    media.replaceChildren();
    if (photo) {
      const image = document.createElement("img");
      image.src = photo;
      image.alt = item.title || "Автозапчасть";
      image.addEventListener("error", () => { media.textContent = 'Фото уточняется'; }, { once: true });
      media.append(image);
    } else {
      media.textContent = "Фото уточняется";
    }
    dialog.querySelector("[data-quick-category]").textContent = item.public_category || item.category || "Запчасть";
    dialog.querySelector("[data-quick-title]").textContent = item.title || "Автозапчасть";
    dialog.querySelector("[data-quick-meta]").textContent = item.meta || [item.brand, item.model].filter(Boolean).join(" · ");
    dialog.querySelector("[data-quick-description]").textContent = item.quick_description || "Цена — за деталь. Доставка отдельно. Проверка по VIN. Минимальная сумма заказа — 50 000 ₽; детали можно объединить.";
    dialog.querySelector("[data-quick-price]").textContent = formatPrice(item.price);
    syncQuantity();
    returnFocus = document.activeElement;
    returnY = window.scrollY;
    document.dispatchEvent(new CustomEvent('kitrade:save-catalog'));
    if (pushHistory) history.pushState({ ...(history.state || {}), kitradeProduct: String(item.id) }, '', '#product-' + encodeURIComponent(item.id));
    document.documentElement.classList.add('product-view-open');
    dialog.showModal();
    dialog.scrollTop = 0;
    dialog.querySelector('[data-quick-close]').focus({ preventScroll: true });
    window.KITRADE_TRACK?.("product_view", { product_id: String(item.id), page_type: "quick_view" });
    return true;
  }

  function syncQuantity() {
    if (!dialog || !activeItem) return;
    const quantity = window.KITRADE_CART.get(activeItem.id)?.quantity || 0;
    dialog.querySelector('[data-quick-add]').hidden = quantity > 0;
    dialog.querySelector('[data-quick-quantity]').hidden = quantity === 0;
    dialog.querySelector('[data-quick-count]').textContent = String(quantity);
  }
  function changeQuantity(delta) {
    if (!activeItem) return;
    window.KITRADE_CART.changeQuantity(activeItem.id, delta);
    syncQuantity();
    if (!window.KITRADE_CART.get(activeItem.id)) dialog.querySelector('[data-quick-add]').focus({ preventScroll: true });
  }
  window.addEventListener('kitrade:cart-change', syncQuantity);
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-product-link]");
    if (link && (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
    if (event.target.closest("button, input, textarea, select, [data-order-control]")) return;
    const card = event.target.closest("[data-product-card]");
    if (!link && !card) return;
    const item = itemsById.get(String(link?.dataset.productId || card?.dataset.productId || ""));
    if (!item) return;
    if (openQuickView(item)) event.preventDefault();
  });
})();
