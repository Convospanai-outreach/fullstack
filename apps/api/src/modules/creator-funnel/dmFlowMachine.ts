// Instagram DM flows (creator funnel): the pure state machine. No I/O here. The service loads a
// run, calls stepRun with the event, then performs the returned actions and saves the new state.
//
// Platform rules this encodes (Meta, checked 2026-11-01):
// - After a person messages the account, the business can send within 24 hours of that message
//   ("For most user actions, it lasts 24 hours"). Sends inside the window use no allowance.
// - A private reply to a comment is one message, sent within 7 days of the comment. Nothing else
//   can be sent to that person until they write back; the allowance models that one message.
// - Text messages are at most 1000 bytes. Quick replies are plain text, max 13, titles of 20
//   characters; the service only uses them inside an open window (private replies are not documented).

export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;
export const WAIT_EXPIRY_MS = 24 * 60 * 60 * 1000; // a run waiting for the person ends after this
export const DAILY_MESSAGE_CAP = 6; // flow messages per person per day (config default)
export const MAX_FLOW_STEPS = 12;
export const MESSAGE_MAX_BYTES = 1000;
export const LINK_TEXT_MAX_BYTES = 700; // leaves room for the landing link inside 1000 bytes
export const ANSWER_MAX_CHARS = 1000;

const PROPERTY_KEY = /^[a-z][a-z0-9_]{0,31}$/;
const STOP_WORDS = new Set(["stop", "unsubscribe"]);

export type FlowStep =
    | { type: "message"; text: string }
    | { type: "question"; text: string; property: string }
    | { type: "link"; text: string } // the service appends the signed landing link
    | { type: "end" };

export type SendStep = Exclude<FlowStep, { type: "end" }>;

export type RunStatus = "ACTIVE" | "WAITING" | "COMPLETED" | "EXPIRED" | "STOPPED" | "FAILED";

export type RunState = {
    status: RunStatus;
    stepIndex: number;
    awaitingAnswer: boolean; // the question at stepIndex has been sent and is waiting for a reply
    waitingSince: Date | null;
    lastInboundAt: Date | null; // the person's latest message; drives the 24-hour window
};

export type FlowEvent = { kind: "start"; origin: "COMMENT" | "DM"; at: Date } | { kind: "inbound"; at: Date; text: string };

export type StepContext = {
    allowance: number; // messages allowed outside the window (1 for a comment start within 7 days, else 0)
    dailySent: number; // flow messages already sent to this person in the last 24 hours
};

export type Action =
    | { type: "send"; stepIndex: number; step: SendStep; inWindow: boolean }
    | { type: "save_answer"; stepIndex: number; property: string; value: string }
    | { type: "stop"; reason: "STOP_WORD" };

export type StepValidation = { ok: true; steps: FlowStep[] } | { ok: false; message: string };

const invalid = (message: string): StepValidation => ({ ok: false, message });

/** Checks a flow's steps as saved: count, types, text size, property keys, and end only as the last step. */
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
        if (Buffer.byteLength(text, "utf8") > limit) return invalid(`Step ${position} is over ${limit} bytes.`);
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

/** True when the text has a whole word "stop" or "unsubscribe" (case and punctuation ignored). */
export function isStopWord(text: string): boolean {
    return text
        .toLowerCase()
        .split(/[^a-z]+/)
        .some((word) => STOP_WORDS.has(word));
}

/** The 24-hour window: open for less than 24 hours after the person's last message. */
export function windowOpen(lastInboundAt: Date | null, now: Date): boolean {
    return lastInboundAt !== null && now.getTime() - lastInboundAt.getTime() < MESSAGING_WINDOW_MS;
}

/** A run waiting for the person past WAIT_EXPIRY_MS becomes EXPIRED; anything else is unchanged. */
export function expireIfStale(state: RunState, now: Date): RunState {
    if (state.status === "WAITING" && state.waitingSince && now.getTime() - state.waitingSince.getTime() >= WAIT_EXPIRY_MS) {
        return { ...state, status: "EXPIRED", waitingSince: null };
    }
    return state;
}

const TERMINAL: RunStatus[] = ["COMPLETED", "EXPIRED", "FAILED"];

/**
 * Applies one event to a run and returns the new state plus the actions to perform, in order.
 * A STOP word from the person always ends the run and marks them for do-not-contact, even after
 * the run finished. A message is sent only inside the window or with the allowance, and never past
 * the daily cap; otherwise the run waits (and expires after WAIT_EXPIRY_MS).
 */
export function stepRun(steps: FlowStep[], state: RunState, event: FlowEvent, ctx: StepContext): { state: RunState; actions: Action[] } {
    if (state.status === "STOPPED") return { state, actions: [] };
    if (event.kind === "inbound" && isStopWord(event.text)) {
        return {
            state: { ...state, status: "STOPPED", awaitingAnswer: false, waitingSince: null, lastInboundAt: event.at },
            actions: [{ type: "stop", reason: "STOP_WORD" }],
        };
    }
    if (TERMINAL.includes(state.status)) return { state, actions: [] };
    const expired = expireIfStale(state, event.at);
    if (expired.status === "EXPIRED") return { state: expired, actions: [] };

    const actions: Action[] = [];
    let s: RunState;
    if (event.kind === "start") {
        s = {
            status: "ACTIVE",
            stepIndex: 0,
            awaitingAnswer: false,
            waitingSince: null,
            lastInboundAt: event.origin === "DM" ? event.at : null,
        };
    } else {
        s = { ...state, lastInboundAt: event.at, status: "ACTIVE" };
        const question = steps[s.stepIndex];
        if (s.awaitingAnswer && event.text.trim() && question?.type === "question") {
            actions.push({ type: "save_answer", stepIndex: s.stepIndex, property: question.property, value: event.text.trim().slice(0, ANSWER_MAX_CHARS) });
            s = { ...s, awaitingAnswer: false, stepIndex: s.stepIndex + 1 };
        }
    }

    const inWindow = windowOpen(s.lastInboundAt, event.at);
    let allowance = ctx.allowance;
    let dailySent = ctx.dailySent;
    for (;;) {
        const step = steps[s.stepIndex];
        if (!step || step.type === "end") {
            return { state: { ...s, status: "COMPLETED", awaitingAnswer: false, waitingSince: null }, actions };
        }
        const wait = { ...s, status: "WAITING" as const, waitingSince: s.waitingSince ?? event.at };
        if (s.awaitingAnswer) return { state: wait, actions };
        if (dailySent >= DAILY_MESSAGE_CAP) return { state: wait, actions };
        if (!inWindow && allowance <= 0) return { state: wait, actions };

        actions.push({ type: "send", stepIndex: s.stepIndex, step, inWindow });
        dailySent += 1;
        if (!inWindow) allowance -= 1;
        if (step.type === "question") {
            return { state: { ...s, status: "WAITING", awaitingAnswer: true, waitingSince: event.at }, actions };
        }
        s = { ...s, stepIndex: s.stepIndex + 1 };
    }
}
