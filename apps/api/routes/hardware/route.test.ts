import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockRequireEdgePiiAvailable, mockHardwareService } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockRequireEdgePiiAvailable: vi.fn(),
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

function postRequest(body: unknown) {
    return new Request("http://localhost/hardware", { method: "POST", body: JSON.stringify(body) });
}

describe("/hardware", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequireEdgePiiAvailable.mockResolvedValue({ status: "online", online: true });
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

        it("allows a non-PII action with a real session, without requiring an edge node", async () => {
            mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockHardwareService.setComplianceMode.mockResolvedValue(undefined);
            const { POST } = await import("./route");

            const response = await POST(postRequest({ action: "SET_COMPLIANCE", region: "EU" }));

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
    });
});
