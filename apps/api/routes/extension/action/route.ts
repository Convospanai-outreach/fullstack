import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { AuditService } from "@/modules/audit/auditService";
import { validateExtensionAuth } from "../_lib/auth";
import { resolveExtensionTeamScope } from "../_lib/teamScope";
import { PIIScrubber } from "@/lib/governance/PIIScrubber";
import { receiveExtensionPayload, ExtensionAction, StopReason } from "@/linkedin/extension-bridge";

function sanitizeText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const cleaned = PIIScrubber.scrub(value.trim());
    if (!cleaned) return undefined;
    return cleaned.slice(0, maxLength);
}

function normalizeLinkedInUrl(value: unknown): string | undefined {
    if (typeof value !== "string" || value.trim().length === 0) return undefined;
    try {
        const parsed = new URL(value.trim());
        if (parsed.protocol !== "https:") return undefined;
        if (!["linkedin.com", "www.linkedin.com"].includes(parsed.hostname.toLowerCase())) return undefined;
        return parsed.toString();
    } catch {
        return undefined;
    }
}

function normalizeDuration(value: unknown): number | undefined {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.floor(n);
}

export async function POST(req: NextRequest) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ ok: false, error: auth.error, code: auth.code }, { status: auth.status });
        }
        const body = await req.json().catch(() => ({}));
        const requestedTeamId = typeof body?.teamId === "string" ? body.teamId : req.headers.get("x-team-id");
        const teamScope = resolveExtensionTeamScope(auth.teamIds, requestedTeamId);
        if (!teamScope.ok) {
            return NextResponse.json({ ok: false, error: teamScope.error, code: teamScope.code }, { status: teamScope.status });
        }
        const teamId = teamScope.teamId;
        const userId = auth.user.id;

        const validStopReasons = ["VERIFICATION_REQUIRED", "INVITE_LIMIT_REACHED", "WARNING_DETECTED", "CHECKPOINT_DETECTED", "MANUAL_STOP"];
        if (body?.stopReason && !validStopReasons.includes(body.stopReason)) {
            return NextResponse.json({ ok: false, error: "Invalid stop reason", code: "INVALID_STOP_REASON" }, { status: 400 });
        }

        const sanitizedPayload = {
            action: sanitizeText(body?.action, 80) || "UNKNOWN",
            status: sanitizeText(body?.status, 80) || "UNKNOWN",
            leadId: sanitizeText(body?.leadId, 120) || null,
            profileUrl: normalizeLinkedInUrl(body?.profileUrl) || null,
            stopReason: sanitizeText(body?.stopReason, 180) || null,
            resultSummary: sanitizeText(body?.resultSummary || body?.details, 500) || null,
            durationMs: normalizeDuration(body?.durationMs ?? body?.duration) ?? null
        };

        logger.info("[Extension Action] Received action result:", { teamId, userId, ...sanitizedPayload });

        if (teamId && userId) {
            await receiveExtensionPayload({
                ...sanitizedPayload,
                action: sanitizedPayload.action as ExtensionAction,
                stopReason: sanitizedPayload.stopReason as StopReason,
                teamId,
                userId,
                taskId: body?.taskId
            });
        }

        return NextResponse.json({ ok: true, message: "Action recorded" });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Internal error";
        logger.error("[Extension Action] Error processing result:", { error: errorMessage });
        return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
    }
}
