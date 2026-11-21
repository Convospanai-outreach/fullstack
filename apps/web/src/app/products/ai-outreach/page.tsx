import { ProductPage, productMetadata } from "@/components/marketing/site/ProductPage";

export const metadata = productMetadata("ai-outreach");

export default function Page() {
  return <ProductPage slug="ai-outreach" />;
}
