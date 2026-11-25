import { describe, expect, it, vi } from "vitest";
import { classifyRecipientProvider, resendFeedbackPayload } from "../resendFeedback";

const { resolveMx } = vi.hoisted(() => ({ resolveMx: vi.fn() }));
vi.mock("node:dns/promises", () => ({ Resolver: class { resolveMx = resolveMx; } }));

describe("Resend delivery feedback", () => {
    it.each([
        ["user@gmail.com", "gmail"],
        ["user@hotmail.co.uk", "outlook"],
        ["user@yahoo.co.in", "yahoo"],
        ["Example <user@icloud.com>", "apple"],
        ["user@pm.me", "other"],
        ["invalid", "unknown"],
    ])("classifies %s without MX", async (address, provider) => {
        resolveMx.mockClear();
        expect(await classifyRecipientProvider(address)).toBe(provider);
        expect(resolveMx).not.toHaveBeenCalled();
    });

    it("checks the preferred MX and caches the result for the company domain", async () => {
        resolveMx.mockClear().mockResolvedValue([
            { priority: 20, exchange: "gateway.example.test" },
            { priority: 10, exchange: "tenant.mail.protection.outlook.com." },
        ]);
        expect(await classifyRecipientProvider("first@mx-lookup.example")).toBe("outlook");
        expect(await classifyRecipientProvider("second@mx-lookup.example")).toBe("outlook");
        expect(resolveMx).toHaveBeenCalledExactlyOnceWith("mx-lookup.example");
    });

    it("makes no new MX requests during immediate mailbox checks", async () => {
        resolveMx.mockClear();
        expect(await classifyRecipientProvider("recipient@uncached.example", true)).toBe("unknown");
        expect(await classifyRecipientProvider("recipient@gmail.com", true)).toBe("gmail");
        expect(resolveMx).not.toHaveBeenCalled();
    });

    it("records SDK-defined bounce detail and allows only sanitized feedback fields", async () => {
        const input = {
            bounce: { type: "Permanent", subType: "General", message: "550 5.1.1 No such user <hidden@example.test>\ncontents" },
            subject: "Private subject",
            from: "sender@example.test",
        };
        expect(await resendFeedbackPayload(input, "recipient@gmail.com", "email.bounced")).toEqual({
            recipient: "recipient@gmail.com", recipientProvider: "gmail",
            bounceType: "Permanent", bounceSubType: "General",
            providerMessage: "550 5.1.1 No such user <[email]>", smtpCode: "550", enhancedSmtpCode: "5.1.1",
        });
    });

    it("uses the failure reason and records a delay even without a provider reason", async () => {
        expect(await resendFeedbackPayload({ failed: { reason: "reached_daily_quota" } }, undefined, "email.failed"))
            .toEqual({ recipientProvider: "unknown", failureReason: "reached_daily_quota" });
        expect(await resendFeedbackPayload({}, undefined, "email.delivery_delayed"))
            .toEqual({ recipientProvider: "unknown" });
    });
});
