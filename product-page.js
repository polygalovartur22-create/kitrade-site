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
  try {
    const stored = JSON.parse(localStorage.getItem("kitradeCatalogSelectionV1") || "[]");
    const ids = Array.isArray(stored) ? stored : stored?.ids;
    if (Array.isArray(ids) && ids.map(String).includes(String(product.id))) {
      button.textContent = "В заявке";
      button.setAttribute("aria-pressed", "true");
    }
  } catch {}
  window.KITRADE_TRACK?.("product_view", { product_id: product.id, page_type: "product" });
  button.addEventListener("click", () => {
    window.KITRADE_TRACK?.("add_to_request", { product_id: product.id, page_type: "product" });
    window.KITRADE_TRACK?.("request_open", { source: "product_page" });
    const article = product.article ? `, арт. ${product.article}` : "";
    try {
      const stored = JSON.parse(localStorage.getItem("kitradeCatalogSelectionV1") || "[]");
      const ids = Array.isArray(stored) ? stored : stored?.ids;
      const next = [...new Set([...(Array.isArray(ids) ? ids.map(String) : []), String(product.id)])];
      localStorage.setItem("kitradeCatalogSelectionV1", JSON.stringify(next));
    } catch {}
    sessionStorage.setItem("kitradeCatalogDraft", JSON.stringify({
      details: `Позиция из каталога:\n1. ${product.title}${article}`,
      selected_products: [{
        product_id: String(product.id || ""),
        title: product.title || "",
        article: product.article || "",
        price: Number(product.price) || 0,
      }],
      preliminary_sum: Number(product.price) || 0,
      createdAt: Date.now(),
    }));
    window.location.href = sitePath("/#request");
  });
})();
