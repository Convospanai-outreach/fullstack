import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const ingestMauticWebhook = vi.hoisted(() => vi.fn());
vi.mock("@/modules/creator-funnel/mauticSubmission", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/modules/creator-funnel/mauticSubmission")>()),
    ingestMauticWebhook,
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { POST } from "./route";

const SECRET = "test-mautic-secret";
const RAW = '{"mautic.form_on_submit":[{"submission":{"results":{"email":"a@b.co"}}}]}';
const sign = (raw: string, secret = SECRET) => crypto.createHmac("sha256", secret).update(raw).digest("base64");
const post = (raw: string, signature?: string) =>
    POST(
        new Request("http://localhost/webhooks/mautic", {
            method: "POST",
            headers: { "content-type": "application/json", ...(signature ? { "webhook-signature": signature } : {}) },
            body: raw,
        }) as any
    );

describe("/webhooks/mautic", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["MAUTIC_WEBHOOK_SECRET"] = SECRET;
        ingestMauticWebhook.mockResolvedValue({ received: 1, merged: 1, joined: 0, created: 0, dropped: 0, failed: 0 });
    });

    it("fails closed without a secret, with no signature, or a wrong one", async () => {
        delete process.env["MAUTIC_WEBHOOK_SECRET"];
        expect((await post(RAW, sign(RAW))).status).toBe(503);
        process.env["MAUTIC_WEBHOOK_SECRET"] = SECRET;
        expect((await post(RAW)).status).toBe(401);
        expect((await post(RAW, sign(RAW, "other"))).status).toBe(401);
        expect(ingestMauticWebhook).not.toHaveBeenCalled();
    });

    it("processes a correctly signed delivery and answers 500 when a submission failed", async () => {
        expect((await post(RAW, sign(RAW))).status).toBe(200);
        expect(ingestMauticWebhook).toHaveBeenCalledWith(JSON.parse(RAW));
        ingestMauticWebhook.mockResolvedValue({ received: 1, merged: 0, joined: 0, created: 0, dropped: 0, failed: 1 });
        expect((await post(RAW, sign(RAW))).status).toBe(500);
    });

    it("rejects signed non-JSON with 400", async () => {
        expect((await post("not json", sign("not json"))).status).toBe(400);
    });
});
