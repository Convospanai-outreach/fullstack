// Web copy of apps/api validateFlowSteps (creator-funnel/dmFlowMachine.ts). The editor uses it for
// inline errors; the API checks again on save. tests/fixtures/dm-flow-steps.json is the shared
// truth: tests/unit/dm-flow-steps.test.ts and the API drift test both run it, so the two must agree.
// Keep the messages and limits identical to the API's.

export const MAX_FLOW_STEPS = 12;
export const MESSAGE_MAX_BYTES = 1000;
export const LINK_TEXT_MAX_BYTES = 700;

const PROPERTY_KEY = /^[a-z][a-z0-9_]{0,31}$/;
const encoder = new TextEncoder();

export type FlowStep =
    | { type: "message"; text: string }
    | { type: "question"; text: string; property: string }
    | { type: "link"; text: string }
    | { type: "end" };

export type StepValidation = { ok: true; steps: FlowStep[] } | { ok: false; message: string };

const invalid = (message: string): StepValidation => ({ ok: false, message });

export function validateFlowSteps(input: unknown): StepValidation {
    if (!Array.isArray(input)) return invalid("A flow needs a list of steps.");
    if (input.length === 0 || input.length > MAX_FLOW_STEPS) return invalid(`A flow has 1 to ${MAX_FLOW_STEPS} steps.`);
    const steps: FlowStep[] = [];
    for (let i = 0; i < input.length; i++) {
        const raw = input[i] as { type?: unknown; text?: unknown; property?: unknown } | null;
        const position = i + 1;
        if (raw?.type === "end") {
            if (i !== input.length - 1) return invalid("The end step must be the last step.");
            steps.push({ type: "end" });
            continue;
        }
        if (raw?.type !== "message" && raw?.type !== "question" && raw?.type !== "link") {
            return invalid(`Step ${position} has an unknown type.`);
        }
        const text = typeof raw.text === "string" ? raw.text.trim() : "";
        if (!text) return invalid(`Step ${position} needs text.`);
        const limit = raw.type === "link" ? LINK_TEXT_MAX_BYTES : MESSAGE_MAX_BYTES;
        if (encoder.encode(text).length > limit) return invalid(`Step ${position} is over ${limit} bytes.`);
        if (raw.type === "question") {
            if (typeof raw.property !== "string" || !PROPERTY_KEY.test(raw.property)) {
                return invalid(`Step ${position} needs a property key (lowercase letters, digits and underscores).`);
            }
            steps.push({ type: "question", text, property: raw.property });
        } else {
            steps.push({ type: raw.type, text });
        }
    }
    if (steps.every((step) => step.type === "end")) return invalid("A flow needs at least one step before end.");
    return { ok: true, steps };
}

/** Bytes a text takes on Instagram (UTF-8). */
export function byteLength(text: string): number {
    return encoder.encode(text).length;
}
