import Link from "next/link";

import { publicBasePath } from "@/lib/public-base";

type Props = { pathLabel: string };

export function DatabaseRequiredMessage({ pathLabel }: Props) {
  const b = publicBasePath();
  return (
    <main className="mx-auto min-h-full max-w-2xl px-6 py-12">
      <p className="text-zinc-700 dark:text-zinc-300">
        Configure <code className="font-mono text-sm">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-sm">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> for this build. Then
        {pathLabel} can load the catalog.
      </p>
      <p className="mt-4">
        <Link
          className="font-medium text-emerald-800 hover:underline dark:text-emerald-300"
          href={`${b}/`}
        >
          Back to home
        </Link>
      </p>
    </main>
  );
}
