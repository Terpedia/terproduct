# Terproduct → BigQuery

The BigQuery landing schema is in `terproduct_schema.sql`. It uses `terpedia_ops` for product/CoA/evidence records and leaves canonical molecule, protein, disease, and literature datasets in their existing Terpedia datasets.

Apply it with:

```bash
bq query --use_legacy_sql=false < bigquery/terproduct_schema.sql
```

The current MONDAYS snapshot can be ingested with:

```bash
node scripts/ingest-mondays-bigquery.mjs
```

Add `--sql-only` to print the generated statements instead of running them, which is the way to
review a snapshot before it touches the dataset.

MONDAYS hemp SKUs also carry a measured terpene profile scraped from each public product page
(`mondays/data/terpene-profiles/`). Those land as a second CoA row per SKU — `coa_id` prefixed
`coa-terpene-`, `document_url` pointing at the public product page rather than a lab PDF — with one
`terproduct_coa_compound_results` row per compound: `value` is percent of total volatiles and the
`qualifier` carries the derived milligrams per chew. The batch CoA PDFs (`coa-b*`) are
cannabinoid and safety panels and contain no terpene panel, so the two record types never overlap.

Each MONDAYS SKU gets its own `ingredient_id`: MONDAYS declares the terpene oil as SKU-specific, and
a shared ingredient row would pool six different measured profiles into one composition.

The `terproduct_product_evidence` view is the product-page read model. A product-specific CoA is joined through `product_id` and `ingredient_id`; no CoA is shared across oils unless the source data explicitly says so.

`terproduct_coa_documents` supports multiple rows per product: use `visibility='public'` for the public representative CoA and `visibility='private'` for partner, lot, or formulation documents. Public product-page queries filter to public rows.

Important: `document_url` is an internal evidence pointer. The public Terproduct page must never render or link the actual laboratory report. Publish only a reviewed summary/status; keep the PDF behind controlled access.
