import fs from "node:fs";
import path from "node:path";
import { isDirectPublicImage, normalizePhoto } from "./data.mjs";
import { numericPrice } from "./product-content.mjs";

export const YML_FEED_FILENAME = "yandex-direct-feed.yml";
export const YML_FEED_PUBLIC_PATH = `/${YML_FEED_FILENAME}`;

const normalizeKey = (value) => String(value || "")
  .trim()
  .toLocaleLowerCase("ru")
  .replaceAll("ё", "е")
  .replace(/\s+/g, " ");

const unique = (values) => [...new Set(values.filter(Boolean))];

export function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function formatYmlDate(value = new Date(), timeZone = "Asia/Krasnoyarsk") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid YML generation date");
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function formatPrice(value) {
  const price = numericPrice(value);
  if (!Number.isFinite(price) || price <= 0) return "";
  return Number.isInteger(price) ? String(price) : String(price).replace(/0+$/, "").replace(/\.$/, "");
}

function entityNumericId(value) {
  const match = String(value || "").match(/(\d+)$/);
  return match ? match[1] : "";
}

function absoluteUrl(siteUrl, route) {
  try {
    return new URL(String(route || ""), `${String(siteUrl || "").replace(/\/$/, "")}/`).href;
  } catch {
    return "";
  }
}

function validPublicUrl(value, { siteOrigin = "", sameOrigin = false } = {}) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname)) return false;
    return !sameOrigin || url.origin === siteOrigin;
  } catch {
    return false;
  }
}

function compatibilityRows(item, brand, model) {
  const sourceRows = Array.isArray(item?.compatibility) && item.compatibility.length
    ? item.compatibility
    : [{ brand: brand?.name || item?.brand, model: model?.name || item?.model, generation: item?.generation, yearFrom: item?.yearFrom, yearTo: item?.yearTo }];
  const seen = new Set();
  const rows = [];
  for (const source of sourceRows) {
    const row = {
      brand: String(source?.brand || "").trim(),
      model: String(source?.model || "").trim(),
      generation: String(source?.generation || "").trim(),
      yearFrom: Number(source?.yearFrom) || null,
      yearTo: Number(source?.yearTo) || null,
    };
    if (!row.brand && !row.model) continue;
    const key = [row.brand, row.model, row.generation, row.yearFrom, row.yearTo].map(normalizeKey).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

function compatibilityText(row) {
  const vehicle = [row.brand, row.model].filter(Boolean).join(" ");
  const generation = row.generation ? `, ${row.generation}` : "";
  const years = row.yearFrom
    ? row.yearTo && row.yearTo !== row.yearFrom ? `, ${row.yearFrom}–${row.yearTo}` : `, ${row.yearFrom}`
    : "";
  return `${vehicle}${generation}${years}`.trim();
}

function entityResolvers(registry) {
  const brandsByName = new Map();
  const modelsByName = new Map();
  const brandsById = new Map(registry.entities.brands.map((entry) => [entry.id, entry]));
  for (const brand of registry.entities.brands) {
    for (const name of unique([brand.name, ...(brand.source_names || [])])) brandsByName.set(normalizeKey(name), brand);
  }
  for (const model of registry.entities.models) {
    const brand = brandsById.get(model.parent_id);
    if (!brand) continue;
    for (const brandName of unique([brand.name, ...(brand.source_names || [])])) {
      for (const modelName of unique([model.name, ...(model.source_names || [])])) {
        modelsByName.set(`${normalizeKey(brandName)}|${normalizeKey(modelName)}`, model);
      }
    }
  }
  return { brandsByName, modelsByName, brandsById };
}

function collectionForBrand(brand, siteUrl, picture) {
  return {
    id: `brand${brand.id}`,
    url: absoluteUrl(siteUrl, `/catalog/${brand.slug}/`),
    name: `Запчасти ${brand.name}`,
    picture,
  };
}

function collectionForModel(brand, model, siteUrl, picture) {
  return {
    id: `model${model.id}`,
    url: absoluteUrl(siteUrl, `/catalog/${brand.slug}/${model.slug}/`),
    name: `Запчасти ${brand.name} ${model.name}`,
    picture,
  };
}

function offerCandidate({ product, item, brand, model, category, content, config, resolvers, override = {} }) {
  const reasons = [];
  const siteUrl = String(config.siteUrl || "").replace(/\/$/, "");
  const siteOrigin = (() => { try { return new URL(siteUrl).origin; } catch { return ""; } })();
  const id = String(product.product_id || "");
  const name = String(override.name || content?.h1 || product.name || item?.title || "").trim();
  const price = formatPrice(item?.price);
  const categoryId = entityNumericId(category?.id);
  const url = absoluteUrl(siteUrl, product.canonical_path);
  const pictureSources = Array.isArray(override.pictures) && override.pictures.length ? override.pictures : (item?.photos || []);
  const pictures = unique(pictureSources
    .filter(isDirectPublicImage)
    .map(normalizePhoto)
    .map((photo) => absoluteUrl(siteUrl, photo))
    .filter((photo) => validPublicUrl(photo)))
    .slice(0, 5);
  const compatibility = compatibilityRows(item, brand, model);

  if (!/^\d{1,100}$/.test(id)) reasons.push("invalid_offer_id");
  if (!name) reasons.push("missing_name");
  if (!price) reasons.push("invalid_or_missing_price");
  if (!categoryId || !/^\d{1,18}$/.test(categoryId) || Number(categoryId) <= 0) reasons.push("invalid_or_missing_category");
  if (!validPublicUrl(url, { siteOrigin, sameOrigin: true })) reasons.push("invalid_product_url");
  if (!pictures.length) reasons.push("missing_public_image");
  if (compatibility.length > 10) reasons.push("compatibility_exceeds_10_properties");

  const compatibilityBrands = unique(compatibility.map((row) => row.brand));
  const compatibilityModels = unique(compatibility.map((row) => [row.brand, row.model].filter(Boolean).join(" ")));
  const labels = {
    custom_label_0: String(content?.condition || item?.condition || "Не указано").trim(),
    custom_label_1: String(category?.name || product.public_category || item?.category || "Запчасти").trim(),
    custom_label_2: compatibilityBrands.join("; ") || "Марка не указана",
    custom_label_3: compatibilityModels.join("; ") || "Модель не указана",
    custom_label_4: "Под заказ из Китая",
  };
  if (Object.values(labels).some((value) => [...value].length > 175)) reasons.push("custom_label_exceeds_175_characters");

  if (reasons.length) return { reasons };

  const collectionIds = new Set();
  const collectionDefinitions = [];
  const unresolvedCompatibility = [];
  for (const row of compatibility) {
    const resolvedBrand = resolvers.brandsByName.get(normalizeKey(row.brand));
    const resolvedModel = resolvedBrand
      ? resolvers.modelsByName.get(`${normalizeKey(row.brand)}|${normalizeKey(row.model)}`)
      : null;
    if (!resolvedBrand || !resolvedModel) {
      unresolvedCompatibility.push(compatibilityText(row));
      continue;
    }
    const brandCollection = collectionForBrand(resolvedBrand, siteUrl, pictures[0]);
    const modelCollection = collectionForModel(resolvedBrand, resolvedModel, siteUrl, pictures[0]);
    collectionIds.add(brandCollection.id);
    collectionIds.add(modelCollection.id);
    collectionDefinitions.push(brandCollection, modelCollection);
  }

  const descriptionParts = [
    name,
    content?.article ? `OEM: ${content.article}.` : "",
    content?.condition ? `Состояние: ${content.condition}.` : "",
    content?.origin ? `Происхождение: ${content.origin}.` : "",
    compatibility.length ? `Совместимость: ${compatibility.map(compatibilityText).join("; ")}.` : "",
  ].filter(Boolean);

  return {
    offer: {
      id, available: false, url, price, currencyId: "RUB", categoryId, pictures, name,
      vendorCode: String(content?.article || "").trim(),
      description: String(override.description || descriptionParts.join(" ")).trim(),
      salesNotes: "Под заказ из Китая. Минимальная сумма заказа 50 000 ₽; детали можно объединить. Цена может быть уточнена менеджером.",
      labels, compatibility: compatibility.map(compatibilityText), collectionIds: [...collectionIds],
      sourceId: String(item.id),
    },
    collections: collectionDefinitions,
    warnings: unresolvedCompatibility.length ? [{
      source_id: String(item.id), product_id: id, type: "compatibility_without_catalog_route", values: unresolvedCompatibility,
    }] : [],
  };
}

export function validateFeedModel(model) {
  const errors = [];
  const offerIds = new Set();
  const categoryIds = new Set(model.categories.map((entry) => String(entry.id)));
  const collectionIds = new Set(model.collections.map((entry) => String(entry.id)));
  let siteOrigin = "";
  try { siteOrigin = new URL(model.siteUrl).origin; } catch { errors.push("Invalid site URL"); }
  for (const offer of model.offers) {
    if (offerIds.has(offer.id)) errors.push(`Duplicate offer id: ${offer.id}`);
    offerIds.add(offer.id);
    if (!offer.name) errors.push(`Missing name: ${offer.id}`);
    if (!validPublicUrl(offer.url, { siteOrigin, sameOrigin: true }) || /\s/.test(offer.url)) errors.push(`Invalid product URL: ${offer.id}`);
    if (!offer.pictures.length || offer.pictures.some((picture) => !validPublicUrl(picture) || /\s/.test(picture))) errors.push(`Invalid picture URL: ${offer.id}`);
    if (!categoryIds.has(String(offer.categoryId))) errors.push(`Unknown category: ${offer.id}`);
    if (!(Number(offer.price) > 0) || offer.currencyId !== "RUB") errors.push(`Invalid price/currency: ${offer.id}`);
    if (offer.available !== false) errors.push(`Availability must describe preorder, not local stock: ${offer.id}`);
    if (offer.collectionIds.some((id) => !collectionIds.has(String(id)))) errors.push(`Unknown collection: ${offer.id}`);
    if (offer.compatibility.length > 10) errors.push(`Too many compatibility properties: ${offer.id}`);
  }
  if (errors.length) throw new Error(`YML feed validation failed:\n${errors.join("\n")}`);
  return true;
}

function serializeOffer(offer) {
  const lines = [
    `      <offer id="${escapeXml(offer.id)}" available="false">`,
    `        <url>${escapeXml(offer.url)}</url>`,
    `        <price>${escapeXml(offer.price)}</price>`,
    `        <currencyId>${escapeXml(offer.currencyId)}</currencyId>`,
    `        <categoryId>${escapeXml(offer.categoryId)}</categoryId>`,
    ...offer.pictures.map((picture) => `        <picture>${escapeXml(picture)}</picture>`),
    `        <name>${escapeXml(offer.name)}</name>`,
    ...(offer.vendorCode ? [`        <vendorCode>${escapeXml(offer.vendorCode)}</vendorCode>`] : []),
    `        <description>${escapeXml(offer.description)}</description>`,
    `        <sales_notes>${escapeXml(offer.salesNotes)}</sales_notes>`,
    ...Object.entries(offer.labels).map(([name, value]) => `        <${name}>${escapeXml(value)}</${name}>`),
    ...offer.compatibility.map((value) => `        <param name="Совместимость">${escapeXml(value)}</param>`),
    ...offer.collectionIds.map((id) => `        <collectionId>${escapeXml(id)}</collectionId>`),
    "      </offer>",
  ];
  return lines.join("\n");
}

export function serializeYml(model, generatedAt = new Date()) {
  validateFeedModel(model);
  const categories = model.categories.map((category) => `      <category id="${escapeXml(category.id)}">${escapeXml(category.name)}</category>`).join("\n");
  const offers = model.offers.map(serializeOffer).join("\n");
  const collections = model.collections.map((collection) => [
    `      <collection id="${escapeXml(collection.id)}">`,
    `        <url>${escapeXml(collection.url)}</url>`,
    ...(collection.picture ? [`        <picture>${escapeXml(collection.picture)}</picture>`] : []),
    `        <name>${escapeXml(collection.name)}</name>`,
    "      </collection>",
  ].join("\n")).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>\n<yml_catalog date="${formatYmlDate(generatedAt)}">\n  <shop>\n    <name>${escapeXml(model.shopName)}</name>\n    <company>${escapeXml(model.company)}</company>\n    <url>${escapeXml(model.siteUrl)}</url>\n    <currencies>\n      <currency id="RUB" rate="1"/>\n    </currencies>\n    <categories>\n${categories}\n    </categories>\n    <offers>\n${offers}\n    </offers>\n    <collections>\n${collections}\n    </collections>\n  </shop>\n</yml_catalog>\n`;
}

export function assertWellFormedGeneratedXml(xml) {
  if (!/^<\?xml version="1\.0" encoding="utf-8"\?>\n<yml_catalog\b/.test(xml)) throw new Error("Missing XML declaration or YML root");
  if ((xml.match(/<yml_catalog\b/g) || []).length !== 1 || (xml.match(/<\/yml_catalog>/g) || []).length !== 1) throw new Error("YML must have one root element");
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-f]+;)/i.test(xml)) throw new Error("Unescaped XML entity");
  const stack = [];
  for (const match of xml.matchAll(/<([^>]+)>/g)) {
    const token = match[1].trim();
    if (!token || token.startsWith("?") || token.startsWith("!") || token.endsWith("/")) continue;
    if (token.startsWith("/")) {
      const name = token.slice(1).trim();
      const opened = stack.pop();
      if (opened !== name) throw new Error(`Mismatched XML tag: expected </${opened}>, got </${name}>`);
    } else {
      stack.push(token.split(/\s+/)[0]);
    }
  }
  if (stack.length) throw new Error(`Unclosed XML tag: ${stack.at(-1)}`);
  return true;
}

export function buildYmlFeed({ items, registry, config, seoState, offerOverrides = {}, generatedAt = new Date() }) {
  const sourceRows = Array.isArray(items) ? items : [];
  const sourceById = new Map();
  const duplicateSourceIds = new Set();
  for (const item of sourceRows) {
    const id = String(item?.id || "").trim();
    if (sourceById.has(id)) duplicateSourceIds.add(id);
    sourceById.set(id, item);
  }
  const brands = new Map(registry.entities.brands.map((entry) => [entry.id, entry]));
  const models = new Map(registry.entities.models.map((entry) => [entry.id, entry]));
  const categories = new Map(registry.entities.categories.map((entry) => [entry.id, entry]));
  const resolvers = entityResolvers(registry);
  const exclusions = [];
  const warnings = [];
  const offers = [];
  const collections = new Map();
  const coveredSourceIds = new Set();

  for (const product of registry.entities.products) {
    const item = sourceById.get(String(product.source_id));
    if (!item) continue;
    coveredSourceIds.add(String(product.source_id));
    const base = { source_id: String(item.id), product_id: String(product.product_id), title: String(item.title || product.name || "") };
    if (product.status !== "active") {
      exclusions.push({ ...base, reasons: [`not_publishable_status:${product.status}`] });
      continue;
    }
    const state = seoState?.productState?.get(product.product_id);
    if (state?.canonicalPath && state.canonicalPath !== product.canonical_path) {
      exclusions.push({ ...base, reasons: ["noncanonical_duplicate"] });
      continue;
    }
    const result = offerCandidate({
      product, item,
      brand: brands.get(product.brand_id), model: models.get(product.model_id), category: categories.get(product.category_id),
      content: state?.content || {}, config, resolvers,
      override: offerOverrides[String(product.product_id)] || {},
    });
    if (result.reasons) {
      exclusions.push({ ...base, reasons: result.reasons });
      continue;
    }
    offers.push(result.offer);
    result.collections.forEach((collection) => {
      if (!collections.has(collection.id)) collections.set(collection.id, collection);
    });
    warnings.push(...result.warnings);
  }

  for (const item of sourceRows) {
    const id = String(item?.id || "").trim();
    if (!coveredSourceIds.has(id)) exclusions.push({ source_id: id, product_id: null, title: String(item?.title || ""), reasons: ["missing_registry_product"] });
  }

  const usedCategoryIds = new Set(offers.map((offer) => String(offer.categoryId)));
  const feedCategories = [...categories.values()]
    .map((category) => ({ id: entityNumericId(category.id), name: category.name }))
    .filter((category) => usedCategoryIds.has(String(category.id)))
    .sort((a, b) => Number(a.id) - Number(b.id));
  const feedCollections = [...collections.values()].sort((a, b) => a.id.localeCompare(b.id, "ru"));
  offers.sort((a, b) => Number(a.id) - Number(b.id));

  const model = {
    siteUrl: String(config.siteUrl || "").replace(/\/$/, ""),
    shopName: String(config.organization?.name || "KITRADE"),
    company: String(config.organization?.legalName || config.organization?.name || "KITRADE"),
    categories: feedCategories, offers, collections: feedCollections,
  };
  validateFeedModel(model);
  const xml = serializeYml(model, generatedAt);
  assertWellFormedGeneratedXml(xml);
  const reasonCounts = {};
  for (const exclusion of exclusions) for (const reason of exclusion.reasons) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  const publishableUniqueProducts = registry.entities.products.filter((product) => product.status === "active" && sourceById.has(String(product.source_id))).length;
  const report = {
    generated_at: new Date(generatedAt).toISOString(),
    feed_file: `public/${YML_FEED_FILENAME}`,
    proposed_public_url: absoluteUrl(config.siteUrl, YML_FEED_PUBLIC_PATH),
    status: "created_locally_not_published_not_imported",
    counts: {
      source_records: sourceRows.length,
      unique_source_records: sourceById.size,
      duplicate_source_id_groups: duplicateSourceIds.size,
      registry_products: registry.entities.products.length,
      unique_publishable_products: publishableUniqueProducts,
      exported_offers: offers.length,
      excluded_source_records: exclusions.length,
      excluded_publishable_products: exclusions.filter((entry) => !entry.reasons.some((reason) => reason.startsWith("not_publishable_status:"))).length,
      categories: feedCategories.length,
      collections: feedCollections.length,
      warnings: warnings.length,
    },
    exclusion_reason_counts: reasonCounts,
    duplicate_source_ids: [...duplicateSourceIds].sort(),
    exclusions,
    warnings,
    feed_policy: {
      offer_id: "Stable numeric product_id from catalog-url-map.json",
      availability: "available=false: catalog items are supplied from China by order and are not represented as local stock",
      price: "Current non-zero source price is exported in RUB; the sales note states that the manager may clarify it",
      vendor: "Omitted because the compatible vehicle brand is not evidence of the part manufacturer",
      filters: {
        custom_label_0: "Condition",
        custom_label_1: "Part category",
        custom_label_2: "All confirmed compatible vehicle brands",
        custom_label_3: "All confirmed compatible brand/model pairs",
        custom_label_4: "Supply mode: by order from China",
        categoryId: "Stable part-category ID",
        collectionId: "Stable brand/model catalog IDs; an offer may reference multiple collections",
      },
    },
  };
  return { model, xml, report };
}

export function writeYmlFeedArtifacts({ projectDir, items, registry, config, seoState, offerOverrides = {}, generatedAt = new Date() }) {
  const result = buildYmlFeed({ items, registry, config, seoState, offerOverrides, generatedAt });
  const publicDir = path.join(projectDir, "public");
  const reportDir = path.join(projectDir, "reports", "feed");
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, YML_FEED_FILENAME), result.xml, "utf8");
  fs.writeFileSync(path.join(reportDir, "yandex-direct-feed-report.json"), `${JSON.stringify(result.report, null, 2)}\n`, "utf8");
  return result;
}
