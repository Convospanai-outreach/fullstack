import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/modules/caller/CallerBriefService", () => ({ CallerBriefService: { getBrief: vi.fn() } }));

import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CallerBriefService } from "@/modules/caller/CallerBriefService";

const req = (q = "?leadId=lead-1") => new NextRequest(`http://localhost:3001/api/caller/brief${q}`);

describe("GET /api/caller/brief", () => {
    beforeEach(() => vi.clearAllMocks());

    it("403s a role outside the caller tier", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "u", teamId: "t" });
        (prisma.user.findUnique as any).mockResolvedValue({ enterpriseRole: "SALES_USER" });
        expect((await GET(req())).status).toBe(403);
        expect(CallerBriefService.getBrief).not.toHaveBeenCalled();
    });

    it("400s without leadId", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "u", teamId: "t" });
        (prisma.user.findUnique as any).mockResolvedValue({ enterpriseRole: "CALLER" });
        expect((await GET(req(""))).status).toBe(400);
    });

    it("404s a lead from another team (service returns null for the caller's team)", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "u", teamId: "team-a" });
        (prisma.user.findUnique as any).mockResolvedValue({ enterpriseRole: "CALLER" });
        (CallerBriefService.getBrief as any).mockResolvedValue(null);
        expect((await GET(req("?leadId=lead-b"))).status).toBe(404);
        expect(CallerBriefService.getBrief).toHaveBeenCalledWith("lead-b", "team-a");
    });

    it("returns the brief for a caller", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "u", teamId: "team-a" });
        (prisma.user.findUnique as any).mockResolvedValue({ enterpriseRole: "CALLER" });
        (CallerBriefService.getBrief as any).mockResolvedValue({ lead: { id: "lead-1" } });
        const res = await GET(req());
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ lead: { id: "lead-1" } });
    });
});
