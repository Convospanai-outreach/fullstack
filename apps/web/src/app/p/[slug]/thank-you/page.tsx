import Link from "next/link";
import { getLandingRenderPayload } from "@/modules/landing-agent/rendering";
import { readLeadFormConfig } from "@/modules/landing-agent/leadFormHtml";
import { instagramProfileUrl } from "@/modules/landing-agent/leadFormConfig";

const DEFAULT_MESSAGE = "A team member will follow up shortly with next steps.";

function getApiBaseUrl(): string {
    return process.env["API_INTERNAL_ORIGIN"] || process.env["NEXT_PUBLIC_API_URL"] || "http://127.0.0.1:3001";
}

// The page's lead form success message and optional Instagram follow link, from the form block the visitor
// submitted. Falls back to the default text with no link.
async function getThankYouContent(slug: string): Promise<{ message: string; instagramUrl: string | null }> {
    const fallback = { message: DEFAULT_MESSAGE, instagramUrl: null };
    try {
        const res = await fetch(`${getApiBaseUrl()}/landing-agent/public/${slug}/page`, { next: { revalidate: 3600 } });
        if (!res.ok) return fallback;
        const page = (await res.json()) as { renderedJson?: unknown };
        const config = readLeadFormConfig(getLandingRenderPayload(page.renderedJson).html);
        if (!config) return fallback;
        return {
            message: config.successMessage,
            instagramUrl: config.instagramHandle ? instagramProfileUrl(config.instagramHandle) : null,
        };
    } catch {
        return fallback;
    }
}

export default async function LandingThankYouPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const { message, instagramUrl } = await getThankYouContent(slug);
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
            <div className="max-w-xl rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center space-y-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Thank You</p>
                <h1 className="text-3xl font-bold">We received your request.</h1>
                <p className="text-slate-300">{message}</p>
                {instagramUrl ? (
                    <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-lg border border-cyan-600 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-600/10"
                    >
                        Follow us on Instagram
                    </a>
                ) : null}
                <Link
                    href="/"
                    className="inline-flex rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                >
                    Back to Home
                </Link>
            </div>
        </div>
    );
}
