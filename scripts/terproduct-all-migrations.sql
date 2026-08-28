-- Terproduct: apply all bundled migrations once on a fresh Supabase project.
-- Dashboard → SQL Editor → New query → paste this file → Run.
-- Then: npm run import:terpene-csv -- data/terpene-parser/results.csv --limit 50

-- === supabase/migrations/20260418000000_initial_schema.sql ===
-- Terproduct: products → ingredients → CoA documents → compound results
-- Apply with Supabase CLI or any PostgreSQL 14+ instance.

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  brand text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- === supabase/migrations/20260828010000_ingredient_organisms.sql ===
-- Link commercial ingredients to organism entities maintained by Terpedia.
create table if not exists ingredient_organisms (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  organism_id text not null,
  organism_name text not null,
  organism_url text,
  relationship text not null default 'source_organism',
  source text not null default 'terpedia',
  source_record_id text,
  evidence_note text,
  provenance_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ingredient_id, organism_id, relationship, source)
);
create index if not exists idx_ingredient_organisms_ingredient on ingredient_organisms (ingredient_id);
create index if not exists idx_ingredient_organisms_organism on ingredient_organisms (organism_id);
alter table public.ingredient_organisms enable row level security;
drop policy if exists "Public read ingredient organisms" on public.ingredient_organisms;
create policy "Public read ingredient organisms" on public.ingredient_organisms for select using (true);

-- Composition: which ingredients appear in which product.
create table if not exists product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  sort_order integer not null default 0,
  notes text,
  unique (product_id, ingredient_id)
);

-- Canonical analytes (terpenes, cannabinoids, solvents, etc.).
create table if not exists compounds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  cas_number text,
  category text,
  created_at timestamptz not null default now()
);

-- Certificate of analysis for an ingredient (often lot/batch scoped).
create table if not exists coa_documents (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  lab_name text,
  batch_lot text,
  document_url text,
  tested_at date,
  received_at date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists coa_compound_results (
  id uuid primary key default gen_random_uuid(),
  coa_id uuid not null references coa_documents (id) on delete cascade,
  compound_id uuid not null references compounds (id) on delete restrict,
  value numeric,
  unit text not null default '%',
  is_nd boolean not null default false,
  qualifier text,
  unique (coa_id, compound_id)
);

create index if not exists idx_product_ingredients_product
  on product_ingredients (product_id);
create index if not exists idx_coa_ingredient
  on coa_documents (ingredient_id);
create index if not exists idx_coa_results_coa
  on coa_compound_results (coa_id);

-- === supabase/migrations/20260828000000_product_label_assets.sql ===
-- Persist packaging/label assets acquired from official product catalogs.
create table if not exists product_label_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  asset_type text not null default 'packaging_label',
  source_url text not null,
  source_page_url text,
  source_uid text,
  alt_text text,
  metadata jsonb not null default '{}'::jsonb,
  acquired_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (product_id, source_url)
);
create index if not exists idx_product_label_assets_product on product_label_assets (product_id);
create index if not exists idx_product_label_assets_source_uid on product_label_assets (source_uid) where source_uid is not null;
alter table public.product_label_assets enable row level security;
drop policy if exists "Public read product label assets" on public.product_label_assets;
create policy "Public read product label assets" on public.product_label_assets for select using (true);

-- === supabase/migrations/20260423000000_commercial_gtin_ingredients.sql ===
-- Commercial & retail products: correlate GTIN/UPC with declared ingredient lines,
-- and optionally map each line to a canonical ingredients row.

alter table products add column if not exists gtin text;
comment on column products.gtin is
  'Normalized product identifier (UPC-A / EAN-8 / EAN-13 / GTIN-14 digits, no check digit validation here).';

create unique index if not exists products_gtin_key on products (gtin) where gtin is not null;

alter table product_ingredients add column if not exists as_listed text;
comment on column product_ingredients.as_listed is
  'How the ingredient is written on the commercial product label, if different from the canonical name.';

-- One row per line on the ingredient / INCI / “contains” list for a product (before/after resolution).
create table if not exists product_label_ingredient_lines (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  line_index integer not null,
  raw_text text not null,
  resolved_ingredient_id uuid references ingredients (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (product_id, line_index)
);

create index if not exists idx_label_lines_product
  on product_label_ingredient_lines (product_id);
create index if not exists idx_label_lines_resolved
  on product_label_ingredient_lines (resolved_ingredient_id) where resolved_ingredient_id is not null;

comment on table product_label_ingredient_lines is
  'Label declaration lines (scan/OCR/typed) correlated to a product, optionally resolved to ingredients.';

-- === supabase/migrations/20260424000000_ingredient_analysis_url.sql ===
-- Optional links from an ingredient to Terpedia (or other) terpene / analysis pages.
alter table ingredients add column if not exists terpedia_analysis_url text;
comment on column ingredients.terpedia_analysis_url is
  'Public URL for terpene profile, CoA, lab analysis, or knowledge-base article.';

-- === supabase/migrations/20260425000000_rls_public_read_catalog.sql ===
-- Public read (anon key) for catalog: products, ingredients, composition.
-- Ingest/field should use the service role or a custom API, not the anon key on the public site.
-- Run after the earlier table migrations; apply in Supabase SQL or via `supabase db push`.

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read ingredients" ON public.ingredients;
CREATE POLICY "Public read ingredients" ON public.ingredients FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read product_ingredients" ON public.product_ingredients;
CREATE POLICY "Public read product_ingredients" ON public.product_ingredients FOR SELECT USING (true);

-- === supabase/migrations/20260501120000_terpene_csv_catalog.sql ===
-- Cannabis terpene CSV import (MaxValue/Terpene-Profile-Parser-for-Cannabis-Strains).
-- Adds source/prerender flags, product→CoA shortcut, compound display/findings fields, public read RLS.

alter table products add column if not exists source text not null default 'manual';
comment on column products.source is
  'Origin of the row, e.g. manual retail ingest or terpene_csv bulk import.';

alter table products add column if not exists external_uid text;
comment on column products.external_uid is
  'Stable id from upstream data (e.g. lab database + test UID) for idempotent imports.';

create unique index if not exists products_external_uid_key
  on products (external_uid) where external_uid is not null;

alter table products add column if not exists prerender_page boolean not null default true;
comment on column products.prerender_page is
  'When false, excluded from static export paths; detail is loaded via /cannabis/product/?slug=…';

alter table products add column if not exists primary_coa_id uuid references coa_documents (id) on delete set null;
comment on column products.primary_coa_id is
  'Primary lab CoA for this product when attached (optional shortcut from bulk terpene import).';

create index if not exists idx_products_source on products (source);
create index if not exists idx_products_prerender on products (prerender_page) where prerender_page = true;

alter table compounds add column if not exists slug text;
comment on column compounds.slug is 'URL-safe slug for compound detail pages.';

alter table compounds add column if not exists summary text;
comment on column compounds.summary is 'Short plain-text description for listings.';

alter table compounds add column if not exists findings text;
comment on column compounds.findings is 'Curated notes / literature pointers (markdown allowed in app).';

alter table compounds add column if not exists display_color text;
comment on column compounds.display_color is 'Hex color for charts (e.g. from terpene parser palette).';

alter table compounds add column if not exists boiling_point_c numeric;
comment on column compounds.boiling_point_c is 'Approximate boiling point °C when known.';

-- Backfill slugs from names (ASCII-safe); resolve duplicates by suffixing id fragment.
update compounds
set slug = trim(both '-' from lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g')))
where coalesce(trim(slug), '') = '';

update compounds c
set slug = left(c.slug || '-' || replace(left(c.id::text, 8), '-', ''), 120)
from (
  select slug
  from compounds
  where slug is not null and trim(slug) <> ''
  group by slug
  having count(*) > 1
) d
where c.slug = d.slug;

update compounds
set slug = 'compound-' || replace(id::text, '-', '')
where slug is null or trim(slug) = '';

create unique index if not exists compounds_slug_key on compounds (slug);

-- Public catalog read for CoA / compounds / results (anon site).
alter table public.compounds enable row level security;
alter table public.coa_documents enable row level security;
alter table public.coa_compound_results enable row level security;

drop policy if exists "Public read compounds" on public.compounds;
create policy "Public read compounds" on public.compounds for select using (true);

drop policy if exists "Public read coa_documents" on public.coa_documents;
create policy "Public read coa_documents" on public.coa_documents for select using (true);

drop policy if exists "Public read coa_compound_results" on public.coa_compound_results;
create policy "Public read coa_compound_results" on public.coa_compound_results for select using (true);

-- === supabase/migrations/20260828020000_compound_bioactivity_graph.sql ===
alter table compounds add column if not exists smiles text;
alter table compounds add column if not exists inchikey text;
alter table compounds add column if not exists molecular_formula text;
create table if not exists compound_bioactivities (
  id uuid primary key default gen_random_uuid(),
  compound_id uuid not null references compounds (id) on delete cascade,
  organism_id text,
  organism_name text,
  target_id text,
  target_name text,
  activity_type text not null,
  activity_value numeric,
  activity_unit text,
  assay_system text,
  evidence_level text not null default 'reported',
  source text not null,
  source_record_id text,
  provenance_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (compound_id, source, source_record_id, activity_type, target_id)
);
create index if not exists idx_compound_bioactivities_compound on compound_bioactivities (compound_id);
create index if not exists idx_compound_bioactivities_organism on compound_bioactivities (organism_id);
create index if not exists idx_compound_bioactivities_source on compound_bioactivities (source, source_record_id);
alter table public.compound_bioactivities enable row level security;
drop policy if exists "Public read compound bioactivities" on public.compound_bioactivities;
create policy "Public read compound bioactivities" on public.compound_bioactivities for select using (true);
