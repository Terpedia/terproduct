import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://terproduct.terpedia.com").replace(
  /\/$/,
  "",
);
const pfx = process.env.NEXT_PUBLIC_BASE_PATH || "";

const anyIcon = (sizes: string) => ({
  src: "./icon",
  type: "image/png" as const,
  sizes,
  purpose: "any" as const,
});

export default function manifest(): MetadataRoute.Manifest {
  const startUrl = "./";
  const id = pfx ? `${site}${pfx}/` : `${site}/`;

  return {
    id,
    name: "Terproduct by Terpedia",
    short_name: "Terproduct",
    description:
      "Document cannabis products: capture label photos, UPC, and look up the Terpedia catalog. Optimized for install and field use (PWA).",
    start_url: startUrl,
    scope: "./",
    lang: "en",
    dir: "ltr",
    display: "standalone",
    display_override: ["standalone", "browser"],
    orientation: "portrait",
    background_color: "#fafafa",
    theme_color: "#065f46",
    categories: ["medical", "lifestyle", "productivity", "health"],
    icons: [anyIcon("192x192"), anyIcon("512x512")],
    shortcuts: [
      {
        name: "Scan product",
        short_name: "Scan",
        description: "Label photos, nutrition panel, and UPC or barcode",
        url: "./scan/",
        icons: [anyIcon("192x192")],
      },
      {
        name: "Look up",
        short_name: "Lookup",
        description: "Search by name, UPC, or other codes",
        url: "./lookup/",
        icons: [anyIcon("192x192")],
      },
      {
        name: "Field",
        short_name: "Field",
        description: "Field console",
        url: "./field/",
        icons: [anyIcon("192x192")],
      },
      {
        name: "Device test",
        short_name: "Test",
        description: "Camera, barcode, and printer checks",
        url: "./device-test/",
        icons: [anyIcon("192x192")],
      },
    ],
  };
}
