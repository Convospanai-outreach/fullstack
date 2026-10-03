import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const ingestMetaWebhook = vi.hoisted(() => vi.fn());

vi.mock("@/modules/creator-funnel/socialInbox", () => ({ ingestMetaWebhook }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { GET, POST } from "./route";

const VERIFY_TOKEN = "test-verify-token";
const APP_SECRET = "test-app-secret";
// Exactly as Meta might send it: \u-escaped non-ASCII, an escaped slash, spacing.
const RAW = '{"object":"instagram","entry":[{"id":"ig-1","messaging":[{"sender":{"id":"igsid-9"},"message":{"mid":"m1","text":"caf\\u00e9 \\/ hi"}}]}]}';

const sign = (raw: string, secret = APP_SECRET) => `sha256=${crypto.createHmac("sha256", secret).update(raw).digest("hex")}`;

function post(raw: string, signature?: string) {
    return POST(new Request("http://localhost/webhooks/meta-social", {
        method: "POST",
        headers: { "content-type": "application/json", ...(signature ? { "x-hub-signature-256": signature } : {}) },
        body: raw,
    }) as any);
}

describe("/webhooks/meta-social", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["META_WEBHOOK_VERIFY_TOKEN"] = VERIFY_TOKEN;
        process.env["FACEBOOK_APP_SECRET"] = APP_SECRET;
        ingestMetaWebhook.mockResolvedValue({ events: 1, stored: 1, failed: 0 });
    });

    describe("GET (verification)", () => {
        const verify = (params: string) => GET(new Request(`http://localhost/webhooks/meta-social?${params}`) as any);

        it("echoes the challenge for the right token", async () => {
            const res = await verify(`hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345`);
            expect(res.status).toBe(200);
            expect(await res.text()).toBe("12345");
        });

        it("refuses a wrong token, and 503s when no token is configured", async () => {
            expect((await verify("hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1")).status).toBe(403);
            delete process.env["META_WEBHOOK_VERIFY_TOKEN"];
            expect((await verify(`hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1`)).status).toBe(503);
        });
    });

    describe("POST (deliveries)", () => {
        it("accepts a delivery signed over the exact bytes Meta sent", async () => {
            const res = await post(RAW, sign(RAW));
            expect(res.status).toBe(200);
            expect(ingestMetaWebhook).toHaveBeenCalledWith(JSON.parse(RAW));
            expect(ingestMetaWebhook.mock.calls[0][0].entry[0].messaging[0].message.text).toBe("café / hi");
        });

        it("rejects unsigned and wrongly signed deliveries before parsing them", async () => {
            expect((await post(RAW)).status).toBe(401);
            expect((await post(RAW, sign(RAW, "other-secret"))).status).toBe(401);
            // Signed over the re-serialized JSON rather than the bytes sent: rejected.
            expect((await post(RAW, sign(JSON.stringify(JSON.parse(RAW))))).status).toBe(401);
            expect(ingestMetaWebhook).not.toHaveBeenCalled();
        });

        it("503s without the app secret, and 400s on signed invalid JSON", async () => {
            expect((await post("{nope", sign("{nope"))).status).toBe(400);
            delete process.env["FACEBOOK_APP_SECRET"];
            expect((await post(RAW, sign(RAW))).status).toBe(503);
            expect(ingestMetaWebhook).not.toHaveBeenCalled();
        });

        it("returns 500 when any event failed, so Meta retries the delivery", async () => {
            ingestMetaWebhook.mockResolvedValue({ events: 2, stored: 1, failed: 1 });
            expect((await post(RAW, sign(RAW))).status).toBe(500);
        });
    });
});
