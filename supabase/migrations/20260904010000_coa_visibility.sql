-- A product may have multiple CoAs, including a public representative report
-- and private partner/lot documentation. Public product pages expose public rows only.
alter table coa_documents add column if not exists product_id uuid references products (id) on delete cascade;
alter table coa_documents add column if not exists visibility text not null default 'public';
alter table coa_documents add constraint coa_documents_visibility_check check (visibility in ('public', 'private'));
create index if not exists idx_coa_documents_product_visibility on coa_documents (product_id, visibility);
