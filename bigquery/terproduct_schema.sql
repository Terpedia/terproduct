-- BigQuery landing schema for Terproduct.
-- Operational catalog records live in terpedia_ops; canonical chemistry remains
-- in terpedia_core / terpedia_raw and is joined by stable identifiers.

CREATE TABLE IF NOT EXISTS `terpedia-489015.terpedia_ops.terproduct_products` (
  product_id STRING NOT NULL,
  slug STRING NOT NULL,
  name STRING NOT NULL,
  brand STRING,
  description STRING,
  gtin STRING,
  source_url STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `terpedia-489015.terpedia_ops.terproduct_ingredients` (
  ingredient_id STRING NOT NULL,
  name STRING NOT NULL,
  description STRING,
  terpedia_analysis_url STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `terpedia-489015.terpedia_ops.terproduct_product_ingredients` (
  product_id STRING NOT NULL,
  ingredient_id STRING NOT NULL,
  sort_order INT64,
  as_listed STRING,
  notes STRING,
  source_url STRING,
  created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `terpedia-489015.terpedia_ops.terproduct_coa_documents` (
  coa_id STRING NOT NULL,
  product_id STRING NOT NULL,
  ingredient_id STRING,
  lab_name STRING,
  batch_lot STRING,
  document_url STRING,
  tested_at DATE,
  received_at DATE,
  notes STRING,
  source_url STRING,
  created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `terpedia-489015.terpedia_ops.terproduct_compounds` (
  compound_id STRING NOT NULL,
  name STRING NOT NULL,
  cas_number STRING,
  category STRING,
  terpedia_compound_id STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `terpedia-489015.terpedia_ops.terproduct_ingredient_compounds` (
  ingredient_id STRING NOT NULL,
  compound_id STRING NOT NULL,
  relationship STRING NOT NULL,
  evidence_level STRING NOT NULL,
  source_url STRING,
  notes STRING,
  created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `terpedia-489015.terpedia_ops.terproduct_compound_literature` (
  compound_id STRING NOT NULL,
  title STRING NOT NULL,
  url STRING NOT NULL,
  pmid STRING,
  doi STRING,
  journal STRING,
  published_at DATE,
  citation_type STRING NOT NULL,
  notes STRING,
  created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `terpedia-489015.terpedia_ops.terproduct_product_sources` (
  product_id STRING NOT NULL,
  source_type STRING NOT NULL,
  source_url STRING,
  source_name STRING,
  captured_at TIMESTAMP,
  agent STRING,
  trace_id STRING,
  evidence_json JSON,
  created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `terpedia-489015.terpedia_ops.terproduct_product_images` (
  product_id STRING NOT NULL,
  asset_type STRING NOT NULL,
  source_url STRING NOT NULL,
  source_page_url STRING,
  source_uid STRING,
  alt_text STRING,
  metadata JSON,
  acquired_at TIMESTAMP,
  created_at TIMESTAMP
);

CREATE OR REPLACE VIEW `terpedia-489015.terpedia_ops.terproduct_product_evidence` AS
SELECT
  p.product_id, p.slug, p.name, p.brand, p.description, p.gtin,
  i.ingredient_id, i.name AS ingredient_name,
  c.coa_id, c.lab_name, c.batch_lot, c.document_url, c.tested_at,
  ic.compound_id, ic.relationship, ic.evidence_level,
  comp.name AS compound_name, comp.terpedia_compound_id,
  c.source_url AS coa_source_url
FROM `terpedia-489015.terpedia_ops.terproduct_products` p
LEFT JOIN `terpedia-489015.terpedia_ops.terproduct_product_ingredients` pi USING (product_id)
LEFT JOIN `terpedia-489015.terpedia_ops.terproduct_ingredients` i USING (ingredient_id)
LEFT JOIN `terpedia-489015.terpedia_ops.terproduct_coa_documents` c USING (product_id, ingredient_id)
LEFT JOIN `terpedia-489015.terpedia_ops.terproduct_ingredient_compounds` ic USING (ingredient_id)
LEFT JOIN `terpedia-489015.terpedia_ops.terproduct_compounds` comp USING (compound_id);
