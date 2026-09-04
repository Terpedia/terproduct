-- Product pages may display authoritative remote packaging/product images.
create table if not exists product_label_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  asset_type text not null default 'product_image',
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
