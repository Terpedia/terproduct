-- Evidence-preserving links for products identified from labels or other sources.
-- A product may contain ingredients; ingredients may be associated with canonical
-- compounds; compounds may be supported by literature citations.

create table if not exists ingredient_compounds (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  compound_id uuid not null references compounds (id) on delete cascade,
  relationship text not null default 'reported_or_expected',
  evidence_level text not null default 'inference',
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique (ingredient_id, compound_id)
);

create index if not exists idx_ingredient_compounds_ingredient
  on ingredient_compounds (ingredient_id);
create index if not exists idx_ingredient_compounds_compound
  on ingredient_compounds (compound_id);

create table if not exists compound_literature (
  id uuid primary key default gen_random_uuid(),
  compound_id uuid not null references compounds (id) on delete cascade,
  title text not null,
  url text not null,
  pmid text,
  doi text,
  journal text,
  published_at date,
  citation_type text not null default 'supporting',
  notes text,
  created_at timestamptz not null default now(),
  unique (compound_id, url)
);

create index if not exists idx_compound_literature_compound
  on compound_literature (compound_id);

create table if not exists product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  source_type text not null default 'label_image',
  source_url text,
  source_name text,
  captured_at timestamptz,
  agent text,
  trace_id text,
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (product_id, source_type, source_url)
);

create index if not exists idx_product_sources_product
  on product_sources (product_id);
