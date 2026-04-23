/**
 * ESC/POS — GS ( k QR (Model 2) for 8-bit–clean, ASCII‑only payload.
 * Bluetooth `write()` serializes the string with UTF-8; command bytes are &lt; 0x80.
 * Keep payload in ASCII (typical for https:// URLs) so multi-byte UTF-8 does not
 * have to be split across writes.
 */
export function escposQrCodeAscii(
  data: string,
  opts: { size?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 } = {},
): Uint8Array {
  for (let i = 0; i < data.length; i += 1) {
    if (data.charCodeAt(i) > 0x7f) {
      throw new Error("QR print payload must be ASCII-only for this build.");
    }
  }
  const d = new TextEncoder().encode(data);
  const size = (opts.size ?? 6) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  // Model 2: GS ( k 04 00 31 41 32 00
  // Size:   GS ( k 03 00 31 43 n   n = 0x01–0x08 (module size)
  // Error L: GS ( k 03 00 31 45 30
  const p: number[] = [
    0x1b, 0x40, 0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00, 0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size, 0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30,
  ];
  // Store: GS ( k pL pH 31 50 30 + d[]
  const n = 3 + d.length;
  p.push(0x1d, 0x28, 0x6b, n & 0xff, (n >> 8) & 0xff, 0x31, 0x50, 0x30);
  for (const b of d) p.push(b);
  // Print, feed
  p.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30, 0x0a, 0x0a, 0x0a);
  return Uint8Array.from(p);
}

function bytesToBinaryStringForAndroidPlugin(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) {
    s += String.fromCharCode(b);
  }
  return s;
}

/**
 * @ascentio-it/capacitor-bluetooth-serial `write` uses `String.getBytes(UTF_8)`.
 * All values here are &lt; 0x80, so one UTF-8 byte per char — safe.
 */
export function uint8ToPluginWriteString(buf: Uint8Array): string {
  if (buf.some((b) => b > 0x7f)) {
    throw new Error("Buffer has bytes >0x7f; not supported with current Bluetooth string API.");
  }
  return bytesToBinaryStringForAndroidPlugin(buf);
}
