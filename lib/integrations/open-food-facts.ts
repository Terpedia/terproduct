/** Open Food Facts and Open Beauty Facts (same v2 read API, different product hosts). */
const OPEN_FOOD_FACTS_BASE = "https://world.openfoodfacts.org";
const OPEN_BEAUTY_FACTS_BASE = "https://world.openbeautyfacts.org";

const OPEN_FACTS_FIELDS = [
  "code",
  "product_name",
  "generic_name",
  "brands",
  "ingredients_text",
  "ingredients",
  "ingredients_n",
  "link",
  "image_url",
  "image_front_url",
  "image_front_small_url",
  "image_ingredients_url",
  "image_nutrition_url",
  "nutriments",
  "serving_size",
  "serving_quantity",
  "categories",
  "labels",
  "categories_tags",
  "labels_tags",
] as const;

const FIELDS = OPEN_FACTS_FIELDS.join(",");

export type OffIngredient = { id?: string; text?: string; percent?: number };

/** Shared product document across Open*Facts; images + nutriments for panels / supplement-style data. */
export type OpenFoodFactsProduct = {
  code?: string;
  product_name?: string;
  generic_name?: string;
  brands?: string;
  ingredients_text?: string;
  ingredients?: OffIngredient[];
  link?: string;
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  image_ingredients_url?: string;
  image_nutrition_url?: string;
  /** Structured nutrients (may include vitamin/mineral %DV-style keys when present). */
  nutriments?: Record<string, unknown>;
  serving_size?: string;
  serving_quantity?: string;
  categories?: string;
  labels?: string;
  categories_tags?: string[];
  labels_tags?: string[];
};

export type OpenFoodFactsResponse = {
  code?: string;
  status: number;
  status_verbose?: string;
  product?: OpenFoodFactsProduct;
};

export type OpenFactsSource = "openfoodfacts" | "openbeautyfacts";

export type OpenFactsLookup = OpenFoodFactsResponse & {
  source: OpenFactsSource | null;
  httpError?: boolean;
};

const USER_AGENT = "Terproduct/0.1 (https://github.com/terpedia/terproduct; contact: terpedia)";

type RequestOutcome = { data: OpenFoodFactsResponse; httpOk: boolean };

async function openFactsGet(base: string, code: string, init?: RequestInit): Promise<RequestOutcome> {
  const url = `${base}/api/v2/product/${encodeURIComponent(code)}?fields=${FIELDS}`;
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "User-Agent": USER_AGENT, ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    return { data: { status: 0, status_verbose: `HTTP ${res.status}` }, httpOk: false };
  }
  return { data: (await res.json()) as OpenFoodFactsResponse, httpOk: true };
}

/**
 * Open Food Facts read API (v2) only. Respects the project’s read limit; call sparingly.
 * @see https://openfoodfacts.github.io/openfoodfacts-server/api/
 */
export async function fetchOpenFoodFactsProduct(
  code: string,
  init?: RequestInit,
): Promise<OpenFoodFactsResponse> {
  const { data } = await openFactsGet(OPEN_FOOD_FACTS_BASE, code, init);
  return data;
}

/**
 * Open Beauty Facts read API (v2) — same schema as Open Food Facts; separate beauty/personal care catalog.
 * @see https://world.openbeautyfacts.org
 */
export async function fetchOpenBeautyFactsProduct(
  code: string,
  init?: RequestInit,
): Promise<OpenFoodFactsResponse> {
  const { data } = await openFactsGet(OPEN_BEAUTY_FACTS_BASE, code, init);
  return data;
}

/**
 * Try Open Food Facts first, then Open Beauty Facts (same GTIN; usually only one will match).
 * Optional `source` is set on success. `httpError` is true only if **both** HTTP fetches failed.
 */
export async function fetchOpenFactsProduct(
  code: string,
  init?: RequestInit,
): Promise<OpenFactsLookup> {
  const a = await openFactsGet(OPEN_FOOD_FACTS_BASE, code, init);
  if (a.httpOk && a.data.status === 1 && a.data.product) {
    return { ...a.data, source: "openfoodfacts" };
  }
  const b = await openFactsGet(OPEN_BEAUTY_FACTS_BASE, code, init);
  if (b.httpOk && b.data.status === 1 && b.data.product) {
    return { ...b.data, source: "openbeautyfacts" };
  }
  const httpError = !a.httpOk && !b.httpOk;
  const notFound = "Not in Open Food Facts or Open Beauty Facts (or offline).";
  const details =
    httpError && a.data.status_verbose && b.data.status_verbose
      ? `Open Food Facts: ${a.data.status_verbose} · Open Beauty Facts: ${b.data.status_verbose}`
      : httpError
        ? a.data.status_verbose || b.data.status_verbose || "Network error"
        : notFound;
  return {
    status: 0,
    status_verbose: details,
    product: undefined,
    source: null,
    httpError,
  };
}

/** User-facing name for a successful lookup source. */
export function openFactsSourceLabel(s: OpenFactsSource): string {
  return s === "openbeautyfacts" ? "Open Beauty Facts" : "Open Food Facts";
}

/**
 * Best displayed product photo (same hosts as the API, suitable for <img src> in the browser / WebView).
 */
export function offImageUrl(product: OpenFoodFactsProduct | undefined): string | null {
  if (!product) {
    return null;
  }
  return (
    product.image_front_url?.trim() ||
    product.image_url?.trim() ||
    product.image_front_small_url?.trim() ||
    null
  );
}

/**
 * Formatted lines from `nutriments` (Supplement / Nutrition / serving sizes when present).
 * Open*Facts is contributor-driven; not every product has a full panel.
 */
export function offNutrimentDisplayLines(
  product: OpenFoodFactsProduct | undefined,
  max = 36,
): string[] {
  if (!max) {
    return [];
  }
  const n = product?.nutriments;
  if (!n || typeof n !== "object") {
    return [];
  }
  const out: string[] = [];
  if (product.serving_size) {
    out.push(`Serving size: ${product.serving_size.replace(/\s+/g, " ")}`.trim());
  } else if (product.serving_quantity) {
    out.push(`Serving quantity: ${String(product.serving_quantity).trim()}`);
  }
  const o = n as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    const m = /^(.*)_(100g|serving)$/.exec(key);
    if (!m) {
      continue;
    }
    const val = o[key];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      continue;
    }
    const base = m[1]!;
    const per = m[2]! === "100g" ? "per 100g" : "per serving";
    const u = o[`${base}_unit`];
    const ustr = typeof u === "string" && u.trim() ? u.trim() : "";
    out.push(
      `${base.replace(/[-_]+/g, " ").replace(/\s+/g, " ")} (${per}): ${val}${ustr ? ` ${ustr}` : ""}`.trim(),
    );
  }
  out.sort((a, b) => a.localeCompare(b));
  const first = out.filter((l) => l.startsWith("Serving"));
  const rest = out.filter((l) => !l.startsWith("Serving"));
  const merged = [...first, ...rest].slice(0, max);
  return merged;
}

/**
 * Whether categories/labels look like supplement / OTC or medicine-adjacent (heuristic; not legal labeling).
 */
export function offSuggestsSupplementOrDrugLabel(product: OpenFoodFactsProduct | undefined): boolean {
  if (!product) {
    return false;
  }
  const fromTags = (tags: string[] | undefined) =>
    tags?.some(
      (t) =>
        /en:supplement|dietary.supplement|en:vitam|en:otc|en:pharm|en:medici|en:drug|over-the-counters|dietary-supplement/i.test(
          t,
        ) || t.includes("supplement"),
    );
  const fromText = (s: string) =>
    /supplement|vitamin|otc|drug facts|drug|active ingredient|dietary supplement/i.test(s);
  if (fromTags(product.categories_tags) || fromTags(product.labels_tags)) {
    return true;
  }
  const c = product.categories;
  if (c && fromText(c)) {
    return true;
  }
  if (product.labels && fromText(product.labels)) {
    return true;
  }
  if (product.generic_name && fromText(product.generic_name)) {
    return true;
  }
  return false;
}

export function offCategoriesLabelsHint(product: OpenFoodFactsProduct | undefined): string | null {
  if (!product) {
    return null;
  }
  const c = product.categories?.trim() || (product.categories_tags?.[0] ? String(product.categories_tags[0]) : null);
  const l = product.labels?.trim() || (product.labels_tags?.[0] ? String(product.labels_tags[0]) : null);
  if (!c && !l) {
    return null;
  }
  return [c, l].filter(Boolean).join(" · ");
}

export function offIngredientLines(product: OpenFoodFactsProduct | undefined): string[] {
  if (!product) {
    return [];
  }
  const arr = product.ingredients;
  if (Array.isArray(arr) && arr.length > 0) {
    const out: string[] = [];
    for (const row of arr) {
      const t = row.text?.trim();
      if (t) {
        out.push(t);
      }
    }
    if (out.length) {
      return out;
    }
  }
  const text = product.ingredients_text?.trim();
  if (!text) {
    return [];
  }
  return text
    .split(/,(?![^(]*\))/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function offProductName(product: OpenFoodFactsProduct | undefined): string {
  if (!product) {
    return "Unknown product";
  }
  return (product.product_name || product.generic_name || "Unknown product").trim() || "Unknown product";
}

export function offBrand(product: OpenFoodFactsProduct | undefined): string | null {
  const b = product?.brands?.split(",")?.[0]?.trim();
  return b || null;
}

export function offDescription(product: OpenFoodFactsProduct | undefined): string | null {
  if (!product) {
    return null;
  }
  const g = product.generic_name?.trim();
  if (g) {
    return g;
  }
  const t = product.ingredients_text?.trim();
  if (t) {
    return t.length > 500 ? `${t.slice(0, 497)}…` : t;
  }
  return null;
}
