import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockCreateSchedule } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        schedule: { findMany: vi.fn() },
        campaign: { findFirst: vi.fn() },
        agent: { findFirst: vi.fn() },
    },
    mockCreateSchedule: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/permissions")>()),
    forbiddenUnlessRole: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/modules/scheduler/schedulerService", () => ({ schedulerService: { createSchedule: mockCreateSchedule } }));

import { POST } from "./route";

const CAMPAIGN_ID = "6f1c1f0e-1a2b-4c3d-8e4f-0123456789ab";
const AGENT_ID = "7a2d2a1f-2b3c-4d4e-9f50-123456789abc";

function postRequest(body: unknown) {
    return new Request("http://localhost/schedules", { method: "POST", body: JSON.stringify(body) }) as any;
}

describe("POST /schedules - create", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockCreateSchedule.mockImplementation(async (data: object) => ({ id: "sched-1", ...data }));
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: CAMPAIGN_ID });
        mockPrisma.agent.findFirst.mockResolvedValue({ id: AGENT_ID });
    });

    it("passes only the schedule fields on, with teamId taken from the session", async () => {
        const res = await POST(
            postRequest({
                name: "Weekday outreach",
                cron: "0 9 * * 1-5",
                campaignId: CAMPAIGN_ID,
                teamId: "team-victim",
                lastRunAt: "2020-01-01T00:00:00Z",
                nextRunAt: "2020-01-01T00:00:00Z",
                id: "chosen-id",
            }),
        );

        expect(res.status).toBe(200);
        expect(mockCreateSchedule).toHaveBeenCalledTimes(1);
        const data = mockCreateSchedule.mock.calls[0]![0];
        expect(data).toMatchObject({ name: "Weekday outreach", cron: "0 9 * * 1-5", campaignId: CAMPAIGN_ID, teamId: "team-a" });
        expect(data).not.toHaveProperty("lastRunAt");
        expect(data).not.toHaveProperty("nextRunAt");
        expect(data).not.toHaveProperty("id");
    });

    it("rejects a body that is not a valid schedule", async () => {
        const res = await POST(postRequest({ name: "No cron" }));

        expect(res.status).toBe(400);
        expect(mockCreateSchedule).not.toHaveBeenCalled();
    });

    it("rejects a campaign that belongs to another team", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);

        const res = await POST(postRequest({ name: "s", cron: "* * * * *", campaignId: CAMPAIGN_ID }));

        expect(res.status).toBe(404);
        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({ where: { id: CAMPAIGN_ID, teamId: "team-a" }, select: { id: true } });
        expect(mockCreateSchedule).not.toHaveBeenCalled();
    });

    it("rejects an agent that belongs to another team", async () => {
        mockPrisma.agent.findFirst.mockResolvedValue(null);

        const res = await POST(postRequest({ name: "s", cron: "* * * * *", agentId: AGENT_ID }));

        expect(res.status).toBe(404);
        expect(mockPrisma.agent.findFirst).toHaveBeenCalledWith({ where: { id: AGENT_ID, teamId: "team-a" }, select: { id: true } });
        expect(mockCreateSchedule).not.toHaveBeenCalled();
    });

    it("does not look anything up when no campaign or agent is given", async () => {
        const res = await POST(postRequest({ name: "s", cron: "* * * * *" }));

        expect(res.status).toBe(200);
        expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.agent.findFirst).not.toHaveBeenCalled();
    });
});
