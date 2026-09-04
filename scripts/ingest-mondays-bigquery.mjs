#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const project = process.env.TERPEDIA_GCP_PROJECT || "terpedia-489015";
const root = path.resolve(import.meta.dirname, "../../mondays");
const data = JSON.parse(await fs.readFile(path.join(root, "data/products.json"), "utf8"));
const esc = (value) => value == null ? "NULL" : `'${String(value).replaceAll("'", "\\'")}'`;
const slug = (value) => value.toLowerCase().replaceAll("β-", "beta-").replaceAll("α-", "alpha-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const id = (prefix, value) => `${prefix}-${slug(value)}`;
const rows = { products: [], ingredients: [], links: [], coas: [], compounds: [], compoundLinks: [], sources: [], images: [] };

for (const product of data.products) {
  const productId = id("mondays", product.name);
  const ingredientId = id("mondays-ingredient", product.ingredient || "cannabis-sativa");
  rows.products.push(`(${esc(productId)},${esc(slug(product.name))},${esc(product.name)},${esc("MONDAYS")},${esc(product.description)},NULL,${esc(product.source)},CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP())`);
  rows.ingredients.push(`(${esc(ingredientId)},${esc(product.ingredient)},${esc(product.ingredient)},NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP())`);
  rows.links.push(`(${esc(productId)},${esc(ingredientId)},1,${esc(product.ingredient)},${esc(product.strain)},${esc(product.source)},CURRENT_TIMESTAMP())`);
  if (product.coa) rows.coas.push(`(${esc(id("coa", product.coa_batch || product.name))},${esc(productId)},${esc(ingredientId)},${esc("Delta 9 Analytical")},${esc(product.coa_batch)},${esc(product.coa)},${esc(product.coa_report_date)},NULL,${esc("Representative public CoA listed by MONDAYS; report retained as internal evidence pointer." )},${esc("https://www.chewmondays.com/pages/coa")},CURRENT_TIMESTAMP(),${esc("public")})`);
  for (const molecule of product.molecules || []) {
    const compoundId = id("mondays-compound", molecule);
    rows.compounds.push(`(${esc(compoundId)},${esc(molecule)},NULL,${esc("terpene")},NULL,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP())`);
    rows.compoundLinks.push(`(${esc(ingredientId)},${esc(compoundId)},${esc("profile_candidate")},${esc("inference")},${esc("https://www.chewmondays.com/products/" + slug(product.name))},${esc("Candidate inferred from published strain/profile language; not a quantitative CoA result.")},CURRENT_TIMESTAMP())`);
  }
  const handle = new URL(product.source).pathname.split("/").filter(Boolean).pop();
  try {
    const response = await fetch(`https://www.chewmondays.com/products/${handle}.js`);
    if (response.ok) {
      const shopify = await response.json();
      const image = shopify.images?.[0];
      if (image) rows.images.push(`(${esc(productId)},${esc("product_image")},${esc(image)},${esc(product.source)},${esc(handle)},${esc(product.name)},JSON '{}',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP())`);
    }
  } catch (error) { console.warn(`Image lookup failed for ${product.name}: ${error.message}`); }
  rows.sources.push(`(${esc(productId)},${esc("official_catalog")},${esc(product.source)},${esc("MONDAYS" )},CURRENT_TIMESTAMP(),${esc("ingest-mondays-bigquery")},NULL,JSON '${JSON.stringify({ snapshot_date: data.snapshot_date }).replaceAll("'", "\\'")}',CURRENT_TIMESTAMP())`);
}

const dedupe = (values) => [...new Set(values)];
const sql = `
DELETE FROM \`${project}.terpedia_ops.terproduct_products\` WHERE STARTS_WITH(product_id, 'mondays-');
DELETE FROM \`${project}.terpedia_ops.terproduct_ingredients\` WHERE STARTS_WITH(ingredient_id, 'mondays-ingredient-');
DELETE FROM \`${project}.terpedia_ops.terproduct_product_ingredients\` WHERE STARTS_WITH(product_id, 'mondays-');
DELETE FROM \`${project}.terpedia_ops.terproduct_coa_documents\` WHERE STARTS_WITH(product_id, 'mondays-');
DELETE FROM \`${project}.terpedia_ops.terproduct_compounds\` WHERE STARTS_WITH(compound_id, 'mondays-compound-');
DELETE FROM \`${project}.terpedia_ops.terproduct_ingredient_compounds\` WHERE STARTS_WITH(ingredient_id, 'mondays-ingredient-');
DELETE FROM \`${project}.terpedia_ops.terproduct_product_sources\` WHERE STARTS_WITH(product_id, 'mondays-');
DELETE FROM \`${project}.terpedia_ops.terproduct_product_images\` WHERE STARTS_WITH(product_id, 'mondays-');
INSERT INTO \`${project}.terpedia_ops.terproduct_products\` VALUES ${rows.products.join(",")};
INSERT INTO \`${project}.terpedia_ops.terproduct_ingredients\` VALUES ${dedupe(rows.ingredients).join(",")};
INSERT INTO \`${project}.terpedia_ops.terproduct_product_ingredients\` VALUES ${rows.links.join(",")};
INSERT INTO \`${project}.terpedia_ops.terproduct_coa_documents\` (coa_id,product_id,ingredient_id,lab_name,batch_lot,document_url,tested_at,received_at,notes,source_url,created_at,visibility) VALUES ${rows.coas.join(",")};
INSERT INTO \`${project}.terpedia_ops.terproduct_compounds\` VALUES ${dedupe(rows.compounds).join(",")};
INSERT INTO \`${project}.terpedia_ops.terproduct_ingredient_compounds\` VALUES ${dedupe(rows.compoundLinks).join(",")};
INSERT INTO \`${project}.terpedia_ops.terproduct_product_sources\` VALUES ${rows.sources.join(",")};
INSERT INTO \`${project}.terpedia_ops.terproduct_product_images\` VALUES ${rows.images.join(",")};
`;
const result = spawnSync("bq", ["query", `--project_id=${project}`, "--use_legacy_sql=false"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
if (result.status !== 0) { console.error(result.stderr || result.stdout); process.exit(result.status || 1); }
console.log(`Ingested ${data.products.length} MONDAYS products, ${rows.coas.length} CoAs, ${rows.images.length} images, and ${dedupe(rows.compoundLinks).length} candidate molecule links into ${project}.terpedia_ops.`);
