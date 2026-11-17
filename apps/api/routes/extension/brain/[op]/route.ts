import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { aiService } from "@/lib/aiService";
import { enforceAIPromptPolicy } from "@/lib/aiInputGuardrails";
import { TaskComplexity } from "@/ai/types";
import { validateExtensionAuth } from "../../_lib/auth";
import { resolveExtensionTeamScope } from "../../_lib/teamScope";
import { checkSubscription } from "@/lib/subscription";
import { NO_CREDITS, NO_PLAN } from "@/services/extensionCopilot/account";
import { OPS, PromptBlockedError, type Ask } from "@/services/extensionCopilot/ops";

// One AI step for the copilot extension. The same Idempotency-Key always gets the same answer and
// is charged at most once: a retry of a finished call is served from ExtensionBrainCall, a retry
// while it still runs gets 409 "try again". Screening (small model) is free under a daily cap;
// text a prospect will read is billed to the team through aiService.

const MAX_BODY_CHARS = 60_000;
const PENDING_STALE_MS = 3 * 60_000;
const DAILY_CALL_CAP = Math.max(1, Number(process.env["EXTENSION_DAILY_AI_CALLS"]) || 600);

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const isInsufficientCredits = (e: unknown) => /insufficient credits/i.test(String((e as Error)?.message || ""));

export async function POST(req: NextRequest, { params }: { params: Promise<{ op: string }> }) {
    const auth = await validateExtensionAuth(req);
    if (!auth.ok) return json({ error: auth.error, code: auth.code }, auth.status);
    const scope = resolveExtensionTeamScope(auth.teamIds, req.headers.get("x-team-id"));
    if (!scope.ok) return json({ error: scope.error, code: scope.code }, scope.status);

    const { op } = await params;
    const run = OPS[op];
    if (!run) return json({ error: `Unknown operation ${String(op).slice(0, 60)}` }, 404);
    if (!(await checkSubscription(auth.user.id))) return json(NO_PLAN, 402);

    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) return json({ error: "Request too large" }, 413);
    let body: Record<string, any>;
    try {
        const parsed = JSON.parse(raw || "{}");
        body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return json({ error: "Invalid JSON" }, 400);
    }

    const userId = auth.user.id;
    const teamId = scope.teamId;
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    if ((await prisma.extensionBrainCall.count({ where: { userId, createdAt: { gte: since } } })) >= DAILY_CALL_CAP) {
        return json({ error: "Daily AI limit for the extension reached. It resets at midnight UTC." }, 429);
    }

    // Claim the key. A new row is ours; an existing one is a retry.
    const key = (req.headers.get("idempotency-key") || "").trim().slice(0, 200) || `nokey-${crypto.randomUUID()}`;
    const where = { userId_op_idempotencyKey: { userId, op, idempotencyKey: key } };
    let call = await prisma.extensionBrainCall.findUnique({ where });
    if (call?.status === "done") return json(call.result ?? {});
    if (call?.status === "pending" && Date.now() - call.updatedAt.getTime() < PENDING_STALE_MS) {
        return json({ error: "Still working on this step, try again in a moment" }, 409);
    }
    try {
        call = call
            ? await prisma.extensionBrainCall.update({ where, data: { status: "pending", result: undefined } })
            : await prisma.extensionBrainCall.create({ data: { userId, op, idempotencyKey: key, status: "pending" } });
    } catch (e: any) {
        if (e?.code === "P2002") return json({ error: "Still working on this step, try again in a moment" }, 409);
        throw e;
    }

    let billed = false;
    const ask: Ask = async ({ tier, system, user, json: expectsJson }) => {
        // aiService would throw on a refused prompt; refuse first so the op can answer safely, unbilled.
        try {
            enforceAIPromptPolicy(system, { label: "Extension system prompt" });
            enforceAIPromptPolicy(user, { label: "Extension prompt" });
        } catch (e) {
            throw new PromptBlockedError((e as Error).message);
        }
        // Only written text is billed; a screening answer stays free even when it falls back to the large model.
        const charge = tier === "large" && !expectsJson;
        const text = await aiService.askAI(user, charge ? teamId : undefined, {
            systemPrompt: system,
            complexity: tier === "small" ? TaskComplexity.TRIVIAL : TaskComplexity.ROUTINE,
            preferOpenModel: true,
            expectsJson,
            // The post or profile is the grounding: without it the output guardrail drops every claim.
            groundingContext: user,
            taskType: `EXTENSION_${op.toUpperCase().replace(/\W/g, "_")}`,
            actorId: userId
        });
        if (charge) billed = true;
        return text;
    };

    try {
        const result = await run(ask, body);
        if (result?.error) {
            await prisma.extensionBrainCall.update({ where, data: { status: "failed", billed } });
            return json(result, 422);
        }
        await prisma.extensionBrainCall.update({ where, data: { status: "done", result, billed } });
        return json(result);
    } catch (e) {
        await prisma.extensionBrainCall.update({ where, data: { status: "failed", billed } }).catch(() => {});
        if (isInsufficientCredits(e)) return json(NO_CREDITS, 402);
        logger.warn("[extension brain] op failed", { op, userId, error: (e as Error)?.message });
        return json({ error: "AI is temporarily unavailable, try again" }, 503);
    }
}
