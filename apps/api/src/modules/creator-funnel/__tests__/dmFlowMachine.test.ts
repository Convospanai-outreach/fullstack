import { describe, expect, it } from "vitest";
import {
    DAILY_MESSAGE_CAP,
    LINK_TEXT_MAX_BYTES,
    MAX_FLOW_STEPS,
    MESSAGE_MAX_BYTES,
    MESSAGING_WINDOW_MS,
    WAIT_EXPIRY_MS,
    expireIfStale,
    isStopWord,
    stepRun,
    validateFlowSteps,
    windowOpen,
    type FlowStep,
    type RunState,
} from "../dmFlowMachine";

const NOW = new Date("2030-01-07T10:00:00Z");
const HOUR = 60 * 60 * 1000;
const fresh = (over: Partial<RunState> = {}): RunState => ({
    status: "ACTIVE",
    stepIndex: 0,
    awaitingAnswer: false,
    waitingSince: null,
    lastInboundAt: null,
    ...over,
});
const ctx = (over: Partial<{ allowance: number; dailySent: number }> = {}) => ({ allowance: 0, dailySent: 0, ...over });
const inbound = (text: string, at: Date = NOW) => ({ kind: "inbound" as const, at, text });
const start = (origin: "COMMENT" | "DM" = "DM", at: Date = NOW) => ({ kind: "start" as const, origin, at });

const msg = (text = "Hi"): FlowStep => ({ type: "message", text });
const question = (property = "budget"): FlowStep => ({ type: "question", text: "Budget?", property });
const link = (text = "Here is the guide"): FlowStep => ({ type: "link", text });
const END: FlowStep = { type: "end" };

describe("constants", () => {
    it("follow the platform and spec limits", () => {
        expect(MESSAGING_WINDOW_MS).toBe(24 * HOUR);
        expect(WAIT_EXPIRY_MS).toBe(24 * HOUR);
        expect(DAILY_MESSAGE_CAP).toBe(6);
        expect(MAX_FLOW_STEPS).toBe(12);
        expect(MESSAGE_MAX_BYTES).toBe(1000);
        expect(LINK_TEXT_MAX_BYTES).toBe(700);
    });
});

describe("validateFlowSteps", () => {
    it("accepts an ordered list of message, question, link and end steps", () => {
        const result = validateFlowSteps([msg(), question(), link(), END]);
        expect(result).toEqual({ ok: true, steps: [msg(), question(), link(), END] });
    });

    it("accepts a list without an end step", () => {
        expect(validateFlowSteps([msg(), link()]).ok).toBe(true);
    });

    it("rejects an empty list and a list with only end", () => {
        expect(validateFlowSteps([]).ok).toBe(false);
        expect(validateFlowSteps([END]).ok).toBe(false);
    });

    it("rejects more than the maximum number of steps", () => {
        const steps = Array.from({ length: MAX_FLOW_STEPS + 1 }, () => msg());
        expect(validateFlowSteps(steps).ok).toBe(false);
    });

    it("rejects an unknown step type (no condition or tag steps in v1)", () => {
        expect(validateFlowSteps([msg(), { type: "condition", text: "x" }]).ok).toBe(false);
        expect(validateFlowSteps([msg(), { type: "tag", text: "x" }]).ok).toBe(false);
    });

    it("rejects empty text and text over the byte limit (counted in UTF-8 bytes)", () => {
        expect(validateFlowSteps([msg("   ")]).ok).toBe(false);
        expect(validateFlowSteps([msg("a".repeat(MESSAGE_MAX_BYTES + 1))]).ok).toBe(false);
        expect(validateFlowSteps([msg("a".repeat(MESSAGE_MAX_BYTES))]).ok).toBe(true);
        // e-acute is two bytes, so 501 of them is over 1000 bytes.
        expect(validateFlowSteps([msg("é".repeat(501))]).ok).toBe(false);
        expect(validateFlowSteps([link("a".repeat(LINK_TEXT_MAX_BYTES + 1))]).ok).toBe(false);
    });

    it("rejects a question without a property key in the property key format", () => {
        expect(validateFlowSteps([{ type: "question", text: "Budget?", property: null }]).ok).toBe(false);
        expect(validateFlowSteps([{ type: "question", text: "Budget?", property: "Budget" }]).ok).toBe(false);
        expect(validateFlowSteps([{ type: "question", text: "Budget?", property: "1budget" }]).ok).toBe(false);
    });

    it("rejects end anywhere but last", () => {
        expect(validateFlowSteps([END, msg()]).ok).toBe(false);
    });
});

describe("isStopWord", () => {
    it("matches stop and unsubscribe as whole words, ignoring case and punctuation", () => {
        expect(isStopWord("STOP")).toBe(true);
        expect(isStopWord("please unsubscribe me.")).toBe(true);
        expect(isStopWord("Do not stop messaging")).toBe(true);
    });

    it("does not match other words that contain the letters", () => {
        expect(isStopWord("stopped by the shop")).toBe(false);
        expect(isStopWord("hello there")).toBe(false);
        expect(isStopWord("")).toBe(false);
    });
});

describe("windowOpen", () => {
    it("is open for less than 24 hours after the person's last message", () => {
        expect(windowOpen(new Date(NOW.getTime() - 23 * HOUR), NOW)).toBe(true);
    });

    it("is closed at exactly 24 hours and when the person never messaged", () => {
        expect(windowOpen(new Date(NOW.getTime() - 24 * HOUR), NOW)).toBe(false);
        expect(windowOpen(null, NOW)).toBe(false);
    });
});

describe("stepRun: starts", () => {
    it("a DM start sends every message in the open window and waits at the question", () => {
        const steps = [msg("one"), msg("two"), question(), msg("three"), END];
        const { state, actions } = stepRun(steps, fresh(), start("DM"), ctx());
        expect(actions.map((a) => a.type)).toEqual(["send", "send", "send"]);
        expect(actions.every((a) => a.type === "send" && a.inWindow)).toBe(true);
        expect(state).toMatchObject({ status: "WAITING", stepIndex: 2, awaitingAnswer: true });
        expect(state.waitingSince).toEqual(NOW);
    });

    it("a comment start may send only one message before the person replies, and records why the next one waits", () => {
        const steps = [msg("first"), msg("second"), END];
        const { state, actions } = stepRun(steps, fresh(), start("COMMENT"), ctx({ allowance: 1 }));
        expect(actions).toEqual([
            { type: "send", stepIndex: 0, step: msg("first"), inWindow: false },
            { type: "hold", stepIndex: 1, reason: "WINDOW_CLOSED" },
        ]);
        expect(state).toMatchObject({ status: "WAITING", stepIndex: 1, awaitingAnswer: false });
    });

    it("a comment start with no allowance sends nothing and waits", () => {
        const { state, actions } = stepRun([msg(), END], fresh(), start("COMMENT"), ctx({ allowance: 0 }));
        expect(actions).toEqual([{ type: "hold", stepIndex: 0, reason: "WINDOW_CLOSED" }]);
        expect(state.status).toBe("WAITING");
    });

    it("a comment start whose first step is a question sends the question with the one allowed message", () => {
        const { state, actions } = stepRun([question(), END], fresh(), start("COMMENT"), ctx({ allowance: 1 }));
        expect(actions).toEqual([{ type: "send", stepIndex: 0, step: question(), inWindow: false }]);
        expect(state).toMatchObject({ status: "WAITING", awaitingAnswer: true, stepIndex: 0 });
    });
});

describe("stepRun: replies from the person", () => {
    const waitingAtQuestion = fresh({ status: "WAITING", stepIndex: 1, awaitingAnswer: true, waitingSince: new Date(NOW.getTime() - HOUR) });
    const steps = [msg("hi"), question("budget"), msg("thanks"), link("guide"), END];

    it("an answer is saved to the question's property, then the flow continues to the end", () => {
        const { state, actions } = stepRun(steps, waitingAtQuestion, inbound("  5000  "), ctx());
        expect(actions[0]).toEqual({ type: "save_answer", stepIndex: 1, property: "budget", value: "5000" });
        expect(actions.slice(1).map((a) => a.type)).toEqual(["send", "send"]);
        expect(state).toMatchObject({ status: "COMPLETED", stepIndex: 4, awaitingAnswer: false, waitingSince: null });
    });

    it("an attachment-only reply (no text) does not answer the question but opens the window", () => {
        const { state, actions } = stepRun(steps, waitingAtQuestion, inbound(""), ctx());
        expect(actions).toEqual([]);
        expect(state).toMatchObject({ status: "WAITING", awaitingAnswer: true, stepIndex: 1, lastInboundAt: NOW });
    });

    it("a STOP word ends the run, marks the person for do-not-contact, and saves and sends nothing", () => {
        const { state, actions } = stepRun(steps, waitingAtQuestion, inbound("stop"), ctx());
        expect(actions).toEqual([{ type: "stop", reason: "STOP_WORD" }]);
        expect(state.status).toBe("STOPPED");
    });

    it("a STOP word after the run already finished still marks the person for do-not-contact", () => {
        const done = fresh({ status: "COMPLETED", stepIndex: 2, lastInboundAt: NOW });
        const { state, actions } = stepRun(steps, done, inbound("unsubscribe please"), ctx());
        expect(actions).toEqual([{ type: "stop", reason: "STOP_WORD" }]);
        expect(state.status).toBe("STOPPED");
    });

    it("a finished or stopped run ignores further messages", () => {
        const done = fresh({ status: "COMPLETED", stepIndex: 5 });
        expect(stepRun(steps, done, inbound("hello"), ctx())).toEqual({ state: done, actions: [] });
        const stopped = fresh({ status: "STOPPED" });
        expect(stepRun(steps, stopped, inbound("hello"), ctx()).actions).toEqual([]);
    });

    it("a waiting run resumes when the person writes again inside 24 hours", () => {
        const waitingAtMessage = fresh({ status: "WAITING", stepIndex: 0, waitingSince: new Date(NOW.getTime() - 2 * HOUR) });
        const { state, actions } = stepRun([msg("later"), END], waitingAtMessage, inbound("hi"), ctx());
        expect(actions).toEqual([{ type: "send", stepIndex: 0, step: msg("later"), inWindow: true }]);
        expect(state).toMatchObject({ status: "COMPLETED", waitingSince: null });
    });
});

describe("stepRun: limits", () => {
    it("does not send past the daily cap and waits instead", () => {
        const { state, actions } = stepRun([msg(), END], fresh(), start("DM"), ctx({ dailySent: DAILY_MESSAGE_CAP }));
        expect(actions).toEqual([{ type: "hold", stepIndex: 0, reason: "DAILY_CAP" }]);
        expect(state.status).toBe("WAITING");
    });

    it("counts sends inside one step run toward the cap", () => {
        const steps = [msg("a"), msg("b"), msg("c"), END];
        const { actions } = stepRun(steps, fresh(), start("DM"), ctx({ dailySent: DAILY_MESSAGE_CAP - 2 }));
        expect(actions.filter((a) => a.type === "send")).toHaveLength(2);
    });

    it("a waiting run whose 24 hours ran out expires and sends nothing", () => {
        const stale = fresh({ status: "WAITING", stepIndex: 1, awaitingAnswer: true, waitingSince: new Date(NOW.getTime() - 25 * HOUR) });
        const { state, actions } = stepRun([msg(), question(), END], stale, inbound("5000"), ctx());
        expect(state.status).toBe("EXPIRED");
        expect(actions).toEqual([]);
    });

    it("a reply at 23 hours after the wait started is still in time", () => {
        const almost = fresh({ status: "WAITING", stepIndex: 1, awaitingAnswer: true, waitingSince: new Date(NOW.getTime() - 23 * HOUR) });
        const { state } = stepRun([msg(), question("budget"), END], almost, inbound("5000"), ctx());
        expect(state.status).toBe("COMPLETED");
    });

    it("expireIfStale moves only long waits to EXPIRED", () => {
        const waited = (h: number) => fresh({ status: "WAITING", waitingSince: new Date(NOW.getTime() - h * HOUR) });
        expect(expireIfStale(waited(25), NOW).status).toBe("EXPIRED");
        expect(expireIfStale(waited(1), NOW).status).toBe("WAITING");
        expect(expireIfStale(fresh({ status: "ACTIVE" }), NOW).status).toBe("ACTIVE");
    });
});

describe("stepRun: a question with no open window", () => {
    it("is sent only with the allowance; a DM start opens the window so it is sent in window", () => {
        const { actions } = stepRun([question("budget"), END], fresh(), start("DM"), ctx());
        expect(actions).toEqual([{ type: "send", stepIndex: 0, step: question("budget"), inWindow: true }]);
    });
});
