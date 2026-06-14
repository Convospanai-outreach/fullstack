import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { basicAnswerService, BasicAnswerContext } from "@/services/basicAnswerService";

const VALID_CONTEXTS = new Set(["support", "dashboard", "crm", "campaign", "general"]);

function normalizeContext(value: unknown): BasicAnswerContext {
    return typeof value === "string" && VALID_CONTEXTS.has(value)
        ? value as BasicAnswerContext
        : "general";
}

export async function POST(req: NextRequest) {
    try {
        const { teamId: currentTeamId } = await getCurrentContext();
        if (!currentTeamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const question = body?.question;
        if (typeof question !== "string" || !question.trim()) {
            return NextResponse.json({ error: "Question required" }, { status: 400 });
        }

        const requestedTeamId = typeof body?.teamId === "string" ? body.teamId : undefined;
        if (requestedTeamId && requestedTeamId !== currentTeamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await basicAnswerService.answer({
            question,
            teamId: currentTeamId,
            context: normalizeContext(body?.context)
        });

        return NextResponse.json(result);
    } catch (error: any) {
        const message = error?.message || "Assistant answer failed";
        if (message.includes("not allowed") || message.includes("exceeds") || message.includes("required")) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        return NextResponse.json({ error: "Assistant answer failed" }, { status: 500 });
    }
}
