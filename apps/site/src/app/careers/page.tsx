import type { Metadata } from "next";
import { getJobs } from "@/lib/careers";
import { Page, PageHero, Section, Cards, CtaBand } from "@/components/marketing/site/kit";

export const metadata: Metadata = {
    title: "Careers | CraftMyFunnel",
    description: "Open positions at CraftMyFunnel.",
    alternates: { canonical: "/careers" },
};

export default function CareersPage() {
    const jobs = getJobs();
    return (
        <Page>
            <PageHero eyebrow="Careers" title="Build the follow-through layer for B2B sales." lead="We're a small team in India building governed AI outreach for service firms in India, the US and Europe." />
            <Section tone="light" title="Open roles">
                {jobs.length === 0
                    ? <p className="ph-lead" style={{ marginTop: 24 }}>No open positions right now. Send your profile to contact.us@craftmyfunnel.live and we&apos;ll be in touch when something fits.</p>
                    : <Cards items={jobs.map((job) => ({ label: [job.department, job.location, job.type].filter(Boolean).join(" · "), title: job.title, href: `/careers/${encodeURIComponent(job.slug)}`, linkText: "View role" }))} />}
            </Section>
            <CtaBand title="Know someone great?" lead="Referrals are the best way in." primary={{ label: "Email us", href: "mailto:contact.us@craftmyfunnel.live" }} />
        </Page>
    );
}
