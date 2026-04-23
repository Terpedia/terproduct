import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import QRCode from "qrcode";

import { isCapacitorNative } from "@/lib/capacitor";

/**
 * Native: write PNG to cache, open share sheet (AirDrop to printer app, save to Files, etc.).
 * Web: triggers download of PNG.
 */
export async function shareOrDownloadQrPng(
  data: string,
  options: { title: string; filename: string } = { title: "Terproduct QR", filename: "terproduct-qr" },
): Promise<void> {
  const dataUrl = await QRCode.toDataURL(data, { width: 512, margin: 1, errorCorrectionLevel: "M" });
  const base64 = dataUrl.split(",")[1] ?? "";
  if (!(await isCapacitorNative())) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${options.filename}.png`;
    a.click();
    return;
  }

  const w = await Filesystem.writeFile({
    path: `${options.filename}-${Date.now()}.png`,
    data: base64,
    directory: Directory.Cache,
  });
  const can = await Share.canShare();
  if (can.value) {
    await Share.share({
      title: options.title,
      files: [w.uri],
      text: "QR label",
    });
  }
}
