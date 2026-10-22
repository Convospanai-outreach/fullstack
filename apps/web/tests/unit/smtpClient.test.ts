import { beforeEach, describe, it, expect, vi } from "vitest";

// nodemailer is mocked so these tests never open a real SMTP connection: a real
// connect to smtp.example.com could hang on the CI runner past the test timeout.
const { createTransport, sendMail, verify } = vi.hoisted(() => {
    const sendMail = vi.fn();
    const verify = vi.fn();
    return { createTransport: vi.fn(() => ({ sendMail, verify })), sendMail, verify };
});

vi.mock("nodemailer", () => ({ default: { createTransport } }));

import { createSmtpTransport, sendViaSMTP, verifySmtpConfig } from "@/lib/email/smtpClient";

describe("smtpClient", () => {
    const mockConfig = {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        user: "user@example.com",
        password: "secretpassword",
        fromName: "Test Sender",
        fromEmail: "sender@example.com",
    };

    beforeEach(() => vi.clearAllMocks());

    it("creates transport with correct config", () => {
        const transporter = createSmtpTransport(mockConfig);
        expect(transporter).toBeDefined();
        expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
            host: "smtp.example.com",
            port: 587,
            secure: false,
            auth: { user: "user@example.com", pass: "secretpassword" },
        }));
    });

    it("handles sendViaSMTP error gracefully", async () => {
        sendMail.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND smtp.example.com"));

        const result = await sendViaSMTP(mockConfig, {
            to: "recipient@example.com",
            subject: "Test Subject",
            html: "<p>Hello</p>",
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe("getaddrinfo ENOTFOUND smtp.example.com");
    });

    it("handles verifySmtpConfig error gracefully", async () => {
        verify.mockRejectedValueOnce(new Error("Invalid login"));

        const result = await verifySmtpConfig(mockConfig);

        expect(result.ok).toBe(false);
        expect(result.error).toBe("Invalid login");
    });
});
