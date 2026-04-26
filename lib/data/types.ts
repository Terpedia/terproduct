/** Shared row shapes (Supabase/Postgres). */
export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  description: string | null;
  gtin: string | null;
  updated_at: string;
};

export type IngredientRow = {
  id: string;
  name: string;
  description: string | null;
  terpedia_analysis_url: string | null;
  sort_order: number;
  as_listed: string | null;
  notes: string | null;
};

export type IngredientDetail = {
  id: string;
  name: string;
  description: string | null;
  terpedia_analysis_url: string | null;
  productCount: number;
};
