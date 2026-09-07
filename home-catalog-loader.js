(() => {
  const rhythmSections = ["catalog", "about", "company", "workflow", "orders", "guarantee", "faq", "request", "contacts"];
  const syncMobileRhythm = () => {
    const mobile = window.matchMedia("(max-width: 700px)").matches;
    rhythmSections.forEach((id) => {
      const section = document.getElementById(id);
      if (!section) return;
      if (mobile) {
        section.style.setProperty("padding-top", "52px", "important");
        section.style.setProperty("padding-bottom", "52px", "important");
      } else {
        section.style.removeProperty("padding-top");
        section.style.removeProperty("padding-bottom");
      }
    });
  };
  syncMobileRhythm();
  window.addEventListener("resize", syncMobileRhythm, { passive: true });

  const root = document.querySelector("[data-home-catalog-strip]");
  if (!root) return;

  const base = String(window.KITRADE_SITE_CONFIG?.basePath || "").replace(/\/$/, "");
  const isOpenDesignPreview = window.location.pathname.includes("/api/projects/")
    && window.location.pathname.includes("/preview/");
  const assetPath = (value) => isOpenDesignPreview && value.startsWith("/")
    ? `.${value}`
    : `${base}${value}`;
  let started = false;

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = assetPath(src);
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
    document.head.append(script);
  });

  const start = async () => {
    if (started) return;
    started = true;
    try {
      await loadScript("/catalog-runtime-data.js?v=2");
      await loadScript("/product-quick-view.js?v=7");
      await loadScript("/home-catalog-strip.js?v=10");
    } catch (error) {
      console.error("Каталог временно недоступен", error);
    }
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      start();
    }, { rootMargin: "420px 0px" });
    observer.observe(root);
  } else {
    start();
  }
})();
