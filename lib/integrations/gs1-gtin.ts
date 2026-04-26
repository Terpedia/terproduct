/**
 * GS1 GTIN family check-digit validation and normalization (8 / 12 / 13 / 14 digits).
 * @see https://www.gs1.org/services/check-digit-calculator
 */

import { parseProductGtin, digitsOnly } from "@/lib/gtin";

/** Left-pad with zeros to 14 (GTIN-14) for keying and GS1 Digital Link. */
export function toGtin14(digits: string): string {
  const d = digitsOnly(digits);
  if (d.length > 14) return d;
  if (d.length < 1) return d;
  return d.padStart(14, "0");
}

/** Mod-10 for GTIN-14: weights 3,1,3,1… from the right over the first 13 digits (left to right in `first13`). */
function checkDigitGtin14(first13: string): number {
  if (first13.length !== 13) return -1;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const n = first13[i]! === "0" ? 0 : parseInt(first13[i]!, 10);
    const fromRight = 12 - i;
    const weight = fromRight % 2 === 0 ? 3 : 1;
    sum += weight * n;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Returns true if the string is 8, 12, 13, or 14 digits and the last digit
 * is the valid GS1 check character for the preceding payload digits.
 */
export function isGtinCheckDigitValid(gtin: string): boolean {
  const d = digitsOnly(gtin);
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const g14 = d.length === 14 ? d : toGtin14(d);
  const payload = g14.slice(0, 13);
  const expected = checkDigitGtin14(payload);
  const last = g14[13]!;
  return (last === "0" ? 0 : parseInt(last, 10)) === expected;
}

/** @returns normalized digits from `parseProductGtin`, or `null` if not plausibly a product GTIN. */
export function assertValidGtinScannedOrTyped(input: string): { gtin: string; gtin14: string; valid: boolean } {
  const gtin = parseProductGtin(input);
  if (!gtin) return { gtin: "", gtin14: "", valid: false };
  const ok = isGtinCheckDigitValid(gtin);
  return { gtin, gtin14: toGtin14(gtin), valid: ok };
}
