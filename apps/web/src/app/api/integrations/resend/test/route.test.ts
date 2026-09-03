import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockResendSend } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockResendSend: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("resend", () => ({
    Resend: function Resend() {
        return { emails: { send: mockResendSend } };
    },
}));

import { POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/api/integrations/resend/test", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /api/integrations/resend/test", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects an unauthenticated caller before sending any email", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(
            postRequest({ apiKey: "re_key", email: "me@example.com", recipientEmail: "victim@example.com" })
        );

        expect(res.status).toBe(401);
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it("sends the test email for an authenticated caller", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockResendSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

        const res = await POST(
            postRequest({ apiKey: "re_key", email: "me@example.com", recipientEmail: "me@example.com" })
        );

        expect(res.status).toBe(200);
        expect(mockResendSend).toHaveBeenCalled();
    });
});
