import { getPool } from "@/lib/data/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Literature = {
  title?: string;
  url?: string;
  pmid?: string;
  doi?: string;
  journal?: string;
  publishedAt?: string;
  citationType?: string;
  notes?: string;
};

type CompoundLink = {
  name?: string;
  casNumber?: string;
  category?: string;
  relationship?: string;
  evidenceLevel?: string;
  sourceUrl?: string;
  notes?: string;
  literature?: Literature[];
};

type IngredientInput = {
  name?: string;
  asListed?: string;
  notes?: string;
  compounds?: CompoundLink[];
};

type ProductInput = {
  name?: string;
  brand?: string;
  slug?: string;
  gtin?: string;
  description?: string;
  ingredients?: IngredientInput[];
  labelLines?: string[];
  provenance?: {
    sourceType?: string;
    sourceUrl?: string;
    sourceName?: string;
    capturedAt?: string;
    agent?: string;
    traceId?: string;
    evidence?: Record<string, unknown>;
  };
};

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

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function makeSlug(brand: string, name: string, gtin: string): string {
  const base = [brand, name].filter(Boolean).join(" ");
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
  return `${slug || "product"}${gtin ? `-${gtin.slice(-4)}` : ""}`.slice(0, 96);
}

function validUrl(value: unknown): string | null {
  const candidate = text(value, 1000);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? candidate : null;
  } catch {
    return null;
  }
}

function normalizeInputs(body: ProductInput) {
  const product = body && typeof body === "object" ? body : {};
  const name = text(product.name, 300);
  const brand = text(product.brand, 200);
  const gtin = text(product.gtin, 32).replace(/\D/g, "");
  const ingredients = Array.isArray(product.ingredients)
    ? product.ingredients.slice(0, 200).map((item) => ({
        name: text(item?.name, 300),
        asListed: text(item?.asListed, 300),
        notes: text(item?.notes, 2000),
        compounds: Array.isArray(item?.compounds)
          ? item.compounds.slice(0, 100).map((compound) => ({
              name: text(compound?.name, 300),
              casNumber: text(compound?.casNumber, 64),
              category: text(compound?.category, 120),
              relationship: text(compound?.relationship, 120) || "reported_or_expected",
              evidenceLevel: text(compound?.evidenceLevel, 80) || "inference",
              sourceUrl: validUrl(compound?.sourceUrl),
              notes: text(compound?.notes, 2000),
              literature: Array.isArray(compound?.literature)
                ? compound.literature.slice(0, 100).map((citation) => ({
                    title: text(citation?.title, 500),
                    url: validUrl(citation?.url),
                    pmid: text(citation?.pmid, 32),
                    doi: text(citation?.doi, 200),
                    journal: text(citation?.journal, 300),
                    publishedAt: text(citation?.publishedAt, 32),
                    citationType: text(citation?.citationType, 80) || "supporting",
                    notes: text(citation?.notes, 2000),
                  })).filter((citation) => citation.title && citation.url)
                : [],
            })).filter((compound) => compound.name)
          : [],
      })).filter((ingredient) => ingredient.name)
    : [];
  return {
    name,
    brand,
    gtin,
    slug: text(product.slug, 96) || makeSlug(brand, name, gtin),
    description: text(product.description, 4000),
    ingredients,
    labelLines: Array.isArray(product.labelLines) ? product.labelLines.slice(0, 300).map((line) => text(line, 500)).filter(Boolean) : [],
    provenance: {
      sourceType: text(product.provenance?.sourceType, 120) || "label_image",
      sourceUrl: validUrl(product.provenance?.sourceUrl),
      sourceName: text(product.provenance?.sourceName, 300),
      capturedAt: text(product.provenance?.capturedAt, 64),
      agent: text(product.provenance?.agent, 120),
      traceId: text(product.provenance?.traceId, 120),
      evidence: product.provenance?.evidence && typeof product.provenance.evidence === "object" ? product.provenance.evidence : {},
    },
  };
}

export async function OPTIONS() {
  return json({ ok: true });
}

export async function POST(req: Request) {
  const ingestKey = process.env.TERPRODUCT_INGEST_KEY;
  if (!ingestKey) return json({ error: "TERPRODUCT_INGEST_KEY is not configured on this server." }, 503);
  if (req.headers.get("x-terproduct-ingest-key") !== ingestKey) return json({ error: "Unauthorized" }, 401);
  if (!process.env.DATABASE_URL) return json({ error: "DATABASE_URL is not configured on this server." }, 500);

  let input: ProductInput;
  try { input = (await req.json()) as ProductInput; } catch { return json({ error: "Invalid JSON" }, 400); }
  const product = normalizeInputs(input);
  if (!product.name) return json({ error: "product.name is required" }, 400);
  if (product.ingredients.length === 0) return json({ error: "At least one ingredient is required" }, 400);

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const existing = product.gtin
      ? await client.query<{ id: string; slug: string }>("select id::text, slug from products where gtin = $1 limit 1", [product.gtin])
      : await client.query<{ id: string; slug: string }>("select id::text, slug from products where slug = $1 limit 1", [product.slug]);
    let productId: string;
    let slug = existing.rows[0]?.slug || product.slug;
    if (existing.rows[0]) {
      productId = existing.rows[0].id;
      await client.query("update products set name=$1, brand=$2, description=$3, gtin=coalesce(nullif($4,''),gtin), updated_at=now() where id=$5::uuid", [product.name, product.brand || null, product.description || null, product.gtin, productId]);
    } else {
      const inserted = await client.query<{ id: string; slug: string }>("insert into products (slug,name,brand,description,gtin) values ($1,$2,$3,$4,nullif($5,'')) returning id::text, slug", [slug, product.name, product.brand || null, product.description || null, product.gtin]);
      productId = inserted.rows[0].id;
      slug = inserted.rows[0].slug;
    }

    await client.query("delete from product_ingredients where product_id=$1::uuid", [productId]);
    await client.query("delete from product_label_ingredient_lines where product_id=$1::uuid", [productId]);
    const ingredientIds = new Set<string>();
    let compoundLinks = 0;
    let literatureLinks = 0;

    for (let index = 0; index < product.ingredients.length; index++) {
      const item = product.ingredients[index];
      const found = await client.query<{ id: string }>("select id::text from ingredients where lower(name)=lower($1) limit 1", [item.name]);
      const ingredient = found.rows[0] || (await client.query<{ id: string }>("insert into ingredients (name,description) values ($1,$2) returning id::text", [item.name, item.notes || null])).rows[0];
      if (!ingredient) continue;
      ingredientIds.add(ingredient.id);
      await client.query("insert into product_ingredients (product_id,ingredient_id,sort_order,as_listed,notes) values ($1::uuid,$2::uuid,$3,$4,$5)", [productId, ingredient.id, index + 1, item.asListed || item.name, item.notes || null]);
      await client.query("insert into product_label_ingredient_lines (product_id,line_index,raw_text,resolved_ingredient_id,notes) values ($1::uuid,$2,$3,$4::uuid,$5)", [productId, index, item.asListed || item.name, ingredient.id, item.notes || null]);

      for (const link of item.compounds) {
        const compoundRow = (await client.query<{ id: string }>("select id::text from compounds where lower(name)=lower($1) limit 1", [link.name])).rows[0]
          || (await client.query<{ id: string }>("insert into compounds (name,cas_number,category) values ($1,$2,$3) returning id::text", [link.name, link.casNumber || null, link.category || null])).rows[0];
        if (!compoundRow) continue;
        await client.query("insert into ingredient_compounds (ingredient_id,compound_id,relationship,evidence_level,source_url,notes) values ($1::uuid,$2::uuid,$3,$4,$5,$6) on conflict (ingredient_id,compound_id) do update set relationship=excluded.relationship,evidence_level=excluded.evidence_level,source_url=excluded.source_url,notes=excluded.notes", [ingredient.id, compoundRow.id, link.relationship, link.evidenceLevel, link.sourceUrl, link.notes || null]);
        compoundLinks++;
        for (const citation of link.literature) {
          await client.query("insert into compound_literature (compound_id,title,url,pmid,doi,journal,published_at,citation_type,notes) values ($1::uuid,$2,$3,$4,$5,$6,nullif($7,'')::date,$8,$9) on conflict (compound_id,url) do update set title=excluded.title,pmid=excluded.pmid,doi=excluded.doi,journal=excluded.journal,published_at=excluded.published_at,citation_type=excluded.citation_type,notes=excluded.notes", [compoundRow.id, citation.title, citation.url, citation.pmid || null, citation.doi || null, citation.journal || null, citation.publishedAt || "", citation.citationType, citation.notes || null]);
          literatureLinks++;
        }
      }
    }

    for (let index = 0; index < product.labelLines.length; index++) {
      const line = product.labelLines[index];
      await client.query("insert into product_label_ingredient_lines (product_id,line_index,raw_text,notes) values ($1::uuid,$2,$3,$4) on conflict (product_id,line_index) do update set raw_text=excluded.raw_text,notes=excluded.notes", [productId, product.ingredients.length + index, line, "Captured from submitted product evidence."]);
    }
    await client.query("insert into product_sources (product_id,source_type,source_url,source_name,captured_at,agent,trace_id,evidence_json) values ($1::uuid,$2,$3,$4,nullif($5,'')::timestamptz,$6,$7,$8::jsonb) on conflict (product_id,source_type,source_url) do update set source_name=excluded.source_name,captured_at=excluded.captured_at,agent=excluded.agent,trace_id=excluded.trace_id,evidence_json=excluded.evidence_json", [productId, product.provenance.sourceType, product.provenance.sourceUrl, product.provenance.sourceName || null, product.provenance.capturedAt || "", product.provenance.agent || null, product.provenance.traceId || null, JSON.stringify(product.provenance.evidence)]);
    await client.query("commit");
    return json({ ok: true, productId, slug, url: `https://terproduct.terpedia.com/product/${encodeURIComponent(slug)}`, ingredientsCount: ingredientIds.size, compoundLinks, literatureLinks });
  } catch (error) {
    await client.query("rollback");
    return json({ error: error instanceof Error ? error.message : "Product ingest failed" }, 500);
  } finally { client.release(); }
}
