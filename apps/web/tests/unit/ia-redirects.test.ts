import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";

// One home per concept: duplicate dashboard pages redirect to their canonical page.
const DASHBOARD = path.resolve(__dirname, "../../src/app/(dashboard)");

describe("IA redirects", async () => {
    const redirects = await nextConfig.redirects!();

    it("are temporary until verified in prod", () => {
        expect(redirects.length).toBeGreaterThan(0);
        for (const r of redirects) expect(r.permanent).toBe(false);
    });

    it("land on a page that exists, in one hop", () => {
        const sources = new Set(redirects.map((r) => r.source));
        for (const r of redirects) {
            const destinationPath = r.destination.split("?")[0]!;
            expect(existsSync(path.join(DASHBOARD, destinationPath, "page.tsx")), r.destination).toBe(true);
            expect(sources.has(destinationPath), `${r.source} -> ${r.destination} chains`).toBe(false);
            expect(r.source.startsWith("/api")).toBe(false);
        }
    });
});
