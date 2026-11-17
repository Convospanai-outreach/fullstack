import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// server.ts skips its own auth gate for everything under /extension: each handler here must check
// the extension sign-in itself. A new route that forgets it would be open to the internet.
// auth/token is the one exception: it checks the extension key itself and is how a token is made.
const EXEMPT = new Set(["auth/token/route.ts"]);

function routeFiles(dir: string, base = dir): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return routeFiles(full, base);
        return e.name === "route.ts" ? [path.relative(base, full).replace(/\\/g, "/")] : [];
    });
}

describe("every /extension route checks the extension sign-in", () => {
    const files = routeFiles(__dirname);

    it("finds the routes", () => {
        expect(files).toEqual(expect.arrayContaining(["me/route.ts", "brain/[op]/route.ts", "sync/state/route.ts"]));
    });

    for (const file of files.filter((f) => !EXEMPT.has(f))) {
        it(file, () => {
            const src = fs.readFileSync(path.join(__dirname, file), "utf8");
            const handlers = src.match(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g) || [];
            const checks = src.match(/await validateExtensionAuth\(/g) || [];
            expect(handlers.length).toBeGreaterThan(0);
            expect(checks.length).toBeGreaterThanOrEqual(handlers.length);
        });
    }
});
