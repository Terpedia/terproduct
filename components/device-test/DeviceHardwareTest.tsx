"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildTerproductHardwareTextTicket,
  buildTerproductTextPlusQrTicket,
} from "@/lib/printing/escpos-test-ticket";
import { escposQrCodeAscii } from "@/lib/printing/escpos-qr";
import { SymcodeHidTest } from "@/components/device-test/SymcodeHidTest";

const WEB_BARCODE_FORMATS = [
  "qr_code",
  "ean_13",
  "ean_8",
  "code_128",
  "upc_a",
  "upc_e",
  "code_39",
] as const;

const SAMPLE_STEM_QR_PATH = "/qr-plant-assets/sample-stem-qr.png";
const STEM_QR_ORIENTATIONS = [
  { label: "0", degrees: 0 },
  { label: "90 CW", degrees: 90 },
  { label: "180", degrees: 180 },
  { label: "90 CCW", degrees: -90 },
] as const;

type WebDetector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type Platform = "web" | "ios" | "android" | "unknown";
type StemQrOrientation = (typeof STEM_QR_ORIENTATIONS)[number]["degrees"];

function hasWebBarcodeApi(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

async function rotateImageBlobToDataUrl(blob: Blob, degrees: StemQrOrientation): Promise<string> {
  if (degrees === 0) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Sample stem QR read failed"));
      reader.readAsDataURL(blob);
    });
  }

  const src = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();

    const sideways = Math.abs(degrees) === 90;
    const canvas = document.createElement("canvas");
    canvas.width = sideways ? img.naturalHeight : img.naturalWidth;
    canvas.height = sideways ? img.naturalWidth : img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D not available");
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(src);
  }
}

async function loadSampleStemQrDataUrl(degrees: StemQrOrientation): Promise<string> {
  const res = await fetch(SAMPLE_STEM_QR_PATH, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Sample stem QR failed to load: HTTP ${res.status}`);
  }
  const blob = await res.blob();
  return rotateImageBlobToDataUrl(blob, degrees);
}

export function DeviceHardwareTest() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [log, setLog] = useState("");

  const logLine = useCallback((s: string) => {
    setLog((l) => `${l}\n${s}`.trim());
  }, []);

  useEffect(() => {
    void import("@capacitor/core").then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) {
        setPlatform("web");
        return;
      }
      setPlatform(Capacitor.getPlatform() as Platform);
    });
  }, []);

  // --- Camera ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camStreaming, setCamStreaming] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [camInfo, setCamInfo] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    setCamError(null);
    setCamInfo(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
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
      setCamStreaming(true);
      const track = stream.getVideoTracks()[0];
      const s = track?.getSettings();
      if (s) {
        setCamInfo(
          `w×h: ${s.width ?? "?"}×${s.height ?? "?"}, facingMode: ${(s as { facingMode?: string }).facingMode ?? "n/a"}`,
        );
      } else {
        setCamInfo("Stream active (no settings).");
      }
      logLine("Camera: getUserMedia OK, stream playing.");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setCamError(m);
      logLine(`Camera error: ${m}`);
    }
  }, [logLine]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    setCamStreaming(false);
    setCamInfo(null);
  }, []);

  const snapshot = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) {
      logLine("Camera: need a live frame to snapshot.");
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const g = c.getContext("2d");
    if (!g) {
      logLine("Camera: canvas 2D not available.");
      return;
    }
    g.drawImage(v, 0, 0);
    logLine(`Camera: snapshot ${c.width}×${c.height} px (see canvas below).`);
  }, [logLine]);

  const listDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      logLine("Media: enumerateDevices not available.");
      return;
    }
    try {
      const d = await navigator.mediaDevices.enumerateDevices();
      for (const dev of d) {
        logLine(`device ${dev.kind} ${dev.label || dev.deviceId || "(no label)"}`);
      }
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    }
  }, [logLine]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // --- Web Barcode (BarcodeDetector) ---
  const [webBarStreaming, setWebBarStreaming] = useState(false);
  const webVideoRef = useRef<HTMLVideoElement>(null);
  const detRef = useRef<WebDetector | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const [webCodes, setWebCodes] = useState<string[]>([]);
  const [webLast, setWebLast] = useState<string | null>(null);

  const stopWebBarcode = useCallback(() => {
    setWebBarStreaming(false);
    webStreamRef.current?.getTracks().forEach((t) => t.stop());
    webStreamRef.current = null;
    const v = webVideoRef.current;
    if (v) v.srcObject = null;
    detRef.current = null;
  }, []);

  const startWebBarcode = useCallback(async () => {
    if (!hasWebBarcodeApi()) {
      logLine("Web BarcodeDetector: not in this engine (Chromium/Edge on Android is typical).");
      return;
    }
    setWebLast(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      webStreamRef.current = stream;
      const v = webVideoRef.current;
      if (!v) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      v.srcObject = stream;
      await v.play();
      const BarcodeDetectorCtor = (
        globalThis as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => WebDetector }
      ).BarcodeDetector;
      detRef.current = new BarcodeDetectorCtor({ formats: [...WEB_BARCODE_FORMATS] });
      setWebBarStreaming(true);
      logLine("Web: BarcodeDetector + camera started.");
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    }
  }, [logLine]);

  useEffect(() => {
    if (!webBarStreaming || !detRef.current) return;
    const video = webVideoRef.current;
    const detector = detRef.current;
    const idTimer = window.setInterval(() => {
      if (!video || video.readyState < 2) return;
      void detector
        .detect(video)
        .then((res) => {
          const v0 = res[0]?.rawValue;
          if (!v0) return;
          setWebLast(v0);
          setWebCodes((prev) => (prev.includes(v0) ? prev : [...prev, v0]));
          logLine(`Web Barcode: ${v0}`);
        })
        .catch(() => {
          /* ignore per-frame */
        });
    }, 500);
    return () => clearInterval(idTimer);
  }, [webBarStreaming, logLine]);

  useEffect(() => () => stopWebBarcode(), [stopWebBarcode]);

  // --- Native ML Kit (Capacitor) ---
  const [busy, setBusy] = useState(false);
  const runMlKit = useCallback(async () => {
    setBusy(true);
    try {
      const { BarcodeScanner, BarcodeFormat } = await import("@capacitor-mlkit/barcode-scanning");
      await BarcodeScanner.requestPermissions();
      const res = await BarcodeScanner.scan({
        formats: [
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.QrCode,
          BarcodeFormat.Code128,
        ],
      });
      const b = res.barcodes[0];
      if (!b) {
        logLine("ML Kit: no barcode in frame.");
        return;
      }
      const val = b.rawValue ?? b.displayValue ?? "";
      logLine(`ML Kit: format=${b.format} value=${val}`);
    } catch (e) {
      logLine(`ML Kit error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [logLine]);

  // --- Printer (Android Bluetooth SPP) ---
  const [androidPrinter, setAndroidPrinter] = useState("");
  const [pairList, setPairList] = useState<Array<{ name: string; address: string }>>([]);
  const [stemQrPreview, setStemQrPreview] = useState<string | null>(null);
  const [stemQrOrientation, setStemQrOrientation] = useState<StemQrOrientation>(-90);

  const loadPaired = useCallback(async () => {
    if (typeof window === "undefined") return;
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.getPlatform() !== "android") {
      logLine("Paired list: use Android (USB-deployed) with classic Bluetooth SPP.");
      return;
    }
    setBusy(true);
    try {
      const { listPairedForUi } = await import("@/lib/printing/thermal-bluetooth.android");
      const d = await listPairedForUi();
      setPairList(d);
      if (d[0] && !androidPrinter) {
        setAndroidPrinter(d[0].address);
      }
      logLine(`Bluetooth: ${d.length} paired device(s).`);
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [androidPrinter, logLine]);

  const printTextTest = useCallback(async () => {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.getPlatform() !== "android") {
      logLine("Print: ESC/POS over SPP is implemented on Android in this app.");
      return;
    }
    if (!androidPrinter) {
      logLine("Print: set a printer MAC (Load paired) first.");
      return;
    }
    setBusy(true);
    try {
      const { printEscPosToPaired } = await import("@/lib/printing/thermal-bluetooth.android");
      const p = buildTerproductHardwareTextTicket();
      await printEscPosToPaired(androidPrinter, p);
      logLine("Print: text ticket sent (ESC/POS).");
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [androidPrinter, logLine]);

  const printQrTest = useCallback(async () => {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.getPlatform() !== "android") {
      logLine("Print QR: only on Android in this test.");
      return;
    }
    if (!androidPrinter) {
      logLine("Print: set a printer MAC (Load paired) first.");
      return;
    }
    setBusy(true);
    try {
      const { printEscPosToPaired } = await import("@/lib/printing/thermal-bluetooth.android");
      const p = escposQrCodeAscii("https://terpedia.com/", { size: 3 });
      await printEscPosToPaired(androidPrinter, p);
      logLine("Print: QR (GS k) test sent.");
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [androidPrinter, logLine]);

  const printTextPlusQr = useCallback(async () => {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.getPlatform() !== "android") {
      logLine("Print: combined job only on Android in this test.");
      return;
    }
    if (!androidPrinter) {
      logLine("Print: set a printer MAC (Load paired) first.");
      return;
    }
    setBusy(true);
    try {
      const { printEscPosToPaired } = await import("@/lib/printing/thermal-bluetooth.android");
      const p = buildTerproductTextPlusQrTicket("https://terpedia.com/");
      await printEscPosToPaired(androidPrinter, p);
      logLine("Print: text+QR job sent (single buffer).");
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [androidPrinter, logLine]);

  const printAndroidSystemUi = useCallback(async () => {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      logLine("System print: only in the installed Android app (not the browser).");
      return;
    }
    setBusy(true);
    try {
      const { TerproductDevice } = await import("@/lib/printing/terproduct-device");
      await TerproductDevice.printTextAsBitmap({
        text: [
          "==== TERPRODUCT (system) ====",
          new Date().toISOString(),
          "If this appears on the roll, the built-in",
          "thermal is wired through Android print.",
          "Otherwise add the manufacturer SDK (AAR).",
        ].join("\n"),
      });
      logLine("Print: system print flow finished (dialog closed or handoff).");
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [logLine]);

  const printNyxDirectTest = useCallback(async () => {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      logLine("NYX direct print: only in the installed Android app.");
      return;
    }
    setBusy(true);
    try {
      const { TerproductDevice } = await import("@/lib/printing/terproduct-device");
      const result = await TerproductDevice.printNyxEscposTest();
      logLine(`NYX direct print result: ${result.result}`);
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [logLine]);

  const printNyxStemQrTest = useCallback(async (degrees: StemQrOrientation = stemQrOrientation) => {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      logLine("NYX stem QR: only in the installed Android app.");
      return;
    }
    setBusy(true);
    try {
      setStemQrOrientation(degrees);
      const dataUrl = await loadSampleStemQrDataUrl(degrees);
      setStemQrPreview(dataUrl);
      const { TerproductDevice } = await import("@/lib/printing/terproduct-device");
      const result = await TerproductDevice.printNyxPngDataUrl({ data: dataUrl, width: 384 });
      logLine(`NYX stem QR print ${degrees}° result: ${result.result}`);
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [logLine, stemQrOrientation]);

  const previewNyxStemQrTest = useCallback(async (degrees: StemQrOrientation = stemQrOrientation) => {
    setBusy(true);
    try {
      setStemQrOrientation(degrees);
      const dataUrl = await loadSampleStemQrDataUrl(degrees);
      setStemQrPreview(dataUrl);
      logLine(`NYX stem QR preview ${degrees}° updated from the exact PNG used for print.`);
    } catch (e) {
      logLine(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [logLine, stemQrOrientation]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <header className="space-y-2">
        <Link href="/field/" className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
          Back to field console
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50" id="device-hw-h1">
          Device tests
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {platform} handheld checks. Use only what you are testing right now.
        </p>
      </header>

      <section
        className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30"
        aria-labelledby="device-hw-pr"
      >
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50" id="device-hw-pr">
            Built-in printer
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            MIRAY/NYX devices print through the vendor service.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void printNyxDirectTest()}
          className="w-full rounded-lg bg-emerald-700 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950"
        >
          {busy ? "Working..." : "Print self-test"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void printNyxStemQrTest()}
          className="w-full rounded-lg border border-emerald-700 bg-white py-3 text-sm font-semibold text-emerald-900 disabled:opacity-50 dark:border-emerald-500 dark:bg-zinc-950 dark:text-emerald-200"
        >
          {busy ? "Working..." : "Print stem QR"}
        </button>
        <div className="grid grid-cols-4 gap-2">
          {STEM_QR_ORIENTATIONS.map((o) => (
            <button
              key={o.degrees}
              type="button"
              disabled={busy}
              onClick={() => void printNyxStemQrTest(o.degrees)}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold disabled:opacity-50 ${
                stemQrOrientation === o.degrees
                  ? "border-emerald-700 bg-emerald-100 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100"
                  : "border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void previewNyxStemQrTest()}
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
        >
          Preview exact print image
        </button>
        {stemQrPreview ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from canvas */}
            <img src={stemQrPreview} alt="Stem QR exact print preview" className="mx-auto h-auto max-w-full" />
          </div>
        ) : null}
        <details className="group rounded-lg border border-emerald-200 bg-white/70 p-3 text-sm dark:border-emerald-900 dark:bg-zinc-950/50">
          <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
            Other print paths
          </summary>
          <div className="mt-3 space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void printAndroidSystemUi()}
              className="w-full rounded-lg border border-zinc-300 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
            >
              Android system print
            </button>
            <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500">External Bluetooth ESC/POS printer</p>
              <button
                type="button"
                onClick={() => void loadPaired()}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
              >
                Load paired
              </button>
              {pairList.length > 0 ? (
                <select
                  className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={androidPrinter}
                  onChange={(e) => setAndroidPrinter(e.target.value)}
                >
                  {pairList.map((d) => (
                    <option key={d.address} value={d.address}>
                      {d.name} - {d.address}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                value={androidPrinter}
                onChange={(e) => setAndroidPrinter(e.target.value)}
                placeholder="00:11:22:33:44:55"
                className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void printTextTest()}
                  className="rounded-lg bg-zinc-900 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
                >
                  Text
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void printQrTest()}
                  className="rounded-lg border border-zinc-300 py-2 text-xs font-semibold dark:border-zinc-700"
                >
                  QR
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void printTextPlusQr()}
                  className="rounded-lg border border-zinc-300 py-2 text-xs font-semibold dark:border-zinc-700"
                >
                  Both
                </button>
              </div>
            </div>
          </div>
        </details>
      </section>

      <details className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <summary className="cursor-pointer text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Camera
        </summary>
      <section
        className="mt-3 space-y-2"
        aria-labelledby="device-hw-cam"
      >
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black dark:border-zinc-800">
          <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted />
        </div>
        <div className="flex flex-wrap gap-2">
          {!camStreaming ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Start camera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-600"
            >
              Stop
            </button>
          )}
          <button
            type="button"
            onClick={snapshot}
            disabled={!camStreaming}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-40 dark:border-zinc-600"
          >
            Log resolution
          </button>
          <button
            type="button"
            onClick={() => void listDevices()}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-600"
          >
            Log media devices
          </button>
        </div>
        {camInfo ? <p className="text-sm text-zinc-700 dark:text-zinc-300">{camInfo}</p> : null}
        {camError ? <p className="text-sm text-red-600 dark:text-red-400">{camError}</p> : null}
      </section>
      </details>

      <details className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <summary className="cursor-pointer text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Barcode
        </summary>
      <section
        className="mt-3 space-y-2"
        aria-labelledby="device-hw-ml"
      >
        <h2 className="sr-only" id="device-hw-ml">
          Barcode native
        </h2>
        <button
          type="button"
          disabled={busy || platform === "web" || platform === "unknown"}
          onClick={() => void runMlKit()}
          className="rounded-lg bg-violet-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Scanning…" : "ML Kit camera scan"}
        </button>
      </section>

      <section
        className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
        aria-labelledby="device-hw-wbc"
      >
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300" id="device-hw-wbc">
          Browser barcode fallback
        </h2>
        <div className="overflow-hidden rounded-xl border border-sky-200 bg-black dark:border-sky-900/60">
          <video ref={webVideoRef} className="aspect-video w-full object-cover" playsInline muted />
        </div>
        <div className="flex flex-wrap gap-2">
          {!webBarStreaming ? (
            <button
              type="button"
              onClick={() => void startWebBarcode()}
              disabled={!hasWebBarcodeApi()}
              className="rounded-lg bg-sky-800 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {hasWebBarcodeApi() ? "Start" : "BarcodeDetector N/A"}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopWebBarcode}
              className="rounded-lg border border-sky-400 px-3 py-2.5 text-sm text-sky-900 dark:text-sky-200"
            >
              Stop
            </button>
          )}
        </div>
        {webLast ? (
          <p className="font-mono text-sm text-zinc-800 dark:text-zinc-200">Last: {webLast}</p>
        ) : null}
        {webCodes.length > 0 ? (
          <ul className="list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
            {webCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
      </section>
      </details>

      <details className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <summary className="cursor-pointer text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Scanner keys
        </summary>
        <div className="mt-3">
          <SymcodeHidTest logLine={logLine} />
        </div>
      </details>

      {log ? (
        <pre
          className="max-h-40 w-full overflow-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          aria-label="Test log"
        >
          {log}
        </pre>
      ) : null}
    </div>
  );
}
