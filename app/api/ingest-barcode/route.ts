import { hasDatabaseUrl } from "@/lib/data/postgres";
import { ingestBarcodeToPostgres } from "@/lib/api/catalog-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: object, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type, x-terproduct-ingest-key",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export async function OPTIONS() {
  return json({ ok: true });
}

export async function POST(req: Request) {
  const ingestKey = process.env.TERPRODUCT_INGEST_KEY;
  if (ingestKey && req.headers.get("x-terproduct-ingest-key") !== ingestKey) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!hasDatabaseUrl()) {
    return json({ error: "DATABASE_URL is not configured on this server." }, 500);
  }

  let body: { gtin?: string };
  try {
    body = (await req.json()) as { gtin?: string };
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const result = await ingestBarcodeToPostgres(typeof body.gtin === "string" ? body.gtin : "");
  if (!result.ok) {
    return json(result, result.status);
  }
  return json(result);
}
