/**
 * Ingest: GS1-check GTIN, Open Food Facts name/ingredients, upsert into
 * `products`, `ingredients`, `product_ingredients`, `product_label_ingredient_lines`.
 *
 * Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (auto in hosted Supabase).
 * Optional: TERPRODUCT_INGEST_KEY — if set, require header `x-terproduct-ingest-key: <value>`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { assertValidGtinScannedOrTyped } from "../_shared/gs1-gtin";
import {
  fetchOpenFoodFactsProduct,
  offBrand,
  offDescription,
  offIngredientLines,
  offProductName,
} from "../_shared/open-food-facts";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-terproduct-ingest-key, x-terproduct-source",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: object, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function makeSlug(brand: string | null, name: string, gtin: string): string {
  const base = [brand, name].filter(Boolean).join(" ");
  const s = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "product";
  return `${s}-${gtin.replace(/\D/g, "").slice(-4)}`.slice(0, 96);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...cors } });
  }
  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, 405);
  }

  const ingestKey = Deno.env.get("TERPRODUCT_INGEST_KEY");
  if (ingestKey) {
    const h = req.headers.get("x-terproduct-ingest-key");
    if (h !== ingestKey) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }
  }

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) {
    return jsonRes({ error: "Server is missing Supabase credentials" }, 500);
  }
  const supabase = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: { gtin?: string };
  try {
    body = (await req.json()) as { gtin?: string };
  } catch {
    return jsonRes({ error: "Invalid JSON" }, 400);
  }
  const raw = typeof body.gtin === "string" ? body.gtin : "";
  const { gtin, valid } = assertValidGtinScannedOrTyped(raw);
  if (!gtin) {
    return jsonRes({ error: "Not a product GTIN (8, 12, 13, or 14 digits)" }, 400);
  }
  if (!valid) {
    return jsonRes(
      { error: "GS1 check digit is invalid for this number", code: "GS1_CHECK", gtin },
      400,
    );
  }

  const off = await fetchOpenFoodFactsProduct(gtin);
  if (off.status === 0) {
    return jsonRes({ error: "Open Food Facts request failed", details: off.status_verbose }, 502);
  }
  if (off.status !== 1 || !off.product) {
    return jsonRes(
      { error: "Product not in Open Food Facts (or not found)", offStatus: off.status, gtin },
      404,
    );
  }

  const p = off.product;
  const name = offProductName(p);
  const brand = offBrand(p);
  const description = offDescription(p);
  const lines = offIngredientLines(p);

  let slug = makeSlug(brand, name, gtin);

  const { data: existing, error: findErr } = await supabase
    .from("products")
    .select("id,slug")
    .eq("gtin", gtin)
    .maybeSingle();
  if (findErr) {
    return jsonRes({ error: findErr.message, code: findErr.code }, 500);
  }

  let productId: string;
  if (existing?.id) {
    productId = existing.id;
    await supabase
      .from("products")
      .update({
        name,
        brand: brand,
        description: description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);
  } else {
    const { data: slugCollision } = await supabase
      .from("products")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (slugCollision?.id) {
      slug = `retail-${gtin}`.length > 96 ? `g-${gtin}`.slice(0, 96) : `retail-${gtin}`;
    }
    const { data: inserted, error: insErr } = await supabase
      .from("products")
      .insert({ slug, name, brand, description, gtin })
      .select("id")
      .single();
    if (insErr && !inserted) {
      const retrySlug = `g-${gtin}`.length > 96 ? `g-${gtin}`.slice(0, 96) : `g-${gtin}`;
      const { data: r2, error: e2 } = await supabase
        .from("products")
        .insert({ slug: retrySlug, name, brand, description, gtin })
        .select("id")
        .single();
      if (e2 || !r2) {
        return jsonRes({ error: e2?.message || insErr.message }, 500);
      }
      productId = r2.id;
    } else {
      if (!inserted) {
        return jsonRes({ error: insErr?.message || "insert failed" }, 500);
      }
      productId = inserted.id;
    }
  }

  await supabase.from("product_ingredients").delete().eq("product_id", productId);
  await supabase.from("product_label_ingredient_lines").delete().eq("product_id", productId);

  const usedIngredient = new Set<string>();
  let sort = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;
    const { data: found } = await supabase.from("ingredients").select("id").eq("name", rawLine).maybeSingle();
    let ingId: string;
    if (found?.id) {
      ingId = found.id;
    } else {
      const { data: created, error: ce } = await supabase
        .from("ingredients")
        .insert({ name: rawLine })
        .select("id")
        .single();
      if (ce) {
        const { data: retry } = await supabase.from("ingredients").select("id").eq("name", rawLine).maybeSingle();
        if (retry?.id) ingId = retry.id;
        else continue;
      } else {
        if (!created?.id) continue;
        ingId = created.id;
      }
    }

    if (!usedIngredient.has(ingId)) {
      usedIngredient.add(ingId);
      sort += 1;
      await supabase.from("product_ingredients").insert({
        product_id: productId,
        ingredient_id: ingId,
        sort_order: sort,
        as_listed: rawLine,
        notes: "Open Food Facts",
      });
    }

    await supabase.from("product_label_ingredient_lines").insert({
      product_id: productId,
      line_index: i,
      raw_text: rawLine,
      resolved_ingredient_id: ingId,
      notes: "Open Food Facts",
    });
  }

  const { data: pRow } = await supabase.from("products").select("slug,gtin").eq("id", productId).single();

  return jsonRes({
    ok: true,
    productId,
    slug: pRow?.slug,
    gtin: pRow?.gtin,
    source: { gs1Gtin: gtin, gs1CheckDigit: "ok", openFoodFacts: "merged" },
    ingredientsCount: lines.length,
  });
});
