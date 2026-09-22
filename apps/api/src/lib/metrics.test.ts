import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { httpRequestDuration, getMetrics } from "./metrics";

describe("roadmap 2.10 / I-06 — HTTP latency histogram", () => {
    it("registers http_request_duration_seconds and exposes labeled samples via getMetrics()", async () => {
        httpRequestDuration.observe({ method: "GET", route: "/health", status_code: "200" }, 0.123);
        const output = await getMetrics();
        expect(output).toContain("http_request_duration_seconds");
        expect(output).toContain('route="/health"');
        expect(output).toContain('status_code="200"');
    });
});

describe("roadmap 2.10 / I-06 — Fastify server wiring", () => {
    const server = fs.readFileSync(path.resolve(__dirname, "..", "..", "server.ts"), "utf8");

    it("records latency via an onResponse hook using the matched route pattern", () => {
        expect(server).toContain('addHook(\'onResponse\'');
        expect(server).toContain("httpRequestDuration.observe");
        expect(server).toContain("routeOptions?.url");
    });

    it("only uses the pino-pretty transport outside production", () => {
        // Structural (reformat-safe): pino-pretty must appear in the same statement
        // as a NODE_ENV production guard, i.e. never unconditionally.
        const prettyIdx = server.indexOf("target: 'pino-pretty'");
        expect(prettyIdx).toBeGreaterThan(0);
        const window = server.slice(Math.max(0, prettyIdx - 200), prettyIdx + 40);
        expect(window).toMatch(/NODE_ENV[^\n]*['"]production['"]/);
    });
});
