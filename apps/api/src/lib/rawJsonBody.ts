import type { FastifyInstance } from "fastify";

// Webhooks that verify a signature over the exact request bytes. Fastify's built-in JSON
// parser keeps only the parsed object, and server.ts hands route handlers JSON.stringify of
// it, which isn't byte-identical to what Meta signed (Meta escapes non-ASCII as \uXXXX and
// "/" as "\/"). For these paths the body isn't parsed at all: the original bytes go on
// request.rawBody, which server.ts passes through unchanged, and the handler parses them only
// after verifying the signature. Stripe Connect, Razorpay and WhatsApp (Meta) sign their bytes
// the same way, and their handlers already read req.text() before parsing (OPEN-306).
export const RAW_JSON_BODY_PATHS = ["/webhooks/meta-social", "/webhooks/stripe-connect", "/webhooks/razorpay", "/webhooks/whatsapp"];

export function keepRawJsonBody(app: FastifyInstance, paths: readonly string[] = RAW_JSON_BODY_PATHS) {
    // Same parser and poisoning options as Fastify's default ("error" for both), so every
    // other JSON route parses exactly as before.
    const parseJson = app.getDefaultJsonParser("error", "error");
    app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req: any, body: Buffer, done) => {
        const path = String(req.url ?? "").split("?")[0];
        if (paths.includes(path)) {
            req.rawBody = body;
            done(null, body);
            return;
        }
        parseJson(req, body.toString("utf8"), done);
    });
}
