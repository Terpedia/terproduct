"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

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

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
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
        /* ignore single-frame detect errors */
      }
    }, 400);

    return () => window.clearInterval(id);
  }, [streaming]);

  useEffect(() => () => stop(), [stop]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Scan</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Use the camera to read QR codes or common product barcodes. Results link to{" "}
          <Link href="/lookup/" className="text-emerald-800 underline dark:text-emerald-400">
            Lookup
          </Link>
          .
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-sm dark:border-zinc-800">
        <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted />
      </div>

      <div className="flex flex-wrap gap-3">
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

      {error ? <p className="text-sm text-red-700 dark:text-red-400">{error}</p> : null}

      {!hasBarcodeDetector() ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This browser does not expose the Barcode Detection API (common on Safari). Use manual
          entry or open this app in Chrome or Edge on Android or desktop.
        </p>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Manual code
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Paste digits or scan result"
              className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 outline-none ring-emerald-700/30 focus:border-emerald-600 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <Link
              href={`/lookup/?code=${encodeURIComponent(manual.trim())}`}
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Open lookup
            </Link>
          </div>
        </label>
      </div>

      {codes.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
            Detected
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {codes.map((c) => (
              <li key={c}>
                <Link
                  href={`/lookup/?code=${encodeURIComponent(c)}`}
                  className="block rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm text-emerald-900 hover:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-emerald-200"
                >
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
