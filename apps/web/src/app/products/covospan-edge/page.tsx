import { ProductPage, productMetadata } from "@/components/marketing/site/ProductPage";

export const metadata = productMetadata("covospan-edge");

export default function Page() {
  return <ProductPage slug="covospan-edge" />;
}
