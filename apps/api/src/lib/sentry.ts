import * as Sentry from "@sentry/node";
import type { FastifyInstance } from "fastify";

/**
 * Sentry for apps/api (api-main + api-worker). Side-effect free: the entrypoints
 * call initSentry() via ./sentryInit, so scripts/tests that import this module
 * (through aiService etc.) never start the SDK.
 *
 * Privacy (owner decision, OPEN-272): AI spans are metadata-only - model, token
 * usage, latency, errors. Prompts and completions carry third-party lead PII, so
 * they are never recorded (recordInputs/recordOutputs false on every client, and
 * sendDefaultPii false so the SDK-wide gen_ai default is also off).
 */
export const AI_RECORDING_OPTIONS = { recordInputs: false, recordOutputs: false } as const;

// The SDK's default OpenAI/Anthropic auto-integrations would double up with the
// explicit client wrapping below whenever their import-time patching does take.
const EXPLICITLY_WRAPPED_AI_INTEGRATIONS = new Set(["OpenAI", "Anthropic_AI"]);

const DEFAULT_TRACES_SAMPLE_RATE = 0.1;

function parseSampleRate(raw: string | undefined): number {
    if (raw === undefined || raw.trim() === "") return DEFAULT_TRACES_SAMPLE_RATE;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_TRACES_SAMPLE_RATE;
}

/**
 * Initialises Sentry when SENTRY_DSN is set; a no-op otherwise. Never throws, so
 * a bad DSN or SDK problem can't block boot. Returns whether Sentry is active.
 */
export function initSentry(env: NodeJS.ProcessEnv = process.env): boolean {
    const dsn = env["SENTRY_DSN"]?.trim();
    if (!dsn) return false;
    try {
        Sentry.init({
            dsn,
            environment: env["SENTRY_ENVIRONMENT"] || env["NODE_ENV"] || "development",
            // Release is left to the SDK, which reads SENTRY_RELEASE from the env.
            tracesSampleRate: parseSampleRate(env["SENTRY_TRACES_SAMPLE_RATE"]),
            sendDefaultPii: false,
            // Routes are dynamically imported after init; don't chain
            // import-in-the-middle onto tsx's loader for them. AI clients are
            // wrapped explicitly, so the loader hooks aren't needed.
            registerEsmLoaderHooks: false,
            integrations: (defaults) => [
                ...defaults.filter(
                    (integration) =>
                        !EXPLICITLY_WRAPPED_AI_INTEGRATIONS.has(integration.name) &&
                        integration.name !== "OnUnhandledRejection"
                ),
                // Default mode is "warn", and merely registering a listener stops
                // Node from crashing on an unhandled rejection. "strict" reports it
                // and then exits, preserving today's crash-and-restart behaviour.
                Sentry.onUnhandledRejectionIntegration({ mode: "strict" }),
            ],
        });
        return true;
    } catch (error) {
        console.error("[Sentry] init failed; continuing without error monitoring:", (error as Error)?.message);
        return false;
    }
}

/** Reports errors thrown out of Fastify hooks/handlers. Responses are unchanged. */
export function setupSentryFastify(app: FastifyInstance): void {
    if (!Sentry.isInitialized()) return;
    Sentry.setupFastifyErrorHandler(app);
}

export function captureException(error: unknown): void {
    Sentry.captureException(error);
}

/** Every OpenAI client constructed in apps/api must go through this (guarded by sentry.test.ts). */
export function instrumentOpenAI<T extends object>(client: T): T {
    if (!Sentry.isInitialized()) return client;
    return Sentry.instrumentOpenAiClient(client, AI_RECORDING_OPTIONS);
}

/** Every Anthropic client constructed in apps/api must go through this (guarded by sentry.test.ts). */
export function instrumentAnthropic<T extends object>(client: T): T {
    if (!Sentry.isInitialized()) return client;
    return Sentry.instrumentAnthropicAiClient(client, AI_RECORDING_OPTIONS);
}
