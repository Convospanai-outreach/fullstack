import { ProductPage, productMetadata } from "@/components/marketing/site/ProductPage";

export const metadata = productMetadata("buyer-signals");

export default function Page() {
  return <ProductPage slug="buyer-signals" />;
}
