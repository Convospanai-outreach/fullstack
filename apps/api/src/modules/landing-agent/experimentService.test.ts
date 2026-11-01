import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockWriteKv } = vi.hoisted(() => ({
    mockPrisma: {
        landingPage: { findMany: vi.fn(), findUnique: vi.fn() },
        landingExperiment: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
        landingExperimentVariant: { findFirst: vi.fn() },
        landingEvent: { findMany: vi.fn() },
        landingLead: { count: vi.fn() },
    },
    mockWriteKv: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("./landingExperimentKv", () => ({ writeExperimentToKv: mockWriteKv }));

import { APIError } from "@/lib/apiResponse";
import {
    createExperiment,
    endExperiment,
    getExperimentResults,
    pauseExperiment,
    pickWinner,
    startExperiment,
    variantForPage,
} from "./experimentService";

const TEAM = "team-1";
const PAGE_A = { id: "page-a", teamId: TEAM, slug: "offer-a", status: "published", title: "A" };
const PAGE_B = { id: "page-b", teamId: TEAM, slug: "offer-b", status: "published", title: "B" };

function experiment(overrides: Record<string, unknown> = {}) {
    return {
        id: "exp-1",
        teamId: TEAM,
        name: "Hero test",
        slug: "spring",
        status: "draft",
        startedAt: null,
        endedAt: null,
        winnerPageId: null,
        variants: [
            { id: "var-a", experimentId: "exp-1", landingPageId: "page-a", name: "A", weight: 50 },
            { id: "var-b", experimentId: "exp-1", landingPageId: "page-b", name: "B", weight: 50 },
        ],
        ...overrides,
    };
}

async function expectApiError(promise: Promise<unknown>, status: number) {
    const error = await promise.then(
        () => null,
        (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).statusCode).toBe(status);
}

beforeEach(() => {
    vi.clearAllMocks();
    mockWriteKv.mockResolvedValue({ status: "skipped" });
    mockPrisma.landingPage.findMany.mockResolvedValue([PAGE_A, PAGE_B]);
    mockPrisma.landingPage.findUnique.mockResolvedValue(null);
    mockPrisma.landingExperiment.findUnique.mockResolvedValue(null);
    mockPrisma.landingExperiment.findFirst.mockResolvedValue(experiment());
    mockPrisma.landingExperiment.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => experiment(data));
    mockPrisma.landingExperiment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => experiment({ ...data }));
    mockPrisma.landingExperimentVariant.findFirst.mockResolvedValue(null);
});

describe("createExperiment", () => {
    const base = { teamId: TEAM, name: "Hero test", slug: "spring", pageAId: "page-a", pageBId: "page-b" };

    it("stores two variants whose weights sum to 100, starting as a draft", async () => {
        await createExperiment({ ...base, weightA: 30 });

        const data = mockPrisma.landingExperiment.create.mock.calls[0][0].data;
        expect(data.status).toBe("draft");
        expect(data.teamId).toBe(TEAM);
        expect(data.variants.create).toEqual([
            { name: "A", landingPageId: "page-a", weight: 30 },
            { name: "B", landingPageId: "page-b", weight: 70 },
        ]);
    });

    it("rejects a weight of 0 or 100 (each variant needs at least 1)", async () => {
        await expectApiError(createExperiment({ ...base, weightA: 0 }), 400);
        await expectApiError(createExperiment({ ...base, weightA: 100 }), 400);
        expect(mockPrisma.landingExperiment.create).not.toHaveBeenCalled();
    });

    it("rejects the same page for both variants", async () => {
        await expectApiError(createExperiment({ ...base, pageBId: "page-a", weightA: 50 }), 400);
    });

    it("only accepts pages that belong to the team", async () => {
        mockPrisma.landingPage.findMany.mockResolvedValue([PAGE_A]);
        await expectApiError(createExperiment({ ...base, weightA: 50 }), 404);
        expect(mockPrisma.landingPage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["page-a", "page-b"] }, teamId: TEAM } }));
    });

    it("refuses a shared path that is already a page's address", async () => {
        mockPrisma.landingPage.findUnique.mockResolvedValue({ id: "page-other" });
        await expectApiError(createExperiment({ ...base, weightA: 50 }), 409);
    });

    it("refuses a shared path that another experiment already uses", async () => {
        mockPrisma.landingExperiment.findUnique.mockResolvedValue({ id: "exp-other" });
        await expectApiError(createExperiment({ ...base, weightA: 50 }), 409);
    });
});

describe("startExperiment", () => {
    it("refuses when a variant page is not published", async () => {
        mockPrisma.landingPage.findMany.mockResolvedValue([PAGE_A, { ...PAGE_B, status: "draft" }]);
        await expectApiError(startExperiment({ teamId: TEAM, experimentId: "exp-1" }), 409);
        expect(mockPrisma.landingExperiment.update).not.toHaveBeenCalled();
    });

    it("refuses when a variant page is already in another running test", async () => {
        mockPrisma.landingExperimentVariant.findFirst.mockResolvedValue({ id: "var-x" });
        await expectApiError(startExperiment({ teamId: TEAM, experimentId: "exp-1" }), 409);
    });

    it("marks the test running, records the start, and writes the KV mapping", async () => {
        const now = new Date("2026-11-01T10:00:00Z");
        await startExperiment({ teamId: TEAM, experimentId: "exp-1", now });

        expect(mockPrisma.landingExperiment.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "exp-1" }, data: { status: "running", startedAt: now, endedAt: null } }),
        );
        expect(mockWriteKv).toHaveBeenCalledWith("exp-1");
    });

    it("looks the experiment up within the team only", async () => {
        await startExperiment({ teamId: TEAM, experimentId: "exp-1" });
        expect(mockPrisma.landingExperiment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "exp-1", teamId: TEAM } }));
    });
});

describe("pauseExperiment and endExperiment", () => {
    it("pauses only a running test", async () => {
        mockPrisma.landingExperiment.findFirst.mockResolvedValue(experiment({ status: "draft" }));
        await expectApiError(pauseExperiment({ teamId: TEAM, experimentId: "exp-1" }), 409);

        mockPrisma.landingExperiment.findFirst.mockResolvedValue(experiment({ status: "running" }));
        await pauseExperiment({ teamId: TEAM, experimentId: "exp-1" });
        expect(mockPrisma.landingExperiment.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "paused" } }));
        expect(mockWriteKv).toHaveBeenCalledWith("exp-1");
    });

    it("ends a running or paused test and keeps an earlier winner", async () => {
        const now = new Date("2026-11-09T00:00:00Z");
        mockPrisma.landingExperiment.findFirst.mockResolvedValue(experiment({ status: "paused", winnerPageId: "page-b" }));
        await endExperiment({ teamId: TEAM, experimentId: "exp-1", now });

        const data = mockPrisma.landingExperiment.update.mock.calls[0][0].data;
        expect(data).toEqual({ status: "ended", endedAt: now });
        expect(data).not.toHaveProperty("winnerPageId");
        expect(mockWriteKv).toHaveBeenCalledWith("exp-1");
    });
});

describe("pickWinner", () => {
    it("rejects a page that is not one of the two variants", async () => {
        mockPrisma.landingExperiment.findFirst.mockResolvedValue(experiment({ status: "running" }));
        await expectApiError(pickWinner({ teamId: TEAM, experimentId: "exp-1", pageId: "page-other" }), 400);
    });

    it("ends the test, sets the winner, and points the shared path at it", async () => {
        const now = new Date("2026-11-09T00:00:00Z");
        mockPrisma.landingExperiment.findFirst.mockResolvedValue(experiment({ status: "running" }));
        await pickWinner({ teamId: TEAM, experimentId: "exp-1", pageId: "page-b", now });

        expect(mockPrisma.landingExperiment.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { status: "ended", endedAt: now, winnerPageId: "page-b" } }),
        );
        expect(mockWriteKv).toHaveBeenCalledWith("exp-1");
    });
});

describe("variantForPage", () => {
    it("returns the variant id only for a page that is an arm of a running test, scoped to that page", async () => {
        mockPrisma.landingExperimentVariant.findFirst.mockResolvedValue({ id: "var-a" });
        expect(await variantForPage("page-a")).toBe("var-a");
        expect(mockPrisma.landingExperimentVariant.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { landingPageId: "page-a", experiment: { status: "running" } } }),
        );
    });

    it("returns null when no running test uses the page", async () => {
        expect(await variantForPage("page-a")).toBeNull();
    });
});

describe("getExperimentResults", () => {
    const now = new Date("2026-11-10T00:00:00Z");

    it("counts unique sessions as visitors and form starts, and leads per variant", async () => {
        mockPrisma.landingExperiment.findFirst.mockResolvedValue(experiment({ status: "running", startedAt: new Date("2026-11-01T00:00:00Z") }));
        mockPrisma.landingEvent.findMany
            .mockResolvedValueOnce([
                { id: "e1", sessionId: "s1", eventName: "page_view" },
                { id: "e2", sessionId: "s1", eventName: "page_view" },
                { id: "e3", sessionId: "s2", eventName: "page_view" },
                { id: "e4", sessionId: "s2", eventName: "form_start" },
            ])
            .mockResolvedValueOnce([{ id: "e5", sessionId: "s9", eventName: "page_view" }]);
        mockPrisma.landingLead.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

        const r = await getExperimentResults({ teamId: TEAM, experimentId: "exp-1", now });

        expect(r.variants.A).toMatchObject({ visitors: 2, formStarts: 1, leads: 1 });
        expect(r.variants.B).toMatchObject({ visitors: 1, formStarts: 0, leads: 0 });
        expect(r.verdict.status).toBe("not_enough_data");
        expect(r.verdict.winner).toBeNull();
    });

    it("scopes every lookup to the team", async () => {
        mockPrisma.landingExperiment.findFirst.mockResolvedValue(experiment({ status: "running", startedAt: new Date("2026-11-01T00:00:00Z") }));
        mockPrisma.landingEvent.findMany.mockResolvedValue([]);
        mockPrisma.landingLead.count.mockResolvedValue(0);

        await getExperimentResults({ teamId: TEAM, experimentId: "exp-1", now });

        expect(mockPrisma.landingExperiment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "exp-1", teamId: TEAM } }));
        for (const call of mockPrisma.landingEvent.findMany.mock.calls) {
            expect(call[0].where).toMatchObject({ teamId: TEAM });
        }
        for (const call of mockPrisma.landingLead.count.mock.calls) {
            expect(call[0].where).toMatchObject({ teamId: TEAM });
        }
    });

    it("throws not found for another team's experiment", async () => {
        mockPrisma.landingExperiment.findFirst.mockResolvedValue(null);
        await expectApiError(getExperimentResults({ teamId: "team-2", experimentId: "exp-1", now }), 404);
    });
});
