import type { Metadata } from "next";
import { Suspense } from "react";

import { TerproductUpcQrPanel } from "@/components/TerproductUpcQrPanel";

export const metadata: Metadata = {
  title: "UPC label QR",
  description:
    "Build a plant-style QR for terproduct.terpedia.com that encodes a UPC in the ?upc= query.",
};

export default function QrPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-1 px-4 py-6 md:py-10">
      <h1 className="text-2xl font-semibold">UPC label QR</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Generate a Terpedia product link and the printable plant QR. Opens{" "}
        <code className="rounded bg-zinc-200/50 px-1.5 text-[12px] dark:bg-zinc-800">https://terproduct.terpedia.com/?upc=</code>{" "}
        with the encoded UPC. Android intents:{" "}
        <code className="rounded bg-zinc-200/50 px-1 text-[11px] dark:bg-zinc-800">
          ?auto=1&amp;print=1&amp;horizontal=1
        </code>{" "}
        builds the −90° roll layout and opens system print; <code className="text-[11px]">roll=1</code> is an alias for{" "}
        <code className="text-[11px]">horizontal=1</code>.
      </p>
      <Suspense
        fallback={
          <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        }
      >
        <TerproductUpcQrPanel />
      </Suspense>
    </main>
  );
}
