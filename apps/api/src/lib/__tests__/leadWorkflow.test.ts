import { describe, expect, it } from "vitest";
import { deriveLeadWorkflow, type WorkflowInput } from "../leadWorkflow";

const base = (over: Partial<WorkflowInput> = {}, lead: Partial<WorkflowInput["lead"]> = {}): WorkflowInput => ({
    lead: {
        isEnriched: false, lastScoredAt: null, dwellTimeMinutes: 0, emailClicks: 0, socialMentions: 0, icpFitScore: null,
        replyOutcome: null, pipelineState: "COLD", status: "NEW", wonAt: null, ...lead,
    },
    emailCount: 0, repliedEmailCount: 0, generationCount: 0, channelStatuses: [], approval: null, ...over,
});
const states = (i: WorkflowInput) => deriveLeadWorkflow(i).steps.map((s) => s.state);

describe("deriveLeadWorkflow", () => {
    it("a brand-new lead starts at Signal Review", () => {
        expect(states(base())).toEqual(["active", "todo", "todo", "todo", "todo", "todo"]);
    });

    it("moves on as records appear", () => {
        expect(states(base({}, { isEnriched: true }))).toEqual(["done", "active", "todo", "todo", "todo", "todo"]);
        expect(states(base({ emailCount: 2 }, { isEnriched: true }))).toEqual(["done", "done", "done", "active", "todo", "todo"]);
    });

    it("a reply completes Reply Track and the gated step becomes the one in progress", () => {
        expect(states(base({ emailCount: 1, repliedEmailCount: 1 }, { isEnriched: true }))).toEqual(["done", "done", "done", "done", "active", "todo"]);
    });

    it("a pending approval waits for a manager and reports the request", () => {
        const out = deriveLeadWorkflow(base(
            { emailCount: 1, repliedEmailCount: 1, approval: { id: "r1", status: "PENDING", actionType: "NETJANA_FOLLOWUP_REVIEW", reason: "Follow-up", autoDenyAt: new Date("2026-11-14T00:00:00Z") } },
            { isEnriched: true },
        ));
        expect(out.steps[4]?.state).toBe("waiting");
        expect(out.approval).toEqual({ requestId: "r1", status: "PENDING", actionType: "NETJANA_FOLLOWUP_REVIEW", reason: "Follow-up", expiresAt: "2026-11-14T00:00:00.000Z" });
    });

    it("a rejected approval blocks the gate and an approved one clears it", () => {
        const decided = (status: string) => base({ emailCount: 1, repliedEmailCount: 1, approval: { id: "r", status, actionType: "X", reason: null, autoDenyAt: null } }, { isEnriched: true });
        expect(states(decided("REJECTED"))[4]).toBe("blocked");
        expect(states(decided("APPROVED"))).toEqual(["done", "done", "done", "done", "done", "active"]);
    });

    it("a lead already past coordinating shows Advance Lead as done", () => {
        expect(states(base({}, { pipelineState: "MEETING_CONFIRMED" }))[5]).toBe("done");
    });
});
