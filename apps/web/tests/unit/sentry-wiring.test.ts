import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// roadmap B-09 — Sentry was declared but never initialised: the client/server
// config files were never loaded, used the wrong DSN env var, and referenced the
// v9 `new Sentry.Replay()` API that no longer exists in v10 (would throw at load).
// These structural guards lock in the corrected wiring. Sentry stays a no-op
// until a DSN is provisioned, so there is no runtime behaviour to unit-test.
const webRoot = path.resolve(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(webRoot, rel), "utf8");

describe("roadmap B-09 — client Sentry instrumentation", () => {
    const client = read("src/instrumentation-client.ts");

    it("initialises Sentry with the client-readable DSN env var", () => {
        expect(client).toContain("Sentry.init");
        expect(client).toContain("NEXT_PUBLIC_SENTRY_DSN");
        // The client bundle cannot read a server-only SENTRY_DSN.
        expect(client).not.toContain('process.env["SENTRY_DSN"]');
    });

    it("uses the v10 replayIntegration() API, not the removed Sentry.Replay class", () => {
        expect(client).toContain("Sentry.replayIntegration(");
        expect(client).not.toContain("new Sentry.Replay(");
    });

    it("exports onRouterTransitionStart for navigation tracing", () => {
        expect(client).toContain("export const onRouterTransitionStart");
        expect(client).toContain("Sentry.captureRouterTransitionStart");
    });
});

describe("roadmap B-09 — server Sentry instrumentation", () => {
    const instrumentation = read("src/instrumentation.ts");

    it("initialises Sentry before the hardware-verify early-return", () => {
        const initIdx = instrumentation.indexOf("Sentry.init");
        const skipIdx = instrumentation.indexOf("shouldSkipHardwareVerification");
        expect(initIdx).toBeGreaterThan(0);
        // Init must precede the block that returns early in production.
        expect(initIdx).toBeLessThan(skipIdx);
    });

    it("exports onRequestError so Next reports server errors to Sentry", () => {
        expect(instrumentation).toContain("export const onRequestError");
        expect(instrumentation).toContain("Sentry.captureRequestError");
    });
});

describe("roadmap B-09 — build integration", () => {
    it("wraps next.config with withSentryConfig", () => {
        const config = read("next.config.mjs");
        expect(config).toContain("withSentryConfig");
        expect(config).toContain("withSentryConfig(nextConfig");
    });

    it("removes the legacy, never-loaded sentry.*.config.ts files", () => {
        expect(fs.existsSync(path.join(webRoot, "sentry.client.config.ts"))).toBe(false);
        expect(fs.existsSync(path.join(webRoot, "sentry.server.config.ts"))).toBe(false);
    });
});
