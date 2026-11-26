import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ context: vi.fn(), permission: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: m.context }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: m.permission, TeamRole: { MEMBER: "MEMBER" } }));
vi.mock("@/lib/db", () => ({ prisma: { job: { findMany: m.findMany }, message: { findMany: vi.fn().mockResolvedValue([]) } } }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: vi.fn() }));

import { GET } from "./route";

const request = () => new NextRequest("http://x/inbox/outbox");

describe("GET /inbox/outbox", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        m.context.mockResolvedValue({ teamId: "team", userId: "user" });
        m.findMany.mockResolvedValue([]);
    });

    it("requires a team member, like the other follow-up routes", async () => {
        m.permission.mockResolvedValue(false);
        const response = await GET(request());
        expect(response.status).toBe(403);
        expect(m.permission).toHaveBeenCalledWith("user", "team", "MEMBER");
        expect(m.findMany).not.toHaveBeenCalled();
    });

    it("lists the team's outbox for a member", async () => {
        m.permission.mockResolvedValue(true);
        const response = await GET(request());
        expect(response.status).toBe(200);
        expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ teamId: "team" }) }));
    });
});
