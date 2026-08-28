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
  organisms: IngredientOrganism[];
  molecules: CompoundRow[];
};

export type CompoundRow = {
  id: string;
  name: string;
  slug: string | null;
  summary: string | null;
  smiles: string | null;
  inchikey: string | null;
  molecular_formula: string | null;
  relationship: string;
  evidence_level: string;
  source_url: string | null;
};

export type BioactivityRow = {
  id: string;
  organism_id: string | null;
  organism_name: string | null;
  target_id: string | null;
  target_name: string | null;
  activity_type: string;
  activity_value: number | null;
  activity_unit: string | null;
  assay_system: string | null;
  evidence_level: string;
  source: string;
  source_record_id: string | null;
  provenance_url: string | null;
  notes: string | null;
};

export type IngredientOrganism = {
  id: string;
  organism_id: string;
  organism_name: string;
  organism_url: string | null;
  relationship: string;
  source: string;
  source_record_id: string | null;
  evidence_note: string | null;
  provenance_url: string | null;
};
