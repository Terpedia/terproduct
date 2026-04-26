"use client";

/* PWA: sessionStorage + display-mode are only available after mount. */
/* eslint-disable react-hooks/set-state-in-effect -- browser-only PWA state */

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const DISMISS = "terproduct-pwa-install-hint-dismissed";

type InstallPrompt = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readStandalone() {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallHint() {
  const [dismissed, setDismissed] = useState(true);
  const [standalone, setStandalone] = useState(true);
  const [deferred, setDeferred] = useState<InstallPrompt | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (process.env.NODE_ENV === "development") {
      return;
    }
    let skipHint = false;
    try {
      if (window.sessionStorage.getItem(DISMISS) === "1") {
        skipHint = true;
      }
    } catch {
      skipHint = true;
    }
    if (skipHint) {
      return;
    }
    setDismissed(false);
    setStandalone(readStandalone());
  }, []);

  useLayoutEffect(() => {
    if (dismissed) return;
    if (process.env.NODE_ENV === "development") {
      return;
    }
    const m = window.matchMedia("(display-mode: standalone)");
    const h = () => setStandalone(readStandalone());
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, [dismissed]);

  useEffect(() => {
    if (dismissed || standalone) return;
    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    return () => window.removeEventListener("beforeinstallprompt", onBefore);
  }, [dismissed, standalone]);

  const onInstall = useCallback(() => {
    if (!deferred) return;
    setOutcome(null);
    const ev = deferred;
    setDeferred(null);
    void (async () => {
      try {
        await ev.prompt();
        await ev.userChoice.catch(() => {});
      } catch {
        setOutcome("Install did not run.");
      }
    })();
  }, [deferred]);

  const onDismiss = useCallback(() => {
    try {
      window.sessionStorage.setItem(DISMISS, "1");
    } catch {
      /* */
    }
    setDismissed(true);
  }, []);

  if (dismissed || standalone) {
    return null;
  }

  return (
    <div
      className="mx-auto max-w-3xl px-3 pt-1 md:px-4"
      role="status"
    >
      <div className="mb-0 flex items-start gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-800/80 dark:bg-emerald-950/50 dark:text-emerald-100">
        <p className="min-w-0 flex-1 pt-0.5">
          {deferred
            ? "Add Terproduct to your home screen for a full-screen PWA: quick access to product scan, lookup, and field tools."
            : "Use “Add to Home screen” in your browser menu to install the Terproduct PWA and open it like an app."}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {deferred ? (
            <button
              type="button"
              onClick={onInstall}
              className="rounded-full bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-900 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Install
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-zinc-300/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-200"
          >
            Dismiss
          </button>
        </div>
      </div>
      {outcome ? <p className="mt-1 px-1 text-xs text-zinc-500">{outcome}</p> : null}
    </div>
  );
}
