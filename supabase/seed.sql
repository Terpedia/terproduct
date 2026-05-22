-- Terproduct sample catalog data.
-- Apply after migrations. Safe to run more than once.

with product_upsert as (
  insert into public.products (
    slug,
    name,
    brand,
    description,
    gtin
  )
  values (
    'sample-terpedia-limonene-gummies',
    'Sample Terpedia Limonene Gummies',
    'Terpedia Labs',
    'Demo retail product for validating catalog lookup, ingredient mapping, UPC QR labels, and field printing.',
    '0038000100096'
  )
  on conflict (slug) do update
    set name = excluded.name,
        brand = excluded.brand,
        description = excluded.description,
        gtin = excluded.gtin,
        updated_at = now()
  returning id
),
ingredient_values (name, description, terpedia_analysis_url, sort_order, as_listed) as (
  values
    (
      'Organic Tapioca Syrup',
      'Sample sweetener ingredient used for label-line mapping tests.',
      null,
      1,
      'Organic tapioca syrup'
    ),
    (
      'Cane Sugar',
      'Sample bulk sweetener ingredient.',
      null,
      2,
      'Cane sugar'
    ),
    (
      'Natural Lemon Flavor',
      'Sample flavor ingredient associated with citrus terpene profile testing.',
      'https://terpedia.com/terpenes/limonene',
      3,
      'Natural lemon flavor'
    ),
    (
      'Pectin',
      'Sample gelling agent for gummy products.',
      null,
      4,
      'Pectin'
    )
),
ingredient_insert as (
  insert into public.ingredients (
    name,
    description,
    terpedia_analysis_url
  )
  select
    name,
    description,
    terpedia_analysis_url
  from ingredient_values
  where not exists (
    select 1
    from public.ingredients existing
    where existing.name = ingredient_values.name
  )
  returning id, name
),
ingredient_rows as (
  select
    seeded.id,
    iv.name,
    iv.sort_order,
    iv.as_listed
  from ingredient_values iv
  join (
    select id, name
    from public.ingredients
    where name in (select name from ingredient_values)
    union all
    select id, name
    from ingredient_insert
  ) seeded on seeded.name = iv.name
),
composition_upsert as (
  insert into public.product_ingredients (
    product_id,
    ingredient_id,
    sort_order,
    as_listed,
    notes
  )
  select
    p.id,
    i.id,
    i.sort_order,
    i.as_listed,
    'Seed sample product ingredient'
  from product_upsert p
  cross join ingredient_rows i
  on conflict (product_id, ingredient_id) do update
    set sort_order = excluded.sort_order,
        as_listed = excluded.as_listed,
        notes = excluded.notes
  returning product_id
)
insert into public.product_label_ingredient_lines (
  product_id,
  line_index,
  raw_text,
  resolved_ingredient_id,
  notes
)
select
  p.id,
  i.sort_order,
  i.as_listed,
  i.id,
  'Seed sample label line'
from product_upsert p
cross join ingredient_rows i
on conflict (product_id, line_index) do update
  set raw_text = excluded.raw_text,
      resolved_ingredient_id = excluded.resolved_ingredient_id,
      notes = excluded.notes;
