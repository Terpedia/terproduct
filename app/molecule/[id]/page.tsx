import Link from "next/link";
import { notFound } from "next/navigation";

import { getCompoundById, getCompoundBySlug, hasCatalog, type MoleculeDetail } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const card = "rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950";
const heading = "text-lg font-medium text-zinc-900 dark:text-zinc-50";
const muted = "text-sm text-zinc-600 dark:text-zinc-400";
const link = "text-emerald-700 hover:underline dark:text-emerald-400";

function pubmedSearch(pmids: string[]) {
  return `https://pubmed.ncbi.nlm.nih.gov/?term=${pmids.join(",")}`;
}

export default async function MoleculePage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasCatalog()) notFound();
  const { id } = await params;
  const molecule: MoleculeDetail | null = UUID.test(id)
    ? ((await getCompoundById(id)) as MoleculeDetail | null)
    : await getCompoundBySlug(id);
  if (!molecule) notFound();

  return (
    <main className="mx-auto min-h-full max-w-3xl space-y-8 px-6 py-12">
      <nav><Link className="text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-300" href="/">← Terproduct</Link></nav>

      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Molecule</p>
        <div className="flex flex-wrap items-start gap-6">
          {molecule.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="h-40 w-40 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800" src={molecule.image_url} alt={`Structure of ${molecule.name}`} width={160} height={160} />
          ) : null}
          <div className="min-w-64 flex-1 space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{molecule.name}</h1>
            {molecule.summary ? <p className="text-zinc-700 dark:text-zinc-300">{molecule.summary}</p> : null}
            {molecule.summary_source_name ? (
              <p className="text-xs text-zinc-500">
                Source:{" "}
                {molecule.summary_source_url
                  ? <a className={link} href={molecule.summary_source_url} rel="noreferrer">{molecule.summary_source_name}</a>
                  : molecule.summary_source_name}
                , via PubChem.
              </p>
            ) : null}
          </div>
        </div>
        <dl className={`grid gap-3 ${muted} sm:grid-cols-3`}>
          {molecule.molecular_formula ? <div><dt className="font-semibold">Formula</dt><dd>{molecule.molecular_formula}</dd></div> : null}
          {molecule.molecular_weight != null ? <div><dt className="font-semibold">Molecular weight</dt><dd>{molecule.molecular_weight} g/mol</dd></div> : null}
          {molecule.pubchem_cid ? <div><dt className="font-semibold">PubChem</dt><dd><a className={link} href={`https://pubchem.ncbi.nlm.nih.gov/compound/${molecule.pubchem_cid}`} rel="noreferrer">CID {molecule.pubchem_cid}</a></dd></div> : null}
          {molecule.iupac_name ? <div className="sm:col-span-3"><dt className="font-semibold">IUPAC name</dt><dd>{molecule.iupac_name}</dd></div> : null}
          {molecule.inchikey ? <div className="sm:col-span-2"><dt className="font-semibold">InChIKey</dt><dd className="break-all font-mono">{molecule.inchikey}</dd></div> : null}
          {molecule.smiles ? <div className="sm:col-span-3"><dt className="font-semibold">SMILES</dt><dd className="break-all font-mono">{molecule.smiles}</dd></div> : null}
        </dl>
      </header>

      <section className={card} aria-labelledby="bioactivity-heading">
        <h2 id="bioactivity-heading" className={heading}>Protein interactions</h2>
        {molecule.bioactivities.length === 0 ? <p className={`mt-4 ${muted}`}>No assay records an active result against a named protein target for this compound.</p> : (
          <ul className="mt-4 space-y-4">
            {molecule.bioactivities.map((activity) => (
              <li key={activity.id} className="border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-800">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {activity.provenance_url
                    ? <a className={link} href={activity.provenance_url} rel="noreferrer">{activity.target_name || activity.target_id}</a>
                    : (activity.target_name || activity.target_id)}
                  {activity.activity_value != null ? <span className="ml-2 font-normal text-zinc-600 dark:text-zinc-400">{activity.activity_type} {activity.activity_value} {activity.activity_unit || ""}</span> : null}
                </p>
                <p className={`mt-1 ${muted}`}>{activity.organism_name || "Organism not specified"}{activity.assay_system ? ` · ${activity.assay_system}` : ""}</p>
                <p className="mt-1 text-xs text-zinc-500">{activity.source}{activity.notes ? ` · ${activity.notes}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-zinc-500">Laboratory measurements of the compound at its own doses. They do not describe any product that contains it.</p>
      </section>

      <section className={card} aria-labelledby="disease-heading">
        <h2 id="disease-heading" className={heading}>Disease associations</h2>
        {molecule.diseases.length === 0 ? <p className={`mt-4 ${muted}`}>No disease association is recorded for this compound.</p> : (
          <ul className="mt-4 space-y-4">
            {molecule.diseases.map((disease) => (
              <li key={disease.id} className="border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-800">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {disease.disease_name}
                  {disease.category ? <span className="ml-2 font-normal text-zinc-500">{disease.category}</span> : null}
                </p>
                <p className={`mt-1 ${muted}`}>
                  {disease.kind === "occupational_exposure" ? "Occupational exposure hazard" : "Reported in metabolomics literature"}
                  {disease.pmids.length ? <> · <a className={link} href={pubmedSearch(disease.pmids)} rel="noreferrer">{disease.pmids.length} papers</a></> : null}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {disease.source_url ? <a className={link} href={disease.source_url} rel="noreferrer">{disease.source}</a> : disease.source}
                  {disease.notes ? ` · ${disease.notes}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-zinc-500">
          These are associations recorded for the compound itself. A metabolomics association means it was detected or
          studied in that condition, not that it treats or causes it. An occupational entry describes a hazard of
          exposure. Neither is a therapeutic claim about any product.
        </p>
      </section>

      <section className={card} aria-labelledby="literature-heading">
        <h2 id="literature-heading" className={heading}>Literature</h2>
        {molecule.literature.length === 0 ? <p className={`mt-4 ${muted}`}>No literature records on file for this compound.</p> : (
          <ul className="mt-4 space-y-3">
            {molecule.literature.map((paper) => (
              <li key={paper.id}>
                <a className={`${link} font-medium`} href={paper.url} rel="noreferrer">{paper.title}</a>
                <p className="text-xs text-zinc-500">{[paper.journal, paper.notes, paper.pmid ? `PMID ${paper.pmid}` : null].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
