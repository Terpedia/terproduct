"use client";

import { useEffect } from "react";

import { publicBasePath } from "@/lib/public-base";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) return;
      const base = publicBasePath();
      const url = `${base}/sw.js`;
      const scope = base ? `${base}/` : "/";
      void navigator.serviceWorker.register(url, { scope }).catch(() => {});
    })();
  }, []);

  return null;
}
