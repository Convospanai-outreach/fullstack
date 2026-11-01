import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assignVariant } from "./landingExperimentAssignment";

// Same shared fixture the apps/api copy reads; the two implementations must agree on every case.
const fixture = JSON.parse(
    readFileSync(resolve(__dirname, "../../../tests/fixtures/landing-ab-assignment.json"), "utf8"),
) as {
    experimentId: string;
    cases: Array<{
        name: string;
        input: { cookieHeader: string | null; weightA: number; userAgent: string | null; doNotTrack: boolean; draw: number };
        expected: { variant: "A" | "B"; setCookie: string | null; counted: boolean };
    }>;
};

describe("landing experiment assignment (web copy) shared fixture", () => {
    for (const c of fixture.cases) {
        it(c.name, () => {
            expect(assignVariant({ experimentId: fixture.experimentId, ...c.input })).toEqual(c.expected);
        });
    }
});
