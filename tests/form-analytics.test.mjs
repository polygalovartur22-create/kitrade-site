import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (filename) => fs.readFileSync(path.join(projectDir, filename), "utf8");
const occurrences = (source, value) => source.split(value).length - 1;
const confirmationGate = 'if (!response.ok || !confirmation?.ok || confirmation.confirmation !== "saved")';

const siteConfig = JSON.parse(read("site.config.json"));
const runtimeConfig = read("site-runtime-config.js");
const analyticsScript = read("analytics.js");
const searchFormScript = read("script.js");
const catalogFormScript = read("catalog-app.js");

function assertConfirmedSuccessEvent(source, eventName) {
  const gateIndex = source.indexOf(confirmationGate);
  const generalIndex = source.indexOf('KITRADE_TRACK?.("request_submit_success",');
  const specificIndex = source.indexOf(`KITRADE_TRACK?.("${eventName}",`);

  assert.notEqual(gateIndex, -1, "The CRM confirmation gate is missing");
  assert.ok(generalIndex > gateIndex, "The general success event is sent before CRM confirmation");
  assert.ok(specificIndex > gateIndex, `${eventName} is sent before CRM confirmation`);
  assert.equal(occurrences(source, 'KITRADE_TRACK?.("request_submit_success",'), 1);
  assert.equal(occurrences(source, `KITRADE_TRACK?.("${eventName}",`), 1);

  const call = source.slice(specificIndex, source.indexOf("});", specificIndex) + 3);
  for (const personalField of ["name", "phone", "contact", "vin", "details"]) {
    assert.ok(!new RegExp(`\\b${personalField}\\b`, "i").test(call), `${eventName} contains ${personalField}`);
  }
}

function analyticsContext({ hostname, consent = "accepted", ym }) {
  const storage = new Map([["kitradeCookieConsentV1", JSON.stringify({ choice: consent })]]);
  const window = {
    KITRADE_SITE_CONFIG: {
      analytics: {
        counterId: 111376296,
        domain: "китрейд.рф",
        acceptOnlyConfiguredDomain: true,
        enabled: true,
        webvisor: true,
        events: siteConfig.analytics.events,
      },
    },
    __KITRADE_METRIKA_INITIALIZED__: true,
    location: {
      hostname,
      href: `https://${hostname}/`,
      search: "",
    },
    ym,
    addEventListener() {},
  };
  return {
    window,
    document: {
      referrer: "",
      scripts: [],
      head: { append() {} },
      createElement() { return {}; },
    },
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, String(value)); },
    },
    URL,
    URLSearchParams,
  };
}

test("specific success events are allowlisted without matching the legacy goal name", () => {
  for (const eventName of ["catalog_submit_success", "search_submit_success"]) {
    assert.ok(siteConfig.analytics.events.includes(eventName));
    assert.ok(runtimeConfig.includes(`"${eventName}"`));
    assert.ok(!eventName.includes("request_submit_success"));
  }
  assert.equal(siteConfig.analytics.events.filter((event) => event === "request_submit_success").length, 1);
});

test("search success is tracked once and only after confirmed CRM persistence", () => {
  assertConfirmedSuccessEvent(searchFormScript, "search_submit_success");
  assert.equal(occurrences(searchFormScript, "catalog_submit_success"), 0);
  const submitHandler = searchFormScript.indexOf('requestForm.addEventListener("submit"');
  assert.ok(searchFormScript.indexOf('KITRADE_TRACK?.("search_submit_success",') > submitHandler);
});

test("catalog success is tracked once and only after confirmed CRM persistence", () => {
  assertConfirmedSuccessEvent(catalogFormScript, "catalog_submit_success");
  assert.equal(occurrences(catalogFormScript, "search_submit_success"), 0);
  const submitFunction = catalogFormScript.indexOf("async function submitCatalogRequest()");
  assert.ok(catalogFormScript.indexOf('KITRADE_TRACK?.("catalog_submit_success",') > submitFunction);
});

test("a Metrika exception cannot escape KITRADE_TRACK", () => {
  const context = analyticsContext({
    hostname: "китрейд.рф",
    ym() { throw new Error("simulated analytics failure"); },
  });
  vm.runInNewContext(analyticsScript, context);
  assert.doesNotThrow(() => context.window.KITRADE_TRACK("search_submit_success", { product_count: 0 }));
  assert.doesNotThrow(() => context.window.KITRADE_TRACK("catalog_submit_success", { product_count: 1 }));
});

test("consent and preview-host blocking remain effective for new events", () => {
  for (const options of [
    { hostname: "localhost", consent: "accepted" },
    { hostname: "китрейд.рф", consent: "rejected" },
  ]) {
    let calls = 0;
    const context = analyticsContext({ ...options, ym() { calls += 1; } });
    vm.runInNewContext(analyticsScript, context);
    context.window.KITRADE_TRACK("search_submit_success");
    context.window.KITRADE_TRACK("catalog_submit_success");
    assert.equal(calls, 0);
  }
});
