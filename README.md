# Terproduct

**Terpedia** product catalog: **products → ingredients → CoA (certificate of analysis) → compound results**.

Live site: [terproduct.terpedia.com](https://terproduct.terpedia.com) when DNS (CNAME) and hosting point at a **Node** server; set **`DATABASE_URL`** to a Postgres (or Supabase) **connection string** with the migrations in `supabase/migrations/` applied. The app serves **PWA** (scan, lookup, field) from the same origin and **catalog** pages: `/` (product list), `/product/[slug]/` (ingredients and links to Terpedia analysis when `ingredients.terpedia_analysis_url` is set), and `/ingredient/[id]/`.

A **static GitHub Pages** deploy is **not** the default anymore (it conflicted with dynamic product routes). The workflow in `.github/workflows/deploy-github-pages.yml` is a no-op placeholder. An older [GitHub Pages project URL](https://terpedia.github.io/terproduct/) may be stale if it was from the pre-server layout.

## Repository

- GitHub: [Terpedia/terproduct](https://github.com/Terpedia/terproduct)

## PWA (scan & lookup)

The production build uses **`output: "standalone"`** and runs on Node. The PWA (manifest, service worker) still works over HTTPS for `/scan/`, `/lookup/`, `/field/`, and the home catalog when `DATABASE_URL` is set.

- **`/scan/`** — camera barcode/QR scanning where the browser supports the [Barcode Detection API](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector) (Chrome/Edge; Safari often lacks it). Manual code entry links to lookup.
- **`/lookup/`** — client-side search over `public/data/products.json` (demo catalog). Connect your API when the ingest backend is available.
- **Installable** — `manifest.webmanifest`, standalone display, theme color, and a small **service worker** (`public/sw.js`) that precaches shell routes and caches same-origin GETs for offline use.
- **`/field/`** — also used by the **Capacitor** shell (see below).

## Capacitor: iOS & Android

The repo includes **`android/`** and **`ios/`** (Capacitor 8). `npm run build:cap` runs a **Next** production build, then `scripts/ensure-out.mjs` (copies `public/` into `out/` and a small placeholder `index.html` so `npx cap sync` has a `webDir`). In production, set **`server.url`** in `capacitor.config.ts` to the deployed app (e.g. `https://terproduct.terpedia.com`) so the WebView loads the real site.

- **`/field/`** field console: **ML Kit** `scan()` (UPC/EAN, QR, Code 128, …) → `POST` ingest JSON to your API → **Android**: ESC/POS over **Bluetooth classic SPP** (`@ascentio-it/capacitor-bluetooth-serial`) to a paired thermal; **iOS**: **Share** a **QR PNG** (Bluetooth serial plugin is Android-only; use share sheet to open a manufacturer print app or AirDrop).
- **Configure the ingest base URL** at build time: `NEXT_PUBLIC_TERPRODUCT_API_URL` (e.g. `https://api.terpedia.com`), and optionally `NEXT_PUBLIC_TERPRODUCT_API_KEY` for a `Bearer` token. The client posts to `{base}/ingest` (implement that route on your backend; shape is in `lib/api/terproduct-submit.ts`).
- **Build & sync** after web changes: `npm run build:cap` (runs `next build`, `ensure-out`, and `npx cap sync`), then `npm run android` or `npm run ios` (requires **Android Studio** / **Xcode**).
- **ESC/POS QR** uses a minimal GS (k) model-2 path with **ASCII-only** payload; extend `lib/printing/escpos-qr.ts` if you need full UTF-8 and raw byte writes. **Branded Android POS** units with an **in-built USB/serial printer** (e.g. some Sunmi models) may need the vendor AIDL/SDK instead of generic SPP—this project is a **generic SPP+ESC/POS** baseline.
- **iOS + Google ML Kit:** the default app uses **Swift PM** for some plugins. `@capacitor-mlkit/barcode-scanning` is distributed as **CocoaPods**; if the barcode plugin does not resolve in Xcode, follow the [Capawesome ML Kit Barcode iOS](https://capawesome.io/plugins/mlkit/barcode-scanning/) install notes (CocoaPods / `pod install` as required).

Local preview of the **server** build:

```bash
export DATABASE_URL="postgres://user:pass@host:5432/db"   # optional: enables catalog
npm run build
node .next/standalone/server.js
```

(Use the same `DATABASE_URL` in Docker; see `Dockerfile`.)

## Data model

| Layer | Role |
| --- | --- |
| **products** | Finished goods (name, slug, brand, optional `gtin` for retail UPC/EAN). |
| **ingredients** | Materials; linked to products via **product_ingredients** and optional `as_listed` (label text). Optional **`terpedia_analysis_url`** links to terpene/analysis pages. |
| **product_label_ingredient_lines** | Ordered **label declaration** lines (scan/paste) tied to a product; can resolve to **ingredients** over time. |
| **coa_documents** | Lab reports for an ingredient (batch/lot, lab, dates, file URL). |
| **compounds** | Canonical analytes (name, CAS, category). |
| **coa_compound_results** | Measured values per CoA and compound (value, unit, ND flags). |

**Retail UPC + ingredients:** scan or enter a **GTIN** (8/12/13/14 digit family), paste the **ingredient / “contains”** list, and submit a correlation from **`/field/`** — payload event `upc_ingredients_correlation` (see `lib/api/terproduct-submit.ts` and `lib/gtin.ts`). The ingest API can upsert `products.gtin`, create rows in `product_label_ingredient_lines`, and map lines to `ingredients` (and to **CoA** tracks per ingredient) as you implement matching rules.

PostgreSQL: run migrations under `supabase/migrations/` (e.g. `20260418000000_initial_schema.sql`, `20260423000000_commercial_gtin_ingredients.sql`, `20260424000000_ingredient_analysis_url.sql` for `terpedia_analysis_url`).  
TypeScript types: `lib/domain.ts`.

```mermaid
flowchart LR
  P[products] --> PI[product_ingredients]
  I[ingredients] --> PI
  I --> C[coa_documents]
  C --> R[coa_compound_results]
  CP[compounds] --> R
```

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build
npm run lint
npm start
```

`npm start` runs the **standalone** server: `node .next/standalone/server.js` (after `npm run build`). For a **local static** copy from an older `output: "export"` workflow, you can use `npx serve out` with `start:static`. `next dev` is the usual way to work locally.

## Cloudflare: `terproduct.terpedia.com`

In the Cloudflare dashboard for **terpedia.com** → **DNS** → **Records**:

1. Add a **CNAME** record:
   - **Name:** `terproduct`
   - **Target:** the hostname of your app host (VPS, Docker + reverse proxy, Cloud Run, or similar) — the place running `node` / the container from `Dockerfile` on the expected port.
   - **Proxy status:** Proxied (orange cloud) unless your host requires DNS-only.

2. If you use **Cloudflare** in front of that origin, add `terproduct.terpedia.com` in your DNS/SSL config so TLS terminates correctly.

### API alternative (token required)

With `CLOUDFLARE_API_TOKEN` (Zone → DNS → Edit) and zone ID for `terpedia.com`:

```bash
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"terproduct","content":"YOUR_HOSTNAME","proxied":true}'
```

Replace `YOUR_HOSTNAME` with the **Cloud Run** service URL’s host (e.g. `terproduct-xxx-uc.a.run.app`) or a **load balancer** host you configure; you can also add a custom domain in Cloud Run and use that host for the CNAME when DNS is ready.

## Deploy

- **Google Cloud Run (see below):** `cloudbuild.yaml` builds the image, pushes to **Artifact Registry**, and deploys a service. Set **`DATABASE_URL`** (and optional Cloud SQL) on the service after the first deploy.
- **VPS or any Docker host:** `docker build -t terproduct .` and run with **`-e PORT=3000 -e DATABASE_URL=... -p 3000:3000`**. For production HTTP, set **`NEXT_PUBLIC_SITE_URL`** at **build** time to your public origin. Leave **`NEXT_PUBLIC_BASE_PATH`** empty for root path.
- **Node without Docker:** `npm ci && npm run build` then `DATABASE_URL=... node .next/standalone/server.js` (optional **`PORT=3000`** for local).
- **Env:** **`DATABASE_URL`** (Postgres/Supabase connection string) is required for catalog data. Apply migrations on that database first.
- **Base path / GitHub `io` subpaths:** if you still host a **separate** static app under `/terproduct`, set **`NEXT_PUBLIC_BASE_PATH=/terproduct`**. The default server in this repo assumes **origin = `https://terproduct.terpedia.com`**.

**GitHub Pages** — the old static workflow is **disabled**; a future static mirror would need a dedicated export profile without dynamic product routes. See the workflow file header.

### Google Cloud (Cloud Run + Cloud Build)

The repo includes **`cloudbuild.yaml`**: it runs **`docker build`** (with **`_SITE`** as **`NEXT_PUBLIC_SITE_URL`**) for the PWA metadata, **pushes** to **Artifact Registry**, and **`gcloud run deploy`**.

1. **APIs and Artifact Registry (once per project)**  
   ```bash
   gcloud config set project YOUR_GCP_PROJECT
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   gcloud artifacts repositories create terproduct \
     --repository-format=docker --location=REGION
   ```  
   Use the same **REGION** for the registry and for Cloud Run (e.g. `us-central1`).

2. **Let Cloud Build deploy to Cloud Run**  
   The default build service account is `PROJECT_NUMBER@cloudbuild.gserviceaccount.com`. Grant it (at least):
   - **Artifact Registry:** `roles/artifactregistry.writer` on the project or repository.
   - **Cloud Run:** `roles/run.admin` on the project.
   - **Impersonation:** `roles/iam.serviceAccountUser` on the **Compute Engine default** service account (the one Cloud Run uses to run revisions), often `PROJECT_NUMBER-compute@developer.gserviceaccount.com`, so the build can deploy a new revision.

3. **Build and deploy** (from a machine with `gcloud` and the repo):
   ```bash
   gcloud builds submit --config cloudbuild.yaml
   ```  
   Override defaults (region, public URL baked into the client, service name) with **substitutions**, for example:
   ```bash
   gcloud builds submit --config cloudbuild.yaml \
     --substitutions=_REGION=europe-west1,_SITE=https://terproduct.terpedia.com
   ```  
   Changing **`_SITE`** or **`NEXT_PUBLIC_*`** requires a **new image** (re-run the build).

4. **Postgres: `DATABASE_URL` on the service**  
   After the service exists, set the connection string the app uses at runtime, for example with **Secret Manager**:
   ```bash
   # create secret (once)
   echo -n 'postgres://...' | gcloud secrets create database-url --data-file=-
   gcloud secrets add-iam-policy-binding database-url \
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   gcloud run services update terproduct --region=REGION \
     --set-secrets=DATABASE_URL=database-url:latest
   ```  
   (Replace service name/region and use your project’s default Run identity if you use a custom one.) For **Cloud SQL** with a **Unix socket**, use the appropriate **`pg` connection string** and add **`--add-cloudsql-instances=PROJECT:REGION:INSTANCE`** to the **Cloud Run** service so the proxy sidecar is available.

5. **Custom domain**  
   In **Cloud Run** → your service → **Custom domains**, add **`terproduct.terpedia.com`**, then point the **Cloudflare** (or DNS) CNAME to the target Google provides. TLS is managed for you on **run.app**; custom domains follow the Cloud Run **domain mapping** flow.

6. **CI (optional)**  
   You can connect **Cloud Build** to your GitHub repo (triggers) or run **`gcloud builds submit`** from **GitHub Actions** with [Workload Identity Federation](https://github.com/google-github-actions/auth#workload-identity-federation) so you do not store long‑lived JSON keys in GitHub.
