import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { RATE_LIMIT_BACKSTOP, rateLimitBackstopOptions } from "@/lib/rateLimitBackstop";

// Stand-in for server.ts's verifiedUserId: a request "is verified" as whatever
// this header says. The keying logic under test only sees the resolver's result.
const TEST_USER_HEADER = "x-test-verified-user";

async function buildApp() {
    const app = Fastify();
    await app.register(
        rateLimit,
        rateLimitBackstopOptions(async (request) => {
            const user = request.headers[TEST_USER_HEADER];
            return typeof user === "string" ? user : undefined;
        }),
    );
    app.route({ method: "GET", url: "/probe", handler: async () => ({ ok: true }) });
    return app;
}

function probe(app: Awaited<ReturnType<typeof buildApp>>, opts: { user?: string; ip?: string } = {}) {
    return app.inject({
        method: "GET",
        url: "/probe",
        remoteAddress: opts.ip ?? "203.0.113.10",
        headers: opts.user ? { [TEST_USER_HEADER]: opts.user } : {},
    });
}

async function spend(app: Awaited<ReturnType<typeof buildApp>>, opts: { user?: string; ip?: string }) {
    for (let i = 0; i < RATE_LIMIT_BACKSTOP.max; i++) {
        const res = await probe(app, opts);
        expect(res.statusCode).toBe(200);
    }
}

describe("rate-limit backstop", () => {
    beforeEach(() => {
        // vitest runs with NODE_ENV=test, which (like nextAdapter's tiers) turns the backstop off.
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("DISABLE_RATE_LIMIT", "");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("gives each verified user their own bucket, even from one shared IP", async () => {
        const app = await buildApp();
        await spend(app, { user: "user-a" });

        const limited = await probe(app, { user: "user-a" });
        expect(limited.statusCode).toBe(429);
        expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);

        // Same IP (Render's egress, say), different verified user: unaffected.
        expect((await probe(app, { user: "user-b" })).statusCode).toBe(200);
    });

    it("keys requests with no verified user on the IP", async () => {
        const app = await buildApp();
        await spend(app, {});

        expect((await probe(app, {})).statusCode).toBe(429);
        expect((await probe(app, { ip: "198.51.100.7" })).statusCode).toBe(200);
    });

    it("does not let an unverified flood from a user's IP exhaust that user's bucket", async () => {
        const app = await buildApp();
        await spend(app, {});

        expect((await probe(app, {})).statusCode).toBe(429);
        expect((await probe(app, { user: "user-a" })).statusCode).toBe(200);
    });

    it("is off when DISABLE_RATE_LIMIT=true, like the per-route tiers", async () => {
        vi.stubEnv("DISABLE_RATE_LIMIT", "true");
        const app = await buildApp();
        await spend(app, { user: "user-a" });

        expect((await probe(app, { user: "user-a" })).statusCode).toBe(200);
    });
});
