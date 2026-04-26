"use client";

import { useEffect } from "react";

import { publicBasePath } from "@/lib/public-base";

/**
 * GitHub project Pages use `/terproject/` on the `*.github.io` host, so people
 * often try the same path on the custom domain. The app is served at `/` here;
 * this route avoids a bare 404.
 */
export default function TerprojectAliasRedirect() {
  const base = publicBasePath();

  useEffect(() => {
    window.location.replace((base + "/").replace(/\/\//g, "/"));
  }, [base]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-zinc-700 dark:text-zinc-300">
      <p>Redirecting to the app…</p>
      <p className="mt-2 text-sm">
        <a className="font-medium text-emerald-800 dark:text-emerald-300" href={base + "/"}>
          Home
        </a>
      </p>
    </main>
  );
}
