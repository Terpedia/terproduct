import Link from "next/link";

import { BarcodePanel } from "@/components/scan/BarcodePanel";
import { ProductIntakeCapture } from "@/components/scan/ProductIntakeCapture";

export default function ScanPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6 md:py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Scan &amp; document</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Capture a full product set for identification: all label panels, then the UPC or other
          codes. From codes, go to{" "}
          <Link href="/lookup/" className="text-emerald-800 underline dark:text-emerald-400">
            Lookup
          </Link>{" "}
          to match the catalog. Install this site as a PWA from the browser for a full-screen, home
          screen app with quick access to this screen and lookup.
        </p>
      </div>

      <ProductIntakeCapture />
      <BarcodePanel />
    </div>
  );
}
