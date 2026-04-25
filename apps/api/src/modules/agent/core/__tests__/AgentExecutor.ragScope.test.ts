import { describe, expect, it, vi } from "vitest";
import { buildAgenticRagContext, resolveCampaignIdForAgenticSearch } from "../agenticRagScope";

describe("AgentExecutor agentic RAG scoping", () => {
    it("prefers campaignId from task context for campaign-scoped retrieval", async () => {
        const searchKnowledge = vi.fn().mockResolvedValue("campaign knowledge");

        const ragContext = await buildAgenticRagContext(
            {
                goal: "Research Acme buying signals",
                context: { campaignId: "campaign-123" }
            },
            searchKnowledge
        );

        expect(ragContext).toBe("campaign knowledge");
        expect(searchKnowledge).toHaveBeenCalledWith("campaign-123", "Research Acme buying signals");
    });

    it("falls back to a direct campaignId when context does not carry one", async () => {
        const searchKnowledge = vi.fn().mockResolvedValue("fallback campaign knowledge");

        const ragContext = await buildAgenticRagContext(
            {
                goal: "A".repeat(140),
                campaignId: "campaign-direct"
            },
            searchKnowledge
        );

        expect(ragContext).toBe("fallback campaign knowledge");
        expect(searchKnowledge).toHaveBeenCalledWith("campaign-direct", "A".repeat(100));
    });

    it("returns empty context without calling search when campaign scope is unavailable", async () => {
        const searchKnowledge = vi.fn();

        const ragContext = await buildAgenticRagContext(
            {
                goal: "Research Acme buying signals",
                context: { leadId: "lead-1" }
            },
            searchKnowledge
        );

        expect(ragContext).toBe("");
        expect(searchKnowledge).not.toHaveBeenCalled();
    });

    it("normalizes blank campaign ids to null", () => {
        expect(
            resolveCampaignIdForAgenticSearch({
                goal: "Research Acme buying signals",
                context: { campaignId: "   " },
                campaignId: "   "
            })
        ).toBeNull();
    });
});
