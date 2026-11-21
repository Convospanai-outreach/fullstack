import { ProductPage, productMetadata } from "@/components/marketing/site/ProductPage";

export const metadata = productMetadata("human-layer");

export default function Page() {
  return <ProductPage slug="human-layer" />;
}
