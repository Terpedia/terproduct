/** Digits only; keep 8–14 for grocery / EAN/UPC family. */
export function normalizeGtinInput(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 8 || d.length > 14) {
    return null;
  }
  return d;
}
