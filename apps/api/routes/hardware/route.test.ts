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
            expect(mockHardwareService.setComplianceMode).toHaveBeenCalledWith("EU");
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
            expect(mockHardwareService.saveWorkflow).toHaveBeenCalledWith({ id: "wf-1", teamId: "team-1" });
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

        it("returns workflows with a real session", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockHardwareService.getWorkflows.mockResolvedValue([]);
            const { GET } = await import("./route");

            const response = await GET();

            expect(response.status).toBe(200);
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
