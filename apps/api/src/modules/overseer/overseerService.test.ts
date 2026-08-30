import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockJudge } = vi.hoisted(() => ({
    mockPrisma: {
        overseerNudge: {
            findMany: vi.fn(),
            create: vi.fn(),
        },
        sequenceEnrollment: {
            findMany: vi.fn(),
        },
    },
    mockJudge: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("./deepseekClient", () => ({
    judgeStalledEnrollments: mockJudge,
}));

import { runOverseerTick } from "./overseerService";

describe("runOverseerTick", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.overseerNudge.findMany.mockResolvedValue([]);
    });

    it("does nothing and never calls the judge when no enrollments are stalled", async () => {
        mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);

        const result = await runOverseerTick();

        expect(result).toEqual({ candidates: 0, nudgesCreated: 0 });
        expect(mockJudge).not.toHaveBeenCalled();
        expect(mockPrisma.overseerNudge.create).not.toHaveBeenCalled();
    });

    it("excludes enrollments that already have an OPEN nudge", async () => {
        mockPrisma.overseerNudge.findMany.mockResolvedValue([{ enrollmentId: "enr-already-nudged" }]);
        mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);

        await runOverseerTick();

        const whereClause = mockPrisma.sequenceEnrollment.findMany.mock.calls[0][0].where;
        expect(whereClause.id.notIn).toEqual(["enr-already-nudged"]);
    });

    it("writes one OverseerNudge per judged candidate, scoped to the enrollment's team/lead/sequence", async () => {
        const lastRunAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
        mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
            {
                id: "enr-1",
                teamId: "team-1",
                leadId: "lead-1",
                sequenceId: "seq-1",
                currentStepOrder: 1,
                lastRunAt,
                startedAt: lastRunAt,
                sequence: { name: "Cold Outreach", _count: { steps: 5 } }
            }
        ]);
        mockJudge.mockResolvedValue([
            { enrollmentId: "enr-1", nudgeType: "ROUTE_MANUAL", suggestion: "Stalled - route to manual." }
        ]);
        mockPrisma.overseerNudge.create.mockResolvedValue({});

        const result = await runOverseerTick();

        expect(result).toEqual({ candidates: 1, nudgesCreated: 1 });
        expect(mockJudge).toHaveBeenCalledWith([
            expect.objectContaining({ enrollmentId: "enr-1", sequenceName: "Cold Outreach", stage: "step 2 of 5" })
        ]);
        expect(mockPrisma.overseerNudge.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                teamId: "team-1",
                leadId: "lead-1",
                sequenceId: "seq-1",
                enrollmentId: "enr-1",
                nudgeType: "ROUTE_MANUAL"
            })
        });
    });
});
