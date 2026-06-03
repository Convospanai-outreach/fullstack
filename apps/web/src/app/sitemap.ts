import type { MetadataRoute } from "next";

function getBaseUrl() {
    return (process.env["NEXT_PUBLIC_SITE_URL"] || process.env["NEXTAUTH_URL"] || "http://localhost:3000").replace(/\/$/, "");
}

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = getBaseUrl();
    const lastModified = new Date();

    return [
        {
            url: baseUrl,
            lastModified,
            changeFrequency: "weekly",
            priority: 1,
        },
        {
            url: `${baseUrl}/pricing`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/contact`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/blog`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.6,
        },
        {
            url: `${baseUrl}/case-studies`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.6,
        },
    ];
}
