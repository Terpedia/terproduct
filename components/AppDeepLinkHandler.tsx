"use client";

import { useEffect, useRef } from "react";

import { publicBasePath } from "@/lib/public-base";

function toPath(href: string, base: string): string | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const p = (u.pathname || "/") + (u.search || "");
  if (u.protocol === "terproduct:") {
    if (base && !p.startsWith(base) && p.startsWith("/")) {
      return `${base}${p}`;
    }
    return p;
  }
  if (
    u.protocol === "https:" &&
    (u.hostname === "terproduct.terpedia.com" || u.hostname === "www.terproduct.terpedia.com" || u.hostname === "terproduct.app")
  ) {
    if (base && p.startsWith(base)) {
      return p;
    }
    if (base && !p.startsWith(base) && p.startsWith("/") && p !== "/") {
      return `${base}${p}`;
    }
    return p;
  }
  return null;
}

/**
 * Handles ADB / intent deep links (VIEW + data), e.g.
 *   adb shell am start -a android.intent.action.VIEW -d "terproduct://app/scan" $PKG
 *   adb shell am start -a android.intent.action.VIEW -d "https://terproduct.terpedia.com/field" $PKG
 * Only runs in native Capacitor.
 */
export function AppDeepLinkHandler() {
  const mounted = useRef(true);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_DEEPLINKS === "1") {
      return;
    }
    const base = publicBasePath();
    const go = (href: string) => {
      const next = toPath(href, base);
      if (!next) {
        return;
      }
      const cur = window.location.pathname + window.location.search;
      if (next === cur) {
        return;
      }
      if (cur.replace(/\/$/, "") === next.replace(/\/$/, "")) {
        return;
      }
      window.location.replace(next);
    };

    mounted.current = true;
    let subHandle: { remove: () => Promise<void> } | null = null;

    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || !mounted.current) {
        return;
      }
      const { App } = await import("@capacitor/app");

      try {
        const res = await App.getLaunchUrl();
        if (res?.url && mounted.current) {
          go(res.url);
        }
      } catch {
        /* not opened via deep link or plugin unavailable */
      }

      if (!mounted.current) {
        return;
      }
      subHandle = await App.addListener("appUrlOpen", ({ url }) => {
        if (url) {
          go(url);
        }
      });
    })();

    return () => {
      mounted.current = false;
      if (subHandle) {
        void subHandle.remove();
        subHandle = null;
      }
    };
  }, []);

  return null;
}
