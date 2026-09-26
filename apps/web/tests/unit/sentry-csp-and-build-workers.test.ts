import { execFileSync } from "node:child_process";
import path from "node:path";
// Imported from its implementation module: src/types/next-server-shim.d.ts
// redeclares `next/server` with NextRequest as a type-only interface, so the
// runtime class can't be constructed through that specifier under tsc.
import { NextRequest } from "next/dist/server/web/spec-extension/request";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

// OPEN-266 follow-ups found after B-09 (Sentry wiring) reached production:
// 1. The site CSP's connect-src did not allow the Sentry ingest host, so the
//    browser refused every event send — Sentry initialised but delivered nothing.
// 2. `next build` sized its worker pool from os.cpus() (48 on Render's builder),
//    and 47 workers each loading the Sentry-wrapped app OOM-killed the build.

const DSN = "https://examplepublickey@o4500000000000000.ingest.us.sentry.io/4500000000000001";
const INGEST_ORIGIN = "https://o4500000000000000.ingest.us.sentry.io";

async function connectSrcTokens(): Promise<string[]> {
    // A real NextRequest, exactly what Next hands the proxy. The cast only
    // bridges the shim's hand-written cookie typings, which are narrower than
    // Next's real ones under exactOptionalPropertyTypes.
    const req = new NextRequest("https://craftmyfunnel.live/") as unknown as Parameters<typeof proxy>[0];
    const res = await proxy(req);
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    const directive = csp
        .split(";")
        .map((d) => d.trim())
        .find((d) => d.startsWith("connect-src"));
    expect(directive, "proxy must emit a connect-src directive").toBeDefined();
    return (directive ?? "").split(/\s+/);
}

describe("OPEN-266 — CSP allows the Sentry ingest origin", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("allowlists the ingest origin derived from NEXT_PUBLIC_SENTRY_DSN", async () => {
        vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
        const tokens = await connectSrcTokens();
        expect(tokens).toContain(INGEST_ORIGIN);
    });

    it("emits only the origin, never the DSN's public key or project path", async () => {
        vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
        const directive = (await connectSrcTokens()).join(" ");
        expect(directive).not.toContain("examplepublickey");
        expect(directive).not.toContain("4500000000000001");
    });

    it("adds no Sentry host when no DSN is configured", async () => {
        vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
        const directive = (await connectSrcTokens()).join(" ");
        expect(directive).not.toMatch(/sentry\.io/);
    });

    it("ignores a malformed DSN instead of throwing", async () => {
        vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://exa mple.com/1");
        const directive = (await connectSrcTokens()).join(" ");
        expect(directive).not.toContain("exa mple");
    });
});

describe("OPEN-266 — build worker pool is pinned", () => {
    // Loaded in a plain Node child process: importing next.config.mjs through
    // Vite's transform pipeline drags the whole @sentry/nextjs build-plugin
    // graph through it (~30s). This still exercises the real withSentryConfig.
    it("sets experimental.cpus on the Sentry-wrapped config so build memory doesn't scale with host cores", () => {
        const webRoot = path.resolve(__dirname, "..", "..");
        const cpus = execFileSync(
            process.execPath,
            [
                "--input-type=module",
                "-e",
                "const m = await import('./next.config.mjs'); process.stdout.write(JSON.stringify(m.default.experimental?.cpus ?? null));",
            ],
            { cwd: webRoot, encoding: "utf8" },
        );
        expect(JSON.parse(cpus)).toBe(4);
    }, 30_000);
});
