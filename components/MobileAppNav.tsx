"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { publicBasePath } from "@/lib/public-base";

const items = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/scan/", label: "Scan", Icon: ScanIcon },
  { href: "/lookup/", label: "Lookup", Icon: SearchIcon },
  { href: "/field/", label: "Field", Icon: FieldIcon },
  { href: "/device-test/", label: "Test", Icon: WrenchIcon },
] as const;

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.8}
      aria-hidden
    >
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-5H9v5H4a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

function ScanIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.8}
      aria-hidden
    >
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H9" />
      <path d="M5 4v3.5" />
      <path d="M4 16.5A2.5 2.5 0 0 0 6.5 19H9" />
      <path d="M5 20v-3.5" />
      <path d="M20 7.5A2.5 2.5 0 0 0 17.5 5H15" />
      <path d="M19 4v3.5" />
      <path d="M20 16.5A2.5 2.5 0 0 1 17.5 19H15" />
      <path d="M19 20v-3.5" />
      <rect x="9" y="9" width="6" height="6" rx="0.5" />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.8}
      aria-hidden
    >
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M15 15 21 21" />
    </svg>
  );
}

function FieldIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.8}
      aria-hidden
    >
      <path d="M7 3h4l7 7-4 4-7-7V3Z" />
      <path d="M14.5 10.5 4 21" />
    </svg>
  );
}

function WrenchIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.8}
      aria-hidden
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.35 6.35a2 2 0 0 1-2.83-2.83l6.35-6.35a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function normalizePath(p: string) {
  if (p.length > 1 && p.endsWith("/")) return p;
  if (p === "/") return p;
  return `${p}/`;
}

function stripBasePath(path: string) {
  const pfx = publicBasePath();
  if (pfx && path.startsWith(pfx)) {
    return path.slice(pfx.length) || "/";
  }
  return path;
}

export function MobileAppNav() {
  const raw = usePathname() || "/";
  const base = useMemo(() => normalizePath(stripBasePath(raw)), [raw]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 shadow-[0_-2px_12px_rgba(0,0,0,0.04)] backdrop-blur-md md:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
        {items.map(({ href, label, Icon }) => {
          const normalizedHref = href === "/" ? "/" : normalizePath(href);
          const isHome = normalizedHref === "/";
          const active = isHome ? base === "/" : base.startsWith(normalizedHref);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                className={
                  active
                    ? "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-emerald-800 dark:text-emerald-300"
                    : "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }
                aria-current={active ? "page" : undefined}
              >
                <Icon active={active} />
                <span className="max-w-full truncate text-[11px] font-semibold leading-tight">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
