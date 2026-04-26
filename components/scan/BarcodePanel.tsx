"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ingestBarcodeToCatalog, isIngestBarcodeConfigured } from "@/lib/api/ingest-barcode";
import { assertValidGtinScannedOrTyped } from "@/lib/integrations/gs1-gtin";
import { publicBasePath } from "@/lib/public-base";

const FORMATS = [
  "qr_code",
  "ean_13",
  "ean_8",
  "code_128",
  "upc_a",
  "upc_e",
  "code_39",
  "pdf417",
  "data_matrix",
] as const;

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

function hasBarcodeDetector(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export function BarcodePanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestInfo, setIngestInfo] = useState<string | null>(null);
  const [ingestProductSlug, setIngestProductSlug] = useState<string | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const seenRef = useRef(new Set<string>());
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Detector | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.srcObject = null;
    }
    setStreaming(false);
    detectorRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!hasBarcodeDetector()) {
      setError("Barcode scanning is not supported in this browser. Use manual entry below.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      v.srcObject = stream;
      await v.play();
      const BarcodeDetectorCtor = (
        globalThis as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => Detector }
      ).BarcodeDetector;
      detectorRef.current = new BarcodeDetectorCtor({ formats: [...FORMATS] });
      setStreaming(true);
    } catch {
      setError("Could not access the camera. Check permissions or use manual entry.");
    }
  }, []);

  useEffect(() => {
    if (!streaming || !detectorRef.current) return;

    const video = videoRef.current;
    const detector = detectorRef.current;
    const id = window.setInterval(async () => {
      if (!video || video.readyState < 2) return;
      try {
        const results = await detector.detect(video);
        for (const r of results) {
          const value = r.rawValue;
          if (!value || seenRef.current.has(value)) continue;
          seenRef.current.add(value);
          setCodes((prev) => [...prev, value]);
        }
      } catch {
        /* ignore */
      }
    }, 400);

    return () => window.clearInterval(id);
  }, [streaming]);

  useEffect(() => () => stop(), [stop]);

  const onIngestGtin = useCallback(async (raw: string) => {
    setIngestInfo(null);
    setIngestProductSlug(null);
    setIngestError(null);
    if (!isIngestBarcodeConfigured()) {
      setIngestError("Catalog ingest needs Supabase env (URL + anon key) and the ingest-barcode function.");
      return;
    }
    const { valid, gtin } = assertValidGtinScannedOrTyped(raw);
    if (!gtin) {
      setIngestError("Use an 8, 12, 13, or 14 digit product code (UPC / EAN).");
      return;
    }
    if (!valid) {
      setIngestError("This number fails GS1 check digit validation. Re-scan or type the code carefully.");
      return;
    }
    setIngestBusy(true);
    const r = await ingestBarcodeToCatalog(gtin);
    setIngestBusy(false);
    if (r.ok) {
      setIngestProductSlug(r.slug ?? null);
      setIngestInfo(
        `Saved ${r.slug ?? r.gtin} — ${r.ingredientsCount} ingredient line(s) from Open Food Facts (GS1 check OK).`,
      );
    } else {
      setIngestError(
        r.status === 404
          ? "Not in Open Food Facts — add the product there first, or use Field to paste a label list."
          : r.error,
      );
    }
  }, []);

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
      aria-labelledby="upc-heading"
    >
      <h2 id="upc-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        UPC & barcodes
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Read the UPC, EAN, QR, or other codes from the product. We link matches to{" "}
        <Link href="/lookup/" className="text-emerald-800 underline dark:text-emerald-400">
          Lookup
        </Link>
        .
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-sm dark:border-zinc-800">
        <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted />
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {!streaming ? (
          <button
            type="button"
            onClick={() => void start()}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800"
          >
            Start camera
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            Stop
          </button>
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p> : null}

      {ingestInfo ? (
        <p className="mt-3 text-sm text-emerald-800 dark:text-emerald-300" role="status">
          {ingestInfo}{" "}
          {ingestProductSlug ? (
            <Link
              href={`${publicBasePath()}/product/${ingestProductSlug}/`}
              className="font-semibold underline"
            >
              Open product
            </Link>
          ) : null}
        </p>
      ) : null}
      {ingestError ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-400" role="alert">
          {ingestError}
        </p>
      ) : null}

      {!hasBarcodeDetector() ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          This browser does not expose the Barcode Detection API (common on Safari). Use manual
          entry or use Chrome/Edge on Android or desktop.
        </p>
      ) : null}

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Enter code by hand
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="UPC, EAN, or digits from label"
              className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 outline-none ring-emerald-700/30 focus:border-emerald-600 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <Link
              href={`/lookup/?code=${encodeURIComponent(manual.trim())}`}
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Open lookup
            </Link>
            {isIngestBarcodeConfigured() ? (
              <button
                type="button"
                disabled={ingestBusy}
                onClick={() => void onIngestGtin(manual)}
                className="inline-flex items-center justify-center rounded-full border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
              >
                {ingestBusy ? "Saving…" : "Save to catalog (OFF)"}
              </button>
            ) : null}
          </div>
        </label>
      </div>

      {codes.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Detected</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {codes.map((c) => (
              <li key={c} className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <Link
                  href={`/lookup/?code=${encodeURIComponent(c)}`}
                  className="block flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm text-emerald-900 hover:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-emerald-200"
                >
                  {c}
                </Link>
                {isIngestBarcodeConfigured() && assertValidGtinScannedOrTyped(c).valid ? (
                  <button
                    type="button"
                    disabled={ingestBusy}
                    onClick={() => void onIngestGtin(c)}
                    className="shrink-0 rounded-xl border border-emerald-600 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-200"
                  >
                    {ingestBusy ? "…" : "Save to catalog"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
