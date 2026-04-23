import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/field/", label: "Field" },
  { href: "/scan/", label: "Scan" },
  { href: "/lookup/", label: "Lookup" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-emerald-900 dark:text-emerald-300"
        >
          Terproduct
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-2 py-1 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
