import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockSendViaSMTP } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockSendViaSMTP: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/email/smtpClient", () => ({ sendViaSMTP: mockSendViaSMTP }));

import { POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/api/integrations/smtp/test", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /api/integrations/smtp/test", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects an unauthenticated caller before attempting any SMTP connection (closes an anonymous SSRF probe vector)", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(
            postRequest({
                host: "internal-service.local",
                port: 25,
                user: "u",
                password: "p",
                email: "me@example.com",
                recipientEmail: "me@example.com",
            })
        );

        expect(res.status).toBe(401);
        expect(mockSendViaSMTP).not.toHaveBeenCalled();
    });

    it("sends the test email for an authenticated caller", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockSendViaSMTP.mockResolvedValue({ success: true, messageId: "msg-1" });

        const res = await POST(
            postRequest({
                host: "smtp.example.com",
                port: 587,
                user: "u",
                password: "p",
                email: "me@example.com",
                recipientEmail: "me@example.com",
            })
        );

        expect(res.status).toBe(200);
        expect(mockSendViaSMTP).toHaveBeenCalled();
    });
});
