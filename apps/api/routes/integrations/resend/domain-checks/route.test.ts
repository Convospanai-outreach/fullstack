import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetCurrentContextFromRequest, mockCheckTeamPermission, mockEnsureResendDomainVerified, mockRemoveResendDomain, mockUpdateResendDomainTracking } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockEnsureResendDomainVerified: vi.fn(),
    mockRemoveResendDomain: vi.fn(),
    mockUpdateResendDomainTracking: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { ADMIN: "ADMIN" },
}));
vi.mock("@/modules/email-campaigner/service/resendDomainService", () => ({
    ensureResendDomainVerified: mockEnsureResendDomainVerified,
    removeResendDomain: mockRemoveResendDomain,
    updateResendDomainTracking: mockUpdateResendDomainTracking,
}));

import { POST, PATCH, DELETE } from "./route";

function postRequest(body: any) {
    return new NextRequest("http://localhost/integrations/resend/domain-checks", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function patchRequest(body: any) {
    return new NextRequest("http://localhost/integrations/resend/domain-checks", {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

function deleteRequest(domain?: string) {
    const url = domain
        ? `http://localhost/integrations/resend/domain-checks?domain=${encodeURIComponent(domain)}`
        : "http://localhost/integrations/resend/domain-checks";
    return new NextRequest(url, { method: "DELETE" });
}

describe("POST /integrations/resend/domain-checks", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
    });

    it("401s when unauthenticated", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(postRequest({ domain: "team.test" }));

        expect(res.status).toBe(401);
        expect(mockEnsureResendDomainVerified).not.toHaveBeenCalled();
    });

    it("403s a caller below ADMIN", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await POST(postRequest({ domain: "team.test" }));

        expect(res.status).toBe(403);
        expect(mockEnsureResendDomainVerified).not.toHaveBeenCalled();
    });

    it("checks the domain scoped to the caller's own team", async () => {
        mockEnsureResendDomainVerified.mockResolvedValue({ domain: "team.test", status: "VERIFIED" });

        const res = await POST(postRequest({ domain: "team.test" }));

        expect(res.status).toBe(200);
        expect(mockEnsureResendDomainVerified).toHaveBeenCalledWith({ teamId: "team-1", domain: "team.test" });
    });
});

describe("PATCH /integrations/resend/domain-checks", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
    });

    it("401s when unauthenticated", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: null, teamId: null });

        const res = await PATCH(patchRequest({ domain: "team.test", openTracking: true }));

        expect(res.status).toBe(401);
        expect(mockUpdateResendDomainTracking).not.toHaveBeenCalled();
    });

    it("403s a caller below ADMIN", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await PATCH(patchRequest({ domain: "team.test", openTracking: true }));

        expect(res.status).toBe(403);
        expect(mockUpdateResendDomainTracking).not.toHaveBeenCalled();
    });

    it("maps the service's neither-flag-provided rejection to 400", async () => {
        mockUpdateResendDomainTracking.mockRejectedValue(new Error("Provide at least one of openTracking or clickTracking to update."));

        const res = await PATCH(patchRequest({ domain: "team.test" }));

        expect(res.status).toBe(400);
    });

    it("forwards the tracking flags scoped to the caller's own team", async () => {
        mockUpdateResendDomainTracking.mockResolvedValue({ domain: "team.test", openTracking: false, clickTracking: true });

        const res = await PATCH(patchRequest({ domain: "team.test", openTracking: false, clickTracking: true }));

        expect(res.status).toBe(200);
        expect(mockUpdateResendDomainTracking).toHaveBeenCalledWith({
            teamId: "team-1",
            domain: "team.test",
            openTracking: false,
            clickTracking: true,
        });
    });

    it("returns 404 when the service reports no domain check on file", async () => {
        mockUpdateResendDomainTracking.mockRejectedValue(new Error("No Resend domain check found for team.test."));

        const res = await PATCH(patchRequest({ domain: "team.test", openTracking: true }));

        expect(res.status).toBe(404);
    });
});

describe("DELETE /integrations/resend/domain-checks", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
    });

    it("401s when unauthenticated", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: null, teamId: null });

        const res = await DELETE(deleteRequest("team.test"));

        expect(res.status).toBe(401);
        expect(mockRemoveResendDomain).not.toHaveBeenCalled();
    });

    it("403s a caller below ADMIN", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await DELETE(deleteRequest("team.test"));

        expect(res.status).toBe(403);
        expect(mockRemoveResendDomain).not.toHaveBeenCalled();
    });

    it("400s when the domain query parameter is missing", async () => {
        const res = await DELETE(deleteRequest());

        expect(res.status).toBe(400);
        expect(mockRemoveResendDomain).not.toHaveBeenCalled();
    });

    it("removes the domain scoped to the caller's own team", async () => {
        mockRemoveResendDomain.mockResolvedValue({ domain: "team.test", removed: true });

        const res = await DELETE(deleteRequest("team.test"));

        expect(res.status).toBe(200);
        expect(mockRemoveResendDomain).toHaveBeenCalledWith({ teamId: "team-1", domain: "team.test" });
    });

    it("returns 404 when the service reports no domain check on file", async () => {
        mockRemoveResendDomain.mockRejectedValue(new Error("No Resend domain check found for team.test."));

        const res = await DELETE(deleteRequest("team.test"));

        expect(res.status).toBe(404);
    });
});
