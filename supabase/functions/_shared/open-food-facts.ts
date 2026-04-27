/** Aligned with `lib/integrations/open-food-facts.ts` */
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

const USER_AGENT = "Terproduct/0.1 (https://github.com/terpedia/terproduct)";

type RequestOutcome = { data: OpenFoodFactsResponse; httpOk: boolean };

async function openFactsGet(
  base: string,
  code: string,
  init?: RequestInit,
): Promise<RequestOutcome> {
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

export async function fetchOpenFoodFactsProduct(
  code: string,
  init?: RequestInit,
): Promise<OpenFoodFactsResponse> {
  const { data } = await openFactsGet(OPEN_FOOD_FACTS_BASE, code, init);
  return data;
}

export async function fetchOpenBeautyFactsProduct(
  code: string,
  init?: RequestInit,
): Promise<OpenFoodFactsResponse> {
  const { data } = await openFactsGet(OPEN_BEAUTY_FACTS_BASE, code, init);
  return data;
}

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
  return { status: 0, status_verbose: details, product: undefined, source: null, httpError };
}

export function openFactsSourceIngestKey(s: OpenFactsSource): string {
  return s === "openbeautyfacts" ? "openBeautyFacts" : "openFoodFacts";
}

export function openFactsSourceNotes(s: OpenFactsSource): string {
  return s === "openbeautyfacts" ? "Open Beauty Facts" : "Open Food Facts";
}

export function offIngredientLines(product: OpenFoodFactsProduct | undefined): string[] {
  if (!product) return [];
  if (Array.isArray(product.ingredients) && product.ingredients.length) {
    const out: string[] = [];
    for (const row of product.ingredients) {
      const t = row.text?.trim();
      if (t) out.push(t);
    }
    if (out.length) return out;
  }
  const text = product.ingredients_text?.trim();
  if (!text) return [];
  return text
    .split(/,(?![^(]*\))/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function offProductName(product: OpenFoodFactsProduct | undefined): string {
  if (!product) return "Unknown product";
  return (product.product_name || product.generic_name || "Unknown product").trim() || "Unknown product";
}

export function offBrand(product: OpenFoodFactsProduct | undefined): string | null {
  const b = product?.brands?.split(",")?.[0]?.trim();
  return b || null;
}

export function offDescription(product: OpenFoodFactsProduct | undefined): string | null {
  if (!product) return null;
  const g = product.generic_name?.trim();
  if (g) return g;
  const t = product.ingredients_text?.trim();
  if (t) return t.length > 500 ? `${t.slice(0, 497)}…` : t;
  return null;
}
