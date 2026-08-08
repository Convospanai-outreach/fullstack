import { describe, expect, it } from "vitest";
import {
    advanceLeadAfterEmailClicked,
    advanceLeadAfterEmailOpened,
    advanceLeadAfterEmailSent,
    advanceLeadAfterMeetingScheduled,
    advanceLeadAfterReply,
    advanceLeadToLost,
    advanceLeadToWon,
    calculateLeadTransition
} from "@/lib/crm/leadStageTransitions";
import { normalizeFunnel } from "@/lib/crm/funnel";

function createPrismaLeadMock(lead: any) {
    const calls: any[] = [];
    return {
        calls,
        prisma: {
            lead: {
                findFirst: async (args: any) => {
                    calls.push({ method: "findFirst", args });
                    return lead;
                },
                update: async (args: any) => {
                    calls.push({ method: "update", args });
                    return { ...lead, ...args.data };
                }
            }
        }
    };
}

describe("lead stage transitions", () => {
    it("moves COLD/NEW to WARM/CONTACTED after email sent", () => {
        const result = calculateLeadTransition({ id: "lead-1", status: "NEW", pipelineState: "COLD" }, "EMAIL_SENT");
        expect(result.status).toBe("CONTACTED");
        expect(result.pipelineState).toBe("WARM");
    });

    it("does not move HOT lead backwards after email sent", () => {
        const result = calculateLeadTransition({ id: "lead-1", status: "ENGAGED", pipelineState: "HOT" }, "EMAIL_SENT");
        expect(result.status).toBe("ENGAGED");
        expect(result.pipelineState).toBe("HOT");
    });

    it("preserves CLOSED_WON/WON after email sent", () => {
        const result = calculateLeadTransition({ id: "lead-1", status: "WON", pipelineState: "CLOSED_WON" }, "EMAIL_SENT");
        expect(result.status).toBe("WON");
        expect(result.pipelineState).toBe("CLOSED_WON");
    });

    it("moves WARM reply to HOT/REPLIED", () => {
        const result = calculateLeadTransition({ id: "lead-1", status: "CONTACTED", pipelineState: "WARM" }, "REPLY_RECEIVED");
        expect(result.status).toBe("REPLIED");
        expect(result.pipelineState).toBe("HOT");
    });

    it("moves meeting scheduled to MEETING_CONFIRMED/MEETING_SCHEDULED", () => {
        const result = calculateLeadTransition({ id: "lead-1", status: "REPLIED", pipelineState: "HOT" }, "MEETING_SCHEDULED");
        expect(result.status).toBe("MEETING_SCHEDULED");
        expect(result.pipelineState).toBe("MEETING_CONFIRMED");
    });

    it("does not reopen a lost lead after email sent", () => {
        const result = calculateLeadTransition({ id: "lead-1", status: "LOST", pipelineState: "CLOSED_LOST" }, "EMAIL_SENT");
        expect(result.status).toBe("LOST");
        expect(result.pipelineState).toBe("CLOSED_LOST");
    });

    it("keeps advanced email statuses while warming cold leads", () => {
        const result = calculateLeadTransition({ id: "lead-1", status: "QUALIFIED", pipelineState: "COLD" }, "EMAIL_SENT");
        expect(result.status).toBe("QUALIFIED");
        expect(result.pipelineState).toBe("WARM");
    });

    it("uses default NEW/COLD values for empty lead state", () => {
        const result = calculateLeadTransition({ id: "lead-1" }, "EMAIL_OPENED");
        expect(result.status).toBe("ENGAGED");
        expect(result.pipelineState).toBe("WARM");
    });

    it("marks first click as hot without downgrading qualified status", () => {
        const now = new Date("2026-06-14T08:00:00.000Z");
        const result = calculateLeadTransition({ id: "lead-1", status: "QUALIFIED", pipelineState: "WARM" }, "EMAIL_CLICKED", now);
        expect(result.status).toBe("QUALIFIED");
        expect(result.pipelineState).toBe("HOT");
        expect(result.hotAt).toBe(now);
    });

    it("does not reset hot timestamp when lead is already hot", () => {
        const result = calculateLeadTransition({ id: "lead-1", status: "ENGAGED", pipelineState: "HOT" }, "EMAIL_CLICKED");
        expect(result.pipelineState).toBe("HOT");
        expect(result.hotAt).toBeUndefined();
    });

    it("does not reopen closed leads after replies", () => {
        const result = calculateLeadTransition({ id: "lead-1", status: "WON", pipelineState: "CLOSED_WON" }, "REPLY_RECEIVED");
        expect(result.status).toBe("WON");
        expect(result.pipelineState).toBe("CLOSED_WON");
    });

    it("does not move closed pipeline states after meeting scheduling", () => {
        const result = calculateLeadTransition({ id: "lead-1", status: "LOST", pipelineState: "CLOSED_LOST" }, "MEETING_SCHEDULED");
        expect(result.status).toBe("LOST");
        expect(result.pipelineState).toBe("CLOSED_LOST");
    });

    it("sets close timestamps for won and lost outcomes", () => {
        const now = new Date("2026-06-14T09:00:00.000Z");
        expect(calculateLeadTransition({ id: "lead-1" }, "WON", now)).toEqual({
            status: "WON",
            pipelineState: "CLOSED_WON",
            wonAt: now
        });
        expect(calculateLeadTransition({ id: "lead-1" }, "LOST", now)).toEqual({
            status: "LOST",
            pipelineState: "CLOSED_LOST",
            lostAt: now
        });
    });

    it("returns unchanged lead result when the lead cannot be found", async () => {
        const { prisma, calls } = createPrismaLeadMock(null);
        const result = await advanceLeadAfterEmailSent(prisma, { leadId: "missing", teamId: "team-1" });

        expect(result).toEqual({ leadStageChanged: false, leadStatus: "", pipelineState: "", lead: null });
        expect(calls).toEqual([
            {
                method: "findFirst",
                args: { where: { id: "missing", teamId: "team-1" } }
            }
        ]);
    });

    it("does not write when an action produces no stage change", async () => {
        const lead = { id: "lead-1", status: "ENGAGED", pipelineState: "HOT" };
        const { prisma, calls } = createPrismaLeadMock(lead);
        const result = await advanceLeadAfterEmailSent(prisma, { leadId: lead.id });

        expect(result).toEqual({
            leadStageChanged: false,
            leadStatus: "ENGAGED",
            pipelineState: "HOT",
            lead
        });
        expect(calls.map((call) => call.method)).toEqual(["findFirst"]);
    });

    it("updates status, pipeline state and changed timestamp when email is opened", async () => {
        const lead = { id: "lead-1", status: "NEW", pipelineState: "COLD" };
        const { prisma, calls } = createPrismaLeadMock(lead);
        const result = await advanceLeadAfterEmailOpened(prisma, { leadId: lead.id, teamId: "team-1" });
        const update = calls.find((call) => call.method === "update");

        expect(update.args.where).toEqual({ id: "lead-1" });
        expect(update.args.data.status).toBe("ENGAGED");
        expect(update.args.data.pipelineState).toBe("WARM");
        expect(update.args.data.pipelineStateChangedAt).toBeInstanceOf(Date);
        expect(result.leadStageChanged).toBe(true);
        expect(result.leadStatus).toBe("ENGAGED");
        expect(result.pipelineState).toBe("WARM");
    });

    it("sets hotAt only when the stored lead does not already have it", async () => {
        const lead = { id: "lead-1", status: "CONTACTED", pipelineState: "WARM", hotAt: null };
        const { prisma, calls } = createPrismaLeadMock(lead);
        await advanceLeadAfterEmailClicked(prisma, { leadId: lead.id });
        const update = calls.find((call) => call.method === "update");

        expect(update.args.data.status).toBe("ENGAGED");
        expect(update.args.data.pipelineState).toBe("HOT");
        expect(update.args.data.hotAt).toBeInstanceOf(Date);
    });

    it("does not overwrite an existing hotAt when reply keeps a lead hot", async () => {
        const existingHotAt = new Date("2026-06-01T00:00:00.000Z");
        const lead = { id: "lead-1", status: "CONTACTED", pipelineState: "WARM", hotAt: existingHotAt };
        const { prisma, calls } = createPrismaLeadMock(lead);
        await advanceLeadAfterReply(prisma, { leadId: lead.id });
        const update = calls.find((call) => call.method === "update");

        expect(update.args.data.status).toBe("REPLIED");
        expect(update.args.data.pipelineState).toBe("HOT");
        expect(update.args.data.hotAt).toBeUndefined();
    });

    it("advances meetings without reopening closed pipeline states", async () => {
        const lead = { id: "lead-1", status: "REPLIED", pipelineState: "HOT" };
        const { prisma, calls } = createPrismaLeadMock(lead);
        await advanceLeadAfterMeetingScheduled(prisma, { leadId: lead.id });
        const update = calls.find((call) => call.method === "update");

        expect(update.args.data.status).toBe("MEETING_SCHEDULED");
        expect(update.args.data.pipelineState).toBe("MEETING_CONFIRMED");
    });

    it("persists won and lost close outcomes", async () => {
        const wonLead = { id: "lead-1", status: "MEETING_SCHEDULED", pipelineState: "MEETING_CONFIRMED" };
        const won = createPrismaLeadMock(wonLead);
        await advanceLeadToWon(won.prisma, { leadId: wonLead.id });
        const wonUpdate = won.calls.find((call) => call.method === "update");

        expect(wonUpdate.args.data.status).toBe("WON");
        expect(wonUpdate.args.data.pipelineState).toBe("CLOSED_WON");
        expect(wonUpdate.args.data.wonAt).toBeInstanceOf(Date);

        const lostLead = { id: "lead-2", status: "MEETING_SCHEDULED", pipelineState: "MEETING_CONFIRMED" };
        const lost = createPrismaLeadMock(lostLead);
        await advanceLeadToLost(lost.prisma, { leadId: lostLead.id });
        const lostUpdate = lost.calls.find((call) => call.method === "update");

        expect(lostUpdate.args.data.status).toBe("LOST");
        expect(lostUpdate.args.data.pipelineState).toBe("CLOSED_LOST");
        expect(lostUpdate.args.data.lostAt).toBeInstanceOf(Date);
    });
});

describe("funnel normalization", () => {
    it("includes zero-count stages in fixed order", () => {
        const result = normalizeFunnel([{ pipelineState: "HOT", _count: { id: 2 } }]);
        expect(result.map((stage) => stage.key)).toEqual([
            "COLD",
            "WARM",
            "HOT",
            "COORDINATING",
            "MEETING_CONFIRMED",
            "COMPLETED",
            "CLOSED_WON",
            "CLOSED_LOST"
        ]);
        expect(result[0].count).toBe(0);
        expect(result[2].count).toBe(2);
    });

    it("calculates percentages from total leads", () => {
        const result = normalizeFunnel([
            { pipelineState: "COLD", _count: { id: 1 } },
            { pipelineState: "WARM", _count: { id: 3 } }
        ]);
        expect(result[0].percentageOfTotal).toBe(25);
        expect(result[1].percentageOfTotal).toBe(75);
    });

    it("returns current stage unchanged for unrecognized transition action", () => {
        const lead = { status: "CONTACTED", pipelineState: "WARM" };
        const result = calculateLeadTransition(lead as any, "UNKNOWN_ACTION" as any);
        expect(result).toEqual({ status: "CONTACTED", pipelineState: "WARM" });
    });
});
