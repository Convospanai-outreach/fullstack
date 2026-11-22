import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page, PageHero, Section, Cards, Steps, CtaBand, SovereignBand } from "@/components/marketing/site/kit";
import { INDUSTRIES, MARKET_LABEL } from "@/lib/marketing/industries";
import { REGIONS, regionBySlug } from "@/lib/marketing/regions";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return REGIONS.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = regionBySlug((await params).slug);
  if (!r) return {};
  return { title: `${r.name} | CraftMyFunnel`, description: r.lead, alternates: { canonical: `https://craftmyfunnel.live/regions/${r.slug}` } };
}

export default async function RegionPage({ params }: Props) {
  const r = regionBySlug((await params).slug);
  if (!r) notFound();
  const industries = INDUSTRIES.filter((i) => !i.more && (i.market === r.market || i.market === "global" || r.market === "global"));
  return (
    <Page>
      <PageHero eyebrow={r.name} title={r.title} lead={r.lead} primary={{ label: "Discuss a pilot", href: "/contact" }} secondary={{ label: "See pricing", href: "/pricing" }} />
      <Section tone="light" eyebrow="Channels" title={r.channels}>
        <Cards items={r.scenarios.map((s, n) => ({ label: `Example ${n + 1}`, title: s }))} />
      </Section>
      <Section tone="white" title="How teams use it">
        <Steps items={[
          { title: "Select eligible accounts for one service and buyer group." },
          { title: "Prepare drafts from verified account context." },
          { title: "Review recipients and messages before any send." },
          { title: "Track replies, activity and the next commercial step." },
        ]} />
      </Section>
      <Section tone="navy" eyebrow="Responsible outreach check" title="Know the rules before you hit send.">
        <div className="ph-split">
          <p className="ph-lead">{r.guidance}</p>
          <p className="ph-lead" style={{ opacity: 0.8 }}>CraftMyFunnel supports preparation, approval and tracking. Your team remains responsible for lawful outreach, recipient eligibility, sender identification and unsubscribe handling. This is not legal advice. {r.pricing}</p>
        </div>
      </Section>
      <SovereignBand law={r.law} tone="teal" />
      <Section tone="beige" eyebrow={`Industries in ${r.name}`} title="Where it fits first.">
        <Cards items={industries.map((i) => ({ tag: MARKET_LABEL[i.market], title: i.name, href: `/industries/${i.slug}`, linkText: "Explore" }))} />
      </Section>
      <CtaBand title={`Start a 30-day pilot in ${r.name}.`} lead="One service, one cohort, a small eligible account set. We review results with you in week four." primary={{ label: "Talk to an expert", href: "/contact" }} />
    </Page>
  );
}
