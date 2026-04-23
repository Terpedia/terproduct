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
