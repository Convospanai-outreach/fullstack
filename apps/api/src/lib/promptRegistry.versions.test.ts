import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// promptRegistry.test.ts fails when a prompt changes without its fingerprint being updated. This
// closes the other gap: updating the fingerprint but forgetting to bump the version, which would let
// two different prompts share one id@vN in provenance and outcome data. It compares the registry
// against the one on origin/main, and skips when that ref is not available (a shallow checkout).

type Entry = { version: number; fingerprint: string };

function parseRegistry(source: string): Record<string, Entry> {
    const entries: Record<string, Entry> = {};
    for (const m of source.matchAll(/"([\w.]+)":\s*\{\s*version:\s*(\d+),\s*fingerprint:\s*"([0-9a-f]+)"\s*\}/g)) {
        entries[m[1]] = { version: Number(m[2]), fingerprint: m[3] };
    }
    return entries;
}

function versionProblems(base: Record<string, Entry>, head: Record<string, Entry>): string[] {
    const problems: string[] = [];
    for (const [id, was] of Object.entries(base)) {
        const now = head[id];
        if (!now) problems.push(`${id} was removed; retire a prompt by keeping its entry or say so in the PR`);
        else if (now.version < was.version) problems.push(`${id} went back from v${was.version} to v${now.version}`);
        else if (now.fingerprint !== was.fingerprint && now.version === was.version) problems.push(`${id} changed (${was.fingerprint} -> ${now.fingerprint}) but is still v${now.version}: bump its version`);
    }
    return problems;
}

const REGISTRY_PATH = "apps/api/src/lib/promptRegistry.ts";

function baseRegistry(): string | null {
    try {
        return execFileSync("git", ["show", `origin/main:${REGISTRY_PATH}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
        return null;
    }
}

describe("versionProblems", () => {
    const base = { "a.x": { version: 1, fingerprint: "aaaaaaaaaaaa" }, "a.y": { version: 2, fingerprint: "bbbbbbbbbbbb" } };

    it("accepts an unchanged registry, a new prompt, and a changed prompt with a bumped version", () => {
        expect(versionProblems(base, base)).toEqual([]);
        expect(versionProblems(base, { ...base, "a.z": { version: 1, fingerprint: "cccccccccccc" } })).toEqual([]);
        expect(versionProblems(base, { ...base, "a.x": { version: 2, fingerprint: "dddddddddddd" } })).toEqual([]);
    });

    it("rejects a changed fingerprint on the same version, a lower version, and a removed prompt", () => {
        expect(versionProblems(base, { ...base, "a.x": { version: 1, fingerprint: "dddddddddddd" } })).toHaveLength(1);
        expect(versionProblems(base, { ...base, "a.y": { version: 1, fingerprint: "bbbbbbbbbbbb" } })).toHaveLength(1);
        expect(versionProblems(base, { "a.x": base["a.x"] })).toHaveLength(1);
    });
});

describe("parseRegistry", () => {
    it("reads the real registry file, so a format change cannot silently empty the guard", () => {
        const source = readFileSync(join(__dirname, "promptRegistry.ts"), "utf8");
        const parsed = parseRegistry(source);
        expect(Object.keys(parsed).length).toBeGreaterThanOrEqual(6);
        expect(parsed["email.nodeA"]?.version).toBeGreaterThanOrEqual(1);
    });
});

describe("prompt versions against origin/main", () => {
    const base = baseRegistry();

    it.skipIf(base === null)("bumps the version of every prompt whose text changed", () => {
        const head = parseRegistry(readFileSync(join(__dirname, "promptRegistry.ts"), "utf8"));
        expect(versionProblems(parseRegistry(base as string), head)).toEqual([]);
    });
});
