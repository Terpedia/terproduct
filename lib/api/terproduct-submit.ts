import type { UpcIngredientsCorrelation } from "@/lib/commercial-upc";

export type TerproductIngestEvent =
  | {
      event: "upc_scanned" | "product_id" | "ingredient_lot" | "custom";
      value: string;
      /** e.g. QR_CODE, UPC_A, EAN_13, CODE_128 */
      format?: string;
      idempotencyKey?: string;
      /** When set, a QR label is intended to point here (e.g. terpedia public URL for the entity). */
      qrUrl?: string;
      meta?: Record<string, string>;
    }
  | UpcIngredientsCorrelation;

const apiUrl = () => process.env.NEXT_PUBLIC_TERPRODUCT_API_URL || "";

/**
 * POST JSON to your API (e.g. Supabase Edge, Cloudflare Worker, or terproduct.terpedia.com API).
 * Fails with a clear message if `NEXT_PUBLIC_TERPRODUCT_API_URL` is not configured.
 */
export async function submitTerproductEvent(
  body: TerproductIngestEvent,
): Promise<{ ok: boolean; status: number; text: string }> {
  const base = apiUrl().replace(/\/$/, "");
  if (!base) {
    return { ok: false, status: 0, text: "Set NEXT_PUBLIC_TERPRODUCT_API_URL in your build (ingest API base URL)." };
  }
  const res = await fetch(`${base}/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.NEXT_PUBLIC_TERPRODUCT_API_KEY
        ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_TERPRODUCT_API_KEY}` }
        : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}
