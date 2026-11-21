import { Page, PageHero, Section, Cards, CtaBand, JsonLd } from "@/components/marketing/site/kit";
import { REGIONS } from "@/lib/marketing/regions";

export const metadata = {
    title: "About CraftMyFunnel | Governed B2B Outreach",
    description: "Learn how CraftMyFunnel helps B2B service companies turn buyer signals into qualified meetings with managed workflows and human approval.",
    alternates: {
        canonical: "https://craftmyfunnel.live/about",
    },
    openGraph: {
        title: "About CraftMyFunnel | Governed B2B Outreach",
        description: "Learn how CraftMyFunnel helps B2B service companies turn buyer signals into qualified meetings with managed workflows and human approval.",
        type: "website",
        url: "https://craftmyfunnel.live/about",
        images: [
            {
                url: "/images/platform/governed-workflow.webp",
                width: 820,
                height: 460,
                alt: "CraftMyFunnel Governed AI Outreach Architecture",
            }
        ],
    },
};


export default function AboutPage() {
    const siteUrl = "https://craftmyfunnel.live";
    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "AboutPage",
                "@id": `${siteUrl}/about#webpage`,
                "url": `${siteUrl}/about`,
                "name": "About CraftMyFunnel AI",
                "description": "CraftMyFunnel helps B2B service companies turn buyer signals into qualified meetings with governed AI workflows and human approval.",
                "isPartOf": {
                    "@type": "WebSite",
                    "@id": `${siteUrl}/#website`
                },
                "publisher": {
                    "@type": "Organization",
                    "@id": `${siteUrl}/#organization`,
                    "name": "CraftMyFunnel",
                    "url": siteUrl
                }
            },
            {
                "@type": "Organization",
                "@id": `${siteUrl}/#organization`,
                "name": "CraftMyFunnel",
                "url": siteUrl,
                "logo": `${siteUrl}/craftmyfunnel-logo.png`,
                "founder": {
                    "@type": "Person",
                    "name": "CraftMyFunnel Engineering & Outreach Architecture Group",
                    "jobTitle": "Founding Systems Architects"
                },
                "knowsAbout": [
                    "B2B Outbound Automation",
                    "RFC 5322 Deliverability Compliance",
                    "Buyer Signal Ingestion",
                    "Human-in-the-Loop AI Oversight"
                ]
            },
            {
                "@type": "BreadcrumbList",
                "@id": `${siteUrl}/about#breadcrumb`,
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": siteUrl
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "About",
                        "item": `${siteUrl}/about`
                    }
                ]
            }
        ]
    };

    return (
        <Page>
            <JsonLd data={jsonLd} />
            <PageHero eyebrow="About us" title="We help B2B service firms turn buyer signals into real conversations." lead="CraftMyFunnel started from one frustration: service companies see buying signals every week, but too few become approved outreach, timely follow-up and qualified meetings." primary={{ label: "Talk to our team", href: "/contact" }} secondary={{ label: "Careers", href: "/careers" }} />
            <Section tone="light" eyebrow="Our view" title="Managed by AI. Approved by humans.">
                <div className="ph-split" style={{ marginTop: 24 }}>
                    <p className="ph-lead">The best sales conversations happen when a team walks in with context, a real reason to talk and a message someone actually checked.</p>
                    <p className="ph-lead" style={{ color: "var(--ph-muted)" }}>CraftMyFunnel doesn&apos;t replace salespeople. It handles signals, drafting and follow-up tracking so people can focus on judgement and relationships.</p>
                </div>
            </Section>
            <Section tone="white" eyebrow="Why CraftMyFunnel" title="Four things we won't compromise on.">
                <Cards cols={4} items={[
                    { title: "Signals first", body: "Every campaign starts with a reason to talk now: fit, timing and context." },
                    { title: "A person approves", body: "AI drafts. A human signs off before anything goes out." },
                    { title: "Privacy by design", body: "Consent handling, approval logs and an optional on-premise node for sensitive data." },
                    { title: "Outcomes, not activity", body: "We measure replies, meetings and follow-up quality, not emails sent." },
                ]} />
            </Section>
            <Section tone="navy" eyebrow="Where we work" title="Built in India. Selling to India, the US and Europe.">
                <Cards dark items={REGIONS.slice(0, 3).map((r) => ({ label: r.name, title: r.channels, href: `/regions/${r.slug}`, linkText: `${r.name} guide` }))} />
            </Section>
            <Section tone="teal" title="Built by people who have carried a quota." lead="Our team comes from enterprise demand generation and AI engineering. We've lived the gap between a signal and a signed contract.">
                <div style={{ marginTop: 32 }}><a className="ph-btn ph-btn-yellow" href="/careers">Explore careers</a></div>
            </Section>
            <Section tone="beige" tight={false} title="Company">
                <p className="ph-lead">CraftMyFunnel is operated by Sudhisha Digital Private Limited, India.</p>
            </Section>
            <CtaBand title="Start a guided pilot." lead="One service, one market, 30 days." primary={{ label: "Talk to an expert", href: "/contact" }} secondary={{ label: "See pricing", href: "/pricing" }} />
        </Page>
    );
}
