"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { publicBasePath } from "@/lib/public-base";
import type { SampleProduct } from "@/lib/sample-products";

function normalizeCode(value: string): string {
  return value.replace(/\D/g, "");
}

export function LookupPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("code") || searchParams.get("q") || "";

  const [products, setProducts] = useState<SampleProduct[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const base = publicBasePath();
    void fetch(`${base}/data/products.json`)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load product catalog.");
        return r.json() as Promise<SampleProduct[]>;
      })
      .then(setProducts)
      .catch(() => setLoadError("Could not load product catalog."));
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = normalizeCode(query);
    if (!q) return [];

    return products.filter((p) => {
      if (p.slug.toLowerCase().includes(q)) return true;
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.brand?.toLowerCase().includes(q)) return true;
      if (p.sku?.toLowerCase().includes(q)) return true;
      if (qDigits.length >= 4 && p.barcode?.includes(qDigits)) return true;
      return false;
    });
  }, [products, query]);

  function updateQuery(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    if (trimmed) {
      params.set("code", trimmed);
      params.delete("q");
    } else {
      params.delete("code");
      params.delete("q");
    }
    const qs = params.toString();
    void router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Lookup</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Search by name, slug, SKU, or barcode digits. Data is bundled as static JSON for
          offline-capable demos; swap in your API when ready.
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Search
        <input
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          placeholder="Name, SKU, or barcode…"
          autoComplete="off"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base font-normal text-zinc-900 shadow-sm outline-none ring-emerald-700/30 focus:border-emerald-600 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>

      {loadError ? (
        <p className="text-sm text-red-700 dark:text-red-400">{loadError}</p>
      ) : null}

      {!loadError && query.trim() && results.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No matches.</p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {results.map((p) => (
          <li
            key={p.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-emerald-800 dark:text-emerald-400">
                {p.brand ?? "Unknown brand"}
              </span>
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Slug: {p.slug}</span>
              {p.sku ? (
                <span className="text-sm text-zinc-600 dark:text-zinc-400">SKU: {p.sku}</span>
              ) : null}
              {p.barcode ? (
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Barcode: {p.barcode}</span>
              ) : null}
              {p.notes ? (
                <span className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">{p.notes}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        Tip: from{" "}
        <Link href="/scan/" className="text-emerald-800 underline dark:text-emerald-400">
          Scan
        </Link>
        , open a detected code here with{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">?code=</code>.
      </p>
    </div>
  );
}
