import QRCode from "qrcode";

import { publicBasePath } from "@/lib/public-base";

export type PlantQrClientOptions = {
  text: string;
  size?: number;
  /** Default 45: diamond orientation (clockwise) */
  rotateClockwiseDeg?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  margin?: number;
  /** Match CLI: final rotation for horizontal (handset) label */
  horizontal?: boolean;
  hDeg?: number;
  anchorRatio?: { x: number; y: number };
  noHeadClear?: boolean;
  /** Override; default: `${basePath}/qr-plant-assets/stem.png` */
  stemUrl?: string;
};

function defaultStemUrl(): string {
  const b = publicBasePath().replace(/\/$/, "");
  if (!b) {
    return "/qr-plant-assets/stem.png";
  }
  return `${b}/qr-plant-assets/stem.png`.replace(/\/\//g, "/");
}

function clearStemHead(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const yMax = Math.min(Math.floor(h * 0.36), h);
  const x0 = Math.floor(w * 0.1);
  const x1 = Math.ceil(w * 0.9);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x0, 0, x1 - x0, yMax);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`stem image load failed: ${url}`));
    im.src = url;
  });
}

/**
 * In-browser “plant QR” like {@code scripts/qr-plant.mjs}: render QR, rotate, composite on stem, optional
 * final rotation for 58mm horizontal feed. Use only in the client (uses DOM canvas).
 */
export async function buildPlantQrPngDataUrl(o: PlantQrClientOptions): Promise<string> {
  if (typeof document === "undefined") {
    throw new Error("buildPlantQrPngDataUrl: client only");
  }

  const {
    text,
    size = 280,
    rotateClockwiseDeg = 45,
    errorCorrectionLevel = "H",
    margin = 2,
    horizontal = false,
    hDeg = -90,
    anchorRatio = { x: 0.5, y: 0.26 },
    noHeadClear = false,
    stemUrl: stemPath,
  } = o;

  const stemSrc = stemPath ?? defaultStemUrl();

  const qrCan = document.createElement("canvas");
  qrCan.width = size;
  qrCan.height = size;
  await QRCode.toCanvas(qrCan, text, {
    errorCorrectionLevel,
    width: size,
    margin,
  });

  const s = Math.ceil(size * Math.SQRT2) + 4;
  const rot = document.createElement("canvas");
  rot.width = s;
  rot.height = s;
  const r = rot.getContext("2d");
  if (!r) {
    throw new Error("canvas 2d not available");
  }
  r.imageSmoothingEnabled = true;
  r.imageSmoothingQuality = "high";
  r.translate(s / 2, s / 2);
  r.rotate((rotateClockwiseDeg * Math.PI) / 180);
  r.drawImage(qrCan, -size / 2, -size / 2);
  const qw = s;
  const qh = s;

  const stemImg = await loadImage(stemSrc);
  const w = stemImg.naturalWidth;
  const h = stemImg.naturalHeight;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const c = out.getContext("2d");
  if (!c) {
    throw new Error("canvas 2d not available");
  }
  c.drawImage(stemImg, 0, 0, w, h);
  if (!noHeadClear) {
    clearStemHead(c, w, h);
  }
  const ax = w * anchorRatio.x;
  const ay = h * anchorRatio.y;
  const left = Math.round(ax - qw / 2);
  const top = Math.round(ay - qh);
  c.drawImage(rot, left, top, qw, qh);

  if (!horizontal) {
    return out.toDataURL("image/png");
  }

  const rad = (hDeg * Math.PI) / 180;
  const W = out.width;
  const H = out.height;
  const nW = Math.ceil(Math.abs(W * Math.cos(rad)) + Math.abs(H * Math.sin(rad)));
  const nH = Math.ceil(Math.abs(W * Math.sin(rad)) + Math.abs(H * Math.cos(rad)));
  const hCan = document.createElement("canvas");
  hCan.width = nW;
  hCan.height = nH;
  const hctx = hCan.getContext("2d");
  if (!hctx) {
    throw new Error("canvas 2d not available");
  }
  hctx.imageSmoothingEnabled = true;
  hctx.imageSmoothingQuality = "high";
  hctx.translate(nW / 2, nH / 2);
  hctx.rotate(rad);
  hctx.drawImage(out, -W / 2, -H / 2);
  return hCan.toDataURL("image/png");
}
