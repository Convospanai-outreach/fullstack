import type { NextRequest } from "next/server";

// Verifies the x-craftmyfunnel-internal-relay header the proxy route (see
// app/api/proxy/[...path]/route.ts) signs onto its own self-fetches back into
// this server, so proxy.ts's rate limiter can recognize a re-entrant internal
// request and skip counting it a second time for the same logical client
// request. Uses Web Crypto (not Node's `crypto` module) so this works whether
// this middleware runs on the edge or Node.js runtime.
const RELAY_HEADER = "x-craftmyfunnel-internal-relay";
const MAX_AGE_MS = 30_000;

async function hmacHex(secret: string, message: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
    return Array.from(new Uint8Array(mac))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export async function isValidInternalRelay(req: NextRequest, secret: string): Promise<boolean> {
    if (!secret) return false;
    const value = req.headers.get(RELAY_HEADER);
    if (!value) return false;

    const [timestamp, signature] = value.split(".");
    if (!timestamp || !signature) return false;

    const age = Date.now() - Number(timestamp);
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return false;

    const expected = await hmacHex(secret, `relay.${timestamp}`);
    return expected === signature;
}
