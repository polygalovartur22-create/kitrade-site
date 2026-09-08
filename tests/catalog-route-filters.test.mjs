import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { addBodyAttributes } from "../scripts/catalog/lib/catalog-page.mjs";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogApp = fs.readFileSync(path.join(projectDir, "catalog-app.js"), "utf8");

test("catalog route attributes are added without removing the body design class", () => {
  const html = '<body class="site-scaled"><main></main></body>';
  const result = addBodyAttributes(html, 'data-catalog-brand="Voyah" data-catalog-model="Free"');
  assert.equal(result, '<body class="site-scaled" data-catalog-brand="Voyah" data-catalog-model="Free"><main></main></body>');
});

test("catalog routing preserves unrelated query parameters and supports filter history", () => {
  assert.match(catalogApp, /const params = new URLSearchParams\(window\.location\.search\)/);
  assert.match(catalogApp, /const browserUrl = `\$\{browserPath\}\$\{search \? `\?\$\{search\}` : ""\}\$\{window\.location\.hash\}`/);
  assert.match(catalogApp, /history\.pushState\(nextState/);
  assert.match(catalogApp, /window\.addEventListener\("popstate"/);
});

test("the next-page link preserves the current filters, tracking parameters and hash", () => {
  assert.match(catalogApp, /function catalogPageUrl\(path\)/);
  assert.match(catalogApp, /const url = new URL\(window\.location\.href\)/);
  assert.match(catalogApp, /return `\$\{url\.pathname\}\$\{url\.search\}\$\{url\.hash\}`/);
  assert.match(catalogApp, /loadMore\.href = catalogPageUrl\(`/);
});

test("brand, model, category and condition are accepted from a direct URL", () => {
  for (const name of ["brand", "model", "category"]) {
    assert.ok(catalogApp.includes(`urlFilterValues("${name}")`));
  }
  assert.ok(catalogApp.includes('initialFilterParams.get("condition")'));
  assert.ok(catalogApp.includes('params.set("condition", condition)'));
  assert.ok(catalogApp.includes('!hasExplicitInitialFilters && saved?.path === location.pathname'));
});
