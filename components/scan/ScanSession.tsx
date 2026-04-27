"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  type OpenFactsSource,
  type OpenFoodFactsProduct,
  fetchOpenFactsProduct,
  offBrand,
  offCategoriesLabelsHint,
  offImageUrl,
  offIngredientLines,
  offNutrimentDisplayLines,
  offProductName,
  offSuggestsSupplementOrDrugLabel,
  openFactsSourceLabel,
} from "@/lib/integrations/open-food-facts";
import { ocrFromCanvas, terminateOcrWorker } from "@/lib/ocr/label-ocr";
import { normalizeGtinInput } from "@/lib/scan/normalize-gtin";

const PHOTO_SLOTS = [
  { id: "front" as const, label: "Front" },
  { id: "back" as const, label: "Back" },
  { id: "nutrition" as const, label: "Nutrition" },
  { id: "ingredients" as const, label: "Ingredients" },
] as const;

type PhotoId = (typeof PHOTO_SLOTS)[number]["id"];

type BarFormat = { rawValue?: string; format: string };

function hasBarcodeApi(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

const DETECT_EVERY_MS = 450;
const OCR_EVERY_MS = 3500;
const DEDUPE_MS = 2200;

/**
 * Full-viewport style scanner: **camera** preview on top (browser Barcode
 * API), **HID hardware scanner** (wedge) in parallel, Open Food / Open Beauty
 * Facts for UPC, label **OCR** (Tesseract) on a throttled video frame, and per-panel
 * snapshot buttons.
 */
export function ScanSession() {
  const baseId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detRef = useRef<{ detect: (v: HTMLVideoElement) => Promise<BarFormat[]> } | null>(null);
  const lastCodeAtRef = useRef<Record<string, number>>({});
  const wedgeBufRef = useRef("");

  const [camError, setCamError] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [barNative, setBarNative] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [upc, setUpc] = useState<string | null>(null);
  const [off, setOff] = useState<OpenFoodFactsProduct | null>(null);
  const [offSource, setOffSource] = useState<OpenFactsSource | null>(null);
  const [offLoading, setOffLoading] = useState(false);
  const [offNote, setOffNote] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrStatus, setOcrStatus] = useState<"off" | "ready" | "run" | "err">("off");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Partial<Record<PhotoId, string>>>({});
  const [busySnap, setBusySnap] = useState<PhotoId | null>(null);
  const [mlBusy, setMlBusy] = useState(false);
  const [nativeHint, setNativeHint] = useState<string | null>(null);
  const [manualGtin, setManualGtin] = useState("");

  const applyGtin = useCallback(
    async (raw: string, source: "camera" | "hid" | "manual") => {
      const n = normalizeGtinInput(raw);
      if (!n) {
        return;
      }
      const now = Date.now();
      const t = lastCodeAtRef.current[n] ?? 0;
      if (now - t < DEDUPE_MS) {
        return;
      }
      lastCodeAtRef.current[n] = now;
      setLastScan(`${source}: ${n}`);
      setUpc(n);
      setOffLoading(true);
      setOffNote(null);
      setOff(null);
      setOffSource(null);
      try {
        const r = await fetchOpenFactsProduct(n);
        if (r.status === 1 && r.product && r.source) {
          setOff(r.product);
          setOffSource(r.source);
          setOffNote(null);
        } else {
          setOff(null);
          setOffSource(null);
          if (r.httpError) {
            setOffNote(r.status_verbose || "Open Food / Open Beauty Facts request failed.");
          } else {
            setOffNote(r.status_verbose || "Not in Open Food Facts or Open Beauty Facts (or offline).");
          }
        }
      } catch (e) {
        setOff(null);
        setOffSource(null);
        setOffNote(e instanceof Error ? e.message : "Lookup failed.");
      } finally {
        setOffLoading(false);
      }
    },
    [],
  );

  const startCamera = useCallback(async () => {
    setCamError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("Camera not available in this context.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play();
      }
      setCamOn(true);
      if (hasBarcodeApi()) {
        const Ctor = (
          window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => { detect: (x: HTMLVideoElement) => Promise<BarFormat[]> } }
        ).BarcodeDetector;
        detRef.current = new Ctor({
          formats: ["upc_a", "upc_e", "ean_8", "ean_13", "itf", "code_128"],
        });
        setBarNative(true);
      } else {
        setBarNative(false);
      }
    } catch (e) {
      setCamError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const stopCamera = useCallback(() => {
    detRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    setCamOn(false);
  }, []);

  useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
      void terminateOcrWorker();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (!camOn || !barNative || !detRef.current) {
      return;
    }
    const v = videoRef.current;
    const d = detRef.current;
    let t: ReturnType<typeof setInterval> | null = null;
    t = setInterval(() => {
      if (!v || v.readyState < 2) {
        return;
      }
      void d
        .detect(v)
        .then((res) => {
          const b = res[0];
          const raw = b?.rawValue;
          if (!raw) {
            return;
          }
          void applyGtin(raw, "camera");
        })
        .catch(() => {
          /* per-frame */
        });
    }, DETECT_EVERY_MS);
    return () => {
      if (t) {
        clearInterval(t);
      }
    };
  }, [applyGtin, barNative, camOn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key.length === 1 && /[0-9]/.test(e.key)) {
        wedgeBufRef.current += e.key;
        return;
      }
      if (e.key === "Enter" && wedgeBufRef.current) {
        const s = wedgeBufRef.current;
        wedgeBufRef.current = "";
        void applyGtin(s, "hid");
        e.preventDefault();
      } else if (e.key.length === 1) {
        wedgeBufRef.current = "";
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [applyGtin]);

  useEffect(() => {
    if (!camOn) {
      setOcrStatus("off");
      return;
    }
    setOcrStatus("ready");
    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) {
        return;
      }
      if (v.videoWidth < 32) {
        return;
      }
      setOcrStatus("run");
      setOcrError(null);
      const c = document.createElement("canvas");
      const w = 720;
      const r = w / v.videoWidth;
      c.width = w;
      c.height = Math.max(1, Math.round(v.videoHeight * r));
      const g = c.getContext("2d");
      if (!g) {
        return;
      }
      g.drawImage(v, 0, 0, c.width, c.height);
      void ocrFromCanvas(c)
        .then((text) => {
          if (text) {
            setOcrText(text);
            setOcrStatus("ready");
          }
        })
        .catch((e) => {
          setOcrError(e instanceof Error ? e.message : "OCR failed");
          setOcrStatus("err");
        });
    }, OCR_EVERY_MS);
    return () => clearInterval(id);
  }, [camOn]);

  const snap = useCallback(
    (slot: PhotoId) => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) {
        return;
      }
      setBusySnap(slot);
      try {
        const c = document.createElement("canvas");
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const g = c.getContext("2d");
        if (!g) {
          return;
        }
        g.drawImage(v, 0, 0);
        setPhotos((p) => ({ ...p, [slot]: c.toDataURL("image/jpeg", 0.9) }));
      } finally {
        setBusySnap(null);
      }
    },
    [],
  );

  const runMlOneShot = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.getPlatform() === "web" || !Capacitor.isNativePlatform()) {
      setNativeHint("ML Kit one-shot: only in the Android/iOS app.");
      return;
    }
    setMlBusy(true);
    setNativeHint(null);
    try {
      const { BarcodeScanner, BarcodeFormat } = await import("@capacitor-mlkit/barcode-scanning");
      const res = await BarcodeScanner.scan({
        formats: [BarcodeFormat.Ean13, BarcodeFormat.UpcA, BarcodeFormat.UpcE, BarcodeFormat.Ean8],
      });
      const b = res.barcodes[0];
      if (b?.rawValue) {
        void applyGtin(b.rawValue, "camera");
        setNativeHint("Scan captured.");
      } else {
        setNativeHint("No code in that scan.");
      }
    } catch (e) {
      setNativeHint(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setMlBusy(false);
    }
  }, [applyGtin]);

  const ocrNameGuess =
    ocrText
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 3 && !/^\d+$/.test(l)) || null;
  const displayName = off ? offProductName(off) : ocrNameGuess || "—";
  const displayBrand = off ? offBrand(off) : null;
  const derivedIngredients = off ? offIngredientLines(off) : [];
  const ingText = off?.ingredients_text?.trim();
  const catalogImageUrl = off ? offImageUrl(off) : null;
  const nutrimentLines = off ? offNutrimentDisplayLines(off) : [];
  const catLabelHint = off ? offCategoriesLabelsHint(off) : null;
  const regHint = off ? offSuggestsSupplementOrDrugLabel(off) : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section
        className="relative z-0 flex min-h-0 w-full shrink-0 flex-col"
        style={{ height: "min(46dvh, 400px)" }}
        aria-label="Camera and barcode"
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-b from-black/50 to-transparent px-3 py-2 text-xs text-white">
          <span className="font-medium">Live camera {barNative ? "· barcodes" : "· no BarcodeDetector API"}</span>
          {camOn ? (
            <button
              type="button"
              onClick={stopCamera}
              className="rounded bg-white/15 px-2 py-1 hover:bg-white/25"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="rounded bg-emerald-600 px-2 py-1"
            >
              Start
            </button>
          )}
        </div>
        {camError ? (
          <p className="absolute bottom-0 left-0 right-0 bg-amber-950/90 px-2 py-1.5 text-xs text-amber-100">
            {camError} — you can still use a <strong>hardware scanner</strong> (wedge) or type the UPC below.
          </p>
        ) : null}
        {!barNative && camOn ? (
          <p className="absolute bottom-0 left-0 right-0 bg-sky-950/85 px-2 py-1.5 text-[11px] text-sky-100">
            This browser has no in-frame barcode API. Use a Chromium-based browser, the Terproduct app, or
            a wedge scanner.{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => void runMlOneShot()}
              disabled={mlBusy}
            >
              {mlBusy ? "Opening…" : "Native one-shot (app)"}
            </button>
          </p>
        ) : null}
        {nativeHint ? (
          <p className="absolute bottom-8 left-2 right-2 text-center text-[11px] text-white/90">
            {nativeHint}
          </p>
        ) : null}
      </section>

      <section
        className="min-h-0 flex-1 space-y-4 overflow-y-auto border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/90"
        aria-labelledby={`${baseId}-details`}
      >
        <h2 className="sr-only" id={`${baseId}-details`}>
          Product details
        </h2>

        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          <strong className="text-zinc-700 dark:text-zinc-300">IR + camera:</strong> the top preview is
          the phone <strong>camera</strong>. A Zebra / Symcode / MJ-Q50 <strong>imager</strong> usually
          does not show as a second camera: it may feed this app as fast keyboard (HID) digits, while the
          label stays in the shot for OCR. Both are active here when the device supports them.
        </p>

        {lastScan ? <p className="font-mono text-xs text-emerald-800 dark:text-emerald-300">Last: {lastScan}</p> : null}

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-500">UPC / GTIN (manual)</label>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-900"
              value={manualGtin}
              onChange={(e) => setManualGtin(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="8–14 digits, Enter to apply"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void applyGtin(manualGtin, "manual");
                }
              }}
            />
            <button
              type="button"
              className="shrink-0 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-200 dark:text-zinc-900"
              onClick={() => {
                void applyGtin(manualGtin, "manual");
              }}
            >
              Apply
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Catalog (Open Food / Open Beauty)</h3>
          {offSource ? (
            <p className="mt-0.5 text-[11px] text-zinc-500">Source: {openFactsSourceLabel(offSource)}</p>
          ) : null}
          {offLoading ? <p className="mt-1 text-zinc-500">Loading…</p> : null}
          {!offLoading && upc ? <p className="mt-1 font-mono text-zinc-600 dark:text-zinc-400">Code: {upc}</p> : null}
          {!offLoading && off && catalogImageUrl ? (
            <div className="mt-2 flex flex-col items-start gap-2 sm:flex-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={catalogImageUrl}
                alt="Product (Open Facts)"
                className="h-32 max-w-full rounded border border-zinc-200 object-contain dark:border-zinc-600 sm:h-40"
                loading="lazy"
              />
              <p className="text-[10px] leading-snug text-zinc-500 sm:max-w-xs">
                Photo from the database when contributors uploaded it. “Ingredients” and “Nutrition/Supplement”
                sub-images, if any, are linked below; official FDA Drug Facts / full Supplement panels are often
                not structured here — use OCR and packaging stills for authoritative text.
              </p>
            </div>
          ) : null}
          {off && !catalogImageUrl && !offLoading ? (
            <p className="mt-2 text-xs text-zinc-500">No product photo in this entry.</p>
          ) : null}
          {!offLoading && off && (off.image_ingredients_url || off.image_nutrition_url) ? (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {off.image_ingredients_url ? (
                <a
                  className="text-sky-700 underline dark:text-sky-400"
                  href={off.image_ingredients_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Ingredients image
                </a>
              ) : null}
              {off.image_ingredients_url && off.image_nutrition_url ? " · " : null}
              {off.image_nutrition_url ? (
                <a
                  className="text-sky-700 underline dark:text-sky-400"
                  href={off.image_nutrition_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Nutrition / panel image
                </a>
              ) : null}
            </p>
          ) : null}
          {!offLoading && off ? (
            <ul className="mt-2 space-y-1 text-zinc-800 dark:text-zinc-200">
              <li>
                <span className="text-zinc-500">Name:</span> {offProductName(off)}
              </li>
              <li>
                <span className="text-zinc-500">Brand:</span> {offBrand(off) || "—"}
              </li>
              {catLabelHint ? (
                <li>
                  <span className="text-zinc-500">Categories / labels:</span> {catLabelHint}
                </li>
              ) : null}
              {ingText ? (
                <li>
                  <span className="text-zinc-500">Ingredients (text):</span> {ingText}
                </li>
              ) : null}
              {derivedIngredients.length > 0 ? (
                <li>
                  <span className="text-zinc-500">Ingredients (lines):</span>
                  <ul className="mt-1 list-inside list-disc pl-1">
                    {derivedIngredients.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </li>
              ) : null}
            </ul>
          ) : null}
          {nutrimentLines.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Nutrients (from nutriments) — {regHint
                  ? "supplement- or food-style; not a substitute for the printed label."
                  : "serving and per-100g where available."}
              </p>
              {regHint ? (
                <p className="mt-1 text-[10px] text-amber-900/90 dark:text-amber-200/90">
                  Open*Facts is crowd-sourced. US “Drug Facts”/OTC active ingredients are not reliably
                  modelled; use the ingredients list and your photos for compliance-critical copy.
                </p>
              ) : null}
              <ul className="mt-1 max-h-40 list-inside list-disc space-y-0.5 overflow-y-auto text-xs text-zinc-700 dark:text-zinc-300">
                {nutrimentLines.map((line, i) => (
                  <li key={`${i}-${line.slice(0, 64)}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : !offLoading && off && (off.nutriments == null || Object.keys((off.nutriments as Record<string, unknown>) ?? {}).length === 0) ? (
            <p className="mt-2 text-xs text-zinc-500">No structured nutriments for this product.</p>
          ) : null}
          {offNote ? <p className="mt-2 text-amber-800 dark:text-amber-200/90">{offNote}</p> : null}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">OCR (Tesseract) — from camera</h3>
          <p className="text-[11px] text-zinc-500">
            Runs every ~3.5s (first run downloads language data). Fills the block below; used as a fallback
            for product name when there is no OFF hit.
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Name: <span className="font-medium text-zinc-800 dark:text-zinc-200">{displayName}</span> ·
            brand: <span className="font-medium text-zinc-800 dark:text-zinc-200">{displayBrand || "—"}</span>
          </p>
          {ocrError ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{ocrError}</p> : null}
          <pre className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-zinc-100 p-2 text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {ocrStatus === "off"
              ? "OCR off"
              : ocrText || ocrStatus === "run"
                ? ocrText || "…"
                : "Aiming at label…"}
          </pre>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Packaging stills (from video)</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {PHOTO_SLOTS.map(({ id, label }) => (
              <div key={id} className="w-[calc(50%-0.25rem)] sm:w-40">
                <p className="text-[11px] text-zinc-500">{label}</p>
                <div className="mt-1 aspect-[4/3] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
                  {photos[id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photos[id]} alt={label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">—</div>
                  )}
                </div>
                <button
                  type="button"
                  className="mt-1 w-full rounded border border-zinc-300 py-1 text-xs dark:border-zinc-600"
                  onClick={() => snap(id)}
                  disabled={!camOn || busySnap === id}
                >
                  {busySnap === id ? "…" : "Capture"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
