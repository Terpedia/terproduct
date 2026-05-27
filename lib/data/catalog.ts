import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { IngredientDetail, IngredientRow, ProductRow } from "@/lib/data/types";
import { hasDatabaseUrl, query } from "@/lib/data/postgres";

function getAnonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function hasCatalog(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function listProducts(limit = 200): Promise<ProductRow[]> {
  if (hasDatabaseUrl()) {
    const rows = await query<ProductRow>(
      `
        select id::text, slug, name, brand, description, gtin, updated_at::text
        from products
        order by name asc
        limit $1
      `,
      [limit],
    );
    return rows;
  }
  const supabase = getAnonClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, brand, description, gtin, updated_at")
    .order("name", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    ...r,
    updated_at:
      typeof r.updated_at === "string" ? r.updated_at : String((r as { updated_at: unknown }).updated_at),
  }));
}

/**
 * For `app/[type]/[id]/` static export. With `output: "export"`, an empty
 * `generateStaticParams` result is rejected (message says “missing
 * generateStaticParams”, which is misleading). When there is nothing to
 * prerender, we emit this slug so the build can finish; the page 404s for it.
 */
export const CATALOG_PLACEHOLDER_PRODUCT_SLUG = "terproduct--static-export--no-catalog-data";

/** For `app/[type]/[id]/` static export: one generateStaticParams for both /product/… and /ingredient/…. */
export async function allTypeIdForStaticBuild(): Promise<{ type: string; id: string }[]> {
  if (hasDatabaseUrl()) {
    const [prows, irows] = await Promise.all([
      query<{ slug: string }>("select slug from products order by slug asc"),
      query<{ id: string }>("select id::text as id from ingredients order by name asc"),
    ]);
    const out = [
      ...prows.map((r) => ({ type: "product" as const, id: r.slug })),
      ...irows.map((r) => ({ type: "ingredient" as const, id: r.id })),
    ];
    if (out.length > 0) return out;
    return [{ type: "product", id: CATALOG_PLACEHOLDER_PRODUCT_SLUG }];
  }
  const supabase = getAnonClient();
  if (!supabase) {
    return [{ type: "product", id: CATALOG_PLACEHOLDER_PRODUCT_SLUG }];
  }
  const [pr, ir] = await Promise.all([
    supabase.from("products").select("slug"),
    supabase.from("ingredients").select("id"),
  ]);
  const prows = pr.data && !pr.error ? pr.data : [];
  const irows = ir.data && !ir.error ? ir.data : [];
  const out = [
    ...prows.map((r) => ({ type: "product" as const, id: r.slug as string })),
    ...irows.map((r) => ({ type: "ingredient" as const, id: r.id as string })),
  ] as { type: string; id: string }[];
  if (out.length > 0) return out;
  return [{ type: "product", id: CATALOG_PLACEHOLDER_PRODUCT_SLUG }];
}

export async function getProductBySlug(slug: string): Promise<ProductRow | null> {
  if (hasDatabaseUrl()) {
    const rows = await query<ProductRow>(
      `
        select id::text, slug, name, brand, description, gtin, updated_at::text
        from products
        where slug = $1
        limit 1
      `,
      [slug],
    );
    return rows[0] ?? null;
  }
  const supabase = getAnonClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, brand, description, gtin, updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    brand: data.brand,
    description: data.description,
    gtin: data.gtin,
    updated_at:
      typeof data.updated_at === "string" ? data.updated_at : String(data.updated_at),
  };
}

export async function getIngredientsForProduct(productId: string): Promise<IngredientRow[]> {
  if (hasDatabaseUrl()) {
    return query<IngredientRow>(
      `
        select
          i.id::text,
          i.name,
          i.description,
          i.terpedia_analysis_url,
          pi.sort_order,
          pi.as_listed,
          pi.notes
        from product_ingredients pi
        join ingredients i on i.id = pi.ingredient_id
        where pi.product_id = $1::uuid
        order by pi.sort_order asc, i.name asc
      `,
      [productId],
    );
  }
  const supabase = getAnonClient();
  if (!supabase) return [];
  const { data: lines, error: e1 } = await supabase
    .from("product_ingredients")
    .select("ingredient_id, sort_order, as_listed, notes")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  if (e1 || !lines?.length) return [];
  const ids = lines.map((l) => l.ingredient_id as string);
  const { data: ings, error: e2 } = await supabase
    .from("ingredients")
    .select("id, name, description, terpedia_analysis_url")
    .in("id", ids);
  if (e2 || !ings) return [];
  const byId = new Map(ings.map((i) => [i.id, i] as const));
  return lines.map((line) => {
    const ing = byId.get(line.ingredient_id as string);
    if (!ing) {
      return {
        id: line.ingredient_id as string,
        name: "?",
        description: null,
        terpedia_analysis_url: null,
        sort_order: (line.sort_order as number) ?? 0,
        as_listed: (line as { as_listed: string | null }).as_listed,
        notes: (line as { notes: string | null }).notes,
      };
    }
    return {
      id: ing.id,
      name: ing.name,
      description: ing.description,
      terpedia_analysis_url: (ing.terpedia_analysis_url as string | null) ?? null,
      sort_order: (line.sort_order as number) ?? 0,
      as_listed: (line as { as_listed: string | null }).as_listed,
      notes: (line as { notes: string | null }).notes,
    };
  });
}

export async function getIngredientById(id: string): Promise<IngredientDetail | null> {
  if (hasDatabaseUrl()) {
    const rows = await query<IngredientDetail>(
      `
        select
          i.id::text,
          i.name,
          i.description,
          i.terpedia_analysis_url,
          count(pi.id)::int as "productCount"
        from ingredients i
        left join product_ingredients pi on pi.ingredient_id = i.id
        where i.id = $1::uuid
        group by i.id
        limit 1
      `,
      [id],
    );
    return rows[0] ?? null;
  }
  const supabase = getAnonClient();
  if (!supabase) return null;
  const { data: row, error } = await supabase
    .from("ingredients")
    .select("id, name, description, terpedia_analysis_url")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return null;
  const { count } = await supabase
    .from("product_ingredients")
    .select("id", { count: "exact", head: true })
    .eq("ingredient_id", id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    terpedia_analysis_url: row.terpedia_analysis_url,
    productCount: count ?? 0,
  };
}

export async function getProductsForIngredient(ingredientId: string): Promise<ProductRow[]> {
  if (hasDatabaseUrl()) {
    return query<ProductRow>(
      `
        select p.id::text, p.slug, p.name, p.brand, p.description, p.gtin, p.updated_at::text
        from product_ingredients pi
        join products p on p.id = pi.product_id
        where pi.ingredient_id = $1::uuid
        order by p.name asc
      `,
      [ingredientId],
    );
  }
  const supabase = getAnonClient();
  if (!supabase) return [];
  const { data: links, error: e1 } = await supabase
    .from("product_ingredients")
    .select("product_id")
    .eq("ingredient_id", ingredientId);
  if (e1 || !links?.length) return [];
  const ids = links.map((l) => l.product_id as string);
  const { data, error: e2 } = await supabase
    .from("products")
    .select("id, slug, name, brand, description, gtin, updated_at")
    .in("id", ids)
    .order("name", { ascending: true });
  if (e2 || !data) return [];
  return data.map((r) => ({
    ...r,
    updated_at:
      typeof r.updated_at === "string" ? r.updated_at : String((r as { updated_at: unknown }).updated_at),
  }));
}
