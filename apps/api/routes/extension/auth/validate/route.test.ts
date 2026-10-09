import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateExtensionAuth = vi.fn();
const mockTeamFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
    prisma: { team: { findUnique: mockTeamFindUnique } }
}));

vi.mock("../../_lib/auth", () => ({
    validateExtensionAuth: mockValidateExtensionAuth
}));

function makeReq() {
    return new Request("http://localhost/api/extension/auth/validate", { method: "GET" }) as any;
}

describe("extension auth/validate route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the authenticated user and team ids for a valid token", async () => {
        mockValidateExtensionAuth.mockResolvedValue({
            ok: true,
            user: { id: "user-1", email: "u@example.com", name: "User" },
            teamIds: ["team-a", "team-b"]
        });
        const { GET } = await import("./route");
        const res = await GET(makeReq());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({
            valid: true,
            user: { id: "user-1", email: "u@example.com", name: "User" },
            teamIds: ["team-a", "team-b"],
            team: null
        });
        expect(mockTeamFindUnique).not.toHaveBeenCalled();
    });

    it("names the team when the token is for one team", async () => {
        mockValidateExtensionAuth.mockResolvedValue({
            ok: true,
            user: { id: "user-1", email: "u@example.com", name: "User" },
            teamIds: ["team-b"]
        });
        mockTeamFindUnique.mockResolvedValue({ id: "team-b", name: "Acme Sales" });
        const { GET } = await import("./route");
        const body = await (await GET(makeReq())).json();

        expect(body.team).toEqual({ id: "team-b", name: "Acme Sales" });
        expect(mockTeamFindUnique).toHaveBeenCalledWith({ where: { id: "team-b" }, select: { id: true, name: true } });
    });

    it("propagates the auth failure status and code for an invalid token", async () => {
        mockValidateExtensionAuth.mockResolvedValue({ ok: false, error: "Expired", code: "TOKEN_EXPIRED", status: 401 });
        const { GET } = await import("./route");
        const res = await GET(makeReq());
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body).toEqual({ valid: false, error: "Expired", code: "TOKEN_EXPIRED" });
    });
});
