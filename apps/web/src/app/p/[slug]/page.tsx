"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PublishedLandingRenderer from "@/components/landing-agent/PublishedLandingRenderer";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy";

interface PublicPagePayload {
    id: string;
    slug: string;
    title?: string | null;
    version: number;
    renderedJson: unknown;
}

export default function PublicLandingPage() {
    const params = useParams<{ slug: string }>();
    const slug = typeof params?.slug === "string" ? params.slug : "";
    const [pageData, setPageData] = useState<PublicPagePayload | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) return;
        setError(null);
        setPageData(null);
        fetch(`${API_BASE}/landing-agent/public/${slug}/page`)
            .then(async (res) => {
                if (!res.ok) {
                    const payload = await res.json().catch(() => null);
                    const upstreamError = typeof payload?.error === "string" ? payload.error : "";
                    if (res.status === 404) {
                        throw new Error("Page not found");
                    }
                    if (res.status >= 500 || /fetch failed|bad gateway|econnrefused/i.test(upstreamError)) {
                        throw new Error("Failed to load page");
                    }
                    throw new Error(upstreamError || "Failed to load page");
                }
                return res.json();
            })
            .then((data) => setPageData(data))
            .catch((err: any) => setError(err?.message || "Failed to load page"));
    }, [slug]);

    if (error) {
        return <div className="p-10 text-rose-300">{error}</div>;
    }

    if (!pageData) {
        return <div className="p-10 text-slate-500">Loading landing page...</div>;
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
