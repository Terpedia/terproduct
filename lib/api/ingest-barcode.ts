/**
 * Call `supabase/functions/ingest-barcode` to upsert product + ingredients from
 * a validated GTIN, GS1 check digit, and Open Food Facts.
 * Requires a deployed function and, on the server, `TERPRODUCT_INGEST_KEY` if you set that secret.
 */
export type IngestBarcodeResult =
  | {
      ok: true;
      productId: string;
      slug?: string;
      gtin?: string;
      ingredientsCount: number;
      source?: { gs1Gtin: string; gs1CheckDigit: string; openFoodFacts: string };
    }
  | { ok: false; status: number; error: string; body?: string };

const fnPath = () => "functions/v1/ingest-barcode";

function base() {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u) return "";
  return u.replace(/\/$/, "");
}

export function isIngestBarcodeConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function ingestBarcodeToCatalog(gtin: string): Promise<IngestBarcodeResult> {
  if (!isIngestBarcodeConfigured()) {
    return {
      ok: false,
      status: 0,
      error: "Supabase is not configured (set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    };
  }
  const url = `${base()}/${fnPath()}`;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const publicIngest = process.env.NEXT_PUBLIC_TERPRODUCT_INGEST_KEY;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(publicIngest ? { "X-Terproduct-Ingest-Key": publicIngest } : {}),
    },
    body: JSON.stringify({ gtin: gtin.replace(/\D/g, "") }),
  });
  const text = await res.text();
  if (!res.ok) {
    let errMsg = "Ingest failed";
    try {
      const o = JSON.parse(text) as { error?: string };
      if (o?.error && typeof o.error === "string") errMsg = o.error;
    } catch {
      /* use default */
    }
    return { ok: false, status: res.status, error: errMsg, body: text };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as { ok?: boolean; error?: string; productId?: string };
  } catch {
    return { ok: false, status: res.status, error: "Invalid JSON from ingest" };
  }
  const p = parsed as {
    ok?: boolean;
    error?: string;
    productId?: string;
    slug?: string;
    gtin?: string;
    ingredientsCount?: number;
    source?: { gs1Gtin: string; gs1CheckDigit: string; openFoodFacts: string };
  };
  if (p && typeof p === "object" && p.ok) {
    return {
      ok: true,
      productId: p.productId as string,
      slug: p.slug,
      gtin: p.gtin,
      ingredientsCount: p.ingredientsCount ?? 0,
      source: p.source,
    };
  }
  return {
    ok: false,
    status: res.status,
    error: (p as { error?: string }).error || "Unknown",
    body: text,
  };
}
