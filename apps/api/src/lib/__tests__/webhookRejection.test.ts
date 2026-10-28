import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mockWarn, error: vi.fn(), info: vi.fn() } }));

import { logWebhookRejected } from "../webhookRejection";

function webhookRequest(headers: Record<string, string> = {}) {
    return new Request("https://api.example.com/webhooks/stripe-billing?token=abc123", { method: "POST", headers });
}

describe("logWebhookRejected", () => {
    beforeEach(() => vi.clearAllMocks());

    it("logs the provider, reason, path, caller IP and body length", () => {
        logWebhookRejected(webhookRequest({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }), "stripe-billing", "invalid_signature", 412);

        expect(mockWarn).toHaveBeenCalledWith("webhook.signature_invalid", {
            provider: "stripe-billing",
            reason: "invalid_signature",
            path: "/webhooks/stripe-billing",
            ip: "203.0.113.9",
            bodyLength: 412,
        });
    });

    it("falls back to x-real-ip, then to unknown", () => {
        logWebhookRejected(webhookRequest({ "x-real-ip": "198.51.100.4" }), "resend", "missing_signature");
        logWebhookRejected(webhookRequest(), "resend", "missing_signature");

        expect(mockWarn.mock.calls[0]![1]).toMatchObject({ ip: "198.51.100.4" });
        expect(mockWarn.mock.calls[1]![1]).toMatchObject({ ip: "unknown" });
    });

    it("never logs the query string, the signature header or the body", () => {
        const req = webhookRequest({ "stripe-signature": "t=1,v1=secretsignature" });

        logWebhookRejected(req, "stripe-billing", "invalid_signature", 10);

        const logged = JSON.stringify(mockWarn.mock.calls);
        expect(logged).not.toContain("abc123");
        expect(logged).not.toContain("secretsignature");
    });
});

// Every provider webhook that checks a signature reports a rejected one through the helper, so a
// new silent branch is caught here instead of in an incident.
describe("webhook routes report rejected signatures", () => {
    const apiRoot = path.resolve(__dirname, "../../..");
    it.each([
        "routes/webhooks/stripe-billing/route.ts",
        "src/modules/checkout/api/stripeWebhook.ts",
        "routes/webhooks/resend/route.ts",
        "routes/webhooks/meta-social/route.ts",
        "routes/webhooks/whatsapp/route.ts",
        "routes/webhooks/razorpay/route.ts",
        "routes/webhooks/mautic/route.ts",
    ])("%s", (file) => {
        const source = readFileSync(path.join(apiRoot, file), "utf8");
        expect(source).toContain("logWebhookRejected(");
    });
});
