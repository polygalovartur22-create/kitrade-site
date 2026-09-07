(() => {
  const sitePath = (value) => {
    const path = String(value || "/");
    const base = String(window.KITRADE_SITE_CONFIG?.basePath || "").replace(/\/$/, "");
    return base && path.startsWith("/") && !path.startsWith(`${base}/`) ? `${base}${path}` : path;
  };
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav]");

  const setMenu = (open) => {
    if (!menuToggle || !mobileNav) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    mobileNav.hidden = !open;
    document.body.classList.toggle("menu-open", open);
  };

  menuToggle?.addEventListener("click", () => {
    setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
  });

  mobileNav?.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle?.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      menuToggle.focus();
    }
  });

  const dataNode = document.querySelector("#product-page-data");
  const button = document.querySelector("[data-product-request]");
  if (!dataNode || !button) return;
  let product;
  try { product = JSON.parse(dataNode.textContent); } catch { return; }
  const sync = () => {
    const selected = window.KITRADE_CART.ids().includes(String(product.id));
    button.textContent = selected ? 'В заявке' : 'В заявку';
    button.setAttribute('aria-pressed', String(selected));
  };
  sync();
  window.addEventListener('kitrade:cart-change', sync);
  window.KITRADE_TRACK?.("product_view", { product_id: product.id, page_type: "product" });
  button.addEventListener("click", () => {
    window.KITRADE_TRACK?.("add_to_request", { product_id: product.id, page_type: "product" });
    window.KITRADE_TRACK?.("request_open", { source: "product_page" });
    window.KITRADE_CART.add(product);
    let target = sitePath('/catalog/');
    try {
      const saved = JSON.parse(sessionStorage.getItem('kitradeCatalogViewV1') || 'null');
      if (saved?.path?.startsWith(sitePath('/catalog/'))) target = saved.path;
    } catch {}
    window.location.href = target + '#request';
  });
})();
