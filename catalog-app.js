(() => {
  const sitePath = (value) => {
    const path = String(value || "/");
    const base = String(window.KITRADE_SITE_CONFIG?.basePath || "").replace(/\/$/, "");
    return base && path.startsWith("/") && !path.startsWith(`${base}/`) ? `${base}${path}` : path;
  };
  const catalogHeader = document.querySelector("[data-header]");
  const catalogMenuToggle = document.querySelector("[data-menu-toggle]");
  const catalogMobileNav = document.querySelector("[data-mobile-nav]");

  function setCatalogMenu(open) {
    if (!catalogMenuToggle || !catalogMobileNav) return;

    catalogMenuToggle.setAttribute("aria-expanded", String(open));
    catalogMenuToggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    catalogMobileNav.hidden = !open;
    document.body.classList.toggle("menu-open", open);
  }

  catalogMenuToggle?.addEventListener("click", () => {
    setCatalogMenu(catalogMenuToggle.getAttribute("aria-expanded") !== "true");
  });

  catalogMobileNav?.addEventListener("click", (event) => {
    if (event.target.closest("a")) setCatalogMenu(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && catalogMenuToggle?.getAttribute("aria-expanded") === "true") {
      setCatalogMenu(false);
      catalogMenuToggle.focus();
    }
  });

  const headerSentinel = document.createElement("span");
  headerSentinel.className = "catalog-header-sentinel";
  headerSentinel.setAttribute("aria-hidden", "true");
  document.body.prepend(headerSentinel);

  if ("IntersectionObserver" in window) {
    const headerObserver = new IntersectionObserver(([entry]) => {
      catalogHeader?.classList.toggle("is-scrolled", !entry.isIntersecting);
    });
    headerObserver.observe(headerSentinel);
  }

  const catalogData = window.KITRADE_CATALOG_DATA || {};
  const rawItems = Array.isArray(catalogData.items) ? catalogData.items : [];
  const routeMap = catalogData.routes || { brands: {}, models: {}, categories: {} };
  const routeDefaults = {
    brand: document.body.dataset.catalogBrand || "",
    model: document.body.dataset.catalogModel || "",
    category: document.body.dataset.catalogCategory || "",
  };
  const routePage = Math.max(1, Number(document.body.dataset.catalogPage) || 1);
  const initialFilterParams = new URLSearchParams(window.location.search);
  const urlFilterValues = (name) => initialFilterParams.getAll(name)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const requestedUrlFilters = {
    brands: urlFilterValues("brand"),
    models: urlFilterValues("model"),
    categories: urlFilterValues("category"),
    condition: initialFilterParams.get("condition") || "",
  };
  const hasExplicitInitialFilters = Boolean(
    routeDefaults.brand
    || routeDefaults.model
    || routeDefaults.category
    || routePage > 1
    || requestedUrlFilters.brands.length
    || requestedUrlFilters.models.length
    || requestedUrlFilters.categories.length
    || requestedUrlFilters.condition,
  );
  const PAGE_SIZE = 24;
  const DISPLAY_PAGE_SIZE = 16;
  const compactCardDescription = (value) => {
    const description = String(value || "Цена — за деталь. Проверка по VIN.")
      .replace(/(?:^|\s)Доставка отдельно\.?/giu, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return description || "Цена — за деталь. Проверка по VIN.";
  };
  const items = rawItems
    .filter((item) => item && item.title)
    .map((item) => {
      const title = item.title;
      const article = item.article || "";
      return ({
      ...item,
      id: String(item.id),
      title,
      article,
      cardDescription: compactCardDescription(item.card_description),
      condition: item.condition || "",
      origin: item.origin || "",
      brand: item.brand || "Без марки",
      model: item.model || "Модель не указана",
      search: [title, item.brand, item.model, article, item.category, item.subcategory, item.detail]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ru"),
      group: item.public_category || getGroup(item),
      canonicalPath: sitePath(item.canonical_path || "/catalog/"),
      image: normalizePhoto(item.photos?.[0]) || catalogFallbackPhoto(item),
      priceNumber: Number(String(item.price || "").replace(/[^\d.,]/g, "").replace(",", ".")) || 0,
    });
    });

  const CART_STORAGE_KEY = "kitradeCatalogSelectionV1";
  const COMMENT_STORAGE_KEY = "kitradeCatalogCommentV1";
  const REQUEST_DRAFT_STORAGE_KEY = "kitradeCatalogRequestDraftV1";
  const FORM_ENDPOINT = window.KITRADE_SITE_CONFIG?.crmIntakeUrl
    || "https://195.19.20.105/api/website-intake";

  function readStoredSelection() {
    return window.KITRADE_CART.ids();
  }

  function persistSelection() {
    state.selected = readStoredSelection();
  }

  const state = {
    query: "",
    visible: DISPLAY_PAGE_SIZE,
    page: routePage,
    offset: (routePage - 1) * PAGE_SIZE,
    selected: readStoredSelection(),
    requestStep: 1,
    requestSubmitting: false,
  };

  const partsGrid = document.querySelector("#partsGrid");
  const resultCount = document.querySelector("#resultCount");
  const resultSummary = document.querySelector("#resultSummary");
  const emptyState = document.querySelector("#emptyState");
  const loadMore = document.querySelector("#loadMore");
  const requestSelection = document.querySelector("#requestSelection");
  const requestPanel = document.querySelector("#request");
  const requestTitle = requestPanel?.querySelector("[data-request-title]");
  const requestIntro = requestPanel?.querySelector("[data-request-intro]");
  const requestDetailsStage = requestPanel?.querySelector('[data-request-stage="details"]');
  const requestContactStage = requestPanel?.querySelector('[data-request-stage="contacts"]');
  const requestSuccess = requestPanel?.querySelector("[data-request-success]");
  const requestNote = requestPanel?.querySelector("[data-request-note]");
  const requestLookupToggle = requestPanel?.querySelector(".request-lookup-toggle");
  const requestLookupFields = document.querySelector("#requestLookupFields");
  const requestDetailsError = requestPanel?.querySelector("[data-request-details-error]");
  const requestContactError = requestPanel?.querySelector("[data-request-contact-error]");
  const requestSummary = requestPanel?.querySelector("[data-request-summary]");
  const requestSubmit = document.querySelector("#requestSubmit");
  const requestBack = document.querySelector("#requestBack");
  const requestCarModel = document.querySelector("#requestCarModel");
  const requestCarYear = document.querySelector("#requestCarYear");
  const requestVin = document.querySelector("#requestVin");
  const requestMissingPart = document.querySelector("#requestMissingPart");
  const requestCustomerName = document.querySelector("#requestCustomerName");
  const requestCustomerContact = document.querySelector("#requestCustomerContact");
  const requestContactLabel = requestPanel?.querySelector("[data-request-contact-label]");
  const requestComment = document.querySelector("#requestComment");
  const requestPrivacyConsent = document.querySelector("#requestPrivacyConsent");
  const toast = document.querySelector("#toast");
  let toastTimer;

  function normalizePhoto(url) {
    const value = String(url || "").trim();
    if (!value) return "";
    const match = value.match(/[?&]imageSlug=([^&]+)/);
    if (match) return `https://80.img.avito.st${decodeURIComponent(match[1])}`;
    return value.replace(/^http:\/\//i, "https://");
  }

  function catalogFallbackPhoto(item) {
    const subject = [item.title, item.detail, item.subcategory, item.category]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ru");
    if (/фара|фонарь|оптика|автосвет/.test(subject)) return sitePath("/assets/01-catalog-led-headlamp.png");
    if (/крыло/.test(subject)) return sitePath("/assets/02-catalog-front-fender.png");
    if (/реш[её]тка|нижн[^ ]* бампер/.test(subject)) return sitePath("/assets/03-catalog-lower-grille.png");
    return "";
  }

  function getGroup(item) {
    const source = [item.category, item.subcategory, item.detail, item.title].filter(Boolean).join(" ").toLocaleLowerCase("ru");
    if (/фар|фонар|оптик|автосвет|дневн.*огонь/.test(source)) return "Оптика";
    if (/тормоз|суппорт|колод|диск торм/.test(source)) return "Тормозная система";
    if (/подвес|амортиз|стойк|рычаг|ступиц|пружин/.test(source)) return "Подвеска";
    if (/двигател|мотор|порш|коленвал|головк.*блок|грм/.test(source)) return "Двигатель";
    if (/салон|сиден|панел.*прибор|обшив|консол/.test(source)) return "Салон";
    if (/электр|датчик|провод|блок управ|генератор|стартер/.test(source)) return "Электрика";
    if (/кузов|крыл|бампер|капот|двер|решет|багажник|зеркал|наклад/.test(source)) return "Кузов";
    return item.category || "Запчасти";
  }

  function checkedValues(selector) {
    return [...document.querySelectorAll(`${selector} input:checked`)].map((input) => input.value).filter(Boolean);
  }

  function routeKey(...values) {
    return values.map((value) => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru")).join("|");
  }

  function conditionQueryValue(value) {
    if (value === "Новое") return "new";
    if (value === "Б/у") return "used";
    return "";
  }

  function catalogHistoryState() {
    return {
      brands: checkedValues("#brandFilters"),
      models: checkedValues("#modelFilters"),
      categories: checkedValues("#typeFilters"),
      condition: selectedCondition(),
      query: state.query,
      page: state.page,
      offset: state.offset,
      visible: state.visible,
    };
  }

  function updateCatalogRoute(historyMode = "replace") {
    const brands = checkedValues("#brandFilters");
    const models = checkedValues("#modelFilters");
    const categories = checkedValues("#typeFilters");
    const brand = brands.length === 1 ? brands[0] : "";
    const model = brand && models.length === 1 ? models[0] : "";
    const category = brand && model && categories.length === 1 ? categories[0] : "";
    const brandRoute = brand ? routeMap.brands?.[routeKey(brand)] : "";
    const modelRoute = model ? routeMap.models?.[routeKey(brand, model)] : "";
    const categoryRoute = category ? routeMap.categories?.[routeKey(brand, model, category)] : "";
    const basePath = categoryRoute || modelRoute || brandRoute || "/catalog/";
    const path = state.page > 1 ? `${basePath}page/${state.page}/` : basePath;
    const browserPath = sitePath(path);
    const params = new URLSearchParams(window.location.search);
    params.delete("brand");
    params.delete("model");
    params.delete("category");
    params.delete("condition");
    if (brand && !brandRoute) params.append("brand", brand);
    if (model && !modelRoute) params.append("model", model);
    if (categories.length && !categoryRoute) categories.forEach((value) => params.append("category", value));
    const condition = conditionQueryValue(selectedCondition());
    if (condition) params.set("condition", condition);
    const search = params.toString();
    const browserUrl = `${browserPath}${search ? `?${search}` : ""}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const nextState = { ...(history.state || {}), kitradeCatalogFilters: catalogHistoryState() };
    if (window.location.protocol !== "file:" && historyMode !== "none") {
      if (historyMode === "push" && browserUrl !== currentUrl) history.pushState(nextState, "", browserUrl);
      else history.replaceState(nextState, "", browserUrl);
    }
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = new URL(path, catalogData.site_url || window.location.origin).href;
    return basePath;
  }

  function catalogPageUrl(path) {
    const url = new URL(window.location.href);
    url.pathname = sitePath(path);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "ru", { numeric: true }));
  }

  function normalizeSearch(value) {
    return String(value || "")
      .toLocaleLowerCase("ru")
      .replaceAll("ё", "е")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function editDistanceWithin(left, right, limit) {
    if (Math.abs(left.length - right.length) > limit) return limit + 1;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = [leftIndex];
      let rowMinimum = current[0];
      for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
        const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
        current[rightIndex] = Math.min(
          current[rightIndex - 1] + 1,
          previous[rightIndex] + 1,
          previous[rightIndex - 1] + cost,
        );
        rowMinimum = Math.min(rowMinimum, current[rightIndex]);
      }
      if (rowMinimum > limit) return limit + 1;
      previous = current;
    }
    return previous[right.length];
  }

  function fuzzyScore(query, candidate) {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return 1;
    const normalizedCandidate = normalizeSearch(candidate);
    if (normalizedCandidate.includes(normalizedQuery)) return 100;

    const words = normalizedCandidate.split(" ");
    const scores = normalizedQuery.split(" ").map((token) => {
      let best = -1;
      words.forEach((word) => {
        if (word === token) best = Math.max(best, 48);
        else if (word.startsWith(token) || (token.length >= 4 && token.startsWith(word))) best = Math.max(best, 39);
        else if (token.length >= 3 && word.includes(token)) best = Math.max(best, 34);
        else if (token.length >= 3 && word.length >= 3) {
          const limit = token.length <= 4 ? 1 : token.length <= 8 ? 2 : 3;
          const distance = editDistanceWithin(token, word, limit);
          if (distance <= limit) best = Math.max(best, 29 - (distance * 4));
        }
      });
      return best;
    });
    if (scores.some((score) => score < 0)) return -1;
    return scores.reduce((total, score) => total + score, 0) / scores.length;
  }

  function updateFilterSummary(filter) {
    const selected = [...filter.querySelectorAll(".filter-options input:checked")].map((input) => input.value);
    const summary = filter.querySelector("[data-filter-summary]");
    if (!summary) return;
    if (!selected.length) {
      summary.textContent = filter.id === "brandFilters"
        ? "Все марки"
        : filter.id === "modelFilters"
          ? "Сначала выберите марку"
          : "Все категории";
      return;
    }
    summary.textContent = selected.length === 1 ? selected[0] : `Выбрано: ${selected.length}`;
  }

  function filterVisibleOptions(filter, query = "") {
    let visible = 0;
    filter.querySelectorAll(".filter-options label").forEach((label) => {
      const matches = fuzzyScore(query, label.dataset.filterValue || "") >= 0;
      label.hidden = !matches;
      if (matches) visible += 1;
    });
    const empty = filter.querySelector("[data-filter-empty]");
    if (empty) empty.hidden = visible > 0;
  }

  function renderFilterOptions(filter, values) {
    const options = filter.querySelector("[data-filter-options]");
    const selectedBrand = checkedValues("#brandFilters")[0] || routeDefaults.brand;
    const selectedModel = checkedValues("#modelFilters")[0] || routeDefaults.model;
    const withPreservedParams = (path) => {
      const params = new URLSearchParams(window.location.search);
      params.delete("brand");
      params.delete("model");
      params.delete("category");
      params.delete("condition");
      const condition = conditionQueryValue(selectedCondition());
      if (condition) params.set("condition", condition);
      const search = params.toString();
      return `${sitePath(path)}${search ? `?${search}` : ""}${window.location.hash}`;
    };
    const hrefFor = (value) => {
      if (filter.id === "brandFilters") return withPreservedParams(routeMap.brands?.[routeKey(value)] || "/catalog/");
      if (filter.id === "modelFilters" && selectedBrand) return withPreservedParams(routeMap.models?.[routeKey(selectedBrand, value)] || "/catalog/");
      if (filter.id === "typeFilters" && selectedBrand && selectedModel) return withPreservedParams(routeMap.categories?.[routeKey(selectedBrand, selectedModel, value)] || "/catalog/");
      return withPreservedParams("/catalog/");
    };
    options.innerHTML = values.map((value) => `
      <label data-filter-value="${escapeHtml(value)}"><input type="checkbox" value="${escapeHtml(value)}" /><a href="${escapeHtml(hrefFor(value))}" data-filter-option-link>${escapeHtml(value)}</a><i aria-hidden="true"></i></label>
    `).join("");
    const search = filter.querySelector("[data-filter-search]");
    if (search) search.value = "";
    filterVisibleOptions(filter);
    updateFilterSummary(filter);
  }

  function renderAllFilterOptions() {
    renderFilterOptions(document.querySelector("#brandFilters"), unique(items.map((item) => item.brand)));
    renderModelFilter([]);
    renderFilterOptions(document.querySelector("#typeFilters"), unique(items.map((item) => item.group)));
  }

  function renderModelFilter(brands) {
    const fieldset = document.querySelector("#modelFilters");
    const trigger = fieldset.querySelector("[data-filter-toggle]");
    const popover = fieldset.querySelector("[data-filter-popover]");
    if (!brands.length) {
      fieldset.classList.add("is-disabled");
      trigger.disabled = true;
      trigger.setAttribute("aria-expanded", "false");
      popover.hidden = true;
      fieldset.querySelector("[data-filter-options]").innerHTML = "";
      updateFilterSummary(fieldset);
      return;
    }

    const models = unique(items
      .filter((item) => brands.includes(item.brand))
      .map((item) => item.model)
      .filter((model) => model && model !== "Модель не указана"));
    fieldset.classList.remove("is-disabled");
    trigger.disabled = false;
    renderFilterOptions(fieldset, models);
  }

  function matchingValues(available, requested) {
    const byKey = new Map(available.map((value) => [routeKey(value), value]));
    return [...new Set(requested.map((value) => byKey.get(routeKey(value))).filter(Boolean))];
  }

  function conditionFromQuery(value) {
    const normalized = normalizeSearch(value);
    if (["new", "novoe", "новое", "новая", "новый"].includes(normalized)) return "Новое";
    if (["used", "bu", "б у", "бу", "подержанное"].includes(normalized)) return "Б/у";
    return "";
  }

  function applyCatalogFilterState(filters) {
    clearFilterControls();
    const availableBrands = unique(items.map((item) => item.brand));
    const brands = matchingValues(availableBrands, filters.brands || []).slice(0, 1);
    document.querySelectorAll("#brandFilters input").forEach((input) => {
      input.checked = brands.includes(input.value);
    });
    renderModelFilter(brands);

    const availableModels = unique(items
      .filter((item) => brands.includes(item.brand))
      .map((item) => item.model));
    const models = matchingValues(availableModels, filters.models || []).slice(0, 1);
    document.querySelectorAll("#modelFilters input").forEach((input) => {
      input.checked = models.includes(input.value);
    });

    const availableCategories = unique(items.map((item) => item.group));
    const categories = matchingValues(availableCategories, filters.categories || []);
    document.querySelectorAll("#typeFilters input").forEach((input) => {
      input.checked = categories.includes(input.value);
    });

    const condition = filters.condition === "Новое" || filters.condition === "Б/у"
      ? filters.condition
      : conditionFromQuery(filters.condition);
    document.querySelectorAll("#conditionFilters input").forEach((input) => {
      input.checked = input.value === condition;
    });
    if (!condition) document.querySelector('#conditionFilters input[value=""]').checked = true;
    ["#brandFilters", "#modelFilters", "#typeFilters"].forEach((selector) => {
      updateFilterSummary(document.querySelector(selector));
    });
  }

  function selectedCondition() {
    return document.querySelector('#conditionFilters input:checked')?.value || "";
  }

  function getFilteredItems() {
    const brands = checkedValues("#brandFilters");
    const models = checkedValues("#modelFilters");
    const types = checkedValues("#typeFilters");
    const condition = selectedCondition().toLocaleLowerCase("ru");

    const scores = new Map();
    const filtered = items
      .filter((item) => {
        if (brands.length && !brands.some((brand) => item.brand.toLocaleLowerCase("ru") === brand.toLocaleLowerCase("ru"))) return false;
        if (models.length && !models.includes(item.model)) return false;
        if (types.length && !types.includes(item.group)) return false;
        if (condition && !String(item.condition || "").toLocaleLowerCase("ru").startsWith(condition.slice(0, 5))) return false;
        if (state.query) {
          const score = fuzzyScore(state.query, item.search);
          if (score < 0) return false;
          scores.set(item.id, score);
        }
        return true;
      });
    if (state.query) filtered.sort((left, right) => scores.get(right.id) - scores.get(left.id));
    return filtered;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatPrice(item) {
    if (!item.priceNumber) return "Цена по запросу";
    return `${new Intl.NumberFormat("ru-RU").format(item.priceNumber)} ₽`;
  }

  function deliveryLabel() {
    return "доставка отдельно";
  }

  function quantityMarkup(id) {
    const key = escapeHtml(id);
    const quantity = window.KITRADE_CART.get(id)?.quantity || 0;
    return quantity ? `<div class="card-quantity" role="group" aria-label="Количество товара">
      <button type="button" data-quantity-id="${key}" data-quantity-delta="-1" aria-label="Уменьшить количество">−</button>
      <output aria-live="polite" aria-atomic="true">${quantity}</output>
      <button type="button" data-quantity-id="${key}" data-quantity-delta="1" aria-label="Увеличить количество">+</button>
    </div>` : `<button class="card-action" type="button" data-add="${key}">В заявку</button>`;
  }

  function cardMarkup(item) {
    const selected = state.selected.includes(item.id);
    const href = item.indexable ? ` href="${escapeHtml(item.canonicalPath)}"` : "";
    const image = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><div class="photo-fallback" hidden>Фото уточняется</div>`
      : `<div class="photo-fallback">Фото уточняется</div>`;
    return `
      <article class="part-card" data-id="${escapeHtml(item.id)}" data-od-id="product-${escapeHtml(item.id)}" data-product-card data-product-id="${escapeHtml(item.id)}">
        <a class="part-photo"${href} data-product-link data-product-id="${escapeHtml(item.id)}">${image}</a>
        <div class="part-content">
          <span class="part-category">${escapeHtml(item.group)}</span>
          <h3><a class="part-title-link"${href} data-product-link data-product-id="${escapeHtml(item.id)}">${escapeHtml(item.title)}</a></h3>
          <p class="part-description">${escapeHtml(item.cardDescription)}</p>
          <div class="part-meta">
            <strong class="part-price">${formatPrice(item)}</strong>
            <span class="part-time">${deliveryLabel(item)}</span>
            <div class="card-order-control" data-order-control="${escapeHtml(item.id)}" data-od-id="quantity-${escapeHtml(item.id)}">${quantityMarkup(item.id)}</div>
          </div>
        </div>
      </article>`;
  }

  function render({ historyMode = "replace" } = {}) {
    const filtered = getFilteredItems();
    const visible = filtered.slice(state.offset, state.offset + state.visible);
    partsGrid.innerHTML = visible.map(cardMarkup).join("");
    resultCount.textContent = `Найдено ${filtered.length} ${plural(filtered.length)}`;
    const brands = checkedValues("#brandFilters");
    const models = checkedValues("#modelFilters");
    const types = checkedValues("#typeFilters");
    resultSummary.textContent = state.query ? `Поиск: «${state.query}»` : [brands.join(" / "), models.join(" / "), types.join(" / ")]
      .filter(Boolean).join(" / ") || "Все марки и категории";
    emptyState.hidden = filtered.length > 0;
    loadMore.hidden = state.offset + visible.length >= filtered.length;
    loadMore.style.display = loadMore.hidden ? "none" : "";
    const basePath = updateCatalogRoute(historyMode);
    if (!loadMore.hidden) {
      const nextPage = state.page + Math.ceil(state.visible / PAGE_SIZE);
      loadMore.href = catalogPageUrl(`${basePath}page/${nextPage}/`);
    } else {
      loadMore.removeAttribute("href");
    }
  }

  function plural(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return "позиция";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "позиции";
    return "позиций";
  }


  function renderRequest() {
    const selectedItems = state.selected.map((id) => items.find((item) => item.id === id) || { ...window.KITRADE_CART.get(id), title: (window.KITRADE_CART.get(id)?.title || `Позиция ${id}`) + " — наличие уточняется", canonicalPath: sitePath("/catalog/") }).filter(Boolean);
    if (!selectedItems.length) {
      requestSelection.innerHTML = "<strong>Позиции не выбраны</strong><p>Добавьте нужные детали из карточек каталога.</p>";
      updateRequestSummary();
      return;
    }
    const selectedTitle = selectedItems.length === 1
      ? "1 позиция выбрана"
      : `${selectedItems.length} ${plural(selectedItems.length)} ${selectedItems.length < 5 ? "выбраны" : "выбрано"}`;
    requestSelection.innerHTML = `
      <strong>${selectedTitle}</strong>
      <div class="request-selection-list" id="basket-items" data-expanded="false">
        ${selectedItems.map((item, index) => `<div class="selected-item" ${index > 2 ? 'hidden' : ''}>
          <a href="${escapeHtml(item.canonicalPath)}">${escapeHtml(item.title)}</a>
          <div class="basket-item-controls">
            <div class="basket-quantity" role="group" aria-label="Количество товара">
              <button type="button" data-basket-id="${escapeHtml(item.id)}" data-basket-delta="-1" aria-label="Уменьшить количество">−</button>
              <span>${window.KITRADE_CART.get(item.id)?.quantity || 1}</span>
              <button type="button" data-basket-id="${escapeHtml(item.id)}" data-basket-delta="1" aria-label="Увеличить количество">+</button>
            </div>
            <button type="button" data-remove="${escapeHtml(item.id)}">Удалить</button>
          </div>
          <span class="basket-item-price">${formatPrice(item)} / шт.</span>
        </div>`).join("")}
      </div>
      <button type="button" class="basket-expand" data-basket-expand data-od-id="basket-expand" aria-haspopup="dialog">Посмотреть всю корзину (${selectedItems.length})</button>`;
    updateRequestSummary();
  }

  function updateRequestSummary() {
    if (!requestSummary) return;
    const productCount = state.selected.length;
    const hasLookup = Boolean(requestMissingPart?.value.trim());
    const parts = [];
    if (productCount) parts.push(`${productCount} ${plural(productCount)} из каталога`);
    if (hasLookup) parts.push("запрос на поиск детали");
    requestSummary.textContent = parts.length ? `В заявке: ${parts.join(" и ")}.` : "Состав заявки сохранён.";
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2200);
  }

  function resetPaging() {
    state.page = 1;
    state.offset = 0;
    state.visible = DISPLAY_PAGE_SIZE;
  }

  function clearCatalogQuery() {
    document.querySelector("#catalogQuery").value = "";
    state.query = "";
  }

  function clearFilterControls() {
    document.querySelectorAll("#brandFilters input, #modelFilters input, #typeFilters input").forEach((input) => {
      input.checked = false;
    });
    renderModelFilter([]);
    document.querySelector('#conditionFilters input[value=""]').checked = true;
    updateFilterSummary(document.querySelector("#brandFilters"));
    updateFilterSummary(document.querySelector("#typeFilters"));
  }

  document.querySelector(".filter-panel").addEventListener("change", (event) => {
    if (!event.target.matches("input") || event.target.matches("[data-filter-search]")) return;
    const singleChoiceFilter = event.target.closest("#brandFilters, #modelFilters");
    if (singleChoiceFilter && event.target.checked) {
      singleChoiceFilter.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        if (input !== event.target) input.checked = false;
      });
    }
    clearCatalogQuery();
    if (event.target.closest("#brandFilters")) {
      renderModelFilter(checkedValues("#brandFilters"));
      updateFilterSummary(document.querySelector("#modelFilters"));
    }
    const filter = event.target.closest(".filter-dropdown");
    if (filter) {
      updateFilterSummary(filter);
      if (filter.id !== "typeFilters") {
        filter.classList.remove("is-open");
        filter.querySelector("[data-filter-popover]").hidden = true;
        filter.querySelector("[data-filter-toggle]").setAttribute("aria-expanded", "false");
      }
    }
    resetPaging();
    render({ historyMode: "push" });
  });

  document.querySelector(".filter-panel").addEventListener("click", (event) => {
    const optionLink = event.target.closest("[data-filter-option-link]");
    if (optionLink && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
      event.preventDefault();
      const input = optionLink.closest("label")?.querySelector("input");
      input?.click();
      return;
    }
    const trigger = event.target.closest("[data-filter-toggle]");
    if (!trigger || trigger.disabled) return;
    const filter = trigger.closest(".filter-dropdown");
    const popover = filter.querySelector("[data-filter-popover]");
    const opening = popover.hidden;

    document.querySelectorAll(".filter-dropdown").forEach((item) => {
      item.classList.remove("is-open");
      item.querySelector("[data-filter-popover]").hidden = true;
      item.querySelector("[data-filter-toggle]").setAttribute("aria-expanded", "false");
    });
    if (!opening) return;

    filter.classList.add("is-open");
    popover.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => filter.querySelector("[data-filter-search]")?.focus());
  });

  document.querySelector(".filter-panel").addEventListener("input", (event) => {
    if (!event.target.matches("[data-filter-search]")) return;
    filterVisibleOptions(event.target.closest(".filter-dropdown"), event.target.value);
  });

  document.addEventListener("pointerdown", (event) => {
    document.querySelectorAll(".filter-dropdown.is-open").forEach((filter) => {
      if (filter.contains(event.target)) return;
      filter.classList.remove("is-open");
      filter.querySelector("[data-filter-popover]").hidden = true;
      filter.querySelector("[data-filter-toggle]").setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".filter-dropdown.is-open").forEach((filter) => {
      filter.classList.remove("is-open");
      filter.querySelector("[data-filter-popover]").hidden = true;
      filter.querySelector("[data-filter-toggle]").setAttribute("aria-expanded", "false");
      filter.querySelector("[data-filter-toggle]").focus();
    });
  });

  const searchInput = document.querySelector("#catalogQuery");
  let searchTimer;
  const applySearch = () => {
    clearTimeout(searchTimer);
    const query = searchInput.value.trim();
    if (query) clearFilterControls();
    state.query = query;
    resetPaging();
    render({ historyMode: "push" });
  };
  document.querySelector("#catalogSearch").addEventListener("submit", (event) => {
    event.preventDefault();
    applySearch();
  });
  searchInput.addEventListener("input", event => {
    clearTimeout(searchTimer);
    if (event.isComposing) return;
    if (!searchInput.value.trim()) applySearch();
    else searchTimer = setTimeout(applySearch, 250);
  });
  searchInput.addEventListener("compositionend", applySearch);
  searchInput.addEventListener("search", applySearch);

  document.querySelector("#resetFilters").addEventListener("click", () => {
    clearFilterControls();
    resetPaging();
    render({ historyMode: "push" });
  });

  partsGrid.addEventListener("click", (event) => {
    const quantityButton = event.target.closest('[data-quantity-delta]');
    if (quantityButton) {
      window.KITRADE_CART.changeQuantity(quantityButton.dataset.quantityId, Number(quantityButton.dataset.quantityDelta));
      return;
    }
    const button = event.target.closest("button[data-add]");
    if (!button) return;
    const id = button.dataset.add;
    if (readStoredSelection().includes(id)) {
      window.dispatchEvent(new CustomEvent('kitrade:open-request'));
      return;
    }
    window.KITRADE_CART.add(items.find(item => item.id === id));
    persistSelection();
    if (state.selected.includes(id)) window.KITRADE_TRACK?.("add_to_request", { product_id: id, page_type: "catalog" });
    renderRequest();
    showToast(state.selected.includes(id) ? "Позиция добавлена в заявку" : "Позиция удалена из заявки");
  });

  requestSelection.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove]");
    if (!button) return;
    window.KITRADE_CART.remove(button.dataset.remove);
    persistSelection();
    renderRequest();
    render();
  });

  loadMore.addEventListener("click", (event) => { event.preventDefault(); state.visible += DISPLAY_PAGE_SIZE; render(); });
  function manualRequestValues() {
    return {
      model: requestCarModel?.value.trim() || "",
      year: requestCarYear?.value.trim() || "",
      vin: requestVin?.value.trim().toUpperCase() || "",
      part: requestMissingPart?.value.trim() || "",
    };
  }

  function saveRequestDraft() {
    try {
      localStorage.setItem(REQUEST_DRAFT_STORAGE_KEY, JSON.stringify({
        ...manualRequestValues(),
        comment: requestComment?.value || "",
      }));
    } catch {}
  }

  function setLookupOpen(open) {
    if (!requestLookupFields || !requestLookupToggle) return;
    requestLookupFields.hidden = !open;
    requestLookupToggle.setAttribute("aria-expanded", String(open));
    requestLookupToggle.textContent = open
      ? "Скрыть запрос на поиск"
      : "Не нашли нужную деталь? Отправить запрос на поиск";
    renderRequest();
    if (open) requestCarModel?.focus();
  }

  function setRequestStep(step) {
    state.requestStep = step;
    requestPanel.dataset.requestStep = String(step);
    requestDetailsStage.hidden = step !== 1;
    requestContactStage.hidden = step !== 2;
    requestSuccess.hidden = true;
    requestSubmit.hidden = false;
    requestNote.hidden = false;
    requestSubmit.disabled = false;
    requestSubmit.textContent = "Отправить на расчет";
    if (step === 1) {
      requestTitle.innerHTML = "Соберите корзину<br />запроса";
      requestIntro.textContent = "Добавьте детали или опишите задачу. Цена в каталоге — за деталь; доставку рассчитает менеджер.";
    } else {
      requestTitle.innerHTML = "Контакты<br />для связи";
      requestIntro.textContent = "Оставьте данные, чтобы менеджер мог уточнить детали и подготовить расчёт.";
      updateRequestSummary();
      requestCustomerName?.focus();
    }
    requestPanel.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateRequestDetails() {
    requestDetailsError.textContent = "";
    const manual = manualRequestValues();
    const manualActive = Object.values(manual).some(Boolean);
    if (!state.selected.length && !manual.part) {
      requestDetailsError.textContent = "Добавьте товар из каталога или перейдите по ссылке заявки на подбор.";
      if (requestLookupFields && !requestLookupFields.hidden) requestMissingPart?.focus();
      else setLookupOpen(true);
      return false;
    }
    if (manualActive && (!manual.model || !manual.part)) {
      requestDetailsError.textContent = "Для поиска укажите автомобиль и нужную запчасть.";
      setLookupOpen(true);
      return false;
    }
    if (manual.year && !/^(19|20)\d{2}$/.test(manual.year)) {
      requestDetailsError.textContent = "Проверьте год выпуска автомобиля.";
      setLookupOpen(true);
      requestCarYear?.focus();
      return false;
    }
    if (manual.vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(manual.vin)) {
      requestDetailsError.textContent = "VIN должен содержать 17 символов.";
      setLookupOpen(true);
      requestVin?.focus();
      return false;
    }
    return true;
  }

  function selectedRequestProducts() {
    return state.selected
      .map((id) => items.find((item) => String(item.id) === String(id)) || window.KITRADE_CART.get(id))
      .filter(Boolean)
      .map((item) => ({
        product_id: item.id,
        title: item.title || `Позиция ${item.id} — наличие уточняется`,
        article: item.article || "",
        price: item.priceNumber || 0,
        quantity: window.KITRADE_CART.get(item.id)?.quantity || 1,
        url: new URL(item.canonicalPath || sitePath('/catalog/'), window.location.origin).href,
      }));
  }

  function validateRequestContacts() {
    requestContactError.textContent = "";
    const name = requestCustomerName?.value.trim() || "";
    const contact = requestCustomerContact?.value.trim() || "";
    const messenger = requestPanel.querySelector('input[name="catalogMessenger"]:checked')?.value || "Звонок";
    if (!name) {
      requestContactError.textContent = "Укажите ваше имя.";
      requestCustomerName?.focus();
      return false;
    }
    if (messenger === "Telegram") {
      if (!/^@?[A-Za-z0-9_]{5,32}$/.test(contact)) {
        requestContactError.textContent = "Укажите корректный Telegram тег.";
        requestCustomerContact?.focus();
        return false;
      }
    } else if (!/^\d{10,15}$/.test(contact.replace(/\D/g, ""))) {
      requestContactError.textContent = "Укажите корректный номер телефона.";
      requestCustomerContact?.focus();
      return false;
    }
    if (!requestPrivacyConsent?.checked) {
      requestContactError.textContent = "Подтвердите согласие на обработку данных.";
      requestPrivacyConsent?.focus();
      return false;
    }
    return true;
  }

  async function submitCatalogRequest() {
    if (state.requestSubmitting || !validateRequestContacts()) return;
    const manual = manualRequestValues();
    const products = selectedRequestProducts();
    const messenger = requestPanel.querySelector('input[name="catalogMessenger"]:checked')?.value || "Звонок";
    const details = [
      products.length && `Выбрано позиций из каталога: ${products.length}.`,
      ...products.map(item => `${item.title}: ${item.quantity} шт.`),
      manual.part && `Запрос на поиск: ${manual.part}`,
      requestComment?.value.trim() && `Комментарий: ${requestComment.value.trim()}`,
    ].filter(Boolean).join("\n");
    const orderId = `catalog-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const payload = {
      external_id: orderId,
      website: "",
      client: {
        name: requestCustomerName.value.trim(),
        contact: requestCustomerContact.value.trim(),
        messenger,
      },
      vehicle: {
        model: manual.model,
        year: manual.year,
        vin: manual.vin,
      },
      details,
      photos: [],
      order: {
        order_id: orderId,
        attribution: window.KITRADE_GET_ATTRIBUTION?.() || {
          metrika_client_id: "",
          yclid: "",
          utm: {},
          first_landing_url: window.location.href,
        },
        selected_products: products,
        preliminary_sum: products.reduce((sum, item) => sum + item.price * item.quantity, 0),
        currency: "RUB",
      },
    };

    state.requestSubmitting = true;
    requestSubmit.disabled = true;
    requestSubmit.textContent = "Отправка...";
    requestPanel.setAttribute("aria-busy", "true");
    window.KITRADE_TRACK?.("request_submit_attempt", {
      source: "catalog",
      order_id: orderId,
      product_count: products.length,
    });

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 60000);
      let response;
      try {
        response = await fetch(FORM_ENDPOINT, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          headers: { "Accept": "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }
      const confirmation = await response.json().catch(() => null);
      if (!response.ok || !confirmation?.ok || confirmation.confirmation !== "saved") {
        throw new Error(confirmation?.error || `Request failed with status ${response.status}`);
      }

      window.KITRADE_CART.consume(products);
      persistSelection();
      try { sessionStorage.removeItem("kitradeCatalogContactSessionV1"); } catch {}
      localStorage.removeItem(REQUEST_DRAFT_STORAGE_KEY);
      localStorage.removeItem(COMMENT_STORAGE_KEY);
      requestDetailsStage.hidden = true;
      requestContactStage.hidden = true;
      requestSubmit.hidden = true;
      requestNote.hidden = true;
      requestTitle.innerHTML = "Заявка<br />отправлена";
      requestIntro.textContent = "Мы получили ваш запрос и передали его менеджеру.";
      requestSuccess.hidden = false;
      requestSuccess.focus();
      renderRequest();
      render();
      window.KITRADE_TRACK?.("request_submit_success", {
        source: "catalog",
        order_id: orderId,
        product_count: products.length,
      });
      window.KITRADE_TRACK?.("catalog_submit_success", {
        source: "catalog",
        order_id: orderId,
        product_count: products.length,
      });
    } catch (error) {
      requestContactError.textContent = error?.name === "AbortError"
        ? "Сервер долго не отвечает. Попробуйте отправить ещё раз."
        : "Не удалось отправить заявку. Проверьте соединение и повторите попытку.";
      requestSubmit.disabled = false;
      requestSubmit.textContent = "Отправить на расчет";
      window.KITRADE_TRACK?.("request_submit_error", { source: "catalog", message: error?.message || "unknown" });
    } finally {
      state.requestSubmitting = false;
      requestPanel.removeAttribute("aria-busy");
    }
  }

  requestLookupToggle?.addEventListener("click", () => {
    setLookupOpen(requestLookupToggle.getAttribute("aria-expanded") !== "true");
  });
  requestSubmit?.addEventListener("click", () => {
    if (state.requestStep === 1) {
      if (!validateRequestDetails()) return;
      window.KITRADE_TRACK?.("request_open", { source: "catalog", product_count: state.selected.length });
      setRequestStep(2);
      return;
    }
    submitCatalogRequest();
  });
  requestBack?.addEventListener("click", () => setRequestStep(1));
  requestPanel?.querySelectorAll('input[name="catalogMessenger"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const telegram = radio.value === "Telegram";
      requestContactLabel.textContent = telegram ? "Telegram тег" : "Телефон";
      requestCustomerContact.type = telegram ? "text" : "tel";
      requestCustomerContact.placeholder = telegram ? "@username" : "+7 (___) ___-__-__";
      requestCustomerContact.autocomplete = telegram ? "off" : "tel";
      requestCustomerContact.inputMode = telegram ? "text" : "tel";
      requestContactError.textContent = "";
    });
  });
  [requestCarModel, requestCarYear, requestVin, requestMissingPart, requestComment].forEach((field) => {
    field?.addEventListener("input", () => {
      requestDetailsError.textContent = "";
      saveRequestDraft();
      updateRequestSummary();
    });
  });

  renderAllFilterOptions();
  applyCatalogFilterState({
    brands: [routeDefaults.brand || requestedUrlFilters.brands[0]].filter(Boolean),
    models: [routeDefaults.model || requestedUrlFilters.models[0]].filter(Boolean),
    categories: routeDefaults.category ? [routeDefaults.category] : requestedUrlFilters.categories,
    condition: requestedUrlFilters.condition,
  });
  document.addEventListener("kitrade:add-product", (event) => {
    const id = String(event.detail?.id || "");
    if (!id || state.selected.includes(id)) return;
    window.KITRADE_CART.add(items.find(item => item.id === id) || { id });
    persistSelection();
    renderRequest();
    render();
    showToast("Позиция добавлена в заявку");
  });
  try {
    const draft = JSON.parse(localStorage.getItem(REQUEST_DRAFT_STORAGE_KEY) || "{}");
    if (requestCarModel) requestCarModel.value = draft.model || "";
    if (requestCarYear) requestCarYear.value = draft.year || "";
    if (requestVin) requestVin.value = draft.vin || "";
    if (requestMissingPart) requestMissingPart.value = draft.part || "";
    requestComment.value = draft.comment || localStorage.getItem(COMMENT_STORAGE_KEY) || "";
    if (draft.model || draft.year || draft.vin || draft.part) setLookupOpen(true);
  } catch {}
  // Refresh snapshots for migrated positions without changing the selection.
  state.selected.forEach(id => {
    const product = items.find(item => item.id === id);
    if (product && !window.KITRADE_CART.get(id)?.title) window.KITRADE_CART.add(product);
  });
  const contactKey = 'kitradeCatalogContactSessionV1';
  try {
    const saved = JSON.parse(sessionStorage.getItem(contactKey) || 'null');
    if (saved) {
      requestCustomerName.value = saved.name || '';
      requestCustomerContact.value = saved.contact || '';
      const radio = [...requestPanel.querySelectorAll('input[name="catalogMessenger"]')].find(input => input.value === saved.messenger);
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
    }
  } catch {}
  [requestCustomerName, requestCustomerContact, ...requestPanel.querySelectorAll('input[name="catalogMessenger"]')].forEach(field => {
    field?.addEventListener('input', () => {
      try { sessionStorage.setItem(contactKey, JSON.stringify({ name: requestCustomerName.value, contact: requestCustomerContact.value,
        messenger: requestPanel.querySelector('input[name="catalogMessenger"]:checked')?.value })); } catch {}
    });
  });
  window.addEventListener('kitrade:cart-change', () => {
    state.selected = readStoredSelection();
    renderRequest();
    // Keep the current product DOM and its focus when the basket changes.
    partsGrid.querySelectorAll('[data-order-control]').forEach(control => {
      const quantity = window.KITRADE_CART.get(control.dataset.orderControl)?.quantity || 0;
      const output = control.querySelector('output');
      if (quantity && output) { output.textContent = quantity; return; }
      const focused = control.contains(document.activeElement);
      control.innerHTML = quantityMarkup(control.dataset.orderControl);
      if (focused) control.querySelector('button')?.focus({ preventScroll: true });
    });
  });
  const viewKey = 'kitradeCatalogViewV1';
  const saveView = () => {
    try { sessionStorage.setItem(viewKey, JSON.stringify({
      path: location.pathname, query: state.query, visible: state.visible,
      page: state.page, offset: state.offset, y: window.scrollY,
      brands: checkedValues('#brandFilters'), models: checkedValues('#modelFilters'),
      categories: checkedValues('#typeFilters'), condition: selectedCondition()
    })); } catch {}
  };
  window.addEventListener('pagehide', saveView);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveView();
  });
  document.addEventListener('kitrade:save-catalog', saveView);
  let restoreY = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(viewKey) || 'null');
    if (!hasExplicitInitialFilters && saved?.path === location.pathname) {
      clearFilterControls();
      const check = (selector, values) => document.querySelectorAll(selector + ' input').forEach(input => { input.checked = values.includes(input.value); });
      check('#brandFilters', saved.brands || []);
      renderModelFilter(saved.brands || []);
      check('#modelFilters', saved.models || []);
      check('#typeFilters', saved.categories || []);
      check('#conditionFilters', [saved.condition || '']);
      ['#brandFilters', '#modelFilters', '#typeFilters'].forEach(selector => updateFilterSummary(document.querySelector(selector)));
      Object.assign(state, { query: saved.query || '', visible: saved.visible || DISPLAY_PAGE_SIZE, page: saved.page || 1, offset: saved.offset || 0 });
      document.querySelector('#catalogQuery').value = state.query;
      restoreY = saved.y;
    }
  } catch {}
  window.addEventListener("popstate", (event) => {
    const saved = event.state?.kitradeCatalogFilters;
    if (!saved) return;
    applyCatalogFilterState(saved);
    Object.assign(state, {
      query: saved.query || "",
      visible: saved.visible || DISPLAY_PAGE_SIZE,
      page: saved.page || 1,
      offset: saved.offset || 0,
    });
    document.querySelector("#catalogQuery").value = state.query;
    render({ historyMode: "none" });
  });
  render();
  renderRequest();
  if (restoreY !== null && location.hash !== "#request") requestAnimationFrame(() => window.scrollTo(0, restoreY));
})();
