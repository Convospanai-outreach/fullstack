import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSiteRedirects, toNextRedirects } from "./siteRedirects.mjs";

describe("loadSiteRedirects", () => {
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "redirects-"));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    const load = (value: unknown) => {
        const file = path.join(dir, "redirects.json");
        fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
        return loadSiteRedirects(file);
    };

    it("reads rules, defaulting to a temporary redirect", () => {
        expect(load({ redirects: [{ from: "/old", to: "/new" }, { from: "/a", to: "https://example.com/b", permanent: true }] })).toEqual([
            { from: "/old", to: "/new", permanent: false },
            { from: "/a", to: "https://example.com/b", permanent: true },
        ]);
    });

    it.each([
        ["a source that is not a path", { from: "old", to: "/new" }],
        ["a source with a query or fragment", { from: "/old?x=1", to: "/new" }],
        ["a source with a wildcard or pattern", { from: "/old/:path*", to: "/new" }],
        ["the home page as a source", { from: "/", to: "/new" }],
        ["a source inside /api", { from: "/api/health", to: "/new" }],
        ["a source inside /_next", { from: "/_next/static", to: "/new" }],
        ["a source inside /cms", { from: "/cms", to: "/new" }],
        ["a source inside /superadmin", { from: "/superadmin", to: "/new" }],
        ["a destination on another scheme", { from: "/old", to: "javascript:alert(1)" }],
        ["a protocol-relative destination", { from: "/old", to: "//evil.example" }],
        ["a destination that is not a path or https address", { from: "/old", to: "new" }],
        ["a rule that points to itself", { from: "/same", to: "/same" }],
        ["a rule with missing fields", { from: "/old" }],
    ])("skips %s", (_label, rule) => {
        expect(load({ redirects: [rule, { from: "/ok", to: "/fine" }] })).toEqual([{ from: "/ok", to: "/fine", permanent: false }]);
    });

    it("keeps the first rule when a source appears twice, and at most 500 rules", () => {
        expect(load({ redirects: [{ from: "/x", to: "/one" }, { from: "/x", to: "/two" }] })).toEqual([{ from: "/x", to: "/one", permanent: false }]);

        const many = Array.from({ length: 600 }, (_, i) => ({ from: `/p${i}`, to: "/t" }));
        expect(load({ redirects: many })).toHaveLength(500);
    });

    it("returns nothing, rather than failing the build, for a missing, broken or oddly shaped file", () => {
        expect(loadSiteRedirects(path.join(dir, "missing.json"))).toEqual([]);
        expect(load("{ not json")).toEqual([]);
        expect(load({ redirects: "nope" })).toEqual([]);
        expect(load([])).toEqual([]);
    });
});

describe("toNextRedirects", () => {
    it("maps rules to Next.js redirects with the right status", () => {
        expect(
            toNextRedirects([
                { from: "/a", to: "/b", permanent: true },
                { from: "/c", to: "/d", permanent: false },
            ])
        ).toEqual([
            { source: "/a", destination: "/b", permanent: true },
            { source: "/c", destination: "/d", permanent: false },
        ]);
    });
});
