/** Aligned with `lib/integrations/open-food-facts.ts` */
const OFF_BASE = "https://world.openfoodfacts.org";
const FIELDS = [
  "code",
  "product_name",
  "generic_name",
  "brands",
  "ingredients_text",
  "ingredients",
  "ingredients_n",
  "link",
].join(",");

export type OffIngredient = { id?: string; text?: string; percent?: number };
export type OpenFoodFactsProduct = {
  product_name?: string;
  generic_name?: string;
  brands?: string;
  ingredients_text?: string;
  ingredients?: OffIngredient[];
  link?: string;
};
export type OpenFoodFactsResponse = { status: number; status_verbose?: string; product?: OpenFoodFactsProduct };

const USER_AGENT = "Terproduct/0.1 (https://github.com/terpedia/terproduct)";

export async function fetchOpenFoodFactsProduct(
  code: string,
  init?: RequestInit,
): Promise<OpenFoodFactsResponse> {
  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}?fields=${FIELDS}`;
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "User-Agent": USER_AGENT, ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    return { status: 0, status_verbose: `HTTP ${res.status}` };
  }
  return (await res.json()) as OpenFoodFactsResponse;
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
