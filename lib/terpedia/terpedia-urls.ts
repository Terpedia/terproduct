import { publicBasePath } from "@/lib/public-base";

const DEFAULT_ORIGIN = "https://terproduct.terpedia.com";

/**
 * Public site origin for absolute QR URLs. On the client, `window.location.origin` wins.
 */
export function terpediaPublicOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE || DEFAULT_ORIGIN).replace(
    /\/$/,
    "",
  );
}

/**
 * Product deep link: `/?p={id}` (UPC / EAN, METRC tag, ISBN-13, etc.; id is url-encoded when needed).
 */
export function terpediaProductPageUrl(id: string): string {
  const b = publicBasePath();
  const o = terpediaPublicOrigin();
  return `${o}${b || ""}/?p=${encodeURIComponent(id)}`;
}

/**
 * UPC / symbol query link: `/?u={upc}` (handled on the static home page like `?p=`, e.g. GitHub Pages’ `out/index.html`).
 */
export function terpediaUpcQueryUrl(rawUpc: string): string {
  const b = publicBasePath();
  const o = terpediaPublicOrigin();
  return `${o}${b || ""}/?u=${encodeURIComponent(rawUpc.trim())}`;
}

/**
 * Relative path for in-app links (works with `basePath`).
 */
export function terpediaIngredientPath(ingredient: string): string {
  const b = publicBasePath();
  return `${b}/?i=${encodeURIComponent(ingredient)}`;
}
