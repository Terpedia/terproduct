"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CommercialUpcIngredients } from "@/components/CommercialUpcIngredients";
import { PlantQrField } from "@/components/PlantQrField";
import { submitTerproductEvent, type TerproductIngestEvent } from "@/lib/api/terproduct-submit";
import { escposQrCodeAscii } from "@/lib/printing/escpos-qr";
import { shareOrDownloadQrPng } from "@/lib/printing/share-qr-png";

type Platform = "web" | "ios" | "android" | "unknown";

type SimpleIngestEvent = Extract<
  TerproductIngestEvent,
  { event: "upc_scanned" | "product_id" | "ingredient_lot" | "custom" }
>["event"];

export function FieldConsole() {
  const [lastScan, setLastScan] = useState<{
    value: string;
    format: string;
  } | null>(null);
  const [log, setLog] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [qrText, setQrText] = useState(
    "https://terpedia.com/product/demo",
  );
  const [eventKind, setEventKind] = useState<SimpleIngestEvent>("upc_scanned");
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
      setQrText(value);
      logLine(`Scanned ${b.format}: ${value}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logLine(`Scan error: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [logLine]);

  const runSubmit = useCallback(async () => {
    if (!lastScan) {
      logLine("Scan something first.");
      return;
    }
    setBusy(true);
    try {
      const body: Extract<TerproductIngestEvent, { value: string }> = {
        event: eventKind,
        value: lastScan.value,
        format: lastScan.format,
        qrUrl: /^https?:/i.test(qrText) ? qrText : undefined,
      };
      const r = await submitTerproductEvent(body);
      logLine(r.ok ? `Submitted (HTTP ${r.status})` : `Submit failed: ${r.status} ${r.text}`);
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [eventKind, lastScan, logLine, qrText]);

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
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Field / POS</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Native: ML Kit scan (UPC, QR, Code 128, …) → submit to your ingest API → print a QR
          (Android ESC/POS SPP, iOS share sheet).
        </p>
        {platform !== "unknown" ? (
          <p className="mt-1 text-xs text-zinc-500">
            Capacitor: {platform} {platform === "web" && "(PWA: use in-app browser for native plugins)"}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/device-test/" className="font-medium text-emerald-800 underline dark:text-emerald-300">
            Device test
          </Link>{" "}
          — step-by-step check for camera, barcodes, and Android Bluetooth printer.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runScan()}
          className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Working…" : "Scan barcode (camera)"}
        </button>
        {lastScan ? (
          <p className="text-sm font-mono text-zinc-800 dark:text-zinc-200">
            {lastScan.format}: {lastScan.value}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">No scan yet</p>
        )}
      </div>

      <CommercialUpcIngredients
        lastScan={lastScan}
        onLog={logLine}
        busy={busy}
        setBusy={setBusy}
      />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">QR to print (ASCII URL or ID)</span>
        <textarea
          value={qrText}
          onChange={(e) => setQrText(e.target.value)}
          rows={3}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <p className="text-xs text-zinc-500">
          ESC/POS path requires ASCII. Use https links or short IDs; adjust encoder later for full UTF-8
          with raw-byte Bluetooth writes.
        </p>
      </label>

      <PlantQrField text={qrText} onLog={logLine} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Ingest event</span>
          <select
            value={eventKind}
            onChange={(e) => setEventKind(e.target.value as SimpleIngestEvent)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="upc_scanned">upc_scanned</option>
            <option value="product_id">product_id</option>
            <option value="ingredient_lot">ingredient_lot</option>
            <option value="custom">custom</option>
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !lastScan}
          onClick={() => void runSubmit()}
          className="rounded-xl border border-zinc-300 bg-zinc-50 py-2 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-800"
        >
          Submit to API
        </button>
      </div>

      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <strong className="block">Android: Bluetooth thermal (ESC/POS SPP)</strong>
        <p>Pair the printer in system settings, then load the list and pick a MAC, or paste it.</p>
        <button
          type="button"
          onClick={() => void loadPaired()}
          className="rounded-lg bg-amber-800/10 px-3 py-1.5 text-xs font-medium"
        >
          Load paired
        </button>
        {pairList.length > 0 ? (
          <select
            className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-2 py-2 text-xs dark:border-amber-700 dark:bg-zinc-900"
            value={androidPrinter}
            onChange={(e) => setAndroidPrinter(e.target.value)}
          >
            {pairList.map((d) => (
              <option key={d.address} value={d.address}>
                {d.name} — {d.address}
              </option>
            ))}
          </select>
        ) : null}
        <input
          value={androidPrinter}
          onChange={(e) => setAndroidPrinter(e.target.value)}
          placeholder="00:11:22:33:44:55"
          className="w-full rounded-lg border border-amber-300 bg-white px-2 py-2 font-mono text-xs dark:border-amber-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void printAndroidEscPos()}
          className="w-full rounded-lg bg-amber-800 py-2 text-sm font-semibold text-white"
        >
          Print QR (ESC/POS)
        </button>
        <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
          Integrated POS (Sunmi, etc.) may need a vendor AIDL or USB path instead of SPP — this stack is
          a generic SPP+ESC/POS baseline.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100">
        <strong>iOS: PNG share</strong>
        <p>Exports a QR PNG and opens the system share sheet (e.g. AirDrop to a vendor printer app).</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void sharePng()}
          className="w-full rounded-lg bg-sky-800 py-2 text-sm font-semibold text-white"
        >
          Share QR image
        </button>
      </div>

      <pre className="min-h-24 w-full overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {log || "Logs…"}
      </pre>
    </div>
  );
}
