#!/usr/bin/env node
// Load the molecule reference records from the MONDAYS catalog snapshot into the
// Terproduct catalog: chemistry identity, protein assay results, disease associations,
// and literature. Terproduct is the system of record for this; the consumer catalog
// links here rather than carrying it.
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

// The bundled snapshot ships with the image so the Cloud Build migrate job can load it;
// a local run can point at the mondays checkout instead.
const bundled = process.env.MOLECULES_FILE || path.resolve(import.meta.dirname, "../data/mondays-molecules.json");
const moleculeDir = process.env.MOLECULES_DIR || null;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("host=/cloudsql/") ? false : { rejectUnauthorized: false },
});

const SOURCE = "MONDAYS × Terpedia catalog snapshot";
const counts = { compounds: 0, bioactivities: 0, diseases: 0, literature: 0 };

try {
  const molecules = moleculeDir
    ? await Promise.all((await fs.readdir(moleculeDir)).filter((f) => f.endsWith(".json"))
        .map(async (f) => JSON.parse(await fs.readFile(path.join(moleculeDir, f), "utf8"))))
    : JSON.parse(await fs.readFile(bundled, "utf8")).molecules;

  for (const molecule of molecules) {
    const chem = molecule.pubchem || {};

    const { rows } = await pool.query(
      `insert into compounds (name, slug, category, summary, summary_source_name, summary_source_url,
         smiles, inchikey, molecular_formula, molecular_weight, iupac_name, pubchem_cid, image_url)
       values ($1,$2,'terpene',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (name) do update set
         slug = excluded.slug,
         summary = coalesce(excluded.summary, compounds.summary),
         summary_source_name = excluded.summary_source_name,
         summary_source_url = excluded.summary_source_url,
         smiles = coalesce(excluded.smiles, compounds.smiles),
         inchikey = coalesce(excluded.inchikey, compounds.inchikey),
         molecular_formula = coalesce(excluded.molecular_formula, compounds.molecular_formula),
         molecular_weight = coalesce(excluded.molecular_weight, compounds.molecular_weight),
         iupac_name = coalesce(excluded.iupac_name, compounds.iupac_name),
         pubchem_cid = coalesce(excluded.pubchem_cid, compounds.pubchem_cid),
         image_url = coalesce(excluded.image_url, compounds.image_url)
       returning id`,
      [
        molecule.name, molecule.id, chem.description || molecule.summary || null,
        chem.description_source?.name || null, chem.description_source?.url || null,
        chem.smiles || null, chem.inchikey || null, chem.formula || molecule.formula || null,
        chem.molecular_weight ?? null, chem.iupac_name || null,
        chem.cid ? String(chem.cid) : null,
        chem.image_source || null,
      ],
    );
    const compoundId = rows[0].id;
    counts.compounds += 1;

    for (const target of molecule.targets || []) {
      await pool.query(
        `insert into compound_bioactivities (compound_id, organism_name, target_id, target_name,
           activity_type, activity_value, activity_unit, assay_system, evidence_level, source,
           source_record_id, provenance_url, notes, metadata)
         values ($1,$2,$3,$4,$5,$6,'uM',$7,'laboratory_result',$8,$9,$10,$11,$12)
         on conflict (compound_id, source, source_record_id, activity_type, target_id) do update set
           activity_value = excluded.activity_value,
           target_name = excluded.target_name,
           assay_system = excluded.assay_system,
           provenance_url = excluded.provenance_url,
           updated_at = now()`,
        [
          compoundId, target.organism || null, target.accession, target.protein || target.accession,
          target.activity || "activity", target.value_um ?? null, target.assay || null,
          "PubChem BioAssay", target.aid ? String(target.aid) : null, target.url || null,
          target.pmid ? `PMID ${target.pmid}` : null,
          JSON.stringify({ pmid: target.pmid || null, accession: target.accession, name_source: target.source || null }),
        ],
      );
      counts.bioactivities += 1;
    }

    for (const disease of molecule.diseases || []) {
      await pool.query(
        `insert into compound_diseases (compound_id, disease_slug, disease_name, kind, category, pmids, source, source_url, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (compound_id, disease_slug, kind) do update set
           disease_name = excluded.disease_name,
           category = excluded.category,
           pmids = excluded.pmids,
           source_url = excluded.source_url`,
        [
          compoundId, disease.id, disease.disease, disease.kind, disease.category || null,
          disease.pmids || [], disease.source, disease.source_url || null,
          disease.kind === "occupational_exposure"
            ? "Exposure hazard recorded for the compound. Not a statement about any product."
            : "Compound detected or studied in this condition. Not a therapeutic claim.",
        ],
      );
      counts.diseases += 1;
    }

    for (const paper of molecule.literature?.papers || []) {
      await pool.query(
        `insert into compound_literature (compound_id, title, url, pmid, journal, citation_type, notes)
         values ($1,$2,$3,$4,$5,'supporting',$6)
         on conflict (compound_id, url) do update set
           title = excluded.title, journal = excluded.journal`,
        [compoundId, paper.title || paper.pmid, paper.url, paper.pmid || null, paper.journal || null,
         paper.year ? `Published ${paper.year}` : null],
      );
      counts.literature += 1;
    }
  }
  console.log(`${SOURCE}: ${counts.compounds} compounds, ${counts.bioactivities} bioactivities, ${counts.diseases} disease associations, ${counts.literature} literature records.`);
} finally {
  await pool.end();
}
