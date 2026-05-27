/**
 * Call the Terproduct barcode ingest endpoint to upsert product + ingredients from
 * a validated GTIN, GS1 check digit, and Open Food or Open Beauty Facts.
 * In Cloud Run this is the same-origin `/api/ingest-barcode` route backed by `DATABASE_URL`.
 */
import { publicBasePath } from "@/lib/public-base";

export type IngestBarcodeResult =
  | {
      ok: true;
      productId: string;
      slug?: string;
      gtin?: string;
      ingredientsCount: number;
      source?: {
        gs1Gtin: string;
        gs1CheckDigit: string;
        openFoodFacts?: string;
        openBeautyFacts?: string;
      };
    }
  | { ok: false; status: number; error: string; body?: string };

const sameOriginPath = () => `${publicBasePath()}/api/ingest-barcode/`;

export function isIngestBarcodeConfigured(): boolean {
  return process.env.NEXT_PUBLIC_DISABLE_CATALOG_INGEST !== "1";
}

export async function ingestBarcodeToCatalog(gtin: string): Promise<IngestBarcodeResult> {
  if (!isIngestBarcodeConfigured()) {
    return {
      ok: false,
      status: 0,
      error: "Catalog ingest is disabled for this build.",
    };
  }
  const url = process.env.NEXT_PUBLIC_TERPRODUCT_BARCODE_INGEST_URL || sameOriginPath();
  const publicIngest = process.env.NEXT_PUBLIC_TERPRODUCT_INGEST_KEY;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
    source?: {
      gs1Gtin: string;
      gs1CheckDigit: string;
      openFoodFacts?: string;
      openBeautyFacts?: string;
    };
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
