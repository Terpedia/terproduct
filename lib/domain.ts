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
  created_at: string;
  updated_at: string;
};

export type Ingredient = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type ProductIngredient = {
  id: string;
  product_id: string;
  ingredient_id: string;
  sort_order: number;
  notes: string | null;
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
