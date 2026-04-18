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
