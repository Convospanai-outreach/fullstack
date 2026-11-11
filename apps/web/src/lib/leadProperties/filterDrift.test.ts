import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { leadPropertyFilterWhere } from "./filter";

// Same shared fixture as apps/api/src/modules/lead-properties/leadPropertyDrift.test.ts.
const fixture = JSON.parse(readFileSync(resolve(__dirname, "../../../tests/fixtures/lead-property-values.json"), "utf8")) as {
    cases: { type: string; value: string; ok: boolean }[];
};

describe("leads filter accepts the same values as the API (shared fixture)", () => {
    it.each(fixture.cases.map((c) => [c.type, c.value, c.ok] as const))("%s %j is %s", (type, value, ok) => {
        const result = leadPropertyFilterWhere({ key: "probe", type, options: null }, "equals", value);
        expect(result.ok).toBe(ok);
    });
});
