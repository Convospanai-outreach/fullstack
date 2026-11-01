// Web copy of apps/api validateFlowSteps (dmFlowMachine.ts). Both read tests/fixtures/dm-flow-steps.json.
// Stub for the RED run; the real checks follow.
export const MAX_FLOW_STEPS = 12;
export const MESSAGE_MAX_BYTES = 1000;
export const LINK_TEXT_MAX_BYTES = 700;

export function validateFlowSteps(input: unknown) {
    return { ok: true as const, steps: input as unknown[] };
}
