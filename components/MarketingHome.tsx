import Link from "next/link";

import { publicBasePath } from "@/lib/public-base";

import type { ProductRow } from "@/lib/data/types";

function HomeTopNav() {
  const b = publicBasePath();
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href={`${b}/scan/`}
        className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-800"
      >
        Scan products
      </Link>
      <Link
        href={`${b}/lookup/`}
        className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
      >
        Lookup
      </Link>
      <Link
        href={`${b}/field/`}
        className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
      >
        Field
      </Link>
    </div>
  );
}

function DataModelSection() {
  return (
    <section
      aria-labelledby="model-heading"
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 id="model-heading" className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Data model
      </h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
        <li>
          <strong className="font-medium text-zinc-900 dark:text-zinc-100">Products</strong> — finished
          goods you sell or track.
        </li>
        <li>
          <strong className="font-medium text-zinc-900 dark:text-zinc-100">Ingredients</strong> — materials
          in each product; CoAs attach at the ingredient (lot) level. Analysis links on ingredient pages
          when{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">terpedia_analysis_url</code> is set.
        </li>
        <li>
          <strong className="font-medium text-zinc-900 dark:text-zinc-100">CoA</strong> — lab reports for
          an ingredient batch, with metadata and document links.
        </li>
        <li>
          <strong className="font-medium text-zinc-900 dark:text-zinc-100">Compounds</strong> — canonical
          analytes; each CoA stores quantitative results per compound.
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
  );
}

export function MarketingHome() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-10 px-6 py-16">
      <HomeTopNav />
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-400">
          Terpedia
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Terproduct
        </h1>
        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          A structured catalog of products, their ingredients, certificates of analysis (CoA), and measured
          compounds—so formulation and compliance traceability stay aligned.
        </p>
      </header>
      <DataModelSection />
    </main>
  );
}

export function CatalogHome({ products }: { products: ProductRow[] }) {
  const b = publicBasePath();
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-10 px-6 py-16">
      <HomeTopNav />
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-400">
          Terpedia
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Terproduct catalog
        </h1>
        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Product pages list ingredients; ingredient pages can link to Terpene and analysis on Terpedia.
        </p>
      </header>

      <section
        aria-labelledby="catalog-heading"
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 id="catalog-heading" className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Products
        </h2>
        {products.length === 0 ? (
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">No products in the database yet.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-zinc-800 dark:text-zinc-200">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  className="font-medium text-emerald-800 hover:underline dark:text-emerald-300"
                  href={`${b}/product/${p.slug}/`}
                >
                  {p.name}
                </Link>
                {p.brand ? (
                  <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-500">— {p.brand}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <DataModelSection />
    </main>
  );
}

export function NoSupabaseCallout() {
  return (
    <section
      className="mx-6 my-0 max-w-2xl self-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
      role="status"
    >
      <p className="font-medium">Catalog is not configured</p>
      <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
        Set <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (and apply
        Supabase migrations + RLS) to list products and link ingredients to Terpedia analysis.
      </p>
    </section>
  );
}
