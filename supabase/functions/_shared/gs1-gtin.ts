/** Aligned with `lib/integrations/gs1-gtin.ts` */
import { digitsOnly, parseProductGtin } from "./gtin-digits";

export function toGtin14(digits: string): string {
  const d = digitsOnly(digits);
  if (d.length > 14) return d;
  if (d.length < 1) return d;
  return d.padStart(14, "0");
}

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

export function isGtinCheckDigitValid(gtin: string): boolean {
  const d = digitsOnly(gtin);
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const g14 = d.length === 14 ? d : toGtin14(d);
  const expected = checkDigitGtin14(g14.slice(0, 13));
  const last = g14[13]!;
  return (last === "0" ? 0 : parseInt(last, 10)) === expected;
}

export function assertValidGtinScannedOrTyped(input: string): { gtin: string; gtin14: string; valid: boolean } {
  const gtin = parseProductGtin(input);
  if (!gtin) return { gtin: "", gtin14: "", valid: false };
  const ok = isGtinCheckDigitValid(gtin);
  return { gtin, gtin14: toGtin14(gtin), valid: ok };
}
