/**
 * Mirrors `supabase/migrations/20260418000000_initial_schema.sql`.
 * Use with generated DB types or Supabase client when wired up.
 */

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  description: string | null;
  /** UPC / EAN / GTIN-14 (digits), when known for off-the-shelf products. */
  gtin: string | null;
  created_at: string;
  updated_at: string;
};

export type Ingredient = {
  id: string;
  name: string;
  description: string | null;
  /** Public URL to Terpedia terpene / analysis or KB page when set in DB. */
  terpedia_analysis_url: string | null;
  created_at: string;
};

export type ProductIngredient = {
  id: string;
  product_id: string;
  ingredient_id: string;
  sort_order: number;
  notes: string | null;
  as_listed: string | null;
};

/** One line from a commercial product’s ingredient / “contains” list. */
export type ProductLabelIngredientLine = {
  id: string;
  product_id: string;
  line_index: number;
  raw_text: string;
  resolved_ingredient_id: string | null;
  notes: string | null;
  created_at: string;
};

export type Compound = {
  id: string;
  name: string;
  cas_number: string | null;
  category: string | null;
  created_at: string;
};

export type CoaDocument = {
  id: string;
  ingredient_id: string;
  lab_name: string | null;
  batch_lot: string | null;
  document_url: string | null;
  tested_at: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
};

export type CoaCompoundResult = {
  id: string;
  coa_id: string;
  compound_id: string;
  value: number | null;
  unit: string;
  is_nd: boolean;
  qualifier: string | null;
};
