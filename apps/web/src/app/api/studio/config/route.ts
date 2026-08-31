import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

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

        await prisma.team.update({
            where: { id: ctx.teamId },
            data: {
                aiConfig: {
                    ...currentAiConfig,
                    ...body // { formality, directness, talkingPoints, avoidWords }
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
