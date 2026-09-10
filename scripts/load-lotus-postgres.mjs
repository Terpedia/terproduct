#!/usr/bin/env node
// Stream the LOTUS frozen release into Postgres with COPY. The release is ~674k rows; this
// pulls the gzip straight from Zenodo and pipes it through, so nothing large ships in the
// image and the load is reproducible from a version number.
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";

const RELEASE_FILE = process.env.LOTUS_FILE || "260413_frozen.csv.gz";
const RELEASE_DATE = process.env.LOTUS_RELEASE_DATE || "2026-04-13";
// Read the staged copy in GCS, not Zenodo directly: Zenodo serves a workstation fine but
// returns 403 to the Cloud Run egress range, and a load job should not depend on a third
// party's rate limiting anyway. Restage with:
//   gcloud storage cp <release>.csv.gz gs://<bucket>/lotus/<release>.csv.gz
const BUCKET = process.env.LOTUS_BUCKET || "terpedia-489015-terproduct-migrations";
const source = process.env.LOTUS_URL
  || `https://storage.googleapis.com/${BUCKET}/lotus/${RELEASE_FILE}`;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
// The staged object is not public — the migrations bucket should not be. On Cloud Run the
// job's own service account token comes from the metadata server; locally, gcloud
// credentials via GOOGLE_OAUTH_TOKEN, or an already-public LOTUS_URL.
async function accessToken() {
  if (process.env.GOOGLE_OAUTH_TOKEN) return process.env.GOOGLE_OAUTH_TOKEN;
  try {
    const response = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return null;
    return (await response.json()).access_token || null;
  } catch { return null; }
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("host=/cloudsql/") ? false : { rejectUnauthorized: false },
});

// LOTUS ships plain CSV with quoted fields; organism names contain commas and quotes.
function* parse(line) {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { fields.push(value); value = ""; }
    else value += char;
  }
  fields.push(value);
  yield fields;
}

const escape = (value) => (value === "" || value == null)
  ? "\\N"
  : value.replaceAll("\\", "\\\\").replaceAll("\t", " ").replaceAll("\n", " ").replaceAll("\r", "");

await client.connect();
try {
  console.log(`Loading LOTUS ${RELEASE_FILE} from ${source}…`);
  const token = await accessToken();
  const response = await fetch(source, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!response.ok) throw new Error(`${source} returned ${response.status}`);

  // Truncate and load in one transaction: a failure part-way through a bare truncate+copy
  // leaves the table empty, and this is the only copy of the data the site would read.
  await client.query("begin");
  await client.query("truncate table lotus_occurrences");
  const target = client.query(copyFrom(
    `copy lotus_occurrences (structure_inchikey, organism_name, reference_doi, manual_validation,
       organism_wikidata, structure_wikidata, reference_wikidata, release_date)
     from stdin with (format text, null '\\N')`,
  ));

  let skipped = 0;
  let header = true;
  const rows = new Transform({
    readableObjectMode: false, writableObjectMode: true,
    transform(line, _encoding, done) {
      if (header) { header = false; return done(); }
      if (!line.trim()) return done();
      const [inchikey, organism, doi, validation, organismWd, structureWd, referenceWd] = [...parse(line)][0];
      // An occurrence with no structure or no organism is not an occurrence.
      if (!inchikey?.trim() || !organism?.trim()) { skipped += 1; return done(); }
      done(null, [
        escape(inchikey.trim()), escape(organism.trim()), escape(doi),
        validation === "Y" ? "true" : "false",
        escape(organismWd), escape(structureWd), escape(referenceWd), RELEASE_DATE,
      ].join("\t") + "\n");
    },
  });

  const lines = createInterface({ input: Readable.fromWeb(response.body).pipe(createGunzip()), crlfDelay: Infinity });
  try {
    await pipeline(lines, rows, target);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  const { rows: [summary] } = await client.query(`
    select count(*)::int as triples,
           count(distinct structure_inchikey)::int as structures,
           count(distinct organism_name)::int as organisms,
           count(distinct reference_doi)::int as references
    from lotus_occurrences`);
  console.log(`LOTUS ${RELEASE_DATE}: ${summary.triples.toLocaleString()} triples, ${summary.structures.toLocaleString()} structures, ${summary.organisms.toLocaleString()} organisms, ${summary.references.toLocaleString()} references (${skipped} rows skipped as incomplete).`);
} finally {
  await client.end();
}
