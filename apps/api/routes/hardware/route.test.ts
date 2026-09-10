import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockRequireEdgePiiAvailable, mockHardwareService, mockGetAdminUser } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockRequireEdgePiiAvailable: vi.fn(),
    mockGetAdminUser: vi.fn(),
    mockHardwareService: {
        verifyHardwareIdentity: vi.fn(),
        sanitize: vi.fn(),
        critique: vi.fn(),
        search: vi.fn(),
        execute: vi.fn(),
        saveWorkflow: vi.fn(),
        getWorkflows: vi.fn(),
        setComplianceMode: vi.fn(),
        reIdentify: vi.fn(),
        tokenBelongsToTeam: vi.fn(),
        getStatus: vi.fn(),
        getActivity: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/services/HardwareService", () => ({ HardwareService: mockHardwareService }));
vi.mock("@/lib/edgeRuntime", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/edgeRuntime")>();
    return { ...actual, requireEdgePiiAvailable: mockRequireEdgePiiAvailable };
});
vi.mock("@/lib/admin", () => ({ getAdminUser: mockGetAdminUser }));

function postRequest(body: unknown) {
    return new Request("http://localhost/hardware", { method: "POST", body: JSON.stringify(body) });
}

describe("/hardware", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireEdgePiiAvailable.mockResolvedValue({ status: "online", online: true });
        mockGetAdminUser.mockResolvedValue(null);
    });

    describe("POST - every action requires a real session", () => {
        it("rejects a non-PII action (SET_COMPLIANCE) with no session", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
            const { POST } = await import("./route");

            const response = await POST(postRequest({ action: "SET_COMPLIANCE", region: "EU" }));

            expect(response.status).toBe(401);
            expect(mockHardwareService.setComplianceMode).not.toHaveBeenCalled();
        });

        it("rejects STATUS with no session", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
            const { POST } = await import("./route");

            const response = await POST(postRequest({ action: "STATUS" }));

            expect(response.status).toBe(401);
            expect(mockHardwareService.getStatus).not.toHaveBeenCalled();
        });

        it("allows a non-PII action (STATUS) with a real session, without requiring an edge node", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockHardwareService.getStatus.mockResolvedValue({ ok: true });
            const { POST } = await import("./route");

            const response = await POST(postRequest({ action: "STATUS" }));

            expect(response.status).toBe(200);
            expect(mockRequireEdgePiiAvailable).not.toHaveBeenCalled();
        });

        it("still requires an available edge node for a PII action, on top of the session check", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockHardwareService.sanitize.mockResolvedValue({ sanitized_text: "x", token_map_id: "t", stats: {} });
            const { POST } = await import("./route");

            await POST(postRequest({ action: "SANITIZE", text: "hello" }));

            expect(mockRequireEdgePiiAvailable).toHaveBeenCalledWith("team-1", {});
        });
    });

    describe("POST - routes data-plane calls to the caller's own team (multi-tenant routing)", () => {
        it("passes the caller's teamId to HardwareService for every data-plane action", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockHardwareService.sanitize.mockResolvedValue({ sanitized_text: "x", token_map_id: "t", stats: {} });
            mockHardwareService.critique.mockResolvedValue({ status: "APPROVED", score: 1 });
            mockHardwareService.search.mockResolvedValue([]);
            mockHardwareService.getStatus.mockResolvedValue({ connected: true });
            mockHardwareService.getActivity.mockResolvedValue([]);
            mockHardwareService.tokenBelongsToTeam.mockResolvedValue(true);
            mockHardwareService.reIdentify.mockResolvedValue({ original: "x" });
            const { POST } = await import("./route");

            await POST(postRequest({ action: "SANITIZE", text: "hello" }));
            expect(mockHardwareService.sanitize).toHaveBeenCalledWith("hello", "team-1");

            await POST(postRequest({ action: "CRITIQUE", text: "hello", context: "ctx" }));
            expect(mockHardwareService.critique).toHaveBeenCalledWith("hello", "ctx", "team-1");

            await POST(postRequest({ action: "SEARCH", query: "q" }));
            expect(mockHardwareService.search).toHaveBeenCalledWith("q", "team-1");

            await POST(postRequest({ action: "STATUS" }));
            expect(mockHardwareService.getStatus).toHaveBeenCalledWith("team-1");

            await POST(postRequest({ action: "ACTIVITY", limit: 10 }));
            expect(mockHardwareService.getActivity).toHaveBeenCalledWith(10, "team-1");

            await POST(postRequest({ action: "VERIFY" }));
            expect(mockHardwareService.verifyHardwareIdentity).toHaveBeenCalledWith("team-1");
        });
    });

    describe("POST - SET_COMPLIANCE requires a platform admin (OPEN-206)", () => {
        it("rejects a regular authenticated user - this flips a platform-wide shared setting, not per-team data", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockGetAdminUser.mockResolvedValue(null);
            const { POST } = await import("./route");

            const response = await POST(postRequest({ action: "SET_COMPLIANCE", region: "EU" }));

            expect(response.status).toBe(403);
            expect(mockHardwareService.setComplianceMode).not.toHaveBeenCalled();
        });

        it("allows a genuine platform admin", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "admin-1", teamId: "team-1" });
            mockGetAdminUser.mockResolvedValue({ id: "admin-1", enterpriseRole: "SYSTEM_ADMIN" });
            mockHardwareService.setComplianceMode.mockResolvedValue(undefined);
            const { POST } = await import("./route");

            const response = await POST(postRequest({ action: "SET_COMPLIANCE", region: "EU" }));

            expect(response.status).toBe(200);
            expect(mockHardwareService.setComplianceMode).toHaveBeenCalledWith("EU", undefined);
        });

        it("routes to a specific team's edge node when the admin supplies targetTeamId", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "admin-1", teamId: "team-1" });
            mockGetAdminUser.mockResolvedValue({ id: "admin-1", enterpriseRole: "SYSTEM_ADMIN" });
            mockHardwareService.setComplianceMode.mockResolvedValue(undefined);
            const { POST } = await import("./route");

            await POST(postRequest({ action: "SET_COMPLIANCE", region: "EU", targetTeamId: "team-9" }));

            expect(mockHardwareService.setComplianceMode).toHaveBeenCalledWith("EU", "team-9");
        });
    });

    describe("POST - EXECUTE requires a platform admin (OPEN-222)", () => {
        it("rejects a regular authenticated user - this drives the single shared physical edge device, not per-team data", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockGetAdminUser.mockResolvedValue(null);
            const { POST } = await import("./route");

            const response = await POST(postRequest({ action: "EXECUTE", payload: { actuator: "arm" } }));

            expect(response.status).toBe(403);
            expect(mockHardwareService.execute).not.toHaveBeenCalled();
        });

        it("allows a genuine platform admin", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "admin-1", teamId: "team-1" });
            mockGetAdminUser.mockResolvedValue({ id: "admin-1", enterpriseRole: "SYSTEM_ADMIN" });
            mockHardwareService.execute.mockResolvedValue(true);
            const { POST } = await import("./route");

            const response = await POST(postRequest({ action: "EXECUTE", payload: { actuator: "arm" } }));

            expect(response.status).toBe(200);
            expect(mockHardwareService.execute).toHaveBeenCalledWith("arm", { actuator: "arm" }, undefined);
        });

        it("routes to a specific team's edge node when the admin supplies targetTeamId", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "admin-1", teamId: "team-1" });
            mockGetAdminUser.mockResolvedValue({ id: "admin-1", enterpriseRole: "SYSTEM_ADMIN" });
            mockHardwareService.execute.mockResolvedValue(true);
            const { POST } = await import("./route");

            await POST(postRequest({ action: "EXECUTE", payload: { actuator: "arm" }, targetTeamId: "team-9" }));

            expect(mockHardwareService.execute).toHaveBeenCalledWith("arm", { actuator: "arm" }, "team-9");
        });
    });

    describe("POST - SAVE_WORKFLOW ownership", () => {
        it("rejects saving a workflow tagged with another team's id", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            const { POST } = await import("./route");

            const response = await POST(postRequest({ action: "SAVE_WORKFLOW", workflow: { id: "wf-1", teamId: "other-team" } }));

            expect(response.status).toBe(403);
            expect(mockHardwareService.saveWorkflow).not.toHaveBeenCalled();
        });

        it("saves a workflow tagged with the caller's own team id", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockHardwareService.saveWorkflow.mockResolvedValue(undefined);
            const { POST } = await import("./route");

            const response = await POST(postRequest({ action: "SAVE_WORKFLOW", workflow: { id: "wf-1", teamId: "team-1" } }));

            expect(response.status).toBe(200);
            expect(mockHardwareService.saveWorkflow).toHaveBeenCalledWith({ id: "wf-1", teamId: "team-1" }, "team-1");
        });
    });

    describe("POST - RE_IDENTIFY requires token ownership (OPEN-221)", () => {
        it("rejects re-identifying a maskedId that does not belong to the caller's team", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockHardwareService.tokenBelongsToTeam.mockResolvedValue(false);
            const { POST } = await import("./route");

            const response = await POST(postRequest({ action: "RE_IDENTIFY", maskedId: "[EMAIL_other]", purpose: "support" }));

            expect(response.status).toBe(403);
            expect(mockHardwareService.reIdentify).not.toHaveBeenCalled();
        });

        it("re-identifies a maskedId that belongs to the caller's own team", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockHardwareService.tokenBelongsToTeam.mockResolvedValue(true);
            mockHardwareService.reIdentify.mockResolvedValue({ original: "real@example.com" });
            const { POST } = await import("./route");

            const response = await POST(postRequest({ action: "RE_IDENTIFY", maskedId: "[EMAIL_mine]", purpose: "support" }));

            expect(response.status).toBe(200);
            expect(mockHardwareService.reIdentify).toHaveBeenCalledWith("[EMAIL_mine]", "support", "team-1");
        });
    });

    describe("GET - requires a real session", () => {
        it("rejects with no session", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
            const { GET } = await import("./route");

            const response = await GET();

            expect(response.status).toBe(401);
            expect(mockHardwareService.getWorkflows).not.toHaveBeenCalled();
        });

        it("returns workflows with a real session, routed to the caller's own team", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockHardwareService.getWorkflows.mockResolvedValue([]);
            const { GET } = await import("./route");

            const response = await GET();

            expect(response.status).toBe(200);
            expect(mockHardwareService.getWorkflows).toHaveBeenCalledWith("team-1");
        });

        it("filters out other teams' workflows returned by the shared edge endpoint", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockHardwareService.getWorkflows.mockResolvedValue([
                { id: "wf-1", teamId: "team-1" },
                { id: "wf-2", teamId: "other-team" },
            ]);
            const { GET } = await import("./route");

            const response = await GET();
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body).toEqual([{ id: "wf-1", teamId: "team-1" }]);
        });
    });
});
