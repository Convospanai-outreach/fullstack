import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The /caller page used to admit only CALLER while the API behind it also admitted managers and admins, so an
// owner could see the "Calling" tab but was bounced off the page. These two lists must stay the same.
describe("caller page roles", () => {
    const proxySource = readFileSync(resolve(__dirname, "proxy.ts"), "utf8");
    const apiSource = readFileSync(resolve(__dirname, "../../api/routes/caller/queue/route.ts"), "utf8");

    const pageRoles = /const allowed = \[([^\]]+)\]/.exec(proxySource)?.[1].match(/"([A-Z_]+)"/g)?.map((r) => r.replaceAll('"', ""));
    const isAllowedBody = /function isAllowed\([^)]*\)\s*\{([\s\S]*?)\n\}/.exec(apiSource)?.[1] ?? "";
    const apiRoles = [...isAllowedBody.matchAll(/UserRole\.([A-Z_]+)/g)].map((m) => m[1]);

    it("finds both role lists", () => {
        expect(pageRoles?.length).toBeGreaterThan(0);
        expect(apiRoles.length).toBeGreaterThan(0);
    });

    it("lets the same roles onto the page as the API lets call it", () => {
        expect([...(pageRoles ?? [])].sort()).toEqual([...apiRoles].sort());
    });
});
