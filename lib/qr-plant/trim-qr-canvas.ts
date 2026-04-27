/**
 * Remove uniform border (same color as top-left pixel) from a canvas. Matches the effect of
 * Jimp’s `autocrop` for white-margined QR PNGs so the diamond blit is no larger than needed.
 */
export function trimUniformBorderFromCanvas(
  source: HTMLCanvasElement,
  tolerance = 4,
): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  if (w < 1 || h < 1) {
    return source;
  }
  const ctx = source.getContext("2d");
  if (!ctx) {
    return source;
  }
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const r0 = d[0] ?? 0;
  const g0 = d[1] ?? 0;
  const b0 = d[2] ?? 0;
  const a0 = d[3] ?? 0;

  const isBg = (i: number) => {
    if (i < 0 || i + 3 >= d.length) {
      return true;
    }
    return (
      Math.abs((d[i] ?? 0) - r0) <= tolerance &&
      Math.abs((d[i + 1] ?? 0) - g0) <= tolerance &&
      Math.abs((d[i + 2] ?? 0) - b0) <= tolerance &&
      Math.abs((d[i + 3] ?? 0) - a0) <= tolerance
    );
  };

  let top = 0;
  let bottom = h - 1;
  let left = 0;
  let right = w - 1;

  row: for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!isBg((y * w + x) * 4)) {
        top = y;
        break row;
      }
    }
  }
  row2: for (let y = h - 1; y >= top; y -= 1) {
    for (let x = 0; x < w; x += 1) {
      if (!isBg((y * w + x) * 4)) {
        bottom = y;
        break row2;
      }
    }
  }
  col: for (let x = 0; x < w; x += 1) {
    for (let y = top; y <= bottom; y += 1) {
      if (!isBg((y * w + x) * 4)) {
        left = x;
        break col;
      }
    }
  }
  col2: for (let x = w - 1; x >= left; x -= 1) {
    for (let y = top; y <= bottom; y += 1) {
      if (!isBg((y * w + x) * 4)) {
        right = x;
        break col2;
      }
    }
  }

  const cw = right - left + 1;
  const ch = bottom - top + 1;
  if (cw < 1 || ch < 1) {
    return source;
  }
  if (cw === w && ch === h) {
    return source;
  }

  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  const o = out.getContext("2d");
  if (!o) {
    return source;
  }
  o.putImageData(ctx.getImageData(left, top, cw, ch), 0, 0);
  return out;
}

/**
 * After rendering a QR with opaque white light modules (for border trim), set near-white
 * pixels to fully transparent so the underlying stem is visible in “light” areas.
 */
export function stripNearWhiteToTransparent(
  c: HTMLCanvasElement,
  threshold = 250,
): void {
  const ctx = c.getContext("2d");
  if (!ctx) {
    return;
  }
  const w = c.width;
  const h = c.height;
  if (w < 1 || h < 1) {
    return;
  }
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    if (r >= threshold && g >= threshold && b >= threshold) {
      data[i + 3] = 0;
    }
  }
  ctx.putImageData(new ImageData(data, w, h), 0, 0);
}
