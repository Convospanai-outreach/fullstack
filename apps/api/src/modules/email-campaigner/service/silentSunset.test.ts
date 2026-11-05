import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        campaign: { findMany: vi.fn() },
        sequenceEnrollment: { findMany: vi.fn(), updateMany: vi.fn() },
        emailEvent: { findMany: vi.fn() },
        sequenceStepRun: { updateMany: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { runSilentSunset, SUNSET_ERROR_CODE } from "./silentSunset";

const NOW = new Date("2026-11-05T12:00:00Z");
const withS5 = { id: "c1", teamId: "t1" };

beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sequenceEnrollment.updateMany.mockImplementation(async ({ where }) => ({ count: where.id.in.length }));
    mockPrisma.sequenceStepRun.updateMany.mockResolvedValue({ count: 0 });
});

describe("runSilentSunset", () => {
    it("only looks at campaigns that picked S5", async () => {
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        expect(await runSilentSunset(NOW)).toEqual({ campaignsChecked: 0, enrollmentsExited: 0 });
        expect(mockPrisma.campaign.findMany.mock.calls[0][0].where).toEqual({ aiConfig: { path: ["strategies"], array_contains: ["S5"] } });
        expect(mockPrisma.sequenceEnrollment.findMany).not.toHaveBeenCalled();
    });

    it("exits a 90-day-old enrollment with no opens or clicks, and skips its unsent steps", async () => {
        mockPrisma.campaign.findMany.mockResolvedValue([withS5]);
        mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([{ id: "e1", leadId: "l1" }]);
        mockPrisma.emailEvent.findMany.mockResolvedValue([]);

        expect(await runSilentSunset(NOW)).toEqual({ campaignsChecked: 1, enrollmentsExited: 1 });

        const where = mockPrisma.sequenceEnrollment.findMany.mock.calls[0][0].where;
        expect(where.startedAt.lte).toEqual(new Date("2026-08-07T12:00:00Z"));
        expect(mockPrisma.sequenceEnrollment.updateMany.mock.calls[0][0].data).toMatchObject({ status: "EXITED", nextRunAt: null });
        expect(mockPrisma.sequenceStepRun.updateMany.mock.calls[0][0].data).toMatchObject({
            status: "SKIPPED_EXITED",
            errorCode: SUNSET_ERROR_CODE,
        });
    });

    it("keeps a contact who opened or clicked in the window", async () => {
        mockPrisma.campaign.findMany.mockResolvedValue([withS5]);
        mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
            { id: "e1", leadId: "l1" },
            { id: "e2", leadId: "l2" },
        ]);
        mockPrisma.emailEvent.findMany.mockResolvedValue([{ leadId: "l1" }]);

        expect(await runSilentSunset(NOW)).toEqual({ campaignsChecked: 1, enrollmentsExited: 1 });
        expect(mockPrisma.sequenceEnrollment.updateMany.mock.calls[0][0].where.id.in).toEqual(["e2"]);
        expect(mockPrisma.emailEvent.findMany.mock.calls[0][0].where.type.in).toEqual(["OPEN", "CLICK"]);
    });

    it("does nothing when no enrollment is old enough", async () => {
        mockPrisma.campaign.findMany.mockResolvedValue([withS5]);
        mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);
        expect(await runSilentSunset(NOW)).toEqual({ campaignsChecked: 1, enrollmentsExited: 0 });
        expect(mockPrisma.sequenceEnrollment.updateMany).not.toHaveBeenCalled();
    });
});
