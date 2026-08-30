import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";
import { CITIES_MATRIX } from "@/lib/locations";

function getBaseUrl() {
    return (process.env["NEXT_PUBLIC_SITE_URL"] || process.env["NEXTAUTH_URL"] || "http://localhost:3000").replace(/\/$/, "");
}

function getBlogEntries() {
    try {
        const blogDir = path.join(process.cwd(), "content", "blog");
        const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md'));
        return files.map(file => {
            const slug = file.replace('.md', '');
            const content = fs.readFileSync(path.join(blogDir, file), 'utf8');
            const match = content.match(/date:\s*["']([^"']+)["']/);
            const date = match && match[1] ? new Date(match[1]) : new Date();
            return { slug, date };
        });
    } catch (e) {
        return [];
    }
}

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = getBaseUrl();
    const lastModified = new Date();
    
    const blogItems = getBlogEntries();
    const blogEntries: MetadataRoute.Sitemap = blogItems.map(item => ({
        url: `${baseUrl}/blog/${item.slug}`,
        lastModified: item.date,
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }));

    const locationEntries: MetadataRoute.Sitemap = CITIES_MATRIX.map(city => ({
        url: `${baseUrl}/locations/${city.slug}`,
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
            url: `${baseUrl}/locations`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        ...locationEntries,
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
