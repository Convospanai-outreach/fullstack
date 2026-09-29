import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
// Imported from its implementation module: src/types/next-server-shim.d.ts
// redeclares `next/server` with NextRequest as a type-only interface, so the
// runtime class can't be constructed through that specifier under tsc.
import { NextRequest } from "next/dist/server/web/spec-extension/request";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

// Roadmap S-17 (3.6 part 1): the live site sent `x-powered-by: Next.js` and
// `X-XSS-Protection: 1; mode=block`, and apps/web carried a Socket.IO server whose
// `join_team` trusted a shared secret sent by clients. That server was never
// started in production (Render runs `next start`), so it is removed rather than
// given session auth.

const webRoot = path.resolve(__dirname, "..", "..");

describe("S-17 — security headers", () => {
    it("sets X-XSS-Protection to 0", async () => {
        const req = new NextRequest("https://craftmyfunnel.live/") as unknown as Parameters<typeof proxy>[0];
        const res = await proxy(req);
        expect(res.headers.get("X-XSS-Protection")).toBe("0");
    });

    // Loaded in a plain Node child process for the same reason as the OPEN-266
    // worker-pool test: this exercises the real withSentryConfig-wrapped config.
    it("turns off Next's x-powered-by header", () => {
        const poweredBy = execFileSync(
            process.execPath,
            [
                "--input-type=module",
                "-e",
                "const m = await import('./next.config.mjs'); process.stdout.write(JSON.stringify(m.default.poweredByHeader ?? null));",
            ],
            { cwd: webRoot, encoding: "utf8" },
        );
        expect(JSON.parse(poweredBy)).toBe(false);
    }, 30_000);
});

describe("S-17 — no Socket.IO server in apps/web", () => {
    it("does not ship the unauthenticated Socket.IO server or its dependency", () => {
        const pkg = JSON.parse(readFileSync(path.join(webRoot, "package.json"), "utf8")) as {
            dependencies?: Record<string, string>;
        };
        expect(pkg.dependencies?.["socket.io"]).toBeUndefined();
        expect(existsSync(path.join(webRoot, "server.ts"))).toBe(false);
        expect(existsSync(path.join(webRoot, "src", "lib", "socket.ts"))).toBe(false);
    });
});
