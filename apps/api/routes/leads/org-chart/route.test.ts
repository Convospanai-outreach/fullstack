import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, mockGetCurrentContext, mockAuthorizeRole } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    authorizeRole: mockAuthorizeRole,
    TeamRole: { MEMBER: "MEMBER" },
}));

import { GET, PATCH } from "./route";

function getRequest(query: string) {
    return new NextRequest(`http://localhost/leads/org-chart${query}`);
}

function patchRequest(body: any) {
    return new NextRequest("http://localhost/leads/org-chart", { method: "PATCH", body: JSON.stringify(body) });
}

describe("GET /leads/org-chart", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    it("selects pipelineState/pipelineStateChangedAt so nodes can show live outreach stage", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([{ id: "lead-1", domain: "acme.example", pipelineState: "WARM" }]);

        await GET(getRequest("?domain=acme.example"));

        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith({
            where: { teamId: "team-1", domain: "acme.example" },
            select: expect.objectContaining({ pipelineState: true, pipelineStateChangedAt: true }),
        });
    });

    it("looks up leads by exact domain when a domain query param is given", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([{ id: "lead-1", domain: "acme.example" }]);

        const res = await GET(getRequest("?domain=Acme.Example"));
        const body = await res.json();

        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith({
            where: { teamId: "team-1", domain: "acme.example" },
            select: expect.any(Object),
        });
        expect(body.leads).toHaveLength(1);
    });

    it("falls back to normalized-company scan when only a company param is given", async () => {
        mockPrisma.lead.findMany.mockResolvedValue([
            { id: "lead-1", company: "Acme Corp" },
            { id: "lead-2", company: "Acme Corporation" },
            { id: "lead-3", company: "Totally Different Co" },
        ]);

        const res = await GET(getRequest("?company=Acme+Corp"));
        const body = await res.json();

        expect(body.leads.map((l: any) => l.id)).toEqual(["lead-1", "lead-2"]);
    });

    it("400s an invalid domain", async () => {
        const res = await GET(getRequest("?domain=not a domain"));
        expect(res.status).toBe(400);
    });
});

describe("PATCH /leads/org-chart", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    it("rejects an edge between leads at different accounts", async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce({ id: "lead-1", domain: "acme.example", company: null })
            .mockResolvedValueOnce({ id: "lead-2", domain: "other.example", company: null });

        const res = await PATCH(patchRequest({ leadId: "lead-1", reportsToId: "lead-2" }));

        expect(res.status).toBe(400);
        expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });

    it("persists a reportsToId edge between two leads at the same account", async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce({ id: "lead-1", domain: "acme.example", company: null })
            .mockResolvedValueOnce({ id: "lead-2", domain: "acme.example", company: null });
        mockPrisma.lead.update.mockResolvedValue({ id: "lead-1", reportsToId: "lead-2" });

        const res = await PATCH(patchRequest({ leadId: "lead-1", reportsToId: "lead-2" }));

        expect(res.status).toBe(200);
        expect(mockPrisma.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-1" },
            data: { reportsToId: "lead-2" },
            select: expect.any(Object),
        });
    });

    it("rejects a lead reporting to itself", async () => {
        const res = await PATCH(patchRequest({ leadId: "lead-1", reportsToId: "lead-1" }));

        expect(res.status).toBe(400);
        expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
    });

    it("allows clearing an edge by passing reportsToId: null", async () => {
        mockPrisma.lead.findFirst.mockResolvedValueOnce({ id: "lead-1", domain: "acme.example", company: null });
        mockPrisma.lead.update.mockResolvedValue({ id: "lead-1", reportsToId: null });

        const res = await PATCH(patchRequest({ leadId: "lead-1", reportsToId: null }));

        expect(res.status).toBe(200);
        expect(mockPrisma.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-1" },
            data: { reportsToId: null },
            select: expect.any(Object),
        });
    });
});
