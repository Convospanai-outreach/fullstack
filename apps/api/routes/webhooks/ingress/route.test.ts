import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { POST } from "./route";

// Roadmap 3.5 / S-16: X-Timestamp is optional-but-verified.
const SECRET = "test-webhook-secret";
const BODY = { event: "ping", data: { id: 1 } };

function sign(content: string) {
    return crypto.createHmac("sha256", SECRET).update(content).digest("hex");
}

function ingressRequest(headers: Record<string, string>) {
    return new NextRequest("http://localhost/webhooks/ingress", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(BODY),
    });
}

describe("POST /webhooks/ingress", () => {
    const originalSecret = process.env["WEBHOOK_SECRET"];
    beforeEach(() => {
        process.env["WEBHOOK_SECRET"] = SECRET;
    });
    afterEach(() => {
        process.env["WEBHOOK_SECRET"] = originalSecret;
    });

    it("still accepts a caller that sends no timestamp (legacy body-only signature)", async () => {
        const res = await POST(ingressRequest({ "X-Compliance-Hash": sign(JSON.stringify(BODY)) }));
        expect(res.status).toBe(200);
    });

    it("accepts a fresh timestamp bound into the signature", async () => {
        const ts = String(Date.now());
        const res = await POST(ingressRequest({ "X-Timestamp": ts, "X-Compliance-Hash": sign(`${JSON.stringify(BODY)}.${ts}`) }));
        expect(res.status).toBe(200);
    });

    it("rejects a timestamped request outside the 5-minute window", async () => {
        const ts = String(Date.now() - 5 * 60 * 1000 - 1000);
        const res = await POST(ingressRequest({ "X-Timestamp": ts, "X-Compliance-Hash": sign(`${JSON.stringify(BODY)}.${ts}`) }));
        expect(res.status).toBe(403);
    });

    it("rejects a timestamp that isn't covered by the signature (fresh timestamp bolted onto an old body-only signature)", async () => {
        const res = await POST(ingressRequest({ "X-Timestamp": String(Date.now()), "X-Compliance-Hash": sign(JSON.stringify(BODY)) }));
        expect(res.status).toBe(403);
    });

    it("rejects a timestamped signature with the timestamp header stripped", async () => {
        const ts = String(Date.now());
        const res = await POST(ingressRequest({ "X-Compliance-Hash": sign(`${JSON.stringify(BODY)}.${ts}`) }));
        expect(res.status).toBe(403);
    });

    it("rejects a present-but-empty timestamp header", async () => {
        const res = await POST(ingressRequest({ "X-Timestamp": "", "X-Compliance-Hash": sign(`${JSON.stringify(BODY)}.`) }));
        expect(res.status).toBe(403);
    });
});
