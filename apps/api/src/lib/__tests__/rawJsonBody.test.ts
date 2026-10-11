import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { keepRawJsonBody } from "@/lib/rawJsonBody";

// Meta-style payload: non-ASCII escaped as é, "/" escaped as "\/", and whitespace that
// JSON.stringify of the parsed object would not reproduce.
const PAYLOAD = '{"object":"instagram", "entry":[{"id":"1","messaging":[{"message":{"text":"caf\\u00e9 \\/ hi"}}]}]}';

async function buildApp() {
    const app = Fastify();
    keepRawJsonBody(app);
    const echo = async (request: any) => ({
        raw: request.rawBody ? request.rawBody.toString("utf8") : null,
        parsed: !Buffer.isBuffer(request.body),
        text: request.body?.entry?.[0]?.messaging?.[0]?.message?.text ?? null,
    });
    app.post("/webhooks/meta-social", echo);
    app.post("/other", echo);
    return app;
}

describe("keepRawJsonBody", () => {
    it("keeps the exact signed bytes for the Meta webhook path and doesn't parse them before the handler verifies", async () => {
        const app = await buildApp();
        const res = await app.inject({
            method: "POST",
            url: "/webhooks/meta-social",
            headers: { "content-type": "application/json; charset=utf-8" },
            payload: PAYLOAD,
        });
        const body = res.json();
        expect(body.raw).toBe(PAYLOAD);
        expect(body.parsed).toBe(false);

        const sign = (value: string) => crypto.createHmac("sha256", "secret").update(value).digest("hex");
        expect(sign(body.raw)).toBe(sign(PAYLOAD));
        // What server.ts would have passed on without the raw body: a different signature.
        expect(sign(JSON.stringify(JSON.parse(PAYLOAD)))).not.toBe(sign(PAYLOAD));
    });

    // OPEN-306: Stripe and Razorpay sign pretty-printed JSON. Their handlers read req.text(), which
    // server.ts builds from request.rawBody, so the HMAC must match over exactly those bytes.
    it("keeps the exact signed bytes for the Stripe Connect, Razorpay and WhatsApp webhooks", async () => {
        const app = Fastify();
        keepRawJsonBody(app);
        app.post("/webhooks/stripe-connect", async (request: any) => ({ text: await new Request("http://x", { method: "POST", body: request.rawBody }).text() }));
        app.post("/webhooks/razorpay", async (request: any) => ({ text: await new Request("http://x", { method: "POST", body: request.rawBody }).text() }));
        app.post("/webhooks/whatsapp", async (request: any) => ({ text: await new Request("http://x", { method: "POST", body: request.rawBody }).text() }));
        app.post("/webhooks/mautic", async (request: any) => ({ text: await new Request("http://x", { method: "POST", body: request.rawBody }).text() }));
        const pretty = JSON.stringify({ id: "evt_1", data: { object: { name: "café ✓" } } }, null, 2);
        const sign = (value: string) => crypto.createHmac("sha256", "whsec").update(value).digest("hex");
        for (const url of ["/webhooks/stripe-connect", "/webhooks/razorpay", "/webhooks/whatsapp", "/webhooks/mautic"]) {
            const res = await app.inject({ method: "POST", url, headers: { "content-type": "application/json" }, payload: pretty });
            expect(sign(res.json().text)).toBe(sign(pretty));
        }
        expect(sign(JSON.stringify(JSON.parse(pretty)))).not.toBe(sign(pretty));
    });

    it("leaves every other JSON route as before (parsed, no raw body)", async () => {
        const app = await buildApp();
        const res = await app.inject({ method: "POST", url: "/other", headers: { "content-type": "application/json" }, payload: PAYLOAD });
        expect(res.json()).toEqual({ raw: null, parsed: true, text: "café / hi" });
    });

    it("hands even empty or invalid bodies on the Meta path to the handler, which rejects unsigned ones first", async () => {
        const app = await buildApp();
        for (const payload of ["", "{nope", '{"__proto__":{"x":1}}']) {
            const res = await app.inject({ method: "POST", url: "/webhooks/meta-social", headers: { "content-type": "application/json" }, payload });
            expect(res.statusCode).toBe(200);
            expect(res.json()).toMatchObject({ raw: payload, parsed: false });
        }
    });

    it("keeps Fastify's default rejections for empty, invalid and prototype-poisoned JSON", async () => {
        const app = await buildApp();
        const send = (payload: string) =>
            app.inject({ method: "POST", url: "/other", headers: { "content-type": "application/json" }, payload });
        expect((await send("")).statusCode).toBe(400);
        expect((await send("{nope")).statusCode).toBe(400);
        expect((await send('{"__proto__":{"x":1}}')).statusCode).toBe(400);
    });
});
