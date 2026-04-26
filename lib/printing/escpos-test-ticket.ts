import { escposQrCodeAscii } from "./escpos-qr";

function concatU8(a: Uint8Array, b: Uint8Array): Uint8Array {
  const o = new Uint8Array(a.length + b.length);
  o.set(a, 0);
  o.set(b, a.length);
  return o;
}

/** ESC/POS init (reset) + ASCII lines + line feeds. All chars must be U+00–U+7F. */
export function escposAsciiTicketFromLines(lines: string[]): Uint8Array {
  const p: number[] = [0x1b, 0x40];
  for (const line of lines) {
    for (let i = 0; i < line.length; i += 1) {
      if (line.charCodeAt(i) > 0x7f) {
        throw new Error("ESC/POS test ticket: ASCII only.");
      }
      p.push(line.charCodeAt(i));
    }
    p.push(0x0a);
  }
  p.push(0x0a, 0x0a, 0x0a);
  return Uint8Array.from(p);
}

/**
 * One job: self-test text (good for SPP / printer smoke test without QR).
 * Uses only bytes &lt; 0x80 (safe for the Capacitor Bluetooth string API).
 */
export function buildTerproductHardwareTextTicket(
  linePrefix = "Terproduct / Unisoc / Android",
): Uint8Array {
  const t = new Date();
  return escposAsciiTicketFromLines([
    "==== TERPRODUCT HW TEST ====",
    t.toISOString(),
    linePrefix,
    "If you can read this, the printer",
    "received ESC/POS over Bluetooth.",
    "---- end ----",
  ]);
}

/**
 * Appends a small QR (ASCII URL) after a text block in one print job. Drops the
 * duplicate `ESC @` that `escposQrCodeAscii` adds so the buffer has a single init.
 */
export function buildTerproductTextPlusQrTicket(qrDataAscii: string): Uint8Array {
  const text = buildTerproductHardwareTextTicket("Text + QR combined job");
  const qr = escposQrCodeAscii(qrDataAscii, { size: 3 });
  if (qr[0] !== 0x1b || qr[1] !== 0x40) {
    throw new Error("Unexpected QR buffer layout.");
  }
  return concatU8(text, qr.subarray(2));
}
