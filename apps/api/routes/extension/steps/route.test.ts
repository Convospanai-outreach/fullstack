import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateExtensionAuth = vi.fn();
const mockListDue = vi.fn();
const mockComplete = vi.fn();
const mockCheckTeamPermission = vi.fn();

vi.mock("../_lib/auth", () => ({ validateExtensionAuth: mockValidateExtensionAuth }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: mockCheckTeamPermission, TeamRole: { MEMBER: "MEMBER" } }));
vi.mock("@/services/extensionLeadCaptureService", () => ({
    listDueLinkedInSteps: mockListDue,
    completeLinkedInStep: mockComplete,
}));

const get = () => new Request("http://localhost/api/extension/steps") as any;
const post = () => new Request("http://localhost/api/extension/steps/run-1/done", { method: "POST" }) as any;
const params = { params: Promise.resolve({ id: "run-1" }) };

describe("extension due steps routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockValidateExtensionAuth.mockResolvedValue({
            ok: true,
            user: { id: "user-1", email: "u@example.com", name: "User", memberships: [{ teamId: "team-a" }] },
            teamIds: ["team-a"],
        });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockListDue.mockResolvedValue([{ runId: "run-1", name: "Jane Doe" }]);
        mockComplete.mockResolvedValue({ success: true, action: "Send invitation", sequenceResumed: true });
    });

    it("lists the steps waiting on the signed-in person in the token's team", async () => {
        const { GET } = await import("./route");
        const response = await GET(get());

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true, steps: [{ runId: "run-1", name: "Jane Doe" }] });
        expect(mockListDue).toHaveBeenCalledWith("team-a", "user-1");
    });

    it("lists nothing without a valid token", async () => {
        mockValidateExtensionAuth.mockResolvedValue({ ok: false, status: 401, code: "INVALID_TOKEN", error: "Invalid token" });
        const { GET } = await import("./route");
        const response = await GET(get());

        expect(response.status).toBe(401);
        expect(mockListDue).not.toHaveBeenCalled();
    });

    it("marks a step done for the signed-in person", async () => {
        const { POST } = await import("./[id]/done/route");
        const response = await POST(post(), params);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true, action: "Send invitation", sequenceResumed: true });
        expect(mockComplete).toHaveBeenCalledWith({ teamId: "team-a", userId: "user-1", runId: "run-1" });
    });

    it("does not let a viewer mark a step done", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);
        const { POST } = await import("./[id]/done/route");
        const response = await POST(post(), params);

        expect(response.status).toBe(403);
        expect(mockCheckTeamPermission).toHaveBeenCalledWith("user-1", "team-a", "MEMBER");
        expect(mockComplete).not.toHaveBeenCalled();
    });

    it("answers 404 for a step that is no longer waiting", async () => {
        mockComplete.mockRejectedValue(new Error("Step not found"));
        const { POST } = await import("./[id]/done/route");
        const response = await POST(post(), params);

        expect(response.status).toBe(404);
    });
});
