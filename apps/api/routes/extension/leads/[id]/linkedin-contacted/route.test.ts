import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateExtensionAuth = vi.fn();
const mockMarkDone = vi.fn();

vi.mock("../../../_lib/auth", () => ({
    validateExtensionAuth: mockValidateExtensionAuth
}));

vi.mock("@/services/extensionLeadCaptureService", () => ({
    markLinkedInOutreachDone: mockMarkDone
}));

describe("extension LinkedIn contacted route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockValidateExtensionAuth.mockResolvedValue({
            ok: true,
            user: { id: "user-1", email: "u@example.com", name: "User", memberships: [{ teamId: "team-a" }] },
            teamIds: ["team-a"]
        });
        mockMarkDone.mockResolvedValue({
            success: true,
            leadId: "lead-1",
            status: "MULTI_CHANNEL_CONTACTED",
            message: "LinkedIn outreach marked as done"
        });
    });

    it("marks LinkedIn outreach done for a synced lead", async () => {
        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/api/extension/leads/lead-1/linkedin-contacted", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ notes: "Sent manually on LinkedIn" })
        }) as any, { params: Promise.resolve({ id: "lead-1" }) });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.status).toBe("MULTI_CHANNEL_CONTACTED");
        expect(mockMarkDone).toHaveBeenCalledWith({
            teamId: "team-a",
            userId: "user-1",
            leadId: "lead-1",
            notes: "Sent manually on LinkedIn"
        });
    });
});
