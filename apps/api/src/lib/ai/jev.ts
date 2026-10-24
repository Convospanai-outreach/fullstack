import { TypeSafeClient, choice, noul, type EntryType, type Questions, type SystemOneResult } from "@typesafe-ai/sdk";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Jev (TypeSafe's System One model) answers typed questions about text with calibrated
// probabilities. It only supplies judgments: the callers of these helpers decide what to do
// with them. Every question, option and threshold Jev is asked lives in this file so they can
// be read and changed together. Content writing stays with aiService.

const JEV_MODEL = process.env["JEV_MODEL"] || "jev-1.14.0";
const JEV_TIMEOUT_MS = 15000;
// Jev bills input tokens only.
const JEV_USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

// A Noul at or above this reads as yes, at or below NOUL_NO as no; between them the text
// doesn't settle the question.
export const NOUL_YES = 0.7;
export const NOUL_NO = 0.3;

// No key configured. Callers treat this like any other failed call: never as a "no".
export class JevUnavailableError extends Error {
    constructor() {
        super("JEV_API_KEY is not set");
        this.name = "JevUnavailableError";
    }
}

let cachedClient: { apiKey: string; client: TypeSafeClient } | null = null;

function getClient(): TypeSafeClient {
    const apiKey = process.env["JEV_API_KEY"];
    if (!apiKey) throw new JevUnavailableError();
    if (cachedClient?.apiKey !== apiKey) {
        // logLevel stays at warn: debug would log request bodies, which hold reply text.
        cachedClient = { apiKey, client: new TypeSafeClient({ apiKey, defaultModel: JEV_MODEL, timeout: JEV_TIMEOUT_MS, logLevel: "warn" }) };
    }
    return cachedClient.client;
}

async function logUsage(teamId: string | undefined, taskType: string, model: string, tokensIn: number, latencyMs: number, error?: string) {
    if (!teamId) return;
    try {
        await prisma.lLMUsageLog.create({
            data: {
                teamId,
                provider: "typesafe",
                model,
                taskType,
                tokensIn,
                tokensOut: 0,
                cost: tokensIn * JEV_USD_PER_INPUT_TOKEN,
                latency: latencyMs,
                success: !error,
                error
            }
        });
    } catch (err) {
        logger.error("[Jev] Failed to record usage", { error: (err as Error).message });
    }
}

async function ask<Q extends Questions>(taskType: string, teamId: string | undefined, state: NonNullable<EntryType>, questions: Q): Promise<SystemOneResult<Q>["answers"]> {
    const client = getClient();
    const start = Date.now();
    try {
        const result = await client.systemOne({ state, questions });
        await logUsage(teamId, taskType, result.model, result.usage.input_tokens ?? 0, Date.now() - start);
        return result.answers;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logUsage(teamId, taskType, JEV_MODEL, 0, Date.now() - start, message);
        throw error;
    }
}

const percent = (p: number) => `${Math.round(p * 100)}%`;

// --- Reply classification (Action Inbox suggestions) ---

export const REPLY_CLASSIFICATIONS = ["INTERESTED", "NOT_INTERESTED", "OOO", "QUESTION", "DNC"] as const;
export type ReplyClassification = (typeof REPLY_CLASSIFICATIONS)[number];

const RESPONSE_LABELS = { interested: "INTERESTED", question: "QUESTION", not_interested: "NOT_INTERESTED" } as const;

/**
 * Classifies a reply to an outreach email. Send it already masked: the text goes to TypeSafe.
 * A request to stop wins over everything, then an automatic away message, then the sender's
 * response to the offer. `confidence` is the probability of the label returned.
 */
export async function classifyReply(reply: { subject: string; body: string }, teamId: string): Promise<{ classification: ReplyClassification; confidence: number; reasoning: string }> {
    const answers = await ask(
        "REPLY_CLASSIFICATION",
        teamId,
        {
            context: "`reply` is an email someone sent back after receiving a sales outreach email from us.",
            reply: { subject: reply.subject, body: reply.body }
        },
        {
            asksToStop: noul("Does the sender of `reply` ask not to be contacted again?", {
                true: "They ask to unsubscribe, to be removed from the list, or for the emails to stop.",
                false: "They don't ask for the emails to stop, even if they turn the offer down."
            }),
            isAutoReply: noul("Is `reply` an automatic away message?", {
                true: "An automated message saying the person is out of office, on leave, or no longer at the company.",
                false: "A message a person wrote in answer to our email."
            }),
            response: choice("How does the sender of `reply` respond to our offer?", {
                interested: "They want to talk, book a call, see a demo, get pricing, or receive more information.",
                question: "They ask how something works or whether it fits their needs, without saying they want to go ahead.",
                not_interested: "They turn it down, say they already have a solution, or say it costs too much."
            })
        }
    );

    const stop = answers.asksToStop.noul;
    if (stop >= NOUL_YES) {
        return { classification: "DNC", confidence: stop, reasoning: `Asks not to be contacted again (${percent(stop)}).` };
    }
    const away = answers.isAutoReply.noul;
    if (away >= NOUL_YES) {
        return { classification: "OOO", confidence: away, reasoning: `Automatic away message (${percent(away)}).` };
    }

    const label = answers.response.choice;
    const confidence = answers.response.probabilities[label];
    const reasoning = [
        `Reads as ${label.replace("_", " ")} (${percent(confidence)}).`,
        stop > NOUL_NO ? `May be asking not to be contacted (${percent(stop)}): check before replying.` : null
    ].filter(Boolean).join(" ");
    return { classification: RESPONSE_LABELS[label], confidence, reasoning };
}

// --- Friction in scraped content (IntentScoring) ---

/**
 * How strongly scraped text shows each kind of friction, as probabilities. Send it already
 * masked. Not billed to a team: the scraper webhook has no authenticated team.
 */
export async function judgeFriction(text: string): Promise<{ hostile: number; rejecting: number; spam: number }> {
    const answers = await ask("FRICTION_SCORING", undefined, { content: text }, {
        hostile: noul("Is the writer of `content` angry or hostile?", {
            true: "Insults, threats, or an angry complaint.",
            false: "A calm or friendly tone, even when critical."
        }),
        rejecting: noul("Does the writer of `content` refuse or turn something down?", {
            true: "They say no to an offer, a request, or further contact.",
            false: "They accept, ask something, or share information."
        }),
        spam: noul("Is `content` spam?", {
            true: "Unsolicited bulk promotion, a scam, or meaningless filler.",
            false: "Text written for a specific person, conversation, or audience."
        })
    });
    return { hostile: answers.hostile.noul, rejecting: answers.rejecting.noul, spam: answers.spam.noul };
}
