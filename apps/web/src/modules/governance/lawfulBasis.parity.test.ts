import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The DPDP send gate is mirrored between apps/api (production sends) and apps/web (campaign start, web worker).
// Two copies of a consent rule that drift apart would let one side send what the other blocks.
describe("lawfulBasis parity", () => {
    it("apps/web and apps/api carry identical copies", () => {
        const web = readFileSync(resolve(__dirname, "lawfulBasis.ts"), "utf8");
        const api = readFileSync(resolve(__dirname, "../../../../api/src/modules/governance/lawfulBasis.ts"), "utf8");
        expect(web).toBe(api);
    });
});
