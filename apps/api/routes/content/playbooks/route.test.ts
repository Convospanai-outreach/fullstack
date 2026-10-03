import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const wizard = vi.hoisted(() => ({
    listRuns: vi.fn(),
    startRun: vi.fn(),
    getRun: vi.fn(),
    deleteRun: vi.fn(),
    retryRun: vi.fn(),
}));
const mockDb = vi.hoisted(() => ({ product: { findMany: vi.fn() }, iCP: { findMany: vi.fn() } }));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: vi.fn(), TeamRole: { ADMIN: "admin", MEMBER: "member" } }));
vi.mock("@/modules/creator-funnel/featureGate", () => ({ isCreatorFunnelEnabled: vi.fn() }));
vi.mock("@/modules/creator-funnel/playbookWizard", () => wizard);

import { GET, POST } from "./route";
import { DELETE } from "./[id]/route";
import { POST as RETRY } from "./[id]/retry/route";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission } from "@/lib/permissions";
import { isCreatorFunnelEnabled } from "@/modules/creator-funnel/featureGate";
import { ContentPostError } from "@/modules/creator-funnel/contentPostService";

const BASE = "http://localhost:3001/content/playbooks";
const json = (url: string, method: string, body: unknown) =>
    new NextRequest(url, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const params = (id = "run-1") => ({ params: Promise.resolve({ id }) });

const valid = {
    name: "Spring launch",
    offer: { type: "booking", bookingUrl: "https://cal.example/me", description: "Intro call" },
    audience: { description: "Busy parents" },
    leadMagnet: "Meal plan PDF",
    tone: "Warm",
    startDate: "2030-01-08",
    timezone: "Asia/Kolkata",
};

describe("/content/playbooks routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (checkTeamPermission as any).mockResolvedValue(true);
        (isCreatorFunnelEnabled as any).mockResolvedValue(true);
        wizard.listRuns.mockResolvedValue([]);
        wizard.startRun.mockResolvedValue({ id: "run-1", status: "GENERATING" });
        mockDb.product.findMany.mockResolvedValue([{ id: "prod-1" }]);
        mockDb.iCP.findMany.mockResolvedValue([{ id: "icp-1" }]);
    });

    it("404s when the creator funnel is off and 403s a viewer's writes", async () => {
        (isCreatorFunnelEnabled as any).mockResolvedValue(false);
        expect((await GET(new NextRequest(BASE))).status).toBe(404);
        expect((await POST(json(BASE, "POST", valid))).status).toBe(404);

        (isCreatorFunnelEnabled as any).mockResolvedValue(true);
        (checkTeamPermission as any).mockResolvedValue(false);
        expect((await POST(json(BASE, "POST", valid))).status).toBe(403);
        expect((await DELETE(new NextRequest(`${BASE}/run-1`, { method: "DELETE" }), params())).status).toBe(403);
        expect(wizard.startRun).not.toHaveBeenCalled();
        expect(wizard.deleteRun).not.toHaveBeenCalled();
    });

    it("lists plans with this team's active products and audiences", async () => {
        const res = await GET(new NextRequest(BASE));
        expect(await res.json()).toEqual({ runs: [], products: [{ id: "prod-1" }], icps: [{ id: "icp-1" }] });
        expect(mockDb.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", isActive: true } }));
        expect(mockDb.iCP.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a" } }));
    });

    it("validates the wizard input and starts a plan", async () => {
        expect((await POST(json(BASE, "POST", { ...valid, startDate: "next week" }))).status).toBe(400);
        expect((await POST(json(BASE, "POST", { ...valid, postsPerWeek: 9 }))).status).toBe(400);
        expect((await POST(json(BASE, "POST", { ...valid, offer: { type: "product" } }))).status).toBe(400);
        expect(wizard.startRun).not.toHaveBeenCalled();

        const res = await POST(json(BASE, "POST", valid));
        expect(res.status).toBe(202);
        expect(wizard.startRun).toHaveBeenCalledWith("team-a", "user-1", expect.objectContaining({ postsPerWeek: 3, accountIds: [], audience: { description: "Busy parents" } }));
    });

    it("maps wizard errors to their status", async () => {
        wizard.startRun.mockRejectedValue(new ContentPostError(409, "A plan is already being written."));
        expect((await POST(json(BASE, "POST", valid))).status).toBe(409);
        wizard.retryRun.mockRejectedValue(new ContentPostError(409, "nope"));
        expect((await RETRY(new NextRequest(`${BASE}/run-1/retry`, { method: "POST" }), params())).status).toBe(409);
    });

    it("deletes a plan for this team", async () => {
        wizard.deleteRun.mockResolvedValue({ deleted: 3, kept: 1 });
        const res = await DELETE(new NextRequest(`${BASE}/run-1`, { method: "DELETE" }), params());
        expect(await res.json()).toEqual({ deleted: 3, kept: 1 });
        expect(wizard.deleteRun).toHaveBeenCalledWith("team-a", "run-1");
    });
});
