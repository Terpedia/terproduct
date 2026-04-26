/** Aligned with `lib/gtin.ts` — keep in sync when that file changes. */

export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

export function parseProductGtin(input: string): string | null {
  const d = digitsOnly(input);
  if (![8, 12, 13, 14].includes(d.length)) return null;
  return d;
}
