"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  fetchOpenFactsProduct,
  offBrand,
  offImageUrl,
  offIngredientLines,
  offProductName,
  type OpenFoodFactsProduct,
  type OpenFactsSource,
} from "@/lib/integrations/open-food-facts";
import { normalizeGtinInput } from "@/lib/scan/normalize-gtin";
import { terpediaIngredientPath } from "@/lib/terpedia/terpedia-urls";

type Props = { id: string; /** Query key shown in the page chrome (`?p=` vs `?u=`). */ linkParam?: "p" | "u" };

type LoadState = "idle" | "loading" | "ok" | "empty" | "error";

function normalizeForOpenFacts(p: string): string {
  const gtin = normalizeGtinInput(p);
  if (gtin) {
    return gtin;
  }
  const d = p.replace(/[^\dXx]/g, "");
  if (d.length === 10 || d.length === 12 || d.length === 13 || d.length === 14) {
    return d;
  }
  return p.trim();
}

export function ProductTerpediaView({ id, linkParam = "p" }: Props) {
  const [state, setState] = useState<LoadState>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [source, setSource] = useState<OpenFactsSource | null>(null);
  const [name, setName] = useState<string>("");
  const [brand, setBrand] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientsText, setIngredientsText] = useState<string | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [extUrl, setExtUrl] = useState<string | null>(null);
  const [code, setCode] = useState<string>(id);

  const load = useCallback(async (raw: string) => {
    if (!raw.trim()) {
      setState("empty");
      return;
    }
    setState("loading");
    setErr(null);
    const n = normalizeForOpenFacts(raw);
    setCode(n);
    try {
      const r = await fetchOpenFactsProduct(n);
      if (r.httpError) {
        setErr("Could not reach the product database.");
        setState("error");
        return;
      }
      if (r.status !== 1 || !r.product) {
        setName(raw);
        setBrand(null);
        setIngredients([]);
        setIngredientsText(null);
        setImg(null);
        setExtUrl(null);
        setSource(null);
        setState("ok");
        return;
      }
      const pr = r.product;
      setSource(r.source);
      setName(offProductName(pr));
      setBrand(offBrand(pr));
      setIngredients(offIngredientLines(pr));
      setIngredientsText(pr.ingredients_text?.trim() || null);
      setImg(offImageUrl(pr) ?? pr.image_url ?? pr.image_front_small_url ?? pr.image_front_url ?? null);
      setExtUrl(
        (pr as { code?: string }).code
          ? r.source === "openbeautyfacts"
            ? `https://world.openbeautyfacts.org/product/${(pr as { code?: string }).code}/`
            : `https://world.openfoodfacts.org/product/${(pr as { code?: string }).code}/`
          : pr.link || null,
      );
      setState("ok");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lookup failed.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load(id);
  }, [id, load]);

  if (state === "idle" || state === "loading") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-zinc-600 dark:text-zinc-400">
        {state === "loading" ? "Loading product…" : "…"}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Product</h1>
        <p className="text-sm text-red-700 dark:text-red-300">{err}</p>
        <Link
          className="text-sm text-emerald-800 underline dark:text-emerald-400"
          href="/"
        >
          Home
        </Link>
      </div>
    );
  }

  const textOnly = ingredients.length === 0 && ingredientsText;
  const linkedFromText = textOnly
    ? offIngredientLines({ ingredients_text: ingredientsText } as OpenFoodFactsProduct)
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        <code className="font-mono text-[11px]">?{linkParam}=</code> {code}
        {source ? <span className="ml-2">· {source}</span> : null}
      </p>
      {img ? (
        <div className="relative mx-auto w-48 max-w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 p-2 dark:border-zinc-700 dark:bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote OFF URLs */}
          <img className="mx-auto h-auto max-h-48 w-full object-contain" src={img} alt="" />
        </div>
      ) : null}
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{name}</h1>
      {brand ? <p className="text-sm text-zinc-600 dark:text-zinc-400">Brand: {brand}</p> : null}
      {ingredients.length > 0 ? (
        <section>
          <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">Ingredients</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {ingredients.map((line) => (
              <li key={line}>
                <Link
                  className="text-emerald-800 hover:underline dark:text-emerald-300"
                  href={terpediaIngredientPath(line)}
                >
                  {line}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : textOnly && linkedFromText.length > 0 ? (
        <section>
          <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">Ingredients</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {linkedFromText.map((line) => (
              <li key={line}>
                <Link
                  className="text-emerald-800 hover:underline dark:text-emerald-300"
                  href={terpediaIngredientPath(line)}
                >
                  {line}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : ingredientsText ? (
        <section>
          <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">Ingredients</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{ingredientsText}</p>
        </section>
      ) : state === "ok" && !ingredientsText ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          No public ingredient data for <span className="font-mono">{id}</span> in Open Food / Open
          Beauty Facts (try another id type or a GTIN-14).
        </p>
      ) : null}
      {extUrl ? (
        <p>
          <a
            className="text-sm text-emerald-800 underline dark:text-emerald-400"
            href={extUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in Open Facts
          </a>
        </p>
      ) : null}
      <p>
        <Link className="text-sm text-emerald-800 underline dark:text-emerald-400" href="/">
          Home
        </Link>
      </p>
    </div>
  );
}
