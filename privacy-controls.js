(() => {
  const STORAGE_KEY = "kitradeCookieConsentV1";

  const sitePath = (value) => {
    const path = String(value || "/");
    const base = String(window.KITRADE_SITE_CONFIG?.basePath || "").replace(/\/$/, "");
    return base && path.startsWith("/") && !path.startsWith(`${base}/`) ? `${base}${path}` : path;
  };

  const readChoice = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return value?.choice === "accepted" || value?.choice === "rejected" ? value.choice : "";
    } catch {
      return "";
    }
  };

  const saveChoice = (choice) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        choice,
        updatedAt: new Date().toISOString(),
      }));
    } catch {}
  };

  const createBanner = () => {
    const banner = document.createElement("aside");
    banner.className = "kit-cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Настройки cookie");
    banner.hidden = true;
    banner.innerHTML = `
      <p>Мы используем обязательные cookie для работы сайта и, с вашего согласия, Яндекс Метрику для анализа посещаемости. Подробнее — в <a href="${sitePath("/privacy-policy/")}">Политике обработки персональных данных</a>.</p>
      <div class="kit-cookie-banner__actions">
        <button type="button" data-cookie-choice="rejected">Только необходимые</button>
        <button type="button" data-cookie-choice="accepted">Разрешить аналитику</button>
      </div>`;
    document.body.append(banner);

    banner.addEventListener("click", (event) => {
      const button = event.target.closest("[data-cookie-choice]");
      if (!button) return;
      const choice = button.dataset.cookieChoice;
      saveChoice(choice);
      banner.hidden = true;
      window.dispatchEvent(new CustomEvent("kitrade:cookie-choice", {
        detail: { choice },
      }));
    });
    return banner;
  };

  const banner = createBanner();
  const openSettings = () => {
    banner.hidden = false;
    requestAnimationFrame(() => banner.querySelector("button")?.focus());
  };

  document.addEventListener("click", (event) => {
    const settings = event.target.closest("[data-cookie-settings]");
    if (!settings) return;
    event.preventDefault();
    openSettings();
  });

  if (!readChoice()) openSettings();

  document.addEventListener("change", (event) => {
    if (!event.target.matches('input[name="privacyConsent"][required]')) return;
    if (event.target.checked) event.target.setCustomValidity("");
  });

  document.addEventListener("submit", (event) => {
    const consent = event.target.querySelector('input[name="privacyConsent"][required]');
    if (!consent || consent.checked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    consent.setCustomValidity("Подтвердите согласие на обработку персональных данных.");
    const error = event.target.querySelector('[data-error="privacyConsent"]');
    if (error) error.textContent = "Подтвердите согласие на обработку персональных данных.";
    consent.focus();
  }, true);
})();
