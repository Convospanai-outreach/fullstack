import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_PATHS, RESERVED_PATH_MESSAGE } from "./reservedPaths";
import { createLandingFromTemplateSchema, landingPagePathSchema, setPageSlugSchema } from "./schemas";

// The reserved words are listed once in apps/web (landingPageAddress.ts) and once here. Both copies must match
// the shared fixture the web tests read.
const WEB = resolve(__dirname, "../../../../web");
const fixture = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/landing-reserved-paths.json"), "utf8")) as {
    reservedPaths: string[];
};

describe("reserved page addresses", () => {
    it("match the shared fixture the web copy is also tested against", () => {
        expect([...RESERVED_PATHS].sort()).toEqual([...fixture.reservedPaths].sort());
    });

    it.each(fixture.reservedPaths)("refuses %s as a page address", (word) => {
        expect(landingPagePathSchema.safeParse(word).success).toBe(false);
    });

    it("says the address is reserved, not just malformed", () => {
        const parsed = landingPagePathSchema.safeParse("thank-you");
        expect(parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)).toContain(RESERVED_PATH_MESSAGE);
    });

    it("refuses a reserved word when a template page is created", () => {
        expect(createLandingFromTemplateSchema.safeParse({ templateId: "free-guide", name: "Guide", path: "thank-you" }).success).toBe(false);
    });

    it("refuses a reserved word when a page is renamed, because the service checks the same rule", () => {
        expect(setPageSlugSchema.safeParse({ path: "thank-you" }).success).toBe(true);
        expect(landingPagePathSchema.safeParse("thank-you").success).toBe(false);
    });

    it("still accepts an ordinary address", () => {
        expect(landingPagePathSchema.safeParse("spring-guide").success).toBe(true);
    });
});
