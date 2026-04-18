import { Suspense } from "react";

import { LookupPanel } from "@/components/LookupPanel";

export default function LookupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-zinc-600 dark:text-zinc-400">
          Loading lookup…
        </div>
      }
    >
      <LookupPanel />
    </Suspense>
  );
}
