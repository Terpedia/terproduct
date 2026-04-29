import QRCode from "qrcode";

import { publicBasePath } from "@/lib/public-base";

import { stripNearWhiteToTransparent, trimUniformBorderFromCanvas } from "./trim-qr-canvas";

export type PlantQrClientOptions = {
  text: string;
  size?: number;
  /** Default 90: upright QR rotated 90° clockwise on the stem */
  rotateClockwiseDeg?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  margin?: number;
  /** Match CLI: final rotation for horizontal (handset) label */
  horizontal?: boolean;
  hDeg?: number;
  /**
   * Normalized to the **unrotated** stem asset (0–1). The stem is then rotated 90° CCW before
   * placing the QR, matching `scripts/qr-plant.mjs`.
   */
  anchorRatio?: { x: number; y: number };
  /**
   * If true, clears a top-center band before drawing the QR (for legacy assets that still
   * contained a sample QR). New stem art should be QR-free; default is off.
   */
  headClear?: boolean;
  /** Override; default: `${basePath}/qr-plant-assets/terproduct-logo.png` */
  stemUrl?: string;
  /**
   * Pixels to leave between the anchor line (intended stem top) and the bottom of the
   * diamond AABB; higher values move the QR up. Same as `scripts/qr-plant.mjs` flag `--qr-stem-gap`.
   */
  qrStemGapPx?: number;
  /**
   * Horizontal offset from canvas center for the rotated QR (negative = left).
   * Default {@code 0} (centered); override to match {@code scripts/qr-plant.mjs --qr-shift-x}.
   */
  qrCenterOffsetXPx?: number;
};

function defaultStemUrl(): string {
  const b = publicBasePath().replace(/\/$/, "");
  if (!b) {
    return "/qr-plant-assets/terproduct-logo.png";
  }
  return `${b}/qr-plant-assets/terproduct-logo.png`.replace(/\/\//g, "/");
}

/**
 * Absolute stem asset URL so resolution never depends on the current route (e.g. /qr/ vs /).
 * Required for WebViews / PWAs where relative fetch paths can resolve incorrectly.
 */
function resolveStemAssetUrl(stemSrc: string): string {
  if (stemSrc.startsWith("http://") || stemSrc.startsWith("https://")) {
    return stemSrc;
  }
  const path = stemSrc.startsWith("/") ? stemSrc : `/${stemSrc}`;
  if (typeof window === "undefined") {
    return path;
  }
  return `${window.location.origin}${path}`;
}

/** Loads stem PNG with absolute URL + {@link HTMLImageElement.decode} (reliable in Capacitor WebViews). */
async function loadStemImage(stemSrc: string): Promise<HTMLImageElement> {
  const url = resolveStemAssetUrl(stemSrc);
  const im = new Image();
  if (typeof window !== "undefined") {
    try {
      const u = new URL(url);
      if (u.origin !== window.location.origin) {
        im.crossOrigin = "anonymous";
      }
    } catch {
      /* ignore */
    }
  }
  im.src = url;
  try {
    await im.decode();
  } catch {
    await new Promise<void>((resolve, reject) => {
      im.onload = () => resolve();
      im.onerror = () => reject(new Error(`stem image failed to load: ${url}`));
    });
  }
  if (im.naturalWidth < 2 || im.naturalHeight < 2) {
    throw new Error(`stem image has invalid size (${im.naturalWidth}×${im.naturalHeight}): ${url}`);
  }
  return im;
}

/** Punches out the top-center head band (removes a baked-in QR) without painting opaque white. */
function clearStemHead(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const yMax = Math.min(Math.floor(h * 0.36), h);
  const x0 = Math.floor(w * 0.1);
  const x1 = Math.ceil(w * 0.9);
  ctx.clearRect(x0, 0, x1 - x0, yMax);
}

/** Jimp 90° CCW (same as {@code stem.rotate({ deg: 90 })}): (x, y) on W×H → (y, W−1−x) on H×W. */
function anchorAfterStemRotate90Ccw(anchor: { x: number; y: number }, w0: number) {
  return { x: anchor.y, y: w0 - 1 - anchor.x };
}

/**
 * Renders the stem, optional top-band clear, then 90° CCW into a H×W canvas to match the CLI.
 */
function buildRotatedStemCanvas(
  stemImg: HTMLImageElement,
  headClear: boolean,
): { canvas: HTMLCanvasElement; w0: number; h0: number } {
  const w0 = stemImg.naturalWidth;
  const h0 = stemImg.naturalHeight;
  const pre = document.createElement("canvas");
  pre.width = w0;
  pre.height = h0;
  const p = pre.getContext("2d");
  if (!p) {
    throw new Error("canvas 2d not available");
  }
  p.imageSmoothingEnabled = true;
  p.imageSmoothingQuality = "high";
  p.drawImage(stemImg, 0, 0, w0, h0);
  if (headClear) {
    clearStemHead(p, w0, h0);
  }
  const out = document.createElement("canvas");
  out.width = h0;
  out.height = w0;
  const c = out.getContext("2d");
  if (!c) {
    throw new Error("canvas 2d not available");
  }
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  /* 90° CCW: pivot uses source *height* (not width). Wrong height breaks non-square stems vs Jimp. */
  c.translate(0, h0);
  c.rotate(-Math.PI / 2);
  c.drawImage(pre, 0, 0);
  return { canvas: out, w0, h0 };
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
    size = 560,
    rotateClockwiseDeg = 90,
    errorCorrectionLevel = "H",
    margin = 2,
    horizontal = false,
    hDeg = -90,
    anchorRatio = { x: 0.5, y: 0.26 },
    headClear = false,
    stemUrl: stemPath,
    qrStemGapPx = 8,
    qrCenterOffsetXPx,
  } = o;

  const stemSrc = stemPath ?? defaultStemUrl();

  const qrCan = document.createElement("canvas");
  qrCan.width = size;
  qrCan.height = size;
  /* Opaque white light modules: some WebViews ignore fully transparent light (#00000000) and break trim/rotate. */
  await QRCode.toCanvas(qrCan, text, {
    errorCorrectionLevel,
    width: size,
    margin,
    color: { dark: "#000000ff", light: "#ffffffff" },
  });

  const trimmed = trimUniformBorderFromCanvas(qrCan);
  stripNearWhiteToTransparent(trimmed);
  const tr = (rotateClockwiseDeg * Math.PI) / 180;
  const aabbW =
    Math.abs(trimmed.width * Math.cos(tr)) + Math.abs(trimmed.height * Math.sin(tr));
  const aabbH =
    Math.abs(trimmed.width * Math.sin(tr)) + Math.abs(trimmed.height * Math.cos(tr));
  const s = Math.ceil(Math.max(aabbW, aabbH)) + 2;
  const rot = document.createElement("canvas");
  rot.width = s;
  rot.height = s;
  const r = rot.getContext("2d");
  if (!r) {
    throw new Error("canvas 2d not available");
  }
  r.imageSmoothingEnabled = true;
  r.imageSmoothingQuality = "high";
  /* Transparent padding like Jimp rotate(..., mode:true); avoids a white mat shifting stem composite. */
  r.clearRect(0, 0, s, s);
  r.translate(s / 2, s / 2);
  r.rotate((rotateClockwiseDeg * Math.PI) / 180);
  r.drawImage(trimmed, -trimmed.width / 2, -trimmed.height / 2);
  const qw = s;
  const qh = s;

  const stemImg = await loadStemImage(stemSrc);
  const w0 = stemImg.naturalWidth;
  const h0 = stemImg.naturalHeight;
  const anchorUnrot = { x: w0 * anchorRatio.x, y: h0 * anchorRatio.y };
  const { y: ay } = anchorAfterStemRotate90Ccw(anchorUnrot, w0);
  const { canvas: out } = buildRotatedStemCanvas(stemImg, headClear);
  const w = out.width;
  const h = out.height;
  const c = out.getContext("2d");
  if (!c) {
    throw new Error("canvas 2d not available");
  }
  const shift = qrCenterOffsetXPx !== undefined ? qrCenterOffsetXPx : 0;
  const qrCenterX = w / 2 + shift;
  const left = Math.round(qrCenterX - qw / 2);
  const top = Math.round(ay - qh - qrStemGapPx);
  /* Explicit crop when left/top is negative; avoids a vertical seam and half-offscreen QRs. */
  const dx = Math.max(0, left);
  const dy = Math.max(0, top);
  const sx = Math.max(0, -left);
  const sy = Math.max(0, -top);
  const sww = Math.max(0, Math.min(qw - sx, w - dx));
  const shh = Math.max(0, Math.min(qh - sy, h - dy));
  if (sww > 0 && shh > 0) {
    c.drawImage(rot, sx, sy, sww, shh, dx, dy, sww, shh);
  }

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
