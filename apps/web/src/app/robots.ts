import type { MetadataRoute } from "next";

/**
 * Content Signals preferences (https://contentsignals.org/ - IETF draft-romm-aipref-contentsignals).
 * Declares explicit permissions for AI training, AI retrieval/input, and search indexing.
 */
export const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=yes";

function getBaseUrl() {
    return (process.env["NEXT_PUBLIC_SITE_URL"] || process.env["NEXTAUTH_URL"] || "http://localhost:3000").replace(/\/$/, "");
}

export function getRobotsTxt(): string {
    const baseUrl = getBaseUrl();
    return `# https://contentsignals.org/ - IETF draft-romm-aipref-contentsignals
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /settings
Disallow: /api
Content-Signal: ${CONTENT_SIGNAL}

User-Agent: GPTBot
User-Agent: ChatGPT-User
User-Agent: OAI-SearchBot
User-Agent: PerplexityBot
User-Agent: ClaudeBot
User-Agent: Claude-Web
User-Agent: anthropic-ai
User-Agent: Google-Extended
User-Agent: GoogleOther
User-Agent: Google-CloudVertexBot
User-Agent: Bingbot
User-Agent: cohere-ai
User-Agent: Amazonbot
User-Agent: Bytespider
User-Agent: CCBot
User-Agent: Meta-ExternalAgent
User-Agent: Applebot-Extended
User-Agent: Diffbot
User-Agent: YouBot
User-Agent: Gemini-Bot
User-Agent: Mistral-Bot
User-Agent: AI2Bot
User-Agent: iAsk-Bot
User-Agent: LinkedInBot
User-Agent: facebookexternalhit
User-Agent: Perplexity-Search
Allow: /
Allow: /blog
Allow: /pricing
Allow: /use-cases
Allow: /faq
Allow: /docs
Allow: /vs
Allow: /about
Allow: /contact
Allow: /security
Allow: /governance
Allow: /privacy
Allow: /terms
Allow: /google-api-disclosure
Allow: /data-deletion
Allow: /help
Allow: /support
Allow: /locations
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /integrations
Allow: /glossary
Allow: /case-studies
Disallow: /admin
Disallow: /dashboard
Disallow: /settings
Disallow: /api
Content-Signal: ${CONTENT_SIGNAL}

Sitemap: ${baseUrl}/sitemap.xml
`;
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
                    "/locations",
                    "/llms.txt",
                    "/llms-full.txt",
                ],
                disallow: ["/admin", "/dashboard", "/settings", "/api"],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
