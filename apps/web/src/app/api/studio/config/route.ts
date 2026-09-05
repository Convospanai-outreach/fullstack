import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

// Client-editable studio preferences only - aiConfig is a shared JSON blob
// that also stores smtpConfig and AI provider credentials, so the request
// body must never be spread into it wholesale.
const STUDIO_PATCHABLE_FIELDS = ["formality", "directness", "talkingPoints", "avoidWords"] as const;

function pickPatchableFields(body: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    for (const key of STUDIO_PATCHABLE_FIELDS) {
        if (key in body) data[key] = body[key];
    }
    return data;
}

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { prisma } = await import("@/lib/db");

        // aiConfig is a single shared JSON blob that also holds smtpConfig and AI
        // provider credentials (set during /setup) - merge into it rather than
        // replacing it wholesale, or saving studio tone preferences here would
        // silently wipe out the team's mailbox/API key config.
        const existing = await prisma.team.findUnique({
            where: { id: ctx.teamId },
            select: { aiConfig: true }
        });
        const currentAiConfig = (existing?.aiConfig as Record<string, unknown> | null) || {};
        const data = pickPatchableFields(body || {});

        await prisma.team.update({
            where: { id: ctx.teamId },
            data: {
                aiConfig: {
                    ...currentAiConfig,
                    ...data
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Failed to save studio config:", error);
        return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 });
    }
}

export async function GET(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { prisma } = await import("@/lib/db");
        const team = await prisma.team.findUnique({
            where: { id: ctx.teamId },
            select: { aiConfig: true }
        });

        return NextResponse.json({ config: team?.aiConfig || null });
    } catch (error: any) {
        console.error("Failed to load studio config:", error);
        return NextResponse.json({ error: "Failed to load configuration" }, { status: 500 });
    }
}
