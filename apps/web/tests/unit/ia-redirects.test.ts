import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config.mjs";

// One home per concept: duplicate dashboard pages redirect to their canonical page.
const DASHBOARD = path.resolve(__dirname, "../../src/app/(dashboard)");
const APP = path.resolve(__dirname, "../../src/app");
const SITE = path.resolve(__dirname, "../../../site/src/app");
const SITE_PUBLIC = path.resolve(__dirname, "../../../site/public");

// Old marketing URLs redirect to public pages (e.g. /industries/[slug]), which live outside (dashboard).
// A dynamic folder like [slug] matches any segment, as does a :param in the destination.
function pageExists(root: string, destination: string): boolean {
    let dir = root;
    for (const seg of destination.split("/").filter(Boolean)) {
        const exact = path.join(dir, seg);
        if (!seg.startsWith(":") && existsSync(exact)) { dir = exact; continue; }
        const dynamic = existsSync(dir) && readdirSync(dir, { withFileTypes: true }).find((e) => e.isDirectory() && /^\[[^\]]+\]$/.test(e.name));
        if (!dynamic) return false;
        dir = path.join(dir, dynamic.name);
    }
    return existsSync(path.join(dir, "page.tsx"));
}

function childPageExists(root: string, destination: string): boolean {
    const dir = path.join(root, destination);
    return existsSync(dir) && readdirSync(dir, { withFileTypes: true }).some(
        (entry) => entry.isDirectory() && existsSync(path.join(dir, entry.name, "page.tsx"))
    );
}

describe("IA redirects", async () => {
    const redirects = await nextConfig.redirects!();
    afterEach(() => vi.unstubAllEnvs());

    it("keeps marketing redirects disabled until the site URL is configured", async () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
        const rules = await nextConfig.redirects!();
        expect(rules.some((rule) => rule.source === "/about")).toBe(false);
        expect(rules.some((rule) => rule.source === "/use-cases")).toBe(false);
        expect(rules.some((rule) => rule.source === "/pricing" && rule.destination !== "/pricing/manage")).toBe(false);
    });

    it("sends marketing and legacy paths to the configured site", async () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://site.example.test/");
        const rules = await nextConfig.redirects!();
        expect(rules.find((rule) => rule.source === "/about")?.destination).toBe("https://site.example.test/about");
        expect(rules.find((rule) => rule.source === "/use-cases")?.destination).toBe("https://site.example.test/industries");
    });

    it("are temporary until verified in prod", () => {
        expect(redirects.length).toBeGreaterThan(0);
        for (const r of redirects) expect(r.permanent).toBe(false);
    });

    it("land on a page that exists, in one hop", () => {
        const sources = new Set(redirects.map((r) => r.source));
        for (const r of redirects) {
            const external = r.destination.startsWith("http");
            const destinationPath = (external ? new URL(r.destination).pathname : r.destination.split("?")[0])!;
            const sitePath = destinationPath.replace(/\/:path\*$/, "");
            const destinationExists = external
                ? pageExists(SITE, sitePath) || childPageExists(SITE, sitePath) || existsSync(path.join(SITE_PUBLIC, sitePath)) ||
                    existsSync(path.join(SITE, sitePath, "route.ts")) ||
                    ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"].includes(sitePath)
                : existsSync(path.join(DASHBOARD, destinationPath, "page.tsx")) || pageExists(APP, destinationPath);
            expect(destinationExists, r.destination).toBe(true);
            if (!external) expect(sources.has(destinationPath), `${r.source} -> ${r.destination} chains`).toBe(false);
            expect(r.source.startsWith("/api")).toBe(false);
        }
    });
});
