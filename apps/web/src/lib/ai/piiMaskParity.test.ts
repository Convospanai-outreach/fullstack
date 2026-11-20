import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The personal-data masker is mirrored in apps/api and apps/web. Two copies that drift would mask different
// things depending on which app made the model call.
describe("piiMask parity", () => {
    it("apps/web and apps/api carry identical copies", () => {
        const web = readFileSync(resolve(__dirname, "piiMask.ts"), "utf8");
        const api = readFileSync(resolve(__dirname, "../../../../api/src/lib/ai/piiMask.ts"), "utf8");
        expect(web).toBe(api);
    });
});
