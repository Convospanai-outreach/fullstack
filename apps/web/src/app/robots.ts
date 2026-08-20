import type { MetadataRoute } from "next";

function getBaseUrl() {
    return (process.env["NEXT_PUBLIC_SITE_URL"] || process.env["NEXTAUTH_URL"] || "http://localhost:3000").replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
    const baseUrl = getBaseUrl();

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/admin", "/dashboard", "/settings", "/api"],
            },
            {
                userAgent: [
                    "GPTBot",
                    "ChatGPT-User",
                    "PerplexityBot",
                    "ClaudeBot",
                    "anthropic-ai",
                    "Google-Extended",
                    "GoogleOther",
                    "Bingbot",
                    "cohere-ai",
                ],
                allow: ["/", "/pricing", "/faq", "/docs", "/vs", "/about", "/contact", "/security", "/governance", "/privacy", "/terms", "/llms.txt", "/llms-full.txt"],
                disallow: ["/admin", "/dashboard", "/settings", "/api"],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
