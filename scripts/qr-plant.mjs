#!/usr/bin/env node
/**
 * Build a "plant QR" image: stem bitmap (from file) rotated 90° CCW, then a transparent (no white
 * mat) QR rotated 90° CW, centered horizontally with the bottom of the AABB just above the anchor.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Jimp } from "jimp";
import QRCode from "qrcode";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STEM = join(__dirname, "qr-plant-assets", "terproduct-logo.png");

/** Fully transparent — head erase, rotation padding, and QR “light” modules. */
const TRANSPARENT = 0x00_00_00_00;

function parseNumberPair(s) {
  const p = s.split(/[,\s]+/).map(Number);
  if (p.length < 2 || p.some((n) => !Number.isFinite(n))) {
    throw new Error(`expected two numbers, got: ${s}`);
  }
  return { x: p[0], y: p[1] };
}

function help() {
  console.log(`Usage: node scripts/qr-plant.mjs <text-or-url> [options]

Renders a QR code on the plant art (see scripts/qr-plant-assets/terproduct-logo.png; QR-free base).
The stem bitmap is rotated 90° counter-clockwise before the QR is placed, then the QR 90° clockwise,
centered horizontally with the bottom of its bounding box just above the “stem top” anchor line.
\`--anchor\` and \`--anchor-ratio\` use the stem file *before* the 90° CCW step.

Options:
  -o, --out <file>         Output path (default: plant-qr.png in cwd)
  -s, --size <px>          QR module canvas size before rotation (default: 560)
  --qr-shift-x <px>       Horizontal offset from canvas center (negative = left; default: 0, centered)
  --rotate <deg>           Clockwise degrees for the QR (default: 90; use negative for CCW in output)
  --ec-level <L|M|Q|H>     Error correction (default: H; helps when rotated)
  -m, --margin <n>         QR quiet zone in modules (default: 2)
  --stem <path>            Stem PNG to composite onto (default: ${DEFAULT_STEM})
  --anchor "x,y"           Anchor in pixels: stem/flower join line (before 90° CCW)
  --anchor-ratio "x,y"     Same, 0..1 of stem file (default: 0.5,0.26; if \`--anchor\` is not set)
  --qr-stem-gap <px>       Pixels between that line and the bottom of the QR AABB (default: 8)
  --debug                  Draw a small + at the anchor for tuning
  --head-clear            Erase a top band first (older stem PNGs with a sample QR; usually off)
  --no-head-clear         (Deprecated: default is already “no clear”; kept for old scripts)
  --horizontal, -H         After compositing, rotate 90° so the stem is
                           left–right and the QR is at the end
                           (default: --h-deg -90 in Jimp = 90° CW, bloom on
                           the right, stem to the left). Use --h-deg 90 to swap.
  --h-deg <n>             Degrees to rotate the final image when --horizontal
                           (default: -90; same sign as --rotate for QR, i.e. Jimp deg)
  --logo <path>            Wordmark or icon in bottom-left after layout (use a *small* PNG, not
                           a second copy of the plant stem; that was the “tiny stem” artifact)
  --logo-max-width <px>   Max width before compositing (default: 160)

Example:
  node scripts/qr-plant.mjs "https://example.com" -o /tmp/qr-plant.png
  node scripts/qr-plant.mjs "https://example.com" --anchor-ratio 0.5,0.24
  node scripts/qr-plant.mjs "https://example.com" -H -o /tmp/qr-plant-h.png
  node scripts/qr-plant.mjs "https://example.com" -H --logo ./terproduct-wordmark.png -o /tmp/qr-branded.png

PWA: Field screen → "Plant label" (same steps in-browser; system print on Android for integrated thermals).
`);
}

/** Clears a band at the top-center to alpha 0, removing a baked-in QR (works on transparent art). */
function clearPreexistingHead(jimp, yTopMaxRatio = 0.36, hMargin = 0.1) {
  const w = jimp.bitmap.width;
  const h = jimp.bitmap.height;
  const yMax = Math.min(Math.floor(h * yTopMaxRatio), h);
  const x0 = Math.floor(w * hMargin);
  const x1 = Math.ceil(w * (1 - hMargin));
  for (let y = 0; y < yMax; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      jimp.setPixelColor(TRANSPARENT, x, y);
    }
  }
}

/**
 * Blit `qr` (qw×qh) to dest (dx,dy) = (left, top), clipping to the stem. Avoids Jimp/negative-dest
 * bugs and vertical “seams” when top+qh > ay range clips off the top of the rot bitmap.
 */
function blitQrClipped({ stem, qr, left, top, qw, qh }) {
  const W = stem.bitmap.width;
  const H = stem.bitmap.height;
  const dx = Math.max(0, left);
  const dy = Math.max(0, top);
  const sx = Math.max(0, -left);
  const sy = Math.max(0, -top);
  const sw = Math.max(0, Math.min(qw - sx, W - dx));
  const sh = Math.max(0, Math.min(qh - sy, H - dy));
  if (sw < 1 || sh < 1) {
    return;
  }
  stem.blit({ src: qr, x: dx, y: dy, srcX: sx, srcY: sy, srcW: sw, srcH: sh });
}

/**
 * Stem 90° CCW (Jimp `deg: 90`): pixel (x,y) on the original W×H file → (y, W−1−x) on the
 * rotated H×W bitmap.
 */
function anchorAfterStemRotate90Ccw(anchor, w0) {
  return {
    x: anchor.y,
    y: w0 - 1 - anchor.x,
  };
}

function argValue(argv, i, name) {
  if (i + 1 < argv.length) return argv[i + 1];
  throw new Error(`${name} needs a value`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    help();
    process.exit(argv[0] === undefined ? 1 : 0);
  }

  let text = null;
  let outFile = "plant-qr.png";
  let size = 560;
  let rotateCcwDeg = -90; // 90° clockwise: Jimp rotates counter-clockwise
  let ecLevel = "H";
  let margin = 2;
  let stemPath = DEFAULT_STEM;
  let anchorPx = null;
  let anchorRatio = { x: 0.5, y: 0.26 };
  let headClear = false;
  let debug = false;
  let horizontal = false;
  let hDeg = -90;
  let qrStemGap = 8;
  let logoPath = null;
  let logoMaxW = 160;
  /** @type {number | undefined} */
  let qrShiftXPx = undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      help();
      process.exit(0);
    }
    if (a === "-o" || a === "--out") {
      outFile = argValue(argv, i, a);
      i += 1;
    } else if (a === "-s" || a === "--size") {
      size = Number(argValue(argv, i, a));
      i += 1;
    } else if (a === "--rotate") {
      const cw = Number(argValue(argv, i, a));
      rotateCcwDeg = -cw;
      i += 1;
    } else if (a === "--ec-level") {
      ecLevel = String(argValue(argv, i, a));
      i += 1;
    } else if (a === "-m" || a === "--margin") {
      margin = Number(argValue(argv, i, a));
      i += 1;
    } else if (a === "--stem") {
      stemPath = String(argValue(argv, i, a));
      i += 1;
    } else if (a === "--anchor") {
      anchorPx = parseNumberPair(argValue(argv, i, a));
      i += 1;
    } else if (a === "--anchor-ratio") {
      const { x, y } = parseNumberPair(argValue(argv, i, a));
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        throw new Error("--anchor-ratio each value should be 0..1");
      }
      anchorRatio = { x, y };
      i += 1;
    } else if (a === "--debug") {
      debug = true;
    } else if (a === "--head-clear") {
      headClear = true;
    } else if (a === "--no-head-clear") {
      headClear = false;
    } else if (a === "--horizontal" || a === "-H") {
      horizontal = true;
    } else if (a === "--h-deg") {
      hDeg = Number(argValue(argv, i, a));
      i += 1;
    } else if (a === "--qr-stem-gap") {
      qrStemGap = Number(argValue(argv, i, a));
      i += 1;
    } else if (a === "--qr-shift-x") {
      qrShiftXPx = Number(argValue(argv, i, a));
      i += 1;
    } else if (a === "--with-logo") {
      throw new Error(
        "--with-logo is removed. Use: --logo <path> with a small wordmark/icon (not a duplicate of the base plant art; that created a second tiny graphic in the corner).",
      );
    } else if (a === "--logo") {
      logoPath = String(argValue(argv, i, a));
      i += 1;
    } else if (a === "--logo-max-width") {
      logoMaxW = Number(argValue(argv, i, a));
      i += 1;
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    } else if (text == null) {
      text = a;
    } else {
      throw new Error(`Extra argument: ${a}`);
    }
  }

  if (!text) {
    throw new Error("pass the QR content as the first argument (URL or string)");
  }
  if (!existsSync(stemPath)) {
    throw new Error(`stem image not found: ${stemPath}`);
  }
  if (size < 32 || size > 4096) {
    throw new Error("--size should be in a reasonable range (e.g. 128–1024)");
  }
  if (horizontal && !Number.isFinite(hDeg)) {
    throw new Error("--h-deg must be a number");
  }
  if (logoPath && !Number.isFinite(logoMaxW)) {
    throw new Error("--logo-max-width must be a number");
  }
  if (logoPath && logoMaxW < 8) {
    throw new Error("--logo-max-width is too small");
  }
  if (!Number.isFinite(qrStemGap) || qrStemGap < 0) {
    throw new Error("--qr-stem-gap must be a non-negative number");
  }
  if (qrShiftXPx !== undefined && !Number.isFinite(qrShiftXPx)) {
    throw new Error("--qr-shift-x must be a number");
  }
  return {
    text,
    outFile,
    size,
    rotateCcwDeg,
    ecLevel,
    margin,
    stemPath,
    anchorPx,
    anchorRatio,
    headClear,
    debug,
    horizontal,
    hDeg,
    qrStemGap,
    logoPath,
    logoMaxW,
    qrShiftXPx,
  };
}

let ctx;
try {
  ctx = main();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exit(1);
}

try {
  const buf = await QRCode.toBuffer(ctx.text, {
    type: "png",
    errorCorrectionLevel: ctx.ecLevel,
    width: ctx.size,
    margin: ctx.margin,
    color: { dark: "#000000ff", light: "#00000000" },
  });

  const qr = await Jimp.read(buf);
  /* Tighten square QR to content + quiet zone (qrcode can pad the bitmap beyond modules). */
  await qr.autocrop();
  /* Padding around the diamond; light modules stay transparent. */
  qr.background = TRANSPARENT;
  qr.rotate({ deg: ctx.rotateCcwDeg, mode: true });

  const stem = await Jimp.read(ctx.stemPath);
  const w0 = stem.bitmap.width;
  const h0 = stem.bitmap.height;
  if (ctx.headClear) {
    clearPreexistingHead(stem);
  }
  const anchorUnrot = ctx.anchorPx
    ? ctx.anchorPx
    : { x: w0 * ctx.anchorRatio.x, y: h0 * ctx.anchorRatio.y };
  const anchor = anchorAfterStemRotate90Ccw(anchorUnrot, w0);
  await stem.rotate({ deg: 90, mode: true });
  const w = stem.bitmap.width;
  const h = stem.bitmap.height;

  const qw = qr.bitmap.width;
  const qh = qr.bitmap.height;
  // `--anchor` / `--anchor-ratio` set vertical join (`anchor.y`). Horizontal placement is centered
  // (`--qr-shift-x`, default 0; matches `plant-qr-canvas.ts`).
  const qrShift = ctx.qrShiftXPx !== undefined ? ctx.qrShiftXPx : 0;
  const qrCenterX = w / 2 + qrShift;
  // Bottom of the rotated QR AABB sits gap px above the anchor (stem/flower line).
  const left = Math.round(qrCenterX - qw / 2);
  const top = Math.round(anchor.y - qh - ctx.qrStemGap);
  blitQrClipped({ stem, qr, left, top, qw, qh });

  if (ctx.debug) {
    const x0 = Math.round(qrCenterX);
    const y0 = Math.round(anchor.y);
    const red = 0xff_00_00_ff;
    for (let d = -8; d <= 8; d += 1) {
      if (x0 + d >= 0 && x0 + d < w) stem.setPixelColor(red, x0 + d, y0);
      if (y0 + d >= 0 && y0 + d < h) stem.setPixelColor(red, x0, y0 + d);
    }
  }

  if (ctx.horizontal) {
    stem.rotate({ deg: ctx.hDeg, mode: true });
  }

  if (ctx.logoPath) {
    if (!existsSync(ctx.logoPath)) {
      throw new Error(`logo not found: ${ctx.logoPath}`);
    }
    const lo = await Jimp.read(ctx.logoPath);
    if (lo.bitmap.width > ctx.logoMaxW) {
      await lo.resize({ w: ctx.logoMaxW });
    }
    const W = stem.bitmap.width;
    const H = stem.bitmap.height;
    const lw = lo.bitmap.width;
    const lh = lo.bitmap.height;
    const m = 12;
    const lx = m;
    const ly = Math.max(m, H - lh - m);
    if (lx + lw <= W && ly + lh <= H) {
      stem.blit({ src: lo, x: lx, y: ly, srcX: 0, srcY: 0, srcW: lw, srcH: lh });
    }
  }

  const outDir = dirname(ctx.outFile);
  if (outDir && outDir !== ".") {
    try {
      mkdirSync(outDir, { recursive: true });
    } catch {
      // ignore; write may still succeed for cwd
    }
  }

  const outPng = await stem.getBuffer("image/png");
  writeFileSync(ctx.outFile, outPng);
  const ax = Math.round(qrCenterX);
  const ay = anchor.y | 0;
  const fw = stem.bitmap?.width ?? w;
  const fh = stem.bitmap?.height ?? h;
  const horizNote = ctx.horizontal ? `, then rotated ${ctx.hDeg}°` : "";
  console.log(
    `Wrote ${ctx.outFile} (${fw}×${fh}${horizNote}; layout anchor in vertical space ≈ ${ax},${ay})`,
  );
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exit(1);
}
