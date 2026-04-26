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

type WebDetector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type Platform = "web" | "ios" | "android" | "unknown";

function hasWebBarcodeApi(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
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

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50" id="device-hw-h1">
          Device hardware test
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Unisoc / field phones: use this page over{" "}
          <strong>USB</strong> debugging or the shipped WebView. Verifies <strong>camera</strong>{" "}
          (<code>getUserMedia</code>), <strong>barcode</strong> (in-browser or ML Kit in the native
          app), <strong>Symcode / HID</strong> (e.g. <strong>MJ-Q50</strong> wedge and{" "}
          <strong>side / aux</strong> key), and <strong>ESC/POS</strong> over{" "}
          <strong>Bluetooth SPP</strong> on Android. Pair the thermal in system settings first; all-in-one
          units like the MJ-Q50 often use a <strong>vendor</strong> path for the <strong>built-in</strong> 58
          mm printer, not only SPP.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Capacitor: {platform} · BarcodeDetector (web): {hasWebBarcodeApi() ? "yes" : "no"}
        </p>
        <p className="mt-2 text-sm">
          <Link href="/field/" className="text-emerald-800 underline dark:text-emerald-400">
            ← Back to field console
          </Link>
        </p>
      </div>

      {/* Camera */}
      <section
        className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        aria-labelledby="device-hw-cam"
      >
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50" id="device-hw-cam">
          1) Camera
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Starts the <span className="font-mono">environment</span> (rear) stream if the OS allows
          it.
        </p>
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

      {/* Barcode: native */}
      {platform === "web" && (
        <p className="text-xs text-amber-800 dark:text-amber-200/90">
          ML Kit in this section is only in the <strong>Capacitor</strong> build. Use the
          in-browser test below, or run{" "}
          <code className="rounded bg-zinc-200 px-1 text-[11px] dark:bg-zinc-800">npm run android</code>{" "}
          with USB to try ML Kit.
        </p>
      )}

      <section
        className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/60 dark:bg-violet-950/30"
        aria-labelledby="device-hw-ml"
      >
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50" id="device-hw-ml">
          2) Barcode — native (ML Kit)
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Opens a full-screen scan UI.</p>
        <button
          type="button"
          disabled={busy || platform === "web" || platform === "unknown"}
          onClick={() => void runMlKit()}
          className="rounded-lg bg-violet-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Scanning…" : "ML Kit camera scan"}
        </button>
      </section>

      {/* Barcode: web */}
      <section
        className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900/60 dark:bg-sky-950/30"
        aria-labelledby="device-hw-wbc"
      >
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50" id="device-hw-wbc">
          2b) Barcode — web (BarcodeDetector)
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Chromium-style engines only; uses a second camera stream so you can compare to section 1.
        </p>
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

      <SymcodeHidTest logLine={logLine} />

      {/* Printer */}
      <section
        className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-800 dark:bg-amber-950/40"
        aria-labelledby="device-hw-pr"
      >
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50" id="device-hw-pr">
          3) Printer (Android Bluetooth ESC/POS)
        </h2>
        <button
          type="button"
          onClick={() => void loadPaired()}
          className="rounded-lg bg-amber-900/20 px-3 py-1.5 text-sm font-medium text-amber-950 dark:text-amber-100"
        >
          Load paired devices
        </button>
        {pairList.length > 0 ? (
          <select
            className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-2 py-2 text-sm dark:border-amber-700 dark:bg-zinc-900"
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
          className="w-full rounded-lg border border-amber-300 bg-white px-2 py-2 font-mono text-sm dark:border-amber-700 dark:bg-zinc-900"
        />
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={busy}
            onClick={() => void printTextTest()}
            className="flex-1 rounded-lg bg-amber-800 py-2.5 text-sm font-semibold text-white"
          >
            Print text self-test
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void printQrTest()}
            className="flex-1 rounded-lg border border-amber-700 py-2.5 text-sm font-semibold text-amber-900 dark:text-amber-200"
          >
            Print QR only
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void printTextPlusQr()}
            className="flex-1 rounded-lg border border-amber-700 py-2.5 text-sm font-semibold text-amber-900 dark:text-amber-200"
          >
            Text + QR (one job)
          </button>
        </div>
      </section>

      <pre
        className="min-h-32 w-full overflow-x-auto rounded-xl bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        aria-label="Test log"
      >
        {log || "Event log (camera, barcodes, Symcode HID, print) will appear here."}
      </pre>
    </div>
  );
}
