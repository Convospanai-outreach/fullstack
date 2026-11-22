import type { Metadata } from "next";
import { Page, PageHero, Section, Cards, CtaBand } from "@/components/marketing/site/kit";
import { COMPARISONS } from "@/lib/marketing/compare";

export const metadata: Metadata = {
  title: "Compare CraftMyFunnel | Apollo, Instantly, Lemlist",
  description: "How CraftMyFunnel compares with Apollo.io, Instantly and Lemlist, and when each tool is the better pick.",
  alternates: { canonical: "https://craftmyfunnel.live/vs" },
};

export default function ComparePage() {
  return (
    <Page>
      <PageHero eyebrow="Compare" title="Honest comparisons. Including when to pick someone else." lead="Sequencers and databases are built for volume. CraftMyFunnel is built for B2B service firms that need timing, review and follow-through." primary={{ label: "Talk to an expert", href: "/contact" }} />
      <Section tone="light" title="Comparisons">
        <Cards items={COMPARISONS.map((c) => ({ label: "CraftMyFunnel vs", title: c.name, body: c.summary, href: `/vs/${c.slug}`, linkText: "Read comparison" }))} />
      </Section>
      <CtaBand title="Not sure which fits?" lead="Tell us your market and motion. We'll tell you straight." primary={{ label: "Contact us", href: "/contact" }} />
    </Page>
  );
}
