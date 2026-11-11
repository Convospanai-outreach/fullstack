import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: { sequenceStepRun: { findMany: vi.fn(), count: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("./sequenceService", () => ({ TOKENS_HELD_STATUS: "AWAITING_TOKEN_APPROVAL" }));

import { countHeldEmails, listHeldEmails } from "./heldEmails";

const run = (over: Record<string, unknown> = {}) => ({
    id: "r1",
    leadId: "l1",
    completedAt: new Date("2026-11-05T10:00:00Z"),
    errorMessage: JSON.stringify({
        missing: [{ token: "firstName", reason: "empty", suggestedFallback: "there", advice: "Write {{firstName|there}}" }],
    }),
    step: { subject: "Quick question" },
    lead: { id: "l1", fullName: null, email: "a@x.test", company: "Acme" },
    enrollment: { campaign: { name: "Launch" }, sequence: { name: "Intro" } },
    ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("countHeldEmails", () => {
    it("counts every held email for the team, not just the ones listed", async () => {
        mockPrisma.sequenceStepRun.count.mockResolvedValue(240);

        expect(await countHeldEmails("team-1")).toBe(240);
        expect(mockPrisma.sequenceStepRun.count).toHaveBeenCalledWith({ where: { teamId: "team-1", status: "AWAITING_TOKEN_APPROVAL" } });
    });
});

describe("listHeldEmails", () => {
    it("lists held runs for the team with what is missing, and says they can be approved", async () => {
        mockPrisma.sequenceStepRun.findMany.mockResolvedValue([run()]);

        const items = await listHeldEmails("team-1");

        expect(mockPrisma.sequenceStepRun.findMany.mock.calls[0]![0].where).toEqual({ teamId: "team-1", status: "AWAITING_TOKEN_APPROVAL" });
        expect(items).toEqual([
            expect.objectContaining({
                runId: "r1",
                email: "a@x.test",
                campaignName: "Launch",
                sequenceName: "Intro",
                subject: "Quick question",
                canApprove: true,
                missing: [expect.objectContaining({ token: "firstName", suggestedFallback: "there" })],
            }),
        ]);
    });

    it("cannot be approved when a field is mistyped or has no fallback", async () => {
        mockPrisma.sequenceStepRun.findMany.mockResolvedValue([
            run({
                errorMessage: JSON.stringify({
                    missing: [
                        { token: "firstName", reason: "empty", suggestedFallback: "there", advice: "" },
                        { token: "property.industry", reason: "empty", suggestedFallback: null, advice: "" },
                    ],
                }),
            }),
            run({ id: "r2", errorMessage: JSON.stringify({ missing: [{ token: "firstNam", reason: "unknown", suggestedFallback: null, advice: "" }] }) }),
        ]);

        const items = await listHeldEmails("team-1");
        expect(items.map((i) => i.canApprove)).toEqual([false, false]);
    });

    it("survives a run whose saved detail is unreadable", async () => {
        mockPrisma.sequenceStepRun.findMany.mockResolvedValue([run({ errorMessage: "not json" })]);
        const [item] = await listHeldEmails("team-1");
        expect(item).toMatchObject({ missing: [], canApprove: false });
    });
});
