import { ComparePage, compareMetadata } from "@/components/marketing/site/ComparePage";

export const metadata = compareMetadata("apollo");

export default function Page() {
  return <ComparePage slug="apollo" />;
}
