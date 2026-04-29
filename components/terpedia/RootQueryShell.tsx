"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { IngredientTerpediaView } from "@/components/terpedia/IngredientTerpediaView";
import { ProductTerpediaView } from "@/components/terpedia/ProductTerpediaView";

function RouterBody({ children }: { children: ReactNode }) {
  const sp = useSearchParams();
  const p = sp.get("p");
  /** UPC-oriented deep link (same product view as ?p=; used by label QRs). */
  const u = sp.get("u");
  /** Preferred label query key (same behavior as ?u=). */
  const upc = sp.get("upc");
  const i = sp.get("i");

  if (p && p.trim()) {
    return <ProductTerpediaView id={p.trim()} />;
  }
  if (u && u.trim()) {
    return <ProductTerpediaView id={u.trim()} linkParam="u" />;
  }
  if (upc && upc.trim()) {
    return <ProductTerpediaView id={upc.trim()} linkParam="upc" />;
  }
  if (i && i.trim()) {
    return <IngredientTerpediaView name={i.trim()} />;
  }
  return <>{children}</>;
}

export function RootQueryShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-zinc-600 dark:text-zinc-400">
          Loading…
        </div>
      }
    >
      <RouterBody>{children}</RouterBody>
    </Suspense>
  );
}
