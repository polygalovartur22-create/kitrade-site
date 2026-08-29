"use strict";

(() => {
  const requestPanel = document.querySelector(".request-panel");
  const requestSelection = document.querySelector("#requestSelection");
  const filterPanel = document.querySelector(".filter-panel");
  if (!requestPanel || !requestSelection) return;

  const closeButton = document.createElement("button");
  closeButton.className = "catalog-request-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Закрыть заявку");
  closeButton.textContent = "";
  requestPanel.prepend(closeButton);

  const dock = document.createElement("button");
  dock.className = "catalog-mobile-cart";
  dock.type = "button";
  dock.setAttribute("aria-controls", "request");
  dock.innerHTML = "<span><strong>Заявка на расчёт</strong><span data-mobile-cart-label>Позиции не выбраны</span></span><b data-mobile-cart-count>0</b>";
  document.body.append(dock);

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
      filterPanel.classList.remove("is-mobile-open");
      document.body.classList.remove("catalog-filter-open");
      filterButton.setAttribute("aria-expanded", "false");
      filterButton.focus();
    };

    const openFilters = () => {
      filterPanel.classList.add("is-mobile-open");
      document.body.classList.add("catalog-filter-open");
      filterButton.setAttribute("aria-expanded", "true");
      filterClose.focus();
    };

    filterButton.addEventListener("click", openFilters);
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
    requestPanel.classList.add("is-mobile-open");
    document.body.classList.add("catalog-request-open");
    closeButton.focus();
  };

  const closePanel = () => {
    requestPanel.classList.remove("is-mobile-open");
    document.body.classList.remove("catalog-request-open");
    dock.focus();
  };

  const updateDock = () => {
    const count = requestSelection.querySelectorAll("[data-remove]").length;
    dock.querySelector("[data-mobile-cart-count]").textContent = String(count);
    dock.querySelector("[data-mobile-cart-label]").textContent =
      count === 0 ? "Позиции не выбраны" : count === 1 ? "1 позиция выбрана" : `${count} позиции выбраны`;
  };

  dock.addEventListener("click", openPanel);
  closeButton.addEventListener("click", closePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && requestPanel.classList.contains("is-mobile-open")) closePanel();
  });

  new MutationObserver(updateDock).observe(requestSelection, { childList: true, subtree: true });
  updateDock();
})();
