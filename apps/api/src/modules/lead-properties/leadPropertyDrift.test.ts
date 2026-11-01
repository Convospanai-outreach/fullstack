import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { coercePropertyValue, type LeadPropertyType } from "./leadProperties";

// apps/web/src/lib/leadProperties/filter.ts repeats these rules for the leads filter. The shared fixture keeps them in step.
const WEB = resolve(__dirname, "../../../../web");
const fixture = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/lead-property-values.json"), "utf8")) as {
    cases: { type: LeadPropertyType; value: string; ok: boolean }[];
};

describe("lead property value rules match the web filter (shared fixture)", () => {
    it.each(fixture.cases.map((c) => [c.type, c.value, c.ok] as const))("%s %j is %s", (type, value, ok) => {
        const result = coercePropertyValue({ key: "probe", type, options: null }, value);
        expect(result.ok).toBe(ok);
    });
});
