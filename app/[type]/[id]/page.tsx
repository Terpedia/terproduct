import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DatabaseRequiredMessage } from "@/components/DatabaseRequiredMessage";
import {
  allTypeIdForStaticBuild,
  CATALOG_PLACEHOLDER_PRODUCT_SLUG,
  getIngredientById,
  getIngredientsForProduct,
  getProductBySlug,
  getProductsForIngredient,
  hasCatalog,
} from "@/lib/data/catalog";
import { publicBasePath } from "@/lib/public-base";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_TYPES = new Set(["product", "ingredient"]);

type PageProps = { params: Promise<{ type: string; id: string }> };

export async function generateStaticParams(): Promise<{ type: string; id: string }[]> {
  return allTypeIdForStaticBuild();
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { type, id } = await props.params;
  if (!hasCatalog() || !VALID_TYPES.has(type)) {
    return { title: "Terproduct" };
  }
  if (type === "product") {
    const p = await getProductBySlug(id);
    if (!p) return { title: "Not found" };
    return { title: `${p.name} — Terproduct` };
  }
  if (!UUID.test(id)) {
    return { title: "Ingredient" };
  }
  const ing = await getIngredientById(id);
  if (!ing) return { title: "Not found" };
  return { title: `${ing.name} — Terproduct` };
}

export default async function TypeIdPage(props: PageProps) {
  if (!hasCatalog()) {
    return <DatabaseRequiredMessage pathLabel="the catalog" />;
  }
  const { type, id } = await props.params;
  if (!VALID_TYPES.has(type)) {
    notFound();
  }
  const b = publicBasePath();

  if (type === "product") {
    const product = await getProductBySlug(id);
    if (!product) {
      if (id === CATALOG_PLACEHOLDER_PRODUCT_SLUG) {
        return <DatabaseRequiredMessage pathLabel="the catalog" />;
      }
      notFound();
    }
    const ingredients = await getIngredientsForProduct(product.id);
    return (
      <main className="mx-auto min-h-full max-w-2xl space-y-8 px-6 py-12">
        <nav>
          <Link
            className="text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-300"
            href={`${b}/`}
          >
            ← All products
          </Link>
        </nav>
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {product.name}
          </h1>
          {product.brand ? (
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-500">{product.brand}</p>
          ) : null}
          {product.gtin ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              GTIN / UPC: <span className="font-mono tabular-nums">{product.gtin}</span>
            </p>
          ) : null}
          {product.description ? (
            <p className="pt-2 text-zinc-700 dark:text-zinc-300">{product.description}</p>
          ) : null}
        </header>
        <section
          className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
          aria-labelledby="ing-heading"
        >
          <h2 id="ing-heading" className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Ingredients
          </h2>
          {ingredients.length === 0 ? (
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">No ingredients listed for this product.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {ingredients.map((ing) => (
                <li
                  key={ing.id}
                  className="border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800/80"
                >
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    <Link
                      className="text-emerald-800 hover:underline dark:text-emerald-300"
                      href={`${b}/ingredient/${ing.id}/`}
                    >
                      {ing.name}
                    </Link>
                  </p>
                  {ing.as_listed ? (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">As listed: {ing.as_listed}</p>
                  ) : null}
                  {ing.terpedia_analysis_url ? (
                    <p className="mt-1 text-sm">
                      <a
                        href={ing.terpedia_analysis_url}
                        rel="noreferrer"
                        className="text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        Terpene &amp; analysis on Terpedia
                      </a>
                    </p>
                  ) : null}
                  {ing.description ? (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{ing.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    );
  }

  if (!UUID.test(id)) {
    notFound();
  }
  const ingredient = await getIngredientById(id);
  if (!ingredient) {
    notFound();
  }
  const products = await getProductsForIngredient(ingredient.id);
  return (
    <main className="mx-auto min-h-full max-w-2xl space-y-8 px-6 py-12">
      <nav>
        <Link
          className="text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-300"
          href={`${b}/`}
        >
          ← All products
        </Link>
      </nav>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {ingredient.name}
        </h1>
        {ingredient.description ? (
          <p className="pt-1 text-zinc-700 dark:text-zinc-300">{ingredient.description}</p>
        ) : null}
        <p className="text-sm text-zinc-500">
          In {ingredient.productCount} product{ingredient.productCount === 1 ? "" : "s"}
        </p>
        {ingredient.terpedia_analysis_url ? (
          <p className="pt-2">
            <a
              href={ingredient.terpedia_analysis_url}
              rel="noreferrer"
              className="text-base font-medium text-emerald-800 hover:underline dark:text-emerald-300"
            >
              Open Terpene &amp; analysis on Terpedia →
            </a>
          </p>
        ) : null}
      </header>
      <section
        className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
        aria-labelledby="in-products-heading"
      >
        <h2 id="in-products-heading" className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Products
        </h2>
        {products.length === 0 ? (
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">This ingredient is not on any product yet.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-zinc-800 dark:text-zinc-200">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  className="font-medium text-emerald-800 hover:underline dark:text-emerald-300"
                  href={`${b}/product/${p.slug}/`}
                >
                  {p.name}
                </Link>
                {p.brand ? <span className="ml-2 text-sm text-zinc-500">— {p.brand}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
