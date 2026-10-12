import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockCheckTeamPermission, mockAddDomain, mockRemoveDomain, mockSetHomePage, UnavailableError } = vi.hoisted(() => ({
    mockPrisma: {
        customDomain: { findMany: vi.fn(), findUnique: vi.fn() },
        landingPage: { findMany: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockAddDomain: vi.fn(),
    mockRemoveDomain: vi.fn(),
    mockSetHomePage: vi.fn(),
    UnavailableError: class extends Error {},
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: mockCheckTeamPermission, TeamRole: { ADMIN: "ADMIN" } }));
vi.mock("@/modules/branding/brandingService", () => ({
    BrandingService: { addDomain: mockAddDomain, removeDomain: mockRemoveDomain, setHomePage: mockSetHomePage },
    CustomDomainsUnavailableError: UnavailableError,
}));

import { DELETE, GET, PATCH, POST } from "./route";

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

describe("PATCH /api/settings/branding/domains", () => {
    const patchRequest = (body: unknown) =>
        new Request("http://localhost/api/settings/branding/domains", { method: "PATCH", body: JSON.stringify(body) }) as any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
    });

    it("rejects a non-admin", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);
        const res = await PATCH(patchRequest({ id: "cd-1", homeSlug: "spring" }));
        expect(res.status).toBe(403);
        expect(mockSetHomePage).not.toHaveBeenCalled();
    });

    it("sets the home page of the caller's team's domain", async () => {
        mockSetHomePage.mockResolvedValue(true);
        const res = await PATCH(patchRequest({ id: "cd-1", homeSlug: "spring" }));
        expect(res.status).toBe(200);
        expect(mockSetHomePage).toHaveBeenCalledWith("team-1", "cd-1", "spring");
    });

    it("clears the home page when no slug is given", async () => {
        mockSetHomePage.mockResolvedValue(true);
        await PATCH(patchRequest({ id: "cd-1", homeSlug: "" }));
        expect(mockSetHomePage).toHaveBeenCalledWith("team-1", "cd-1", null);
    });

    it("404s when the domain or the page isn't the team's", async () => {
        mockSetHomePage.mockResolvedValue(false);
        const res = await PATCH(patchRequest({ id: "cd-1", homeSlug: "someone-elses" }));
        expect(res.status).toBe(404);
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
        mockPrisma.landingPage.findMany.mockResolvedValue([{ slug: "spring", title: "Spring guide" }]);
        const res = await GET();
        expect(mockPrisma.customDomain.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-1" } }));
        // Only the team's own published pages can be offered as a home page.
        expect(mockPrisma.landingPage.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teamId: "team-1", status: "published" } })
        );
        const body = await res.json();
        expect(body.cnameTarget).toBe("pages.craftmyfunnel.live");
        expect(body.pages).toEqual([{ slug: "spring", title: "Spring guide" }]);
    });
});
