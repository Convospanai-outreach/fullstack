import { beforeEach, describe, expect, it, vi } from "vitest";

const { getContext, checkPermission, team } = vi.hoisted(() => ({
    getContext: vi.fn(),
    checkPermission: vi.fn(),
    team: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: getContext }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: checkPermission, TeamRole: { ADMIN: "ADMIN" } }));
vi.mock("@/lib/db", () => ({ prisma: { team } }));

import { GET, POST } from "./route";

const post = (body: unknown) =>
    POST(new Request("http://localhost/settings/extension", { method: "POST", body: JSON.stringify(body) }) as any);

describe("extension settings route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        checkPermission.mockResolvedValue(true);
        team.findUnique.mockResolvedValue({ autoEnrichCapturedLeads: true });
        team.update.mockImplementation(async ({ data }: any) => data);
    });

    it("reads the team's switch", async () => {
        const res = await GET(new Request("http://localhost/settings/extension") as any);
        expect(await res.json()).toEqual({ autoEnrichCapturedLeads: true });
        expect(team.findUnique).toHaveBeenCalledWith({ where: { id: "team-a" }, select: { autoEnrichCapturedLeads: true } });
    });

    it("lets an admin turn it off", async () => {
        const res = await post({ autoEnrichCapturedLeads: false });
        expect(res.status).toBe(200);
        expect(team.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "team-a" }, data: { autoEnrichCapturedLeads: false } }));
    });

    it("refuses a non-admin and a non-boolean value", async () => {
        checkPermission.mockResolvedValueOnce(false);
        expect((await post({ autoEnrichCapturedLeads: false })).status).toBe(403);
        expect((await post({ autoEnrichCapturedLeads: "no" })).status).toBe(400);
        expect(team.update).not.toHaveBeenCalled();
    });

    it("needs a signed-in team member", async () => {
        getContext.mockResolvedValue({ userId: null, teamId: null });
        expect((await post({ autoEnrichCapturedLeads: true })).status).toBe(401);
    });
});
