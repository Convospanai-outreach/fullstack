import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../_lib/auth";
import { resolveExtensionTeamScope } from "../_lib/teamScope";

const VALID_ACTIONS = [
    "ADD_LEAD",
    "OPEN_PROFILE",
    "INSERT_DRAFT",
    "LINKEDIN_TASK",
    "WHATSAPP_TASK",
    "CALL_TASK"
];

function sanitizeText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

export async function POST(req: NextRequest) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ ok: false, error: auth.error, code: auth.code }, { status: auth.status });
        }

        const body = await req.json().catch(() => ({}));
        const requestedTeamId = sanitizeText(body.teamId, 120) || req.headers.get("x-team-id");
        const teamScope = resolveExtensionTeamScope(auth.teamIds, requestedTeamId);
        if (!teamScope.ok) {
            return NextResponse.json({ ok: false, error: teamScope.error, code: teamScope.code }, { status: teamScope.status });
        }

        const action = sanitizeText(body.action, 80);
        if (!action || !VALID_ACTIONS.includes(action)) {
            return NextResponse.json({ ok: false, error: "Invalid action", code: "INVALID_ACTION" }, { status: 400 });
        }

        const payload = {
            action,
            status: sanitizeText(body.status, 80) || "UNKNOWN",
            taskId: sanitizeText(body.taskId, 120) || null,
            profileUrl: sanitizeText(body.profileUrl, 500) || null,
            details: asRecord(body.result || body.details)
        };

        await prisma.systemEvent.create({
            data: {
                teamId: teamScope.teamId,
                actorId: auth.user.id,
                type: "SYSTEM",
                name: "EXTENSION_MANUAL_ACTION",
                timestamp: new Date(),
                payload
            }
        });

        return NextResponse.json({ ok: true, message: "Action recorded" });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal error";
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
