import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockEnroll, mockExecute, mockApproval } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn(), update: vi.fn() },
        lead: { count: vi.fn() },
        connectedMailbox: { count: vi.fn() },
    },
    mockEnroll: vi.fn(),
    mockExecute: vi.fn(),
    mockApproval: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: vi.fn().mockResolvedValue(true),
    TeamRole: { MEMBER: "MEMBER" },
}));
vi.mock("@/lib/campaigns/enrollment", () => ({ enrollCampaignLeads: mockEnroll }));
vi.mock("@/lib/governance/campaignStartApproval", () => ({ checkCampaignStartApproval: mockApproval }));
vi.mock("@/workers/handlers/campaign-execution-worker", () => ({ handleCampaignExecution: mockExecute }));

import { POST } from "./route";
import { hasSendingChannel } from "@/lib/campaigns/sendingChannel";

const call = () => POST(new Request("http://localhost") as any, { params: Promise.resolve({ id: "c1" }) });

describe("starting a campaign needs a connected sending mailbox", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-1" });
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "c1", teamId: "team-1" });
        mockApproval.mockResolvedValue({ allowed: true });
    });

    it("answers 409 NO_SENDING_CHANNEL and starts nothing when no mailbox is connected", async () => {
        mockPrisma.connectedMailbox.count.mockResolvedValue(0);

        const res = await call();
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body).toEqual(expect.objectContaining({ code: "NO_SENDING_CHANNEL", connectUrl: "/settings/mailboxes" }));
        expect(mockApproval).not.toHaveBeenCalled(); // no approval request is filed for a campaign that cannot start
        expect(mockEnroll).not.toHaveBeenCalled();
        expect(mockExecute).not.toHaveBeenCalled();
        expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    });

    it("lets the start continue once a mailbox is connected", async () => {
        mockPrisma.connectedMailbox.count.mockResolvedValue(1);
        mockEnroll.mockResolvedValue({ ok: true, candidates: 1, enrolled: 1, alreadyEnrolled: 0 });
        mockPrisma.campaign.update.mockResolvedValue({});

        const res = await call();

        expect(res.status).toBe(200);
        expect(mockEnroll).toHaveBeenCalled();
    });
});

describe("hasSendingChannel", () => {
    it("counts only CONNECTED mailboxes of the team", async () => {
        mockPrisma.connectedMailbox.count.mockResolvedValue(1);

        await expect(hasSendingChannel("team-1")).resolves.toBe(true);
        expect(mockPrisma.connectedMailbox.count).toHaveBeenCalledWith({ where: { teamId: "team-1", status: "CONNECTED" } });
    });
});
