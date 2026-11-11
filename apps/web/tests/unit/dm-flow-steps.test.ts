import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LINK_TEXT_MAX_BYTES, MAX_FLOW_STEPS, MESSAGE_MAX_BYTES, validateFlowSteps } from "@/lib/dmFlowSteps";

// The web copy of the flow step rules must answer exactly like the API's validateFlowSteps for
// every case in the shared fixture. apps/api/src/modules/creator-funnel/__tests__ reads the same file.
const fixture = JSON.parse(readFileSync(path.resolve(__dirname, "../fixtures/dm-flow-steps.json"), "utf8")) as {
    constants: { maxSteps: number; messageMaxBytes: number; linkMaxBytes: number };
    cases: ({ name: string; input: unknown; ok: true; steps: unknown[] } | { name: string; input: unknown; ok: false; message: string })[];
};

describe("web flow step rules (drift guard over the shared fixture)", () => {
    it("has the same limits as the API", () => {
        expect({ maxSteps: MAX_FLOW_STEPS, messageMaxBytes: MESSAGE_MAX_BYTES, linkMaxBytes: LINK_TEXT_MAX_BYTES }).toEqual(fixture.constants);
    });

    it.each(fixture.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
        const result = validateFlowSteps(c.input);
        if (c.ok) expect(result).toEqual({ ok: true, steps: c.steps });
        else expect(result).toEqual({ ok: false, message: c.message });
    });
});
