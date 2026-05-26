import Link from "next/link";

const apkUrl = "https://github.com/Terpedia/terproduct/releases/latest/download/terproduct-latest.apk";
const releasesUrl = "https://github.com/Terpedia/terproduct/releases/latest";

export const metadata = {
  title: "Install Terproduct",
  description: "Install the Terproduct Android APK from the latest GitHub Release.",
};

export default function InstallPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col gap-6 px-5 py-8 md:px-6 md:py-14">
      <header className="space-y-3">
        <Link href="/" className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
          Back to Terproduct
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Install Android app
        </h1>
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Download the latest signed Terproduct APK for the Android handheld.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <a
          href={apkUrl}
          className="block rounded-lg bg-emerald-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Download latest APK
        </a>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>Open this page on the Android handheld.</li>
          <li>Download the APK.</li>
          <li>Allow installation from the browser if Android asks.</li>
          <li>Open the downloaded APK to update Terproduct.</li>
        </ol>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
          Android will only update the existing app if the APK is signed with the same release key and has
          a higher version code.
        </p>
      </section>

      <a
        href={releasesUrl}
        className="text-sm font-medium text-zinc-700 underline underline-offset-4 dark:text-zinc-300"
      >
        View latest GitHub Release
      </a>
    </main>
  );
}
