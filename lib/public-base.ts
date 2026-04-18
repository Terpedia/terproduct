/** Base path for static hosting (e.g. `/terproduct` on GitHub Pages project sites). */
export function publicBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}
