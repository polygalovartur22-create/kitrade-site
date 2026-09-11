import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readCatalogData } from "../scripts/catalog/lib/data.mjs";
import { assertWellFormedGeneratedXml, buildYmlFeed } from "../scripts/catalog/lib/yml-feed.mjs";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fixture() {
  const items = [
    {
      id: "source-1", title: "Бампер A & B <тест>", brand: "Geely", model: "Coolray",
      category: "Кузов", condition: "Новое", origin: "Оригинал", price: "50000", article: "A&B",
      photos: ["http://example.test/image one.jpg"],
      compatibility: [
        { brand: "Geely", model: "Coolray", generation: "I", yearFrom: 2020, yearTo: 2024 },
        { brand: "Geely", model: "Binyue", generation: "I", yearFrom: 2020, yearTo: 2024 },
      ],
    },
    {
      id: "source-2", title: "Фара без фото", brand: "Geely", model: "Coolray",
      category: "Оптика", condition: "Б/у", price: "12000", photos: [], compatibility: [],
    },
    {
      id: "source-3", title: "Скрытая позиция", brand: "Geely", model: "Coolray",
      category: "Кузов", condition: "Новое", price: "30000", photos: ["https://example.test/hidden.jpg"], compatibility: [],
    },
  ];
  const registry = {
    entities: {
      brands: [{ id: "b1001", name: "Geely", source_names: ["Geely"], slug: "geely", status: "active" }],
      models: [
        { id: "m1001", parent_id: "b1001", name: "Coolray", source_names: ["Coolray"], slug: "coolray", status: "active" },
        { id: "m1002", parent_id: "b1001", name: "Binyue", source_names: ["Binyue"], slug: "binyue", status: "active" },
      ],
      categories: [
        { id: "c1001", name: "Кузов", slug: "kuzov", status: "active" },
        { id: "c1002", name: "Оптика", slug: "optika", status: "active" },
      ],
      products: [
        { product_id: 1001, source_id: "source-1", name: items[0].title, canonical_path: "/catalog/product/bumper-1001/", brand_id: "b1001", model_id: "m1001", category_id: "c1001", public_category: "Кузов", status: "active" },
        { product_id: 1002, source_id: "source-2", name: items[1].title, canonical_path: "/catalog/product/lamp-1002/", brand_id: "b1001", model_id: "m1001", category_id: "c1002", public_category: "Оптика", status: "active" },
        { product_id: 1003, source_id: "source-3", name: items[2].title, canonical_path: "/catalog/product/hidden-1003/", brand_id: "b1001", model_id: "m1001", category_id: "c1001", public_category: "Кузов", status: "needs_review" },
      ],
    },
  };
  const config = { siteUrl: "https://example.test", organization: { name: "KITRADE", legalName: "ИП Тест" } };
  const seoState = { productState: new Map([[1001, { content: { h1: items[0].title, condition: "Новое", origin: "Оригинал", article: "A&B" } }]]) };
  return { items, registry, config, seoState };
}

test("YML exports only complete publishable products and preserves filter data", () => {
  const result = buildYmlFeed({ ...fixture(), generatedAt: new Date("2026-09-10T10:15:00+07:00") });
  assert.equal(result.model.offers.length, 1);
  assert.equal(result.report.counts.source_records, 3);
  assert.equal(result.report.counts.unique_publishable_products, 2);
  assert.equal(result.report.counts.exported_offers, 1);
  assert.equal(result.report.counts.excluded_source_records, 2);
  assert.deepEqual(result.report.exclusion_reason_counts, {
    missing_public_image: 1,
    "not_publishable_status:needs_review": 1,
  });
  const offer = result.model.offers[0];
  assert.equal(offer.id, "1001");
  assert.equal(offer.available, false);
  assert.equal(offer.url, "https://example.test/catalog/product/bumper-1001/");
  assert.equal(offer.price, "50000");
  assert.equal(offer.currencyId, "RUB");
  assert.equal(offer.pictures[0], "https://example.test/image%20one.jpg");
  assert.equal(offer.labels.custom_label_0, "Новое");
  assert.equal(offer.labels.custom_label_1, "Кузов");
  assert.equal(offer.labels.custom_label_2, "Geely");
  assert.equal(offer.labels.custom_label_3, "Geely Coolray; Geely Binyue");
  assert.deepEqual(offer.compatibility, ["Geely Coolray, I, 2020–2024", "Geely Binyue, I, 2020–2024"]);
  assert.deepEqual(new Set(offer.collectionIds), new Set(["brandb1001", "modelm1001", "modelm1002"]));
  assert.match(result.xml, /<name>Бампер A &amp; B &lt;тест&gt;<\/name>/);
  assert.match(result.xml, /<vendorCode>A&amp;B<\/vendorCode>/);
  assert.doesNotMatch(result.xml, /localhost|127\.0\.0\.1/);
  assertWellFormedGeneratedXml(result.xml);
});

test("an unlisted product disappears from the next generated feed", () => {
  const input = fixture();
  input.registry.entities.products[0].status = "unlisted";
  const result = buildYmlFeed({ ...input, generatedAt: new Date("2026-09-10T10:15:00+07:00") });
  assert.equal(result.model.offers.length, 0);
  assert.ok(result.report.exclusions.some((entry) => entry.product_id === "1001" && entry.reasons.includes("not_publishable_status:unlisted")));
});

test("a feed-only override can improve one offer without changing catalog content", () => {
  const result = buildYmlFeed({
    ...fixture(),
    offerOverrides: {
      1001: {
        name: "Бампер Geely Coolray A&B",
        pictures: ["/assets/feed-preview/bumper-1001.png"],
        description: "Бампер Geely Coolray. Артикул: A&B.",
      },
    },
    generatedAt: new Date("2026-09-10T10:15:00+07:00"),
  });
  const offer = result.model.offers[0];
  assert.equal(offer.name, "Бампер Geely Coolray A&B");
  assert.deepEqual(offer.pictures, ["https://example.test/assets/feed-preview/bumper-1001.png"]);
  assert.equal(offer.description, "Бампер Geely Coolray. Артикул: A&B.");
  assert.match(result.xml, /<picture>https:\/\/example\.test\/assets\/feed-preview\/bumper-1001\.png<\/picture>/);
});

test("a noncanonical duplicate is not exported as a second offer", () => {
  const input = fixture();
  input.seoState.productState.set(1002, {
    indexable: false,
    canonicalPath: "/catalog/product/bumper-1001/",
    content: { h1: input.items[1].title, condition: "Б/у" },
  });
  const result = buildYmlFeed({ ...input, generatedAt: new Date("2026-09-10T10:15:00+07:00") });
  assert.equal(result.model.offers.length, 1);
  assert.ok(result.report.exclusions.some((entry) => entry.product_id === "1002" && entry.reasons.includes("noncanonical_duplicate")));
});

test("generated current-catalog YML is well formed, unique, absolute and fully accounted for", () => {
  const xml = fs.readFileSync(path.join(projectDir, "public", "yandex-direct-feed.yml"), "utf8");
  const report = JSON.parse(fs.readFileSync(path.join(projectDir, "reports", "feed", "yandex-direct-feed-report.json"), "utf8"));
  const sourceItems = readCatalogData(path.join(projectDir, "kitrade-parts-data.js"));
  assertWellFormedGeneratedXml(xml);
  const offerIds = [...xml.matchAll(/<offer id="(\d+)" available="false">/g)].map((match) => match[1]);
  assert.equal(offerIds.length, report.counts.exported_offers);
  assert.equal(new Set(offerIds).size, offerIds.length);
  assert.equal(report.counts.source_records, sourceItems.length);
  assert.equal(report.counts.exported_offers + report.counts.excluded_source_records, report.counts.source_records);
  assert.ok(report.counts.exported_offers > 1000, "Current catalog feed is unexpectedly small");
  assert.ok(report.exclusions.some((entry) => entry.source_id === "7244736542" && entry.reasons.includes("missing_public_image")));
  assert.ok(xml.includes("https://xn--d1abifc1bn.xn--p1ai/catalog/product/"));
  assert.ok(fs.existsSync(path.join(projectDir, "assets", "feed-preview", "geely-galaxy-l7-headlight-1184-v2.png")));
  assert.match(xml, /<offer id="1184" available="false">[\s\S]*?<picture>https:\/\/xn--d1abifc1bn\.xn--p1ai\/assets\/feed-preview\/geely-galaxy-l7-headlight-1184-v2\.png<\/picture>[\s\S]*?<name>Передняя фара правая Geely Galaxy L7 6608086101<\/name>[\s\S]*?<vendorCode>6608086101<\/vendorCode>[\s\S]*?<custom_label_0>Новое<\/custom_label_0>[\s\S]*?<\/offer>/);
  assert.doesNotMatch(xml, /(?:localhost|127\.0\.0\.1|onrender\.com|github\.io|netlify\.app|pages\.dev|vercel\.app)/i);
});
