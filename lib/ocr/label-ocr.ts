import type { Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

/**
 * Shared Tesseract worker (loaded once; English for US labels).
 * Call {@link terminateOcrWorker} when unmounting a long-lived screen.
 */
export function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker("eng");
    })();
  }
  return workerPromise;
}

export async function ocrFromCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const w = await getOcrWorker();
  const { data } = await w.recognize(canvas);
  return data.text?.trim() ?? "";
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) {
    return;
  }
  try {
    const w = await workerPromise;
    await w.terminate();
  } catch {
    /* ignore */
  }
  workerPromise = null;
}
