import type { CapacitorConfig } from "@capacitor/cli";

/**
 * - Default: WebView loads the deployed PWA (MJ-Q50 / any Android install over USB
 *   gets live HTML/JS from the site; `cap sync` still ships plugin native code).
 * - `CAPACITOR_LOAD_LOCAL=1` — bundle from `out/` only (no network; build `out` first).
 * - `CAPACITOR_SERVER_URL` — override the default production origin.
 */
const loadLocal = process.env.CAPACITOR_LOAD_LOCAL === "1" || process.env.CAPACITOR_LOAD_LOCAL === "true";

const config: CapacitorConfig = {
  appId: "com.terpedia.terproduct",
  appName: "Terproduct",
  webDir: "out",
  server: loadLocal
    ? { androidScheme: "https" }
    : {
        url: process.env.CAPACITOR_SERVER_URL || "https://terproduct.terpedia.com",
        androidScheme: "https",
      },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
