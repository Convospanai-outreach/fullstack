import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    leads: vi.fn(),
    emailGroup: vi.fn(),
    genGroup: vi.fn(),
    channels: vi.fn(),
    approvals: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
    prisma: {
        lead: { findMany: m.leads },
        email: { groupBy: m.emailGroup },
        generation: { groupBy: m.genGroup },
        leadChannelStatus: { findMany: m.channels },
        approvalRequest: { findMany: m.approvals },
    },
}));

import { loadLeadWorkflows, summariseWorkflows } from "./leadWorkflowBatch";

const lead = (id: string, over: Record<string, unknown> = {}) => ({
    id, isEnriched: false, lastScoredAt: null, dwellTimeMinutes: 0, emailClicks: 0, socialMentions: 0, icpFitScore: null,
    replyOutcome: null, pipelineState: "COLD", status: "NEW", wonAt: null, ...over,
});
const states = (wf: { steps: { state: string }[] } | undefined) => wf?.steps.map((s) => s.state);

beforeEach(() => {
    vi.resetAllMocks();
    m.leads.mockResolvedValue([]);
    m.emailGroup.mockResolvedValue([]);
    m.genGroup.mockResolvedValue([]);
    m.channels.mockResolvedValue([]);
    m.approvals.mockResolvedValue([]);
});

describe("loadLeadWorkflows", () => {
    it("only loads leads inside the team and runs no further queries when none match", async () => {
        const result = await loadLeadWorkflows("t1", ["other-team-lead"]);
        expect(m.leads).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["other-team-lead"] }, teamId: "t1" } }));
        expect(result.size).toBe(0);
        expect(m.emailGroup).not.toHaveBeenCalled();
    });

    it("counts related records only for the team's own leads", async () => {
        m.leads.mockResolvedValue([lead("a")]);
        await loadLeadWorkflows("t1", ["a", "other-team-lead"]);
        expect(m.emailGroup).toHaveBeenCalledWith(expect.objectContaining({ where: { leadId: { in: ["a"] } } }));
        expect(m.approvals).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "t1", entityType: "Lead", entityId: { in: ["a"] } } }));
    });

    it("derives each lead's steps from its own records", async () => {
        m.leads.mockResolvedValue([lead("a", { isEnriched: true }), lead("b")]);
        // First groupBy call is all emails, second is replied emails.
        m.emailGroup.mockResolvedValueOnce([{ leadId: "a", _count: { _all: 2 } }]).mockResolvedValueOnce([]);
        const result = await loadLeadWorkflows("t1", ["a", "b"]);
        expect(states(result.get("a"))).toEqual(["done", "done", "done", "active", "todo", "todo"]);
        expect(states(result.get("b"))).toEqual(["active", "todo", "todo", "todo", "todo", "todo"]);
    });

    it("uses the newest approval for a lead", async () => {
        m.leads.mockResolvedValue([lead("a")]);
        m.approvals.mockResolvedValue([
            { id: "new", entityId: "a", status: "REJECTED", actionType: "SEND", reason: null, autoDenyAt: null },
            { id: "old", entityId: "a", status: "APPROVED", actionType: "SEND", reason: null, autoDenyAt: null },
        ]);
        const result = await loadLeadWorkflows("t1", ["a"]);
        expect(result.get("a")?.approval?.requestId).toBe("new");
        expect(states(result.get("a"))?.[4]).toBe("blocked");
    });
});

describe("summariseWorkflows", () => {
    it("counts leads done, current and blocked at each step", async () => {
        m.leads.mockResolvedValue([lead("a", { isEnriched: true }), lead("b"), lead("c")]);
        m.approvals.mockResolvedValue([{ id: "r", entityId: "c", status: "REJECTED", actionType: "SEND", reason: null, autoDenyAt: null }]);
        const summary = summariseWorkflows((await loadLeadWorkflows("t1", ["a", "b", "c"])).values());
        expect(summary.map((s) => s.key)).toEqual(["signal", "draft", "channel", "reply", "approve", "advance"]);
        expect(summary[0]).toMatchObject({ done: 1, current: 2, blocked: 0 });
        expect(summary[1]).toMatchObject({ done: 0, current: 1 });
        expect(summary[4]).toMatchObject({ blocked: 1, gated: true });
    });
});
