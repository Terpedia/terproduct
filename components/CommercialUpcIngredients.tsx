"use client";

import { useCallback, useState } from "react";

import { submitTerproductEvent } from "@/lib/api/terproduct-submit";
import type { UpcIngredientsCorrelation } from "@/lib/commercial-upc";
import { parseProductGtin } from "@/lib/gtin";

type Props = {
  lastScan: { value: string; format: string } | null;
  onLog: (s: string) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
};

/**
 * Splits a pasted “Ingredients: …, …” block or one-per-line into ordered rows
 * to correlate with the product identified by the GTIN.
 */
function splitLabelLines(text: string): { lineIndex: number; rawText: string }[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  let parts = trimmed
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (parts.length === 1 && parts[0].includes(",")) {
    parts = parts[0]
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
  }
  return parts.map((rawText, lineIndex) => ({ lineIndex, rawText }));
}

export function CommercialUpcIngredients({ lastScan, onLog, busy, setBusy }: Props) {
  const [gtin, setGtin] = useState("");
  const [labelText, setLabelText] = useState("");
  const [productId, setProductId] = useState("");

  const useLastScan = useCallback(() => {
    if (!lastScan) {
      onLog("Scan a UPC-A, UPC-E, or EAN first, or type a GTIN.");
      return;
    }
    const p = parseProductGtin(lastScan.value);
    if (!p) {
      onLog("Last scan is not 8, 12, 13, or 14 digits. Enter a GTIN manually.");
      return;
    }
    setGtin(p);
    onLog(`GTIN: ${p} (from ${lastScan.format})`);
  }, [lastScan, onLog]);

  const submit = useCallback(async () => {
    const normalized = parseProductGtin(gtin);
    if (!normalized) {
      onLog("Enter 8, 12, 13, or 14 digit GTIN/UPC/EAN (digits only).");
      return;
    }
    const labelLines = splitLabelLines(labelText);
    if (labelLines.length === 0) {
      onLog("Add at least one ingredient line (paste a list or one line per row).");
      return;
    }
    setBusy(true);
    try {
      const body: UpcIngredientsCorrelation = {
        event: "upc_ingredients_correlation",
        gtin: normalized,
        barcodeFormat: lastScan?.format,
        productId: productId.trim() || undefined,
        labelLines,
      };
      const r = await submitTerproductEvent(body);
      onLog(
        r.ok
          ? `upc+ingredients correlation: HTTP ${r.status}`
          : `Submit failed: ${r.status} ${r.text}`,
      );
    } catch (e) {
      onLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [gtin, labelText, lastScan, onLog, productId, setBusy]);

  return (
    <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100">
      <div>
        <h2 className="font-semibold">Commercial: UPC + ingredients</h2>
        <p className="mt-1 text-xs text-violet-800/90 dark:text-violet-200/90">
          Tie a retail <strong>GTIN/UPC</strong> to the product’s <strong>declared ingredient list</strong>. Your
          API can upsert `products.gtin`, then insert `product_label_ingredient_lines` and resolve
          to `ingredients` over time. Post body: event `upc_ingredients_correlation` (see
          `lib/api/terproduct-submit.ts` and the migration
          <code className="mx-1 rounded bg-violet-200/60 px-1 text-[11px] dark:bg-violet-900/80">
            20260423000000_commercial_gtin_ingredients
          </code>
          ).
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium">
          GTIN (digits)
          <input
            value={gtin}
            onChange={(e) => setGtin(e.target.value.replace(/\D/g, ""))}
            placeholder="8500031720240"
            className="w-full rounded-lg border border-violet-300 bg-white px-2 py-2 font-mono text-violet-900 dark:border-violet-600 dark:bg-zinc-900 dark:text-violet-100"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={useLastScan}
          className="shrink-0 rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800"
        >
          Use last scan
        </button>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Product UUID (if you already have one; optional)
        <input
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="rounded-lg border border-violet-300 bg-white px-2 py-2 font-mono text-xs text-violet-900 dark:border-violet-600 dark:bg-zinc-900 dark:text-violet-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Ingredient list (one per line, or one line with commas)
        <textarea
          value={labelText}
          onChange={(e) => setLabelText(e.target.value)}
          rows={5}
          placeholder="Water, Glycerin, Hemp extract, …"
          className="rounded-lg border border-violet-300 bg-white px-2 py-2 text-violet-900 dark:border-violet-600 dark:bg-zinc-900 dark:text-violet-100"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="w-full rounded-lg bg-violet-800 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        Submit UPC + ingredient correlation
      </button>
    </div>
  );
}
