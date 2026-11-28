import type { MetadataRoute } from "next";
import { getBlogPosts } from "@/lib/blog";
import { CITIES_MATRIX } from "@/lib/locations";
import { getJobs } from "@/lib/careers";
import { INDUSTRIES } from "@/lib/marketing/industries";

function getBaseUrl() {
    return (process.env["NEXT_PUBLIC_SITE_URL"] || "https://craftmyfunnel.live").replace(/\/$/, "");
}

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = getBaseUrl();

    // Publication dates and deployment timestamps are not substantive edit dates.
    const blogEntries: MetadataRoute.Sitemap = getBlogPosts().map(item => ({
        url: `${baseUrl}/blog/${item.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }));

    const locationEntries: MetadataRoute.Sitemap = CITIES_MATRIX.map(city => ({
        url: `${baseUrl}/locations/${city.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }));

    return [
        {
            url: `${baseUrl}/blog`,
            changeFrequency: "daily",
            priority: 0.9,
        },
        ...blogEntries,
        {
            url: `${baseUrl}/locations`,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        ...locationEntries,
        {
            url: baseUrl,
            changeFrequency: "daily",
            priority: 1.0,
        },

        {
            url: `${baseUrl}/pricing`,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/products/fluid-funnel-engine`,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/products/buyer-signals`,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/products/ai-outreach`,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/products/human-layer`,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/products/covospan-edge`,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/industries`,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        ...INDUSTRIES.map(({ slug }) => ({
            url: `${baseUrl}/industries/${slug}`,
            changeFrequency: "weekly" as const,
            priority: 0.8,
        })),
        {
            url: `${baseUrl}/regions/india`,
            changeFrequency: "weekly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/regions/united-states`,
            changeFrequency: "weekly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/regions/europe`,
            changeFrequency: "weekly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/regions/uae`,
            changeFrequency: "weekly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/regions/canada`,
            changeFrequency: "weekly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/faq`,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/docs`,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/docs/governed-outreach`,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/docs/deliverability-guardrails`,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/docs/security-architecture`,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/docs/mcp`,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/docs/api`,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/vs`,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/vs/apollo`,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/vs/instantly`,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/vs/lemlist`,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/about`,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/careers`,
            changeFrequency: "weekly",
            priority: 0.7,
        },
        ...getJobs().map(({ slug }) => ({
            url: `${baseUrl}/careers/${slug}`,
            changeFrequency: "weekly" as const,
            priority: 0.6,
        })),
        {
            url: `${baseUrl}/contact`,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/security`,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/support`,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/terms`,
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${baseUrl}/privacy`,
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${baseUrl}/google-api-disclosure`,
            changeFrequency: "monthly",
            priority: 0.6,
        },
        {
            url: `${baseUrl}/data-deletion`,
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${baseUrl}/trust/dpa`,
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${baseUrl}/trust/subprocessors`,
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${baseUrl}/help`,
            changeFrequency: "weekly",
            priority: 0.7,
        },
    ];
}
