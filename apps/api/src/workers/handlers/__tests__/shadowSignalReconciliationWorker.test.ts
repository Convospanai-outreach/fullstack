import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockPrisma, mockFindLeadForSignal, mockApplyNetjanaEnrichmentToLead, mockQueueNetjanaFollowup } = vi.hoisted(() => ({
    mockPrisma: {
        shadowSignal: { findMany: vi.fn(), update: vi.fn() },
    },
    mockFindLeadForSignal: vi.fn(),
    mockApplyNetjanaEnrichmentToLead: vi.fn(),
    mockQueueNetjanaFollowup: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock("@/modules/intel/service/netjanaIntelService", () => ({
    findLeadForSignal: mockFindLeadForSignal,
    applyNetjanaEnrichmentToLead: mockApplyNetjanaEnrichmentToLead,
    queueNetjanaFollowup: mockQueueNetjanaFollowup,
}));

import { reconcileOrphanedShadowSignals } from "../shadowSignalReconciliationWorker";

function baseSignal(overrides: Record<string, unknown> = {}) {
    return {
        signalId: "signal-1",
        companyName: "Acme Corp",
        intentScore: 80,
        strengthPercent: 70,
        safeForAutomation: true,
        campaignId: null,
        ...overrides,
    };
}

describe("reconcileOrphanedShadowSignals", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockQueueNetjanaFollowup.mockResolvedValue({ queued: false, reason: "signal_not_hot" });
    });

    it("queries only orphaned, non-expired Netjana signals", async () => {
        mockPrisma.shadowSignal.findMany.mockResolvedValue([]);

        await reconcileOrphanedShadowSignals();

        expect(mockPrisma.shadowSignal.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ leadId: null, source: "netjana-intel" }),
                take: 50,
            })
        );
    });

    it("leaves a signal unmatched (no writes) when findLeadForSignal still finds nothing", async () => {
        mockPrisma.shadowSignal.findMany.mockResolvedValue([
            { id: "orphan-1", teamId: "team-a", metadata: { provider: "netjana-intel", ...baseSignal() } },
        ]);
        mockFindLeadForSignal.mockResolvedValue({ lead: null, matchConfidence: "NONE" });

        const result = await reconcileOrphanedShadowSignals();

        expect(mockApplyNetjanaEnrichmentToLead).not.toHaveBeenCalled();
        expect(mockPrisma.shadowSignal.update).not.toHaveBeenCalled();
        expect(result).toEqual({ scanned: 1, matched: 0 });
    });

    it("matches an orphaned signal to a lead that arrived later, enriches it, and marks the signal matched", async () => {
        mockPrisma.shadowSignal.findMany.mockResolvedValue([
            { id: "orphan-1", teamId: "team-a", metadata: { provider: "netjana-intel", rawPayloadTrusted: false, ...baseSignal() } },
        ]);
        mockFindLeadForSignal.mockResolvedValue({ lead: { id: "lead-1", campaignId: null }, matchConfidence: "MEDIUM" });

        const result = await reconcileOrphanedShadowSignals();

        expect(mockApplyNetjanaEnrichmentToLead).toHaveBeenCalledWith(
            { id: "lead-1", campaignId: null },
            expect.objectContaining({ companyName: "Acme Corp", matchConfidence: "MEDIUM", matchStatus: "MATCHED" }),
            expect.objectContaining({ companyName: "Acme Corp" }),
            { queued: false, reason: "signal_not_hot" }
        );
        expect(mockPrisma.shadowSignal.update).toHaveBeenCalledWith({
            where: { id: "orphan-1" },
            data: expect.objectContaining({ leadId: "lead-1" }),
        });
        expect(result).toEqual({ scanned: 1, matched: 1 });
    });

    it("isolates a per-signal failure so one bad row doesn't block the rest of the batch", async () => {
        mockPrisma.shadowSignal.findMany.mockResolvedValue([
            { id: "orphan-bad", teamId: "team-a", metadata: null },
            { id: "orphan-good", teamId: "team-a", metadata: { provider: "netjana-intel", ...baseSignal({ signalId: "signal-2" }) } },
        ]);
        mockFindLeadForSignal.mockResolvedValue({ lead: { id: "lead-2", campaignId: null }, matchConfidence: "HIGH" });

        const result = await reconcileOrphanedShadowSignals();

        expect(result).toEqual({ scanned: 2, matched: 1 });
    });
});
