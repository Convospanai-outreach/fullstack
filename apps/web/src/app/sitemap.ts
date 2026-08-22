import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";function getBaseUrl() {
    return (process.env["NEXT_PUBLIC_SITE_URL"] || process.env["NEXTAUTH_URL"] || "http://localhost:3000").replace(/\/$/, "");
}

function getBlogSlugs() {
    try {
        const blogDir = path.join(process.cwd(), "content", "blog");
        const files = fs.readdirSync(blogDir);
        return files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
    } catch (e) {
        return [];
    }
}

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = getBaseUrl();
    const lastModified = new Date();
    
    const blogSlugs = getBlogSlugs();
    const blogEntries: MetadataRoute.Sitemap = blogSlugs.map(slug => ({
        url: `${baseUrl}/blog/${slug}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }));

    return [
        {
            url: `${baseUrl}/blog`,
            lastModified,
            changeFrequency: "daily",
            priority: 0.9,
        },
        ...blogEntries,
        {
            url: baseUrl,
            lastModified,
            changeFrequency: "daily",
            priority: 1.0,
        },
        {
            url: `${baseUrl}/pricing`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/use-cases`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/use-cases/facility-management`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/use-cases/security-services`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/use-cases/staffing`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/use-cases/training`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/use-cases/consulting`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/use-cases/managed-services`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/faq`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/docs`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/docs/governed-outreach`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/docs/deliverability-guardrails`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/docs/security-architecture`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/docs/api`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/vs`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/vs/apollo`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/vs/instantly`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/vs/lemlist`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/about`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/contact`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/governance`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/security`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/support`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/terms`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${baseUrl}/privacy`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${baseUrl}/google-api-disclosure`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.6,
        },
        {
            url: `${baseUrl}/data-deletion`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${baseUrl}/help`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.7,
        },
    ];
}
