import { getPool } from "@/lib/data/postgres";
import { assertValidGtinScannedOrTyped } from "@/lib/integrations/gs1-gtin";
import {
  fetchOpenFactsProduct,
  offBrand,
  offDescription,
  offIngredientLines,
  offProductName,
  type OpenFactsSource,
} from "@/lib/integrations/open-food-facts";

export type CatalogIngestResult =
  | {
      ok: true;
      productId: string;
      slug: string;
      gtin: string;
      ingredientsCount: number;
      source: {
        gs1Gtin: string;
        gs1CheckDigit: "ok";
        openFoodFacts?: "merged";
        openBeautyFacts?: "merged";
      };
    }
  | { ok: false; status: number; error: string; code?: string; gtin?: string };

function makeSlug(brand: string | null, name: string, gtin: string): string {
  const base = [brand, name].filter(Boolean).join(" ");
  const s =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "product";
  return `${s}-${gtin.replace(/\D/g, "").slice(-4)}`.slice(0, 96);
}

function sourceKey(source: OpenFactsSource): "openFoodFacts" | "openBeautyFacts" {
  return source === "openbeautyfacts" ? "openBeautyFacts" : "openFoodFacts";
}

function sourceNotes(source: OpenFactsSource): string {
  return source === "openbeautyfacts"
    ? "Imported from Open Beauty Facts during barcode ingest."
    : "Imported from Open Food Facts during barcode ingest.";
}

export async function ingestBarcodeToPostgres(raw: string): Promise<CatalogIngestResult> {
  const { gtin, valid } = assertValidGtinScannedOrTyped(raw);
  if (!gtin) {
    return { ok: false, status: 400, error: "Not a product GTIN (8, 12, 13, or 14 digits)" };
  }
  if (!valid) {
    return {
      ok: false,
      status: 400,
      error: "GS1 check digit is invalid for this number",
      code: "GS1_CHECK",
      gtin,
    };
  }

  const off = await fetchOpenFactsProduct(gtin);
  if (off.httpError) {
    return {
      ok: false,
      status: 502,
      error: `Open Food Facts / Open Beauty Facts request failed: ${off.status_verbose || "network error"}`,
    };
  }
  if (off.status !== 1 || !off.product || !off.source) {
    return {
      ok: false,
      status: 404,
      error: "Product not in Open Food Facts or Open Beauty Facts (or not found)",
      gtin,
    };
  }

  const product = off.product;
  const name = offProductName(product);
  const brand = offBrand(product);
  const description = offDescription(product);
  const lines = offIngredientLines(product);
  const notes = sourceNotes(off.source);
  let slug = makeSlug(brand, name, gtin);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");

    const existing = await client.query<{ id: string; slug: string }>(
      "select id::text, slug from products where gtin = $1 limit 1",
      [gtin],
    );

    let productId: string;
    if (existing.rows[0]) {
      productId = existing.rows[0].id;
      slug = existing.rows[0].slug;
      await client.query(
        `
          update products
          set name = $1, brand = $2, description = $3, updated_at = now()
          where id = $4::uuid
        `,
        [name, brand, description, productId],
      );
    } else {
      const collision = await client.query("select id from products where slug = $1 limit 1", [slug]);
      if (collision.rowCount) {
        slug = `retail-${gtin}`.slice(0, 96);
      }
      const fallbackCollision = await client.query("select id from products where slug = $1 limit 1", [slug]);
      if (fallbackCollision.rowCount) {
        slug = `g-${gtin}`.slice(0, 96);
      }
      const inserted = await client.query<{ id: string; slug: string }>(
        `
          insert into products (slug, name, brand, description, gtin)
          values ($1, $2, $3, $4, $5)
          returning id::text, slug
        `,
        [slug, name, brand, description, gtin],
      );
      productId = inserted.rows[0]!.id;
      slug = inserted.rows[0]!.slug;
    }

    await client.query("delete from product_ingredients where product_id = $1::uuid", [productId]);
    await client.query("delete from product_label_ingredient_lines where product_id = $1::uuid", [productId]);

    const usedIngredientIds = new Set<string>();
    let sortOrder = 0;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i]!;
      const found = await client.query<{ id: string }>(
        "select id::text from ingredients where name = $1 limit 1",
        [rawLine],
      );
      let ingredientId = found.rows[0]?.id;
      if (!ingredientId) {
        const ingredient = await client.query<{ id: string }>(
          "insert into ingredients (name) values ($1) returning id::text",
          [rawLine],
        );
        ingredientId = ingredient.rows[0]?.id;
      }
      if (!ingredientId) continue;

      if (!usedIngredientIds.has(ingredientId)) {
        usedIngredientIds.add(ingredientId);
        sortOrder += 1;
        await client.query(
          `
            insert into product_ingredients (product_id, ingredient_id, sort_order, as_listed, notes)
            values ($1::uuid, $2::uuid, $3, $4, $5)
            on conflict (product_id, ingredient_id) do update
              set sort_order = excluded.sort_order,
                  as_listed = excluded.as_listed,
                  notes = excluded.notes
          `,
          [productId, ingredientId, sortOrder, rawLine, notes],
        );
      }

      await client.query(
        `
          insert into product_label_ingredient_lines
            (product_id, line_index, raw_text, resolved_ingredient_id, notes)
          values ($1::uuid, $2, $3, $4::uuid, $5)
          on conflict (product_id, line_index) do update
            set raw_text = excluded.raw_text,
                resolved_ingredient_id = excluded.resolved_ingredient_id,
                notes = excluded.notes
        `,
        [productId, i, rawLine, ingredientId, notes],
      );
    }

    await client.query("commit");

    return {
      ok: true,
      productId,
      slug,
      gtin,
      ingredientsCount: lines.length,
      source: {
        gs1Gtin: gtin,
        gs1CheckDigit: "ok",
        [sourceKey(off.source)]: "merged",
      },
    };
  } catch (e) {
    await client.query("rollback");
    const message = e instanceof Error ? e.message : "Catalog ingest failed";
    return { ok: false, status: 500, error: message };
  } finally {
    client.release();
  }
}
