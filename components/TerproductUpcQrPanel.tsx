"use client";

import { useCallback, useMemo, useState } from "react";

import { PlantQrField } from "@/components/PlantQrField";
import { terpediaUpcQueryUrl } from "@/lib/terpedia/terpedia-urls";

const SAMPLE_UPC = "0038000100096";

export function TerproductUpcQrPanel() {
  const [upc, setUpc] = useState(SAMPLE_UPC);
  const [log, setLog] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const qrUrl = useMemo(
    () => (upc.trim() ? terpediaUpcQueryUrl(upc) : ""),
    [upc],
  );

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
      logLine(`Scanned ${b.format}: ${value} → ${terpediaUpcQueryUrl(value)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logLine(`Scan: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [logLine]);

  return (
    <div className="mt-5 flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Builds a <strong>plant</strong> label QR on Terpedia that opens{" "}
        <code className="rounded bg-zinc-200/60 px-1.5 text-[12px] dark:bg-zinc-800">/?u=…</code> with
        the UPC. Same layout as the Field screen’s “Plant label.”
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

      {qrUrl ? <PlantQrField text={qrUrl} onLog={logLine} /> : null}

      {log ? (
        <pre className="w-full overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          {log}
        </pre>
      ) : null}
    </div>
  );
}
