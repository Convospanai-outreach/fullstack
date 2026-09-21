import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveEnabledFeatureKeysFromContext } from "@/lib/hiddenFeaturesReadiness";

function readWorkspaceFile(...parts: string[]) {
    return fs.readFileSync(path.resolve(process.cwd(), ...parts), "utf8");
}

// A context where every env/count-driven backend is UNconfigured, except the two
// features that are always ready regardless of runtime data. Overridable per-case.
function makeContext(overrides: Record<string, any> = {}) {
    const base = {
        agentTaskCount: 0,
        callerCount: 0,
        edgeAvailability: { configured: false, message: "" },
        hasAiProvider: false,
        hasHunter: false,
        hasLinkedInRuntime: false,
        hasScraperSecret: false,
        marketplaceTemplateCount: 0,
        policy: null,
        strictSovereignty: false,
        team: {
            aiConfig: null,
            enabledFeatures: null as unknown,
            _count: {
                campaigns: 0,
                jobs: 0,
                knowledgeBases: 0,
                leads: 0,
                playbooks: 0,
                scrapingJobs: 0,
                workflows: 0,
            },
        },
    };
    return { ...base, ...overrides, team: { ...base.team, ...(overrides["team"] ?? {}) } } as any;
}

describe("roadmap U-05 — beta options rework (readiness-gated defaults + per-team DB)", () => {
    it("null enabledFeatures resolves to the readiness-gated set, not a hardcoded list", () => {
        // hunter unconfigured -> excluded; csv-ingestion is always ready -> included.
        const keys = resolveEnabledFeatureKeysFromContext(makeContext());
        expect(keys.has("csv-ingestion")).toBe(true);
        expect(keys.has("hunter-email-finder")).toBe(false);
        expect(keys.has("linkedin-runner")).toBe(false);
    });

    it("readiness flips a feature on when its backend becomes configured", () => {
        const off = resolveEnabledFeatureKeysFromContext(makeContext({ hasHunter: false }));
        const on = resolveEnabledFeatureKeysFromContext(makeContext({ hasHunter: true }));
        expect(off.has("hunter-email-finder")).toBe(false);
        expect(on.has("hunter-email-finder")).toBe(true);
    });

    it("an explicit array is honored verbatim, ignoring readiness", () => {
        // 'agents' has no AI provider (not ready) but is explicitly enabled; 'caller'
        // is not in the array so it stays off even though nothing gates it here.
        const keys = resolveEnabledFeatureKeysFromContext(
            makeContext({ team: { enabledFeatures: ["agents", "workflows"] } })
        );
        expect(keys.has("agents")).toBe(true);
        expect(keys.has("workflows")).toBe(true);
        expect(keys.has("caller")).toBe(false);
    });

    it("an explicit EMPTY array is a real choice (disable all), distinct from null", () => {
        // Guards the Json?/null-sentinel design: [] must not fall back to readiness.
        // Assumes NEXT_PUBLIC_ENABLED_HIDDEN_FEATURES is unset in the test env.
        const keys = resolveEnabledFeatureKeysFromContext(
            makeContext({ team: { enabledFeatures: [] } })
        );
        expect(keys.has("csv-ingestion")).toBe(false);
        expect(keys.size).toBe(0);
    });

    it("invalid keys in a stored array are dropped", () => {
        const keys = resolveEnabledFeatureKeysFromContext(
            makeContext({ team: { enabledFeatures: ["workflows", "not-a-real-feature"] } })
        );
        expect(keys.has("workflows")).toBe(true);
        expect(keys.size).toBe(1);
    });
});

describe("roadmap U-05 — structural guards", () => {
    it("the hardcoded always-on list is gone from productFlags", () => {
        const productFlags = readWorkspaceFile("src", "lib", "productFlags.ts");
        expect(productFlags).not.toContain("ALWAYS_ON_HIDDEN_FEATURE_KEYS");
    });

    it("the settings route persists to the Team DB row and seeds the cookie best-effort", () => {
        const route = readWorkspaceFile("src", "app", "api", "settings", "hidden-features", "route.ts");
        expect(route).toContain("prisma.team.update");
        expect(route).toContain("enabledFeatures");
        // The GET cookie seed must be inside a try/catch so it can never 500 the GET:
        // assert the ordering (try -> set -> catch), not just that a `try {` exists.
        expect(route).toContain("seedEnabledFeaturesCookie");
        const seedBody = route.slice(
            route.indexOf("async function seedEnabledFeaturesCookie"),
            route.indexOf("export async function GET")
        );
        const tryIdx = seedBody.indexOf("try {");
        const setIdx = seedBody.indexOf("cookieStore.set");
        const catchIdx = seedBody.indexOf("catch");
        expect(tryIdx).toBeGreaterThanOrEqual(0);
        expect(setIdx).toBeGreaterThan(tryIdx);
        expect(catchIdx).toBeGreaterThan(setIdx);
    });

    it("the GET degraded/fallback path uses the last-known-good cookie, not an empty set", () => {
        // Regression: with ALWAYS_ON gone, a transient loadFeatureContext failure must
        // not wipe the sidebar to all-false. buildFallbackFeatures takes the resolved set.
        const route = readWorkspaceFile("src", "app", "api", "settings", "hidden-features", "route.ts");
        expect(route).toContain("lastKnownEnabledFeatures");
        expect(route).toContain("buildFallbackFeatures(\"Readiness checks are temporarily unavailable.\", await lastKnownEnabledFeatures())");
    });

    it("Team.enabledFeatures is mirrored across all three Prisma schemas", () => {
        for (const rel of [
            ["..", "..", "packages", "db", "prisma", "schema.prisma"],
            ["..", "api", "prisma", "schema.prisma"],
            ["prisma", "schema.prisma"],
        ]) {
            expect(readWorkspaceFile(...rel)).toContain("enabledFeatures Json?");
        }
    });
});
