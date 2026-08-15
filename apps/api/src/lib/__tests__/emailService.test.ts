import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email/smtpClient", () => ({ sendViaSMTP: vi.fn() }));
vi.mock("@/lib/db", () => ({
    prisma: {
        verificationToken: { deleteMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
        user: { update: vi.fn() },
    },
}));

import { sendViaSMTP } from "@/lib/email/smtpClient";
import { EmailService } from "../emailService";

describe("EmailService.sendEmail", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sends via SMTP directly instead of self-fetching /email/send (this is apps/api's own backend code, always server-side)", async () => {
        (sendViaSMTP as any).mockResolvedValue({ success: true, messageId: "msg-1" });

        const result = await EmailService.sendEmail("lead@example.com", "Hello", "<p>Hi</p>");

        expect(sendViaSMTP).toHaveBeenCalledTimes(1);
        const [config, options] = (sendViaSMTP as any).mock.calls[0];
        expect(options).toEqual({ to: "lead@example.com", subject: "Hello", html: "<p>Hi</p>" });
        expect(config.host).toBeTruthy();
        expect(result).toEqual({ success: true, messageId: "msg-1" });
    });

    it("prefers explicit fromName/fromEmail over the SMTP env defaults", async () => {
        (sendViaSMTP as any).mockResolvedValue({ success: true, messageId: "msg-2" });

        await EmailService.sendEmail("lead@example.com", "Hello", "<p>Hi</p>", "Custom Sender", "custom@example.com");

        const [config] = (sendViaSMTP as any).mock.calls[0];
        expect(config.fromName).toBe("Custom Sender");
        expect(config.fromEmail).toBe("custom@example.com");
    });

    it("propagates SMTP failures instead of swallowing them", async () => {
        (sendViaSMTP as any).mockResolvedValue({ success: false, error: "SMTP auth failed" });

        const result = await EmailService.sendEmail("lead@example.com", "Hello", "<p>Hi</p>");

        expect(result).toEqual({ success: false, error: "SMTP auth failed" });
    });
});
