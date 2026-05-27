"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ingestBarcodeToCatalog } from "@/lib/api/ingest-barcode";
import { assertValidGtinScannedOrTyped } from "@/lib/integrations/gs1-gtin";
import { publicBasePath } from "@/lib/public-base";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"] as const;

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string; format?: string }>>;
};

function hasBarcodeDetector(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export function WebScanConsole() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const seenRef = useRef(new Set<string>());
  const [streaming, setStreaming] = useState(false);
  const [lastCode, setLastCode] = useState("");
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState("Ready.");
  const [busy, setBusy] = useState(false);
  const [productSlug, setProductSlug] = useState<string | null>(null);

  const detectorReady = useMemo(() => hasBarcodeDetector(), []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  }, []);

  const saveCode = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code) {
      setStatus("Scan or enter a UPC/EAN first.");
      return;
    }
    setLastCode(code);
    setProductSlug(null);
    const { gtin, valid } = assertValidGtinScannedOrTyped(code);
    if (!gtin) {
      setStatus("Use an 8, 12, 13, or 14 digit product code.");
      return;
    }
    if (!valid) {
      setStatus("GS1 check digit failed. Re-scan or retype the code.");
      return;
    }
    setBusy(true);
    setStatus("Saving...");
    const result = await ingestBarcodeToCatalog(gtin);
    setBusy(false);
    if (result.ok) {
      setProductSlug(result.slug ?? null);
      setStatus(`Saved ${result.slug ?? result.gtin}.`);
      return;
    }
    setStatus(
      result.status === 404
        ? "Valid GTIN, but no Open Food/Beauty Facts product exists yet."
        : result.error,
    );
  }, []);

  const start = useCallback(async () => {
    setStatus("Opening camera...");
    setProductSlug(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Camera is not available in this browser.");
      return;
    }
    if (!hasBarcodeDetector()) {
      setStatus("This browser has no Barcode Detection API. Use Chrome/Edge or manual entry.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      const BarcodeDetectorCtor = (
        globalThis as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => Detector }
      ).BarcodeDetector;
      detectorRef.current = new BarcodeDetectorCtor({ formats: [...FORMATS] });
      setStreaming(true);
      setStatus("Point camera at a UPC/EAN.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open camera.");
    }
  }, []);

  useEffect(() => {
    if (!streaming || !detectorRef.current) return;
    const id = window.setInterval(() => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) return;
      void detector.detect(video).then((items) => {
        const value = items[0]?.rawValue?.trim();
        if (!value || seenRef.current.has(value)) return;
        seenRef.current.add(value);
        setLastCode(value);
        setManual(value);
        void saveCode(value);
      }).catch(() => {
        /* per-frame scanner errors are noisy */
      });
    }, 500);
    return () => window.clearInterval(id);
  }, [saveCode, streaming]);

  useEffect(() => () => stop(), [stop]);

  const productHref = productSlug ? `${publicBasePath()}/product/${productSlug}/` : "";

  return (
    <main className="mx-auto flex h-[calc(100dvh-7.75rem)] w-full max-w-md flex-col gap-3 overflow-hidden px-3 py-3 md:h-[calc(100dvh-3.5rem)]">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">Scan</h1>
          <p className="truncate text-xs text-zinc-500">
            {detectorReady ? "camera + catalog" : "manual + catalog"}
          </p>
        </div>
        <Link href="/" className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold dark:border-zinc-700">
          App
        </Link>
      </header>

      <section className="grid min-h-0 flex-1 grid-rows-[1fr_auto_auto_auto] gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="relative min-h-0 overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          {!streaming ? (
            <div className="absolute inset-0 grid place-items-center text-sm font-medium text-zinc-300">
              Camera off
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {!streaming ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void start()}
              className="h-12 rounded-lg bg-emerald-700 text-sm font-semibold text-white disabled:opacity-50"
            >
              Start camera
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="h-12 rounded-lg border border-zinc-300 text-sm font-semibold dark:border-zinc-700"
            >
              Stop
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveCode(manual || lastCode)}
            className="h-12 rounded-lg bg-zinc-900 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>

        <label className="grid gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          UPC / EAN
          <input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            inputMode="numeric"
            placeholder={lastCode || "Scan or type digits"}
            className="h-11 rounded-lg border border-zinc-300 bg-white px-3 font-mono text-sm font-normal text-zinc-900 outline-none focus:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>

        <div className="min-h-0 rounded-lg bg-zinc-100 p-2 text-xs leading-snug text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <p className="max-h-8 overflow-hidden">{status}</p>
          {productSlug ? (
            <Link href={productHref} className="mt-1 inline-block font-semibold text-emerald-800 dark:text-emerald-300">
              Open product
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
