-- Molecule reference data: chemistry identity, and disease associations reported for
-- the compound itself. getCompoundById already selects compounds.slug and
-- compounds.summary, which no earlier migration created — add them here so the
-- molecule route can run.
alter table compounds add column if not exists slug text;
alter table compounds add column if not exists summary text;
alter table compounds add column if not exists summary_source_name text;
alter table compounds add column if not exists summary_source_url text;
alter table compounds add column if not exists pubchem_cid text;
alter table compounds add column if not exists molecular_weight numeric;
alter table compounds add column if not exists iupac_name text;
alter table compounds add column if not exists image_url text;

create unique index if not exists compounds_slug_key on compounds (slug) where slug is not null;
create index if not exists idx_compounds_pubchem on compounds (pubchem_cid) where pubchem_cid is not null;

-- One row per (compound, condition, kind). Kind matters: a metabolomics association
-- means the compound was detected or studied in that condition, an occupational entry
-- describes an exposure hazard. Neither is a therapeutic claim, and the column exists
-- so a reader is never shown the bare disease name without that context.
create table if not exists compound_diseases (
  id uuid primary key default gen_random_uuid(),
  compound_id uuid not null references compounds (id) on delete cascade,
  disease_slug text not null,
  disease_name text not null,
  kind text not null default 'reported_association',
  category text,
  pmids text[] not null default '{}',
  source text not null,
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique (compound_id, disease_slug, kind)
);

create index if not exists idx_compound_diseases_compound on compound_diseases (compound_id);
create index if not exists idx_compound_diseases_slug on compound_diseases (disease_slug);

alter table public.compound_diseases enable row level security;
drop policy if exists "Public read compound diseases" on public.compound_diseases;
create policy "Public read compound diseases"
  on public.compound_diseases for select using (true);

grant select on public.compound_diseases, public.compound_bioactivities, public.compound_literature to anon, authenticated;
