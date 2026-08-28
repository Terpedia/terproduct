#!/usr/bin/env node

/**
 * Acquire the current Celestial Seasonings tea catalog and persist its
 * packaging/label image provenance in Terproduct. Safe to rerun.
 */
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { readFile } from "node:fs/promises";

const { Pool } = pg;

const CATALOG_URL = "https://celestialseasonings.com/collections/all-products/products.json?limit=250";
const BRAND = "Celestial Seasonings";

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110) || "product";
}

function htmlText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&reg;/g, "®")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTea(product) {
  const text = `${product.title || ""} ${product.product_type || ""} ${(product.tags || []).join(" ")}`.toLowerCase();
  const excluded = /mug|wafer|cookie|bundle|gift box|gift set|variety pack|sampler|build your|take a break/.test(text);
  return !excluded && /tea|chai|matcha|zinger|sleepytime|roastaroma|peppermint|chamomile|bengal|gingerbread|mint magic|cinnamon apple|mandarin orange|country peach|cranberry vanilla|lemon honey|raspberry|fireside|detox|prebiotic|shewell|teawell|throat soother|stomach soother|vitamin c|immunity|biotin|probiotic|sinus|laxative|turmeric|honey vanilla|black cherry|cold brew/.test(text);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!databaseUrl && (!supabaseUrl || !serviceKey)) throw new Error("Set DATABASE_URL or SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

  const catalog = process.env.CATALOG_FILE
    ? JSON.parse(await readFile(process.env.CATALOG_FILE, "utf8"))
    : await (async () => {
        const response = await fetch(CATALOG_URL, { headers: { accept: "application/json" } });
        if (!response.ok) throw new Error(`Celestial catalog returned HTTP ${response.status}`);
        return response.json();
      })();
  const products = (catalog.products || []).filter(isTea);
  const supabase = databaseUrl ? null : createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "disable" || databaseUrl.includes("host=/cloudsql/") ? false : { rejectUnauthorized: false } }) : null;
  const acquiredAt = new Date().toISOString();
  const summary = { source: CATALOG_URL, acquiredAt, catalogProducts: catalog.products?.length || 0, teaProducts: products.length, imported: 0, assets: 0 };

  for (const product of products) {
    const externalUid = `celestial_seasonings:shopify:${product.id}`;
    const pageUrl = `https://celestialseasonings.com/products/${product.handle}`;
    const description = [htmlText(product.body_html), `Official product page: ${pageUrl}`, `Catalog source: ${CATALOG_URL}`, `Label assets acquired: ${acquiredAt}`].filter(Boolean).join("\n");
    const row = {
      slug: `celestial-seasonings-${slugify(product.handle || product.title)}`,
      name: product.title,
      brand: BRAND,
      description,
      source: "celestial_seasonings",
      external_uid: externalUid,
      prerender_page: true,
    };
    let productId;
    if (pool) {
      let saved = await pool.query(`
        insert into products (slug, name, brand, description, source, external_uid, prerender_page)
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict do nothing
        returning id`, [row.slug, row.name, row.brand, row.description, row.source, row.external_uid, row.prerender_page]);
      if (!saved.rows.length) {
        saved = await pool.query(`
          update products set slug = $1, name = $2, brand = $3, description = $4,
            source = $5, prerender_page = $6, updated_at = now()
          where external_uid = $7
          returning id`, [row.slug, row.name, row.brand, row.description, row.source, row.prerender_page, row.external_uid]);
      }
      productId = saved.rows[0].id;
    } else {
      const { data: saved, error } = await supabase.from("products").upsert(row, { onConflict: "external_uid" }).select("id").single();
      if (error) throw new Error(`${product.title}: product upsert failed: ${error.message}`);
      productId = saved.id;
    }
    summary.imported++;
    const assets = (product.images || []).map((image, index) => ({
      product_id: productId,
      asset_type: index === 0 ? "packaging_label_primary" : "packaging_label",
      source_url: image.src,
      source_page_url: pageUrl,
      source_uid: `${externalUid}:image:${image.id}`,
      alt_text: `${product.title} packaging label image ${index + 1}`,
      metadata: { shopify_product_id: product.id, shopify_image_id: image.id, width: image.width, height: image.height, vendor: product.vendor, tags: product.tags || [] },
      acquired_at: acquiredAt,
    }));
    if (assets.length) {
      if (pool) {
        for (const asset of assets) {
          await pool.query(`
            insert into product_label_assets (product_id, asset_type, source_url, source_page_url, source_uid, alt_text, metadata, acquired_at)
            values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
            on conflict (product_id, source_url) do update set
              asset_type = excluded.asset_type, source_page_url = excluded.source_page_url,
              source_uid = excluded.source_uid, alt_text = excluded.alt_text,
              metadata = excluded.metadata, acquired_at = excluded.acquired_at`,
          [asset.product_id, asset.asset_type, asset.source_url, asset.source_page_url, asset.source_uid, asset.alt_text, JSON.stringify(asset.metadata), asset.acquired_at]);
        }
      } else {
        const { error: assetError } = await supabase.from("product_label_assets").upsert(assets, { onConflict: "product_id,source_url" });
        if (assetError) throw new Error(`${product.title}: label asset upsert failed: ${assetError.message}`);
      }
      summary.assets += assets.length;
    }
  }
  await pool?.end();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
