import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression for roadmap B-07: nodemailer has no default connect/greeting/socket
// timeouts, so a stuck SMTP server hangs the send indefinitely. Assert the
// transport is created with all three bounds.

const { createTransport } = vi.hoisted(() => ({ createTransport: vi.fn(() => ({})) }));

vi.mock("nodemailer", () => ({ default: { createTransport } }));

import { createSmtpTransport } from "./smtpClient";

describe("createSmtpTransport", () => {
    beforeEach(() => vi.clearAllMocks());

    it("sets connection, greeting, and socket timeouts", () => {
        createSmtpTransport({
            host: "smtp.example.com",
            port: 587,
            secure: false,
            user: "user@example.com",
            password: "pw",
            fromName: "Test",
            fromEmail: "test@example.com",
        });

        expect(createTransport).toHaveBeenCalledTimes(1);
        const opts = createTransport.mock.calls[0][0] as Record<string, unknown>;
        expect(opts["connectionTimeout"]).toBe(10_000);
        expect(opts["greetingTimeout"]).toBe(10_000);
        expect(opts["socketTimeout"]).toBe(20_000);
    });
});
