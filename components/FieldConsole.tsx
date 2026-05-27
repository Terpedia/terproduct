"use client";

import { useCallback, useEffect, useState } from "react";

import { ingestBarcodeToCatalog } from "@/lib/api/ingest-barcode";
import { assertValidGtinScannedOrTyped } from "@/lib/integrations/gs1-gtin";
import { escposQrCodeAscii } from "@/lib/printing/escpos-qr";
import { shareOrDownloadQrPng } from "@/lib/printing/share-qr-png";
import { terpediaCatalogProductUrl, terpediaProductPageUrl } from "@/lib/terpedia/terpedia-urls";

type Platform = "web" | "ios" | "android" | "unknown";

export function FieldConsole() {
  const [lastScan, setLastScan] = useState<{
    value: string;
    format: string;
  } | null>(null);
  const [log, setLog] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [qrText, setQrText] = useState(() => terpediaProductPageUrl("0038000100096"));
  const setTerpediaProductUrl = useCallback((rawId: string) => {
    setQrText(terpediaProductPageUrl(rawId));
  }, []);
  const [androidPrinter, setAndroidPrinter] = useState("");
  const [pairList, setPairList] = useState<Array<{ name: string; address: string }>>([]);
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    void import("@capacitor/core").then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) {
        setPlatform("web");
        return;
      }
      setPlatform(Capacitor.getPlatform() as Platform);
    });
  }, []);

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
          BarcodeFormat.QrCode,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
        ],
      });
      const b = res.barcodes[0];
      if (!b) {
        logLine("No code detected.");
        return;
      }
      const value = b.rawValue ?? b.displayValue;
      setLastScan({ value, format: b.format });
      setTerpediaProductUrl(value);
      logLine(`Scanned ${b.format}: ${value}`);
      const { gtin, valid } = assertValidGtinScannedOrTyped(value);
      if (!gtin) {
        logLine("Scan is not a UPC/EAN GTIN; using the generic product query URL for the QR.");
        return;
      }
      if (!valid) {
        logLine("GTIN check digit failed; re-scan before printing a product label.");
        return;
      }
      const ingest = await ingestBarcodeToCatalog(gtin);
      if (!ingest.ok) {
        logLine(
          ingest.status === 404
            ? "GTIN is valid, but Open Food Facts / Open Beauty Facts has no product to import yet."
            : `Catalog ingest failed: ${ingest.error}`,
        );
        return;
      }
      if (ingest.slug) {
        const productUrl = terpediaCatalogProductUrl(ingest.slug);
        setQrText(productUrl);
        logLine(`Saved ${ingest.slug}; QR now points to ${productUrl}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logLine(`Scan error: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [logLine, setTerpediaProductUrl]);

  const loadPaired = useCallback(async () => {
    if (typeof window === "undefined") return;
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.getPlatform() !== "android") {
      logLine("Paired devices list is for Android (classic Bluetooth) only.");
      return;
    }
    setBusy(true);
    try {
      const { listPairedForUi } = await import("@/lib/printing/thermal-bluetooth.android");
      const d = await listPairedForUi();
      setPairList(d);
      if (d[0] && !androidPrinter) setAndroidPrinter(d[0].address);
      logLine(`Found ${d.length} paired device(s).`);
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [androidPrinter, logLine]);

  const printAndroidEscPos = useCallback(async () => {
    if (typeof window === "undefined") return;
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.getPlatform() !== "android") {
      logLine("ESC/POS over Bluetooth SPP is wired for Android. Use iOS share for a PNG.");
      return;
    }
    if (!androidPrinter) {
      logLine("Pick a paired printer address (Load paired) or type MAC.");
      return;
    }
    let payload: Uint8Array;
    try {
      payload = escposQrCodeAscii(qrText, { size: 4 });
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
      return;
    }
    setBusy(true);
    try {
      const { printEscPosToPaired } = await import("@/lib/printing/thermal-bluetooth.android");
      await printEscPosToPaired(androidPrinter, payload);
      logLine("Sent ESC/POS to printer.");
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [androidPrinter, logLine, qrText]);

  const sharePng = useCallback(async () => {
    setBusy(true);
    try {
      await shareOrDownloadQrPng(qrText, { title: "Terproduct label", filename: "terproduct-qr" });
      logLine("Shared / downloaded QR PNG.");
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [logLine, qrText]);

  return (
    <main className="mx-auto flex h-[calc(100dvh-7.75rem)] w-full max-w-md flex-col gap-3 overflow-hidden px-3 py-3 md:h-[calc(100dvh-3.5rem)]">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">Terproduct</h1>
          <p className="truncate text-xs text-zinc-500">
            {platform === "unknown" ? "Ready" : platform} · scan, save, print
          </p>
        </div>
        <div
          className={
            busy
              ? "shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100"
              : "shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          }
        >
          {busy ? "Working" : "Ready"}
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-rows-[auto_auto_auto_1fr] gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runScan()}
          className="h-20 rounded-xl bg-emerald-700 text-lg font-semibold text-white shadow-sm active:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "Working..." : "Scan"}
        </button>

        <div className="min-w-0 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
          <p className="text-[11px] font-semibold uppercase text-zinc-500">Last code</p>
          <p className="truncate font-mono text-sm text-zinc-900 dark:text-zinc-100">
            {lastScan ? `${lastScan.format}: ${lastScan.value}` : "No scan yet"}
          </p>
        </div>

        <label className="grid gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          QR URL
          <textarea
            value={qrText}
            onChange={(e) => setQrText(e.target.value)}
            rows={2}
            className="min-h-14 resize-none rounded-lg border border-zinc-300 bg-white px-2.5 py-2 font-mono text-xs font-normal text-zinc-900 outline-none focus:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>

        <div className="grid min-h-0 grid-rows-[auto_auto_1fr] gap-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void loadPaired()}
              className="h-10 rounded-lg border border-zinc-300 bg-zinc-50 text-xs font-semibold text-zinc-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              Printer
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void printAndroidEscPos()}
              className="h-10 rounded-lg bg-zinc-900 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
            >
              Print
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void sharePng()}
              className="h-10 rounded-lg border border-zinc-300 bg-zinc-50 text-xs font-semibold text-zinc-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              Share
            </button>
          </div>

          {pairList.length > 0 ? (
            <select
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              value={androidPrinter}
              onChange={(e) => setAndroidPrinter(e.target.value)}
            >
              {pairList.map((d) => (
                <option key={d.address} value={d.address}>
                  {d.name} - {d.address}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={androidPrinter}
              onChange={(e) => setAndroidPrinter(e.target.value)}
              placeholder="Printer MAC"
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
            />
          )}

          <pre className="min-h-0 overflow-hidden rounded-lg bg-zinc-100 p-2 text-[11px] leading-snug text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {log || "Ready."}
          </pre>
        </div>
      </section>
    </main>
  );
}
