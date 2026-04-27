/**
 * English Wikipedia page summary (REST, read-only) for public ingredient/term blurbs.
 * @see https://en.wikipedia.org/api/rest_v1/
 */
export type WikipediaSummary = {
  title: string;
  displaytitle?: string;
  extract: string;
  pageUrl: string;
  thumbnailUrl: string | null;
};

const UA = "Terproduct/0.1 (terproduct.terpedia.com; public summary only)";

function toTitleParam(raw: string): string {
  const t = raw.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return t;
}

/**
 * Tries a few title variants: exact string, with underscores, Title Case for single words.
 */
export async function fetchWikipediaEnSummary(ingredientOrTerm: string): Promise<WikipediaSummary | null> {
  const raw = toTitleParam(ingredientOrTerm);
  if (!raw) {
    return null;
  }

  const attempts = [raw, raw.replace(/ /g, "_")];
  for (const title of attempts) {
    const u = new URL(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    );
    const res = await fetch(u, {
      headers: { Accept: "application/json", "User-Agent": UA },
      cache: "no-store",
    });
    if (!res.ok) {
      continue;
    }
    const j = (await res.json()) as {
      type?: string;
      title?: string;
      displaytitle?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
      thumbnail?: { source?: string };
    };
    if (j.type === "https://en.wikipedia.org/wiki/NotFound" || j.type === "not_found") {
      continue;
    }
    const ex = (j.extract ?? "").trim();
    if (!ex) {
      continue;
    }
    return {
      title: j.title ?? title,
      displaytitle: j.displaytitle,
      extract: ex,
      pageUrl: j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      thumbnailUrl: j.thumbnail?.source ?? null,
    };
  }
  return null;
}
