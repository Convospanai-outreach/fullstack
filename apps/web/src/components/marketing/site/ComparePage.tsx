import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHero, Section, Checklist, CtaBand } from "./kit";
import { comparisonBySlug } from "@/lib/marketing/compare";

export function compareMetadata(slug: string): Metadata {
  const c = comparisonBySlug(slug);
  const title = `CraftMyFunnel vs ${c.name} | CraftMyFunnel`;
  return { title, description: c.summary, alternates: { canonical: `https://craftmyfunnel.live/vs/${slug}` }, openGraph: { title, description: c.summary, url: `https://craftmyfunnel.live/vs/${slug}` } };
}

export function ComparePage({ slug }: { slug: string }) {
  const c = comparisonBySlug(slug);
  return (
    <Page>
      <PageHero eyebrow="Compare" title={`CraftMyFunnel vs ${c.name}`} lead={c.summary} primary={{ label: "Talk to an expert", href: "/contact" }} secondary={{ label: "All comparisons", href: "/vs" }} />
      <Section tone="light" title="Different tools for different jobs." lead={`${c.name}: ${c.theyAre}`}>
        <div className="ph-split" style={{ marginTop: 40 }}>
          <div className="ph-card" style={{ background: "#fff" }}><p className="ph-label">Pick {c.name} if</p><Checklist negative items={c.pickThem} /></div>
          <div className="ph-card" style={{ background: "#fff" }}><p className="ph-label">Pick CraftMyFunnel if</p><Checklist items={c.pickUs} /></div>
        </div>
      </Section>
      <Section tone="white" title="Side by side">
        <div className="ph-tablewrap">
          <table className="ph-table">
            <thead><tr><th>Topic</th><th>CraftMyFunnel</th><th>{c.name}</th></tr></thead>
            <tbody>{c.rows.map(([t, us, them]) => <tr key={t}><td><strong>{t}</strong></td><td>{us}</td><td>{them}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="ph-source">Based on each product's public positioning as of November 2026. Features change; check {c.name}&apos;s site for current details. <Link href="/vs">Other comparisons</Link></p>
      </Section>
      <CtaBand title="Use both, if it fits." lead={`Many teams keep their data source and add CraftMyFunnel for review, timing and follow-through.`} primary={{ label: "Start a pilot", href: "/contact" }} secondary={{ label: "See pricing", href: "/pricing" }} />
    </Page>
  );
}
