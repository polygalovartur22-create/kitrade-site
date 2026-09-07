(() => {
  const CART_KEY = "kitradeCatalogSelectionV1";
  const sitePath = (value) => {
    const path = String(value || "/");
    const base = String(window.KITRADE_SITE_CONFIG?.basePath || "").replace(/\/$/, "");
    return base && path.startsWith("/") && !path.startsWith(`${base}/`) ? `${base}${path}` : path;
  };

  const root = document.querySelector("[data-home-catalog-strip]");
  const track = document.querySelector("[data-home-catalog-track]");
  const previousButtons = [...document.querySelectorAll("[data-home-catalog-prev]")];
  const nextButtons = [...document.querySelectorAll("[data-home-catalog-next]")];
  const form = document.querySelector("[data-home-catalog-search]");
  const queryInput = document.querySelector("[data-home-catalog-query]");
  const brandSelect = document.querySelector("[data-home-catalog-brand]");
  const modelSelect = document.querySelector("[data-home-catalog-model]");
  const categorySelect = document.querySelector("[data-home-catalog-category]");
  const conditionSelect = document.querySelector("[data-home-catalog-condition]");
  const resetButton = document.querySelector("[data-home-catalog-reset]");
  const cartCount = document.querySelector("[data-home-catalog-cart-count]");
  const status = document.querySelector("[data-home-catalog-status]");
  const filterSelects = [brandSelect, modelSelect, categorySelect, conditionSelect].filter(Boolean);
  const source = Array.isArray(window.KITRADE_CATALOG_DATA?.items) ? window.KITRADE_CATALOG_DATA.items : [];
  if (!root || !track) return;

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const dropdownControllers = new Map();
  let activeDropdown = null;
  const mobileDropdownQuery = window.matchMedia("(max-width: 700px)");

  const closeActiveDropdown = (restoreFocus = false) => {
    if (activeDropdown) activeDropdown.close(restoreFocus);
  };

  const enhanceFilter = (select, index) => {
    const field = select.closest(".home-catalog-filter");
    const caption = field?.querySelector(":scope > span")?.textContent?.trim() || select.getAttribute("aria-label") || "Фильтр";
    const searchable = select === brandSelect;
    if (!field) return null;

    const menuId = `home-catalog-filter-menu-${index + 1}`;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "home-catalog-dropdown-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", menuId);
    trigger.innerHTML = '<span class="home-catalog-dropdown-value"></span><span class="home-catalog-dropdown-arrow" aria-hidden="true"></span>';

    const scrim = document.createElement("div");
    scrim.className = "home-catalog-dropdown-scrim";
    scrim.hidden = true;

    const menu = document.createElement("div");
    menu.className = "home-catalog-dropdown-menu";
    menu.id = menuId;
    menu.hidden = true;
    menu.innerHTML = `
      <div class="home-catalog-dropdown-menu-head">
        <strong>${escapeHtml(caption)}</strong>
        <button type="button" aria-label="Закрыть фильтр">Закрыть</button>
      </div>
      ${searchable ? `<label class="home-catalog-dropdown-search">
        <span class="home-catalog-visually-hidden">Поиск по маркам</span>
        <input type="search" inputmode="search" autocomplete="off" placeholder="Найти марку" aria-label="Поиск по маркам">
      </label>` : ""}
      <div class="home-catalog-dropdown-options" role="listbox" aria-label="${escapeHtml(caption)}"></div>`;

    field.append(trigger);
    document.body.append(scrim, menu);

    const valueNode = trigger.querySelector(".home-catalog-dropdown-value");
    const optionsNode = menu.querySelector(".home-catalog-dropdown-options");
    const closeButton = menu.querySelector(".home-catalog-dropdown-menu-head button");
    const searchInput = menu.querySelector(".home-catalog-dropdown-search input");
    let searchTerm = "";

    const optionButtons = () => [...optionsNode.querySelectorAll('[role="option"]')];
    const positionMenu = () => {
      if (menu.hidden) return;
      const mobile = mobileDropdownQuery.matches;
      const pageScale = Number.parseFloat(getComputedStyle(document.body).zoom) || 1;
      menu.toggleAttribute("data-mobile-sheet", mobile);
      scrim.toggleAttribute("data-visible", mobile);
      if (mobile) {
        const mobileMargin = 12;
        const mobileMaxHeight = Math.min(window.innerHeight * 0.58, 420);
        menu.style.left = `${mobileMargin / pageScale}px`;
        menu.style.right = "auto";
        menu.style.bottom = `${mobileMargin / pageScale}px`;
        menu.style.width = `${(window.innerWidth - mobileMargin * 2) / pageScale}px`;
        menu.style.maxHeight = `${mobileMaxHeight / pageScale}px`;
        menu.style.removeProperty("top");
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - margin * 2);
      const availableBelow = window.innerHeight - rect.bottom - margin;
      const availableAbove = rect.top - margin;
      const maxHeight = Math.min(340, Math.max(180, Math.max(availableBelow, availableAbove)));
      const openAbove = availableBelow < Math.min(260, maxHeight) && availableAbove > availableBelow;
      const left = Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin);
      const renderedMenuHeight = Math.min(menu.scrollHeight * pageScale, maxHeight);
      const top = openAbove
        ? Math.max(margin, rect.top - renderedMenuHeight - 8)
        : Math.min(window.innerHeight - maxHeight - margin, rect.bottom + 8);
      menu.style.left = `${Math.round(left / pageScale)}px`;
      menu.style.top = `${Math.round(Math.max(margin, top) / pageScale)}px`;
      menu.style.right = "auto";
      menu.style.removeProperty("bottom");
      menu.style.width = `${Math.round(width / pageScale)}px`;
      menu.style.maxHeight = `${Math.round(maxHeight / pageScale)}px`;
    };

    const renderOptions = () => {
      const normalizedQuery = searchTerm.trim().toLocaleLowerCase("ru");
      const matchingOptions = [...select.options]
        .map((option, optionIndex) => ({ option, optionIndex }))
        .filter(({ option }) => !normalizedQuery || (option.value && option.textContent.toLocaleLowerCase("ru").includes(normalizedQuery)));
      if (!matchingOptions.length) {
        optionsNode.innerHTML = '<p class="home-catalog-dropdown-empty" role="status">Марка не найдена</p>';
        return;
      }
      optionsNode.innerHTML = matchingOptions.map(({ option, optionIndex }) => {
        const selected = option.value === select.value;
        return `<button type="button" role="option" tabindex="-1" data-option-index="${optionIndex}" aria-selected="${selected}"><span>${escapeHtml(option.textContent)}</span>${selected ? "<small>Выбрано</small>" : ""}</button>`;
      }).join("");
    };

    const sync = () => {
      const selected = select.selectedOptions[0];
      valueNode.textContent = selected?.textContent || "Выберите";
      trigger.disabled = select.disabled;
      trigger.setAttribute("aria-disabled", String(select.disabled));
      if (!menu.hidden) {
        if (select.disabled) controller.close(false);
        else {
          renderOptions();
          requestAnimationFrame(positionMenu);
        }
      }
    };

    const focusOption = (direction = 0) => {
      const buttons = optionButtons();
      if (!buttons.length) return;
      const selectedIndex = Math.max(0, buttons.findIndex((button) => button.getAttribute("aria-selected") === "true"));
      const targetIndex = direction < 0 ? buttons.length - 1 : selectedIndex;
      buttons[targetIndex].focus();
    };

    const open = (direction = 0) => {
      if (select.disabled) return;
      if (activeDropdown && activeDropdown !== controller) activeDropdown.close(false);
      activeDropdown = controller;
      searchTerm = "";
      if (searchInput) searchInput.value = "";
      renderOptions();
      menu.hidden = false;
      scrim.hidden = false;
      field.setAttribute("data-filter-open", "");
      trigger.setAttribute("aria-expanded", "true");
      positionMenu();
      requestAnimationFrame(() => {
        if (searchInput && !mobileDropdownQuery.matches) searchInput.focus();
        else focusOption(direction);
      });
    };

    const close = (restoreFocus = false) => {
      menu.hidden = true;
      scrim.hidden = true;
      scrim.removeAttribute("data-visible");
      field.removeAttribute("data-filter-open");
      trigger.setAttribute("aria-expanded", "false");
      if (activeDropdown === controller) activeDropdown = null;
      if (restoreFocus) trigger.focus();
    };

    const choose = (button) => {
      const option = select.options[Number(button.dataset.optionIndex)];
      if (!option) return;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
      close(true);
    };

    const controller = { open, close, sync, positionMenu };
    dropdownControllers.set(select, controller);

    trigger.addEventListener("click", () => menu.hidden ? open() : close(false));
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !menu.hidden) {
        event.preventDefault();
        close(true);
        return;
      }
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        open(event.key === "ArrowUp" ? -1 : 0);
      }
    });
    optionsNode.addEventListener("click", (event) => {
      const button = event.target.closest('[role="option"]');
      if (button) choose(button);
    });
    optionsNode.addEventListener("keydown", (event) => {
      const buttons = optionButtons();
      const current = buttons.indexOf(document.activeElement);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        let next = current;
        if (event.key === "ArrowDown") next = (current + 1) % buttons.length;
        if (event.key === "ArrowUp") next = (current - 1 + buttons.length) % buttons.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = buttons.length - 1;
        buttons[next]?.focus();
      } else if (["Enter", " "].includes(event.key)) {
        event.preventDefault();
        if (document.activeElement?.matches('[role="option"]')) choose(document.activeElement);
      } else if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      } else if (event.key === "Tab") {
        close(false);
      }
    });
    searchInput?.addEventListener("input", () => {
      searchTerm = searchInput.value;
      renderOptions();
      requestAnimationFrame(positionMenu);
    });
    searchInput?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        optionButtons()[0]?.focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    });
    closeButton.addEventListener("click", () => close(true));
    scrim.addEventListener("click", () => close(true));
    select.addEventListener("change", sync);
    sync();
    return controller;
  };

  const normalizeText = (value) => String(value || "")
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();

  const normalizePhoto = (url) => {
    const value = String(url || "").trim();
    const match = value.match(/[?&]imageSlug=([^&]+)/);
    if (match) return `https://80.img.avito.st${decodeURIComponent(match[1])}`;
    return value.replace(/^http:\/\//i, "https://");
  };

  const fallbackPhoto = (item) => {
    const value = normalizeText([item.title, item.detail, item.category].filter(Boolean).join(" "));
    if (/фар|фонар|оптик/.test(value)) return sitePath("/assets/01-catalog-led-headlamp.png");
    if (/крыл/.test(value)) return sitePath("/assets/02-catalog-front-fender.png");
    if (/решетк|бампер/.test(value)) return sitePath("/assets/03-catalog-lower-grille.png");
    return sitePath("/assets/01-catalog-led-headlamp.png");
  };

  const formatPrice = (value) => {
    const price = Number(String(value || "").replace(/[^\d.,]/g, "").replace(",", "."));
    return price ? `${new Intl.NumberFormat("ru-RU").format(price)} ₽` : "Цена по запросу";
  };

  const candidates = source
    .filter((item) => item?.title && item?.indexable && item?.canonical_path)
    .map((item) => ({
      ...item,
      _brand: String(item.brand || ""),
      _model: String(item.model || ""),
      _category: String(item.public_category || item.category || ""),
      _condition: String(item.condition || ""),
      _search: normalizeText([
        item.title, item.detail, item.article, item.brand, item.model,
        item.generation, item.public_category, item.category
      ].filter(Boolean).join(" "))
    }));

  const sortedUnique = (items, key) => [...new Set(items.map((item) => item[key]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ru"));

  const setOptions = (select, values, firstLabel) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>${values.map((value) =>
      `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    if (values.includes(current)) select.value = current;
    dropdownControllers.get(select)?.sync();
  };

  const updateModelOptions = () => {
    if (!modelSelect) return;
    const brand = brandSelect?.value || "";
    const models = brand ? sortedUnique(candidates.filter((item) => item._brand === brand), "_model") : [];
    setOptions(modelSelect, models, brand ? "Все модели" : "Сначала марка");
    modelSelect.disabled = !brand;
    dropdownControllers.get(modelSelect)?.sync();
  };

  const choosePopular = (items) => {
    const chosen = [];
    const usedGroups = new Set();
    items.forEach((item) => {
      const group = item._category || "Запчасть";
      if (chosen.length < 8 && !usedGroups.has(group)) {
        chosen.push(item);
        usedGroups.add(group);
      }
    });
    items.forEach((item) => {
      if (chosen.length < 12 && !chosen.includes(item)) chosen.push(item);
    });
    return chosen;
  };

  const cardMarkup = (item) => {
    const id = String(item.id || "");
    const image = normalizePhoto(item.photos?.[0]) || fallbackPhoto(item);
    const category = item._category || "Запчасть";
    const meta = [item._brand, item._model, item.article ? `OEM ${item.article}` : ""].filter(Boolean).join(" · ");
    return `
      <article class="home-catalog-card" data-product-card data-product-id="${escapeHtml(id)}">
        <a class="home-catalog-card-link" href="${escapeHtml(sitePath(item.canonical_path))}" data-product-link data-product-id="${escapeHtml(id)}">
          <div class="home-catalog-card-media">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(item.title)}" loading="lazy" />
          </div>
          <div class="home-catalog-card-copy">
            <span class="home-catalog-card-category">${escapeHtml(category)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p class="home-catalog-card-meta">${escapeHtml(meta)}</p>
            <strong class="home-catalog-card-price">${escapeHtml(formatPrice(item.price))}</strong>
          </div>
        </a>
      </article>`;
  };

  const updateControls = () => {
    const max = Math.max(0, root.scrollWidth - root.clientWidth);
    previousButtons.forEach((button) => { button.disabled = root.scrollLeft <= 4; });
    nextButtons.forEach((button) => { button.disabled = max <= 4 || root.scrollLeft >= max - 4; });
  };

  const scrollStep = () => {
    if (window.innerWidth > 700) return Math.max(240, root.clientWidth * 0.84);
    const card = track.querySelector(".home-catalog-card");
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 10;
    return card ? (card.getBoundingClientRect().width + gap) * 2 : root.clientWidth;
  };

  const updateCartCount = () => {
    if (!cartCount) return;
    try {
      const stored = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      const ids = Array.isArray(stored) ? stored : stored?.ids;
      cartCount.textContent = String(Array.isArray(ids) ? new Set(ids.map(String)).size : 0);
    } catch {
      cartCount.textContent = "0";
    }
  };

  const getFiltered = () => {
    const tokens = normalizeText(queryInput?.value).split(" ").filter(Boolean);
    return candidates.filter((item) => {
      if (brandSelect?.value && item._brand !== brandSelect.value) return false;
      if (modelSelect?.value && item._model !== modelSelect.value) return false;
      if (categorySelect?.value && item._category !== categorySelect.value) return false;
      if (conditionSelect?.value && item._condition !== conditionSelect.value) return false;
      return !tokens.length || tokens.every((token) => item._search.includes(token));
    });
  };

  const render = () => {
    const filtered = getFiltered();
    const hasFilters = Boolean(queryInput?.value.trim() || brandSelect?.value || modelSelect?.value || categorySelect?.value || conditionSelect?.value);
    const visible = hasFilters ? filtered.slice(0, 12) : choosePopular(filtered);

    if (!visible.length) {
      track.innerHTML = '<div class="home-catalog-empty"><strong>Ничего не нашли</strong><span>Сбросьте часть фильтров или попробуйте OEM и более короткое название.</span></div>';
      if (status) status.textContent = "Совпадений не найдено";
    } else {
      track.innerHTML = visible.map(cardMarkup).join("");
      if (status) status.textContent = hasFilters ? `Найдено позиций: ${filtered.length}` : "Популярные позиции из каталога";
    }

    root.scrollLeft = 0;
    track.setAttribute("aria-busy", "false");
    requestAnimationFrame(updateControls);
  };

  setOptions(brandSelect, sortedUnique(candidates, "_brand"), "Все марки");
  setOptions(categorySelect, sortedUnique(candidates, "_category"), "Все категории");
  updateModelOptions();
  filterSelects.forEach(enhanceFilter);
  document.querySelector(".home-catalog-filter-row")?.classList.add("home-catalog-dropdowns-ready");

  document.addEventListener("pointerdown", (event) => {
    if (!activeDropdown) return;
    const activeMenu = document.querySelector('.home-catalog-dropdown-menu:not([hidden])');
    if (activeMenu?.contains(event.target) || event.target.closest(".home-catalog-dropdown-trigger")) return;
    closeActiveDropdown(false);
  });
  window.addEventListener("resize", () => activeDropdown?.positionMenu(), { passive: true });
  window.addEventListener("scroll", () => {
    if (activeDropdown && !mobileDropdownQuery.matches) activeDropdown.positionMenu();
  }, { passive: true, capture: true });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  queryInput?.addEventListener("input", () => {
    if (!queryInput.value.trim()) render();
  });
  brandSelect?.addEventListener("change", () => {
    updateModelOptions();
    render();
  });
  modelSelect?.addEventListener("change", render);
  categorySelect?.addEventListener("change", render);
  conditionSelect?.addEventListener("change", render);
  resetButton?.addEventListener("click", () => {
    if (queryInput) queryInput.value = "";
    if (brandSelect) brandSelect.value = "";
    if (categorySelect) categorySelect.value = "";
    if (conditionSelect) conditionSelect.value = "";
    updateModelOptions();
    filterSelects.forEach((select) => dropdownControllers.get(select)?.sync());
    render();
  });

  previousButtons.forEach((button) => button.addEventListener("click", () => root.scrollBy({ left: -scrollStep(), behavior: "smooth" })));
  nextButtons.forEach((button) => button.addEventListener("click", () => root.scrollBy({ left: scrollStep(), behavior: "smooth" })));
  root.addEventListener("scroll", () => requestAnimationFrame(updateControls), { passive: true });
  window.addEventListener("resize", updateControls);
  window.addEventListener("storage", updateCartCount);
  document.addEventListener("kitrade:add-product", updateCartCount);

  updateCartCount();
  render();
})();
