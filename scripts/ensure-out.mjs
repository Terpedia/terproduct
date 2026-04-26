import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");
const pub = path.join(root, "public");

// `next build` with `output: "export"` already wrote `out/` (including `_next/`). Do not replace it.
if (fs.existsSync(path.join(out, "_next"))) {
  console.log("Next static export out/ present; skip Capacitor placeholder.");
  process.exit(0);
}

function copyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirContents(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, e.name);
    const to = path.join(dest, e.name);
    if (e.isDirectory()) copyDirContents(from, to);
    else copyFile(from, to);
  }
}

if (fs.existsSync(out)) {
  fs.rmSync(out, { recursive: true });
}
fs.mkdirSync(out, { recursive: true });
copyDirContents(pub, out);

const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Terproduct (Capacitor shell)</title>
  <style>body{font-family:system-ui,sans-serif;padding:1rem;max-width:32rem;line-height:1.5;}</style>
</head>
<body>
  <p>Native shell. Point <code>server.url</code> in <code>capacitor.config.ts</code> at
  <strong>https://terproduct.terpedia.com</strong> (or your <code>npm run dev</code> URL) so the WebView loads the app.
  <code>build:cap</code> copies <code>public/</code> here and replaces <code>index.html</code> for sync.</p>
</body>
</html>
`;

fs.writeFileSync(path.join(out, "index.html"), indexHtml, "utf8");
console.log("Wrote", out, "(Capacitor webDir)");
