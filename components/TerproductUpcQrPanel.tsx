"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PlantQrField } from "@/components/PlantQrField";
import { terpediaUpcParamUrl } from "@/lib/terpedia/terpedia-urls";

const SAMPLE_UPC = "0038000100096";

export function TerproductUpcQrPanel() {
  const searchParams = useSearchParams();
  /** Raw payload for the plant QR (full URL or string). Overrides UPC→Terpedia link when set. */
  const lockedEncode = searchParams.get("text") ?? searchParams.get("to") ?? searchParams.get("q");
  const lockedUpc = searchParams.get("u");

  const [upc, setUpc] = useState(() => lockedUpc?.trim() || SAMPLE_UPC);
  const [log, setLog] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const autoBuild = searchParams.get("auto") === "1" || searchParams.get("build") === "1";
  const autoPrint = searchParams.get("print") === "1";
  /** Roll / thermal layout (−90°), matches {@link PlantQrField} checkbox */
  const initialHorizontal =
    searchParams.get("horizontal") === "1" || searchParams.get("roll") === "1";

  const qrUrl = useMemo(() => {
    const lock = lockedEncode?.trim();
    if (lock) {
      return lock;
    }
    return upc.trim() ? terpediaUpcParamUrl(upc) : "";
  }, [lockedEncode, upc]);

  const logLine = useCallback((s: string) => {
    setLog((l) => `${l}\n${s}`.trim());
  }, []);

  const runScan = useCallback(async () => {
    setBusy(true);
    try {
      const { BarcodeScanner, BarcodeFormat } = await import(
        "@capacitor-mlkit/barcode-scanning"
      );
      await BarcodeScanner.requestPermissions();
      const res = await BarcodeScanner.scan({
        formats: [
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.Code128,
        ],
      });
      const b = res.barcodes[0];
      if (!b) {
        logLine("No code detected.");
        return;
      }
      const value = b.rawValue ?? b.displayValue;
      setUpc(value);
      logLine(`Scanned ${b.format}: ${value} → ${terpediaUpcParamUrl(value)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logLine(`Scan: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [logLine]);

  return (
    <div className="mt-5 flex flex-col gap-4">
      {lockedEncode?.trim() ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          Link opened with <code className="text-[11px]">text=</code>/<code className="text-[11px]">q=</code>
          — the field below encodes that URL/string directly (not the UPC box).
        </p>
      ) : null}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Builds a <strong>plant</strong> label QR that opens Terpedia with{" "}
        <code className="rounded bg-zinc-200/60 px-1.5 text-[12px] dark:bg-zinc-800">/?upc=…</code>{" "}
        (UPC in the query). Same layout as the Field screen’s “Plant label.”
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-sm">
          <span className="block font-medium text-zinc-800 dark:text-zinc-200">UPC / symbol</span>
          <input
            type="text"
            value={upc}
            onChange={(e) => setUpc(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="E.g. 0038000100096"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runScan()}
          className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "…" : "Scan barcode"}
        </button>
      </div>

      {qrUrl ? (
        <label className="text-sm">
          <span className="block font-medium text-zinc-700 dark:text-zinc-300">Encodes (preview)</span>
          <code className="mt-1 block break-all rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200">
            {qrUrl}
          </code>
        </label>
      ) : (
        <p className="text-sm text-amber-800 dark:text-amber-200">Enter a UPC to build the link.</p>
      )}

      {qrUrl ? (
        <PlantQrField
          text={qrUrl}
          onLog={logLine}
          initialHorizontal={initialHorizontal}
          autoBuild={autoBuild}
          autoPrint={autoPrint}
        />
      ) : null}

      {log ? (
        <pre className="w-full overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          {log}
        </pre>
      ) : null}
    </div>
  );
}
