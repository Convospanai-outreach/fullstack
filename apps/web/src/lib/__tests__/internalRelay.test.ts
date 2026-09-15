import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { isValidInternalRelay } from "../internalRelay";

const SECRET = "test-nextauth-secret";

function reqWithHeader(value: string | null): NextRequest {
    return {
        headers: { get: (name: string) => (name === "x-craftmyfunnel-internal-relay" ? value : null) },
    } as unknown as NextRequest;
}

async function signRelay(secret: string, timestamp: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`relay.${timestamp}`));
    return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("isValidInternalRelay", () => {
    it("accepts a freshly signed relay header", async () => {
        const timestamp = String(Date.now());
        const signature = await signRelay(SECRET, timestamp);

        await expect(isValidInternalRelay(reqWithHeader(`${timestamp}.${signature}`), SECRET)).resolves.toBe(true);
    });

    it("rejects a missing header", async () => {
        await expect(isValidInternalRelay(reqWithHeader(null), SECRET)).resolves.toBe(false);
    });

    it("rejects a header signed with the wrong secret (can't be forged by an external client)", async () => {
        const timestamp = String(Date.now());
        const signature = await signRelay("wrong-secret", timestamp);

        await expect(isValidInternalRelay(reqWithHeader(`${timestamp}.${signature}`), SECRET)).resolves.toBe(false);
    });

    it("rejects a stale header outside the freshness window", async () => {
        const timestamp = String(Date.now() - 60_000);
        const signature = await signRelay(SECRET, timestamp);

        await expect(isValidInternalRelay(reqWithHeader(`${timestamp}.${signature}`), SECRET)).resolves.toBe(false);
    });

    it("rejects when no secret is configured", async () => {
        const timestamp = String(Date.now());
        const signature = await signRelay(SECRET, timestamp);

        await expect(isValidInternalRelay(reqWithHeader(`${timestamp}.${signature}`), "")).resolves.toBe(false);
    });
});
