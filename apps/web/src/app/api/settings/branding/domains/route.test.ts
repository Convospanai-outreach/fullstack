import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockCheckTeamPermission, mockAddDomain, mockRemoveDomain, UnavailableError } = vi.hoisted(() => ({
    mockPrisma: {
        customDomain: { findMany: vi.fn(), findUnique: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockAddDomain: vi.fn(),
    mockRemoveDomain: vi.fn(),
    UnavailableError: class extends Error {},
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: mockCheckTeamPermission, TeamRole: { ADMIN: "ADMIN" } }));
vi.mock("@/modules/branding/brandingService", () => ({
    BrandingService: { addDomain: mockAddDomain, removeDomain: mockRemoveDomain },
    CustomDomainsUnavailableError: UnavailableError,
}));

import { DELETE, GET, POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/api/settings/branding/domains", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

function deleteRequest(query: string) {
    return new Request(`http://localhost/api/settings/branding/domains${query}`, { method: "DELETE" }) as any;
}

describe("POST /api/settings/branding/domains", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
    });

    it("rejects an invalid hostname", async () => {
        const res = await POST(postRequest({ domain: "not a domain" }));
        expect(res.status).toBe(400);
        expect(mockAddDomain).not.toHaveBeenCalled();
    });

    it("rejects our own domains", async () => {
        for (const domain of ["api.craftmyfunnel.live", "craftmyfunnel.com"]) {
            const res = await POST(postRequest({ domain }));
            expect(res.status).toBe(400);
        }
        expect(mockAddDomain).not.toHaveBeenCalled();
    });

    it("rejects a non-admin", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);
        const res = await POST(postRequest({ domain: "go.example.com" }));
        expect(res.status).toBe(403);
    });

    it("rejects a domain already connected by any team", async () => {
        mockPrisma.customDomain.findUnique.mockResolvedValue({ id: "existing" });
        const res = await POST(postRequest({ domain: "go.example.com" }));
        expect(res.status).toBe(409);
        expect(mockAddDomain).not.toHaveBeenCalled();
    });

    it("connects a valid, unclaimed domain", async () => {
        mockPrisma.customDomain.findUnique.mockResolvedValue(null);
        mockAddDomain.mockResolvedValue({ id: "cd-1", domain: "go.example.com", status: "pending" });

        const res = await POST(postRequest({ domain: "GO.Example.com" }));

        expect(res.status).toBe(200);
        expect(mockAddDomain).toHaveBeenCalledWith("team-1", "go.example.com");
    });

    it("says custom domains aren't switched on when Cloudflare isn't configured", async () => {
        mockPrisma.customDomain.findUnique.mockResolvedValue(null);
        mockAddDomain.mockRejectedValue(new UnavailableError());

        const res = await POST(postRequest({ domain: "go.example.com" }));

        expect(res.status).toBe(503);
        expect((await res.json()).error).toBe("Custom domains aren't switched on yet.");
    });
});

describe("DELETE /api/settings/branding/domains", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
    });

    it("rejects a non-admin", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);
        const res = await DELETE(deleteRequest("?id=cd-1"));
        expect(res.status).toBe(403);
        expect(mockRemoveDomain).not.toHaveBeenCalled();
    });

    it("removes the caller's team's domain", async () => {
        mockRemoveDomain.mockResolvedValue(true);
        const res = await DELETE(deleteRequest("?id=cd-1"));
        expect(res.status).toBe(200);
        expect(mockRemoveDomain).toHaveBeenCalledWith("team-1", "cd-1");
    });

    it("404s for a domain that isn't the team's", async () => {
        mockRemoveDomain.mockResolvedValue(false);
        const res = await DELETE(deleteRequest("?id=someone-elses"));
        expect(res.status).toBe(404);
    });
});

describe("GET /api/settings/branding/domains", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("lists only the caller's team's domains, with the CNAME target to point them at", async () => {
        mockPrisma.customDomain.findMany.mockResolvedValue([]);
        const res = await GET();
        expect(mockPrisma.customDomain.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-1" } }));
        expect((await res.json()).cnameTarget).toBe("pages.craftmyfunnel.live");
    });
});
