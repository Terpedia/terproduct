export type SampleProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  sku: string | null;
  /** GTIN / UPC / EAN as digits only for scanner matching */
  barcode: string | null;
  notes?: string;
};
