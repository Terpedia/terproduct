import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  // Default: Node standalone for Cloud Run + Postgres. Set STATIC_EXPORT=1 only for static mirrors.
  output: staticExport ? "export" : "standalone",
  trailingSlash: true,
  basePath: basePath || undefined,
  images: { unoptimized: true },
  // Avoid picking a parent folder lockfile as the Turbopack root when other
  // projects exist alongside this repo.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
