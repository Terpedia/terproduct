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

export type ProductCoaRow = {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  lab_name: string | null;
  batch_lot: string | null;
  document_url: string | null;
  tested_at: string | null;
  notes: string | null;
  visibility: "public" | "private";
};

export type ProductImageRow = {
  id: string;
  source_url: string;
  source_page_url: string | null;
  alt_text: string | null;
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

export type CompoundChemistry = {
  summary_source_name: string | null;
  summary_source_url: string | null;
  molecular_weight: number | null;
  iupac_name: string | null;
  pubchem_cid: string | null;
  image_url: string | null;
};

/**
 * A condition reported for the compound itself. `kind` is not decoration: a
 * `reported_association` means the compound was detected or studied in that
 * condition, and `occupational_exposure` is a hazard of exposure. Neither is a
 * therapeutic claim, so callers must render the kind alongside the name.
 */
export type CompoundDiseaseRow = {
  id: string;
  disease_slug: string;
  disease_name: string;
  kind: string;
  category: string | null;
  pmids: string[];
  source: string;
  source_url: string | null;
  notes: string | null;
};

export type CompoundLiteratureRow = {
  id: string;
  title: string;
  url: string;
  pmid: string | null;
  journal: string | null;
  notes: string | null;
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
