/**
 * Normalize a scanned retail barcode to digits. Does not verify check digits;
 * for matching you may want a GS1 or internal catalog lookup.
 */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Heuristic: 8, 12, 14, or 13 digits are treated as a GTIN family (UPC-A is 12, EAN-13 is 13).
 * Returns `null` if the string is not plausibly a product barcode.
 */
export function parseProductGtin(input: string): string | null {
  const d = digitsOnly(input);
  if (![8, 12, 13, 14].includes(d.length)) return null;
  return d;
}
