import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assignVariant } from "./landingExperimentAssignment";

// The same cases are read by apps/web (and by the Worker test later), so the three copies of the
// assignment rule cannot drift apart. The fixture lives in apps/web/tests/fixtures.
const WEB = resolve(__dirname, "../../../../web");
const fixture = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/landing-ab-assignment.json"), "utf8")) as {
    experimentId: string;
    cases: Array<{
        name: string;
        input: { cookieHeader: string | null; weightA: number; userAgent: string | null; doNotTrack: boolean; draw: number };
        expected: { variant: "A" | "B"; setCookie: string | null; counted: boolean };
    }>;
};

// Seeded PRNG (mulberry32) so the distribution test is deterministic.
function seededDraws(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

describe("assignVariant shared fixture", () => {
    for (const c of fixture.cases) {
        it(c.name, () => {
            const result = assignVariant({ experimentId: fixture.experimentId, ...c.input });
            expect(result).toEqual(c.expected);
        });
    }
});

describe("assignVariant weights", () => {
    it("matches a 30/70 split within 2 points over 20000 seeded draws", () => {
        const draws = seededDraws(42);
        let a = 0;
        const n = 20000;
        for (let i = 0; i < n; i++) {
            const r = assignVariant({
                experimentId: fixture.experimentId,
                cookieHeader: null,
                weightA: 30,
                userAgent: "Mozilla/5.0 Chrome/120.0",
                doNotTrack: false,
                draw: draws(),
            });
            if (r.variant === "A") a++;
        }
        expect(a / n).toBeGreaterThan(0.28);
        expect(a / n).toBeLessThan(0.32);
    });
});
