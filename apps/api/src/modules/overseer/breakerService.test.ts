import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        approvalRequest: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
        breakerState: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
        teamMember: {
            findFirst: vi.fn(),
        },
        notification: {
            create: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

import { evaluateBreakers, getBreakerState } from "./breakerService";

describe("getBreakerState", () => {
    beforeEach(() => vi.clearAllMocks());

    it("defaults to CLOSED when no row exists for the team", async () => {
        mockPrisma.breakerState.findUnique.mockResolvedValue(null);
        expect(await getBreakerState("team-1")).toBe("CLOSED");
    });

    it("returns the stored state when a row exists", async () => {
        mockPrisma.breakerState.findUnique.mockResolvedValue({ state: "OPEN" });
        expect(await getBreakerState("team-1")).toBe("OPEN");
    });
});

describe("evaluateBreakers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.notification.create.mockResolvedValue({});
        mockPrisma.teamMember.findFirst.mockResolvedValue({ userId: "owner-1" });
    });

    it("does nothing when no team has QUEUED approval activity", async () => {
        mockPrisma.approvalRequest.findMany.mockResolvedValueOnce([]); // distinct active teams

        const result = await evaluateBreakers();

        expect(result).toEqual({ teamsEvaluated: 0, tripped: 0 });
        expect(mockPrisma.breakerState.upsert).not.toHaveBeenCalled();
    });

    it("trips CLOSED -> OPEN when depth exceeds the trip threshold, and alerts once", async () => {
        mockPrisma.approvalRequest.findMany
            .mockResolvedValueOnce([{ teamId: "team-1" }]) // active teams
            .mockResolvedValueOnce([]); // resolved-in-window for metrics
        mockPrisma.approvalRequest.count.mockResolvedValue(51); // over the 50 default trip depth
        mockPrisma.breakerState.findUnique.mockResolvedValue(null); // no prior state -> CLOSED
        mockPrisma.breakerState.upsert.mockResolvedValue({});

        const result = await evaluateBreakers();

        expect(result).toEqual({ teamsEvaluated: 1, tripped: 1 });
        const upsertArgs = mockPrisma.breakerState.upsert.mock.calls[0][0];
        expect(upsertArgs.create.state).toBe("OPEN");
        expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
    });

    it("stays CLOSED and never alerts when metrics are within normal bounds", async () => {
        mockPrisma.approvalRequest.findMany
            .mockResolvedValueOnce([{ teamId: "team-1" }])
            .mockResolvedValueOnce([]);
        mockPrisma.approvalRequest.count.mockResolvedValue(3);
        mockPrisma.breakerState.findUnique.mockResolvedValue(null);
        mockPrisma.breakerState.upsert.mockResolvedValue({});

        const result = await evaluateBreakers();

        expect(result).toEqual({ teamsEvaluated: 1, tripped: 0 });
        expect(mockPrisma.notification.create).not.toHaveBeenCalled();
        const upsertArgs = mockPrisma.breakerState.upsert.mock.calls[0][0];
        expect(upsertArgs.create.state).toBe("CLOSED");
    });

    it("does not re-alert on a tick where the team is already OPEN", async () => {
        mockPrisma.approvalRequest.findMany
            .mockResolvedValueOnce([{ teamId: "team-1" }])
            .mockResolvedValueOnce([]);
        mockPrisma.approvalRequest.count.mockResolvedValue(60); // still over threshold
        mockPrisma.breakerState.findUnique.mockResolvedValue({ state: "OPEN", trippedAt: new Date(), resetConditionsMetSince: null });
        mockPrisma.breakerState.upsert.mockResolvedValue({});

        const result = await evaluateBreakers();

        expect(result.tripped).toBe(0); // already OPEN -> OPEN is not a new trip
        expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it("moves OPEN -> HALF_OPEN once metrics recover, without yet closing", async () => {
        mockPrisma.approvalRequest.findMany
            .mockResolvedValueOnce([{ teamId: "team-1" }])
            .mockResolvedValueOnce([]);
        mockPrisma.approvalRequest.count.mockResolvedValue(5); // under reset depth of 20
        mockPrisma.breakerState.findUnique.mockResolvedValue({ state: "OPEN", trippedAt: new Date(), resetConditionsMetSince: null });
        mockPrisma.breakerState.upsert.mockResolvedValue({});

        await evaluateBreakers();

        const upsertArgs = mockPrisma.breakerState.upsert.mock.calls[0][0];
        expect(upsertArgs.update.state).toBe("HALF_OPEN");
        expect(upsertArgs.update.resetConditionsMetSince).toBeInstanceOf(Date);
    });

    it("closes HALF_OPEN once the reset window has held for 30+ minutes", async () => {
        const heldSince = new Date(Date.now() - 31 * 60 * 1000);
        mockPrisma.approvalRequest.findMany
            .mockResolvedValueOnce([{ teamId: "team-1" }])
            .mockResolvedValueOnce([]);
        mockPrisma.approvalRequest.count.mockResolvedValue(5);
        mockPrisma.breakerState.findUnique.mockResolvedValue({ state: "HALF_OPEN", trippedAt: new Date(), resetConditionsMetSince: heldSince });
        mockPrisma.breakerState.upsert.mockResolvedValue({});

        await evaluateBreakers();

        const upsertArgs = mockPrisma.breakerState.upsert.mock.calls[0][0];
        expect(upsertArgs.update.state).toBe("CLOSED");
        expect(upsertArgs.update.trippedAt).toBeNull();
    });

    it("regresses HALF_OPEN back to OPEN if metrics worsen again before the hold completes", async () => {
        mockPrisma.approvalRequest.findMany
            .mockResolvedValueOnce([{ teamId: "team-1" }])
            .mockResolvedValueOnce([]);
        mockPrisma.approvalRequest.count.mockResolvedValue(60); // back over trip depth
        mockPrisma.breakerState.findUnique.mockResolvedValue({ state: "HALF_OPEN", trippedAt: new Date(), resetConditionsMetSince: new Date() });
        mockPrisma.breakerState.upsert.mockResolvedValue({});

        await evaluateBreakers();

        const upsertArgs = mockPrisma.breakerState.upsert.mock.calls[0][0];
        expect(upsertArgs.update.state).toBe("OPEN");
    });
});
