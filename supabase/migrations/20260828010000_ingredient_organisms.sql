-- Link commercial ingredients to organism entities maintained by Terpedia.
-- organism_id is an external/stable Terpedia identifier because the catalog
-- database and the Terpedia knowledge database are separate services.
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

create index if not exists idx_ingredient_organisms_ingredient
  on ingredient_organisms (ingredient_id);
create index if not exists idx_ingredient_organisms_organism
  on ingredient_organisms (organism_id);

alter table public.ingredient_organisms enable row level security;
drop policy if exists "Public read ingredient organisms" on public.ingredient_organisms;
create policy "Public read ingredient organisms"
  on public.ingredient_organisms for select using (true);
