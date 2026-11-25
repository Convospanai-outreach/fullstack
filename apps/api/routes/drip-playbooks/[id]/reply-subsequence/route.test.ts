import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    context: vi.fn(), canAdmin: vi.fn(), findCampaign: vi.fn(), updateCampaign: vi.fn(), findTeam: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mocks.context }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: mocks.canAdmin, TeamRole: { ADMIN: "ADMIN" } }));
vi.mock("@/lib/db", () => ({ prisma: { campaign: { findFirst: mocks.findCampaign }, team: { findUnique: mocks.findTeam }, $executeRaw: mocks.updateCampaign } }));

import { GET, PUT } from "./route";

const params = { params: Promise.resolve({ id: "campaign-A" }) };
const url = "http://localhost/drip-playbooks/campaign-A/reply-subsequence";
const put = (enabled: boolean, steps: number[]) => new NextRequest(url, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, steps }),
});

describe("drip playbook reply subsequence settings", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.context.mockResolvedValue({ teamId: "team-A", userId: "rep-A" });
        mocks.findCampaign.mockResolvedValue({ aiConfig: { dripPlaybook: { kind: "proposalFollowUp" } } });
        mocks.canAdmin.mockResolvedValue(false);
        mocks.findTeam.mockResolvedValue({ sendSafety: { replyFlow: { followUpPlans: true } } });
        mocks.updateCampaign.mockResolvedValue(1);
    });

    it("reports the default off state and scopes the lookup", async () => {
        const response = await GET(new NextRequest(url), params);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ config: null, canEdit: false, masterEnabled: true });
        expect(mocks.findCampaign).toHaveBeenCalledWith({ where: { id: "campaign-A", teamId: "team-A" }, select: { aiConfig: true } });
    });

    it("requires team admin access to opt in or kill a plan", async () => {
        mocks.canAdmin.mockResolvedValue(false);
        const response = await PUT(put(true, [0, 24]), params);
        expect(response.status).toBe(403);
        expect(mocks.updateCampaign).not.toHaveBeenCalled();
    });

    it("rejects playbook opt-in when the master is off", async () => {
        mocks.canAdmin.mockResolvedValue(true);
        mocks.findTeam.mockResolvedValue({ sendSafety: {} });
        expect((await PUT(put(true, [0, 24]), params)).status).toBe(409);
        expect(mocks.updateCampaign).not.toHaveBeenCalled();
    });

    it("updates the exact team playbook and rejects insufficient step spacing", async () => {
        mocks.canAdmin.mockResolvedValue(true);
        expect((await PUT(put(true, [0, 23]), params)).status).toBe(400);
        expect(mocks.updateCampaign).not.toHaveBeenCalled();
        const response = await PUT(put(true, [0, 24]), params);
        expect(response.status).toBe(200);
        expect(mocks.updateCampaign).toHaveBeenCalledWith(expect.any(Array), '{"enabled":true,"steps":[0,24]}',
            "campaign-A", "team-A", "proposalFollowUp");
    });
});
