import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCtx, mockFunnel } = vi.hoisted(() => ({
    mockCtx: { getCurrentContextFromRequest: vi.fn() },
    mockFunnel: { getFunnelReport: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockCtx.getCurrentContextFromRequest }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: vi.fn(), TeamRole: { MEMBER: "MEMBER", ADMIN: "ADMIN" } }));
vi.mock("../funnelReportService", () => mockFunnel);

import { getFunnelReportHandler } from "./funnelHandler";

const SIGNED_IN = { userId: "user-1", teamId: "team-1" };

function request(query: string) {
    return new Request(`http://localhost/landing-agent/funnel${query}`);
}

describe("getFunnelReportHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCtx.getCurrentContextFromRequest.mockResolvedValue(SIGNED_IN);
        mockFunnel.getFunnelReport.mockResolvedValue({ steps: [] });
    });

    it("passes the signed-in team to the report query, with the parsed range and filters", async () => {
        const res = await getFunnelReportHandler(request("?from=2026-10-01T00:00:00.000Z&to=2026-10-31T00:00:00.000Z&landingPageId=page-1&variantId=var-1"));
        expect(res.status).toBe(200);
        expect(mockFunnel.getFunnelReport).toHaveBeenCalledWith({
            teamId: "team-1",
            range: { from: new Date("2026-10-01T00:00:00.000Z"), to: new Date("2026-10-31T00:00:00.000Z") },
            landingPageId: "page-1",
            variantId: "var-1",
        });
    });

    it("answers 400 for a range over 90 days without running the query", async () => {
        const res = await getFunnelReportHandler(request("?from=2026-07-01T00:00:00.000Z&to=2026-10-31T00:00:00.000Z"));
        expect(res.status).toBe(400);
        expect(mockFunnel.getFunnelReport).not.toHaveBeenCalled();
    });

    it("answers 401 when no team is signed in", async () => {
        mockCtx.getCurrentContextFromRequest.mockResolvedValue({ userId: null, teamId: null });
        const res = await getFunnelReportHandler(request(""));
        expect(res.status).toBe(401);
        expect(mockFunnel.getFunnelReport).not.toHaveBeenCalled();
    });
});
