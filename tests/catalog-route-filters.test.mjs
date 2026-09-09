import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import http from "node:http";
import vm from "node:vm";
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

test("pagination hides the next-page link on the last static page", () => {
  assert.match(catalogApp, /const totalPages = Math\.max\(1, Math\.ceil\(filtered\.length \/ PAGE_SIZE\)\)/);
  assert.match(catalogApp, /loadMore\.hidden = state\.page >= totalPages/);
});

test("46–48 products: every rendered pagination href opens an existing static page, including after load more", async (t) => {
  // The HTTP fixture represents the two pages generated in batches of 24.
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const exists = ["/catalog/voyah/free/", "/catalog/voyah/free/page/2/"].includes(pathname);
    res.writeHead(exists ? 200 : 404, { "Content-Type": "text/html" });
    res.end(exists ? "<body>Catalog page</body>" : "Not found");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const renderSource = catalogApp.slice(catalogApp.indexOf('  function render({'), catalogApp.indexOf('  function plural('));
  const urlSource = catalogApp.match(/  function catalogPageUrl\(path\) \{[\s\S]*?\n  \}/)[0];
  const clickSource = catalogApp.match(/  loadMore\.addEventListener\("click",[^\n]+/)[0];
  for (const count of [46, 47, 48]) {
    for (const page of [1, 2]) {
      let click;
      const state = { query: "", page, offset: (page - 1) * 24, visible: 16 };
      const loadMore = { style: {}, removeAttribute(name) { delete this[name]; }, addEventListener(name, fn) { click = fn; } };
      const pagePath = page === 1 ? "/catalog/voyah/free/" : "/catalog/voyah/free/page/2/";
      const context = vm.createContext({
        URL, state, loadMore, PAGE_SIZE: 24, DISPLAY_PAGE_SIZE: 16,
        window: { location: { href: `${origin}${pagePath}?condition=new&utm_source=qa&yclid=123#catalog-results` } },
        getFilteredItems: () => Array.from({ length: count }, (_, id) => ({ id })),
        cardMarkup: item => `<article>${item.id}</article>`,
        checkedValues: () => [], plural: () => "позиций", sitePath: path => path,
        updateCatalogRoute: () => "/catalog/voyah/free/",
        partsGrid: {}, resultCount: {}, resultSummary: {}, emptyState: {},
      });
      vm.runInContext(`${urlSource}\n${renderSource}\n${clickSource}\nrender();`, context);
      for (let step = 0; step < 3; step++) {
        if (loadMore.hidden) {
          assert.equal(loadMore.href, undefined, `${count} products, page ${page}: hidden link has no href`);
          break;
        }
        const href = new URL(loadMore.href, origin);
        assert.equal(href.pathname, "/catalog/voyah/free/page/2/");
        assert.equal(href.searchParams.get("condition"), "new");
        assert.equal(href.searchParams.get("utm_source"), "qa");
        assert.equal(href.searchParams.get("yclid"), "123");
        assert.equal(href.hash, "#catalog-results");
        const response = await fetch(href);
        await response.text();
        assert.equal(response.status, 200, `${count} products, page ${page}, click ${step}: ${href}`);
        click({ preventDefault() {} });
      }
      assert.equal(loadMore.hidden, true);
    }
  }
});

test("brand, model, category and condition are accepted from a direct URL", () => {
  for (const name of ["brand", "model", "category"]) {
    assert.ok(catalogApp.includes(`urlFilterValues("${name}")`));
  }
  assert.ok(catalogApp.includes('initialFilterParams.get("condition")'));
  assert.ok(catalogApp.includes('params.set("condition", condition)'));
  assert.ok(catalogApp.includes('!hasExplicitInitialFilters && saved?.path === location.pathname'));
});
