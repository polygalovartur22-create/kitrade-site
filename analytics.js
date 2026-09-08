(() => {
  const CONSENT_STORAGE_KEY = "kitradeCookieConsentV1";
  const settings = window.KITRADE_SITE_CONFIG?.analytics;
  const counterId = Number(settings?.counterId);
  const allowedEvents = new Set(settings?.events || []);
  const previewHost = /(?:^|\.)(?:onrender\.com|github\.io|netlify\.app|pages\.dev|vercel\.app|web\.app|firebaseapp\.com)$/i.test(window.location.hostname)
    || /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(window.location.hostname)
    || /(?:^|\.)local$/i.test(window.location.hostname);
  const configuredHost = (() => {
    try { return new URL(`https://${settings?.domain || ""}`).hostname; } catch { return ""; }
  })();
  const wrongConfiguredHost = Boolean(settings?.acceptOnlyConfiguredDomain && configuredHost)
    && window.location.hostname !== configuredHost
    && !window.location.hostname.endsWith(`.${configuredHost}`);
  const analyticsBlocked = previewHost || wrongConfiguredHost || !settings?.enabled || !counterId;
  const disableKey = `disableYaCounter${counterId}`;
  const attributionKey = "kitrade:first-touch:v1";
  const currentParams = new URLSearchParams(window.location.search);
  const currentUtm = Object.fromEntries([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ].map((name) => [name, currentParams.get(name) || ""]).filter(([, value]) => value));
  let attribution = {};

  const readConsentChoice = () => {
    try {
      const value = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) || "null");
      return value?.choice === "accepted" || value?.choice === "rejected" ? value.choice : "";
    } catch {
      return "";
    }
  };

  if (readConsentChoice() === "accepted") {
    try { attribution = JSON.parse(localStorage.getItem(attributionKey) || "{}"); } catch { attribution = {}; }
  }
  if (!attribution || typeof attribution !== "object" || Array.isArray(attribution)) attribution = {};
  if (!attribution.first_landing_url) attribution.first_landing_url = window.location.href;
  if (!attribution.yclid && currentParams.get("yclid")) attribution.yclid = currentParams.get("yclid");
  if (!attribution.utm || !Object.keys(attribution.utm).length) attribution.utm = currentUtm;

  const saveAttribution = () => {
    if (readConsentChoice() !== "accepted") return;
    try { localStorage.setItem(attributionKey, JSON.stringify(attribution)); } catch { /* storage is optional */ }
  };

  window.KITRADE_GET_ATTRIBUTION = () => ({
    metrika_client_id: String(attribution.metrika_client_id || ""),
    yclid: String(attribution.yclid || ""),
    utm: { ...(attribution.utm || {}) },
    first_landing_url: String(attribution.first_landing_url || window.location.href),
  });

  window.KITRADE_TRACK = (eventName, params = {}) => {
    if (analyticsBlocked || readConsentChoice() !== "accepted" || !window.__KITRADE_METRIKA_INITIALIZED__
      || !allowedEvents.has(eventName) || typeof window.ym !== "function") return;
    try {
      window.ym(counterId, "reachGoal", eventName, params);
    } catch {
      // Analytics is optional and must never interrupt the website flow.
    }
  };

  window[disableKey] = readConsentChoice() !== "accepted";

  const initializeAnalytics = () => {
    if (analyticsBlocked || readConsentChoice() !== "accepted") return;
    window[disableKey] = false;
    saveAttribution();
    if (window.__KITRADE_METRIKA_INITIALIZED__) return;

    window.__KITRADE_METRIKA_INITIALIZED__ = true;
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    const tagUrl = `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`;
    if (![...document.scripts].some((script) => script.src === tagUrl)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = tagUrl;
      document.head.append(script);
    }
    window.ym(counterId, "init", {
      ssr: true,
      webvisor: Boolean(settings?.webvisor),
      clickmap: true,
      ecommerce: "dataLayer",
      referrer: document.referrer,
      url: window.location.href,
      accurateTrackBounce: true,
      trackLinks: true,
    });
    window.ym(counterId, "getClientID", (clientId) => {
      if (!clientId) return;
      attribution.metrika_client_id = String(clientId);
      saveAttribution();
    });
  };

  window.addEventListener("kitrade:cookie-choice", (event) => {
    if (event.detail?.choice === "accepted") {
      initializeAnalytics();
      return;
    }
    if (event.detail?.choice === "rejected") window[disableKey] = true;
  });

  initializeAnalytics();
})();
