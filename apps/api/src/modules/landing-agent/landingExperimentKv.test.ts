import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { kvEntryFor } from "./landingExperimentKv";

function experiment(status: string, winnerPageId: string | null = null) {
    return {
        id: "exp-1",
        teamId: "team-1",
        status,
        winnerPageId,
        variants: [
            { name: "A", landingPageId: "page-a", weight: 30, landingPage: { slug: "offer-a" } },
            { name: "B", landingPageId: "page-b", weight: 70, landingPage: { slug: "offer-b" } },
        ],
    };
}

describe("kvEntryFor", () => {
    it("writes nothing for a draft test", () => {
        expect(kvEntryFor(experiment("draft"))).toBeNull();
    });

    it("routes a running test by weight", () => {
        expect(kvEntryFor(experiment("running"))).toEqual({
            experimentId: "exp-1",
            teamId: "team-1",
            mode: "test",
            weightA: 30,
            arms: { A: "offer-a", B: "offer-b" },
        });
    });

    it("sends everyone to A while paused", () => {
        expect(kvEntryFor(experiment("paused"))).toMatchObject({ mode: "fixed", fixedVariant: "A" });
    });

    it("sends everyone to the winner once ended", () => {
        expect(kvEntryFor(experiment("ended", "page-b"))).toMatchObject({ mode: "fixed", fixedVariant: "B" });
        expect(kvEntryFor(experiment("ended", "page-a"))).toMatchObject({ mode: "fixed", fixedVariant: "A" });
    });

    it("falls back to A when ended with no winner", () => {
        expect(kvEntryFor(experiment("ended"))).toMatchObject({ mode: "fixed", fixedVariant: "A" });
    });
});
