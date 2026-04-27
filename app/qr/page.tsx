import type { Metadata } from "next";

import { TerproductUpcQrPanel } from "@/components/TerproductUpcQrPanel";

export const metadata: Metadata = {
  title: "UPC label QR",
  description:
    "Build a plant-style QR for terproduct.terpedia.com that encodes a UPC in the ?u= query.",
};

export default function QrPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-1 px-4 py-6 md:py-10">
      <h1 className="text-2xl font-semibold">UPC label QR</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Generate a Terpedia product link and the printable plant QR. Opens{" "}
        <code className="rounded bg-zinc-200/50 px-1.5 text-[12px] dark:bg-zinc-800">https://terproduct.terpedia.com/?u=</code>{" "}
        with the encoded UPC.
      </p>
      <TerproductUpcQrPanel />
    </main>
  );
}
