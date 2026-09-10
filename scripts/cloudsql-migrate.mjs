#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("host=/cloudsql/") ? false : { rejectUnauthorized: false } });
try {
  const sql = await readFile(new URL("./terproduct-all-migrations.sql", import.meta.url), "utf8");
  await pool.query(sql);
  const result = await pool.query("select count(*)::int as tables from information_schema.tables where table_schema = 'public'");
  console.log(JSON.stringify({ status: "migrated", publicTables: result.rows[0].tables }));
} finally {
  await pool.end();
}

if (process.env.IMPORT_CELESTIAL === "true") {
  process.env.CATALOG_FILE = process.env.CATALOG_FILE || "/app/data/celestial-products.json";
  await import("./import-celestial-seasonings.mjs");
}

// LOTUS is pulled from Zenodo at run time rather than bundled: it is ~674k rows and the
// release is versioned, so a rerun reproduces exactly. Skip with IMPORT_LOTUS=false.
if (process.env.IMPORT_LOTUS === "true") {
  await import("./load-lotus-postgres.mjs");
}

// Molecule reference records travel with the image; skip with IMPORT_MOLECULES=false.
if (process.env.IMPORT_MOLECULES !== "false") {
  process.env.MOLECULES_FILE = process.env.MOLECULES_FILE || "/app/data/mondays-molecules.json";
  await import("./ingest-molecules-postgres.mjs");
}
