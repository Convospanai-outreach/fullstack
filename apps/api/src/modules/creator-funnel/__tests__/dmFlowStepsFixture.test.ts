import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LINK_TEXT_MAX_BYTES, MAX_FLOW_STEPS, MESSAGE_MAX_BYTES, validateFlowSteps } from "../dmFlowMachine";

// The web copy of validateFlowSteps (apps/web/src/lib/dmFlowSteps.ts) reads the same fixture. This
// side must give the same answer for every case, so the two copies cannot drift apart.
const FIXTURE = resolve(__dirname, "../../../../../web/tests/fixtures/dm-flow-steps.json");
const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as {
    constants: { maxSteps: number; messageMaxBytes: number; linkMaxBytes: number };
    cases: ({ name: string; input: unknown; ok: true; steps: unknown[] } | { name: string; input: unknown; ok: false; message: string })[];
};

describe("flow step rules match the web copy (shared fixture)", () => {
    it("has the same limits as the web copy", () => {
        expect({ maxSteps: MAX_FLOW_STEPS, messageMaxBytes: MESSAGE_MAX_BYTES, linkMaxBytes: LINK_TEXT_MAX_BYTES }).toEqual(fixture.constants);
    });

    it.each(fixture.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
        const result = validateFlowSteps(c.input);
        if (c.ok) expect(result).toEqual({ ok: true, steps: c.steps });
        else expect(result).toEqual({ ok: false, message: c.message });
    });
});
