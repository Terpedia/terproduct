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

The `terproduct_product_evidence` view is the product-page read model. A product-specific CoA is joined through `product_id` and `ingredient_id`; no CoA is shared across oils unless the source data explicitly says so.

`terproduct_coa_documents` supports multiple rows per product: use `visibility='public'` for the public representative CoA and `visibility='private'` for partner, lot, or formulation documents. Public product-page queries filter to public rows.

Important: `document_url` is an internal evidence pointer. The public Terproduct page must never render or link the actual laboratory report. Publish only a reviewed summary/status; keep the PDF behind controlled access.
