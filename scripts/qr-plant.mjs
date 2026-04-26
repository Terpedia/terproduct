#!/usr/bin/env node
/**
 * Build a "plant QR" image: a fixed stem bitmap with a variable QR "flower"
 * rotated 45° (diamond) so the bottom corner sits on the stem top.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Jimp } from "jimp";
import QRCode from "qrcode";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STEM = join(__dirname, "qr-plant-assets", "stem.png");

const WHITE = 0xff_ff_ff_ff;

function parseNumberPair(s) {
  const p = s.split(/[,\s]+/).map(Number);
  if (p.length < 2 || p.some((n) => !Number.isFinite(n))) {
    throw new Error(`expected two numbers, got: ${s}`);
  }
  return { x: p[0], y: p[1] };
}

function help() {
  console.log(`Usage: node scripts/qr-plant.mjs <text-or-url> [options]

Renders a QR code on a fixed plant stem (see scripts/qr-plant-assets/stem.png),
rotated 45° clockwise (diamond), aligned so the bottom vertex of the square
sits on the top of the stem.

Options:
  -o, --out <file>         Output path (default: plant-qr.png in cwd)
  -s, --size <px>          QR module canvas size before rotation (default: 280)
  --rotate <deg>           Clockwise degrees (default: 45; use negative for CCW in output)
  --ec-level <L|M|Q|H>     Error correction (default: H; helps when rotated)
  -m, --margin <n>         QR quiet zone in modules (default: 2)
  --stem <path>            Stem PNG to composite onto (default: ${DEFAULT_STEM})
  --anchor "x,y"           Anchor in pixels: top of stem / bottom corner of diamond
  --anchor-ratio "x,y"     Same as --anchor, but 0..1 of stem width/height
                           (default: 0.5,0.26; ignored if --anchor is set)
  --debug                  Draw a small + at the anchor for tuning
  --no-head-clear         Skip the default white “erase” over the top-center
                           of the stem image (use when your --stem is already
                           just the plant with no old QR in it)
  --horizontal, -H         After compositing, rotate 90° so the stem is
                           left–right and the diamond QR is at the end
                           (default: --h-deg -90 in Jimp = 90° CW, bloom on
                           the right, stem to the left). Use --h-deg 90 to swap.
  --h-deg <n>             Degrees to rotate the final image when --horizontal
                           (default: -90; same sign as --rotate for QR, i.e. Jimp deg)

Example:
  node scripts/qr-plant.mjs "https://example.com" -o /tmp/qr-plant.png
  node scripts/qr-plant.mjs "https://example.com" --anchor-ratio 0.5,0.24
  node scripts/qr-plant.mjs "https://example.com" -H -o /tmp/qr-plant-h.png

PWA: Field screen → "Plant label" (same steps in-browser; system print on Android for integrated thermals).
`);
}

/** Paints a white trapezoid in the top-center to remove a pre-drawn “flower” */
function clearPreexistingHead(jimp, yTopMaxRatio = 0.36, hMargin = 0.1) {
  const w = jimp.bitmap.width;
  const h = jimp.bitmap.height;
  const yMax = Math.min(Math.floor(h * yTopMaxRatio), h);
  const x0 = Math.floor(w * hMargin);
  const x1 = Math.ceil(w * (1 - hMargin));
  for (let y = 0; y < yMax; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      jimp.setPixelColor(WHITE, x, y);
    }
  }
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
  let size = 280;
  let rotateCcwDeg = -45; // 45° clockwise: Jimp rotates counter-clockwise
  let ecLevel = "H";
  let margin = 2;
  let stemPath = DEFAULT_STEM;
  let anchorPx = null;
  let anchorRatio = { x: 0.5, y: 0.26 };
  let headClear = true;
  let debug = false;
  let horizontal = false;
  let hDeg = -90;

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
    } else if (a === "--no-head-clear") {
      headClear = false;
    } else if (a === "--horizontal" || a === "-H") {
      horizontal = true;
    } else if (a === "--h-deg") {
      hDeg = Number(argValue(argv, i, a));
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
    color: { dark: "#000000ff", light: "#ffffffff" },
  });

  const qr = await Jimp.read(buf);
  qr.background = WHITE;
  qr.rotate({ deg: ctx.rotateCcwDeg, mode: true });

  const stem = await Jimp.read(ctx.stemPath);
  const w = stem.bitmap.width;
  const h = stem.bitmap.height;
  if (ctx.headClear) {
    clearPreexistingHead(stem);
  }
  const anchor = ctx.anchorPx
    ? ctx.anchorPx
    : { x: w * ctx.anchorRatio.x, y: h * ctx.anchorRatio.y };

  const qw = qr.bitmap.width;
  const qh = qr.bitmap.height;
  // Bottom vertex of the diamond sits at the bottom-center of the rotated image.
  const left = Math.round(anchor.x - qw / 2);
  const top = Math.round(anchor.y - qh);

  stem.blit({ src: qr, x: left, y: top, srcX: 0, srcY: 0, srcW: qw, srcH: qh });

  if (ctx.debug) {
    const x0 = Math.round(anchor.x);
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
  const ax = anchor.x | 0;
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
