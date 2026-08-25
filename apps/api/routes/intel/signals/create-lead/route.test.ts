import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockQueueNetjanaFollowup, mockShouldQueueNetjanaFollowup } = vi.hoisted(() => ({
    mockPrisma: {
        shadowSignal: { findFirst: vi.fn(), update: vi.fn() },
        lead: { create: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockQueueNetjanaFollowup: vi.fn(),
    mockShouldQueueNetjanaFollowup: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/intel/service/netjanaIntelService", () => ({
    queueNetjanaFollowup: mockQueueNetjanaFollowup,
    shouldQueueNetjanaFollowup: mockShouldQueueNetjanaFollowup,
}));

function jsonRequest(body: any) {
    return new Request("http://localhost/intel/signals/create-lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("/intel/signals/create-lead", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockShouldQueueNetjanaFollowup.mockReturnValue(false);
    });

    it("rejects unauthenticated requests", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ signalId: "sig-1" }) as any);
        expect(response.status).toBe(401);
    });

    it("rejects when signalId is missing", async () => {
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({}) as any);
        expect(response.status).toBe(400);
    });

    it("404s when the signal doesn't exist for this team", async () => {
        mockPrisma.shadowSignal.findFirst.mockResolvedValue(null);
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ signalId: "sig-1" }) as any);
        expect(response.status).toBe(404);
    });

    it("409s when the signal is already linked to a lead", async () => {
        mockPrisma.shadowSignal.findFirst.mockResolvedValue({ id: "sig-1", leadId: "lead-existing", metadata: {} });
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ signalId: "sig-1" }) as any);
        expect(response.status).toBe(409);
    });

    it("422s when the signal has no usable company name", async () => {
        mockPrisma.shadowSignal.findFirst.mockResolvedValue({
            id: "sig-1",
            leadId: null,
            metadata: { companyName: "Unknown company" },
        });
        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ signalId: "sig-1" }) as any);
        expect(response.status).toBe(422);
    });

    it("creates a lead from an unmatched signal, links the shadow signal, and returns the new leadId", async () => {
        mockPrisma.shadowSignal.findFirst.mockResolvedValue({
            id: "sig-1",
            leadId: null,
            metadata: { companyName: "Acme Corp", industry: "SaaS", intentScore: 82, safeForAutomation: false },
        });
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1", pipelineState: "COLD" });
        mockPrisma.shadowSignal.update.mockResolvedValue({});

        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ signalId: "sig-1" }) as any);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(data.leadId).toBe("lead-1");
        expect(mockPrisma.lead.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    teamId: "team-1",
                    company: "Acme Corp",
                    source: "netjana-intel",
                    intentScore: 0.82,
                    pipelineState: "COLD",
                }),
            })
        );
        expect(mockPrisma.shadowSignal.update).toHaveBeenCalledWith({
            where: { id: "sig-1" },
            data: expect.objectContaining({
                leadId: "lead-1",
                metadata: expect.objectContaining({ matchStatus: "MATCHED", matchConfidence: "HIGH" }),
            }),
        });
        expect(mockQueueNetjanaFollowup).not.toHaveBeenCalled();
    });

    it("queues a followup job when the signal is hot and safe for automation", async () => {
        mockPrisma.shadowSignal.findFirst.mockResolvedValue({
            id: "sig-2",
            leadId: null,
            metadata: { companyName: "Acme Corp", intentScore: 90, safeForAutomation: true, temperatureBand: "HOT" },
        });
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-2", pipelineState: "HOT" });
        mockShouldQueueNetjanaFollowup.mockReturnValue(true);
        mockQueueNetjanaFollowup.mockResolvedValue({ queued: true, jobId: "job-1" });

        const { POST } = await import("./route");
        const response = await POST(jsonRequest({ signalId: "sig-2" }) as any);
        const data = await response.json();

        expect(data.pipelineState).toBe("HOT");
        expect(mockQueueNetjanaFollowup).toHaveBeenCalledWith(
            "team-1",
            expect.objectContaining({ companyName: "Acme Corp" }),
            { id: "lead-2", campaignId: null }
        );
        expect(data.followup).toEqual({ queued: true, jobId: "job-1" });
    });
});
