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

## LOTUS occurrence data

`lotus_occurrences` holds the LOTUS frozen release
(natural-product occurrence: which molecules have been reported in which organisms, each row
carrying the DOI that reported it). Loaded in bulk from the Zenodo release rather than scraped
per compound, so LOTUS is not a request-time dependency and there is no snapshot to keep in sync:

```bash
curl -sSL "https://zenodo.org/api/records/19360665/files/260413_frozen.csv.gz/content" -o frozen.csv.gz
gunzip -c frozen.csv.gz | \
  node -e '/* drop rows with no structure or organism, add release_date + loaded_at */' > lotus_load.csv
bq load --source_format=CSV --skip_leading_rows=1 --replace \
  terpedia_ops.lotus_occurrences lotus_load.csv
```

The April 2026 release is 674,422 usable triples over 227,316 structures, 37,468 organisms and
91,379 references. Join it on `structure_inchikey` — any compound with a resolved InChIKey picks
up its occurrence record, including structures Terpedia holds nothing else about.

An occurrence is a report that a compound was detected in an organism in the cited work. It is not
a concentration, and it does not make that organism a meaningful source of the compound.
