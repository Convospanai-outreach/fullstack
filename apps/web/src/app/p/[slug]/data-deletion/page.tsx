import Link from "next/link";
import { getLandingRenderPayload } from "@/modules/landing-agent/rendering";
import { readLeadFormConfig } from "@/modules/landing-agent/leadFormHtml";

// Shown when the page's owner gave no deletion steps, or the page cannot be loaded. It names no company or person.
const DEFAULT_TEXT = "To ask for your data to be deleted, contact the site owner. They run this page and hold the details you sent.";
// Same shape as the Worker's check (workers/landing-pages/src/index.ts): no quotes, angle brackets or spaces.
const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

function getApiBaseUrl(): string {
    return process.env["API_INTERNAL_ORIGIN"] || process.env["NEXT_PUBLIC_API_URL"] || "http://127.0.0.1:3001";
}

// The deletion steps and contact the page owner gave with the form. Empty when there are none.
async function getDeletionDetails(slug: string): Promise<{ steps: string | null; contactEmail: string | null }> {
    const fallback = { steps: null, contactEmail: null };
    try {
        const res = await fetch(`${getApiBaseUrl()}/landing-agent/public/${slug}/page`, { next: { revalidate: 3600 } });
        if (!res.ok) return fallback;
        const page = (await res.json()) as { renderedJson?: unknown };
        const consent = readLeadFormConfig(getLandingRenderPayload(page.renderedJson).html)?.consent;
        if (!consent?.enabled) return fallback;
        return { steps: consent.deletionSteps ?? null, contactEmail: consent.contactEmail ?? null };
    } catch {
        return fallback;
    }
}

export default async function LandingDataDeletionPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const { steps, contactEmail } = await getDeletionDetails(slug);
    const email = contactEmail && EMAIL_PATTERN.test(contactEmail) ? contactEmail : null;
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
            <div className="max-w-xl rounded-2xl border border-white/10 bg-slate-900/60 p-8 space-y-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Data deletion</p>
                <h1 className="text-3xl font-bold">Ask for your data to be deleted</h1>
                {steps ? <p className="whitespace-pre-line text-slate-300">{steps}</p> : <p className="text-slate-300">{DEFAULT_TEXT}</p>}
                {email ? (
                    <p className="text-slate-300">
                        Contact:{" "}
                        <a href={`mailto:${email}`} className="text-cyan-300 underline">
                            {email}
                        </a>
                    </p>
                ) : null}
                <Link href={`/p/${slug}`} className="inline-flex text-sm text-cyan-300 underline">
                    Back to the page
                </Link>
            </div>
        </div>
    );
}
