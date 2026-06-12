import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockValidateExtensionAuth, mockSyncCapture } = vi.hoisted(() => ({
    mockValidateExtensionAuth: vi.fn(),
    mockSyncCapture: vi.fn()
}));

vi.mock("../../_lib/auth", () => ({
    validateExtensionAuth: mockValidateExtensionAuth
}));

vi.mock("@/services/extensionLeadCaptureService", () => {
    return {
        normalizeLinkedInProfileUrl(value: unknown) {
            if (typeof value !== "string") return null;
            try {
                const parsed = new URL(value);
                if (parsed.protocol !== "https:") return null;
                if (!["linkedin.com", "www.linkedin.com"].includes(parsed.hostname.toLowerCase())) return null;
                const match = parsed.pathname.match(/\/in\/([^/?#]+)/i);
                return match?.[1] ? `https://www.linkedin.com/in/${match[1]}/` : null;
            } catch {
                return null;
            }
        },
        syncLinkedInExtensionCapture: mockSyncCapture
    };
});

describe("extension LinkedIn lead capture route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockValidateExtensionAuth.mockResolvedValue({
            ok: true,
            user: { id: "user-1", email: "u@example.com", name: "User", memberships: [{ teamId: "team-a" }] },
            teamIds: ["team-a"]
        });
        mockSyncCapture.mockResolvedValue({
            success: true,
            leadId: "lead-1",
            matchedExisting: true,
            status: "MULTI_CHANNEL_ENGAGED",
            message: "LinkedIn capture synced to existing lead"
        });
    });

    it("syncs a LinkedIn capture through the unified lead flow", async () => {
        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/api/extension/leads/capture", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                name: "Jane Doe",
                linkedinUrl: "https://www.linkedin.com/in/jane-doe/?mini=1",
                company: "CraftMyFunnel",
                confidence: { company: 96 }
            })
        }) as any);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({ success: true, leadId: "lead-1", matchedExisting: true });
        expect(mockSyncCapture).toHaveBeenCalledWith(expect.objectContaining({
            teamId: "team-a",
            userId: "user-1",
            payload: expect.objectContaining({
                linkedinUrl: "https://www.linkedin.com/in/jane-doe/"
            })
        }));
    });

    it("rejects invalid LinkedIn URLs", async () => {
        const { POST } = await import("./route");
        const response = await POST(new Request("http://localhost/api/extension/leads/capture", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ linkedinUrl: "https://example.com/in/jane" })
        }) as any);
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload.code).toBe("INVALID_LINKEDIN_URL");
        expect(mockSyncCapture).not.toHaveBeenCalled();
    });
});
