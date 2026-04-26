"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyEvent } from "react";

type Props = { logLine: (s: string) => void };

/**
 * Many Symcode (e.g. MJ-Q50) imagers in HID/keyboard-wedge mode type digits
 * like a keyboard; a physical side or auxiliary key often reports as F-keys,
 * Search, or an Android media key. We log a filtered stream so a UPC scan
 * does not drown the log, while still seeing Enter, Tab, and the side button.
 */
export function SymcodeHidTest({ logLine }: Props) {
  const id = useId();
  const wedgeInputRef = useRef<HTMLInputElement>(null);
  const [listenKeys, setListenKeys] = useState(false);
  const [includePrintable, setIncludePrintable] = useState(false);
  const [wedge, setWedge] = useState("");

  const isLikelyBarcodeChar = (e: KeyboardEvent) => {
    if (e.key.length === 1 && /[0-9A-Za-z*\-.$/%]/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      return true;
    }
    return false;
  };

  const shouldLogKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.repeat) return false;
      if (includePrintable) return true;
      if (e.key === "Enter" || e.key === "Tab" || e.key === "Escape" || e.key === "Unidentified") {
        return true;
      }
      if (e.key.length > 1) return true;
      if (isLikelyBarcodeChar(e)) return false;
      if (!e.key) return true;
      return true;
    },
    [includePrintable],
  );

  useEffect(() => {
    if (!listenKeys) return;
    const fmt = (e: KeyboardEvent) => {
      const legacy = (e as unknown as { keyCode?: number }).keyCode;
      return `[Symcode HID] ${e.type} key=${JSON.stringify(e.key)} code=${e.code} keyCode=${legacy} loc=${e.location} repeat=${e.repeat}`;
    };
    const on = (e: KeyboardEvent) => {
      if (!shouldLogKey(e)) return;
      logLine(fmt(e));
    };
    window.addEventListener("keydown", on, true);
    window.addEventListener("keyup", on, true);
    return () => {
      window.removeEventListener("keydown", on, true);
      window.removeEventListener("keyup", on, true);
    };
  }, [listenKeys, logLine, shouldLogKey]);

  /** Pushes {@code keyCode/scanCode} for non-printing keys (see MainActivity). */
  useEffect(() => {
    const h = (ev: Event) => {
      if (!listenKeys) return;
      const ce = ev as CustomEvent<{ keyCode: number; action: number; scanCode: number; source: number }>;
      const d = ce.detail;
      logLine(
        `[Native key] down/up action=${d.action} keyCode=${d.keyCode} scanCode=${d.scanCode} source=${d.source}`,
      );
    };
    window.addEventListener("terproduct-native-key", h);
    return () => window.removeEventListener("terproduct-native-key", h);
  }, [listenKeys, logLine]);

  const onWedgeKey = (e: ReactKeyEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = e.currentTarget.value;
      logLine(v.trim() ? `[Symcode wedge] line: ${v.trim()}` : "[Symcode wedge] (empty line, Enter only)");
      setWedge("");
    }
  };

  return (
    <section
      className="space-y-3 rounded-2xl border border-fuchsia-200/90 bg-fuchsia-50/40 p-4 dark:border-fuchsia-800/50 dark:bg-fuchsia-950/20"
      aria-labelledby={`${id}-h`}
    >
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50" id={`${id}-h`}>
        2c) Symcode / HID (e.g. MJ-Q50) — side key &amp; keyboard wedge
      </h2>
      <div className="rounded-lg border border-fuchsia-200/80 bg-fuchsia-100/40 px-3 py-2 text-sm text-fuchsia-950 dark:border-fuchsia-800/60 dark:bg-fuchsia-950/40 dark:text-fuchsia-100/95">
        <p className="font-medium">Symcode MJ-Q50 (all-in-one PDA)</p>
        <p className="mt-1 text-fuchsia-900/95 dark:text-fuchsia-200/90">
          Typical layout: built-in 2D scan engine, touch screen, and <strong>58&nbsp;mm thermal</strong> on
          a small Android PDA. Use <strong>section 2 (ML Kit)</strong> in this app to exercise the
          <strong> camera / scan UI</strong>; the tests below are for <strong>HID (keyboard) wedge</strong> and
          the <strong>physical side / aux</strong> key. The <strong>internal receipt printer</strong> is
          often driven by a vendor/embedded path — use a manufacturer or Sunmi-style print test if
          the Field screen’s <strong>Bluetooth SPP + ESC/POS</strong> path only applies to
          <strong> paired external</strong> thermals, not the built-in roll.
        </p>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        With the scanner in <strong>HID (keyboard) mode</strong>, a scan usually “types” into the field
        below, often ending with <kbd className="font-mono text-xs">Enter</kbd>. The
        <strong> side or auxiliary</strong> button is often a <strong>function/Search/Volume</strong> key:
        we listen on the <strong>window</strong> (capture) so you do not have to keep this input focused.
        Filter mode hides 0–9 and letters to reduce noise; turn on <em>all keys</em> to see a full
        UPC in the key log, or to debug odd layouts.
      </p>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Wedge (point scanner here, then press trigger)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={wedgeInputRef}
            type="text"
            name="symcode-wedge"
            value={wedge}
            onChange={(e) => setWedge(e.target.value)}
            onKeyDown={onWedgeKey}
            inputMode="text"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-fuchsia-200 bg-white px-3 py-2.5 font-mono text-sm text-zinc-900 dark:border-fuchsia-800/80 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="e.g. 0 0 0 0 0 0 0 0 0 0 0 0 1 + Enter"
          />
          <button
            type="button"
            onClick={() => {
              setWedge("");
              wedgeInputRef.current?.focus();
            }}
            className="rounded-lg border border-fuchsia-300 px-3 py-2 text-sm text-fuchsia-950 dark:border-fuchsia-700 dark:text-fuchsia-100"
          >
            Clear field
          </button>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          On <kbd className="font-mono">Enter</kbd>, a line is logged and the field clears. If the side
          button is mapped to a scan without typing into this box, use the key logger.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-fuchsia-200/80 bg-white/50 p-3 dark:border-fuchsia-800/50 dark:bg-zinc-900/30">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={listenKeys}
            onChange={(e) => {
              setListenKeys(e.target.checked);
              logLine(e.target.checked ? "[Symcode HID] window key capture ON" : "[Symcode HID] window key capture OFF");
            }}
            className="rounded"
          />
          <span>Log keys on window (for side / aux button)</span>
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includePrintable}
            onChange={(e) => {
              setIncludePrintable(e.target.checked);
            }}
            className="rounded"
            disabled={!listenKeys}
          />
          <span>Include digit/letter keys (verbose)</span>
        </label>
      </div>
      <p className="text-xs text-amber-800 dark:text-amber-200/90">
        In the <strong>installed</strong> Android app, non-printing keys (side/aux, function keys) are
        also forwarded as <code className="text-[11px]">[Native key]</code> (see <code>MainActivity</code>).
        If the side key still never appears, the OEM may be consuming it in firmware or mapping it to
        a digit key; try <em>Include digit/letter keys</em> above, or a vendor &quot;key test&quot; app, then
        re-map the scanner in manufacturer utility.
      </p>
    </section>
  );
}
