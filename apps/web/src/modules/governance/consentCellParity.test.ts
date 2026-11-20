import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The CSV consent cell rule is mirrored in apps/api and apps/web. Two copies that drift would let one import
// treat "maybe" as consent while the other does not.
describe("consentCell parity", () => {
    it("apps/web and apps/api carry identical copies", () => {
        const web = readFileSync(resolve(__dirname, "consentCell.ts"), "utf8");
        const api = readFileSync(resolve(__dirname, "../../../../api/src/modules/governance/consentCell.ts"), "utf8");
        expect(web).toBe(api);
    });
});
