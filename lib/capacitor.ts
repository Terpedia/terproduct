import type { Capacitor } from "@capacitor/core";

type CapacitorModule = { Capacitor: typeof Capacitor };

export async function isCapacitorNative(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor: C } = (await import(
      "@capacitor/core"
    )) as CapacitorModule;
    return C.isNativePlatform();
  } catch {
    return false;
  }
}
