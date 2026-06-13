import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuthorizeRole, mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockAuthorizeRole: vi.fn(),
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        lead: {
            findFirst: vi.fn(),
            updateMany: vi.fn(),
        },
        leadChannelStatus: {
            upsert: vi.fn(),
        },
        leadActivity: {
            create: vi.fn(),
        },
    },
}));

vi.mock("@/lib/auth", () => ({
    getCurrentContext: mockGetCurrentContext,
}));

vi.mock("@/lib/permissions", () => ({
    TeamRole: { MEMBER: "MEMBER" },
    authorizeRole: mockAuthorizeRole,
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

function request(body: unknown) {
    return new Request("http://localhost/api/leads/lead-1/journey", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

function params(id = "lead-1") {
    return { params: Promise.resolve({ id }) };
}

describe("lead journey route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce({
                id: "lead-1",
                teamId: "team-1",
                status: "CONTACTED",
                pipelineState: "WARM",
                hotAt: null,
                wonAt: null,
                lostAt: null,
                channelStatuses: [{ channel: "EMAIL", status: "CONTACTED" }],
            })
            .mockResolvedValueOnce({
                id: "lead-1",
                status: "MULTI_CHANNEL_CONTACTED",
                pipelineState: "WARM",
                channelStatuses: [
                    { channel: "EMAIL", status: "CONTACTED" },
                    { channel: "LINKEDIN", status: "CONTACTED" },
                ],
                leadActivities: [],
            });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.leadChannelStatus.upsert.mockResolvedValue({ id: "status-1" });
        mockPrisma.leadActivity.create.mockResolvedValue({ id: "activity-1" });
    });

    it("updates a channel, appends activity, and advances to multi-channel contacted", async () => {
        const { POST } = await import("./route");

        const response = await POST(request({
            channel: "LINKEDIN",
            status: "CONTACTED",
            notes: "Manual LinkedIn message sent.",
        }), params());
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
            success: true,
            status: "MULTI_CHANNEL_CONTACTED",
            pipelineState: "WARM",
        });
        expect(mockPrisma.leadChannelStatus.upsert).toHaveBeenCalledWith({
            where: { leadId_channel: { leadId: "lead-1", channel: "LINKEDIN" } },
            update: { status: "CONTACTED", lastActivityAt: expect.any(Date) },
            create: { leadId: "lead-1", channel: "LINKEDIN", status: "CONTACTED", lastActivityAt: expect.any(Date) },
        });
        expect(mockPrisma.leadActivity.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                leadId: "lead-1",
                channel: "LINKEDIN",
                type: "LINKEDIN_CONTACTED",
                title: "LINKEDIN outreach marked done",
                notes: "Manual LinkedIn message sent.",
                createdBy: "user-1",
            }),
        });
        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-1" },
            data: { status: "MULTI_CHANNEL_CONTACTED" },
        });
    });

    it("marks follow-up needed without downgrading pipeline progress", async () => {
        mockPrisma.lead.findFirst
            .mockReset()
            .mockResolvedValueOnce({
                id: "lead-1",
                teamId: "team-1",
                status: "REPLIED",
                pipelineState: "HOT",
                hotAt: new Date("2026-01-01T00:00:00Z"),
                channelStatuses: [{ channel: "EMAIL", status: "REPLIED" }],
            })
            .mockResolvedValueOnce({ id: "lead-1", status: "FOLLOW_UP_NEEDED", pipelineState: "HOT" });
        const { POST } = await import("./route");

        const response = await POST(request({ channel: "CALL", status: "FOLLOW_UP" }), params());

        expect(response.status).toBe(200);
        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-1" },
            data: { status: "FOLLOW_UP_NEEDED" },
        });
    });

    it("supports explicit won/lost closure outcomes", async () => {
        mockPrisma.lead.findFirst
            .mockReset()
            .mockResolvedValueOnce({
                id: "lead-1",
                teamId: "team-1",
                status: "MEETING_SCHEDULED",
                pipelineState: "MEETING_CONFIRMED",
                wonAt: null,
                lostAt: null,
                channelStatuses: [{ channel: "CALL", status: "CONTACTED" }],
            })
            .mockResolvedValueOnce({ id: "lead-1", status: "WON", pipelineState: "CLOSED_WON" });
        const { POST } = await import("./route");

        const response = await POST(request({ channel: "CALL", status: "CLOSED", outcome: "WON" }), params());

        expect(response.status).toBe(200);
        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-1" },
            data: {
                status: "WON",
                pipelineState: "CLOSED_WON",
                pipelineStateChangedAt: expect.any(Date),
                wonAt: expect.any(Date),
            },
        });
    });

    it("rejects invalid journey updates", async () => {
        const { POST } = await import("./route");

        const response = await POST(request({ channel: "FAX", status: "CONTACTED" }), params());
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload.code).toBe("VALIDATION_ERROR");
        expect(mockPrisma.leadChannelStatus.upsert).not.toHaveBeenCalled();
    });
});
