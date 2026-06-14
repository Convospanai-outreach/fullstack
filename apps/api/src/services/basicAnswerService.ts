import { aiService } from "@/lib/aiService";
import { enforceAIPromptPolicy } from "@/lib/aiInputGuardrails";
import { logger } from "@/lib/logger";
import { semanticCache } from "@/modules/optimization/SemanticCache";
import { vectorStore } from "@/modules/rag/service/vectorStore";

export type BasicAnswerSource = "faq" | "knowledge" | "cache" | "llm" | "not_found";
export type BasicAnswerContext = "support" | "dashboard" | "crm" | "campaign" | "general";

export type BasicAnswerCitation = {
    id: string;
    title?: string;
    snippet: string;
};

export type BasicAnswerResult = {
    answer: string;
    source: BasicAnswerSource;
    confidence: number;
    usedLLM: boolean;
    citations?: BasicAnswerCitation[];
};

export type BasicAnswerRequest = {
    question: string;
    teamId?: string;
    context?: BasicAnswerContext;
};

type FaqAnswer = {
    id: string;
    contexts: BasicAnswerContext[];
    keywords: string[];
    answer: string;
};

const LOW_CONFIDENCE_MESSAGE =
    "I could not find a reliable answer from your saved knowledge. Try adding this to your workspace knowledge base or ask an admin to enable AI.";

const FAQ_ANSWERS: FaqAnswer[] = [
    {
        id: "manual-outreach",
        contexts: ["support", "dashboard", "campaign", "general"],
        keywords: ["send", "auto send", "manual", "outreach", "linkedin", "email"],
        answer: "CraftMyFunnel prepares and tracks outreach workflows, but users should review and send messages manually unless a verified sending integration is explicitly configured."
    },
    {
        id: "linkedin-sync",
        contexts: ["support", "crm", "dashboard", "general"],
        keywords: ["linkedin", "capture", "sync", "duplicate", "lead"],
        answer: "LinkedIn captures sync into the lead flow and should merge with existing leads by LinkedIn URL, email, or confident name and company matching."
    },
    {
        id: "credits",
        contexts: ["support", "dashboard", "general"],
        keywords: ["credit", "billing", "usage", "charge", "ai"],
        answer: "AI generation and embeddings can consume credits for chargeable teams. Deterministic help answers, workspace knowledge matches, and exact cache hits do not need an LLM call."
    },
    {
        id: "knowledge",
        contexts: ["support", "dashboard", "campaign", "general"],
        keywords: ["knowledge", "rag", "document", "upload", "workspace"],
        answer: "Workspace knowledge lets teams add source material that can be searched before asking an AI model, helping answer questions from saved business context first."
    },
    {
        id: "pipeline",
        contexts: ["crm", "dashboard", "general"],
        keywords: ["pipeline", "funnel", "status", "stage", "lead journey"],
        answer: "The lead journey tracks pipeline stages and channel activity across email, LinkedIn, WhatsApp, and calls so users can see where a lead is stuck and what action is next."
    }
];

function normalize(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
    return normalize(value).split(" ").filter((token) => token.length >= 3);
}

function snippet(value: string, maxLength = 320) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function scoreFaq(question: string, context: BasicAnswerContext, faq: FaqAnswer) {
    if (!faq.contexts.includes(context) && !faq.contexts.includes("general")) {
        return 0;
    }

    const normalizedQuestion = normalize(question);
    const questionTokens = new Set(tokenize(question));
    let matches = 0;

    for (const keyword of faq.keywords) {
        const normalizedKeyword = normalize(keyword);
        if (normalizedKeyword.includes(" ")) {
            if (normalizedQuestion.includes(normalizedKeyword)) matches += 2;
            continue;
        }
        if (questionTokens.has(normalizedKeyword)) matches += 1;
    }

    return matches / Math.max(3, faq.keywords.length);
}

function findFaqAnswer(question: string, context: BasicAnswerContext): BasicAnswerResult | null {
    const best = FAQ_ANSWERS
        .map((faq) => ({ faq, score: scoreFaq(question, context, faq) }))
        .sort((a, b) => b.score - a.score)[0];

    if (!best || best.score < 0.38) {
        return null;
    }

    return {
        answer: best.faq.answer,
        source: "faq",
        confidence: Math.min(96, Math.round(72 + best.score * 24)),
        usedLLM: false,
        citations: [{ id: best.faq.id, title: "Help answer", snippet: best.faq.answer }]
    };
}

export class BasicAnswerService {
    async answer(input: BasicAnswerRequest): Promise<BasicAnswerResult> {
        const context = input.context || "general";
        const question = enforceAIPromptPolicy(input.question, {
            surface: "HELPER",
            label: "Assistant question",
            maxChars: 2000
        });

        const faq = findFaqAnswer(question, context);
        if (faq) {
            this.logResult(faq, input.teamId, context);
            return faq;
        }

        if (input.teamId) {
            const results = await vectorStore.search(question, input.teamId, 3);
            const best = results[0];
            if (best && best.similarity >= 0.5) {
                const citations = results.map((result) => ({
                    id: result.id,
                    title: typeof result.metadata?.title === "string" ? result.metadata.title : undefined,
                    snippet: snippet(result.content)
                }));
                const answer = `From your workspace knowledge: ${snippet(best.content, 700)}`;
                const result: BasicAnswerResult = {
                    answer,
                    source: "knowledge",
                    confidence: Math.min(94, Math.round(68 + best.similarity * 26)),
                    usedLLM: false,
                    citations
                };
                this.logResult(result, input.teamId, context);
                return result;
            }
        }

        const cached = await semanticCache.getExact(question);
        if (cached) {
            const result: BasicAnswerResult = {
                answer: cached,
                source: "cache",
                confidence: 92,
                usedLLM: false
            };
            this.logResult(result, input.teamId, context);
            return result;
        }

        try {
            const answer = await aiService.askAI(
                `Answer this CraftMyFunnel user question concisely. If the answer depends on workspace-specific data you cannot see, say what data is needed.\n\nQuestion: ${question}`,
                input.teamId,
                {
                    taskType: "HELPER_QA",
                    surface: "HELPER",
                    groundingContext: ""
                }
            );
            const result: BasicAnswerResult = {
                answer,
                source: "llm",
                confidence: 64,
                usedLLM: true
            };
            this.logResult(result, input.teamId, context);
            return result;
        } catch (error) {
            logger.warn("[BasicAnswerService] LLM fallback unavailable", {
                teamId: input.teamId,
                context,
                error: error instanceof Error ? error.message : String(error)
            });
            const result: BasicAnswerResult = {
                answer: LOW_CONFIDENCE_MESSAGE,
                source: "not_found",
                confidence: 0,
                usedLLM: false
            };
            this.logResult(result, input.teamId, context);
            return result;
        }
    }

    private logResult(result: BasicAnswerResult, teamId: string | undefined, context: BasicAnswerContext) {
        logger.info("[BasicAnswerService] answer resolved", {
            teamId,
            context,
            source: result.source,
            confidence: result.confidence,
            usedLLM: result.usedLLM
        });
    }
}

export const basicAnswerService = new BasicAnswerService();
