"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { fetchWikipediaEnSummary, type WikipediaSummary } from "@/lib/integrations/wikipedia";

type Props = { name: string };

type Load = "loading" | "ok" | "notfound" | "error";

export function IngredientTerpediaView({ name }: Props) {
  const [st, setSt] = useState<Load>("loading");
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<WikipediaSummary | null>(null);

  const run = useCallback(async (n: string) => {
    if (!n.trim()) {
      setSt("notfound");
      return;
    }
    setSt("loading");
    setErr(null);
    try {
      const s = await fetchWikipediaEnSummary(n);
      if (!s) {
        setSummary(null);
        setSt("notfound");
        return;
      }
      setSummary(s);
      setSt("ok");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load.");
      setSt("error");
    }
  }, []);

  useEffect(() => {
    void run(name);
  }, [name, run]);

  if (st === "loading") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-zinc-600 dark:text-zinc-400">
        Loading…
      </div>
    );
  }

  if (st === "error") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Ingredient</h1>
        <p className="text-sm text-red-700 dark:text-red-300">{err}</p>
        <Link className="text-sm text-emerald-800 underline dark:text-emerald-400" href="/">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <p className="text-xs text-zinc-500">
        <code className="font-mono text-[11px]">?i=</code> {name}
      </p>
      {st === "notfound" || !summary ? (
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {name || "Unknown term"}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No English Wikipedia summary for this string. Try a simpler name, or open search:
          </p>
          <a
            className="text-sm text-emerald-800 underline dark:text-emerald-400"
            href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}`}
            target="_blank"
            rel="noreferrer"
          >
            Search on Wikipedia
          </a>
        </div>
      ) : (
        <article>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {summary.displaytitle ?? summary.title}
          </h1>
          {summary.thumbnailUrl ? (
            <div className="mt-4 max-w-sm overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="h-auto w-full object-cover"
                src={summary.thumbnailUrl}
                alt=""
                width={320}
                height={200}
              />
            </div>
          ) : null}
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {summary.extract}
          </p>
          <p className="mt-4">
            <a
              className="text-sm text-emerald-800 underline dark:text-emerald-400"
              href={summary.pageUrl}
              target="_blank"
              rel="noreferrer"
            >
              Full article on Wikipedia
            </a>
          </p>
        </article>
      )}
      <p>
        <Link className="text-sm text-emerald-800 underline dark:text-emerald-400" href="/">
          Home
        </Link>
      </p>
    </div>
  );
}
