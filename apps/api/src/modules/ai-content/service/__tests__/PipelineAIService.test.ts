import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findFirst: vi.fn(),
        },
    },
}));

vi.mock("@/lib/aiService", () => ({
    aiService: {
        suggestPipelineTasks: vi.fn(),
        recommendPipelineStage: vi.fn(),
        summarizePipelineLead: vi.fn(),
    },
}));

import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";
import { PipelineAIService } from "../PipelineAIService";

describe("PipelineAIService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // OPEN-78 regression: this class used to self-fetch a route
    // (/ai/pipeline/suggest-tasks etc.) that was never registered anywhere,
    // so every call silently failed and returned an empty/placeholder result.
    describe("suggestTasks", () => {
        it("loads the real lead and delegates to aiService.suggestPipelineTasks", async () => {
            const lead = { id: "lead_1", teamId: "t1", fullName: "Alice", pipelineState: "WARM" };
            (prisma.lead.findFirst as any).mockResolvedValueOnce(lead);
            (aiService.suggestPipelineTasks as any).mockResolvedValueOnce([
                { title: "Send follow-up", description: "It's been 5 days", priority: "high" },
            ]);

            const result = await PipelineAIService.suggestTasks("t1", "lead_1");

            expect(prisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead_1", teamId: "t1" } });
            expect(aiService.suggestPipelineTasks).toHaveBeenCalledWith(lead, "t1");
            expect(result).toEqual([{ title: "Send follow-up", description: "It's been 5 days", priority: "high" }]);
        });

        it("returns an empty array when the lead isn't found in this team", async () => {
            (prisma.lead.findFirst as any).mockResolvedValueOnce(null);

            const result = await PipelineAIService.suggestTasks("t1", "missing");

            expect(aiService.suggestPipelineTasks).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });

        it("returns an empty array instead of throwing when the AI call fails", async () => {
            (prisma.lead.findFirst as any).mockResolvedValueOnce({ id: "lead_1", teamId: "t1" });
            (aiService.suggestPipelineTasks as any).mockRejectedValueOnce(new Error("AI provider error"));

            const result = await PipelineAIService.suggestTasks("t1", "lead_1");

            expect(result).toEqual([]);
        });
    });

    describe("recommendStage", () => {
        it("delegates to aiService.recommendPipelineStage with the lead's own teamId", async () => {
            const lead = { id: "lead_1", teamId: "t1", pipelineState: "WARM" };
            (prisma.lead.findFirst as any).mockResolvedValueOnce(lead);
            (aiService.recommendPipelineStage as any).mockResolvedValueOnce("HOT");

            const result = await PipelineAIService.recommendStage("lead_1", "t1");

            expect(prisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead_1", teamId: "t1" } });
            expect(aiService.recommendPipelineStage).toHaveBeenCalledWith(lead, "t1");
            expect(result).toBe("HOT");
        });

        it("returns null when the lead doesn't exist", async () => {
            (prisma.lead.findFirst as any).mockResolvedValueOnce(null);

            const result = await PipelineAIService.recommendStage("missing", "t1");

            expect(result).toBeNull();
        });

        it("returns null instead of another team's lead (cross-tenant IDOR)", async () => {
            (prisma.lead.findFirst as any).mockResolvedValueOnce(null);

            const result = await PipelineAIService.recommendStage("lead-from-team-b", "team-a");

            expect(prisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead-from-team-b", teamId: "team-a" } });
            expect(result).toBeNull();
        });
    });

    describe("summarizeLead", () => {
        it("delegates to aiService.summarizePipelineLead", async () => {
            const lead = { id: "lead_1", teamId: "t1", fullName: "Alice" };
            (prisma.lead.findFirst as any).mockResolvedValueOnce(lead);
            (aiService.summarizePipelineLead as any).mockResolvedValueOnce("Warm lead, ready for a call.");

            const result = await PipelineAIService.summarizeLead("lead_1", "t1");

            expect(prisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead_1", teamId: "t1" } });
            expect(aiService.summarizePipelineLead).toHaveBeenCalledWith(lead, "t1");
            expect(result).toBe("Warm lead, ready for a call.");
        });

        it("falls back to an honest unavailable message when the AI call fails", async () => {
            (prisma.lead.findFirst as any).mockResolvedValueOnce({ id: "lead_1", teamId: "t1" });
            (aiService.summarizePipelineLead as any).mockRejectedValueOnce(new Error("AI provider error"));

            const result = await PipelineAIService.summarizeLead("lead_1", "t1");

            expect(result).toBe("Status analysis unavailable.");
        });

        it("returns 'Lead not found.' instead of another team's lead (cross-tenant IDOR)", async () => {
            (prisma.lead.findFirst as any).mockResolvedValueOnce(null);

            const result = await PipelineAIService.summarizeLead("lead-from-team-b", "team-a");

            expect(prisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead-from-team-b", teamId: "team-a" } });
            expect(result).toBe("Lead not found.");
        });
    });
});
