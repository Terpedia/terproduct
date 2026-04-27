import Link from "next/link";

import { ScanSession } from "@/components/scan/ScanSession";

export default function ScanPage() {
  return (
    <div className="mx-auto flex min-h-0 max-w-2xl flex-1 flex-col">
      <div className="shrink-0 px-4 py-4 md:py-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Scan</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Live camera on top; UPC, label text, and product details update as you scan. A hardware
          imager (often called “infrared” on PDAs) usually types digits like a keyboard—so it can run
          in parallel with the camera. For manual search, use{" "}
          <Link href="/lookup/" className="text-emerald-800 underline dark:text-emerald-400">
            Lookup
          </Link>
          .
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ScanSession />
      </div>
    </div>
  );
}
