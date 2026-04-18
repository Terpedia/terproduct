import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/scan/"
          className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-800"
        >
          Scan products
        </Link>
        <Link
          href="/lookup/"
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Lookup
        </Link>
      </div>

      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-400">
          Terpedia
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Terproduct
        </h1>
        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          A structured catalog of products, their ingredients, certificates of
          analysis (CoA), and measured compounds—so formulation and compliance
          traceability stay aligned.
        </p>
      </header>

      <section
        aria-labelledby="model-heading"
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 id="model-heading" className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Data model
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">
              Products
            </strong>{" "}
            — finished goods you sell or track.
          </li>
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">
              Ingredients
            </strong>{" "}
            — materials in each product; CoAs attach at the ingredient (lot)
            level.
          </li>
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">
              CoA
            </strong>{" "}
            — lab reports for an ingredient batch, with metadata and document
            links.
          </li>
          <li>
            <strong className="font-medium text-zinc-900 dark:text-zinc-100">
              Compounds
            </strong>{" "}
            — canonical analytes; each CoA stores quantitative results per
            compound.
          </li>
        </ol>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-500">
          Schema SQL lives in{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            supabase/migrations/
          </code>
          ; TypeScript shapes in{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            lib/domain.ts
          </code>
          .
        </p>
      </section>
    </main>
  );
}
