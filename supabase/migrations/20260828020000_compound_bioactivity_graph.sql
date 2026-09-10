-- Evidence-aware chain: ingredient -> molecule -> organism-specific bioactivity.
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
create policy "Public read compound bioactivities"
  on public.compound_bioactivities for select using (true);
