import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublishedLandingRenderer from "@/components/landing-agent/PublishedLandingRenderer";

// Static per slug, refreshed on an hourly fallback in addition to the
// on-demand revalidation triggered by the publish action (see
// apps/web/src/app/api/landing-agent/revalidate/route.ts).
export const revalidate = 3600;

function getApiBaseUrl(): string {
    return (
        process.env["API_INTERNAL_ORIGIN"] ||
        process.env["NEXT_PUBLIC_API_URL"] ||
        "http://127.0.0.1:3001"
    );
}

interface PublicPagePayload {
    id: string;
    slug: string;
    title?: string | null;
    version: number;
    renderedJson: unknown;
}

async function fetchPublicPage(slug: string): Promise<PublicPagePayload | null> {
    const res = await fetch(`${getApiBaseUrl()}/landing-agent/public/${slug}/page`, {
        next: { revalidate },
    });

    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        throw new Error("Failed to load page");
    }
    return res.json();
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const page = await fetchPublicPage(slug).catch(() => null);
    if (!page) return {};
    return {
        title: page.title || undefined,
    };
}

export default async function PublicLandingPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const pageData = await fetchPublicPage(slug);

    if (!pageData) {
        notFound();
    }

    return (
        <PublishedLandingRenderer
            slug={slug}
            title={pageData.title ?? null}
            version={pageData.version}
            renderedJson={pageData.renderedJson}
        />
    );
}
