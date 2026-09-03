
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
import { deductCredits, refundCredits } from "@/lib/credits";
import {
    AISurface,
    clampGeneratedText,
    enforceAIPromptPolicy,
    resolveSurfaceFromTaskType
} from "@/lib/aiInputGuardrails";
import { RequestContext } from "@/lib/requestContext";

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

const OUTPUT_MAX_CHARS: Record<AISurface, number> = {
    CHAT: 2500,
    HELPER: 3500,
    EMAIL: 2800,
    LANDING: 12000,
    GENERIC: 5000
};

const EMBEDDING_MAX_INPUT_CHARS = 12000;

function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
    const rate = COST_PER_1K_TOKENS[model] ?? COST_PER_1K_TOKENS["unknown"];
    return ((tokensIn + tokensOut) / 1000) * rate;
}

function isChargeableTeamId(teamId?: string): teamId is string {
    if (!teamId) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(teamId);
}

function estimateCreditsForPrompt(prompt: string, complexity?: TaskComplexity): number {
    const inputTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = complexity === TaskComplexity.STRATEGIC ? 900 : 500;
    return Math.max(1, Math.ceil((inputTokens + estimatedOutputTokens) / 1000));
}

function calculateCreditsFromUsage(tokensIn: number, tokensOut: number): number {
    if (!Number.isFinite(tokensIn) || !Number.isFinite(tokensOut)) return 0;
    return Math.max(1, Math.ceil((Math.max(0, tokensIn) + Math.max(0, tokensOut)) / 1000));
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
    actorId?: string;
    provider: LLMProvider;
    model: string;
    taskType: string;
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
                actorId: params.actorId,
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

async function reserveCreditsForGeneration(
    teamId: string | undefined,
    credits: number,
    description: string,
    meta: Record<string, unknown>
) {
    if (!isChargeableTeamId(teamId)) return 0;
    const ok = await deductCredits(teamId, credits, `${description} (reservation)`, {
        ...meta,
        billingStage: "reservation",
    });
    if (!ok) {
        throw new Error("Insufficient credits for AI generation.");
    }
    return credits;
}

async function settleCreditsForGeneration(
    teamId: string | undefined,
    reservedCredits: number,
    actualCredits: number,
    description: string,
    meta: Record<string, unknown>
) {
    if (!isChargeableTeamId(teamId) || reservedCredits <= 0) {
        return;
    }

    const normalizedActual = Math.max(1, actualCredits || reservedCredits);
    if (normalizedActual === reservedCredits) {
        return;
    }

    if (normalizedActual > reservedCredits) {
        const extra = normalizedActual - reservedCredits;
        const debited = await deductCredits(teamId, extra, `${description} (usage adjustment)`, {
            ...meta,
            billingStage: "adjustment",
            adjustmentType: "debit",
            reservedCredits,
            actualCredits: normalizedActual,
        });
        if (!debited) {
            logger.warn("[AI Usage] Unable to debit usage adjustment due to insufficient balance", {
                teamId,
                extra,
                reservedCredits,
                actualCredits: normalizedActual,
            });
        }
        return;
    }

    const refund = reservedCredits - normalizedActual;
    await refundCredits(teamId, refund, `${description} (usage adjustment)`, {
        ...meta,
        billingStage: "adjustment",
        adjustmentType: "refund",
        reservedCredits,
        actualCredits: normalizedActual,
    });
}

const LLM_TIMEOUT_MS = 30000;
const MAX_RETRIES_PER_PROVIDER = 1;
const RETRY_BACKOFF_MS = 400;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientLLMError(error: any): boolean {
    if (error?.message === "LLM_TIMEOUT") return true;
    const status = error?.status ?? error?.response?.status;
    if (status === 429 || (typeof status === "number" && status >= 500)) return true;
    return ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"].includes(error?.code);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error("LLM_TIMEOUT")), ms))
    ]);
}

// Smart routing: a provider that has failed repeatedly is deprioritized (not eliminated)
// for a cooldown window, so retries don't keep burning timeouts on a known-down provider.
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 60000;
const providerCircuits = new Map<LLMProvider, { failures: number; openUntil: number }>();

function isCircuitOpen(provider: LLMProvider): boolean {
    const circuit = providerCircuits.get(provider);
    return !!circuit && circuit.openUntil > Date.now();
}

function recordProviderFailure(provider: LLMProvider): void {
    const circuit = providerCircuits.get(provider) || { failures: 0, openUntil: 0 };
    circuit.failures += 1;
    if (circuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
        circuit.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
        circuit.failures = 0;
    }
    providerCircuits.set(provider, circuit);
}

function recordProviderSuccess(provider: LLMProvider): void {
    providerCircuits.set(provider, { failures: 0, openUntil: 0 });
}

type ProviderCandidate = { provider: LLMProvider; apiKey: string; model: string };

function buildProviderChain(providers: ProviderKeySet, complexity: TaskComplexity = TaskComplexity.ROUTINE): ProviderCandidate[] {
    const tier = complexity === TaskComplexity.STRATEGIC ? "strategic" : "routine";
    const chain: ProviderCandidate[] = [];
    if (providers.gemini?.apiKey) {
        chain.push({ provider: LLMProvider.GEMINI, apiKey: providers.gemini.apiKey, model: providers.gemini.model || DEFAULT_MODELS.gemini[tier] });
    }
    if (providers.openai?.apiKey) {
        chain.push({ provider: LLMProvider.OPENAI, apiKey: providers.openai.apiKey, model: providers.openai.model || DEFAULT_MODELS.openai[tier] });
    }
    if (providers.anthropic?.apiKey) {
        chain.push({ provider: LLMProvider.ANTHROPIC, apiKey: providers.anthropic.apiKey, model: providers.anthropic.model || DEFAULT_MODELS.anthropic[tier] });
    }
    if (chain.length === 0) {
        throw new Error("No LLM provider configured. Please set Gemini/OpenAI/Anthropic keys.");
    }
    // Smart routing: try providers with a healthy circuit before ones currently in cooldown,
    // without dropping a provider entirely (a fully-failed chain still gets one real attempt).
    return [...chain].sort((a, b) => Number(isCircuitOpen(a.provider)) - Number(isCircuitOpen(b.provider)));
}

async function escalateGenerationFailureToHuman(params: {
    teamId?: string;
    taskType: string;
    prompt: string;
    error: any;
}): Promise<void> {
    try {
        await prisma.manualReview.create({
            data: {
                source: "aiService",
                severity: "CRITICAL",
                reason: `AI generation failed after exhausting all configured providers (${params.taskType})`,
                payload: {
                    teamId: params.teamId,
                    taskType: params.taskType,
                    promptPreview: params.prompt.slice(0, 300),
                    error: params.error?.message || String(params.error)
                }
            }
        });
    } catch (err) {
        logger.error("[AI Usage] Failed to escalate generation failure for human review", {
            error: (err as Error).message
        });
    }
}

async function callProvider(candidate: ProviderCandidate, prompt: string): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
    if (candidate.provider === LLMProvider.GEMINI) {
        const genAI = new GoogleGenerativeAI(candidate.apiKey);
        const model = genAI.getGenerativeModel({ model: candidate.model });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const usage = (response as any).usageMetadata || {};
        return {
            text: response.text(),
            tokensIn: usage.promptTokenCount || 0,
            tokensOut: usage.candidatesTokenCount || 0
        };
    }

    if (candidate.provider === LLMProvider.OPENAI) {
        const client = new OpenAI({ apiKey: candidate.apiKey });
        const response = await client.chat.completions.create({
            model: candidate.model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4
        });
        return {
            text: response.choices?.[0]?.message?.content || "",
            tokensIn: response.usage?.prompt_tokens || 0,
            tokensOut: response.usage?.completion_tokens || 0
        };
    }

    const client = new Anthropic({ apiKey: candidate.apiKey });
    const message = await client.messages.create({
        model: candidate.model,
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }]
    });
    return {
        text: message.content?.[0]?.type === "text" ? message.content[0].text : "",
        tokensIn: (message.usage as any)?.input_tokens || 0,
        tokensOut: (message.usage as any)?.output_tokens || 0
    };
}

async function callLLM(
    prompt: string,
    options: {
        teamId?: string;
        complexity?: TaskComplexity;
        taskTypeLabel?: string;
        creditDescription?: string;
        actorId?: string;
    }
) {
    const actorId = options.actorId || RequestContext.get()?.userId;
    const providers = await loadTeamProviders(options.teamId);
    const chain = buildProviderChain(providers, options.complexity);
    const primary = chain[0];
    const start = Date.now();
    const billedTeamId = isChargeableTeamId(options.teamId) ? options.teamId : undefined;
    const estimatedCredits = estimateCreditsForPrompt(prompt, options.complexity);
    const billingDescription = options.creditDescription || "AI generation usage";
    const reservedCredits = await reserveCreditsForGeneration(billedTeamId, estimatedCredits, billingDescription, {
        provider: primary.provider,
        model: primary.model,
        taskType: options.taskTypeLabel || options.complexity || TaskComplexity.ROUTINE,
        estimatedCredits,
    });
    let settledCredits = false;
    let lastError: any = new Error("No LLM provider configured.");
    let lastCandidate: ProviderCandidate = primary;

    for (const candidate of chain) {
        for (let attempt = 0; attempt <= MAX_RETRIES_PER_PROVIDER; attempt++) {
            lastCandidate = candidate;
            try {
                const { text, tokensIn, tokensOut } = await withTimeout(callProvider(candidate, prompt), LLM_TIMEOUT_MS);
                recordProviderSuccess(candidate.provider);
                await logUsage({
                    teamId: options.teamId,
                    actorId,
                    provider: candidate.provider,
                    model: candidate.model,
                    taskType: options.complexity || TaskComplexity.ROUTINE,
                    tokensIn,
                    tokensOut,
                    latencyMs: Date.now() - start,
                    success: true
                });
                await settleCreditsForGeneration(
                    billedTeamId,
                    reservedCredits,
                    calculateCreditsFromUsage(tokensIn, tokensOut) || estimatedCredits,
                    billingDescription,
                    {
                        model: candidate.model,
                        provider: candidate.provider,
                        taskType: options.taskTypeLabel || options.complexity || TaskComplexity.ROUTINE,
                        tokensIn,
                        tokensOut
                    }
                );
                settledCredits = true;
                return { text, model: candidate.model };
            } catch (error: any) {
                lastError = error;
                recordProviderFailure(candidate.provider);
                logger.warn("[AI Usage] Provider attempt failed", {
                    provider: candidate.provider,
                    model: candidate.model,
                    attempt,
                    error: error?.message || String(error)
                });
                if (attempt < MAX_RETRIES_PER_PROVIDER && isTransientLLMError(error)) {
                    await sleep(RETRY_BACKOFF_MS * (attempt + 1));
                    continue;
                }
                break;
            }
        }
    }

    if (billedTeamId && reservedCredits > 0 && !settledCredits) {
        try {
            await refundCredits(
                billedTeamId,
                reservedCredits,
                `${billingDescription} (failure rollback)`,
                {
                    provider: lastCandidate.provider,
                    model: lastCandidate.model,
                    taskType: options.taskTypeLabel || options.complexity || TaskComplexity.ROUTINE,
                    billingStage: "rollback",
                    reservedCredits,
                }
            );
        } catch (refundError: any) {
            logger.error("[AI Usage] Failed to rollback reserved credits", {
                error: refundError?.message || String(refundError),
                teamId: billedTeamId,
                reservedCredits,
            });
        }
    }

    await logUsage({
        teamId: options.teamId,
        actorId,
        provider: lastCandidate.provider,
        model: lastCandidate.model,
        taskType: options.complexity || TaskComplexity.ROUTINE,
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: Date.now() - start,
        success: false,
        error: lastError?.message
    });
    await escalateGenerationFailureToHuman({
        teamId: options.teamId,
        taskType: options.taskTypeLabel || options.complexity || TaskComplexity.ROUTINE,
        prompt,
        error: lastError
    });
    throw lastError;
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
            surface?: AISurface;
            actorId?: string;
        }
    ) {
        const surface = taskContext?.surface || resolveSurfaceFromTaskType(taskContext?.taskType);
        const safePrompt = enforceAIPromptPolicy(prompt, {
            surface,
            label: "AI prompt"
        });
        const result = await callLLM(safePrompt, {
            teamId,
            complexity: TaskComplexity.STRATEGIC,
            taskTypeLabel: taskContext?.taskType || surface,
            creditDescription: `AI ${taskContext?.taskType || "GENERATION"}`,
            actorId: taskContext?.actorId
        });

        const expectsJson = !!taskContext?.expectsJson;
        const disableGuardrails = !!taskContext?.disableGuardrails;
        const groundingContext = taskContext?.groundingContext || "";

        if (expectsJson) {
            const normalized = String(result.text || "").trim();
            if (normalized.length > 60000) {
                throw new Error("AI JSON response exceeds allowed size.");
            }
            return normalized;
        }

        if (disableGuardrails) {
            return clampGeneratedText(result.text, OUTPUT_MAX_CHARS[surface]);
        }

        const guardrailOptions: GuardrailOptions = {
            sourceContext: groundingContext,
            strictGrounding: true
        };
        const guarded = enforceAgentOutputGuardrails(result.text, guardrailOptions);
        return clampGeneratedText(guarded.text, OUTPUT_MAX_CHARS[surface]);
    }

    async getEmbeddings(text: string, teamId?: string, actorId?: string): Promise<number[]> {
        const resolvedActorId = actorId || RequestContext.get()?.userId;
        const safeText = enforceAIPromptPolicy(text, {
            surface: "HELPER",
            label: "Embedding input",
            maxChars: EMBEDDING_MAX_INPUT_CHARS,
        });
        const providers = await loadTeamProviders(teamId);
        const resolved = resolveProvider(providers, TaskComplexity.ROUTINE);
        const billedTeamId = isChargeableTeamId(teamId) ? teamId : undefined;
        const start = Date.now();
        const estimatedCredits = estimateCreditsForPrompt(safeText, TaskComplexity.ROUTINE);
        const billingDescription = "AI embedding generation";
        const reservedCredits = await reserveCreditsForGeneration(
            billedTeamId,
            estimatedCredits,
            billingDescription,
            {
                provider: resolved.provider,
                model: resolved.model,
                taskType: "EMBEDDING",
                estimatedCredits,
            }
        );
        let settledCredits = false;

        const estimatedTokensIn = Math.ceil(safeText.length / 4);

        try {
        if (providers.openai?.apiKey) {
            const client = new OpenAI({ apiKey: providers.openai.apiKey });
            const model = providers.openai.model || "text-embedding-3-small";
            const response = await client.embeddings.create({
                model,
                input: safeText
            });
            const tokensIn = response.usage?.prompt_tokens || estimatedTokensIn;
            const tokensOut = 0;
            await logUsage({
                teamId,
                actorId: resolvedActorId,
                provider: LLMProvider.OPENAI,
                model,
                taskType: "EMBEDDING",
                tokensIn,
                tokensOut,
                latencyMs: Date.now() - start,
                success: true,
            });
            await settleCreditsForGeneration(
                billedTeamId,
                reservedCredits,
                calculateCreditsFromUsage(tokensIn, tokensOut) || estimatedCredits,
                billingDescription,
                {
                    provider: LLMProvider.OPENAI,
                    model,
                    taskType: "EMBEDDING",
                    tokensIn,
                    tokensOut,
                }
            );
            settledCredits = true;
            return response.data[0]?.embedding || [];
        }
        if (providers.gemini?.apiKey) {
            const genAI = new GoogleGenerativeAI(providers.gemini.apiKey);
            const embeddingModelName = process.env["GEMINI_EMBEDDING_MODEL"] || "text-embedding-004";
            const model = genAI.getGenerativeModel({
                model: embeddingModelName
            });
            const result = await (model as any).embedContent(safeText);
            const tokensIn = estimatedTokensIn;
            const tokensOut = 0;
            await logUsage({
                teamId,
                actorId: resolvedActorId,
                provider: LLMProvider.GEMINI,
                model: embeddingModelName,
                taskType: "EMBEDDING",
                tokensIn,
                tokensOut,
                latencyMs: Date.now() - start,
                success: true,
            });
            await settleCreditsForGeneration(
                billedTeamId,
                reservedCredits,
                calculateCreditsFromUsage(tokensIn, tokensOut) || estimatedCredits,
                billingDescription,
                {
                    provider: LLMProvider.GEMINI,
                    model: embeddingModelName,
                    taskType: "EMBEDDING",
                    tokensIn,
                    tokensOut,
                }
            );
            settledCredits = true;
            return result?.embedding?.values || [];
        }
        throw new Error("No embedding provider configured. Set OpenAI or Gemini API key.");
        } catch (error: any) {
            if (billedTeamId && reservedCredits > 0 && !settledCredits) {
                try {
                    await refundCredits(
                        billedTeamId,
                        reservedCredits,
                        `${billingDescription} (failure rollback)`,
                        {
                            provider: resolved.provider,
                            model: resolved.model,
                            taskType: "EMBEDDING",
                            billingStage: "rollback",
                            reservedCredits,
                        }
                    );
                } catch (refundError: any) {
                    logger.error("[AI Usage] Failed to rollback embedding credits", {
                        error: refundError?.message || String(refundError),
                        teamId: billedTeamId,
                        reservedCredits,
                    });
                }
            }

            await logUsage({
                teamId,
                actorId: resolvedActorId,
                provider: resolved.provider,
                model: resolved.model,
                taskType: "EMBEDDING",
                tokensIn: 0,
                tokensOut: 0,
                latencyMs: Date.now() - start,
                success: false,
                error: error.message,
            });
            throw error;
        }
    }

    async generateImage(prompt: string, teamId?: string): Promise<Buffer> {
        const resolvedActorId = RequestContext.get()?.userId;
        const safePrompt = enforceAIPromptPolicy(prompt, { surface: "HELPER", label: "Image prompt" });
        const providers = await loadTeamProviders(teamId);
        if (!providers.openai?.apiKey) {
            throw new Error("No image provider configured. Set OpenAI API key.");
        }

        const model = "gpt-image-1";
        const billedTeamId = isChargeableTeamId(teamId) ? teamId : undefined;
        const start = Date.now();
        const estimatedCredits = 5;
        const billingDescription = "AI image generation";
        const reservedCredits = await reserveCreditsForGeneration(
            billedTeamId,
            estimatedCredits,
            billingDescription,
            { provider: LLMProvider.OPENAI, model, taskType: "IMAGE_GENERATION", estimatedCredits }
        );
        let settledCredits = false;

        try {
            const client = new OpenAI({ apiKey: providers.openai.apiKey });
            const response = await client.images.generate({
                model,
                prompt: safePrompt,
                size: "1536x1024",
            });
            const b64 = response.data?.[0]?.b64_json;
            if (!b64) {
                throw new Error("Image generation returned no data.");
            }

            await logUsage({
                teamId,
                actorId: resolvedActorId,
                provider: LLMProvider.OPENAI,
                model,
                taskType: "IMAGE_GENERATION",
                tokensIn: 0,
                tokensOut: 0,
                latencyMs: Date.now() - start,
                success: true,
            });
            await settleCreditsForGeneration(
                billedTeamId,
                reservedCredits,
                estimatedCredits,
                billingDescription,
                { provider: LLMProvider.OPENAI, model, taskType: "IMAGE_GENERATION" }
            );
            settledCredits = true;
            return Buffer.from(b64, "base64");
        } catch (error: any) {
            if (billedTeamId && reservedCredits > 0 && !settledCredits) {
                try {
                    await refundCredits(
                        billedTeamId,
                        reservedCredits,
                        `${billingDescription} (failure rollback)`,
                        {
                            provider: LLMProvider.OPENAI,
                            model,
                            taskType: "IMAGE_GENERATION",
                            billingStage: "rollback",
                            reservedCredits,
                        }
                    );
                } catch (refundError: any) {
                    logger.error("[AI Usage] Failed to rollback image generation credits", {
                        error: refundError?.message || String(refundError),
                        teamId: billedTeamId,
                        reservedCredits,
                    });
                }
            }

            await logUsage({
                teamId,
                actorId: resolvedActorId,
                provider: LLMProvider.OPENAI,
                model,
                taskType: "IMAGE_GENERATION",
                tokensIn: 0,
                tokensOut: 0,
                latencyMs: Date.now() - start,
                success: false,
                error: error.message,
            });
            throw error;
        }
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
        const safePrompt = enforceAIPromptPolicy(prompt, { surface: "EMAIL", label: "Email generation prompt" });
        const result = await callLLM(safePrompt, {
            teamId,
            complexity: TaskComplexity.STRATEGIC,
            taskTypeLabel: "EMAIL_DRAFT",
            creditDescription: "AI email draft generation"
        });
        const json = JSON.parse(extractJsonBlock(result.text));
        return {
            subject: clampGeneratedText(String(json.subject || ""), 160),
            body: clampGeneratedText(String(json.body || ""), 2200)
        };
    }

    async analyzeProfile(profileText: string, teamId?: string): Promise<string> {
        const prompt = `Analyze the following prospect profile. Return bullet points with role, priorities, pains, and relevant hooks.\n\n${profileText}`;
        const safePrompt = enforceAIPromptPolicy(prompt, { surface: "HELPER", label: "Profile analysis prompt" });
        const result = await callLLM(safePrompt, {
            teamId,
            complexity: TaskComplexity.ROUTINE,
            taskTypeLabel: "PROFILE_ANALYSIS",
            creditDescription: "AI profile analysis"
        });
        return clampGeneratedText(result.text, 3000);
    }

    async generateComment(postContent: string, profileContext: string, teamId?: string): Promise<string> {
        const prompt = `Write a short LinkedIn comment (max 2 sentences) that is insightful and non-salesy.\n\nPost:\n${postContent}\n\nProfile context:\n${profileContext}`;
        const safePrompt = enforceAIPromptPolicy(prompt, { surface: "HELPER", label: "Comment generation prompt" });
        const result = await callLLM(safePrompt, {
            teamId,
            complexity: TaskComplexity.ROUTINE,
            taskTypeLabel: "COMMENT_GENERATION",
            creditDescription: "AI comment generation"
        });
        return clampGeneratedText(result.text, 500);
    }

    async generateConnectionMessage(profileContext: string, teamId?: string): Promise<string> {
        const prompt = `Write a concise LinkedIn connection message (max 300 characters) based on this profile context:\n${profileContext}`;
        const safePrompt = enforceAIPromptPolicy(prompt, { surface: "HELPER", label: "Connection message prompt" });
        const result = await callLLM(safePrompt, {
            teamId,
            complexity: TaskComplexity.ROUTINE,
            taskTypeLabel: "CONNECTION_MESSAGE",
            creditDescription: "AI connection message generation"
        });
        return clampGeneratedText(result.text, 320);
    }

    async improveEmail(text: string, teamId?: string): Promise<string> {
        const prompt = `Improve the following email for clarity and response rate. Keep it concise and professional.\n\n${text}`;
        const safePrompt = enforceAIPromptPolicy(prompt, { surface: "EMAIL", label: "Email improvement prompt" });
        const result = await callLLM(safePrompt, {
            teamId,
            complexity: TaskComplexity.ROUTINE,
            taskTypeLabel: "EMAIL_IMPROVEMENT",
            creditDescription: "AI email improvement"
        });
        return clampGeneratedText(result.text, 2800);
    }

    async generateSmartReply(context: string, tone: string = "professional", memories: string[] = [], teamId?: string): Promise<string[]> {
        const prompt = `
Generate 3 short reply suggestions in ${tone} tone.
        Context: ${context}
Memories: ${memories.join("\n")}
Return JSON array of strings.
        `.trim();
        const safePrompt = enforceAIPromptPolicy(prompt, { surface: "CHAT", label: "Smart reply prompt" });
        const result = await callLLM(safePrompt, {
            teamId,
            complexity: TaskComplexity.ROUTINE,
            taskTypeLabel: "SMART_REPLY",
            creditDescription: "AI smart reply generation"
        });
        const json = JSON.parse(extractJsonBlock(result.text));
        if (!Array.isArray(json)) throw new Error("AI response was not a JSON array");
        return json.slice(0, 3).map((item) => clampGeneratedText(String(item || ""), 500));
    }

    async suggestPipelineTasks(lead: {
        fullName?: string | null;
        company?: string | null;
        jobTitle?: string | null;
        pipelineState?: string | null;
        intentScore?: number | null;
        status?: string | null;
    }, teamId?: string): Promise<Array<{ title: string; description: string; priority: "low" | "medium" | "high" }>> {
        const prompt = `
A sales rep is working this lead in a pipeline board:
Name: ${lead.fullName || "Unknown"}
Company: ${lead.company || "Unknown"}
Title: ${lead.jobTitle || "Unknown"}
Pipeline stage: ${lead.pipelineState || "COLD"}
Intent score (0-1): ${lead.intentScore ?? "unknown"}
Status: ${lead.status || "NEW"}

Suggest up to 3 concrete next actions the rep should take with this lead right now.
Return a JSON array of objects, each with fields: title (max 60 chars), description (max 200 chars), priority (one of "low", "medium", "high").
        `.trim();
        const safePrompt = enforceAIPromptPolicy(prompt, { surface: "HELPER", label: "Pipeline task suggestion prompt" });
        const result = await callLLM(safePrompt, {
            teamId,
            complexity: TaskComplexity.ROUTINE,
            taskTypeLabel: "PIPELINE_TASK_SUGGESTION",
            creditDescription: "AI pipeline task suggestions"
        });
        const json = JSON.parse(extractJsonBlock(result.text));
        if (!Array.isArray(json)) throw new Error("AI response was not a JSON array");
        return json.slice(0, 3).map((item) => ({
            title: clampGeneratedText(String(item?.title || "Follow up"), 60),
            description: clampGeneratedText(String(item?.description || ""), 200),
            priority: ["low", "medium", "high"].includes(item?.priority) ? item.priority : "medium",
        }));
    }

    async recommendPipelineStage(lead: {
        fullName?: string | null;
        pipelineState?: string | null;
        intentScore?: number | null;
        status?: string | null;
    }, teamId?: string): Promise<string | null> {
        const stages = ["COLD", "WARM", "HOT", "COORDINATING", "MEETING_CONFIRMED", "COMPLETED"];
        const prompt = `
A lead is currently in pipeline stage "${lead.pipelineState || "COLD"}" with intent score ${lead.intentScore ?? "unknown"} (0-1) and status "${lead.status || "NEW"}".
Which of these stages should it move to next: ${stages.join(", ")}?
Return JSON with a single field "stage" set to exactly one of those values, or the current stage if no change is warranted.
        `.trim();
        const safePrompt = enforceAIPromptPolicy(prompt, { surface: "HELPER", label: "Pipeline stage recommendation prompt" });
        const result = await callLLM(safePrompt, {
            teamId,
            complexity: TaskComplexity.ROUTINE,
            taskTypeLabel: "PIPELINE_STAGE_RECOMMENDATION",
            creditDescription: "AI pipeline stage recommendation"
        });
        const json = JSON.parse(extractJsonBlock(result.text));
        return stages.includes(json?.stage) ? json.stage : null;
    }

    async summarizePipelineLead(lead: {
        fullName?: string | null;
        company?: string | null;
        pipelineState?: string | null;
        intentScore?: number | null;
        status?: string | null;
    }, teamId?: string): Promise<string> {
        const prompt = `
Summarize this lead's status in 1-2 sentences for a sales rep glancing at a pipeline board.
Name: ${lead.fullName || "Unknown"}
Company: ${lead.company || "Unknown"}
Pipeline stage: ${lead.pipelineState || "COLD"}
Intent score (0-1): ${lead.intentScore ?? "unknown"}
Status: ${lead.status || "NEW"}
        `.trim();
        const safePrompt = enforceAIPromptPolicy(prompt, { surface: "HELPER", label: "Pipeline lead summary prompt" });
        const result = await callLLM(safePrompt, {
            teamId,
            complexity: TaskComplexity.ROUTINE,
            taskTypeLabel: "PIPELINE_LEAD_SUMMARY",
            creditDescription: "AI pipeline lead summary"
        });
        return clampGeneratedText(result.text, 400);
    }

    async researchCompany(companyName: string, teamId?: string) {
        const prompt = `
Research the company "${companyName}". Return JSON with fields: summary, industry, employees, revenue.
If unknown, use null instead of guessing.
        `.trim();
        const safePrompt = enforceAIPromptPolicy(prompt, { surface: "HELPER", label: "Company research prompt" });
        const result = await callLLM(safePrompt, {
            teamId,
            complexity: TaskComplexity.ROUTINE,
            taskTypeLabel: "COMPANY_RESEARCH",
            creditDescription: "AI company research"
        });
        const json = JSON.parse(extractJsonBlock(result.text));
        return json;
    }
}

export const aiService = new AIService();
export default aiService;
