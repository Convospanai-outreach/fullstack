import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const mockDb: any = vi.hoisted(() => ({ socialAccount: { findMany: vi.fn(), updateMany: vi.fn() } }));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: vi.fn(), TeamRole: { ADMIN: "admin" } }));
vi.mock("@/modules/creator-funnel/featureGate", () => ({ isCreatorFunnelEnabled: vi.fn() }));

import { GET } from "./route";
import { DELETE } from "./[id]/route";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission } from "@/lib/permissions";
import { isCreatorFunnelEnabled } from "@/modules/creator-funnel/featureGate";

const list = () => GET(new NextRequest("http://localhost:3001/social/accounts"));
const disconnect = (id = "acc-1") =>
    DELETE(new NextRequest(`http://localhost:3001/social/accounts/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) });

describe("/social/accounts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (checkTeamPermission as any).mockResolvedValue(true);
        (isCreatorFunnelEnabled as any).mockResolvedValue(true);
        mockDb.socialAccount.findMany.mockResolvedValue([{ id: "acc-1", platform: "INSTAGRAM", handle: "@mybrand", status: "CONNECTED" }]);
        mockDb.socialAccount.updateMany.mockResolvedValue({ count: 1 });
    });

    it("401s without a team and 404s when the creator funnel is off", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValueOnce({ userId: null, teamId: null });
        expect((await list()).status).toBe(401);

        (isCreatorFunnelEnabled as any).mockResolvedValue(false);
        expect((await list()).status).toBe(404);
        expect((await disconnect()).status).toBe(404);
        expect(mockDb.socialAccount.findMany).not.toHaveBeenCalled();
    });

    it("lists the team's accounts without ever selecting the token", async () => {
        const res = await list();

        expect(await res.json()).toEqual({ accounts: [{ id: "acc-1", platform: "INSTAGRAM", handle: "@mybrand", status: "CONNECTED" }] });
        const query = mockDb.socialAccount.findMany.mock.calls[0][0];
        expect(query.where).toEqual({ teamId: "team-a", status: { not: "DISCONNECTED" } });
        expect(query.select.encryptedToken).toBeUndefined();
    });

    it("disconnects within the team: wipes the token and marks it DISCONNECTED", async () => {
        const res = await disconnect();

        expect(res.status).toBe(200);
        expect(mockDb.socialAccount.updateMany).toHaveBeenCalledWith({
            where: { id: "acc-1", teamId: "team-a" },
            data: { status: "DISCONNECTED", encryptedToken: Prisma.DbNull, lastError: null, expiryWarnedAt: null },
        });
    });

    it("only admins can disconnect, and other teams' accounts are not found", async () => {
        (checkTeamPermission as any).mockResolvedValueOnce(false);
        expect((await disconnect()).status).toBe(403);

        mockDb.socialAccount.updateMany.mockResolvedValue({ count: 0 });
        expect((await disconnect("other-team-acc")).status).toBe(404);
    });
});
