import { describe, it, expect, vi } from "vitest";
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

    it("creates transport with correct config", () => {
        const transporter = createSmtpTransport(mockConfig);
        expect(transporter).toBeDefined();
    });

    it("handles sendViaSMTP error gracefully", async () => {
        const result = await sendViaSMTP(mockConfig, {
            to: "recipient@example.com",
            subject: "Test Subject",
            html: "<p>Hello</p>",
        });

        // Fails against mock host
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    it("handles verifySmtpConfig error gracefully", async () => {
        const result = await verifySmtpConfig(mockConfig);
        expect(result.ok).toBe(false);
        expect(result.error).toBeDefined();
    });
});
