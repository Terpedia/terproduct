import { registerPlugin } from "@capacitor/core";

/**
 * Android-only: external Bluetooth SPP = {@link import("./thermal-bluetooth.android")};
 * an integrated 58mm roll often uses a vendor service behind {@code PrintManager}.
 * This plugin uses {@code androidx.print.PrintHelper} to open the system print UI.
 * Some OEMs still need their AAR to talk to the on-board printer.
 */
export interface TerproductDevicePlugin {
  printTextAsBitmap: (options: { text: string }) => Promise<void>;
  /** Decoded in Java with {@code BitmapFactory}; pass full {@code data:image/png;base64,...} or raw base64. */
  printPngDataUrl: (options: { data: string }) => Promise<void>;
  /** Debug path for MIRAY/NYX built-in roll printers: sends a plain ESC/POS self-test via the vendor service. */
  printNyxEscposTest: () => Promise<{ result: number }>;
  /** MIRAY/NYX built-in printer: rasterizes a PNG data URL into ESC/POS bytes and sends it directly. */
  printNyxPngDataUrl: (options: { data: string; width?: number }) => Promise<{ result: number }>;
}

const TerproductDevice = registerPlugin<TerproductDevicePlugin>("TerproductDevice", {
  web: () => ({
    printTextAsBitmap: async () => {
      throw new Error("TerproductDevice: Android app only. Integrated thermal is not available in the browser.");
    },
    printPngDataUrl: async () => {
      throw new Error("TerproductDevice: Android app only.");
    },
    printNyxEscposTest: async () => {
      throw new Error("TerproductDevice: Android app only.");
    },
    printNyxPngDataUrl: async () => {
      throw new Error("TerproductDevice: Android app only.");
    },
  }),
});

export { TerproductDevice };
