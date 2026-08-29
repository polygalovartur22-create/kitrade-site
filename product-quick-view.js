(() => {
  const isFilePreview = window.location.protocol === "file:";
  const sitePath = (value) => {
    const path = String(value || "/");
    const base = String(window.KITRADE_SITE_CONFIG?.basePath || "").replace(/\/$/, "");
    return base && path.startsWith("/") && !path.startsWith(`${base}/`) ? `${base}${path}` : path;
  };
  const source = Array.isArray(window.KITRADE_CATALOG_DATA?.items) ? window.KITRADE_CATALOG_DATA.items : [];
  const itemsById = new Map(source.map((item) => [String(item.id), item]));
  let dialog;
  let activeItem;

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
    element.setAttribute("aria-labelledby", "product-quick-view-title");
    element.innerHTML = `
      <div class="product-quick-view__shell">
        <button class="product-quick-view__close" type="button" aria-label="Закрыть" data-quick-close>×</button>
        <div class="product-quick-view__media" data-quick-media></div>
        <div class="product-quick-view__content">
          <p class="product-quick-view__category" data-quick-category></p>
          <h2 id="product-quick-view-title"><a data-quick-page><span data-quick-title></span></a></h2>
          <p class="product-quick-view__meta" data-quick-meta></p>
          <p class="product-quick-view__description" data-quick-description></p>
          <strong class="product-quick-view__price" data-quick-price></strong>
          <div class="product-quick-view__actions">
            <a class="product-quick-view__details" data-quick-page>Все характеристики</a>
            <button type="button" data-quick-add>В заявку</button>
          </div>
        </div>
      </div>`;
    element.querySelector("[data-quick-close]").addEventListener("click", () => element.close());
    element.addEventListener("click", async (event) => {
      const pageLink = event.target.closest("[data-quick-page][href]");
      if (!pageLink || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (!isFilePreview) return;
      event.preventDefault();
      const canonicalUrl = new URL(pageLink.href, window.location.href);
      const previewUrl = new URL(`/dist${canonicalUrl.pathname}`, window.location.origin);
      element.setAttribute("aria-busy", "true");
      try {
        const response = await fetch(previewUrl.href, { method: "HEAD", cache: "no-store" });
        window.location.href = response.ok ? previewUrl.href : canonicalUrl.href;
      } catch {
        window.location.href = canonicalUrl.href;
      }
    });
    element.querySelector("[data-quick-add]").addEventListener("click", () => {
      if (!activeItem) return;
      try {
        const stored = JSON.parse(localStorage.getItem("kitradeCatalogSelectionV1") || "[]");
        const ids = Array.isArray(stored) ? stored : stored?.ids;
        const next = [...new Set([...(Array.isArray(ids) ? ids.map(String) : []), String(activeItem.id)])];
        localStorage.setItem("kitradeCatalogSelectionV1", JSON.stringify(next));
      } catch {}
      window.KITRADE_TRACK?.("add_to_request", { product_id: String(activeItem.id), page_type: "quick_view" });
      document.dispatchEvent(new CustomEvent("kitrade:add-product", { detail: { id: String(activeItem.id) } }));
      const button = element.querySelector("[data-quick-add]");
      button.textContent = "В заявке";
      button.setAttribute("aria-pressed", "true");
    });
    element.addEventListener("click", (event) => {
      if (event.target === element) element.close();
    });
    document.body.append(element);
    return element;
  }

  function openQuickView(item) {
    if (!item?.canonical_path) return false;
    activeItem = item;
    dialog ||= createDialog();
    const photo = normalizePhoto(item.photos?.[0]) || fallbackPhoto(item);
    const media = dialog.querySelector("[data-quick-media]");
    media.replaceChildren();
    if (photo) {
      const image = document.createElement("img");
      image.src = photo;
      image.alt = item.title || "Автозапчасть";
      image.addEventListener("error", () => image.remove(), { once: true });
      media.append(image);
    } else {
      media.textContent = "Фото уточняется";
    }
    dialog.querySelector("[data-quick-category]").textContent = item.public_category || item.category || "Запчасть";
    dialog.querySelector("[data-quick-title]").textContent = item.title || "Автозапчасть";
    dialog.querySelector("[data-quick-meta]").textContent = item.meta || [item.brand, item.model].filter(Boolean).join(" · ");
    dialog.querySelector("[data-quick-description]").textContent = item.quick_description || "Цена — за деталь. Доставка отдельно. Проверка по VIN. Минимальная сумма заказа — 50 000 ₽; детали можно объединить.";
    dialog.querySelector("[data-quick-price]").textContent = formatPrice(item.price);
    dialog.querySelectorAll("[data-quick-page]").forEach((pageLink) => {
      pageLink.hidden = !item.indexable;
      pageLink.setAttribute("aria-disabled", String(!item.indexable));
      if (item.indexable) pageLink.href = sitePath(item.canonical_path);
      else pageLink.removeAttribute("href");
    });
    let selected = false;
    try {
      const stored = JSON.parse(localStorage.getItem("kitradeCatalogSelectionV1") || "[]");
      const ids = Array.isArray(stored) ? stored : stored?.ids;
      selected = Array.isArray(ids) && ids.map(String).includes(String(item.id));
    } catch {}
    const addButton = dialog.querySelector("[data-quick-add]");
    addButton.textContent = selected ? "В заявке" : "В заявку";
    addButton.setAttribute("aria-pressed", String(selected));
    dialog.showModal();
    window.KITRADE_TRACK?.("product_view", { product_id: String(item.id), page_type: "quick_view" });
    return true;
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-product-link]");
    if (link && (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
    if (event.target.closest("button, input, textarea, select")) return;
    const card = event.target.closest("[data-product-card]");
    if (!link && !card) return;
    const item = itemsById.get(String(link?.dataset.productId || card?.dataset.productId || ""));
    if (!item) return;
    if (openQuickView(item)) event.preventDefault();
  });
})();
