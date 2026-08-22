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
                    "OAI-SearchBot",
                    "PerplexityBot",
                    "ClaudeBot",
                    "Claude-Web",
                    "anthropic-ai",
                    "Google-Extended",
                    "GoogleOther",
                    "Google-CloudVertexBot",
                    "Bingbot",
                    "cohere-ai",
                    "Amazonbot",
                    "Bytespider",
                    "CCBot",
                    "Meta-ExternalAgent",
                    "Applebot-Extended",
                    "Diffbot",
                    "YouBot",
                ],
                allow: [
                    "/",
                    "/blog",
                    "/pricing",
                    "/use-cases",
                    "/faq",
                    "/docs",
                    "/vs",
                    "/about",
                    "/contact",
                    "/security",
                    "/governance",
                    "/privacy",
                    "/terms",
                    "/google-api-disclosure",
                    "/data-deletion",
                    "/help",
                    "/support",
                    "/llms.txt",
                    "/llms-full.txt",
                ],
                disallow: ["/admin", "/dashboard", "/settings", "/api"],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
