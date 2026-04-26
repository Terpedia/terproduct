import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const standalone = process.env.STANDALONE === "1";

const nextConfig: NextConfig = {
  // Default: static `out/` for GitHub Pages + Supabase. Set STANDALONE=1 (Docker/Cloud Run) for Node on port PORT.
  output: standalone ? "standalone" : "export",
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
