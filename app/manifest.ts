import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Terproduct",
    short_name: "Terproduct",
    description: "Terpedia product scanner and lookup (PWA).",
    // Resolve relative to this manifest so GitHub Pages + basePath stay correct.
    start_url: "./",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafafa",
    theme_color: "#065f46",
    icons: [
      {
        src: "./icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
