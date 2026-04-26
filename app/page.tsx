import { CatalogHome, MarketingHome, NoSupabaseCallout } from "@/components/MarketingHome";
import { hasCatalog, listProducts } from "@/lib/data/catalog";

export default async function Home() {
  if (!hasCatalog()) {
    return (
      <>
        <NoSupabaseCallout />
        <MarketingHome />
      </>
    );
  }
  const products = await listProducts(200);
  return <CatalogHome products={products} />;
}
