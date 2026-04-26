-- Optional links from an ingredient to Terpedia (or other) terpene / analysis pages.
alter table ingredients add column if not exists terpedia_analysis_url text;
comment on column ingredients.terpedia_analysis_url is
  'Public URL for terpene profile, CoA, lab analysis, or knowledge-base article.';
