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

create index if not exists idx_product_label_assets_product
  on product_label_assets (product_id);
create index if not exists idx_product_label_assets_source_uid
  on product_label_assets (source_uid) where source_uid is not null;

comment on table product_label_assets is
  'Packaging and label image assets acquired from an authoritative product source.';
comment on column product_label_assets.source_url is
  'Canonical URL for the source asset; the asset itself is not silently rehosted.';

grant select on public.product_label_assets to anon, authenticated;
alter table public.product_label_assets enable row level security;
drop policy if exists "Public read product label assets" on public.product_label_assets;
create policy "Public read product label assets"
  on public.product_label_assets for select using (true);
