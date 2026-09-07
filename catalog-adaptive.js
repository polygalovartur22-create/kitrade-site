"use strict";

(() => {
  const requestPanel = document.querySelector(".request-panel");
  const requestSelection = document.querySelector("#requestSelection");
  const filterPanel = document.querySelector(".filter-panel");
  if (!requestPanel || !requestSelection) return;
  const syncViewport = () => {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--catalog-visible-height', `${height}px`);
    document.documentElement.style.setProperty('--catalog-visible-top', `${viewport?.offsetTop || 0}px`);
  };
  syncViewport();
  window.addEventListener('resize', syncViewport, { passive: true });
  window.visualViewport?.addEventListener('resize', syncViewport, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncViewport, { passive: true });

  const closeButton = document.createElement("button");
  closeButton.className = "catalog-request-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Закрыть заявку");
  closeButton.textContent = "";
  requestPanel.prepend(closeButton);

  const dock = document.createElement("button");
  dock.className = "catalog-mobile-cart";
  dock.type = "button";
  dock.setAttribute("aria-haspopup", "dialog");
  dock.dataset.odId = 'mobile-basket';
  dock.innerHTML = "<span><strong>Корзина</strong><span data-mobile-cart-label>Пока пусто</span></span><b data-mobile-cart-count>0</b>";
  document.body.append(dock);

  let activePanel = null;
  const blocked = new Map();
  function modal(panel, open) {
    blocked.forEach((value, element) => { element.inert = value; });
    blocked.clear();
    activePanel = open ? panel : null;
    if (open) panel.setAttribute('aria-modal', 'true');
    else panel.removeAttribute('aria-modal');
    if (open) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', panel === filterPanel ? 'Фильтры каталога' : 'Оформление заявки');
      for (let branch = panel; branch.parentElement && branch !== document.body; branch = branch.parentElement) {
        [...branch.parentElement.children].filter(element => element !== branch).forEach(element => {
          blocked.set(element, element.inert); element.inert = true;
        });
      }
    } else panel.removeAttribute('role');
  }
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !activePanel) return;
    const controls = [...activePanel.querySelectorAll('button, input, textarea, select, a[href], [tabindex="0"]')]
      .filter(element => !element.disabled && element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });

  if (filterPanel) {
    const filterClose = document.createElement("button");
    filterClose.className = "catalog-filter-close";
    filterClose.type = "button";
    filterClose.setAttribute("aria-label", "Закрыть фильтры");
    filterClose.textContent = "";
    filterPanel.prepend(filterClose);

    const filterButton = document.createElement("button");
    filterButton.className = "catalog-mobile-filter-button";
    filterButton.type = "button";
    filterButton.setAttribute("aria-controls", "catalog");
    filterButton.textContent = "Фильтры";
    document.body.append(filterButton);

    const closeFilters = () => {
      modal(filterPanel, false);
      filterPanel.classList.remove("is-mobile-open");
      document.body.classList.remove("catalog-filter-open");
      filterButton.setAttribute("aria-expanded", "false");
      filterButton.focus({ preventScroll: true });
    };

    const openFilters = () => {
      modal(filterPanel, true);
      filterPanel.classList.add("is-mobile-open");
      document.body.classList.add("catalog-filter-open");
      filterButton.setAttribute("aria-expanded", "true");
      filterPanel.scrollTop = 0;
      filterClose.focus({ preventScroll: true });
    };

    filterButton.addEventListener("click", openFilters);
    document.querySelector('.filter-apply')?.addEventListener('click', () => {
      if (filterPanel.classList.contains('is-mobile-open')) closeFilters();
    });
    filterClose.addEventListener("pointerdown", (event) => event.stopPropagation());
    filterClose.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeFilters();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && filterPanel.classList.contains("is-mobile-open")) closeFilters();
    });
  }

  const openPanel = () => {
    modal(requestPanel, true);
    requestPanel.classList.add("is-mobile-open");
    document.body.classList.add("catalog-request-open");
    requestPanel.scrollTop = 0;
    closeButton.focus({ preventScroll: true });
  };

  const closePanel = () => {
    modal(requestPanel, false);
    requestPanel.classList.remove("is-mobile-open");
    document.body.classList.remove("catalog-request-open");
    dock.focus({ preventScroll: true });
  };

  const updateDock = () => {
    const entries = window.KITRADE_CART?.items() || [];
    const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    dock.querySelector("[data-mobile-cart-count]").textContent = String(count);
    dock.querySelector("[data-mobile-cart-label]").textContent =
      count === 0 ? "Пока пусто" : `Выбрано: ${count} шт.`;
  };

  dock.addEventListener("click", () => window.dispatchEvent(new CustomEvent('kitrade:open-basket')));
  window.addEventListener('kitrade:cart-change', updateDock);
  matchMedia('(max-width: 1199px)').addEventListener('change', event => {
    if (!event.matches && activePanel) {
      activePanel.classList.remove('is-mobile-open');
      modal(activePanel, false);
      document.body.classList.remove('catalog-filter-open', 'catalog-request-open');
    }
  });
  closeButton.addEventListener("click", closePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && requestPanel.classList.contains("is-mobile-open")) closePanel();
  });

  new MutationObserver(updateDock).observe(requestSelection, { childList: true, subtree: true });
  updateDock();
  const openRequest = (event) => {
    if (location.hash !== '#request' && event?.type !== 'kitrade:open-request') return;
    if (matchMedia('(max-width: 1199px)').matches) openPanel();
    else { requestPanel.tabIndex = -1; requestPanel.focus({ preventScroll: true }); }
  };
  window.addEventListener('hashchange', openRequest);
  window.addEventListener('kitrade:open-request', openRequest);
  document.addEventListener('click', event => { if (event.target.closest('[data-cart-link]') && location.hash === '#request') openRequest(); });
  openRequest();
})();
