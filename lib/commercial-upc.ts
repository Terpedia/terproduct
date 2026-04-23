/**
 * Payload for correlating a commercial UPC/GTIN with ingredient declaration lines
 * (same product identity on shelf).
 */
export type LabelIngredientLineInput = {
  lineIndex: number;
  /** Text as on the pack (or one token from a comma-separated list). */
  rawText: string;
  /** When the operator has mapped this line to your catalog. */
  resolvedIngredientId?: string;
};

export type UpcIngredientsCorrelation = {
  event: "upc_ingredients_correlation";
  /** Normalized digits (see `parseProductGtin` / `lib/gtin.ts`) */
  gtin: string;
  barcodeFormat?: string;
  /** If you already know the internal `products.id` in your DB. */
  productId?: string;
  labelLines: LabelIngredientLineInput[];
  idempotencyKey?: string;
};
