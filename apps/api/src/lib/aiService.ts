
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { LLMProvider, TaskComplexity } from "@/ai/types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import {
    enforceAgentOutputGuardrails,
    GuardrailOptions
} from "./ai/agentOutputGuardrails";

type ProviderKeySet = {
    gemini?: { apiKey: string; model?: string };
    openai?: { apiKey: string; model?: string };
    anthropic?: { apiKey: string; model?: string };
};

const DEFAULT_MODELS = {
    gemini: {
        routine: "gemini-1.5-flash",
        strategic: "gemini-1.5-pro"
    },
    openai: {
        routine: "gpt-4o-mini",
        strategic: "gpt-4o"
    },
    anthropic: {
        routine: "claude-3-5-sonnet",
        strategic: "claude-3-5-sonnet"
    }
};

const COST_PER_1K_TOKENS: Record<string, number> = {
    "gpt-4o": 0.015,
    "gpt-4o-mini": 0.003,
    "claude-3-5-sonnet": 0.015,
    "claude-3-opus": 0.03,
    "gemini-1.5-pro": 0.007,
    "gemini-1.5-flash": 0.0007,
    "unknown": 0
};

function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
    const rate = COST_PER_1K_TOKENS[model] ?? COST_PER_1K_TOKENS["unknown"];
    return ((tokensIn + tokensOut) / 1000) * rate;
}

async function loadTeamProviders(teamId?: string): Promise<ProviderKeySet> {
    const fromEnv: ProviderKeySet = {
        gemini: process.env["GEMINI_API_KEY"]
            ? { apiKey: process.env["GEMINI_API_KEY"], model: process.env["GEMINI_MODEL"] }
            : undefined,
        openai: process.env["OPENAI_API_KEY"]
            ? { apiKey: process.env["OPENAI_API_KEY"], model: process.env["OPENAI_MODEL"] }
            : undefined,
        anthropic: process.env["ANTHROPIC_API_KEY"]
            ? { apiKey: process.env["ANTHROPIC_API_KEY"], model: process.env["ANTHROPIC_MODEL"] }
            : undefined
    };

    if (!teamId) return fromEnv;

    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { aiConfig: true }
    });
    const providers = (team?.aiConfig as any)?.providers || {};

    return {
        gemini: providers?.gemini?.apiKey
            ? { apiKey: providers.gemini.apiKey, model: providers.gemini.model || fromEnv.gemini?.model }
            : fromEnv.gemini,
        openai: providers?.openai?.apiKey
            ? { apiKey: providers.openai.apiKey, model: providers.openai.model || fromEnv.openai?.model }
            : fromEnv.openai,
        anthropic: providers?.anthropic?.apiKey
            ? { apiKey: providers.anthropic.apiKey, model: providers.anthropic.model || fromEnv.anthropic?.model }
            : fromEnv.anthropic
    };
}

function resolveProvider(
    providers: ProviderKeySet,
    complexity: TaskComplexity = TaskComplexity.ROUTINE
): { provider: LLMProvider; apiKey: string; model: string } {
    if (providers.gemini?.apiKey) {
        const model = providers.gemini.model || DEFAULT_MODELS.gemini[complexity === TaskComplexity.STRATEGIC ? "strategic" : "routine"];
        return { provider: LLMProvider.GEMINI, apiKey: providers.gemini.apiKey, model };
    }
    if (providers.openai?.apiKey) {
        const model = providers.openai.model || DEFAULT_MODELS.openai[complexity === TaskComplexity.STRATEGIC ? "strategic" : "routine"];
        return { provider: LLMProvider.OPENAI, apiKey: providers.openai.apiKey, model };
    }
    if (providers.anthropic?.apiKey) {
        const model = providers.anthropic.model || DEFAULT_MODELS.anthropic[complexity === TaskComplexity.STRATEGIC ? "strategic" : "routine"];
        return { provider: LLMProvider.ANTHROPIC, apiKey: providers.anthropic.apiKey, model };
    }
    throw new Error("No LLM provider configured. Please set Gemini/OpenAI/Anthropic keys.");
}

function extractJsonBlock(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
    const start = Math.min(
        ...["{", "["]
            .map((token) => trimmed.indexOf(token))
            .filter((idx) => idx !== -1)
    );
    if (Number.isFinite(start) && start >= 0) {
        const endBrace = trimmed.lastIndexOf("}");
        const endBracket = trimmed.lastIndexOf("]");
        const end = Math.max(endBrace, endBracket);
        if (end > start) {
            return trimmed.slice(start, end + 1);
        }
    }
    return trimmed;
}

async function logUsage(params: {
    teamId?: string;
    provider: LLMProvider;
    model: string;
    taskType: TaskComplexity;
    tokensIn: number;
    tokensOut: number;
    latencyMs: number;
    success: boolean;
    error?: string;
}) {
    if (!params.teamId) return;
    try {
        await prisma.lLMUsageLog.create({
            data: {
                teamId: params.teamId,
                provider: params.provider,
                model: params.model,
                taskType: params.taskType,
                tokensIn: params.tokensIn,
                tokensOut: params.tokensOut,
                cost: estimateCost(params.model, params.tokensIn, params.tokensOut),
                latency: params.latencyMs,
                success: params.success,
                error: params.error
            }
        });
    } catch (err) {
        logger.error("[AI Usage] Failed to record usage", { error: (err as Error).message });
    }
}

async function callLLM(prompt: string, options: { teamId?: string; complexity?: TaskComplexity }) {
    const providers = await loadTeamProviders(options.teamId);
    const resolved = resolveProvider(providers, options.complexity);
    const start = Date.now();

    try {
        if (resolved.provider === LLMProvider.GEMINI) {
            const genAI = new GoogleGenerativeAI(resolved.apiKey);
            const model = genAI.getGenerativeModel({ model: resolved.model });
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();
            const usage = (response as any).usageMetadata || {};
            const tokensIn = usage.promptTokenCount || 0;
            const tokensOut = usage.candidatesTokenCount || 0;
            await logUsage({
                teamId: options.teamId,
                provider: resolved.provider,
                model: resolved.model,
                taskType: options.complexity || TaskComplexity.ROUTINE,
                tokensIn,
                tokensOut,
                latencyMs: Date.now() - start,
                success: true
            });
            return { text, model: resolved.model };
        }

        if (resolved.provider === LLMProvider.OPENAI) {
            const client = new OpenAI({ apiKey: resolved.apiKey });
            const response = await client.chat.completions.create({
                model: resolved.model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.4
            });
            const text = response.choices?.[0]?.message?.content || "";
            const tokensIn = response.usage?.prompt_tokens || 0;
            const tokensOut = response.usage?.completion_tokens || 0;
            await logUsage({
                teamId: options.teamId,
                provider: resolved.provider,
                model: resolved.model,
                taskType: options.complexity || TaskComplexity.ROUTINE,
                tokensIn,
                tokensOut,
                latencyMs: Date.now() - start,
                success: true
            });
            return { text, model: resolved.model };
        }

        const client = new Anthropic({ apiKey: resolved.apiKey });
        const message = await client.messages.create({
            model: resolved.model,
            max_tokens: 800,
            messages: [{ role: "user", content: prompt }]
        });
        const text = message.content?.[0]?.type === "text" ? message.content[0].text : "";
        const tokensIn = (message.usage as any)?.input_tokens || 0;
        const tokensOut = (message.usage as any)?.output_tokens || 0;
        await logUsage({
            teamId: options.teamId,
            provider: resolved.provider,
            model: resolved.model,
            taskType: options.complexity || TaskComplexity.ROUTINE,
            tokensIn,
            tokensOut,
            latencyMs: Date.now() - start,
            success: true
        });
        return { text, model: resolved.model };
    } catch (error: any) {
        await logUsage({
            teamId: options.teamId,
            provider: resolved.provider,
            model: resolved.model,
            taskType: options.complexity || TaskComplexity.ROUTINE,
            tokensIn: 0,
            tokensOut: 0,
            latencyMs: Date.now() - start,
            success: false,
            error: error.message
        });
        throw error;
    }
}

export class AIService {
    public async askAI(
        prompt: string,
        teamId?: string,
        taskContext?: {
            expectsJson?: boolean;
            disableGuardrails?: boolean;
            groundingContext?: string;
            taskType?: string;
        }
    ) {
        const result = await callLLM(prompt, { teamId, complexity: TaskComplexity.STRATEGIC });

        const expectsJson = !!taskContext?.expectsJson;
        const disableGuardrails = !!taskContext?.disableGuardrails;
        const groundingContext = taskContext?.groundingContext || "";

        if (expectsJson || disableGuardrails) {
            return result.text;
        }

        const guardrailOptions: GuardrailOptions = {
            sourceContext: groundingContext,
            strictGrounding: true
        };
        const guarded = enforceAgentOutputGuardrails(result.text, guardrailOptions);
        return guarded.text;
    }

    async getEmbeddings(text: string, teamId?: string): Promise<number[]> {
        const providers = await loadTeamProviders(teamId);
        if (providers.openai?.apiKey) {
            const client = new OpenAI({ apiKey: providers.openai.apiKey });
            const model = providers.openai.model || "text-embedding-3-small";
            const response = await client.embeddings.create({
                model,
                input: text
            });
            return response.data[0]?.embedding || [];
        }
        if (providers.gemini?.apiKey) {
            const genAI = new GoogleGenerativeAI(providers.gemini.apiKey);
            const model = genAI.getGenerativeModel({
                model: process.env["GEMINI_EMBEDDING_MODEL"] || "text-embedding-004"
            });
            const result = await (model as any).embedContent(text);
            return result?.embedding?.values || [];
        }
        throw new Error("No embedding provider configured. Set OpenAI or Gemini API key.");
    }

    async generateEmailDraft(lead: any, icp: any, teamId?: string): Promise<{ subject: string; body: string }> {
        const prompt = `
You are a B2B outreach expert. Draft a cold email.

Lead:
${JSON.stringify(lead)}

ICP:
${JSON.stringify(icp)}

Return JSON with keys: subject, body.
        `.trim();
        const result = await callLLM(prompt, { teamId, complexity: TaskComplexity.STRATEGIC });
        const json = JSON.parse(extractJsonBlock(result.text));
        return { subject: json.subject, body: json.body };
    }

    async analyzeProfile(profileText: string, teamId?: string): Promise<string> {
        const prompt = `Analyze the following prospect profile. Return bullet points with role, priorities, pains, and relevant hooks.\n\n${profileText}`;
        const result = await callLLM(prompt, { teamId, complexity: TaskComplexity.ROUTINE });
        return result.text;
    }

    async generateComment(postContent: string, profileContext: string, teamId?: string): Promise<string> {
        const prompt = `Write a short LinkedIn comment (max 2 sentences) that is insightful and non-salesy.\n\nPost:\n${postContent}\n\nProfile context:\n${profileContext}`;
        const result = await callLLM(prompt, { teamId, complexity: TaskComplexity.ROUTINE });
        return result.text;
    }

    async generateConnectionMessage(profileContext: string, teamId?: string): Promise<string> {
        const prompt = `Write a concise LinkedIn connection message (max 300 characters) based on this profile context:\n${profileContext}`;
        const result = await callLLM(prompt, { teamId, complexity: TaskComplexity.ROUTINE });
        return result.text;
    }

    async improveEmail(text: string, teamId?: string): Promise<string> {
        const prompt = `Improve the following email for clarity and response rate. Keep it concise and professional.\n\n${text}`;
        const result = await callLLM(prompt, { teamId, complexity: TaskComplexity.ROUTINE });
        return result.text;
    }

    async generateSmartReply(context: string, tone: string = "professional", memories: string[] = [], teamId?: string): Promise<string[]> {
        const prompt = `
Generate 3 short reply suggestions in ${tone} tone.
Context: ${context}
Memories: ${memories.join("\n")}
Return JSON array of strings.
        `.trim();
        const result = await callLLM(prompt, { teamId, complexity: TaskComplexity.ROUTINE });
        const json = JSON.parse(extractJsonBlock(result.text));
        if (!Array.isArray(json)) throw new Error("AI response was not a JSON array");
        return json;
    }

    async researchCompany(companyName: string, teamId?: string) {
        const prompt = `
Research the company "${companyName}". Return JSON with fields: summary, industry, employees, revenue.
If unknown, use null instead of guessing.
        `.trim();
        const result = await callLLM(prompt, { teamId, complexity: TaskComplexity.ROUTINE });
        const json = JSON.parse(extractJsonBlock(result.text));
        return json;
    }
}

export const aiService = new AIService();
export default aiService;
