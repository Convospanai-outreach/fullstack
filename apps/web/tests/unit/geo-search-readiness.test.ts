import { describe, expect, it } from "vitest";
import robots from "../../src/app/robots";
import sitemap from "../../src/app/sitemap";
import { GET as getLlmsTxt } from "../../src/app/llms.txt/route";
import { GET as getLlmsFullTxt } from "../../src/app/llms-full.txt/route";

describe("Generative Engine Optimization (GEO) & AI Search Readiness", () => {
    describe("robots.ts AI crawler rules", () => {
        it("explicitly permits major modern AI search crawlers", () => {
            const result = robots();
            expect(result.sitemap).toBeDefined();

            const rulesList = Array.isArray(result.rules) ? result.rules : [result.rules];
            const aiRule = rulesList.find((r) => Array.isArray(r.userAgent) && r.userAgent.includes("GPTBot"));
            expect(aiRule).toBeDefined();

            const expectedAiBots = [
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
            ];

            expectedAiBots.forEach((bot) => {
                expect(aiRule?.userAgent).toContain(bot);
            });

            // Disallows sensitive / private paths
            expect(aiRule?.disallow).toEqual(["/admin", "/dashboard", "/settings", "/api"]);

            // Allows key public paths including llms.txt
            const allowed = Array.isArray(aiRule?.allow) ? aiRule?.allow : [aiRule?.allow];
            expect(allowed).toContain("/llms.txt");
            expect(allowed).toContain("/llms-full.txt");
            expect(allowed).toContain("/pricing");
            expect(allowed).toContain("/docs");
            expect(allowed).toContain("/use-cases");
            expect(allowed).toContain("/vs");
            expect(allowed).toContain("/google-api-disclosure");
            expect(allowed).toContain("/data-deletion");
        });
    });

    describe("sitemap.ts canonical URLs", () => {
        it("includes all public platform, comparison, use-case, and compliance routes", () => {
            const urls = sitemap();
            expect(urls.length).toBeGreaterThanOrEqual(28);

            const urlStrings = urls.map((u) => u.url);
            expect(urlStrings.some((u) => u.endsWith("/pricing"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/use-cases"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/use-cases/facility-management"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/use-cases/security-services"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/docs"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/docs/governed-outreach"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/docs/deliverability-guardrails"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/docs/security-architecture"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/docs/api"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/vs"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/vs/apollo"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/vs/instantly"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/vs/lemlist"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/google-api-disclosure"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/data-deletion"))).toBe(true);
            expect(urlStrings.some((u) => u.endsWith("/help"))).toBe(true);
        });
    });

    describe("/llms.txt Route Handler", () => {
        it("returns HTTP 200 with text/markdown Content-Type and CORS headers", async () => {
            const response = await getLlmsTxt();
            expect(response.status).toBe(200);
            expect(response.headers.get("Content-Type")).toContain("text/markdown");
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
            expect(response.headers.get("Cache-Control")).toContain("public");

            const text = await response.text();
            expect(text).toContain("# CraftMyFunnel");
            expect(text).toContain("Governed Multi-Channel Outreach");
            expect(text).toContain("https://craftmyfunnel.live/docs");
        });
    });

    describe("/llms-full.txt Route Handler", () => {
        it("returns HTTP 200 with full architecture specifications and CORS headers", async () => {
            const response = await getLlmsFullTxt();
            expect(response.status).toBe(200);
            expect(response.headers.get("Content-Type")).toContain("text/markdown");
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
            expect(response.headers.get("Cache-Control")).toContain("public");

            const text = await response.text();
            expect(text).toContain("# CraftMyFunnel — Full System & Architecture Specification");
            expect(text).toContain("Canonical Public Resources");
        });
    });
});
