-- Public read (anon key) for catalog: products, ingredients, composition.
-- Ingest/field should use the service role or a custom API, not the anon key on the public site.
-- Run after the earlier table migrations; apply in Supabase SQL or via `supabase db push`.

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.products, public.ingredients, public.product_ingredients
  TO anon, authenticated;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read ingredients" ON public.ingredients;
CREATE POLICY "Public read ingredients" ON public.ingredients FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read product_ingredients" ON public.product_ingredients;
CREATE POLICY "Public read product_ingredients" ON public.product_ingredients FOR SELECT USING (true);
