import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page, PageHero, Section, Cards, Steps, Stats, Checklist, Faq, CtaBand, JsonLd } from "@/components/marketing/site/kit";
import { INDUSTRIES, MARKET_LABEL, industryBySlug } from "@/lib/marketing/industries";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return INDUSTRIES.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const i = industryBySlug((await params).slug);
  if (!i) return {};
  return { title: `${i.name} | CraftMyFunnel`, description: i.lead, alternates: { canonical: `https://craftmyfunnel.live/industries/${i.slug}` } };
}

export default async function IndustryPage({ params }: Props) {
  const i = industryBySlug((await params).slug);
  if (!i) notFound();
  const others = INDUSTRIES.filter((o) => o.slug !== i.slug).slice(0, 3);
  return (
    <Page>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: i.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      <PageHero eyebrow={`${i.name} · ${MARKET_LABEL[i.market]}`} title={i.title} lead={i.lead} primary={{ label: "Start a pilot", href: "/contact" }} secondary={{ label: "How it works", href: "/products/fluid-funnel-engine" }} />
      <Section tone="fade" eyebrow="Why now" title={i.whyNow.title}>
        <Stats items={i.whyNow.stats} source={i.whyNow.source} />
      </Section>
      <Section tone="light" title="Where deals get stuck" lead={i.challenge}>
        <Cards items={i.situations.map(([title, body]) => ({ title, body }))} />
        <p className="ph-source">Built for: {i.buyer}</p>
      </Section>
      <Section tone="white" eyebrow="A first campaign" title="Start narrow. Prove it. Then widen.">
        <Steps items={i.example.map((title) => ({ title }))} />
        <p className="ph-source">Suggested pilot: {i.pilot}</p>
      </Section>
      <Section tone="navy" title="What it does, and what it doesn't.">
        <div className="ph-split">
          <div><p className="ph-label">Limits</p><p className="ph-lead">{i.limits}</p></div>
          <div><p className="ph-label">Not a fit for</p><p className="ph-lead">{i.notFit}</p>
            <Checklist items={["Every draft reviewed by a person before sending", "Your team owns recipient eligibility and consent", "Activity and approvals logged"]} />
          </div>
        </div>
      </Section>
      <Section tone="light" title="Questions">
        <Faq items={i.faq} />
      </Section>
      <Section tone="beige" eyebrow="Other industries" title="Explore more.">
        <Cards items={others.map((o) => ({ tag: MARKET_LABEL[o.market], title: o.name, href: `/industries/${o.slug}`, linkText: "Explore" }))} />
        <Link className="ph-link" href="/industries">All industries</Link>
      </Section>
      <CtaBand title="Pick one service. One market. One month." lead="We'll set up a focused pilot with your team and measure replies and meetings, not activity." primary={{ label: "Talk to an expert", href: "/contact" }} secondary={{ label: "See pricing", href: "/pricing" }} />
    </Page>
  );
}
