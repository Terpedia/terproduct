# Terproduct → BigQuery

The BigQuery landing schema is in `terproduct_schema.sql`. It uses `terpedia_ops` for product/CoA/evidence records and leaves canonical molecule, protein, disease, and literature datasets in their existing Terpedia datasets.

Apply it with:

```bash
bq query --use_legacy_sql=false < bigquery/terproduct_schema.sql
```

The `terproduct_product_evidence` view is the product-page read model. A product-specific CoA is joined through `product_id` and `ingredient_id`; no CoA is shared across oils unless the source data explicitly says so.
