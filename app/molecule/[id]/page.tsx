import Link from "next/link";
import { notFound } from "next/navigation";

import { getCompoundById, hasCatalog } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";

export default async function MoleculePage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasCatalog()) notFound();
  const { id } = await params;
  const molecule = await getCompoundById(id);
  if (!molecule) notFound();
  return (
    <main className="mx-auto min-h-full max-w-3xl space-y-8 px-6 py-12">
      <nav><Link className="text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-300" href="/">← Terproduct</Link></nav>
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Molecule</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{molecule.name}</h1>
        {molecule.summary ? <p className="text-zinc-700 dark:text-zinc-300">{molecule.summary}</p> : null}
        <dl className="grid gap-2 text-sm text-zinc-600 dark:text-zinc-400 sm:grid-cols-3">
          {molecule.molecular_formula ? <div><dt className="font-semibold">Formula</dt><dd>{molecule.molecular_formula}</dd></div> : null}
          {molecule.inchikey ? <div><dt className="font-semibold">InChIKey</dt><dd className="break-all font-mono">{molecule.inchikey}</dd></div> : null}
          {molecule.smiles ? <div><dt className="font-semibold">SMILES</dt><dd className="break-all font-mono">{molecule.smiles}</dd></div> : null}
        </dl>
      </header>
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950" aria-labelledby="bioactivity-heading">
        <h2 id="bioactivity-heading" className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Organism and bioactivity evidence</h2>
        {molecule.bioactivities.length === 0 ? <p className="mt-4 text-zinc-600 dark:text-zinc-400">No organism-specific bioactivity has been recorded yet.</p> : (
          <ul className="mt-4 space-y-4">
            {molecule.bioactivities.map((activity) => <li key={activity.id} className="border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-800">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{activity.activity_type}{activity.target_name ? ` · ${activity.target_name}` : ""}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{activity.organism_name || activity.organism_id || "Organism not specified"}{activity.activity_value != null ? ` · ${activity.activity_value}${activity.activity_unit ? ` ${activity.activity_unit}` : ""}` : ""}</p>
              <p className="mt-1 text-xs text-zinc-500">{activity.source} · {activity.evidence_level}{activity.provenance_url ? <> · <a className="text-emerald-700 hover:underline dark:text-emerald-400" href={activity.provenance_url} rel="noreferrer">source</a></> : null}</p>
            </li>)}
          </ul>
        )}
      </section>
    </main>
  );
}
