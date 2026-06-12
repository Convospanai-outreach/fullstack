import { describe, expect, it } from "vitest";
import { calculateLeadTransition } from "@/lib/crm/leadStageTransitions";
import { normalizeFunnel } from "@/lib/crm/funnel";

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
});
