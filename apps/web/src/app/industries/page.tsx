import type { Metadata } from "next";
import { Page, PageHero, Section, Cards, CtaBand } from "@/components/marketing/site/kit";
import { INDUSTRIES, MARKET_LABEL } from "@/lib/marketing/industries";
import { REGIONS } from "@/lib/marketing/regions";

export const metadata: Metadata = {
  title: "Industries | CraftMyFunnel",
  description: "Where governed, signal-led outreach pays off first: cybersecurity, MSPs and SAP partners in the US and EU; GCC services, staffing and DPDP consulting in India.",
  alternates: { canonical: "https://craftmyfunnel.live/industries" },
};

export default function IndustriesPage() {
  const group = (m: string) => INDUSTRIES.filter((i) => i.market === m || (m === "us-eu" && i.market === "global"));
  const card = (i: (typeof INDUSTRIES)[number]) => ({ tag: MARKET_LABEL[i.market], title: i.name, body: i.lead, href: `/industries/${i.slug}`, linkText: "Explore" });
  return (
    <Page>
      <PageHero eyebrow="Industries" title="Every industry has a buying window. We help you be there when it opens." lead="We focus on B2B service firms whose buyers are being pushed to act now, by regulation, deadlines or rapid expansion." primary={{ label: "Talk to our team", href: "/contact" }} secondary={{ label: "See pricing", href: "/pricing" }} />
      <Section tone="light" eyebrow="United States & Europe" title="Compliance and deadlines are creating new buyers." lead="NIS2, DORA and the SAP ECC 2027 deadline turned optional projects into required ones.">
        <Cards items={group("us-eu").map(card)} />
      </Section>
      <Section tone="navy" eyebrow="India" title="The GCC boom and DPDP are reshaping who buys services." lead="New capability centres need workplace, security and staffing partners, and every business needs a privacy plan before May 2027.">
        <Cards dark items={group("india").map(card)} />
      </Section>
      <Section tone="beige" eyebrow="Markets" title="Rules and channels differ by market. Your workflow should too.">
        <Cards cols={3} items={REGIONS.map((r) => ({ label: r.name, title: r.channels, href: `/regions/${r.slug}`, linkText: `${r.name} guide` }))} />
      </Section>
      <CtaBand title="Don't see your industry?" lead="If you sell a considered B2B service and lose deals to slow follow-up, we should talk." primary={{ label: "Talk to an expert", href: "/contact" }} />
    </Page>
  );
}
