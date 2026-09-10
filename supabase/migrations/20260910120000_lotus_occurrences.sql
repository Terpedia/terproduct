-- LOTUS natural-product occurrence: which molecules have been reported in which organisms,
-- each row carrying the paper that reported it. Loaded in bulk from the frozen release, so
-- LOTUS is never a request-time dependency and there is no snapshot to keep in sync.
--
-- Keyed on InChIKey rather than a compound id: any structure joins, including the ~227k
-- LOTUS knows that this catalog holds nothing else about.
create table if not exists lotus_occurrences (
  structure_inchikey text not null,
  organism_name text not null,
  reference_doi text,
  manual_validation boolean not null default false,
  organism_wikidata text,
  structure_wikidata text,
  reference_wikidata text,
  release_date date,
  loaded_at timestamptz not null default now()
);

create index if not exists idx_lotus_inchikey on lotus_occurrences (structure_inchikey);
create index if not exists idx_lotus_organism on lotus_occurrences (organism_name);
create index if not exists idx_lotus_doi on lotus_occurrences (reference_doi) where reference_doi is not null;

comment on table lotus_occurrences is
  'LOTUS occurrence triples. An occurrence is a report that a compound was detected in an organism in the cited work: it is not a concentration, and it does not make the organism a meaningful source of the compound.';

-- Occurrence counts per structure, for pages that rank organisms by how well attested they are.
create or replace view lotus_structure_organisms as
select structure_inchikey,
       organism_name,
       count(distinct reference_doi) as reference_count,
       array_agg(distinct reference_doi order by reference_doi) filter (where reference_doi is not null) as references
from lotus_occurrences
group by structure_inchikey, organism_name;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on public.lotus_occurrences to anon, authenticated;
    grant select on public.lotus_structure_organisms to anon, authenticated;
  end if;
end $$;
