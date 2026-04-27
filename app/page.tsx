import { RootQueryShell } from "@/components/terpedia/RootQueryShell";
import { CatalogHome, MarketingHome, NoSupabaseCallout } from "@/components/MarketingHome";
import { hasCatalog, listProducts } from "@/lib/data/catalog";

export default async function Home() {
  if (!hasCatalog()) {
    return (
      <RootQueryShell>
        <NoSupabaseCallout />
        <MarketingHome />
      </RootQueryShell>
    );
  }
  const products = await listProducts(200);
  return (
    <RootQueryShell>
      <CatalogHome products={products} />
    </RootQueryShell>
  );
}
