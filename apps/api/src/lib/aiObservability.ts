import { randomUUID } from "node:crypto";

import AnthropicClient from "@anthropic-ai/sdk";
import { Anthropic as PostHogAnthropic } from "@posthog/ai/anthropic";
import { OpenAI as PostHogOpenAI } from "@posthog/ai/openai";
import OpenAIClient from "openai";
import { PostHog } from "posthog-node";

import { RequestContext } from "@/lib/requestContext";
import { instrumentAnthropic, instrumentOpenAI } from "@/lib/sentry";

const projectToken = process.env["POSTHOG_API_KEY"];

// Lead prompts and generated outreach can contain third-party PII. Keep the
// project's existing metadata-only observability policy for all AI providers.
export const posthogAIClient = projectToken
    ? new PostHog(projectToken, {
        host: process.env["POSTHOG_HOST"],
        enableExceptionAutocapture: true,
        privacyMode: true,
    })
    : null;

export type AIObservabilityContext = {
    posthogTraceId: string;
    posthogDistinctId?: string;
    posthogProperties: { $ai_session_id: string };
};

export function createAIObservabilityContext(actorId?: string): AIObservabilityContext {
    const posthogDistinctId = actorId || RequestContext.get()?.userId;
    return {
        posthogTraceId: randomUUID(),
        ...(posthogDistinctId ? { posthogDistinctId } : {}),
        // This app has no conversation/thread entity around provider calls, so
        // the process run is the narrowest available conversation scope.
        posthogProperties: { $ai_session_id: `api-process-${process.pid}` },
    };
}

export function withAIProvider(context: AIObservabilityContext, provider: string) {
    return {
        posthogTraceId: context.posthogTraceId,
        ...(context.posthogDistinctId ? { posthogDistinctId: context.posthogDistinctId } : {}),
        posthogProperties: {
            ...context.posthogProperties,
            $ai_provider: provider,
        },
    };
}

export function createOpenAIClient(options: Omit<NonNullable<ConstructorParameters<typeof OpenAIClient>[0]>, "apiKey" | "baseURL"> & { apiKey: string; baseURL?: string }): OpenAIClient {
    const client = posthogAIClient
        ? new PostHogOpenAI({ ...options, posthog: posthogAIClient })
        : new OpenAIClient(options);
    return instrumentOpenAI(client) as OpenAIClient;
}

export function createAnthropicClient(options: Omit<NonNullable<ConstructorParameters<typeof AnthropicClient>[0]>, "apiKey" | "baseURL"> & { apiKey: string; baseURL?: string }): AnthropicClient {
    const client = posthogAIClient
        ? new PostHogAnthropic({ ...options, posthog: posthogAIClient })
        : new AnthropicClient(options);
    return instrumentAnthropic(client) as AnthropicClient;
}

function captureManual(event: "$ai_generation" | "$ai_embedding", context: AIObservabilityContext, properties: Record<string, unknown>): void {
    if (!posthogAIClient) return;

    try {
        posthogAIClient.capture({
            distinctId: context.posthogDistinctId || context.posthogProperties.$ai_session_id,
            event,
            properties: {
                ...context.posthogProperties,
                $ai_trace_id: context.posthogTraceId,
                ...(context.posthogDistinctId ? {} : { $process_person_profile: false }),
                ...properties,
            },
        });
    } catch {
        // Observability must never interrupt a provider response.
    }
}

export function captureLegacyGeminiGeneration(params: {
    context: AIObservabilityContext;
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
}): void {
    captureManual("$ai_generation", params.context, {
        $ai_provider: "google",
        $ai_model: params.model,
        $ai_input_tokens: params.inputTokens,
        $ai_output_tokens: params.outputTokens,
        $ai_latency: params.latencyMs / 1000,
    });
}

export function captureLegacyGeminiEmbedding(params: {
    context: AIObservabilityContext;
    model: string;
    inputTokens: number;
    latencyMs: number;
}): void {
    captureManual("$ai_embedding", params.context, {
        $ai_provider: "google",
        $ai_model: params.model,
        $ai_input_tokens: params.inputTokens,
        $ai_latency: params.latencyMs / 1000,
    });
}
