"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { buildPlantQrPngDataUrl } from "@/lib/qr-plant/plant-qr-canvas";
import { TerproductDevice } from "@/lib/printing/terproduct-device";

type Props = {
  text: string;
  onLog: (s: string) => void;
  /** Match <code>?horizontal=1</code> / <code>?roll=1</code> on <code>/qr</code> — start with −90° roll layout checked */
  initialHorizontal?: boolean;
  /** Set via <code>?auto=1</code> / <code>?build=1</code> on <code>/qr</code> — build once when {@code text} is ready */
  autoBuild?: boolean;
  /** With {@code autoBuild}: open Android system print after generating the PNG */
  autoPrint?: boolean;
};

function plantQrOptions(textTrimmed: string, horizontal: boolean) {
  return {
    text: textTrimmed,
    horizontal,
    hDeg: -90,
    rotateClockwiseDeg: 45,
    size: 560,
  } as const;
}

/**
 * “Plant” QR: rotate, stem composite, optional horizontal (see {@code scripts/qr-plant.mjs}).
 * Print: Android system print path via {@link TerproductDevice.printPngDataUrl} (integrated / services).
 */
export function PlantQrField({
  text,
  onLog,
  initialHorizontal = false,
  autoBuild = false,
  autoPrint = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [horizontal, setHorizontal] = useState(initialHorizontal);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    setHorizontal(initialHorizontal);
  }, [initialHorizontal]);

  const build = useCallback(async () => {
    if (!text.trim()) {
      onLog("Plant QR: enter a URL or string first.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const dataUrl = await buildPlantQrPngDataUrl(plantQrOptions(text.trim(), horizontal));
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

  useEffect(() => {
    if (!autoBuild || autoStarted.current || !text.trim()) {
      return;
    }
    autoStarted.current = true;
    let cancelled = false;
    void (async () => {
      setErr(null);
      setBusy(true);
      try {
        const dataUrl = await buildPlantQrPngDataUrl(plantQrOptions(text.trim(), horizontal));
        if (cancelled) {
          return;
        }
        setPreview(dataUrl);
        onLog(
          "Plant QR: auto-built from link" + (horizontal ? " (horizontal)" : "") + ".",
        );
        const { Capacitor } = await import("@capacitor/core");
        if (autoPrint) {
          if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
            onLog("Plant QR: print=1 needs the installed Android app (system print UI).");
          } else {
            await TerproductDevice.printPngDataUrl({ data: dataUrl });
            onLog("Plant QR: system print handoff (dialog or service).");
          }
        }
      } catch (e) {
        if (!cancelled) {
          const m = e instanceof Error ? e.message : String(e);
          setErr(m);
          onLog(`Plant QR (auto): ${m}`);
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoBuild, autoPrint, text, horizontal, onLog]);

  const downloadPng = useCallback(async () => {
    if (!text.trim()) {
      onLog("Plant QR: enter a URL or string first.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const dataUrl = await buildPlantQrPngDataUrl(plantQrOptions(text.trim(), horizontal));
      setPreview(dataUrl);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "terproduct-plant-qr.png";
      a.click();
      onLog("Plant QR: download started (built from current roll-layout setting).");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(m);
      onLog(`Plant QR: ${m}`);
    } finally {
      setBusy(false);
    }
  }, [horizontal, onLog, text]);

  /** Builds from current URL + roll checkbox, then opens Android print UI (no separate “build preview” step). */
  const printSystem = useCallback(async () => {
    if (!text.trim()) {
      onLog("Plant QR: enter a URL or string first.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const dataUrl = await buildPlantQrPngDataUrl(plantQrOptions(text.trim(), horizontal));
      setPreview(dataUrl);
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
        onLog(
          "Plant QR: preview ready — system print needs the installed Android app (integrated thermal).",
        );
        return;
      }
      await TerproductDevice.printPngDataUrl({ data: dataUrl });
      onLog("Plant QR: system print handoff (dialog or service).");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(m);
      onLog(m);
    } finally {
      setBusy(false);
    }
  }, [horizontal, onLog, text]);

  /** One tap: same PNG as <code>npm run qr-plant -H</code>, then Android system print (thermal / POS). */
  const testPrintRollLayout = useCallback(async () => {
    if (!text.trim()) {
      onLog("Plant QR: enter a URL or string first.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const dataUrl = await buildPlantQrPngDataUrl(plantQrOptions(text.trim(), true));
      setPreview(dataUrl);
      setHorizontal(true);
      onLog("Plant QR: built with −90° rotation (roll layout, matches qr-plant -H).");
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
        onLog("Plant QR: preview updated — install the Android app for system print on device.");
        return;
      }
      await TerproductDevice.printPngDataUrl({ data: dataUrl });
      onLog("Plant QR: system print dialog opened (test print, horizontal).");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(m);
      onLog(`Plant QR (test print): ${m}`);
    } finally {
      setBusy(false);
    }
  }, [onLog, text]);

  return (
    <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50/95">
      <strong className="block">Plant label (rotated QR + stem)</strong>
      <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90">
        Same pipeline as <code className="rounded bg-emerald-200/50 px-1 text-[11px] dark:bg-emerald-900/50">npm run qr-plant</code>{" "}
        (560px QR, stem art, slight left shift): diamond QR on stem, optional{" "}
        <strong>−90°</strong> pass for 58&nbsp;mm roll feeds. Android: <strong>System print</strong> uses{" "}
        <code className="text-[11px]">PrintHelper</code> (vendor thermal service). Bluetooth SPP still only sends plain QR bytes,
        not this bitmap.
      </p>
      <label className="mt-1 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          className="rounded"
          checked={horizontal}
          onChange={(e) => setHorizontal(e.target.checked)}
        />
        <span>Roll layout −90° (<code>qr-plant -H</code>) — use for test print / thermal</span>
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
          disabled={busy || !text.trim()}
          onClick={() => void testPrintRollLayout()}
          className="rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white dark:bg-emerald-300 dark:text-emerald-950"
        >
          {busy ? "…" : "Test print (−90° roll)"}
        </button>
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void downloadPng()}
          className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium text-emerald-900 dark:text-emerald-200"
        >
          Download PNG
        </button>
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void printSystem()}
          className="rounded-lg border border-emerald-900/30 bg-emerald-900/10 px-3 py-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100"
        >
          System print (Android)
        </button>
      </div>
      {err ? <p className="text-xs text-red-700 dark:text-red-300">{err}</p> : null}
      {preview ? (
        <div className="relative mt-2 flex justify-center rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-500">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from canvas */}
          <img src={preview} alt="Plant QR preview" className="h-auto max-w-full" />
        </div>
      ) : null}
    </div>
  );
}
