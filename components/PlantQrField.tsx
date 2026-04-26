"use client";

import { useCallback, useState } from "react";

import { buildPlantQrPngDataUrl } from "@/lib/qr-plant/plant-qr-canvas";
import { TerproductDevice } from "@/lib/printing/terproduct-device";

type Props = {
  text: string;
  onLog: (s: string) => void;
};

/**
 * “Plant” QR: rotate, stem composite, optional horizontal (see {@code scripts/qr-plant.mjs}).
 * Print: Android system print path via {@link TerproductDevice.printPngDataUrl} (integrated / services).
 */
export function PlantQrField({ text, onLog }: Props) {
  const [busy, setBusy] = useState(false);
  const [horizontal, setHorizontal] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const build = useCallback(async () => {
    if (!text.trim()) {
      onLog("Plant QR: enter a URL or string first.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const dataUrl = await buildPlantQrPngDataUrl({
        text: text.trim(),
        horizontal,
        hDeg: -90,
        rotateClockwiseDeg: 45,
        size: 280,
      });
      setPreview(dataUrl);
      onLog("Plant QR: preview ready (rotate 45° + stem" + (horizontal ? ", then horizontal" : "") + ").");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(m);
      onLog(`Plant QR: ${m}`);
    } finally {
      setBusy(false);
    }
  }, [text, horizontal, onLog]);

  const downloadPng = useCallback(() => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = "terproduct-plant-qr.png";
    a.click();
    onLog("Plant QR: download started.");
  }, [onLog, preview]);

  const printSystem = useCallback(async () => {
    if (!preview) {
      onLog("Plant QR: build preview first.");
      return;
    }
    setBusy(true);
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
        onLog("Plant QR: system print of the bitmap is for the installed Android app (integrated thermal / print service).");
        return;
      }
      await TerproductDevice.printPngDataUrl({ data: preview });
      onLog("Plant QR: system print handoff (dialog or service).");
    } catch (e) {
      onLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [onLog, preview]);

  return (
    <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50/95">
      <strong className="block">Plant label (rotated QR + stem)</strong>
      <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90">
        Same idea as <code className="rounded bg-emerald-200/50 px-1 text-[11px] dark:bg-emerald-900/50">npm run qr-plant</code>: diamond
        QR, stem graphic from <code className="text-[11px]">/qr-plant-assets/stem.png</code>, then optional
        rotation for 58mm feed. Use <strong>System print</strong> on a POS with a registered print service; SPP/ESC/POS
        only does plain QR bytes, not this full image.
      </p>
      <label className="mt-1 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          className="rounded"
          checked={horizontal}
          onChange={(e) => setHorizontal(e.target.checked)}
        />
        <span>Horizontal (rotate final −90° like <code>qr-plant -H</code>)</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void build()}
          className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white"
        >
          {busy ? "…" : "Build preview"}
        </button>
        <button
          type="button"
          disabled={busy || !preview}
          onClick={downloadPng}
          className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium text-emerald-900 dark:text-emerald-200"
        >
          Download PNG
        </button>
        <button
          type="button"
          disabled={busy || !preview}
          onClick={() => void printSystem()}
          className="rounded-lg border border-emerald-900/30 bg-emerald-900/10 px-3 py-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100"
        >
          System print (Android)
        </button>
      </div>
      {err ? <p className="text-xs text-red-700 dark:text-red-300">{err}</p> : null}
      {preview ? (
        <div className="relative mt-2 flex justify-center rounded-lg border border-emerald-200/80 bg-white p-2 dark:border-emerald-800 dark:bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from canvas */}
          <img src={preview} alt="Plant QR preview" className="h-auto max-w-full" />
        </div>
      ) : null}
    </div>
  );
}
