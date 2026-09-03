import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockCheckTeamPermission, mockAddDomain } = vi.hoisted(() => ({
    mockPrisma: {
        customDomain: { findMany: vi.fn(), findUnique: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockAddDomain: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: mockCheckTeamPermission, TeamRole: { ADMIN: "ADMIN" } }));
vi.mock("@/modules/branding/brandingService", () => ({ BrandingService: { addDomain: mockAddDomain } }));

import { GET, POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/api/settings/branding/domains", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
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
});

describe("GET /api/settings/branding/domains", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("lists only the caller's team's domains", async () => {
        mockPrisma.customDomain.findMany.mockResolvedValue([]);
        await GET();
        expect(mockPrisma.customDomain.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-1" } }));
    });
});
