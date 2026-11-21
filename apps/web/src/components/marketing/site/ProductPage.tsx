import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHero, Section, Cards, Steps, Checklist, Faq, CtaBand, JsonLd } from "./kit";
import { PRODUCTS, productBySlug } from "@/lib/marketing/products";
import { INDUSTRIES } from "@/lib/marketing/industries";

export function productMetadata(slug: string): Metadata {
  const p = productBySlug(slug);
  const url = `https://craftmyfunnel.live/products/${p.slug}`;
  return { title: p.metaTitle, description: p.metaDescription, alternates: { canonical: url }, openGraph: { title: p.metaTitle, description: p.metaDescription, url, images: [{ url: "/images/og-branded.png", width: 1200, height: 630, alt: p.name }] } };
}

export function ProductPage({ slug }: { slug: string }) {
  const p = productBySlug(slug);
  const others = PRODUCTS.filter((o) => o.slug !== slug);
  return (
    <Page>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      <PageHero eyebrow={p.eyebrow} title={p.title} lead={p.lead} primary={{ label: "Start a pilot", href: "/contact" }} secondary={{ label: "See pricing", href: "/pricing" }} />
      <Section tone="fade" title={p.problem.title} lead={p.problem.body} />
      <Section tone="light" eyebrow="How it works" title="Three moves.">
        <Steps items={p.steps.map((s) => ({ label: s.label, title: s.title, body: s.body }))} />
      </Section>
      <Section tone="white" eyebrow="Capabilities" title={`What ${p.name} does`}>
        <Cards items={p.capabilities} />
      </Section>
      <Section tone="navy" title="Clear boundaries.">
        <Checklist items={p.boundaries} />
      </Section>
      <Section tone="light" title="Questions">
        <Faq items={p.faq} />
      </Section>
      <Section tone="beige" eyebrow="Built for" title="Industries that get the most from it.">
        <Cards items={INDUSTRIES.slice(0, 6).map((i) => ({ title: i.name, href: `/industries/${i.slug}`, linkText: "Explore" }))} />
      </Section>
      <Section tone="white" eyebrow="The platform" title="Works best together.">
        <Cards cols={4} items={others.map((o) => ({ title: o.name, body: o.short, href: `/products/${o.slug}` }))} />
        <Link className="ph-link" href="/pricing">Compare plans</Link>
      </Section>
      <CtaBand title="See it on your own pipeline." lead="One service, one market, 30 days. We measure replies and meetings." primary={{ label: "Talk to an expert", href: "/contact" }} />
    </Page>
  );
}
